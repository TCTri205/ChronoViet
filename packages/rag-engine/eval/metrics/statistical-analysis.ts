/**
 * Statistical Analysis & Significance Testing Engine for ChronoEval v2.0
 * Implements Paired Bootstrap Confidence Intervals (95% CI, B=10,000) and Paired Hypothesis Tests
 */

export interface BootstrapCIResult {
  meanBaseline: number;
  meanCandidate: number;
  meanDelta: number;
  ciLower: number;
  ciUpper: number;
  confidenceLevel: number;
  isSignificant: boolean;
  bIterations: number;
}

export interface HypothesisTestResult {
  statistic: number;
  pValue: number;
  isSignificant: boolean;
  degreesOfFreedom?: number;
  method: 'PAIRED_T_TEST' | 'WILCOXON_SIGNED_RANK';
}

/**
 * Calculates Paired Bootstrap Confidence Interval (95% CI)
 * @param baselineScores Array of scores for baseline system
 * @param candidateScores Array of scores for candidate system
 * @param options B: number of bootstrap iterations (default 10,000), alpha: significance level (default 0.05 for 95% CI)
 */
export function calculatePairedBootstrapCI(
  baselineScores: number[],
  candidateScores: number[],
  options: { B?: number; alpha?: number; seed?: number } = {}
): BootstrapCIResult {
  const n = Math.min(baselineScores.length, candidateScores.length);
  if (n === 0) {
    return {
      meanBaseline: 0,
      meanCandidate: 0,
      meanDelta: 0,
      ciLower: 0,
      ciUpper: 0,
      confidenceLevel: 0.95,
      isSignificant: false,
      bIterations: 0,
    };
  }

  const B = options.B ?? 10000;
  const alpha = options.alpha ?? 0.05;

  const deltas: number[] = [];
  let sumBase = 0;
  let sumCand = 0;

  for (let i = 0; i < n; i++) {
    const base = baselineScores[i];
    const cand = candidateScores[i];
    sumBase += base;
    sumCand += cand;
    deltas.push(cand - base);
  }

  const meanBaseline = sumBase / n;
  const meanCandidate = sumCand / n;
  const meanDelta = meanCandidate - meanBaseline;

  // Simple pseudo-random LCG if seed provided, else Math.random
  let rngSeed = options.seed ?? 123456789;
  const nextRandom = () => {
    if (options.seed !== undefined) {
      rngSeed = (rngSeed * 1664525 + 1013904223) % 4294967296;
      return rngSeed / 4294967296;
    }
    return Math.random();
  };

  const bootstrapMeans: number[] = new Array(B);

  for (let b = 0; b < B; b++) {
    let bSum = 0;
    for (let i = 0; i < n; i++) {
      const randIdx = Math.floor(nextRandom() * n);
      bSum += deltas[randIdx];
    }
    bootstrapMeans[b] = bSum / n;
  }

  bootstrapMeans.sort((a, b) => a - b);

  const lowerIdx = Math.floor((alpha / 2) * B);
  const upperIdx = Math.floor((1 - alpha / 2) * B);

  const ciLower = bootstrapMeans[Math.max(0, lowerIdx)];
  const ciUpper = bootstrapMeans[Math.min(B - 1, upperIdx)];

  // A delta is statistically significant if 0 is outside the [ciLower, ciUpper] interval
  const isSignificant = (ciLower > 0 && ciUpper > 0) || (ciLower < 0 && ciUpper < 0);

  return {
    meanBaseline,
    meanCandidate,
    meanDelta,
    ciLower,
    ciUpper,
    confidenceLevel: 1 - alpha,
    isSignificant,
    bIterations: B,
  };
}

/**
 * Approximate standard error and Paired Student's t-test
 */
export function calculatePairedTTest(
  sample1: number[],
  sample2: number[]
): HypothesisTestResult {
  const n = Math.min(sample1.length, sample2.length);
  if (n < 2) {
    return { statistic: 0, pValue: 1.0, isSignificant: false, method: 'PAIRED_T_TEST' };
  }

  const diffs: number[] = [];
  let sumDiff = 0;
  for (let i = 0; i < n; i++) {
    const d = sample2[i] - sample1[i];
    diffs.push(d);
    sumDiff += d;
  }

  const meanDiff = sumDiff / n;
  let sumSqDiff = 0;
  for (let i = 0; i < n; i++) {
    sumSqDiff += Math.pow(diffs[i] - meanDiff, 2);
  }

  const variance = sumSqDiff / (n - 1);
  const stdError = Math.sqrt(variance / n);

  if (stdError === 0) {
    const stat = meanDiff === 0 ? 0 : meanDiff > 0 ? Infinity : -Infinity;
    return {
      statistic: stat,
      pValue: meanDiff === 0 ? 1.0 : 0.0,
      isSignificant: meanDiff !== 0,
      degreesOfFreedom: n - 1,
      method: 'PAIRED_T_TEST',
    };
  }

  const tStat = meanDiff / stdError;
  const df = n - 1;

  // Approximate two-tailed p-value using normal standard error for moderate/large n
  const absZ = Math.abs(tStat);
  const pValueApprox = 2 * (1 - normalCdf(absZ));

  return {
    statistic: tStat,
    pValue: Math.max(0, Math.min(1, pValueApprox)),
    isSignificant: pValueApprox < 0.01,
    degreesOfFreedom: df,
    method: 'PAIRED_T_TEST',
  };
}

/**
 * Standard Normal Cumulative Distribution Function approximation (Abramowitz & Stegun)
 */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}
