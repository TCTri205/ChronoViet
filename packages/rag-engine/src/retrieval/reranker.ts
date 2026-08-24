/**
 * Pure Local Cross-Encoder Context Reranker
 * Strictly executes local Qwen3-Reranker-0.6B / bge-reranker-v2-m3 (GGUF Q8_0)
 * Integrates directly with llama-server / TEI Metal Engine (/v1/rerank)
 */

import { rerankWithLocalCrossEncoder, createLogger } from '@chronoviet/infra';
import { VectorSearchResult } from './vector-search.js';

const log = createLogger({ service: 'rag-engine' });

export const MAX_RERANK_CANDIDATE_POOL = process.env.RERANK_CANDIDATE_POOL
  ? parseInt(process.env.RERANK_CANDIDATE_POOL, 10)
  : 10;
export const MAX_CHUNK_CHAR_TRUNCATION = 750;
export const MIN_RELEVANCE_SCORE_THRESHOLD = 0.15;

export interface RerankerStatus {
  active: boolean;
  fallbackReason?: string;
  timestamp?: string;
}

let lastRerankerStatus: RerankerStatus = { active: true };

export function getLastRerankerStatus(): RerankerStatus {
  return { ...lastRerankerStatus };
}

export function resetRerankerStatusForTest(): void {
  lastRerankerStatus = { active: true };
}

/**
 * Sentence-Boundary and Clause-Boundary Aware Document Truncator
 * Truncates text safely up to maxChars without cutting Vietnamese words/syllables in half.
 */
export function truncateToSentenceBoundary(
  text: string,
  maxChars: number = MAX_CHUNK_CHAR_TRUNCATION
): string {
  if (!text || text.length <= maxChars) return text || '';
  const window = text.slice(0, maxChars);
  const findLast = (re: RegExp) => {
    const matches = [...window.matchAll(re)];
    return matches.length > 0 ? matches[matches.length - 1].index + 1 : -1;
  };

  const sEnd = findLast(/[.!?\n]/g);
  if (sEnd >= Math.floor(maxChars * 0.6)) return window.slice(0, sEnd).trim();

  const cEnd = findLast(/[;:,—\-]/g);
  if (cEnd >= Math.floor(maxChars * 0.75)) return window.slice(0, cEnd).trim();

  const spEnd = window.lastIndexOf(' ');
  if (spEnd >= Math.floor(maxChars * 0.85)) return window.slice(0, spEnd).trim();

  return window.trim();
}

export async function rerankCandidates(
  queryText: string,
  candidates: VectorSearchResult[],
  rerankTopK: number = 5
): Promise<VectorSearchResult[]> {
  if (!candidates || candidates.length === 0 || !queryText || !queryText.trim()) {
    return [];
  }

  // 1. Take expanded candidate pool (up to 20) for thorough reranking
  const candidatePool = candidates.slice(0, MAX_RERANK_CANDIDATE_POOL);

  // 2. Prepare truncated documents (<= 1500 chars / ~512 tokens) with sentence boundary awareness
  const documents = candidatePool.map((c) => {
    const prefix = c.title ? `${c.title.trim()}: ` : '';
    const content = c.textContent ? c.textContent.trim() : '';
    return truncateToSentenceBoundary(prefix + content, MAX_CHUNK_CHAR_TRUNCATION);
  });

  // 3. Execute Pure Model Cross-Encoder Reranking (with fallback to vector similarity)
  let rerankResults: { index: number; score: number }[] = [];
  try {
    rerankResults = await rerankWithLocalCrossEncoder(queryText, documents, {
      topN: candidatePool.length,
    });
    lastRerankerStatus = {
      active: true,
      timestamp: new Date().toISOString(),
    };
  } catch (rerankErr: any) {
    log.warn('rag.reranker_fallback_active', 'Local Cross-Encoder unavailable or failed; using vector similarity fallback', {
      error: rerankErr?.message || String(rerankErr),
      candidateCount: candidatePool.length,
    });
    lastRerankerStatus = {
      active: false,
      fallbackReason: rerankErr?.message || String(rerankErr),
      timestamp: new Date().toISOString(),
    };
    rerankResults = candidatePool.map((c, idx) => ({
      index: idx,
      score: c.score || 0.5,
    }));
  }

  // 4. Multi-Factor Multiplicative Historical Fusion (Bayesian Prior Model)
  const scoredCandidates = rerankResults
    .filter((res) => res.index >= 0 && res.index < candidatePool.length)
    .map((res) => {
      const cand = candidatePool[res.index];
      const rawAiScore = Math.max(0, Math.min(1, res.score));

      // Source Reliability Weight: LEVEL_1 = 1.0, LEVEL_2 = 0.5, LEVEL_3 = 0.0
      let sourceReliabilityWeight = 0.0;
      if (cand.sourceReliability === 'LEVEL_1') {
        sourceReliabilityWeight = 1.0;
      } else if (cand.sourceReliability === 'LEVEL_2') {
        sourceReliabilityWeight = 0.5;
      }

      // Co-Retrieval Bonus (strictly based on explicit isCoRetrieved boolean flag)
      const coRetrievalBonus = cand.isCoRetrieved ? 0.05 : 0.0;

      // Multiplicative Bayesian Prior: Source priority amplifies relevant candidates without promoting noise
      const relevanceScale = rawAiScore >= MIN_RELEVANCE_SCORE_THRESHOLD ? 1.0 + 0.20 * sourceReliabilityWeight : 1.0;
      const finalScore = rawAiScore * relevanceScale + coRetrievalBonus;

      return {
        ...cand,
        score: finalScore,
      };
    });

  // 5. Sort by descending final score
  scoredCandidates.sort((a, b) => b.score - a.score);

  log.debug('rag.reranker_completed', 'Pure Cross-Encoder reranking completed', {
    query: queryText,
    poolSize: candidatePool.length,
    returnedCount: scoredCandidates.length,
    topScore: scoredCandidates[0]?.score,
    rerankerActive: lastRerankerStatus.active,
  });

  return scoredCandidates.slice(0, rerankTopK);
}
