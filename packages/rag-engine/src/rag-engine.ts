/**
 * Main Chrono-RAG Engine Implementation: Knowledge & Fact Retrieval Service
 */

import {
  IRagEngine,
  RagSearchRequest,
  RagSearchResponse,
  HistoricalContextEntity,
} from '@chronoviet/shared-spec';

import { initSchema } from './db/client.js';
import { ingestDocument as ingestPipelineDoc, IngestionMetadata } from './ingestion/ingest-pipeline.js';
import { generateEmbedding } from './ingestion/embedding-service.js';
import { extractQueryEntities } from './retrieval/question-ner.js';
import { searchLocalGraphCTE } from './retrieval/graph-cte-search.js';
import { searchHybridVectorAndBM25, VectorSearchResult } from './retrieval/vector-search.js';
import { getChunksForEntities } from './retrieval/chunk-retriever.js';
import { rerankCandidates } from './retrieval/reranker.js';

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

    // Step 1: Question NER & Keyword Extraction
    const queryInfo = extractQueryEntities(queryText);
    const filterEntityIds = request.entityFilter || queryInfo.entityIds;

    // Step 2: Local Subgraph CTE Search ($k=1, 2$) & Alias Table building
    const graphResult = await searchLocalGraphCTE(filterEntityIds, 2);

    // Step 3: Hybrid Vector Search (1024d) + BM25 FTS & RRF Fusion
    const queryEmbedding = await generateEmbedding(queryText);
    const hybridCandidates = await searchHybridVectorAndBM25(queryText, queryEmbedding, 10);

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

    // Map top chunks to Verified Context Entities
    const verifiedContext: HistoricalContextEntity[] = topChunks.map((chunk, idx) => ({
      entityId: chunk.chunkId,
      canonicalName: chunk.title,
      aliases: graphResult.aliasTable[chunk.title] || [],
      summary: chunk.textContent,
      citations: [`Tập sử liệu: ${chunk.title}`, `Mức độ tin cậy: ${chunk.sourceReliability || 'LEVEL_1'}`],
      confidenceScore: Math.min(1.0, 0.85 + (topChunks.length - idx) * 0.03),
    }));

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
    const ingestMetadata: IngestionMetadata = {
      title: metadata.title,
      source: metadata.source,
      dynasty: metadata.dynasty,
      sourceReliability: metadata.sourceReliability || 'LEVEL_1',
    };
    await ingestPipelineDoc(content, ingestMetadata);
  }
}
