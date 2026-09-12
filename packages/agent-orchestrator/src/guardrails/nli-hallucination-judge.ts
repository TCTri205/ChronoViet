/**
 * NLI Entailment Hallucination Judge (Phase 1 Node.js MVP) (Spec Section 6.1)
 * Evaluates script claim entailment against ground truth chunk context (Entailment Score >= 0.80)
 */

import { callLlm, envConfig, parseLlmJson } from '@chronoviet/infra';

export interface NliJudgeRequest {
  scriptClaim: string;
  groundTruthChunks: string[];
  epochBounds?: {
    startYear?: number;
    endYear?: number;
  };
}

export interface NliJudgeResult {
  entailmentScore: number;
  isHallucinated: boolean;
  verdict: 'ENTAILMENT' | 'NEUTRAL' | 'CONTRADICTION';
  explanation: string;
}

export const VIETNAMESE_STOP_WORDS = new Set([
  'năm', 'thời', 'của', 'và', 'với', 'trong', 'cho', 'trên', 'dưới', 'tại',
  'vào', 'ra', 'về', 'lại', 'các', 'những', 'một', 'đã', 'đang', 'sẽ',
  'người', 'quân', 'cuộc', 'trận', 'nhà', 'vua', 'sau', 'trước', 'khi',
  'không', 'có', 'là', 'được', 'bị', 'từ', 'đến', 'cùng', 'giữa', 'này',
  'như', 'đó', 'thì', 'mà', 'vì', 'do', 'bởi', 'để', 'nên', 'rất',
]);

/**
 * Extracts historical calendar years and time bounds from text.
 * Accurately parses:
 * - 2-digit years ("năm 40", "năm 43" SCN)
 * - B.C. years ("257 TCN" -> -257)
 * - Explicit calendar markers ("năm 938", "thời 1010", "niên hiệu 1428")
 * - Excludes duration spans like "1000 năm Bắc thuộc" using negative lookahead
 */
export function extractHistoricalTimeBounds(text: string): number[] {
  if (!text) return [];
  const years = new Set<number>();

  // 1. Explicit calendar marker: (năm|thời|niên hiệu) followed by 1 to 4 digits, optional TCN / Trước Công Nguyên
  // Explicitly excludes duration spans where the number is followed by duration/quantity units
  const explicitYearRegex = /(?:năm|thời|niên hiệu)\s+(\d{1,4})(?:\s*(?:SCN|sau công nguyên))?(?:\s*(TCN|trước công nguyên))?(?!\s*(?:năm|tháng|ngày|vạn|nghìn|triệu|quân|lính|thuyền|chiến thuyền|người|chiến sĩ|tàu|chiếc|khẩu|mét|km|dặm|tấn|kg|con|đoàn|trận))\b/gi;
  let match: RegExpExecArray | null;
  while ((match = explicitYearRegex.exec(text)) !== null) {
    let y = parseInt(match[1], 10);
    const isBc = Boolean(match[2]);
    if (isBc) {
      y = -y;
    }
    if (y >= -3000 && y <= 2100) {
      years.add(y);
    }
  }

  // 2. Year followed directly by TCN / trước công nguyên: e.g. "257 TCN", "208 trước công nguyên"
  const bcYearRegex = /\b(\d{1,4})\s*(?:TCN|trước công nguyên)\b(?!\s*(?:năm|tháng|ngày|vạn|nghìn|triệu|quân|lính))/gi;
  while ((match = bcYearRegex.exec(text)) !== null) {
    const y = -parseInt(match[1], 10);
    if (y >= -3000 && y <= 0) {
      years.add(y);
    }
  }

  // 3. Standalone 4-digit years (e.g. 1288, 1428, 1789, 1954) not followed by quantity units
  const standaloneYearRegex = /\b(1\d{3}|20\d{2})\b(?!\s*(?:năm|tháng|ngày|vạn|nghìn|triệu|người|quân|lính|chiến sĩ|thuyền|chiến thuyền|tàu|chiếc|khẩu|mét|km|dặm|tấn|kg|con|đoàn|trận))/gi;
  while ((match = standaloneYearRegex.exec(text)) !== null) {
    const y = parseInt(match[1], 10);
    if (y >= 1000 && y <= 2100) {
      years.add(y);
    }
  }

  return Array.from(years);
}

/**
 * Backward compatibility alias for extractHistoricalTimeBounds
 */
export function extractCalendarYears(text: string): number[] {
  return extractHistoricalTimeBounds(text);
}

/**
 * Computes lexical & semantic overlap entailment score between script claim and ground truth context
 * Filters out common grammatical stopwords and applies chronological consistency penalization
 * when script claims contain dates deviating significantly (> 50 years) from verified historical epoch bounds.
 */
export function evaluateNliEntailmentScore(request: NliJudgeRequest): NliJudgeResult {
  if (!request.scriptClaim.trim() || request.groundTruthChunks.length === 0) {
    return {
      entailmentScore: 0.0,
      isHallucinated: false,
      verdict: 'NEUTRAL',
      explanation: 'No claims or ground truth chunks provided; neutral unverified status.',
    };
  }

  const cleanedClaim = request.scriptClaim
    .replace(/[.,!?;:"'()“”‘’—…[\]]/g, ' ')
    .toLowerCase()
    .trim();

  const rawWords = cleanedClaim.split(/\s+/).filter((w) => w.length > 1);
  const contentWords = rawWords.filter((w) => !VIETNAMESE_STOP_WORDS.has(w));
  const claimWords = contentWords.length > 0 ? contentWords : rawWords.filter((w) => w.length > 2);

  if (claimWords.length === 0) {
    return {
      entailmentScore: 1.0,
      isHallucinated: false,
      verdict: 'ENTAILMENT',
      explanation: 'Short claim text.',
    };
  }

  const combinedGroundTruth = request.groundTruthChunks
    .join(' ')
    .replace(/[.,!?;:"'()“”‘’—…[\]]/g, ' ')
    .toLowerCase();

  let matchedWords = 0;
  for (const word of claimWords) {
    if (combinedGroundTruth.includes(word)) {
      matchedWords++;
    }
  }

  const overlapScore = matchedWords / claimWords.length;
  const rawEntailmentScore = Math.min(1.0, Number((0.50 + overlapScore * 0.55).toFixed(2)));

  // Chronological & Epoch Verification: apply extractHistoricalTimeBounds symmetrically
  const gtYears: number[] = [];
  if (request.epochBounds?.startYear !== undefined) gtYears.push(request.epochBounds.startYear);
  if (request.epochBounds?.endYear !== undefined) gtYears.push(request.epochBounds.endYear);

  for (const chunk of request.groundTruthChunks) {
    const chunkYears = extractHistoricalTimeBounds(chunk);
    gtYears.push(...chunkYears);
  }

  const claimYears = extractHistoricalTimeBounds(request.scriptClaim);

  let chronologicalPenalty = 0;
  let chronologicalAnomalyMsg = '';

  if (gtYears.length > 0 && claimYears.length > 0) {
    const minGtYear = Math.min(...gtYears);
    const maxGtYear = Math.max(...gtYears);

    for (const cy of claimYears) {
      if (cy < minGtYear - 50 || cy > maxGtYear + 50) {
        chronologicalPenalty = 0.45;
        chronologicalAnomalyMsg = ` [Chronological Anomaly: year ${cy} deviates > 50 years from epoch bounds ${minGtYear}-${maxGtYear}]`;
        break;
      }
    }
  }

  const entailmentScore = Math.max(0.1, Number((rawEntailmentScore - chronologicalPenalty).toFixed(2)));
  const isHallucinated = entailmentScore < 0.80;

  const verdict = entailmentScore >= 0.80 ? 'ENTAILMENT' : entailmentScore >= 0.50 ? 'NEUTRAL' : 'CONTRADICTION';

  return {
    entailmentScore,
    isHallucinated,
    verdict,
    explanation: isHallucinated
      ? `Entailment score ${entailmentScore} < 0.80 threshold. Claim may contain unverified statements or epoch mismatch.${chronologicalAnomalyMsg}`
      : `Entailment score ${entailmentScore} >= 0.80 threshold.`,
  };
}

/**
 * Neural LLM-as-a-Judge NLI Evaluation
 * Strictly calls local Qwen model for zero-heuristic semantic reasoning in EVAL_STRICT mode
 */
export async function evaluateNliWithLlmJudge(request: NliJudgeRequest): Promise<NliJudgeResult> {
  if (!request.scriptClaim.trim() || request.groundTruthChunks.length === 0) {
    return {
      entailmentScore: 0.0,
      isHallucinated: false,
      verdict: 'NEUTRAL',
      explanation: 'No claims or ground truth chunks provided.',
    };
  }

  const combinedGroundTruth = request.groundTruthChunks.filter(Boolean).join('\n\n').trim();
  const systemPrompt = `Bạn là NLI Hallucination Judge của ChronoViet.
Nhiệm vụ: Thẩm định xem câu kịch bản (Script Claim) có suy diễn logic (Entailment) từ dữ kiện lịch sử gốc (Ground Truth) hay là bịa đặt/ảo giác (Hallucination).

Quy tắc:
- "verdict": "ENTAILMENT" nếu toàn bộ dữ kiện trong claim được hỗ trợ bởi ground truth.
- "verdict": "CONTRADICTED" nếu claim mâu thuẫn trực tiếp với ground truth.
- "verdict": "NEUTRAL" nếu ground truth không đủ thông tin.
- "entailmentScore": thang điểm float từ 0.0 đến 1.0 (>= 0.80 là ENTAILMENT chuẩn).

Xuất duy nhất 1 JSON object:
{
  "entailmentScore": <float 0.0 - 1.0>,
  "isHallucinated": <boolean>,
  "verdict": "ENTAILMENT" | "NEUTRAL" | "CONTRADICTION",
  "explanation": "<giải thích ngắn gọn 1 câu>"
}`;

  const userContent = `KỊCH BẢN (Script Claim): "${request.scriptClaim}"

DỮ KIỆN LỊCH SỬ GỐC (Ground Truth):
${combinedGroundTruth.slice(0, 1500)}`;

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
    const validVerdicts = ['ENTAILMENT', 'NEUTRAL', 'CONTRADICTION'] as const;
    const verdict = validVerdicts.includes(parsed.verdict) ? parsed.verdict : 'NEUTRAL';
    const score = typeof parsed.entailmentScore === 'number' ? Math.max(0, Math.min(1, parsed.entailmentScore)) : (verdict === 'ENTAILMENT' ? 0.9 : 0.4);
    const isHallucinated = typeof parsed.isHallucinated === 'boolean' ? parsed.isHallucinated : score < 0.80;

    return {
      entailmentScore: score,
      isHallucinated,
      verdict,
      explanation: String(parsed.explanation || ''),
    };
  } catch (err: any) {
    if (envConfig.EVAL_STRICT) {
      throw new Error(`[EVAL_STRICT] Neural NLI evaluation failed: ${err.message}`);
    }
    return evaluateNliEntailmentScore(request);
  }
}
