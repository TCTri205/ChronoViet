import { VIETNAMESE_STOPWORDS } from './grounding-metrics.js';

/**
 * Calculates Discounted Cumulative Gain at rank K
 * Formula: DCG@K = sum_{i=1}^K (2^{rel_i} - 1) / log_2(i + 1)
 */
export function calculateDCG(relevanceGrades: number[], k: number): number {
  if (!relevanceGrades || relevanceGrades.length === 0 || k <= 0) return 0;
  const topKGrades = relevanceGrades.slice(0, k);
  let dcg = 0;
  for (let i = 0; i < topKGrades.length; i++) {
    const grade = Math.max(0, topKGrades[i] || 0);
    if (grade === 0) continue;
    const gain = Math.pow(2, grade) - 1;
    const discount = Math.log2(i + 2); // i=0 -> rank 1 -> log2(2)=1
    dcg += gain / discount;
  }
  return dcg;
}

/**
 * Calculates Ideal Discounted Cumulative Gain at rank K
 */
export function calculateIDCG(allGoldGrades: number[], k: number): number {
  if (!allGoldGrades || allGoldGrades.length === 0 || k <= 0) return 0;
  const sortedGrades = [...allGoldGrades].sort((a, b) => b - a);
  return calculateDCG(sortedGrades, k);
}

/**
 * Calculates Normalized Discounted Cumulative Gain at rank K (nDCG@K) with Graded Relevance {0, 1, 2, 3}
 */
export function calculateNDCGAtK(
  retrievedIds: string[],
  groundTruthGrades: Map<string, number>,
  k: number = 5
): number {
  if (!groundTruthGrades || groundTruthGrades.size === 0 || k <= 0) return 1.0;
  if (!retrievedIds || retrievedIds.length === 0) return 0.0;

  const actualGrades = retrievedIds.slice(0, k).map((id) => groundTruthGrades.get(id) || 0);
  const dcg = calculateDCG(actualGrades, k);

  const allGrades = Array.from(groundTruthGrades.values()).filter((g) => g > 0);
  if (allGrades.length === 0) {
    // If no relevant documents exist in ground truth
    return dcg === 0 ? 1.0 : 0.0;
  }

  const idcg = calculateIDCG(allGrades, k);
  if (idcg === 0) {
    return dcg === 0 ? 1.0 : 0.0;
  }

  return Math.min(1.0, Math.max(0.0, dcg / idcg));
}

/**
 * Calculates Mean Reciprocal Rank at rank K (MRR@K)
 * Finds the first retrieved document with relevance >= minRelevantGrade (default 2)
 */
export function calculateMRRAtK(
  retrievedIds: string[],
  groundTruthGrades: Map<string, number> | Set<string>,
  k: number = 5,
  minRelevantGrade: number = 2
): number {
  if (!retrievedIds || retrievedIds.length === 0 || k <= 0) return 0.0;
  const topK = retrievedIds.slice(0, k);
  for (let i = 0; i < topK.length; i++) {
    const id = topK[i];
    let isHit = false;
    if (groundTruthGrades instanceof Set) {
      isHit = groundTruthGrades.has(id);
    } else if (groundTruthGrades instanceof Map) {
      const grade = groundTruthGrades.get(id) || 0;
      isHit = grade >= minRelevantGrade;
    }

    if (isHit) {
      return 1 / (i + 1);
    }
  }
  return 0.0;
}

/**
 * Calculates Mean Average Precision at rank K (MAP@K)
 */
export function calculateMAPAtK(
  retrievedIds: string[],
  goldIds: Set<string>,
  k: number = 10
): number {
  if (!goldIds || goldIds.size === 0) return 1.0;
  if (!retrievedIds || retrievedIds.length === 0 || k <= 0) return 0.0;

  const topK = retrievedIds.slice(0, k);
  let relevantCount = 0;
  let runningPrecisionSum = 0;

  for (let i = 0; i < topK.length; i++) {
    if (goldIds.has(topK[i])) {
      relevantCount++;
      runningPrecisionSum += relevantCount / (i + 1);
    }
  }

  const denominator = Math.min(goldIds.size, k);
  if (denominator === 0) return 0.0;
  return runningPrecisionSum / denominator;
}

/**
 * Calculates Pairwise Ranking Accuracy:
 * For every pair (A, B) where Grade(A) > Grade(B), checks if Rank(A) < Rank(B) in retrieved list
 */
export function calculatePairwiseRankingAccuracy(
  retrievedIds: string[],
  groundTruthGrades: Map<string, number>
): number {
  if (!retrievedIds || retrievedIds.length < 2 || !groundTruthGrades || groundTruthGrades.size === 0) {
    return 1.0;
  }

  let totalValidPairs = 0;
  let correctRankedPairs = 0;

  for (let i = 0; i < retrievedIds.length; i++) {
    for (let j = i + 1; j < retrievedIds.length; j++) {
      const idA = retrievedIds[i];
      const idB = retrievedIds[j];

      const gradeA = groundTruthGrades.get(idA) || 0;
      const gradeB = groundTruthGrades.get(idB) || 0;

      if (gradeA === gradeB) continue; // Only evaluate strictly ordered pairs

      totalValidPairs++;
      if (gradeA > gradeB) {
        correctRankedPairs++;
      }
    }
  }

  if (totalValidPairs === 0) return 1.0;
  return correctRankedPairs / totalValidPairs;
}

/**
 * Calculates Recall@K against a gold set of document IDs
 */
export function calculateRecallAtK(
  retrievedIds: string[],
  goldIds: Set<string>,
  k: number = 10
): number {
  if (!goldIds || goldIds.size === 0) return 1.0;
  if (!retrievedIds || retrievedIds.length === 0 || k <= 0) return 0.0;
  const topK = new Set(retrievedIds.slice(0, k));
  let hits = 0;
  for (const id of goldIds) {
    if (topK.has(id)) hits++;
  }
  return hits / goldIds.size;
}

/**
 * Calculates Evidence-Level Recall@K agnostic of chunk IDs:
 * Checks whether the top-K retrieved chunk texts contain the essential gold evidence claims
 * using strict multi-word proposition and keyword containment.
 */
export function calculateEvidenceRecallAtK(
  retrievedChunks: Array<{ id?: string; chunkId?: string; title?: string; textContent?: string }>,
  goldEvidenceClaims: string[],
  k: number = 10
): number {
  if (!goldEvidenceClaims || goldEvidenceClaims.length === 0) return 1.0;
  if (!retrievedChunks || retrievedChunks.length === 0 || k <= 0) return 0.0;
  const topK = retrievedChunks.slice(0, k);
  if (topK.length === 0) return 0.0;

  const combinedRetrievedText = topK
    .map((c) => `${c.title || ''} ${c.textContent || ''}`.toLowerCase())
    .join(' ');

  let satisfiedClaims = 0;
  for (const claim of goldEvidenceClaims) {
    const claimClean = claim.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()"“”]/g, ' ');
    const claimTokens = claimClean
      .split(/\s+/)
      .filter((w) => w.trim().length > 0 && !VIETNAMESE_STOPWORDS.has(w));
    if (claimTokens.length === 0) continue;

    let matchedTokens = 0;
    for (const t of claimTokens) {
      if (combinedRetrievedText.includes(t)) matchedTokens++;
    }

    // Require high proposition token coverage (>= 75%)
    if (matchedTokens >= Math.ceil(claimTokens.length * 0.75)) {
      satisfiedClaims++;
    }
  }

  return satisfiedClaims / Math.max(1, goldEvidenceClaims.length);
}

/**
 * Calculates Dynamic Graded Relevance Map for retrieved chunks:
 * Prioritizes exact ID match, but supports semi-open-world semantic evidence entailment.
 * Strict anti-overfitting: Inferred grades for un-annotated chunks are capped at Grade 1.
 */
export function calculateContentAwareGrades(
  retrievedChunks: Array<{ id?: string; chunkId?: string; title?: string; textContent?: string; dynasty?: string }>,
  goldChunks: Array<{ chunk_id: string; relevance_grade: number; key_evidence_claims?: string[]; text_content?: string; dynasty?: string; title?: string }>
): Map<string, number> {
  const gradeMap = new Map<string, number>();
  const idToGoldGrade = new Map<string, number>();
  goldChunks.forEach((g) => idToGoldGrade.set(g.chunk_id, g.relevance_grade));

  for (const chunk of retrievedChunks) {
    const cid = chunk.chunkId || chunk.id || '';
    if (!cid) continue;

    if (idToGoldGrade.has(cid)) {
      gradeMap.set(cid, idToGoldGrade.get(cid)!);
      continue;
    }

    // Semi-Open World Content Overlap Evaluation strictly against gold chunks
    const chunkText = `${chunk.title || ''} ${chunk.textContent || ''}`.toLowerCase();
    const chunkDynasty = (chunk.dynasty || '').toLowerCase().trim();
    let maxAssignedGrade = 0;

    for (const gold of goldChunks) {
      if (gold.relevance_grade <= 0) continue;

      const goldDynasty = (gold.dynasty || '').toLowerCase().trim();
      const goldText = `${gold.title || ''} ${gold.text_content || ''}`.toLowerCase();
      const claims = gold.key_evidence_claims || [];

      // Check claim-level proposition token coverage
      if (claims.length > 0) {
        let claimsMatched = 0;
        for (const claim of claims) {
          const claimClean = claim.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()"“”]/g, ' ');
          const tokens = claimClean
            .split(/\s+/)
            .filter((w) => w.trim().length > 0 && !VIETNAMESE_STOPWORDS.has(w));
          if (tokens.length === 0) continue;
          const hitCount = tokens.filter((t) => chunkText.includes(t)).length;
          if (hitCount >= Math.ceil(tokens.length * 0.60)) {
            claimsMatched++;
          }
        }

        if (claimsMatched >= 1) {
          maxAssignedGrade = Math.max(maxAssignedGrade, 1);
        }
      }

      // Check Dynasty / Epoch alignment with significant text overlap
      if (goldDynasty && chunkDynasty && goldDynasty === chunkDynasty && chunkText.length >= 30) {
        const goldTokens = goldText
          .split(/[\s.,/#!$%^&*;:{}=\-_`~()"“”]+/)
          .filter((w) => w.length >= 3 && !VIETNAMESE_STOPWORDS.has(w));
        if (goldTokens.length > 0) {
          const matchedGoldTokens = goldTokens.filter((t) => chunkText.includes(t)).length;
          if (matchedGoldTokens >= 3 && (matchedGoldTokens / goldTokens.length) >= 0.15) {
            maxAssignedGrade = Math.max(maxAssignedGrade, 1);
          }
        }
      }
    }

    gradeMap.set(cid, maxAssignedGrade);
  }

  return gradeMap;
}

/**
 * Calculates Precision@K against a gold set of document IDs
 */
export function calculatePrecisionAtK(
  retrievedIds: string[],
  goldIds: Set<string>,
  k: number = 10
): number {
  if (!goldIds || goldIds.size === 0 || !retrievedIds || retrievedIds.length === 0 || k <= 0) {
    return 0.0;
  }
  const topK = retrievedIds.slice(0, k);
  if (topK.length === 0) return 0.0;
  let hits = 0;
  for (const id of topK) {
    if (goldIds.has(id)) hits++;
  }
  return hits / topK.length;
}


