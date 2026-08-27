/**
 * Pure Local Cross-Encoder Context Reranker
 * Strictly executes local Qwen3-Reranker-0.6B / bge-reranker-v2-m3 (GGUF Q8_0)
 * Integrates directly with llama-server / TEI Metal Engine (/v1/rerank)
 */

import { rerankWithLocalCrossEncoder, createLogger } from '@chronoviet/infra';
import { VectorSearchResult } from './vector-search.js';
import { QUESTION_STOPWORDS } from './question-ner.js';

const log = createLogger({ service: 'rag-engine' });

export const MAX_RERANK_CANDIDATE_POOL = process.env.RERANK_CANDIDATE_POOL
  ? parseInt(process.env.RERANK_CANDIDATE_POOL, 10)
  : 25;
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

/**
 * Extracts a query-relevant excerpt from long documents centered around matching terms,
 * aligned cleanly to sentence boundaries.
 */
export function extractQueryRelevantExcerpt(
  text: string,
  query: string,
  maxChars: number = 800
): string {
  if (!text || text.length <= maxChars) return text || '';
  if (!query || !query.trim()) return truncateToSentenceBoundary(text, maxChars);

  // Extract query keywords (excluding generic short words)
  const keywords = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !QUESTION_STOPWORDS.has(w));

  if (keywords.length === 0) {
    return truncateToSentenceBoundary(text, maxChars);
  }

  const textLower = text.toLowerCase();

  // Find occurrences of query terms and calculate density across sliding windows
  let bestPos = 0;
  let maxHits = 0;

  for (let i = 0; i < textLower.length; i += 200) {
    const window = textLower.slice(i, i + maxChars);
    let hits = 0;
    for (const kw of keywords) {
      if (window.includes(kw)) {
        hits++;
      }
    }
    if (hits > maxHits) {
      maxHits = hits;
      bestPos = i;
    }
  }

  // If no keywords found in sliding windows, fallback to start
  if (maxHits === 0) {
    return truncateToSentenceBoundary(text, maxChars);
  }

  // Start slightly before bestPos to preserve opening context
  const startOffset = Math.max(0, bestPos - 100);
  const rawExcerpt = text.slice(startOffset, startOffset + maxChars + 150);

  // Snap start to first sentence boundary if we didn't start at beginning
  let cleanStart = 0;
  if (startOffset > 0) {
    const firstPeriod = rawExcerpt.search(/[.!?\n]\s+/);
    if (firstPeriod !== -1 && firstPeriod < 150) {
      cleanStart = firstPeriod + 2;
    }
  }

  const boundedExcerpt = rawExcerpt.slice(cleanStart, cleanStart + maxChars);
  return truncateToSentenceBoundary(boundedExcerpt, maxChars);
}

/**
 * Computes multiplicative Bayesian temporal prior based on chronological distance between query and chunk.
 * - Exact Match (delta <= 2 years): 1.10 (+10% boost)
 * - Close Match (delta <= 30 years): 1.00 (neutral)
 * - Era Mismatch (delta <= 100 years): 0.85 (-15% penalty)
 * - Century Mismatch (delta > 100 years): 0.70 (-30% penalty)
 * - Un-dated chunk (timeStart & timeEnd undefined): 1.00 (unpenalized)
 * - Query with no temporal constraint (queryYears empty): 1.00
 */
export function calculateTemporalMultiplier(
  queryYears: number[],
  chunkTimeStart?: number,
  chunkTimeEnd?: number
): number {
  if (!queryYears || queryYears.length === 0) {
    return 1.0;
  }

  if (chunkTimeStart === undefined && chunkTimeEnd === undefined) {
    return 1.0;
  }

  const start = chunkTimeStart !== undefined ? chunkTimeStart : chunkTimeEnd!;
  const end = chunkTimeEnd !== undefined ? chunkTimeEnd : chunkTimeStart!;
  const spanMin = Math.min(start, end);
  const spanMax = Math.max(start, end);
  const chunkMid = (spanMin + spanMax) / 2;

  let minDelta = Infinity;
  for (const qYear of queryYears) {
    if (qYear >= spanMin && qYear <= spanMax) {
      minDelta = 0;
      break;
    }
    const dist = Math.min(
      Math.abs(qYear - spanMin),
      Math.abs(qYear - spanMax),
      Math.abs(qYear - chunkMid)
    );
    if (dist < minDelta) {
      minDelta = dist;
    }
  }

  if (minDelta <= 2) {
    return 1.10;
  } else if (minDelta <= 30) {
    return 1.00;
  } else if (minDelta <= 100) {
    return 0.85;
  } else {
    return 0.70;
  }
}

export async function rerankCandidates(
  queryText: string,
  candidates: VectorSearchResult[],
  rerankTopK: number = 5,
  queryYears: number[] = []
): Promise<VectorSearchResult[]> {
  if (!candidates || candidates.length === 0 || !queryText || !queryText.trim()) {
    return [];
  }

  // 1. Take expanded candidate pool (up to 25) for thorough reranking
  const candidatePool = candidates.slice(0, MAX_RERANK_CANDIDATE_POOL);

  // 2. Prepare query-relevant truncated documents with sentence boundary awareness
  const documents = candidatePool.map((c) => {
    const prefix = c.title ? `${c.title.trim()}: ` : '';
    const content = extractQueryRelevantExcerpt(c.textContent || '', queryText, MAX_CHUNK_CHAR_TRUNCATION);
    return prefix + content;
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

      // Temporal Multiplier
      const temporalMultiplier = calculateTemporalMultiplier(
        queryYears,
        cand.timeStart,
        cand.timeEnd
      );

      // Multiplicative Bayesian Prior: Source priority and temporal grounding amplify relevant candidates
      const relevanceScale = rawAiScore >= MIN_RELEVANCE_SCORE_THRESHOLD ? 1.0 + 0.20 * sourceReliabilityWeight : 1.0;
      const finalScore = (rawAiScore * relevanceScale * temporalMultiplier) + coRetrievalBonus;

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
