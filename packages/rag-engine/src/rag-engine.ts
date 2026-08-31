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
import { rerankCandidates, truncateToSentenceBoundary, extractQueryRelevantExcerpt } from './retrieval/reranker.js';
import { detectQueryIntent } from './generation/prompt-engine.js';
import {
  generateHistoricalAnswer,
  generateHistoricalAnswerStream,
  HistoricalAnswerStreamEvent,
} from './generation/answer-generator.js';

const log = createLogger({ service: 'rag-engine' });

/**
 * Small graph co-retrieval boost weighted by the chunk's graph signal
 * (confidence x hop decay), replacing the previous flat +0.35 boost that
 * displaced better FTS/vector candidates.
 */
export const GRAPH_BOOST_SCALE = 0.05;
export const GRAPH_BRANCH_TIMEOUT_MS = process.env.GRAPH_BRANCH_TIMEOUT_MS
  ? parseInt(process.env.GRAPH_BRANCH_TIMEOUT_MS, 10)
  : 350;
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

    // Steps 2, 3, 4: Dual-Branch Parallel Execution (with Conditional Comparative Decomposition)
    const isComparative = (detectQueryIntent(queryText) === 'COMPARATIVE' || request.subIntent === 'COMPARATIVE_SYNTHESIS') && filterEntityIds.length >= 2;

    let hybridCandidates: VectorSearchResult[] = [];
    let graphResult: { triples: GraphTriple[]; aliasTable: Record<string, string[]>; entityIds: string[] } = {
      triples: [],
      aliasTable: {},
      entityIds: [],
    };
    let graphChunks: VectorSearchResult[] = [];
    let timedOut = false;

    if (isComparative) {
      const entA = filterEntityIds[0];
      const entB = filterEntityIds[1];
      const nameA = queryInfo.entityNames[0] || entA;
      const nameB = queryInfo.entityNames[1] || entB;

      const subQueryA = `${queryText} ${nameA}`;
      const subQueryB = `${queryText} ${nameB}`;

      const [gRes, [resA, resB]] = await Promise.all([
        searchLocalGraphCTE(filterEntityIds, {
          maxHops: request.subIntent === 'GENEALOGY_RELATION' ? 3 : 2,
          maxNodes: GRAPH_BRANCH_MAX_NODES,
          timeoutMs: GRAPH_BRANCH_TIMEOUT_MS,
        }).catch(() => ({ triples: [], aliasTable: {}, entityIds: [], timedOut: true })),
        Promise.all([
          searchHybridVectorAndBM25(
            subQueryA,
            getCachedQueryEmbedding(subQueryA),
            Math.max(10, rerankTopK * 2),
            60,
            [entA],
            request.subIntent
          ),
          searchHybridVectorAndBM25(
            subQueryB,
            getCachedQueryEmbedding(subQueryB),
            Math.max(10, rerankTopK * 2),
            60,
            [entB],
            request.subIntent
          ),
        ]),
      ]);

      graphResult = gRes as any;
      timedOut = Boolean(gRes.timedOut);

      const gSignals = new Map<string, ChunkGraphSignal>();
      for (const t of graphResult.triples) {
        for (const eid of [t.sourceEntityId, t.targetEntityId]) {
          const existing = gSignals.get(eid);
          if (!existing) {
            gSignals.set(eid, { maxConfidence: t.confidence, minHop: t.hopCount });
          } else {
            existing.maxConfidence = Math.max(existing.maxConfidence, t.confidence);
            existing.minHop = Math.min(existing.minHop, t.hopCount);
          }
        }
      }

      graphChunks = await getChunksForEntities(
        graphResult.entityIds.length > 0 ? graphResult.entityIds : filterEntityIds,
        20,
        filterEntityIds,
        gSignals
      ).catch(() => []);

      // Balanced 50/50 RRF fusion between both entities
      const balancedMap = new Map<string, VectorSearchResult>();
      resA.forEach((item, idx) => {
        const score = 0.5 * (1 / (60 + idx + 1));
        balancedMap.set(item.chunkId, { ...item, score });
      });
      resB.forEach((item, idx) => {
        const score = 0.5 * (1 / (60 + idx + 1));
        const existing = balancedMap.get(item.chunkId);
        if (existing) {
          existing.score += score;
        } else {
          balancedMap.set(item.chunkId, { ...item, score });
        }
      });
      hybridCandidates = Array.from(balancedMap.values());
    } else {
      const graphBranchPromise = (async () => {
        try {
          const gRes = await searchLocalGraphCTE(filterEntityIds, {
            maxHops: request.subIntent === 'GENEALOGY_RELATION' ? 3 : 2,
            maxNodes: request.subIntent === 'GENEALOGY_RELATION' ? 60 : GRAPH_BRANCH_MAX_NODES,
            timeoutMs: GRAPH_BRANCH_TIMEOUT_MS,
          });

          const graphSignals = new Map<string, ChunkGraphSignal>();
          for (const t of gRes.triples) {
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

          const gChunks = await getChunksForEntities(
            gRes.entityIds,
            20,
            filterEntityIds,
            graphSignals
          );
          return { graphResult: gRes, graphChunks: gChunks, timedOut: Boolean(gRes.timedOut) };
        } catch (err) {
          log.warn('rag.graph_branch_error', 'Graph branch failed; falling back gracefully to vector/FTS retrieval only', {
            error: err,
            query: queryText,
          });
          return {
            graphResult: { triples: [], aliasTable: {}, entityIds: [] },
            graphChunks: [],
            timedOut: true,
          };
        }
      })();

      const vectorBranchPromise = (async () => {
        const queryIntent = detectQueryIntent(queryText);
        const isCausalOrOrigin =
          queryIntent === 'WHY_REASONING' ||
          request.subIntent === 'GENEALOGY_RELATION' ||
          /(?:nguồn\s*gốc|tại\s*sao|vì\s*sao|lý\s*do|nguyên\s*nhân|tập\s*tục|dòng\s*họ|biến\s*thiên|họ\s*nguyễn)/i.test(
            queryText
          );

        if (isCausalOrOrigin) {
          const expandedThematicQuery = `${queryText} nguồn gốc biến cố chuyển giao triều đại đổi họ ban quốc tính lịch sử`;
          const [primaryCandidates, expandedCandidates] = await Promise.all([
            searchHybridVectorAndBM25(
              queryText,
              getCachedQueryEmbedding(queryText),
              Math.max(15, rerankTopK * 3),
              60,
              filterEntityIds,
              request.subIntent
            ),
            searchHybridVectorAndBM25(
              expandedThematicQuery,
              getCachedQueryEmbedding(expandedThematicQuery),
              Math.max(15, rerankTopK * 3),
              60,
              filterEntityIds,
              request.subIntent
            ),
          ]);

          const fusedMap = new Map<string, VectorSearchResult>();
          primaryCandidates.forEach((item, idx) => {
            fusedMap.set(item.chunkId, { ...item, score: 0.6 * (1 / (60 + idx + 1)) });
          });
          expandedCandidates.forEach((item, idx) => {
            const score = 0.4 * (1 / (60 + idx + 1));
            const existing = fusedMap.get(item.chunkId);
            if (existing) {
              existing.score += score;
            } else {
              fusedMap.set(item.chunkId, { ...item, score });
            }
          });
          return Array.from(fusedMap.values());
        }

        const embeddingPromise = getCachedQueryEmbedding(queryText);
        const candidates = await searchHybridVectorAndBM25(
          queryText,
          embeddingPromise,
          Math.max(15, rerankTopK * 3),
          60,
          filterEntityIds,
          request.subIntent
        );
        return candidates;
      })();

      const [gBranch, vBranch] = await Promise.all([
        graphBranchPromise,
        vectorBranchPromise,
      ]);

      graphResult = gBranch.graphResult;
      graphChunks = gBranch.graphChunks;
      timedOut = gBranch.timedOut;
      hybridCandidates = vBranch;
    }

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
    const topChunks = await rerankCandidates(
      queryText,
      allCandidates,
      rerankTopK,
      queryInfo.extractedYears,
      request.subIntent
    );

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
      const cleanSummary = extractQueryRelevantExcerpt(chunk.textContent || '', queryText, 900);
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
        parentChunkId: chunk.parentChunkId,
        timeStart: chunk.timeStart,
        timeEnd: chunk.timeEnd,
        dynasty: chunk.dynasty,
        epochIds: chunk.epochIds,
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
    return generateHistoricalAnswer(this, request);
  }

  /**
   * Streaming Grounded Historical Answer Generation with TTFT instrumentation
   */
  async *generateAnswerStream(
    request: HistoricalAnswerGenerationRequest
  ): AsyncGenerator<HistoricalAnswerStreamEvent> {
    await ensureGlobalSchemaInitialized();
    yield* generateHistoricalAnswerStream(this, request);
  }

  /**
   * Ingest historical document into RAG database
   */
  async ingestDocument(
    content: string,
    metadata: {
      title: string;
      source: string;
      dynasty?: string;
      sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
      timeStart?: number;
      timeEnd?: number;
      parentChunkId?: string;
      epochIds?: string[];
    }
  ): Promise<void> {
    await ensureGlobalSchemaInitialized();
    await ingestHistoricalDocument(content, metadata);
  }
}

