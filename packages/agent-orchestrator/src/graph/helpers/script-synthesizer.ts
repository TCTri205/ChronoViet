import { sanitizeSentenceBoundaries } from '@chronoviet/shared-spec';
import { deduplicateRepetitiveText } from '../../guardrails/stream-dedup.js';
import { cleanCrawlerText } from './entity-sanitizer.js';
import { normalizeHistoricalAnachronisms } from './script-sanitizer.js';

/**
 * Synthesizes a deterministic historical voiceover script from RAG chunks
 * when LLM generation fails or when running in offline/deterministic mode.
 */
export function synthesizeDeterministicHistoricalScript(
  chapterTitle: string,
  chapterSummary: string,
  selectedChunks: any[],
  targetDurationSeconds: number,
  targetWpm = 205
): string {
  const sentences: string[] = [];
  const seenFingerprints = new Set<string>();

  function getFingerprint(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9à-ỹ]/g, '');
  }

  function addSentence(s: string): boolean {
    const cleanS = sanitizeSentenceBoundaries(normalizeHistoricalAnachronisms(s.trim()));
    if (!cleanS || cleanS.length < 15) return false;
    const fp = getFingerprint(cleanS);
    if (!fp || seenFingerprints.has(fp)) return false;

    // Check near-duplicate substring overlap with existing sentences
    for (const existingFp of seenFingerprints) {
      if (existingFp.includes(fp) || fp.includes(existingFp)) {
        return false;
      }
    }

    seenFingerprints.add(fp);
    sentences.push(cleanS);
    return true;
  }

  const targetWords = Math.max(20, Math.round((targetDurationSeconds / 60) * targetWpm));
  const maxWords = Math.round(targetWords * 1.12);

  // 1. Chapter context from verified outline summary
  if (chapterSummary && chapterSummary.trim()) {
    const cleanChapterSummary = sanitizeSentenceBoundaries(chapterSummary.trim());
    if (cleanChapterSummary) {
      // Strip any raw entity tag prefix (e.g. "Đảng Cộng sản Việt Nam: ...")
      const stripped = cleanChapterSummary.replace(/^[A-ZÀ-Ỹa-zà-ỹ0-9\s]{2,40}:\s*/, '');
      addSentence(stripped || cleanChapterSummary);
    }
  }

  // 2. Verified historical facts from RAG chunks, filtered to narrative prose and strictly length-bounded
  let currentWords = sentences.join(' ').split(/\s+/).filter(Boolean).length;

  for (const chunk of selectedChunks) {
    if (currentWords >= targetWords) break;
    const summary = cleanCrawlerText(chunk.summary || chunk.content || '');
    if (!summary) continue;

    const rawSentences = summary
      .replace(/["“”'‘’]/g, '')
      .replace(/Theo (?:Tập sử liệu|sách|bản ghi|tư liệu).*?:/gi, '')
      .split(/(?<=[.!?])\s+/)
      .map((s: string) => s.trim())
      .filter((s: string) => {
        if (s.length < 15 || s.startsWith('#') || /^(?:Than ôi|Nguyên trước|Bấy giờ|Sử thần)/i.test(s)) return false;
        const cleanedTail = s.replace(/(?:,\s*|\s+)(?:vào\s+năm\s+\d{1,3}|năm\s+\d{1,2}|tháng\s+\d{1,2}|vào|tại|trong|khi|do|vì|bởi|và|hoặc|nhưng|rồi|với)[.!?]?\s*$/gi, '');
        return /[.!?]$/.test(cleanedTail);
      })
      .map((s: string) => {
        return s
          .replace(/(?:,\s*|\s+)(?:vào\s+năm\s+\d{1,3}|năm\s+\d{1,2}|tháng\s+\d{1,2}|ngày\s+\d{1,2}|vào|tại|trong|khi|do|vì|bởi|và|hoặc|nhưng|rồi|với)[.!?]?\s*$/gi, '.')
          .trim();
      });

    for (const s of rawSentences) {
      const sWords = s.split(/\s+/).filter(Boolean).length;
      if (currentWords + sWords <= maxWords) {
        if (addSentence(s)) {
          currentWords += sWords;
        }
      }
      if (currentWords >= targetWords) break;
    }
  }

  // 3. Fallback narrative enrichment if still below target words
  if (sentences.length === 0 || currentWords < Math.round(targetWords * 0.75)) {
    const historicalEnrichment = `Giai đoạn này không chỉ khẳng định tầm vóc lịch sử của ${chapterTitle}, mà còn để lại bài học sâu sắc cho hậu thế trong sự nghiệp dựng nước và giữ nước.`;
    if (addSentence(historicalEnrichment)) {
      currentWords += historicalEnrichment.split(/\s+/).filter(Boolean).length;
    }
  }

  const combinedScript = deduplicateRepetitiveText(sentences.join(' '));
  return sanitizeSentenceBoundaries(normalizeHistoricalAnachronisms(combinedScript));
}
