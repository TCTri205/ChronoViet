/**
 * Information Retrieval & Ranking Metrics Engine for ChronoEval v2.0
 * Pure mathematical implementations for Graded Relevance nDCG@K, MRR@K, MAP@K, Pairwise Ranking Accuracy
 */

/**
 * Calculates Discounted Cumulative Gain at rank K
 * Formula: DCG@K = sum_{i=1}^K (2^{rel_i} - 1) / log_2(i + 1)
 */
export function calculateDCG(relevanceGrades: number[], k: number): number {
  const topKGrades = relevanceGrades.slice(0, k);
  let dcg = 0;
  for (let i = 0; i < topKGrades.length; i++) {
    const grade = topKGrades[i];
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
  if (groundTruthGrades.size === 0 || k <= 0) return 1.0;

  const actualGrades = retrievedIds.slice(0, k).map((id) => groundTruthGrades.get(id) || 0);
  const dcg = calculateDCG(actualGrades, k);

  const allGrades = Array.from(groundTruthGrades.values());
  const idcg = calculateIDCG(allGrades, k);

  if (idcg === 0) {
    // If there is no relevant document in gold truth, empty retrieval is perfect (1.0) else 0.0
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
  const topK = retrievedIds.slice(0, k);
  for (let i = 0; i < topK.length; i++) {
    const id = topK[i];
    let isHit = false;
    if (groundTruthGrades instanceof Set) {
      isHit = groundTruthGrades.has(id);
    } else {
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
  if (goldIds.size === 0) return 1.0;

  const topK = retrievedIds.slice(0, k);
  let relevantCount = 0;
  let runningPrecisionSum = 0;

  for (let i = 0; i < topK.length; i++) {
    if (goldIds.has(topK[i])) {
      relevantCount++;
      runningPrecisionSum += relevantCount / (i + 1);
    }
  }

  return runningPrecisionSum / Math.min(goldIds.size, k);
}

/**
 * Calculates Pairwise Ranking Accuracy:
 * For every pair (A, B) where Grade(A) > Grade(B), checks if Rank(A) < Rank(B) in retrieved list
 */
export function calculatePairwiseRankingAccuracy(
  retrievedIds: string[],
  groundTruthGrades: Map<string, number>
): number {
  const rankMap = new Map<string, number>();
  retrievedIds.forEach((id, idx) => rankMap.set(id, idx + 1));

  // Collect all evaluated candidates that are present in both or graded
  const evaluatedIds = Array.from(
    new Set([...retrievedIds, ...Array.from(groundTruthGrades.keys())])
  );

  let totalValidPairs = 0;
  let correctRankedPairs = 0;

  for (let i = 0; i < evaluatedIds.length; i++) {
    for (let j = i + 1; j < evaluatedIds.length; j++) {
      const idA = evaluatedIds[i];
      const idB = evaluatedIds[j];

      const gradeA = groundTruthGrades.get(idA) || 0;
      const gradeB = groundTruthGrades.get(idB) || 0;

      if (gradeA === gradeB) continue; // Only evaluate strictly ordered pairs

      totalValidPairs++;

      const rankA = rankMap.has(idA) ? rankMap.get(idA)! : Infinity;
      const rankB = rankMap.has(idB) ? rankMap.get(idB)! : Infinity;

      if (gradeA > gradeB && rankA < rankB) {
        correctRankedPairs++;
      } else if (gradeB > gradeA && rankB < rankA) {
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
  if (goldIds.size === 0) return 1.0;
  const topK = new Set(retrievedIds.slice(0, k));
  let hits = 0;
  for (const id of goldIds) {
    if (topK.has(id)) hits++;
  }
  return hits / goldIds.size;
}

/**
 * Calculates Evidence-Level Recall@K agnostic of chunk IDs:
 * Checks whether the top-K retrieved chunk texts contain the essential gold evidence claims.
 */
export function calculateEvidenceRecallAtK(
  retrievedChunks: Array<{ id?: string; chunkId?: string; title?: string; textContent?: string }>,
  goldEvidenceClaims: string[],
  k: number = 10
): number {
  if (!goldEvidenceClaims || goldEvidenceClaims.length === 0) return 1.0;
  const topK = retrievedChunks.slice(0, k);
  if (topK.length === 0) return 0.0;

  const combinedRetrievedText = topK
    .map((c) => `${c.title || ''} ${c.textContent || ''}`.toLowerCase())
    .join(' ');

  let satisfiedClaims = 0;
  for (const claim of goldEvidenceClaims) {
    const claimTokens = claim
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    if (claimTokens.length === 0) continue;

    let matchedTokens = 0;
    for (const t of claimTokens) {
      if (combinedRetrievedText.includes(t)) matchedTokens++;
    }
    if (matchedTokens >= Math.ceil(claimTokens.length * 0.55)) {
      satisfiedClaims++;
    }
  }

  return satisfiedClaims / Math.max(1, goldEvidenceClaims.length);
}

/**
 * Calculates Dynamic Graded Relevance Map for retrieved chunks:
 * Prioritizes exact ID match, but falls back gracefully to content/evidence overlap.
 */
export function calculateContentAwareGrades(
  retrievedChunks: Array<{ id?: string; chunkId?: string; title?: string; textContent?: string }>,
  goldChunks: Array<{ chunk_id: string; relevance_grade: number; key_evidence_claims?: string[]; text_content?: string }>
): Map<string, number> {
  const gradeMap = new Map<string, number>();
  const idToGoldGrade = new Map<string, number>();
  goldChunks.forEach((g) => idToGoldGrade.set(g.chunk_id, g.relevance_grade));

  for (const chunk of retrievedChunks) {
    const cid = chunk.chunkId || chunk.id || '';
    if (idToGoldGrade.has(cid)) {
      gradeMap.set(cid, idToGoldGrade.get(cid)!);
      continue;
    }

    // Content overlap fallback
    const chunkText = `${chunk.title || ''} ${chunk.textContent || ''}`.toLowerCase();
    let maxAssignedGrade = 0;

    for (const gold of goldChunks) {
      const claims = gold.key_evidence_claims || [];
      if (claims.length > 0) {
        let claimsMatched = 0;
        for (const claim of claims) {
          const tokens = claim.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
          const hitCount = tokens.filter((t) => chunkText.includes(t)).length;
          if (hitCount >= Math.ceil(tokens.length * 0.55)) {
            claimsMatched++;
          }
        }
        if (claimsMatched >= Math.ceil(claims.length * 0.6)) {
          maxAssignedGrade = Math.max(maxAssignedGrade, gold.relevance_grade);
        } else if (claimsMatched >= 1) {
          maxAssignedGrade = Math.max(maxAssignedGrade, 1);
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
  if (k <= 0) return 0.0;
  const topK = retrievedIds.slice(0, k);
  if (topK.length === 0) return 0.0;
  let hits = 0;
  for (const id of topK) {
    if (goldIds.has(id)) hits++;
  }
  return hits / topK.length;
}

