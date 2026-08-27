/**
 * Grounding, Faithfulness & Citation Verification Metrics Engine for ChronoEval v2.0
 * Measures Proposition-level Entailment, Contradiction Detection, Citation Coverage/Correctness, and Folklore Guardrails
 */

import { callLlm, envConfig, parseLlmJson } from '@chronoviet/infra';

const VIETNAMESE_STOP_WORDS = new Set([
  'là', 'và', 'của', 'tại', 'cho', 'vào', 'ra', 'bị', 'bởi', 'thời', 'các', 'những', 'đã', 'trong',
  'với', 'theo', 'như', 'được', 'tháng', 'ngày', 'đến', 'từ', 'có', 'thì', 'ở', 'đó', 'này',
  'rằng', 'vì', 'do', 'đang', 'sẽ', 'lại', 'qua', 'lên', 'xuống', 'về', 'nơi', 'khi', 'sau', 'trước'
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
  'người xưa kể lại',
  'chuyện kể rằng',
];

const VICTORY_TERMS = [
  'thắng', 'đại thắng', 'thắng lợi', 'đánh tan', 'quét sạch', 'tiêu diệt', 'bảo vệ',
  'giải phóng', 'đập tan', 'khởi nghĩa thành công', 'chém chết', 'bắt sống', 'chiến thắng', 'đại phá'
];

const DEFEAT_TERMS = [
  'thất bại', 'đầu hàng', 'tháo chạy', 'tử trận', 'chết vô số', 'thua trận',
  'bị diệt', 'bị bắt', 'tuẫn tiết', 'thất thủ', 'bị chém', 'vỡ trận'
];

const NEGATION_PATTERNS = [
  /\bkhông\s+phải\b/i,
  /\bkhông\s+có\s+thật\b/i,
  /\bchưa\s+bao\s+giờ\b/i,
  /\bkhông\s+hề\b/i,
  /\bchẳng\s+phải\b/i,
  /\bhoàn\s+toàn\s+sai\b/i,
  /\bsai\s+lệch\b/i,
  /\bhư\s+cấu\b/i,
];

const KINSHIP_TERMS = ['cha của', 'mẹ của', 'anh của', 'em của', 'chị của', 'chồng của', 'vợ của', 'con của', 'ông của', 'cháu của'];

export const VIETNAMESE_STOPWORDS = new Set([
  'và', 'là', 'của', 'ở', 'tại', 'với', 'trong', 'được', 'các', 'những',
  'cho', 'về', 'này', 'đó', 'thì', 'mà', 'ra', 'vào', 'khi', 'đến', 'từ',
  'như', 'có', 'đã', 'sẽ', 'đang', 'rất', 'lại', 'nên', 'cũng', 'bởi', 'để',
  'do', 'nhà', 'nước', 'thuộc', 'thời', 'kỳ', 'vẫn', 'từng', 'nơi', 'sau', 'trước'
]);

const DISCOURSE_PATTERNS = [
  /^dưới đây là/i,
  /^theo (tư liệu|sử liệu|nguồn tin|tài liệu|thông tin|đại việt sử ký|sử sách|lịch sử|ghi chép)/i,
  /^như vậy/i,
  /^tóm lại/i,
  /^nhìn chung/i,
  /^có thể thấy/i,
  /^chiến công này|chiến thắng này|sự kiện này có ý nghĩa/i,
  /^đây là một trong những/i,
  /^về mặt lịch sử/i,
  /^câu trả lời là/i,
  /^(chào bạn|dạ thưa|thưa bạn|xin chào|kính chào|vâng|chào anh\/chị)/i,
  /^để trả lời câu hỏi/i,
  /^về câu hỏi (này|của bạn)/i,
  /^dựa vào các thông tin/i,
  /^sau đây là/i,
  /^hy vọng thông tin này/i,
  /^nếu bạn cần/i,
];

/**
 * Checks if a sentence is a discourse marker, summary header, or meta-statement
 */
export function isDiscourseOrMetaSentence(sentence: string): boolean {
  const clean = sentence.trim().toLowerCase();
  if (clean.length < 15) return true;
  return DISCOURSE_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Splits response text into factual proposition claims
 */
export function extractFactualClaims(answerText: string): string[] {
  if (!answerText || !answerText.trim()) return [];

  // Split by sentence terminators or bullet points
  const rawSentences = answerText
    .split(/(?<=[.!?\n])\s+|;\s+|\n+/)
    .map((s) =>
      s
        .replace(/^[-*•\d.)\s]+/, '')
        .replace(/^(dạ|vâng|xin chào|kính chào|thưa bạn|chào bạn)[,.\s]+/i, '')
        .replace(/^theo (tôi|chúng tôi|em|sử sách|sử liệu|ghi chép) được biết\s+(thì\s+)?/i, '')
        .replace(/^(tóm lại|nhìn chung|như vậy|dưới đây là|sau đây là)[,:\s]+/i, '')
        .trim()
    )
    .filter((s) => s.length > 12 && !isDiscourseOrMetaSentence(s));

  return rawSentences;
}

/**
 * Verifies if a historical claim is entailed by context chunks
 * Implements proposition structure matching, contradiction detection, and temporal verification.
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

  if (isDiscourseOrMetaSentence(claimClean)) {
    return { status: 'NEUTRAL', confidence: 0.95 };
  }

  const combinedEvidence = evidenceChunks.join(' \n ').toLowerCase();
  if (!combinedEvidence.trim()) {
    return { status: 'NOT_SUPPORTED', confidence: 1.0 };
  }

  // 1. Conflict / Contradiction Check: Polarity Inversion (Victory vs Defeat)
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

  // Explicit Negation Contradiction
  const claimHasExplicitNegation = NEGATION_PATTERNS.some((pattern) => pattern.test(claimClean));
  if (claimHasExplicitNegation && evHasVictory) {
    return { status: 'CONTRADICTED', confidence: 0.95 };
  }

  // Kinship / Relation Conflict Check
  const claimKinship = KINSHIP_TERMS.find((k) => claimClean.includes(k));
  if (claimKinship) {
    const evKinship = KINSHIP_TERMS.find((k) => combinedEvidence.includes(k));
    if (evKinship && evKinship !== claimKinship) {
      return { status: 'CONTRADICTED', confidence: 0.95 };
    }
  }

  // 2. Numeric / Temporal consistency verification
  const numbersInClaim = claimClean.match(/\b\d+\b/g) || [];
  if (numbersInClaim.length > 0) {
    const numbersInEvidence = new Set(combinedEvidence.match(/\b\d+\b/g) || []);
    const missingNumbers = numbersInClaim.filter((num) => !numbersInEvidence.has(num));

    // If key temporal years/counts in claim are completely missing from evidence
    if (missingNumbers.length === numbersInClaim.length) {
      return { status: 'NOT_SUPPORTED', confidence: 0.92 };
    }
  }

  // 3. Proposition Token Extraction (keeping numbers and key entities)
  const tokens = claimClean
    .split(/[\s.,/#!$%^&*;:{}=\-_`~()"“”]+/)
    .filter((w) => w.length >= 2 && !VIETNAMESE_STOP_WORDS.has(w));

  if (tokens.length === 0) {
    return { status: 'ENTAILED', confidence: 1.0 };
  }

  let matchedTokenCount = 0;
  for (const token of tokens) {
    if (combinedEvidence.includes(token)) {
      matchedTokenCount++;
    } else if (VICTORY_TERMS.includes(token) && evHasVictory) {
      // Semantic synonym match for victory/campaign predicates
      matchedTokenCount++;
    }
  }

  const unigramRatio = matchedTokenCount / tokens.length;

  // 4. Bi-gram containment for key historical propositions & entities
  let bigramMatches = 0;
  let totalBigrams = 0;
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    totalBigrams++;
    if (combinedEvidence.includes(bigram)) {
      bigramMatches++;
    } else if (
      (VICTORY_TERMS.some((v) => bigram.includes(v)) || bigram.includes('chiến thắng') || bigram.includes('đại phá')) &&
      evHasVictory
    ) {
      bigramMatches++;
    }
  }
  const bigramRatio = totalBigrams > 0 ? bigramMatches / totalBigrams : unigramRatio;

  // Composite Proposition Entailment Score
  const compositeScore = 0.5 * unigramRatio + 0.5 * bigramRatio;

  // Strict Thresholds: Require strong proposition alignment without loose fallbacks
  if (
    compositeScore >= 0.45 ||
    (unigramRatio >= 0.50 && (bigramRatio >= 0.30 || numbersInClaim.length > 0)) ||
    (compositeScore >= 0.35 && bigramMatches >= 1)
  ) {
    return { status: 'ENTAILED', confidence: Math.min(1.0, compositeScore + 0.25) };
  } else if (compositeScore < 0.25) {
    return { status: 'NOT_SUPPORTED', confidence: Math.min(1.0, 1.0 - compositeScore) };
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
  if (!claims || claims.length === 0) {
    return {
      faithfulnessPercent: 100,
      hallucinationRatePercent: 0,
      entailedCount: 0,
      totalClaims: 0,
    };
  }

  let entailedCount = 0;
  let contradictedOrUnsupported = 0;
  let factualClaimsCount = 0;

  for (const claim of claims) {
    const res = verifyClaimEntailment(claim, evidenceChunks);
    if (res.status === 'ENTAILED') {
      entailedCount++;
      factualClaimsCount++;
    } else if (res.status === 'CONTRADICTED' || res.status === 'NOT_SUPPORTED') {
      contradictedOrUnsupported++;
      factualClaimsCount++;
    }
  }

  const effectiveTotal = Math.max(1, factualClaimsCount);
  const faithfulnessPercent = (entailedCount / effectiveTotal) * 100;
  const hallucinationRatePercent = (contradictedOrUnsupported / effectiveTotal) * 100;

  return {
    faithfulnessPercent: Number(faithfulnessPercent.toFixed(2)),
    hallucinationRatePercent: Number(hallucinationRatePercent.toFixed(2)),
    entailedCount,
    totalClaims: claims.length,
  };
}

/**
 * Calculates Citation Coverage (percentage of claims having at least 1 valid citation source)
 */
export function calculateCitationCoverage(
  claims: string[],
  citationsPerClaim: string[][]
): number {
  if (!claims || claims.length === 0) return 100.0;

  let citedClaims = 0;
  for (let i = 0; i < claims.length; i++) {
    const citations = (citationsPerClaim && citationsPerClaim[i]) || [];
    if (citations.length > 0 && citations.some((c) => Boolean(c && c.trim()))) {
      citedClaims++;
    }
  }

  return Number(((citedClaims / claims.length) * 100.0).toFixed(2));
}

/**
 * Verifies Citation Entailment Correctness:
 * Strictly checks if the specific cited chunk actually contains proof for the claim.
 * Ungrounded claims with invalid or fabricated citations are penalized.
 */
export function verifyCitationCorrectness(
  claims: string[],
  citedChunkIdsPerClaim: string[][],
  chunkMap: Map<string, string>
): {
  citationCorrectnessPercent: number;
  granularityScorePercent: number;
  totalCitations: number;
  correctCitations: number;
} {
  if (!claims || claims.length === 0) {
    return {
      citationCorrectnessPercent: 100,
      granularityScorePercent: 100,
      totalCitations: 0,
      correctCitations: 0,
    };
  }

  let totalCitations = 0;
  let correctCitations = 0;

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const chunkIds = (citedChunkIdsPerClaim && citedChunkIdsPerClaim[i]) || [];

    for (const chunkId of chunkIds) {
      if (!chunkId || !chunkId.trim()) continue;
      totalCitations++;
      const chunkText = chunkMap.get(chunkId) || '';
      if (!chunkText.trim()) {
        // Cited chunk does not exist in context map
        continue;
      }
      const entailment = verifyClaimEntailment(claim, [chunkText]);
      if (entailment.status === 'ENTAILED' && entailment.confidence >= 0.55) {
        correctCitations++;
      }
    }
  }

  const citationCorrectnessPercent =
    totalCitations === 0 ? 0.0 : Number(((correctCitations / totalCitations) * 100).toFixed(2));

  // Granularity score: 1 to 3 citations per claim is optimal; dumping > 4 or having 0 is penalized
  const avgCitationsPerClaim =
    claims.length === 0 ? 0 : totalCitations / claims.length;
  const granularityScorePercent =
    avgCitationsPerClaim >= 0.8 && avgCitationsPerClaim <= 3.0 ? 100 : avgCitationsPerClaim === 0 ? 0 : 75;

  return {
    citationCorrectnessPercent,
    granularityScorePercent,
    totalCitations,
    correctCitations,
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
  if (!text || !text.trim()) return false;

  const textLower = text.toLowerCase();
  return FOLKLORE_HEDGING_KEYWORDS.some((keyword) => textLower.includes(keyword));
}

/**
 * Validates Source Reliability Tiering Compliance
 * Enforces: LEVEL_1 (Primary Annals) > LEVEL_2 (Modern Scholarly) > LEVEL_3 (Folklore / Legends)
 */
export function validateSourceReliabilityTiering(
  sources: Array<{ reliability: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'; confidence: number }>
): boolean {
  if (!sources || sources.length === 0) return true;
  for (const src of sources) {
    if (src.reliability === 'LEVEL_3' && src.confidence > 0.85) {
      // Folklore cannot be asserted with absolute confidence without hedging
      return false;
    }
  }
  return true;
}

/**
 * Neural LLM-as-a-Judge Proposition Entailment Verification
 * Uses local Qwen 3.5 9B with Chain-of-Thought (zero mock/fallback in strict mode)
 */
export async function verifyClaimEntailmentWithLlmJudge(
  claim: string,
  evidenceChunks: string[]
): Promise<{
  status: 'ENTAILED' | 'CONTRADICTED' | 'NEUTRAL' | 'NOT_SUPPORTED';
  confidence: number;
  reasoning: string;
}> {
  const claimClean = claim.trim();
  if (!claimClean) {
    return { status: 'NEUTRAL', confidence: 1.0, reasoning: 'Empty claim' };
  }
  const combinedEvidence = evidenceChunks.filter(Boolean).join('\n\n').trim();
  if (!combinedEvidence) {
    return { status: 'NOT_SUPPORTED', confidence: 1.0, reasoning: 'No context provided' };
  }

  const systemPrompt = `Bạn là chuyên gia thẩm định logic và sử liệu Việt Nam (NLI Evaluator).
Nhiệm vụ: Đánh giá mối quan hệ suy diễn logic giữa MỆNH ĐỀ CẦN KIỂM CHỨNG (Claim) và TƯ LIỆU GỐC (Evidence).

Quy tắc phân loại:
- "ENTAILED": Mệnh đề được chứng minh hoặc suy diễn logic hoàn toàn từ tư liệu gốc.
- "CONTRADICTED": Mệnh đề mâu thuẫn trực tiếp với tư liệu gốc (sai niên đại, nhân vật, hành động, kết quả).
- "NOT_SUPPORTED": Tư liệu gốc không nhắc đến hoặc không đủ thông tin để xác nhận/bác bỏ mệnh đề.
- "NEUTRAL": Mệnh đề chỉ là câu dẫn dắt giao tiếp hoặc tổng thuật trung lập không chứa dữ kiện lịch sử mới.

Xuất duy nhất 1 JSON object:
{
  "status": "ENTAILED" | "CONTRADICTED" | "NOT_SUPPORTED" | "NEUTRAL",
  "confidence": <number từ 0.0 đến 1.0>,
  "reasoning": "<Giải thích ngắn gọn 1 câu>"
}`;

  const userContent = `MỆNH ĐỀ (Claim): "${claimClean}"

TƯ LIỆU GỐC (Evidence):
${combinedEvidence.slice(0, 1500)}`;

  try {
    const res = await callLlm({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.0,
      responseFormat: 'json_object',
      timeoutMs: 30000,
    });

    const parsed = parseLlmJson(res.content);
    const validStatuses = ['ENTAILED', 'CONTRADICTED', 'NOT_SUPPORTED', 'NEUTRAL'] as const;
    const status = validStatuses.includes(parsed.status) ? parsed.status : 'NEUTRAL';
    const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.9;
    return {
      status,
      confidence,
      reasoning: String(parsed.reasoning || ''),
    };
  } catch (err: any) {
    if (envConfig.EVAL_STRICT) {
      throw new Error(`[EVAL_STRICT] LLM-as-a-Judge NLI evaluation failed: ${err.message}`);
    }
    // Fallback to deterministic heuristic when not in strict mode
    const fallbackRes = verifyClaimEntailment(claim, evidenceChunks);
    return {
      ...fallbackRes,
      reasoning: `Heuristic fallback: ${err.message}`,
    };
  }
}

/**
 * Calculates Claim-Level Faithfulness and Hallucination Rate using Neural LLM Judge
 */
export async function calculateClaimFaithfulnessAsync(
  claims: string[],
  evidenceChunks: string[]
): Promise<{
  faithfulnessPercent: number; // 0..100
  hallucinationRatePercent: number; // 0..100
  entailedCount: number;
  totalClaims: number;
  evaluations: Array<{ claim: string; status: string; confidence: number; reasoning: string }>;
}> {
  if (!claims || claims.length === 0) {
    return {
      faithfulnessPercent: 100,
      hallucinationRatePercent: 0,
      entailedCount: 0,
      totalClaims: 0,
      evaluations: [],
    };
  }

  let entailedCount = 0;
  let contradictedOrUnsupported = 0;
  let factualClaimsCount = 0;
  const evaluations: Array<{ claim: string; status: string; confidence: number; reasoning: string }> = [];

  for (const claim of claims) {
    const res = await verifyClaimEntailmentWithLlmJudge(claim, evidenceChunks);
    evaluations.push({
      claim,
      status: res.status,
      confidence: res.confidence,
      reasoning: res.reasoning,
    });

    if (res.status === 'ENTAILED') {
      entailedCount++;
      factualClaimsCount++;
    } else if (res.status === 'CONTRADICTED' || res.status === 'NOT_SUPPORTED') {
      contradictedOrUnsupported++;
      factualClaimsCount++;
    }
  }

  const effectiveTotal = Math.max(1, factualClaimsCount);
  const faithfulnessPercent = (entailedCount / effectiveTotal) * 100;
  const hallucinationRatePercent = (contradictedOrUnsupported / effectiveTotal) * 100;

  return {
    faithfulnessPercent: Number(faithfulnessPercent.toFixed(2)),
    hallucinationRatePercent: Number(hallucinationRatePercent.toFixed(2)),
    entailedCount,
    totalClaims: claims.length,
    evaluations,
  };
}

