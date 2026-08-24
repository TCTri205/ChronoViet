/**
 * Local Subgraph Search — Directed BFS with Global Visited-Set, Node Budget & Timeout
 *
 * Replaces the unbounded undirected recursive CTE with a hop-bounded BFS that:
 * - Traverses forward (source -> target) for every relation type.
 * - Traverses reverse (target -> source) only for high-signal relation types
 *   (LED_BY, PART_OF, ALIAS_OF), e.g. event --LED_BY--> person when the seed is the person.
 * - Deduplicates nodes globally (each node enters the frontier once).
 * - Respects a node budget (maxNodes) and a wall-clock timeout (timeoutMs).
 * - Filters low-confidence edges.
 */

import { buildAliasTable } from '@chronoviet/shared-spec';
import { createLogger, isPgAvailable, query, inMemoryStore } from '@chronoviet/infra';

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
  timedOut?: boolean;
  budgetHit?: boolean;
}

export interface GraphTraversalOptions {
  maxHops?: number;
  maxNodes?: number;
  timeoutMs?: number;
  relationTypes?: string[];
  minConfidence?: number;
}

/** Relation types traversed in the reverse direction (target -> source). */
export const REVERSE_TRAVERSAL_RELATIONS = new Set(['LED_BY', 'PART_OF', 'ALIAS_OF']);

/** Low-signal relation types excluded by default from traversal (noise / hub explosion). */
export const DEFAULT_EXCLUDED_RELATION_TYPES = new Set(['MENTIONED_IN', 'SAME_AS_LOCATION']);

export const DEFAULT_MAX_NODES = 50;
export const DEFAULT_TIMEOUT_MS = 150;
export const DEFAULT_MIN_CONFIDENCE = 0.5;

interface RelationshipRow {
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  confidence: number;
}

function shouldTraverse(relationType: string, relationTypes?: string[]): boolean {
  if (relationTypes && relationTypes.length > 0) {
    return relationTypes.includes(relationType);
  }
  return !DEFAULT_EXCLUDED_RELATION_TYPES.has(relationType);
}

function isReverseTraversal(relationType: string): boolean {
  return REVERSE_TRAVERSAL_RELATIONS.has(relationType);
}

export async function searchLocalGraphCTE(
  entityIds: string[],
  optionsOrHops?: number | GraphTraversalOptions
): Promise<LocalGraphSearchResult> {
  if (!entityIds || entityIds.length === 0) {
    return { triples: [], aliasTable: {}, entityIds: [] };
  }

  const options: GraphTraversalOptions =
    typeof optionsOrHops === 'number' ? { maxHops: optionsOrHops } : optionsOrHops || {};

  const maxHops = Math.max(1, options.maxHops ?? 2);
  const maxNodes = Math.max(1, options.maxNodes ?? DEFAULT_MAX_NODES);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const relationTypes = options.relationTypes;

  const pgConnected = await isPgAvailable();
  const startTime = Date.now();

  const triples: GraphTriple[] = [];
  const visitedEntities = new Set<string>(entityIds);
  const seenTriples = new Set<string>();

  let currentFrontier = new Set<string>(entityIds);

  const addEdge = (row: RelationshipRow, hop: number): boolean => {
    const key = `${row.source_entity_id}:${row.relation_type}:${row.target_entity_id}`;
    if (seenTriples.has(key)) return false;
    seenTriples.add(key);
    triples.push({
      sourceEntityId: row.source_entity_id,
      relationType: row.relation_type,
      targetEntityId: row.target_entity_id,
      confidence: row.confidence,
      hopCount: hop,
    });
    return true;
  };

  const absorb = (rows: RelationshipRow[], hop: number, reverse: boolean): Set<string> => {
    const next = new Set<string>();
    for (const row of rows) {
      if (!shouldTraverse(row.relation_type, relationTypes)) continue;
      if (row.confidence < minConfidence) continue;
      if (reverse && !isReverseTraversal(row.relation_type)) continue;

      const sourceVisited = visitedEntities.has(row.source_entity_id);
      const targetVisited = visitedEntities.has(row.target_entity_id);

      // Both endpoints already visited -> edge is a duplicate; skip.
      if (sourceVisited && targetVisited) continue;
      // Node budget exhausted and this edge would introduce a new node -> stop expanding.
      if (visitedEntities.size >= maxNodes) continue;

      if (addEdge(row, hop)) {
        if (!sourceVisited) {
          visitedEntities.add(row.source_entity_id);
          next.add(row.source_entity_id);
        }
        if (!targetVisited) {
          visitedEntities.add(row.target_entity_id);
          next.add(row.target_entity_id);
        }
      }
    }
    return next;
  };

  for (let hop = 1; hop <= maxHops; hop++) {
    if (currentFrontier.size === 0) break;
    const frontierArr = Array.from(currentFrontier);

    let forwardRows: RelationshipRow[] = [];
    let reverseRows: RelationshipRow[] = [];
    if (pgConnected) {
      const [fRows, rRows] = await Promise.all([
        query<RelationshipRow>(
          `SELECT source_entity_id, target_entity_id, relation_type, confidence
           FROM relationships
           WHERE source_entity_id = ANY($1)
           ORDER BY confidence DESC;`,
          [frontierArr]
        ),
        query<RelationshipRow>(
          `SELECT source_entity_id, target_entity_id, relation_type, confidence
           FROM relationships
           WHERE target_entity_id = ANY($1)
           ORDER BY confidence DESC;`,
          [frontierArr]
        ),
      ]);
      forwardRows = fRows;
      reverseRows = rRows;
    } else {
      for (const rel of inMemoryStore.relationships) {
        if (frontierArr.includes(rel.source_entity_id)) forwardRows.push(rel);
        if (frontierArr.includes(rel.target_entity_id)) reverseRows.push(rel);
      }
    }

    let nextFrontier = new Set<string>();
    nextFrontier = absorb(forwardRows, hop, false);
    if (visitedEntities.size < maxNodes) {
      const reverseNext = absorb(reverseRows, hop, true);
      for (const id of reverseNext) nextFrontier.add(id);
    }

    currentFrontier = nextFrontier;

    if (Date.now() - startTime > timeoutMs) {
      log.warn('rag.graph_timeout', 'Graph traversal hit wall-clock timeout', {
        timeoutMs,
        hopsTraversed: hop,
        visitedEntities: visitedEntities.size,
      });
      break;
    }
  }

  const budgetHit = visitedEntities.size >= maxNodes;

  const allEntityIds = Array.from(visitedEntities);
  const rawAliasTable = buildAliasTable(allEntityIds);
  const sortedKeys = Object.keys(rawAliasTable).sort((a, b) => b.length - a.length);
  const aliasTable: Record<string, string[]> = {};
  for (const key of sortedKeys) {
    aliasTable[key] = rawAliasTable[key];
  }

  log.debug('rag.graph_search_done', 'Local subgraph BFS search completed', {
    seedEntityIds: entityIds.length,
    triplesFound: triples.length,
    entityIdsTotal: allEntityIds.length,
    pgMode: pgConnected,
    budgetHit,
  });

  return {
    triples,
    aliasTable,
    entityIds: allEntityIds,
    timedOut: Date.now() - startTime > timeoutMs,
    budgetHit,
  };
}
