import { isPgAvailable, query, inMemoryStore, DbDocumentChunk } from '@chronoviet/infra';

import { VectorSearchResult, RRF_K } from './vector-search.js';

export interface ChunkGraphSignal {
  /** Maximum triple confidence among the chunk's linked entities, in [0, 1]. */
  maxConfidence: number;
  /** Minimum hop distance from a seed entity to the chunk's linked entities. */
  minHop: number;
}

/**
 * Orders chunks by seed-entity priority first (chunks directly linked to a seed/query
 * entity rank above generic reliability-ordered content), then source reliability.
 * Scores graph chunks with a confidence-weighted hop decay so the fusion step can
 * weight them by actual graph relevance instead of a flat boost.
 */
export async function getChunksForEntities(
  entityIds: string[],
  limit: number = 20,
  priorityEntityIds?: string[],
  graphSignals?: Map<string, ChunkGraphSignal>
): Promise<VectorSearchResult[]> {
  if (!entityIds || entityIds.length === 0 || limit <= 0) return [];

  const pgConnected = await isPgAvailable();
  const prioritySet = new Set(priorityEntityIds || []);
  const signalFor = (chunkId: string, entityId: string): { conf: number; hop: number } => {
    const sig = graphSignals?.get(entityId);
    if (!sig) return { conf: 0.5, hop: 2 };
    return { conf: sig.maxConfidence, hop: sig.minHop };
  };

  if (pgConnected) {
    const rows = await query<{
      id: string;
      title: string;
      text_content: string;
      dynasty?: string;
      source_reliability?: string;
      entity_id: string;
    }>(
      `SELECT c.id, c.title, c.text_content, c.dynasty, c.source_reliability, ec.entity_id
       FROM document_chunks c
       INNER JOIN entity_chunks ec ON c.id = ec.chunk_id
       WHERE ec.entity_id = ANY($1)
       ORDER BY
         CASE WHEN ec.entity_id = ANY($2) THEN 0 ELSE 1 END ASC,
         CASE c.source_reliability
           WHEN 'LEVEL_1' THEN 1
           WHEN 'LEVEL_2' THEN 2
           ELSE 3
         END ASC,
         c.id ASC
       LIMIT $3;`,
      [entityIds, priorityEntityIds || [], limit * 3]
    );

    if (rows && rows.length > 0) {
      // Aggregate per-chunk graph signal across its linked entities.
      const chunkAgg = new Map<string, { conf: number; hop: number }>();
      const chunkOrder: string[] = [];
      for (const r of rows) {
        const { conf, hop } = signalFor(r.id, r.entity_id);
        const agg = chunkAgg.get(r.id);
        if (!agg) {
          chunkAgg.set(r.id, { conf, hop });
          chunkOrder.push(r.id);
        } else {
          agg.conf = Math.max(agg.conf, conf);
          agg.hop = Math.min(agg.hop, hop);
        }
      }

      const seen = new Set<string>();
      const result: VectorSearchResult[] = [];
      for (const r of rows) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        const agg = chunkAgg.get(r.id)!;
        const graphScore = agg.conf * Math.pow(0.6, Math.max(0, agg.hop - 1));
        result.push({
          chunkId: r.id,
          title: r.title,
          textContent: r.text_content,
          dynasty: r.dynasty,
          sourceReliability: r.source_reliability,
          score: 1.0 / (RRF_K + (result.length + 1)),
          graphScore,
          hopCount: agg.hop,
        });
      }
      return result.slice(0, limit);
    }
  }

  // In-Memory Fallback: Filter and Deterministically Sort
  const entitySet = new Set(entityIds);
  const matchedChunkIds = new Set<string>();
  for (const ec of inMemoryStore.entityChunks) {
    if (entitySet.has(ec.entity_id)) {
      matchedChunkIds.add(ec.chunk_id);
    }
  }

  const rawChunks: DbDocumentChunk[] = [];
  for (const id of matchedChunkIds) {
    const chunk = inMemoryStore.documentChunks.get(id);
    if (chunk) {
      rawChunks.push(chunk);
    }
  }

  const reliabilityOrder: Record<string, number> = {
    LEVEL_1: 1,
    LEVEL_2: 2,
    LEVEL_3: 3,
  };

  rawChunks.sort((a, b) => {
    const aPriority = a.key_figures?.some((e) => prioritySet.has(e)) ? 0 : 1;
    const bPriority = b.key_figures?.some((e) => prioritySet.has(e)) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const rA = reliabilityOrder[a.source_reliability || 'LEVEL_1'] ?? 3;
    const rB = reliabilityOrder[b.source_reliability || 'LEVEL_1'] ?? 3;
    if (rA !== rB) return rA - rB;
    return a.id.localeCompare(b.id);
  });

  return rawChunks.slice(0, limit).map((chunk, idx) => {
    let maxConf = 0.5;
    let minHop = 2;
    for (const entId of chunk.key_figures || []) {
      const { conf, hop } = signalFor(chunk.id, entId);
      maxConf = Math.max(maxConf, conf);
      minHop = Math.min(minHop, hop);
    }
    return {
      chunkId: chunk.id,
      title: chunk.title,
      textContent: chunk.text_content,
      dynasty: chunk.dynasty,
      sourceReliability: chunk.source_reliability,
      score: 1.0 / (RRF_K + (idx + 1)),
      graphScore: maxConf * Math.pow(0.6, Math.max(0, minHop - 1)),
      hopCount: minHop,
    };
  });
}
