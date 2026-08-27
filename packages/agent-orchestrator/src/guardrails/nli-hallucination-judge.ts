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
 * Extracts calendar years from text while ignoring numeric quantities (e.g. troop counts, boat counts).
 */
export function extractCalendarYears(text: string): number[] {
  if (!text) return [];
  const years = new Set<number>();

  // 1. Explicit year pattern (e.g. "năm 981", "năm 1428", "thế kỷ 15")
  const explicitYearRegex = /(?:năm|thời|niên hiệu|thế kỷ)\s+(\d{3,4})\b/gi;
  let match: RegExpExecArray | null;
  while ((match = explicitYearRegex.exec(text)) !== null) {
    const y = parseInt(match[1], 10);
    if (y >= 100 && y <= 2100) {
      years.add(y);
    }
  }

  // 2. Standalone 4-digit years (e.g. 1288, 1428, 1789, 1954) not followed by quantity units
  const standaloneYearRegex = /\b(1\d{3}|20\d{2})\b(?!\s*(?:vạn|nghìn|triệu|người|quân|lính|chiến sĩ|thuyền|tàu|chiếc|khẩu|ngày|tháng|mét|km|dặm|tấn|kg|con|đoàn|trận))/gi;
  while ((match = standaloneYearRegex.exec(text)) !== null) {
    const y = parseInt(match[1], 10);
    if (y >= 1000 && y <= 2100) {
      years.add(y);
    }
  }

  return Array.from(years);
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

  // Chronological & Epoch Verification
  const gtYears: number[] = [];
  if (request.epochBounds?.startYear !== undefined) gtYears.push(request.epochBounds.startYear);
  if (request.epochBounds?.endYear !== undefined) gtYears.push(request.epochBounds.endYear);

  for (const chunk of request.groundTruthChunks) {
    const chunkYears = extractCalendarYears(chunk);
    gtYears.push(...chunkYears);
  }

  const claimYears = extractCalendarYears(request.scriptClaim);

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
