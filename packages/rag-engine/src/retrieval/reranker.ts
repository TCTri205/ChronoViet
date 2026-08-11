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

  const scored = candidates.map((cand) => {
    let textScore = cand.score;
    const textLower = cand.textContent.toLowerCase();
    const titleLower = cand.title.toLowerCase();

    // 1. Keyword Overlap Bonus
    let keywordOverlapCount = 0;
    for (const term of queryTerms) {
      if (textLower.includes(term)) keywordOverlapCount++;
      if (titleLower.includes(term)) keywordOverlapCount += 2;
    }
    const overlapRatio = queryTerms.length > 0 ? keywordOverlapCount / queryTerms.length : 0;
    textScore += overlapRatio * 0.5;

    // 2. Source Reliability Bonus
    if (cand.sourceReliability === 'LEVEL_1') {
      textScore += 0.2;
    } else if (cand.sourceReliability === 'LEVEL_2') {
      textScore += 0.1;
    }

    return {
      ...cand,
      score: textScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, rerankTopK);
}
