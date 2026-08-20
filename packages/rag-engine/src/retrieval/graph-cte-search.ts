/**
 * Local Subgraph Search using PostgreSQL Recursive CTEs ($k=1, 2$) & In-Memory Fallback
 */

import { createLogger, isPgAvailable, query, inMemoryStore, buildAliasTable } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'rag-engine' });


export interface GraphTriple {
  sourceEntityId: string;
  relationType: string;
  targetEntityId: string;
  confidence: number;
  hopCount: number;
}

export interface LocalGraphSearchResult {
  triples: GraphTriple[];
  aliasTable: Record<string, string[]>;
  entityIds: string[];
}

export async function searchLocalGraphCTE(
  entityIds: string[],
  maxHops: number = 2
): Promise<LocalGraphSearchResult> {
  if (!entityIds || entityIds.length === 0) {
    return { triples: [], aliasTable: {}, entityIds: [] };
  }

  const pgConnected = await isPgAvailable();
  const triples: GraphTriple[] = [];
  const visitedEntities = new Set<string>(entityIds);
  const seenTriples = new Set<string>();

  if (pgConnected) {
    const sql = `
      WITH RECURSIVE graph_cte AS (
        SELECT 
          source_entity_id, 
          target_entity_id, 
          relation_type, 
          confidence, 
          1 AS depth,
          ARRAY[source_entity_id, target_entity_id]::text[] AS visited_path
        FROM relationships
        WHERE source_entity_id = ANY($1) OR target_entity_id = ANY($1)
        UNION ALL
        SELECT 
          r.source_entity_id, 
          r.target_entity_id, 
          r.relation_type, 
          r.confidence, 
          g.depth + 1,
          g.visited_path || ARRAY[r.source_entity_id, r.target_entity_id]::text[]
        FROM relationships r
        INNER JOIN graph_cte g ON (
          (r.source_entity_id = g.target_entity_id OR r.target_entity_id = g.source_entity_id)
          AND NOT (r.source_entity_id = ANY(g.visited_path) AND r.target_entity_id = ANY(g.visited_path))
        )
        WHERE g.depth < $2
      )
      SELECT DISTINCT source_entity_id, target_entity_id, relation_type, confidence, depth FROM graph_cte;
    `;
    const rows = await query<{
      source_entity_id: string;
      target_entity_id: string;
      relation_type: string;
      confidence: number;
      depth: number;
    }>(sql, [entityIds, maxHops]);

    if (rows && rows.length > 0) {
      for (const r of rows) {
        const key = `${r.source_entity_id}:${r.relation_type}:${r.target_entity_id}`;
        if (!seenTriples.has(key)) {
          seenTriples.add(key);
          triples.push({
            sourceEntityId: r.source_entity_id,
            relationType: r.relation_type,
            targetEntityId: r.target_entity_id,
            confidence: r.confidence,
            hopCount: r.depth,
          });
          visitedEntities.add(r.source_entity_id);
          visitedEntities.add(r.target_entity_id);
        }
      }
    }
  }

  if (triples.length === 0) {
    // In-Memory Graph Recursive Traversal Fallback with Cycle Pruning
    let currentFrontier = new Set<string>(entityIds);

    for (let hop = 1; hop <= maxHops; hop++) {
      const nextFrontier = new Set<string>();
      for (const rel of inMemoryStore.relationships) {
        if (currentFrontier.has(rel.source_entity_id) || currentFrontier.has(rel.target_entity_id)) {
          const key = `${rel.source_entity_id}:${rel.relation_type}:${rel.target_entity_id}`;
          if (!seenTriples.has(key)) {
            seenTriples.add(key);
            triples.push({
              sourceEntityId: rel.source_entity_id,
              relationType: rel.relation_type,
              targetEntityId: rel.target_entity_id,
              confidence: rel.confidence,
              hopCount: hop,
            });
          }

          if (!visitedEntities.has(rel.source_entity_id)) {
            visitedEntities.add(rel.source_entity_id);
            nextFrontier.add(rel.source_entity_id);
          }
          if (!visitedEntities.has(rel.target_entity_id)) {
            visitedEntities.add(rel.target_entity_id);
            nextFrontier.add(rel.target_entity_id);
          }
        }
      }
      currentFrontier = nextFrontier;
      if (currentFrontier.size === 0) break;
    }
  }

  const allEntityIds = Array.from(visitedEntities);
  const rawAliasTable = buildAliasTable(allEntityIds);
  const sortedKeys = Object.keys(rawAliasTable).sort((a, b) => b.length - a.length);
  const aliasTable: Record<string, string[]> = {};
  for (const key of sortedKeys) {
    aliasTable[key] = rawAliasTable[key];
  }

  log.debug('rag.graph_search_done', 'Local subgraph CTE search completed', {
    seedEntityIds: entityIds.length,
    triplesFound: triples.length,
    entityIdsTotal: allEntityIds.length,
    pgMode: pgConnected,
  });

  return {
    triples,
    aliasTable,
    entityIds: allEntityIds,
  };
}
