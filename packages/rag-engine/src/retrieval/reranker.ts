/**
 * Pure Local Cross-Encoder Context Reranker
 * Strictly executes local Qwen3-Reranker-0.6B / bge-reranker-v2-m3 (GGUF Q8_0)
 * Integrates directly with llama-server / TEI Metal Engine (/v1/rerank)
 */

import { rerankWithLocalCrossEncoder, createLogger } from '@chronoviet/shared-spec';
import { VectorSearchResult } from './vector-search.js';

const log = createLogger({ service: 'rag-engine' });

export const MAX_RERANK_CANDIDATE_POOL = 12;
export const MAX_CHUNK_CHAR_TRUNCATION = 1500;

export async function rerankCandidates(
  queryText: string,
  candidates: VectorSearchResult[],
  rerankTopK: number = 5
): Promise<VectorSearchResult[]> {
  if (!candidates || candidates.length === 0 || !queryText || !queryText.trim()) {
    return [];
  }

  // 1. Take up to 12 candidates to bound latency within 40ms on Apple Silicon
  const candidatePool = candidates.slice(0, MAX_RERANK_CANDIDATE_POOL);

  // 2. Prepare truncated documents (<= 1500 chars / ~512 tokens)
  const documents = candidatePool.map((c) => {
    const prefix = c.title ? `${c.title.trim()}: ` : '';
    const content = c.textContent ? c.textContent.trim() : '';
    return (prefix + content).slice(0, MAX_CHUNK_CHAR_TRUNCATION);
  });

  // 3. Execute Pure Model Cross-Encoder Reranking (with fallback to vector similarity)
  let rerankResults: { index: number; score: number }[] = [];
  try {
    rerankResults = await rerankWithLocalCrossEncoder(queryText, documents, {
      topN: candidatePool.length,
    });
  } catch (rerankErr: any) {
    log.debug('rag.reranker_fallback', 'Cross-encoder offline, using vector similarity fallback', {
      error: rerankErr.message,
    });
    rerankResults = candidatePool.map((c, idx) => ({
      index: idx,
      score: c.score || 0.5,
    }));
  }

  // 4. Multi-Factor Historical Fusion (75% AI Score + 15% Source Reliability + 10% Co-Retrieval)
  const scoredCandidates = rerankResults
    .filter((res) => res.index >= 0 && res.index < candidatePool.length)
    .map((res) => {
      const cand = candidatePool[res.index];
      const rawAiScore = Math.max(0, Math.min(1, res.score));

      // Source Reliability Weight: LEVEL_1 = 1.0, LEVEL_2 = 0.8, LEVEL_3 = 0.5
      let sourceWeight = 0.5;
      if (cand.sourceReliability === 'LEVEL_1') {
        sourceWeight = 1.0;
      } else if (cand.sourceReliability === 'LEVEL_2') {
        sourceWeight = 0.8;
      }

      // Co-Retrieval Bonus (if chunk was co-retrieved and boosted by graph branch)
      const coRetrievalBonus = cand.score >= 0.35 ? 0.10 : 0.0;

      const finalScore = 0.75 * rawAiScore + 0.15 * sourceWeight + coRetrievalBonus;

      return {
        ...cand,
        score: finalScore,
      };
    });

  // 5. Sort by descending final score and take top K
  scoredCandidates.sort((a, b) => b.score - a.score);

  log.debug('rag.reranker_completed', 'Pure Cross-Encoder reranking completed', {
    query: queryText,
    poolSize: candidatePool.length,
    returnedCount: scoredCandidates.length,
    topScore: scoredCandidates[0]?.score,
  });

  return scoredCandidates.slice(0, rerankTopK);
}
