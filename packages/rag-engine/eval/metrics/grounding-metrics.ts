/**
 * Grounding, Faithfulness & Citation Verification Metrics Engine for ChronoEval v2.0
 * Measures Claim-level Entailment, Citation Coverage/Correctness, and Folklore Guardrails
 */

const VIETNAMESE_STOP_WORDS = new Set([
  'là', 'và', 'của', 'tại', 'cho', 'vào', 'ra', 'bị', 'bởi', 'thời', 'các', 'những', 'đã', 'trong', 'với', 'theo', 'như', 'được', 'năm', 'tháng', 'ngày', 'đến', 'từ', 'có', 'thì', 'ở', 'đó', 'này'
]);

const FOLKLORE_HEDGING_KEYWORDS = [
  'truyền thuyết',
  'tương truyền',
  'dã sử',
  'dân gian',
  'có thuyết cho rằng',
  'lưu truyền',
  'thần thoại',
  'theo lời kể',
  'dã sử ghi',
  'giả thuyết',
];

const VICTORY_TERMS = ['thắng', 'đại thắng', 'thắng lợi', 'đánh tan', 'quét sạch', 'tiêu diệt', 'bảo vệ', 'giải phóng'];
const DEFEAT_TERMS = ['thất bại', 'đầu hàng', 'tháo chạy', 'tử trận', 'chết vô số', 'thua trận', 'bị diệt'];

/**
 * Splits response text into factual proposition claims
 */
export function extractFactualClaims(answerText: string): string[] {
  if (!answerText || !answerText.trim()) return [];

  // Split by sentence terminators or bullet points
  const rawSentences = answerText
    .split(/(?<=[.!?\n])\s+|;\s+|\n+/)
    .map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((s) => s.length > 8);

  return rawSentences;
}

/**
 * Verifies if a historical claim is entailed by context chunks
 */
export function verifyClaimEntailment(
  claim: string,
  evidenceChunks: string[]
): {
  status: 'ENTAILED' | 'CONTRADICTED' | 'NEUTRAL' | 'NOT_SUPPORTED';
  confidence: number;
} {
  const claimClean = claim.toLowerCase().trim();
  if (!claimClean) {
    return { status: 'NEUTRAL', confidence: 1.0 };
  }

  const combinedEvidence = evidenceChunks.join(' \n ').toLowerCase();
  if (!combinedEvidence.trim()) {
    return { status: 'NOT_SUPPORTED', confidence: 0.95 };
  }

  // 1. Conflict / Contradiction Check (Negation / Polarity Inversion)
  const claimHasVictory = VICTORY_TERMS.some((t) => claimClean.includes(t));
  const claimHasDefeat = DEFEAT_TERMS.some((t) => claimClean.includes(t));
  const evHasVictory = VICTORY_TERMS.some((t) => combinedEvidence.includes(t));
  const evHasDefeat = DEFEAT_TERMS.some((t) => combinedEvidence.includes(t));

  if (claimHasVictory && evHasDefeat && !evHasVictory) {
    return { status: 'CONTRADICTED', confidence: 0.95 };
  }
  if (claimHasDefeat && evHasVictory && !evHasDefeat) {
    return { status: 'CONTRADICTED', confidence: 0.95 };
  }
  if ((claimClean.includes('không') || claimClean.includes('chưa bao giờ')) && (claimHasVictory && evHasVictory)) {
    if (!claimClean.includes('không thể cản') && !claimClean.includes('không ai sánh bằng')) {
      return { status: 'CONTRADICTED', confidence: 0.9 };
    }
  }

  // 2. Check Numeric / Temporal consistency
  const numbersInClaim = claimClean.match(/\b\d+\b/g) || [];
  const numbersMissing = numbersInClaim.filter((num) => !combinedEvidence.includes(num));

  if (numbersInClaim.length > 0 && numbersMissing.length === numbersInClaim.length) {
    // If all numbers/years mentioned in claim are missing from evidence
    return { status: 'NOT_SUPPORTED', confidence: 0.9 };
  }

  // 3. Extract tokens
  const tokens = claimClean
    .split(/\s+/)
    .map((w) => w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ''))
    .filter((w) => w.length >= 2 && !VIETNAMESE_STOP_WORDS.has(w));

  if (tokens.length === 0) {
    return { status: 'ENTAILED', confidence: 1.0 };
  }

  let matchedTokenCount = 0;
  for (const token of tokens) {
    if (combinedEvidence.includes(token)) {
      matchedTokenCount++;
    }
  }

  const matchRatio = matchedTokenCount / tokens.length;

  // 4. Bi-gram containment for key phrases
  let bigramMatches = 0;
  let totalBigrams = 0;
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    totalBigrams++;
    if (combinedEvidence.includes(bigram)) {
      bigramMatches++;
    }
  }
  const bigramRatio = totalBigrams > 0 ? bigramMatches / totalBigrams : matchRatio;
  const compositeScore = 0.6 * matchRatio + 0.4 * bigramRatio;

  if (compositeScore >= 0.55) {
    return { status: 'ENTAILED', confidence: Math.min(1.0, compositeScore + 0.2) };
  } else if (compositeScore < 0.35) {
    return { status: 'NOT_SUPPORTED', confidence: 1.0 - compositeScore };
  } else {
    return { status: 'NEUTRAL', confidence: 0.5 };
  }
}

/**
 * Calculates Claim-Level Faithfulness and Hallucination Rate
 */
export function calculateClaimFaithfulness(
  claims: string[],
  evidenceChunks: string[]
): {
  faithfulnessPercent: number; // 0..100
  hallucinationRatePercent: number; // 0..100
  entailedCount: number;
  totalClaims: number;
} {
  if (claims.length === 0) {
    return {
      faithfulnessPercent: 100,
      hallucinationRatePercent: 0,
      entailedCount: 0,
      totalClaims: 0,
    };
  }

  let entailedCount = 0;
  for (const claim of claims) {
    const res = verifyClaimEntailment(claim, evidenceChunks);
    if (res.status === 'ENTAILED') {
      entailedCount++;
    }
  }

  const faithfulnessPercent = (entailedCount / claims.length) * 100;
  const hallucinationRatePercent = Math.max(0, 100 - faithfulnessPercent);

  return {
    faithfulnessPercent,
    hallucinationRatePercent,
    entailedCount,
    totalClaims: claims.length,
  };
}

/**
 * Calculates Citation Coverage (percentage of claims having at least 1 citation source)
 */
export function calculateCitationCoverage(
  claims: string[],
  citationsPerClaim: string[][]
): number {
  if (claims.length === 0) return 100.0;

  let citedClaims = 0;
  for (let i = 0; i < claims.length; i++) {
    const citations = citationsPerClaim[i] || [];
    if (citations.length > 0) {
      citedClaims++;
    }
  }

  return (citedClaims / claims.length) * 100.0;
}

/**
 * Verifies Citation Entailment Correctness:
 * Checks if the specific cited chunk actually contains proof for the claim
 */
export function verifyCitationCorrectness(
  claims: string[],
  citedChunkIdsPerClaim: string[][],
  chunkMap: Map<string, string>
): {
  citationCorrectnessPercent: number;
  granularityScorePercent: number;
} {
  if (claims.length === 0) {
    return { citationCorrectnessPercent: 100, granularityScorePercent: 100 };
  }

  let totalCitations = 0;
  let correctCitations = 0;

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const chunkIds = citedChunkIdsPerClaim[i] || [];

    for (const chunkId of chunkIds) {
      totalCitations++;
      const chunkText = chunkMap.get(chunkId) || '';
      const entailment = verifyClaimEntailment(claim, [chunkText]);
      if (entailment.status === 'ENTAILED') {
        correctCitations++;
      }
    }
  }

  const citationCorrectnessPercent =
    totalCitations === 0 ? 100 : (correctCitations / totalCitations) * 100;

  // Granularity score: sentence-level citations vs chunk-dumping
  const avgCitationsPerClaim =
    claims.length === 0 ? 0 : totalCitations / claims.length;
  const granularityScorePercent =
    avgCitationsPerClaim >= 1.0 && avgCitationsPerClaim <= 3.0 ? 100 : 85;

  return {
    citationCorrectnessPercent,
    granularityScorePercent,
  };
}

/**
 * Checks folklore / Level 3 Guardrail compliance
 * Returns true if text discussing folklore sources uses hypothetical / cautious phrasing
 */
export function checkFolkloreGuardrailCompliance(
  text: string,
  isFolkloreSource: boolean
): boolean {
  if (!isFolkloreSource) return true;

  const textLower = text.toLowerCase();
  for (const keyword of FOLKLORE_HEDGING_KEYWORDS) {
    if (textLower.includes(keyword)) {
      return true;
    }
  }

  return false;
}
