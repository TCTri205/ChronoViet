/**
 * Main Chrono-RAG Engine Implementation: Knowledge & Fact Retrieval Service
 */

import {
  IRagEngine,
  RagSearchRequest,
  RagSearchResponse,
  HistoricalContextEntity,
  createLogger,
  envConfig,
  isPgAvailable,
  initSchema,
  ingestHistoricalDocument,
  resolveCanonicalEntity,
} from '@chronoviet/shared-spec';

import { extractQueryEntities } from './retrieval/question-ner.js';
import { searchLocalGraphCTE } from './retrieval/graph-cte-search.js';
import {
  searchHybridVectorAndBM25,
  VectorSearchResult,
  getCachedQueryEmbedding,
} from './retrieval/vector-search.js';
import { getChunksForEntities } from './retrieval/chunk-retriever.js';
import { rerankCandidates } from './retrieval/reranker.js';

const log = createLogger({ service: 'rag-engine' });

export const CO_RETRIEVAL_BOOST = 0.35;

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
  private async ensureInitialized(): Promise<void> {
    await ensureGlobalSchemaInitialized();
  }

  /**
   * 5-Step Online Retrieval Engine with Dual-Branch Parallelism & Co-Retrieval Boost
   */
  async search(request: RagSearchRequest): Promise<RagSearchResponse> {
    const startTime = Date.now();
    await this.ensureInitialized();

    // Eval Integrity: strict mode requires real Postgres — in-memory fallback is not a valid benchmark
    if (envConfig.EVAL_STRICT) {
      const pgUp = await isPgAvailable(true);
      if (!pgUp) {
        throw new Error('[EVAL_STRICT] PostgreSQL is unavailable — RAG retrieval requires real pgvector DB during evaluation');
      }
    }

    const queryText = request.query;
    const rerankTopK = request.rerankTopK || 5;

    log.debug('rag.search_started', 'RAG search started', {
      query: queryText,
      rerankTopK,
      entityFilter: request.entityFilter,
      maxTokens: request.maxTokens,
    });

    // Step 1: Question NER & Keyword Extraction (< 1ms)
    const queryInfo = extractQueryEntities(queryText);
    const filterEntityIds = request.entityFilter || queryInfo.entityIds;

    // Steps 2, 3, 4: Dual-Branch Parallel Execution (Graph Branch & Vector Branch)
    const graphBranchPromise = (async () => {
      const graphResult = await searchLocalGraphCTE(filterEntityIds, 2);
      const graphChunks = await getChunksForEntities(graphResult.entityIds, 30);
      return { graphResult, graphChunks };
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

    const [{ graphResult, graphChunks }, hybridCandidates] = await Promise.all([
      graphBranchPromise,
      vectorBranchPromise,
    ]);

    // Step 4b: Deduplicate & Apply Co-Retrieval Fusion Boost
    const candidateMap = new Map<string, VectorSearchResult>();

    for (const cand of hybridCandidates) {
      candidateMap.set(cand.chunkId, { ...cand });
    }

    for (const gCand of graphChunks) {
      const existing = candidateMap.get(gCand.chunkId);
      if (existing) {
        // Co-retrieval boost: chunk is co-validated by both vector similarity and knowledge graph structure
        existing.score += CO_RETRIEVAL_BOOST;
      } else {
        candidateMap.set(gCand.chunkId, { ...gCand });
      }
    }

    const allCandidates = Array.from(candidateMap.values());

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

    // Map top chunks to Verified Context Entities
    const verifiedContext: HistoricalContextEntity[] = topChunks.map((chunk, idx) => {
      let matchedCanonicalName = '';
      let matchedAliases: string[] = [];

      for (const [canonicalName, aliases] of Object.entries(graphResult.aliasTable)) {
        if (
          chunk.title.includes(canonicalName) ||
          chunk.textContent.includes(canonicalName) ||
          aliases.some((alias) => chunk.title.includes(alias) || chunk.textContent.includes(alias))
        ) {
          matchedCanonicalName = canonicalName;
          matchedAliases = aliases;
          break;
        }
      }

      const canonical = resolveCanonicalEntity(matchedCanonicalName || chunk.title);
      const canonicalName = matchedCanonicalName || canonical.canonicalName || chunk.title;
      const aliases = matchedAliases.length > 0 ? matchedAliases : canonical.aliases || [];

      return {
        entityId: canonical.entityId,
        canonicalName,
        aliases,
        summary: chunk.textContent,
        citations: [`Tập sử liệu: ${chunk.title}`, `Mức độ tin cậy: ${chunk.sourceReliability || 'LEVEL_1'}`],
        confidenceScore: Math.min(1.0, 0.85 + (topChunks.length - idx) * 0.03),
      };
    });

    const citations: string[] = topChunks.map(
      (chunk) => `${chunk.title} [Nguồn: ${chunk.sourceReliability || 'LEVEL_1'}]`
    );

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
   * Ingest historical document into RAG database
   */
  async ingestDocument(
    content: string,
    metadata: { title: string; source: string; dynasty?: string; sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' }
  ): Promise<void> {
    await this.ensureInitialized();
    await ingestHistoricalDocument(content, metadata);
  }
}

