/**
 * Hybrid Vector Search (pgvector Cosine HNSW) + BM25 Lexical Full-Text Search via Reciprocal Rank Fusion (RRF)
 */

import {
  createLogger,
  isPgAvailable,
  query,
  withTransaction,
  inMemoryStore,
  DbDocumentChunk,
  cosineSimilarity,
  generateEmbedding,
} from '@chronoviet/infra';

import { QUESTION_STOPWORDS } from './question-ner.js';
import { ChatSubIntent } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'rag-engine' });

export interface VectorSearchResult {
  chunkId: string;
  title: string;
  textContent: string;
  dynasty?: string;
  sourceReliability?: string;
  score: number;
  rankVector?: number;
  rankFts?: number;
  isCoRetrieved?: boolean;
  /** Graph-derived relevance signal: confidence-weighted hop decay in [0, 1]. */
  graphScore?: number;
  /** Minimum hop distance from a seed entity to this chunk's linked entity. */
  hopCount?: number;
  parentChunkId?: string;
  timeStart?: number;
  timeEnd?: number;
  epochIds?: string[];
}

export const RRF_K = 60;

import {
  removeVietnameseAccents,
  HISTORICAL_PERSON_DICTIONARY,
  HISTORICAL_LOCATION_DICTIONARY,
} from '@chronoviet/shared-spec';

import { globalCacheManager, LRUCacheWithTTL } from './cache-manager.js';

export const SimpleLRUCache = LRUCacheWithTTL;
export const queryEmbeddingCache = globalCacheManager.embeddingVectorCache;
const inFlightEmbeddings = new Map<string, Promise<number[]>>();

export async function getCachedQueryEmbedding(queryText: string): Promise<number[]> {
  const normalizedKey = queryText.trim().toLowerCase();
  const cached = globalCacheManager.embeddingVectorCache.getEmbedding(normalizedKey);
  if (cached) {
    return cached;
  }
  const inFlight = inFlightEmbeddings.get(normalizedKey);
  if (inFlight) {
    return inFlight;
  }
  const promise = (async () => {
    try {
      const emb = await generateEmbedding(queryText);
      globalCacheManager.embeddingVectorCache.setEmbedding(normalizedKey, emb);
      return emb;
    } finally {
      inFlightEmbeddings.delete(normalizedKey);
    }
  })();
  inFlightEmbeddings.set(normalizedKey, promise);
  return promise;
}

export function resetQueryEmbeddingCacheForTest(): void {
  globalCacheManager.embeddingVectorCache.clear();
  inFlightEmbeddings.clear();
}

/**
 * Normalizes query string for PostgreSQL tsquery (AND combination with prefix matching)
 */
export function sanitizeFtsQuery(queryText: string): string {
  if (!queryText || typeof queryText !== 'string') return '';
  const clean = queryText
    .replace(/[!&|()<>:*"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return '';

  const rawTokens = clean.toLowerCase().split(/\s+/).filter(Boolean);
  const tokens = rawTokens.filter((w) => !QUESTION_STOPWORDS.has(w));
  return (tokens.length > 0 ? tokens : rawTokens).join(' ');
}

/**
 * Calculates dynamic RRF fusion weights based on query sub-intent and lexical & temporal characteristics:
 * - FACTOID_LOOKUP: BM25 boost (FTS 0.80, Vector 0.20)
 * - GENEALOGY_RELATION: FTS 0.60, Vector 0.40
 * - BATTLE_TACTICS: Vector 0.60, FTS 0.40
 * - Exact year digits or Can Chi: BM25 boost (FTS 0.70, Vector 0.30)
 * - Purely conceptual / thematic: Vector boost (Vector 0.60, FTS 0.40)
 * - Balanced default (Vector 0.50, FTS 0.50)
 */
export function computeDynamicRrfWeights(
  queryText: string,
  subIntent?: ChatSubIntent
): { vectorWeight: number; ftsWeight: number } {
  if (subIntent === 'FACTOID_LOOKUP') {
    return { vectorWeight: 0.20, ftsWeight: 0.80 };
  }
  if (subIntent === 'GENEALOGY_RELATION') {
    return { vectorWeight: 0.40, ftsWeight: 0.60 };
  }
  if (subIntent === 'BATTLE_TACTICS') {
    return { vectorWeight: 0.60, ftsWeight: 0.40 };
  }
  if (subIntent === 'COMPARATIVE_SYNTHESIS') {
    return { vectorWeight: 0.50, ftsWeight: 0.50 };
  }

  const norm = queryText.toLowerCase();
  const hasExactYear = /\b(?:năm\s+)?\d{3,4}\b/.test(norm);
  const hasCanChi = /\b(?:giáp|ất|bính|đinh|mậu|kỷ|canh|tân|nhâm|quý)\s+(?:tý|sửu|dần|mão|thìn|tỵ|ngọ|mùi|thân|dậu|tuất|hợi)\b/i.test(norm);

  if (hasExactYear || hasCanChi) {
    return { vectorWeight: 0.30, ftsWeight: 0.70 };
  }

  const isConceptual = /(?:ý\s+nghĩa|ảnh\s+hưởng|nguyên\s+nhân|bối\s+cảnh|tổng\s+quan|đánh\s+giá|vai\s+trò)/i.test(norm);
  if (isConceptual && !/\b[A-ZÀ-Ỹ]/.test(queryText)) {
    return { vectorWeight: 0.60, ftsWeight: 0.40 };
  }

  return { vectorWeight: 0.50, ftsWeight: 0.50 };
}

/**
 * Executes Hybrid Vector (1024d) + BM25 Full-Text Search fused by Query-Adaptive RRF
 */
export async function searchHybridVectorAndBM25(
  queryText: string,
  queryEmbedding: number[] | Promise<number[]>,
  topK: number = 5,
  rrfK: number = RRF_K,
  detectedEntityIds?: string[],
  subIntent?: ChatSubIntent
): Promise<VectorSearchResult[]> {
  const pgConnected = await isPgAvailable();
  const [denseResults, ftsResults] = await Promise.all([
    searchDenseVector(queryEmbedding, topK * 3),
    searchLexicalFTS(queryText, topK * 3, detectedEntityIds),
  ]);

  const { vectorWeight, ftsWeight } = computeDynamicRrfWeights(queryText, subIntent);
  const chunkMap = new Map<string, VectorSearchResult>();

  denseResults.forEach((item, idx) => {
    const vecRank = idx + 1;
    chunkMap.set(item.chunkId, {
      chunkId: item.chunkId,
      title: item.title,
      textContent: item.textContent,
      dynasty: item.dynasty,
      sourceReliability: item.sourceReliability,
      parentChunkId: item.parentChunkId,
      timeStart: item.timeStart,
      timeEnd: item.timeEnd,
      epochIds: item.epochIds,
      score: vectorWeight / (rrfK + vecRank),
      rankVector: vecRank,
    });
  });

  ftsResults.forEach((item, idx) => {
    const ftsRank = idx + 1;
    const ftsScore = ftsWeight / (rrfK + ftsRank);
    const existing = chunkMap.get(item.chunkId);
    if (existing) {
      existing.score += ftsScore;
      existing.rankFts = ftsRank;
      if (!existing.parentChunkId && item.parentChunkId) existing.parentChunkId = item.parentChunkId;
      if (existing.timeStart === undefined && item.timeStart !== undefined) existing.timeStart = item.timeStart;
      if (existing.timeEnd === undefined && item.timeEnd !== undefined) existing.timeEnd = item.timeEnd;
      if (!existing.epochIds && item.epochIds) existing.epochIds = item.epochIds;
      if (!existing.dynasty && item.dynasty) existing.dynasty = item.dynasty;
    } else {
      chunkMap.set(item.chunkId, {
        chunkId: item.chunkId,
        title: item.title,
        textContent: item.textContent,
        dynasty: item.dynasty,
        sourceReliability: item.sourceReliability,
        parentChunkId: item.parentChunkId,
        timeStart: item.timeStart,
        timeEnd: item.timeEnd,
        epochIds: item.epochIds,
        score: ftsScore,
        rankFts: ftsRank,
      });
    }
  });

  const results = Array.from(chunkMap.values());
  results.sort((a, b) => b.score - a.score);

  log.debug('rag.hybrid_search_done', 'Hybrid vector + BM25 search completed', {
    denseHits: denseResults.length,
    ftsHits: ftsResults.length,
    fusedCandidates: results.length,
    topK,
    pgMode: pgConnected,
    vectorWeight,
    ftsWeight,
  });

  return results.slice(0, topK);
}

export async function searchDenseVector(
  queryEmbedding: number[] | Promise<number[]>,
  topK: number = 20
): Promise<VectorSearchResult[]> {
  const resolvedEmbedding = await queryEmbedding;
  const pgConnected = await isPgAvailable();
  if (pgConnected) {
    const adaptedEmbedding = resolvedEmbedding
      .slice(0, 1024)
      .concat(new Array(Math.max(0, 1024 - resolvedEmbedding.length)).fill(0));

    const vecRows = await withTransaction(async (execQuery) => {
      await execQuery('SET LOCAL hnsw.ef_search = 100;');
      return execQuery<{
        id: string;
        title: string;
        text_content: string;
        dynasty?: string;
        source_reliability?: string;
        parent_chunk_id?: string;
        time_start?: number;
        time_end?: number;
        epoch_ids?: string[];
        dist: number;
      }>(
        `SELECT id, title, text_content, dynasty, source_reliability, parent_chunk_id, time_start, time_end, epoch_ids, embedding <=> $1::vector AS dist
         FROM document_chunks
         WHERE embedding IS NOT NULL
         ORDER BY dist ASC
         LIMIT $2;`,
        [JSON.stringify(adaptedEmbedding), topK]
      );
    });

    if (vecRows && vecRows.length > 0) {
      return vecRows.map((r: any, idx: number) => ({
        chunkId: r.id,
        title: r.title,
        textContent: r.text_content,
        dynasty: r.dynasty,
        sourceReliability: r.source_reliability,
        parentChunkId: r.parent_chunk_id,
        timeStart: r.time_start != null ? Number(r.time_start) : undefined,
        timeEnd: r.time_end != null ? Number(r.time_end) : undefined,
        epochIds: r.epoch_ids,
        score: 1.0 / (1.0 + r.dist),
        rankVector: idx + 1,
      }));
    }
  }

  const chunks: DbDocumentChunk[] = Array.from(inMemoryStore.documentChunks.values());
  if (chunks.length === 0) return [];

  const scoredByVector = chunks
    .map((c) => ({
      chunk: c,
      sim: c.embedding ? cosineSimilarity(resolvedEmbedding, c.embedding) : 0,
    }))
    .sort((a, b) => b.sim - a.sim);

  return scoredByVector.slice(0, topK).map((item, idx) => ({
    chunkId: item.chunk.id,
    title: item.chunk.title,
    textContent: item.chunk.text_content,
    dynasty: item.chunk.dynasty,
    sourceReliability: item.chunk.source_reliability,
    parentChunkId: item.chunk.parent_chunk_id,
    timeStart: item.chunk.time_start != null ? Number(item.chunk.time_start) : undefined,
    timeEnd: item.chunk.time_end != null ? Number(item.chunk.time_end) : undefined,
    epochIds: item.chunk.epoch_ids,
    score: item.sim,
    rankVector: idx + 1,
  }));
}

function sanitizeTsToken(token: string): string {
  return token.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/gu, '').trim().toLowerCase();
}

/**
 * Builds enhanced PostgreSQL tsquery string injecting whitelisted multi-word aliases (>= 2 words)
 * with conjunctive '&' grouping per alias and disjunctive '|' across aliases.
 */
export function buildEnhancedFtsQuery(queryText: string, detectedEntityIds?: string[]): string {
  const sanitized = sanitizeFtsQuery(queryText);
  const baseTokens = sanitized
    .split(/\s+/)
    .map(sanitizeTsToken)
    .filter((t) => t.length >= 2);
  const unaccentedBaseTokens = removeVietnameseAccents(sanitized)
    .split(/\s+/)
    .map(sanitizeTsToken)
    .filter((t) => t.length >= 2);

  const allBaseTokens = Array.from(new Set([...baseTokens, ...unaccentedBaseTokens]));
  const baseClause = allBaseTokens.length > 0 ? allBaseTokens.join(' | ') : '';
  const aliasClauses: string[] = [];

  if (detectedEntityIds && detectedEntityIds.length > 0) {
    const seenAliases = new Set<string>();

    for (const entId of detectedEntityIds) {
      const candidates: string[] = [];
      const personEnt = HISTORICAL_PERSON_DICTIONARY[entId];
      if (personEnt?.aliases) {
        candidates.push(...personEnt.aliases);
      }
      const locEnt = HISTORICAL_LOCATION_DICTIONARY[entId];
      if (locEnt?.aliases) {
        candidates.push(...locEnt.aliases);
      }

      if (!personEnt && !locEnt) {
        for (const p of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
          if (p.entityId === entId && p.aliases) {
            candidates.push(...p.aliases);
          }
        }
        for (const l of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
          if (l.entityId === entId && l.aliases) {
            candidates.push(...l.aliases);
          }
        }
      }

      let entityInjectedCount = 0;
      for (const alias of candidates) {
        if (entityInjectedCount >= 3) break;
        const normalizedAlias = alias.trim().toLowerCase();
        if (seenAliases.has(normalizedAlias)) continue;
        seenAliases.add(normalizedAlias);

        const unaccentedWords = removeVietnameseAccents(normalizedAlias)
          .split(/\s+/)
          .map(sanitizeTsToken)
          .filter((w) => w.length >= 2 && !QUESTION_STOPWORDS.has(w));

        const accentedWords = normalizedAlias
          .split(/\s+/)
          .map(sanitizeTsToken)
          .filter((w) => w.length >= 2 && !QUESTION_STOPWORDS.has(w));

        // Strictly whitelist multi-word aliases (>= 2 high-signal tokens)
        if (unaccentedWords.length >= 2) {
          aliasClauses.push(`(${unaccentedWords.join(' & ')})`);
          if (accentedWords.join(' ') !== unaccentedWords.join(' ')) {
            aliasClauses.push(`(${accentedWords.join(' & ')})`);
          }
          entityInjectedCount++;
        }
      }
    }
  }

  const parts = [baseClause, ...aliasClauses].filter(Boolean);
  if (parts.length === 0) return '';
  return parts.join(' | ');
}

/**
 * Builds resilient PostgreSQL tsquery string with disjunctive OR across sanitized tokens
 */
export function buildDisjunctiveFtsTsQuery(queryText: string): string {
  return buildEnhancedFtsQuery(queryText);
}

export async function searchLexicalFTS(
  queryText: string,
  topK: number = 20,
  detectedEntityIds?: string[]
): Promise<VectorSearchResult[]> {
  const sanitizedQuery = sanitizeFtsQuery(queryText);
  if (!sanitizedQuery) return [];

  const pgConnected = await isPgAvailable();
  if (pgConnected) {
    const tsQueryStr = buildEnhancedFtsQuery(queryText, detectedEntityIds);
    let ftsRows: any[] = [];
    if (tsQueryStr) {
      try {
        ftsRows = await query<{
          id: string;
          title: string;
          text_content: string;
          dynasty?: string;
          source_reliability?: string;
          parent_chunk_id?: string;
          time_start?: number;
          time_end?: number;
          epoch_ids?: string[];
          rank: number;
        }>(
          `SELECT id, title, text_content, dynasty, source_reliability, parent_chunk_id, time_start, time_end, epoch_ids, ts_rank_cd(tsv, to_tsquery('simple', $1)) AS rank
           FROM document_chunks
           WHERE tsv @@ to_tsquery('simple', $1)
           ORDER BY rank DESC
           LIMIT $2;`,
          [tsQueryStr, topK]
        );
      } catch {
        ftsRows = [];
      }
    }

    if (!ftsRows || ftsRows.length === 0) {
      try {
        ftsRows = await query<{
          id: string;
          title: string;
          text_content: string;
          dynasty?: string;
          source_reliability?: string;
          parent_chunk_id?: string;
          time_start?: number;
          time_end?: number;
          epoch_ids?: string[];
          rank: number;
        }>(
          `SELECT id, title, text_content, dynasty, source_reliability, parent_chunk_id, time_start, time_end, epoch_ids, ts_rank_cd(tsv, websearch_to_tsquery('simple', $1)) AS rank
           FROM document_chunks
           WHERE tsv @@ websearch_to_tsquery('simple', $1)
           ORDER BY rank DESC
           LIMIT $2;`,
          [sanitizedQuery, topK]
        );
      } catch {
        try {
          ftsRows = await query<{
            id: string;
            title: string;
            text_content: string;
            dynasty?: string;
            source_reliability?: string;
            parent_chunk_id?: string;
            time_start?: number;
            time_end?: number;
            epoch_ids?: string[];
            rank: number;
          }>(
            `SELECT id, title, text_content, dynasty, source_reliability, parent_chunk_id, time_start, time_end, epoch_ids, ts_rank_cd(tsv, plainto_tsquery('simple', $1)) AS rank
             FROM document_chunks
             WHERE tsv @@ plainto_tsquery('simple', $1)
             ORDER BY rank DESC
             LIMIT $2;`,
            [sanitizedQuery, topK]
          );
        } catch {
          ftsRows = [];
        }
      }
    }

    if (ftsRows && ftsRows.length > 0) {
      return ftsRows.map((r: any, idx: number) => ({
        chunkId: r.id,
        title: r.title,
        textContent: r.text_content,
        dynasty: r.dynasty,
        sourceReliability: r.source_reliability,
        parentChunkId: r.parent_chunk_id,
        timeStart: r.time_start != null ? Number(r.time_start) : undefined,
        timeEnd: r.time_end != null ? Number(r.time_end) : undefined,
        epochIds: r.epoch_ids,
        score: r.rank,
        rankFts: idx + 1,
      }));
    }
  }

  const chunks: DbDocumentChunk[] = Array.from(inMemoryStore.documentChunks.values());
  if (chunks.length === 0) return [];

  const queryTerms = sanitizedQuery.split(/\s+/).filter((t) => t.length >= 2);
  const extraAliasTerms: string[] = [];
  if (detectedEntityIds && detectedEntityIds.length > 0) {
    for (const entId of detectedEntityIds) {
      const p = HISTORICAL_PERSON_DICTIONARY[entId];
      if (p?.aliases) {
        for (const a of p.aliases) {
          const aWords = a.toLowerCase().split(/\s+/).filter((w) => w.length >= 2 && !QUESTION_STOPWORDS.has(w));
          if (aWords.length >= 2) extraAliasTerms.push(...aWords);
        }
      }
      const l = HISTORICAL_LOCATION_DICTIONARY[entId];
      if (l?.aliases) {
        for (const a of l.aliases) {
          const aWords = a.toLowerCase().split(/\s+/).filter((w) => w.length >= 2 && !QUESTION_STOPWORDS.has(w));
          if (aWords.length >= 2) extraAliasTerms.push(...aWords);
        }
      }
    }
  }
  const allTerms = Array.from(new Set([...queryTerms, ...extraAliasTerms]));
  const unaccentedTerms = allTerms.map(removeVietnameseAccents);

  const scoredByBM25 = chunks
    .map((c) => {
      const contentLower = c.text_content.toLowerCase();
      const titleLower = c.title.toLowerCase();
      const unaccentedContent = removeVietnameseAccents(contentLower);
      const unaccentedTitle = removeVietnameseAccents(titleLower);

      let matchCount = 0;
      for (let i = 0; i < allTerms.length; i++) {
        const term = allTerms[i];
        const unaccentedTerm = unaccentedTerms[i];

        if (contentLower.includes(term) || unaccentedContent.includes(unaccentedTerm)) {
          matchCount += 1;
        }
        if (titleLower.includes(term) || unaccentedTitle.includes(unaccentedTerm)) {
          matchCount += 2;
        }
      }
      return { chunk: c, matchCount };
    })
    .filter((item) => item.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount);

  return scoredByBM25.slice(0, topK).map((item, idx) => ({
    chunkId: item.chunk.id,
    title: item.chunk.title,
    textContent: item.chunk.text_content,
    dynasty: item.chunk.dynasty,
    sourceReliability: item.chunk.source_reliability,
    parentChunkId: item.chunk.parent_chunk_id,
    timeStart: item.chunk.time_start != null ? Number(item.chunk.time_start) : undefined,
    timeEnd: item.chunk.time_end != null ? Number(item.chunk.time_end) : undefined,
    epochIds: item.chunk.epoch_ids,
    score: item.matchCount,
    rankFts: idx + 1,
  }));
}
