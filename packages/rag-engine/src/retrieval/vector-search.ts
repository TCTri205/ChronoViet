/**
 * Hybrid Vector Search (pgvector Cosine HNSW) + BM25 Lexical Full-Text Search via Reciprocal Rank Fusion (RRF)
 */

import {
  createLogger,
  isPgAvailable,
  query,
  inMemoryStore,
  DbDocumentChunk,
  cosineSimilarity,
  generateEmbedding,
} from '@chronoviet/shared-spec';

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
}

export const RRF_K = 60;

/**
 * LRU Cache for Query Embeddings to avoid repeated HTTP calls
 */
export class SimpleLRUCache<K, V> {
  private maxEntries: number;
  private cache: Map<K, V>;

  constructor(maxEntries: number = 500) {
    this.maxEntries = maxEntries;
    this.cache = new Map<K, V>();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    // Re-insert to mark as recently used
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const queryEmbeddingCache = new SimpleLRUCache<string, number[]>(500);

export async function getCachedQueryEmbedding(queryText: string): Promise<number[]> {
  const normalizedKey = queryText.trim().toLowerCase();
  const cached = queryEmbeddingCache.get(normalizedKey);
  if (cached) {
    return cached;
  }
  const emb = await generateEmbedding(queryText);
  queryEmbeddingCache.set(normalizedKey, emb);
  return emb;
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
  queryEmbedding: number[],
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
  queryEmbedding: number[],
  topK: number = 20
): Promise<VectorSearchResult[]> {
  const pgConnected = await isPgAvailable();
  if (pgConnected) {
    const adaptedEmbedding =
      queryEmbedding.length === 1024
        ? queryEmbedding
        : queryEmbedding.length > 1024
        ? queryEmbedding.slice(0, 1024)
        : [...queryEmbedding, ...new Array(1024 - queryEmbedding.length).fill(0)];

    const vecRows = await query<{
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
    if (vecRows && vecRows.length > 0) {
      return vecRows.map((r, idx) => ({
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
      sim: c.embedding ? cosineSimilarity(queryEmbedding, c.embedding) : 0,
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

export async function searchLexicalFTS(
  queryText: string,
  topK: number = 20
): Promise<VectorSearchResult[]> {
  const sanitizedQuery = sanitizeFtsQuery(queryText);
  if (!sanitizedQuery) return [];

  const pgConnected = await isPgAvailable();
  if (pgConnected) {
    const ftsRows = await query<{
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
    if (ftsRows && ftsRows.length > 0) {
      return ftsRows.map((r, idx) => ({
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
  const scoredByBM25 = chunks
    .map((c) => {
      const contentLower = c.text_content.toLowerCase();
      const titleLower = c.title.toLowerCase();
      let matchCount = 0;
      for (const term of queryTerms) {
        if (contentLower.includes(term)) matchCount += 1;
        if (titleLower.includes(term)) matchCount += 2;
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
