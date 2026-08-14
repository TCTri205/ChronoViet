/**
 * Main Chrono-RAG Engine Implementation: Knowledge & Fact Retrieval Service
 */

import {
  IRagEngine,
  RagSearchRequest,
  RagSearchResponse,
  HistoricalContextEntity,
  createLogger,
} from '@chronoviet/shared-spec';

import { initSchema, generateEmbedding, ingestHistoricalDocument, resolveCanonicalEntity } from '@chronoviet/shared-spec';

import { extractQueryEntities } from './retrieval/question-ner.js';
import { searchLocalGraphCTE } from './retrieval/graph-cte-search.js';
import { searchHybridVectorAndBM25, VectorSearchResult } from './retrieval/vector-search.js';
import { getChunksForEntities } from './retrieval/chunk-retriever.js';
import { rerankCandidates } from './retrieval/reranker.js';

const log = createLogger({ service: 'rag-engine' });

export class ChronoRagEngine implements IRagEngine {
  private schemaInitialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.schemaInitialized) {
      await initSchema();
      this.schemaInitialized = true;
    }
  }

  /**
   * 5-Step Online Retrieval Engine
   */
  async search(request: RagSearchRequest): Promise<RagSearchResponse> {
    const startTime = Date.now();
    await this.ensureInitialized();

    const queryText = request.query;
    const rerankTopK = request.rerankTopK || 5;

    log.debug('rag.search_started', 'RAG search started', {
      query: queryText,
      rerankTopK,
      entityFilter: request.entityFilter,
      maxTokens: request.maxTokens,
    });

    // Step 1: Question NER & Keyword Extraction
    const queryInfo = extractQueryEntities(queryText);
    const filterEntityIds = request.entityFilter || queryInfo.entityIds;

    // Step 2: Local Subgraph CTE Search ($k=1, 2$) & Alias Table building
    const graphResult = await searchLocalGraphCTE(filterEntityIds, 2);

    // Step 3: Hybrid Vector Search (1024d) + BM25 FTS & RRF Fusion
    const queryEmbedding = await generateEmbedding(queryText);
    const hybridCandidates = await searchHybridVectorAndBM25(queryText, queryEmbedding, Math.max(15, rerankTopK * 3));

    // Step 4: Graph-Guided Chunk Retrieval
    const graphChunks = await getChunksForEntities(graphResult.entityIds);

    // Deduplicate candidate chunks
    const candidateMap = new Map<string, VectorSearchResult>();
    for (const cand of [...hybridCandidates, ...graphChunks]) {
      candidateMap.set(cand.chunkId, cand);
    }
    const allCandidates = Array.from(candidateMap.values());

    // Step 5: Integrated Reranker & Response Formatting
    const topChunks = rerankCandidates(queryText, allCandidates, rerankTopK);

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

    const retrievalLatencyMs = Date.now() - startTime;

    return {
      verifiedContext,
      aliasTable: graphResult.aliasTable,
      citations,
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

