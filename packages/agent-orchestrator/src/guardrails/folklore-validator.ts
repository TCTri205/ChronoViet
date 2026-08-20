/**
 * Automated Folklore Guardrail Validator Gate (Spec Section 3.2)
 * Validates script text referencing LEVEL_3 / FOLKLORE_MYTH source chunks using Flexible Regex Pattern Matching
 */

export const FOLKLORE_SIGNAL_REGEX =
  /(theo (truyền thuyết|dã sử|thần thoại|dân gian|giai thoại)|tương truyền|dân gian (kể|cho rằng)|(truyền thuyết|giai thoại) (kể|rằng|ghi nhận)|người xưa (kể|truyền)|theo các giai thoại)/i;

export interface FolkloreValidationResult {
  isValid: boolean;
  matchedSignals: string[];
  failingSentences: string[];
  feedbackPrompt?: string;
}

/**
 * Validates whether sentences referencing Level 3 / Folklore source material use appropriate hypothesis framing.
 * Evaluates hypothesis framing at the narrative/introductory level so that descriptive sentences
 * following a valid hypothesis signal within the narrative do not trigger false-positive rejections.
 */
export function validateFolkloreHypothesisTone(
  scriptText: string,
  isLevel3OrFolkloreSource: boolean
): FolkloreValidationResult {
  if (!isLevel3OrFolkloreSource || !scriptText.trim()) {
    return { isValid: true, matchedSignals: [], failingSentences: [] };
  }

  // Split into sentences (by period, exclamation, question mark, newline)
  const sentences = scriptText
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const matchedSignals: string[] = [];

  for (const sentence of sentences) {
    const match = sentence.match(FOLKLORE_SIGNAL_REGEX);
    if (match) {
      matchedSignals.push(match[0]);
    }
  }

  // If at least one valid hypothesis signal is present in the narrative section,
  // the entire section satisfies the hypothesis tone requirement.
  const isValid = matchedSignals.length > 0;

  if (isValid) {
    return { isValid: true, matchedSignals, failingSentences: [] };
  }

  const feedbackPrompt =
    `[GUARDRAIL REJECT - LEVEL 3 FOLKLORE TONE VIOLATION]\n` +
    `Nội dung kịch bản tham chiếu từ nguồn Dã sử / Truyền thuyết (LEVEL_3) chưa tuân thủ giọng văn giả thuyết tự động.\n` +
    `CÁC CÂU BỊ TỪ CHỐI: ${sentences.slice(0, 3).join(' | ')}\n` +
    `YÊU CẦU BẮT BUỘC: Sử dụng các cụm từ tín hiệu giả thuyết như 'theo truyền thuyết', 'tương truyền', 'dân gian kể', 'theo giai thoại' trước khi trình bày thông tin.`;

  return {
    isValid: false,
    matchedSignals: [],
    failingSentences: sentences,
    feedbackPrompt,
  };
}
