/**
 * Graph-Guided Chunk Retrieval Service
 */

import { isPgAvailable, query, inMemoryStore } from '@chronoviet/shared-spec';

import { VectorSearchResult } from './vector-search.js';

export async function getChunksForEntities(entityIds: string[]): Promise<VectorSearchResult[]> {
  if (!entityIds || entityIds.length === 0) return [];

  const pgConnected = await isPgAvailable();

  if (pgConnected) {
    const rows = await query<{
      id: string;
      title: string;
      text_content: string;
      dynasty?: string;
      source_reliability?: string;
    }>(
      `SELECT DISTINCT c.id, c.title, c.text_content, c.dynasty, c.source_reliability
       FROM document_chunks c
       INNER JOIN entity_chunks ec ON c.id = ec.chunk_id
       WHERE ec.entity_id = ANY($1);`,
      [entityIds]
    );

    return rows.map((r) => ({
      chunkId: r.id,
      title: r.title,
      textContent: r.text_content,
      dynasty: r.dynasty,
      sourceReliability: r.source_reliability,
      score: 1.0,
    }));
  }

  // In-Memory Fallback
  const chunkIds = new Set<string>();
  for (const ec of inMemoryStore.entityChunks) {
    if (entityIds.includes(ec.entity_id)) {
      chunkIds.add(ec.chunk_id);
    }
  }

  const results: VectorSearchResult[] = [];
  for (const id of chunkIds) {
    const chunk = inMemoryStore.documentChunks.get(id);
    if (chunk) {
      results.push({
        chunkId: chunk.id,
        title: chunk.title,
        textContent: chunk.text_content,
        dynasty: chunk.dynasty,
        sourceReliability: chunk.source_reliability,
        score: 1.0,
      });
    }
  }

  return results;
}
