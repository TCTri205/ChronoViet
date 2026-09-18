import { sanitizeSentenceBoundaries } from '@chronoviet/shared-spec';
import { deduplicateRepetitiveText } from '../../guardrails/stream-dedup.js';

/**
 * Strips leaked meta-prompts, markdown fences, directions, speaker labels,
 * and Chinese characters from LLM-generated voiceover scripts.
 */
export function sanitizeVoiceoverScript(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText
    // Remove markdown code fences (e.g. ```markdown ... ```)
    .replace(/^```[a-z]*\s*[\r\n]+/i, '')
    .replace(/[\r\n]+```\s*$/i, '')
    // Remove enclosing triple or double quotes
    .replace(/^"{1,3}\s*[\r\n]*/, '')
    .replace(/[\r\n]*"{1,3}\s*$/, '')
    // Remove direction / sound tags
    .replace(/\[(?:Nhạc|Cảnh|Hình ảnh|Hiệu ứng|Âm thanh|Voiceover).*?\]/gi, '')
    .replace(/\((?:Giọng|Cười|Hào hùng|Trầm lắng|Thì thầm|Bi tráng).*?\)/gi, '')
    // Remove speaker labels
    .replace(/^(?:MC|Người dẫn chuyện|Lời bình|Host)\s*:\s*/gim, '')
    // Remove markdown headers like #, ##, ###
    .replace(/^#{1,4}\s+.*$/gm, '')
    // Remove Wikipedia section headers like == Header == or === Subheader ===
    .replace(/={2,5}[^=\n]+={2,5}/g, '')
    // Remove Wikipedia citation and reference tags like [1], [2], [cần dẫn nguồn]
    .replace(/\[\d+\]/g, '')
    .replace(/\[(?:cần dẫn nguồn|nguồn|sđd|tr\.)[^\]]*\]/gi, '')
    // Remove bold/markdown section labels like **Hồi 1 - Mở cảnh:** or Hồi 1: or Mở cảnh:
    .replace(/(?:^|[ \t]+)(?:\*{1,3})?(?:Hồi|Phần|Chương|Đoạn)\s*\d+[^\n*:]*(?::[^\n*]*\*\*|\*\*:?|[:–—\-])\s*/gim, ' ')
    .replace(/^[ \t]*(?:\*{1,3})?(?:Hồi|Phần|Chương|Đoạn)\s*\d+[^\n]*$/gim, '')
    .replace(/(?:^|[ \t]+)(?:\*{1,3})?(?:Mở cảnh|Mở đầu|Diễn biến(?:\s*&\s*Cao trào)?|Cao trào|Đúc kết|Dư âm(?:\s*&\s*Bài học)?|Bài học)[^\n*:]*(?::[^\n*]*\*\*|\*\*:?|[:–—\-])\s*/gim, ' ')
    .replace(/^[ \t]*(?:\*{1,3})?(?:Mở cảnh|Mở đầu|Diễn biến(?:\s*&\s*Cao trào)?|Cao trào|Đúc kết|Dư âm(?:\s*&\s*Bài học)?|Bài học)[^\n]*$/gim, '')
    // Remove prompt artifact leakage (e.g. "(2 câu, 44 từ)", "(~50 từ)", "(đúng 3 câu, 50 từ)")
    .replace(/\([^)]*\d+\s*(?:câu|từ)[^)]*\)/gi, '')
    // Remove structural prompt tags (e.g. "(Entry Hook)", "(Climax Focus)", "(Exit Hook)", "(Mở cảnh)", "(Cao trào)", "(Dư âm)")
    .replace(/\((?:Entry Hook|Climax Focus|Exit Hook|Mở đầu|Mở cảnh|Diễn biến|Cao trào|Đúc kết|Dư âm|Bài học)[^)]*\)/gi, '')
    // Remove leaked meta-prompt instructions and prompt blueprint echoes
    .replace(/(?:^|[.!?\s]+)Khắc họa ý nghĩa thời đại[^\n.!?]*?(?:theo exit hook|bài học lịch sử)[^\n.!?]*[.!?]?/gi, ' ')
    .replace(/(?:^|[.!?\s]+)(?:Dẫn dắt không gian, thời gian|Miêu tả chi tiết mưu lược|Đoạn đúc kết & dư âm|chuyển tiếp mượt mà theo exit hook)[^\n.!?]*[.!?]?/gi, ' ')
    .replace(/\b(?:theo exit hook|theo entry hook|theo blueprint)\b/gi, '')
    // Remove leading standalone tone markers like "Hào hùng, trang trọng." or "Hào hùng."
    .replace(/^(?:\*{1,3})?(?:Hào hùng|Trang trọng|Hùng tráng|Trầm lắng|Bi tráng)(?:,\s*(?:trang trọng|hào hùng|sâu lắng))?[.:]?(?:\*{1,3})?\s*/gim, '')
    // Remove markdown bold/italic tags around remaining standalone section names
    .replace(/\*\*(?:Bối cảnh|Diễn biến|Chiến lược|Dư âm|Kết luận)\*\*:?\s*/gi, '')
    // Remove Chinese characters (Hanzi) that may leak from multilingual LLM outputs
    .replace(/[\u4e00-\u9fa5]+/g, '')
    // Remove accidental prompt instruction leakage at the very start
    .replace(/^(?:Khởi nguồn từ bối cảnh [^,.\n]+ của )?(?:Kể lại|Hãy kể|Trình bày|Hãy trình bày|Tóm tắt|Phân tích|Viết về|Hãy viết về)\s+[^,.\n]+(?:,\s*|[.:]\s*)/i, '')
    // Strip dangling enclosing quotes
    .replace(/^["“”'«»]+|["“”'«»]+$/g, '')
    .trim();

  // Remove trailing incomplete transition phrases or connector prompts
  cleaned = cleaned
    .replace(/(?:Tiếp theo là|Mối nối chuyển cảnh:?|Chuyển sang hồi tiếp theo:?|Tiếp tục diễn biến:?)\s*$/gi, '')
    .trim();

  // Remove dangling truncated date or preposition tails (e.g. "vào năm 1.", "vào năm 19.", "tại.")
  cleaned = cleaned
    .replace(/(?:,\s*|\s+)(?:vào\s+năm\s+\d{1,3}|năm\s+\d{1,2}|tháng\s+\d{1,2}|ngày\s+\d{1,2}|vào\s+|tại\s+|trong\s+|khi\s+|do\s+|vì\s+|bởi\s+|và\s+|hoặc\s+|nhưng\s+|rồi\s+|với\s+)[.!?]?\s*$/gi, '.')
    .trim();

  // Trim dangling incomplete sentence if truncated without terminal punctuation
  if (cleaned.length > 30 && !/[.!?]["”']?\s*$/.test(cleaned)) {
    const lastPunct = Math.max(
      cleaned.lastIndexOf('.'),
      cleaned.lastIndexOf('!'),
      cleaned.lastIndexOf('?')
    );
    if (lastPunct > 20) {
      cleaned = cleaned.slice(0, lastPunct + 1).trim();
    } else {
      cleaned = `${cleaned}.`;
    }
  }

  // Deduplicate repeated sentences and paragraphs
  cleaned = deduplicateRepetitiveText(cleaned);

  // Clean sentence boundaries (strips trailing cutoffs, ensures terminal punctuation)
  cleaned = sanitizeSentenceBoundaries(cleaned);

  return cleaned.trim();
}

/**
 * Strips title echoes from the beginning of chapter scripts.
 */
export function stripChapterTitleEcho(text: string, title?: string): string {
  if (!text || !title) return text;
  let s = text.trim();
  const lowerTitle = title.toLowerCase().trim();
  if (s.toLowerCase().startsWith(lowerTitle)) {
    s = s.slice(title.length).replace(/^[:–—\-.\s]+/, '').trim();
  }
  const firstSentenceMatch = s.match(/^([^.!?\n]+[.!?\n]?)/);
  if (firstSentenceMatch) {
    const firstSentenceText = firstSentenceMatch[1].replace(/[.!?\n]/g, '').trim().toLowerCase();
    if (firstSentenceText === lowerTitle || (lowerTitle.includes(firstSentenceText) && firstSentenceText.length >= 10)) {
      s = s.slice(firstSentenceMatch[0].length).trim();
    }
  }
  return s;
}

/**
 * Normalizes anachronistic geographic or military names for specific historical epochs (e.g. Tay Son).
 */
export function normalizeHistoricalAnachronisms(text: string, epochKey?: string): string {
  if (!text) return text;
  const isTaySonContext =
    epochKey === 'EPOCH_TAY_SON' ||
    /tây\s+sơn|quang\s+trung|nguyễn\s+huệ|ngọc\s+hồi|đống\s+đa|kỷ\s+dậu\s+1789|chiến\s+dịch\s+1789|xuân\s+1789/i.test(
      text
    );

  if (isTaySonContext) {
    return text
      .replace(/\bquân Hà Nội\b/gi, 'nghĩa quân Tây Sơn')
      .replace(/\bquân đội Hà Nội\b/gi, 'nghĩa quân Tây Sơn')
      .replace(/\bchính quyền Hà Nội\b/gi, 'triều đình Tây Sơn');
  }

  return text;
}
