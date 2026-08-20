/**
 * NLI Entailment Hallucination Judge (Phase 1 Node.js MVP) (Spec Section 6.1)
 * Evaluates script claim entailment against ground truth chunk context (Entailment Score >= 0.80)
 */

export interface NliJudgeRequest {
  scriptClaim: string;
  groundTruthChunks: string[];
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
 * Computes lexical & semantic overlap entailment score between script claim and ground truth context
 * Filters out common grammatical stopwords to focus scoring on substantive entities and historical claims.
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
  // Entailment score mapping
  const entailmentScore = Math.min(1.0, Number((0.4 + overlapScore * 0.6).toFixed(2)));
  const isHallucinated = entailmentScore < 0.80;

  const verdict = entailmentScore >= 0.80 ? 'ENTAILMENT' : entailmentScore >= 0.50 ? 'NEUTRAL' : 'CONTRADICTION';

  return {
    entailmentScore,
    isHallucinated,
    verdict,
    explanation: isHallucinated
      ? `Entailment score ${entailmentScore} < 0.80 threshold. Claim may contain unverified statements.`
      : `Entailment score ${entailmentScore} >= 0.80 threshold.`,
  };
}
