/**
 * Real-time Stream Loop & Repetition Detector
 * Prevents LLM generation degeneration where paragraphs, sentences, or phrases repeat in a loop.
 */

export interface StreamLoopDetector {
  /**
   * Process an incoming text chunk.
   * Returns:
   * - `shouldEmit`: whether this chunk should be yielded to the client
   * - `shouldTerminate`: whether the stream should be stopped due to severe loop degeneration
   * - `cleanChunk`: sanitized chunk text
   */
  processChunk(chunk: string): {
    shouldEmit: boolean;
    shouldTerminate: boolean;
    cleanChunk: string;
  };
  getAccumulatedText(): string;
}

export function createStreamLoopDetector(options: {
  minRepeatLength?: number;
  maxRepeatsAllowed?: number;
} = {}): StreamLoopDetector {
  const minRepeatLength = options.minRepeatLength ?? 60;
  const maxRepeatsAllowed = options.maxRepeatsAllowed ?? 3;

  let accumulated = '';

  return {
    processChunk(chunk: string) {
      accumulated += chunk;

      // Check consecutive identical paragraph/sentence degeneration (immediate severe loop)
      const lines = accumulated
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length >= Math.min(minRepeatLength, 25));

      if (lines.length >= 3) {
        const last = lines[lines.length - 1].toLowerCase().replace(/[.,!?:;\s]+/g, ' ');
        const prev = lines[lines.length - 2].toLowerCase().replace(/[.,!?:;\s]+/g, ' ');
        const prev2 = lines[lines.length - 3].toLowerCase().replace(/[.,!?:;\s]+/g, ' ');
        if (last.length >= 25 && last === prev && last === prev2) {
          return {
            shouldEmit: false,
            shouldTerminate: true,
            cleanChunk: '',
          };
        }
      }

      // 1. Paragraph-level loop detection
      const paragraphs = accumulated
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= minRepeatLength);

      const paragraphCounts = new Map<string, number>();
      for (const p of paragraphs) {
        // Skip structural markdown headers/titles (e.g. ###, **, - **)
        if (/^(?:#{1,6}|\*{2}|-\s*\*{2})/.test(p) && p.length < 120) continue;
        const normalized = p.toLowerCase().replace(/[.,!?:;\s]+/g, ' ');
        const count = (paragraphCounts.get(normalized) || 0) + 1;
        paragraphCounts.set(normalized, count);
        if (count > maxRepeatsAllowed) {
          return {
            shouldEmit: false,
            shouldTerminate: true,
            cleanChunk: '',
          };
        }
      }

      // 2. Sentence-level loop detection (for single unbreaking paragraphs)
      const sentences = accumulated
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= minRepeatLength);

      const sentenceCounts = new Map<string, number>();
      for (const s of sentences) {
        // Skip structural markdown headers/titles
        if (/^(?:#{1,6}|\*{2}|-\s*\*{2})/.test(s) && s.length < 120) continue;
        const normalized = s.toLowerCase().replace(/[.,!?:;\s]+/g, ' ');
        const count = (sentenceCounts.get(normalized) || 0) + 1;
        sentenceCounts.set(normalized, count);
        if (count > maxRepeatsAllowed) {
          return {
            shouldEmit: false,
            shouldTerminate: true,
            cleanChunk: '',
          };
        }
      }

      return {
        shouldEmit: true,
        shouldTerminate: false,
        cleanChunk: chunk,
      };
    },

    getAccumulatedText() {
      return accumulated;
    },
  };
}

/**
 * Deduplicates repeated text blocks and sentences from a completed full text string.
 */
export function deduplicateRepetitiveText(text: string): string {
  if (!text || !text.trim()) return text;

  const paragraphs = text.split(/\n{2,}/);
  const seenParagraphs = new Set<string>();
  const seenSentences = new Set<string>();
  const resultParagraphs: string[] = [];

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Normalize paragraph for deduplication
    const normPara = trimmedPara.toLowerCase().replace(/[.,!?:;\s]+/g, ' ');
    if (trimmedPara.length >= 35 && seenParagraphs.has(normPara)) {
      continue; // Skip duplicate paragraph
    }
    seenParagraphs.add(normPara);

    // Sentence-level deduplication within the paragraph
    const sentences = trimmedPara.split(/(?<=[.?!])\s+/);
    const uniqueSentences: string[] = [];

    for (const sent of sentences) {
      const trimmedSent = sent.trim();
      if (!trimmedSent) continue;

      const normSent = trimmedSent.toLowerCase().replace(/[.,!?:;\s]+/g, ' ');
      if (trimmedSent.length >= 25 && seenSentences.has(normSent)) {
        continue; // Skip duplicate sentence
      }
      if (trimmedSent.length >= 25) {
        seenSentences.add(normSent);
      }
      uniqueSentences.push(trimmedSent);
    }

    if (uniqueSentences.length > 0) {
      resultParagraphs.push(uniqueSentences.join(' '));
    }
  }

  return resultParagraphs.join('\n\n');
}

/**
 * Strips prompt directive prefixes or regurgitated system instructions if leaked by the LLM
 */
export function sanitizePromptDirectivesLeakage(text: string): string {
  if (!text || !text.trim()) return text;
  return text
    .replace(/^(?:\[QUY TẮC[^\]]+\]\s*)+/gi, '')
    .replace(/^(?:CHỈ DẪN [^:\n]+:\s*)+/gi, '')
    .replace(/^(?:Trả lời trực diện, chính xác mốc năm[^\n]+\n*)+/gi, '')
    .replace(/^(?:Đi thẳng vào trọng tâm, nêu rõ mốc năm[^\n]+\n*)+/gi, '')
    .trim();
}

/**
 * Normalizes inline-collapsed markdown lists into properly line-broken lists.
 * Ensures items such as "...thuở nhỏ). 2. Nguyễn Tất Thành..." are cleanly broken into "\n\n2. Nguyễn Tất Thành".
 */
export function normalizeMarkdownListBreaks(text: string): string {
  if (!text || !text.trim()) return text;
  // 1. Separate inline numbered list items that were joined on a single line
  let normalized = text.replace(/(?<=[.!?):;])\s{1,4}(?=\d+\.\s+[\p{Lu}A-ZÀ-Ỹ])/gu, '\n\n');

  // 2. Separate inline bullet points joined on a single line
  normalized = normalized.replace(/(?<=[.!?):;])\s{1,4}(?=[-•*]\s+[\p{Lu}A-ZÀ-Ỹ])/gu, '\n\n');

  return normalized;
}
