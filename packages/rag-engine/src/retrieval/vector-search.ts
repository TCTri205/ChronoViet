/**
 * Hybrid Vector Search (pgvector Cosine HNSW) + BM25 Lexical Full-Text Search via Reciprocal Rank Fusion (RRF)
 */

import { createLogger, isPgAvailable, query, inMemoryStore, DbDocumentChunk, cosineSimilarity } from '@chronoviet/shared-spec';

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

const RRF_K = 60;

/**
 * Executes Hybrid Vector (1024d) + BM25 Full-Text Search fused by RRF
 */
export async function searchHybridVectorAndBM25(
  queryText: string,
  queryEmbedding: number[],
  topK: number = 5,
  rrfK: number = RRF_K
): Promise<VectorSearchResult[]> {
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
    pgMode: await isPgAvailable(),
  });

  return results.slice(0, topK);
}

export async function searchDenseVector(
  queryEmbedding: number[],
  topK: number = 20
): Promise<VectorSearchResult[]> {
  const pgConnected = await isPgAvailable();
  if (pgConnected) {
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
       ORDER BY dist ASC
       LIMIT $2;`,
      [JSON.stringify(queryEmbedding), topK]
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
      [queryText, topK]
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

  const queryTerms = queryText.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
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
