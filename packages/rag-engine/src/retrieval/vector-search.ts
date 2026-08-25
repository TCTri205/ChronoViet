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
}

export const RRF_K = 60;

import { removeVietnameseAccents } from '@chronoviet/shared-spec';
export { removeVietnameseAccents };

export class SimpleLRUCache<K, V> {
  private readonly map = new Map<K, V>();
  constructor(private readonly maxEntries: number = 500) {}

  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    if (this.map.size >= this.maxEntries) this.map.delete(this.map.keys().next().value!);
    this.map.set(key, value);
  }

  has(key: K): boolean { return this.map.has(key); }
  size(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
}

export const queryEmbeddingCache = new SimpleLRUCache<string, number[]>(500);
const inFlightEmbeddings = new Map<string, Promise<number[]>>();

export async function getCachedQueryEmbedding(queryText: string): Promise<number[]> {
  const normalizedKey = queryText.trim().toLowerCase();
  const cached = queryEmbeddingCache.get(normalizedKey);
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
      queryEmbeddingCache.set(normalizedKey, emb);
      return emb;
    } finally {
      inFlightEmbeddings.delete(normalizedKey);
    }
  })();
  inFlightEmbeddings.set(normalizedKey, promise);
  return promise;
}

export function resetQueryEmbeddingCacheForTest(): void {
  queryEmbeddingCache.clear();
  inFlightEmbeddings.clear();
}

/**
 * Sanitizes natural language query by stripping Vietnamese stopwords before FTS tsquery
 */
export function sanitizeFtsQuery(queryText: string): string {
  if (!queryText || typeof queryText !== 'string') return '';
  const tokens = queryText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !QUESTION_STOPWORDS.has(w));

  if (tokens.length === 0) {
    // If all tokens were stopwords (e.g. "Ai là ai"), fallback to non-empty alphanumeric tokens
    const rawTokens = queryText
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);
    return rawTokens.join(' ');
  }
  return tokens.join(' ');
}

/**
 * Executes Hybrid Vector (1024d) + BM25 Full-Text Search fused by RRF
 */
export async function searchHybridVectorAndBM25(
  queryText: string,
  queryEmbedding: number[] | Promise<number[]>,
  topK: number = 5,
  rrfK: number = RRF_K
): Promise<VectorSearchResult[]> {
  const pgConnected = await isPgAvailable();
  const [denseResults, ftsResults] = await Promise.all([
    searchDenseVector(queryEmbedding, topK * 3),
    searchLexicalFTS(queryText, topK * 3),
  ]);

  const chunkMap = new Map<string, VectorSearchResult>();

  denseResults.forEach((item, idx) => {
    const vecRank = idx + 1;
    chunkMap.set(item.chunkId, {
      chunkId: item.chunkId,
      title: item.title,
      textContent: item.textContent,
      dynasty: item.dynasty,
      sourceReliability: item.sourceReliability,
      score: 1 / (rrfK + vecRank),
      rankVector: vecRank,
    });
  });

  ftsResults.forEach((item, idx) => {
    const ftsRank = idx + 1;
    const ftsScore = 1 / (rrfK + ftsRank);
    const existing = chunkMap.get(item.chunkId);
    if (existing) {
      existing.score += ftsScore;
      existing.rankFts = ftsRank;
    } else {
      chunkMap.set(item.chunkId, {
        chunkId: item.chunkId,
        title: item.title,
        textContent: item.textContent,
        dynasty: item.dynasty,
        sourceReliability: item.sourceReliability,
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
    const adaptedEmbedding =
      resolvedEmbedding.length === 1024
        ? resolvedEmbedding
        : resolvedEmbedding.length > 1024
        ? resolvedEmbedding.slice(0, 1024)
        : [...resolvedEmbedding, ...new Array(1024 - resolvedEmbedding.length).fill(0)];

    const vecRows = await withTransaction(async (execQuery) => {
      await execQuery('SET LOCAL hnsw.ef_search = 100;');
      return execQuery<{
        id: string;
        title: string;
        text_content: string;
        dynasty?: string;
        source_reliability?: string;
        dist: number;
      }>(
        `SELECT id, title, text_content, dynasty, source_reliability, embedding <=> $1::vector AS dist
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
    score: item.sim,
    rankVector: idx + 1,
  }));
}

/**
 * Builds resilient PostgreSQL tsquery string with disjunctive OR across sanitized tokens
 */
export function buildDisjunctiveFtsTsQuery(queryText: string): string {
  const sanitized = sanitizeFtsQuery(queryText);
  if (!sanitized) return '';

  const tokens = sanitized
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, ''))
    .filter((t) => t.length >= 2);

  if (tokens.length === 0) return '';
  return tokens.join(' | ');
}

export async function searchLexicalFTS(
  queryText: string,
  topK: number = 20
): Promise<VectorSearchResult[]> {
  const sanitizedQuery = sanitizeFtsQuery(queryText);
  if (!sanitizedQuery) return [];

  const pgConnected = await isPgAvailable();
  if (pgConnected) {
    const tsQueryStr = buildDisjunctiveFtsTsQuery(queryText);
    let ftsRows: any[] = [];
    if (tsQueryStr) {
      try {
        ftsRows = await query<{
          id: string;
          title: string;
          text_content: string;
          dynasty?: string;
          source_reliability?: string;
          rank: number;
        }>(
          `SELECT id, title, text_content, dynasty, source_reliability, ts_rank_cd(tsv, to_tsquery('simple', $1)) AS rank
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
          rank: number;
        }>(
          `SELECT id, title, text_content, dynasty, source_reliability, ts_rank_cd(tsv, websearch_to_tsquery('simple', $1)) AS rank
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
            rank: number;
          }>(
            `SELECT id, title, text_content, dynasty, source_reliability, ts_rank_cd(tsv, plainto_tsquery('simple', $1)) AS rank
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
        score: r.rank,
        rankFts: idx + 1,
      }));
    }
  }

  const chunks: DbDocumentChunk[] = Array.from(inMemoryStore.documentChunks.values());
  if (chunks.length === 0) return [];

  const queryTerms = sanitizedQuery.split(/\s+/).filter((t) => t.length >= 2);
  const unaccentedQueryTerms = queryTerms.map(removeVietnameseAccents);

  const scoredByBM25 = chunks
    .map((c) => {
      const contentLower = c.text_content.toLowerCase();
      const titleLower = c.title.toLowerCase();
      const unaccentedContent = removeVietnameseAccents(contentLower);
      const unaccentedTitle = removeVietnameseAccents(titleLower);

      let matchCount = 0;
      for (let i = 0; i < queryTerms.length; i++) {
        const term = queryTerms[i];
        const unaccentedTerm = unaccentedQueryTerms[i];

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
    score: item.matchCount,
    rankFts: idx + 1,
  }));
}
