/**
 * Hybrid Vector Search (pgvector Cosine HNSW) + BM25 Lexical Full-Text Search via Reciprocal Rank Fusion (RRF)
 */

import { isPgAvailable, query, inMemoryStore, DbDocumentChunk } from '../db/client.js';
import { cosineSimilarity } from '../ingestion/embedding-service.js';

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

const RRF_K = 60;

/**
 * Executes Hybrid Vector (1024d) + BM25 Full-Text Search fused by RRF
 */
export async function searchHybridVectorAndBM25(
  queryText: string,
  queryEmbedding: number[],
  topK: number = 5
): Promise<VectorSearchResult[]> {
  const pgConnected = await isPgAvailable();

  if (pgConnected) {
    // Execute Vector (HNSW Cosine Distance) and BM25 Full-Text Search in Parallel
    const [vecRows, ftsRows] = await Promise.all([
      query<{
        id: string;
        title: string;
        text_content: string;
        dynasty?: string;
        source_reliability?: string;
        dist: number;
      }>(
        `SELECT id, title, text_content, dynasty, source_reliability, embedding <=> $1::vector AS dist
         FROM document_chunks
         ORDER BY dist ASC
         LIMIT $2;`,
        [JSON.stringify(queryEmbedding), topK * 2]
      ),
      query<{
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
        [queryText, topK * 2]
      ),
    ]);

    // Combine using Reciprocal Rank Fusion (RRF)
    const chunkMap = new Map<string, VectorSearchResult>();

    vecRows.forEach((row, idx) => {
      const vecRank = idx + 1;
      const score = 1 / (RRF_K + vecRank);
      chunkMap.set(row.id, {
        chunkId: row.id,
        title: row.title,
        textContent: row.text_content,
        dynasty: row.dynasty,
        sourceReliability: row.source_reliability,
        score,
        rankVector: vecRank,
      });
    });

    ftsRows.forEach((row, idx) => {
      const ftsRank = idx + 1;
      const ftsScore = 1 / (RRF_K + ftsRank);
      const existing = chunkMap.get(row.id);
      if (existing) {
        existing.score += ftsScore;
        existing.rankFts = ftsRank;
      } else {
        chunkMap.set(row.id, {
          chunkId: row.id,
          title: row.title,
          textContent: row.text_content,
          dynasty: row.dynasty,
          sourceReliability: row.source_reliability,
          score: ftsScore,
          rankFts: ftsRank,
        });
      }
    });

    const results = Array.from(chunkMap.values());
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  // In-Memory Hybrid Search Fallback
  const chunks: DbDocumentChunk[] = Array.from(inMemoryStore.documentChunks.values());
  if (chunks.length === 0) return [];

  // Vector Cosine Similarity
  const scoredByVector = chunks
    .map((c) => ({
      chunk: c,
      sim: c.embedding ? cosineSimilarity(queryEmbedding, c.embedding) : 0,
    }))
    .sort((a, b) => b.sim - a.sim);

  // BM25 Lexical Keyword Match
  const queryTerms = queryText.toLowerCase().split(/\s+/).filter(Boolean);
  const scoredByBM25 = chunks
    .map((c) => {
      const contentLower = c.text_content.toLowerCase();
      let matchCount = 0;
      for (const term of queryTerms) {
        if (contentLower.includes(term)) matchCount++;
      }
      return { chunk: c, matchCount };
    })
    .sort((a, b) => b.matchCount - a.matchCount);

  const chunkMap = new Map<string, VectorSearchResult>();

  scoredByVector.forEach((item, idx) => {
    const vecRank = idx + 1;
    chunkMap.set(item.chunk.id, {
      chunkId: item.chunk.id,
      title: item.chunk.title,
      textContent: item.chunk.text_content,
      dynasty: item.chunk.dynasty,
      sourceReliability: item.chunk.source_reliability,
      score: 1 / (RRF_K + vecRank),
      rankVector: vecRank,
    });
  });

  scoredByBM25.forEach((item, idx) => {
    const ftsRank = idx + 1;
    const ftsScore = 1 / (RRF_K + ftsRank);
    const existing = chunkMap.get(item.chunk.id);
    if (existing) {
      existing.score += ftsScore;
      existing.rankFts = ftsRank;
    } else {
      chunkMap.set(item.chunk.id, {
        chunkId: item.chunk.id,
        title: item.chunk.title,
        textContent: item.chunk.text_content,
        dynasty: item.chunk.dynasty,
        sourceReliability: item.chunk.source_reliability,
        score: ftsScore,
        rankFts: ftsRank,
      });
    }
  });

  const results = Array.from(chunkMap.values());
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

export async function searchDenseVector(
  queryEmbedding: number[],
  topK: number = 5
): Promise<VectorSearchResult[]> {
  return searchHybridVectorAndBM25('', queryEmbedding, topK);
}
