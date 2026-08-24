/**
 * Main Chrono-RAG Engine Implementation: Knowledge & Fact Retrieval Service
 */

import {
  IRagEngine,
  RagSearchRequest,
  RagSearchRequestInput,
  RagSearchResponse,
  HistoricalContextEntity,
  resolveCanonicalEntity,
  HistoricalAnswerGenerationRequest,
  HistoricalAnswerResponse,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  envConfig,
  isPgAvailable,
  initSchema,
  ingestHistoricalDocument,
} from '@chronoviet/infra';

import { extractQueryEntities } from './retrieval/question-ner.js';
import { searchLocalGraphCTE, GraphTriple } from './retrieval/graph-cte-search.js';
import {
  searchHybridVectorAndBM25,
  VectorSearchResult,
  getCachedQueryEmbedding,
} from './retrieval/vector-search.js';
import { getChunksForEntities, ChunkGraphSignal } from './retrieval/chunk-retriever.js';
import { rerankCandidates, truncateToSentenceBoundary } from './retrieval/reranker.js';
import { AnswerGenerator } from './generation/answer-generator.js';

const log = createLogger({ service: 'rag-engine' });

/**
 * Small graph co-retrieval boost weighted by the chunk's graph signal
 * (confidence x hop decay), replacing the previous flat +0.35 boost that
 * displaced better FTS/vector candidates.
 */
export const GRAPH_BOOST_SCALE = 0.05;
export const GRAPH_BRANCH_TIMEOUT_MS = process.env.GRAPH_BRANCH_TIMEOUT_MS
  ? parseInt(process.env.GRAPH_BRANCH_TIMEOUT_MS, 10)
  : 150;
export const GRAPH_BRANCH_MAX_NODES = 50;
export const GRAPH_ONLY_CHUNK_CAP = 10;

let globalSchemaInitPromise: Promise<void> | null = null;

export async function ensureGlobalSchemaInitialized(): Promise<void> {
  if (!globalSchemaInitPromise) {
    globalSchemaInitPromise = (async () => {
      try {
        await initSchema();
      } catch (err) {
        log.warn('rag.schema_init_failed', 'Schema initialization failed; will retry on next request', {
          error: err,
        });
        globalSchemaInitPromise = null;
      }
    })();
  }
  return globalSchemaInitPromise;
}

export function resetGlobalSchemaInitForTest(): void {
  globalSchemaInitPromise = null;
}

export class ChronoRagEngine implements IRagEngine {
  /**
   * 5-Step Online Retrieval Engine with Dual-Branch Parallelism & Co-Retrieval Boost
   */
  async search(request: RagSearchRequestInput): Promise<RagSearchResponse> {
    const startTime = Date.now();
    await ensureGlobalSchemaInitialized();

    // Eval Integrity: strict mode requires real Postgres — in-memory fallback is not a valid benchmark
    if (envConfig.EVAL_STRICT) {
      const pgUp = await isPgAvailable(true);
      if (!pgUp) {
        throw new Error('[EVAL_STRICT] PostgreSQL is unavailable — RAG retrieval requires real pgvector DB during evaluation');
      }
    }

    const queryText = request.query;

    // Step 1: Question NER & Keyword Extraction (< 1ms)
    const queryInfo = extractQueryEntities(queryText);
    const filterEntityIds = request.entityFilter || queryInfo.entityIds;
    const rerankTopK = request.rerankTopK || Math.min(8, Math.max(5, queryInfo.entityIds.length * 2));

    log.debug('rag.search_started', 'RAG search started', {
      query: queryText,
      rerankTopK,
      entityFilter: request.entityFilter,
      maxTokens: request.maxTokens,
    });

    // Steps 2, 3, 4: Dual-Branch Parallel Execution (Graph Branch & Vector Branch)
    const graphBranchPromise = (async () => {
      const graphResult = await searchLocalGraphCTE(filterEntityIds, {
        maxHops: 2,
        maxNodes: GRAPH_BRANCH_MAX_NODES,
        timeoutMs: GRAPH_BRANCH_TIMEOUT_MS,
      });

      // Entity -> (maxConfidence, minHop) signals for weighting graph chunks by relevance.
      const graphSignals = new Map<string, ChunkGraphSignal>();
      for (const t of graphResult.triples) {
        for (const eid of [t.sourceEntityId, t.targetEntityId]) {
          const existing = graphSignals.get(eid);
          if (!existing) {
            graphSignals.set(eid, { maxConfidence: t.confidence, minHop: t.hopCount });
          } else {
            existing.maxConfidence = Math.max(existing.maxConfidence, t.confidence);
            existing.minHop = Math.min(existing.minHop, t.hopCount);
          }
        }
      }

      const graphChunks = await getChunksForEntities(
        graphResult.entityIds,
        20,
        filterEntityIds,
        graphSignals
      );
      return { graphResult, graphChunks, timedOut: Boolean(graphResult.timedOut) };
    })();

    const vectorBranchPromise = (async () => {
      const queryEmbedding = await getCachedQueryEmbedding(queryText);
      const hybridCandidates = await searchHybridVectorAndBM25(
        queryText,
        queryEmbedding,
        Math.max(15, rerankTopK * 3)
      );
      return hybridCandidates;
    })();

    const [{ graphResult, graphChunks, timedOut }, hybridCandidates] = await Promise.all([
      graphBranchPromise,
      vectorBranchPromise,
    ]);

    // Step 4b: Deduplicate & Apply Co-Retrieval Fusion Boost
    const candidateMap = new Map<string, VectorSearchResult>();

    for (const cand of hybridCandidates) {
      candidateMap.set(cand.chunkId, { ...cand });
    }

    if (!timedOut) {
      for (const gCand of graphChunks) {
        const existing = candidateMap.get(gCand.chunkId);
        const graphBoost = GRAPH_BOOST_SCALE * (gCand.graphScore ?? 0.5);
        if (existing) {
          // Small graph-weighted co-retrieval boost; the chunk was also ranked by vector/FTS.
          existing.score += graphBoost;
          existing.isCoRetrieved = true;
        } else if (graphChunks.indexOf(gCand) < GRAPH_ONLY_CHUNK_CAP) {
          // Graph-only chunks enter the pool with a LOW score (below hybrid RRF scores) so
          // they never crowd out better vector/FTS candidates; the cross-encoder can still
          // promote them if genuinely relevant.
          candidateMap.set(gCand.chunkId, {
            ...gCand,
            score: 0.001 + (gCand.hopCount ?? 2) * 0.0005,
          });
        }
      }
    } else {
      log.warn('rag.graph_branch_timeout', 'Graph branch timed out; skipping graph fusion', {
        timeoutMs: GRAPH_BRANCH_TIMEOUT_MS,
      });
    }

    const allCandidates = Array.from(candidateMap.values());
    // Sort by pre-rerank score so graph-only chunks can actually enter the rerank pool.
    allCandidates.sort((a, b) => b.score - a.score);

    // Step 5: Pure Model Cross-Encoder Reranker & Response Formatting
    const topChunks = await rerankCandidates(queryText, allCandidates, rerankTopK);

    log.debug('rag.search_completed', 'RAG search completed', {
      query: queryText,
      nerEntities: queryInfo.entityIds.length,
      graphEntityIds: graphResult.entityIds.length,
      hybridCandidates: hybridCandidates.length,
      graphChunks: graphChunks.length,
      allCandidates: allCandidates.length,
      topChunks: topChunks.length,
      retrievalLatencyMs: Date.now() - startTime,
    });

    // Map top chunks to Verified Context Entities with maxTokens budget enforcement
    const maxTokensBudget = request.maxTokens && request.maxTokens > 0 ? request.maxTokens : 2048;
    const VIETNAMESE_CHARS_PER_TOKEN = 3.5;

    const verifiedContext: HistoricalContextEntity[] = [];
    const citations: string[] = [];
    let accumulatedTokens = 0;

    for (let idx = 0; idx < topChunks.length; idx++) {
      const chunk = topChunks[idx];
      const cleanSummary = truncateToSentenceBoundary(chunk.textContent || '', 800);
      const estimatedChunkTokens = Math.ceil(
        (cleanSummary.length + (chunk.title?.length || 0)) / VIETNAMESE_CHARS_PER_TOKEN
      );

      // Stop adding further entity chunks if budget exceeded, but guarantee at least top-1 entity is retained
      if (verifiedContext.length > 0 && accumulatedTokens + estimatedChunkTokens > maxTokensBudget) {
        break;
      }

      let matchedCanonicalName = '';
      let matchedAliases: string[] = [];

      for (const [canonicalName, aliases] of Object.entries(graphResult.aliasTable)) {
        if (
          chunk.title.includes(canonicalName) ||
          cleanSummary.includes(canonicalName) ||
          aliases.some((alias) => chunk.title.includes(alias) || cleanSummary.includes(alias))
        ) {
          matchedCanonicalName = canonicalName;
          matchedAliases = aliases;
          break;
        }
      }

      const canonical = resolveCanonicalEntity(matchedCanonicalName || chunk.title);
      const canonicalName = matchedCanonicalName || canonical.canonicalName || chunk.title;
      const aliases = matchedAliases.length > 0 ? matchedAliases : canonical.aliases || [];

      verifiedContext.push({
        entityId: canonical.entityId,
        canonicalName,
        aliases,
        summary: cleanSummary,
        citations: [`Tập sử liệu: ${chunk.title}`, `Mức độ tin cậy: ${chunk.sourceReliability || 'LEVEL_1'}`],
        confidenceScore: typeof chunk.score === 'number' && !isNaN(chunk.score)
          ? Math.min(1.0, Math.max(0.1, Number(chunk.score.toFixed(3))))
          : Math.min(1.0, 0.85 + (topChunks.length - idx) * 0.03),
        chunkId: chunk.chunkId,
        title: chunk.title,
        sourceReliability: chunk.sourceReliability as any,
      });

      citations.push(`${chunk.title} [Nguồn: ${chunk.sourceReliability || 'LEVEL_1'}]`);
      accumulatedTokens += estimatedChunkTokens;
    }

    const triples = graphResult.triples.map((t) => ({
      source: t.sourceEntityId,
      relation: t.relationType,
      target: t.targetEntityId,
      confidence: t.confidence,
    }));

    const retrievalLatencyMs = Date.now() - startTime;

    return {
      verifiedContext,
      aliasTable: graphResult.aliasTable,
      citations,
      triples,
      retrievalLatencyMs,
    };
  }

  /**
   * End-to-End Grounded Historical Answer Generation with Graph Reasoning & Claim Verification
   */
  async generateAnswer(
    request: HistoricalAnswerGenerationRequest
  ): Promise<HistoricalAnswerResponse> {
    await ensureGlobalSchemaInitialized();
    return AnswerGenerator.generate(this, request);
  }

  /**
   * Streaming Grounded Historical Answer Generation
   */
  async *generateAnswerStream(
    request: HistoricalAnswerGenerationRequest
  ): AsyncGenerator<{ type: 'token' | 'triples' | 'citations' | 'done'; content?: string; triples?: any[]; citations?: string[] }> {
    await ensureGlobalSchemaInitialized();
    yield* AnswerGenerator.generateStream(this, request);
  }

  /**
   * Ingest historical document into RAG database
   */
  async ingestDocument(
    content: string,
    metadata: { title: string; source: string; dynasty?: string; sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' }
  ): Promise<void> {
    await ensureGlobalSchemaInitialized();
    await ingestHistoricalDocument(content, metadata);
  }
}

