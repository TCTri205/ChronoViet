/**
 * Canonical Vietnamese Text Normalization & Sanitization Utilities
 * Single Source of Truth (SSOT) across @chronoviet monorepo packages.
 */

/**
 * Removes Vietnamese accents / diacritics and converts 'đ'/'Đ' to 'd'/'D'.
 */
export function removeVietnameseAccents(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Strips Vietnamese diacritics / tone marks, preserving ASCII characters.
 * Alias for removeVietnameseAccents.
 */
export function removeVietnameseTones(str: string): string {
  return removeVietnameseAccents(str);
}

/**
 * Normalizes excessive whitespace, collapses repeated spaces, trims leading/trailing spaces.
 */
export function normalizeWhitespace(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Cleans truncated / malformed sentence boundaries in LLM-generated historical narration texts.
 * - Protects thousands separators and decimals in numbers (e.g. '230.000', '12.5').
 * - Strips dangling prepositions and conjunctions (e.g., 'vào năm', 'tại', 'khi') before sentence ends.
 * - Removes isolated single-letter trailing initials from truncated strings.
 * - Ensures any valid retained text ends with proper closing punctuation.
 */
export function sanitizeSentenceBoundaries(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  if (!cleaned) return '';

  // Collapse repeated terminal punctuation and leading spaces before punctuation
  cleaned = cleaned.replace(/([?!])\1+/g, '$1').replace(/\s+([?!.,;:~])/g, '$1');

  // 1. Protect numbers with thousands separators and decimals (e.g. 230.000, 300. 000, 12.5)
  cleaned = cleaned.replace(/(\d+)\.\s*(\d+)/g, '$1__NUMDOT__$2');

  // Clean trailing dangling prepositions/conjunctions before period or at the end
  const danglingTailRegex = /(?:,\s*|\s+)(?:vào\s+năm(?:\s+\d{1,3})?|năm\s+\d{1,2}|tháng\s+\d{1,2}|ngày\s+\d{1,2}|vào|tại|trong|khi|do|vì|bởi|và|hoặc|nhưng|rồi|với|là|ở|đến|của|từ)[.!?]?\s*$/gi;
  cleaned = cleaned.replace(danglingTailRegex, '').trim();

  // If text already ends with terminal punctuation (.!? optionally followed by quotes)
  if (/[.!?]["”'’]?\s*$/.test(cleaned)) {
    cleaned = cleaned.replace(/(?:,\s*|\s+)(?:vào\s+năm(?:\s+\d{1,3})?|năm\s+\d{1,2}|tháng\s+\d{1,2}|ngày\s+\d{1,2}|vào|tại|trong|khi|do|vì|bởi|và|hoặc|nhưng|rồi|với|là|ở|đến|của|từ)[.!?]\s*$/gi, '.').trim();
    return cleaned.replace(/__NUMDOT__/g, '.');
  }

  // The text does NOT end with terminal punctuation.
  // Check if there is an earlier legitimate sentence boundary:
  // - A punctuation (.!?) that is followed by whitespace and a capital letter
  // - NOT preceded by digits or common Vietnamese abbreviations (TP., GS., TS., etc.)
  const abbrevRegex = /\b(?:TP|Tp|TpHCM|GS|PGS|TS|ThS|BS|Th|Q|H|TX|TT|tr|sđd|v\.v)\.$/i;
  const candRegex = /(?<=[^\d\s]{2,})[.!?]["”'’]?\s+(?=[A-ZÀ-Ỹ])/gu;
  let lastBoundaryEnd = -1;
  let m: RegExpExecArray | null;

  while ((m = candRegex.exec(cleaned)) !== null) {
    const beforeDot = cleaned.slice(0, m.index + 1);
    if (!abbrevRegex.test(beforeDot)) {
      lastBoundaryEnd = m.index + 1;
    }
  }

  if (lastBoundaryEnd !== -1 && lastBoundaryEnd >= 20) {
    // Discard the unclosed trailing fragment, retaining only the complete sentence
    cleaned = cleaned.slice(0, lastBoundaryEnd).trim();
    return cleaned.replace(/__NUMDOT__/g, '.');
  }

  // No earlier legitimate sentence boundary found.
  // If the text ends with an isolated single letter, it was truncated mid-word without a complete sentence
  if (/(?:^|\s+)\p{L}\s*$/u.test(cleaned)) {
    return '';
  }

  // Otherwise, if cleaned text is still a substantial sentence/clause (>= 15 chars), close it with a dot
  if (cleaned.length >= 15) {
    cleaned = `${cleaned}.`;
  }

  return cleaned.replace(/__NUMDOT__/g, '.');
}
