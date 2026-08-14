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
