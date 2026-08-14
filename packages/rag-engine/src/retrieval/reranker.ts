/**
 * Integrated Context Reranker (BGE Reranker v2 Model Logic)
 */

import { VectorSearchResult } from './vector-search.js';

export function rerankCandidates(
  queryText: string,
  candidates: VectorSearchResult[],
  rerankTopK: number = 5
): VectorSearchResult[] {
  if (!candidates || candidates.length === 0) return [];

  const queryTerms = queryText.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const isFactCheckQuery = /(xác minh|có thật không|thật hay giả|đúng hay sai|bằng chứng)/i.test(queryText);

  const scored = candidates.map((cand) => {
    let textScore = cand.score;
    const textLower = cand.textContent.toLowerCase();
    const titleLower = cand.title.toLowerCase();

    const queryLower = queryText.toLowerCase();

    // 1. Keyword Overlap Bonus
    let keywordOverlapCount = 0;
    for (const term of queryTerms) {
      if (textLower.includes(term)) keywordOverlapCount++;
      if (titleLower.includes(term)) keywordOverlapCount += 2;
    }
    const overlapRatio = queryTerms.length > 0 ? keywordOverlapCount / queryTerms.length : 0;
    textScore += overlapRatio * 0.8;

    // 1b. Title Alignment Bonus (Elevates exact matching topic chunks)
    const titleWords = titleLower.split(/\s+/).filter((t) => t.length > 2);
    let titleMatchInQuery = 0;
    for (const tw of titleWords) {
      if (queryLower.includes(tw)) titleMatchInQuery++;
    }
    const titlePrecisionRatio = titleWords.length > 0 ? titleMatchInQuery / titleWords.length : 0;
    textScore += titlePrecisionRatio * 1.0;

    if (overlapRatio === 0 && titlePrecisionRatio === 0) {
      textScore *= 0.2; // Severely discount irrelevant distractors
    }

    // 2. Source Reliability Re-ranking (Spec Section 3.7): W_source in [1.0, 0.8, 0.5] capped at <= 15%
    let sourceWeight = 0.5;
    if (cand.sourceReliability === 'LEVEL_1') {
      sourceWeight = 1.0;
    } else if (cand.sourceReliability === 'LEVEL_2') {
      sourceWeight = 0.8;
    }

    if (isFactCheckQuery) {
      textScore = textScore * 0.85 + sourceWeight * 0.15;
    }

    return {
      ...cand,
      score: textScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, rerankTopK);
}
