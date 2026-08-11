/**
 * Text Cleaning & Sino-Vietnamese Normalization Engine for Historical Documents
 */

const OCR_CLEANUP_RULES: Array<[RegExp, string]> = [
  [/[\r\n]+/g, '\n'],
  [/[ \t]+/g, ' '],
  [/\b([a-zA-ZÀ-ỹ]+)-\s*\n\s*([a-zA-ZÀ-ỹ]+)\b/g, '$1$2'], // Fix hyphenated line-breaks
  [/[^\S\r\n]+\n/g, '\n'], // Trim trailing whitespace per line
  [/\n{3,}/g, '\n\n'], // Max 2 consecutive linebreaks
];

const HISTORICAL_TERM_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/\bTay Son\b/gi, 'Tây Sơn'],
  [/\bQuang Trung\b/gi, 'Quang Trung'],
  [/\bNguyen Hue\b/gi, 'Nguyễn Huệ'],
  [/\bThang Long\b/gi, 'Thăng Long'],
  [/\bDong Quan\b/gi, 'Đông Quan'],
  [/\bDong Kinh\b/gi, 'Đông Kinh'],
  [/\bDai Viet\b/gi, 'Đại Việt'],
  [/\bDai Nam\b/gi, 'Đại Nam'],
  [/\bVan Lang\b/gi, 'Văn Lang'],
  [/\bAu Lac\b/gi, 'Âu Lạc'],
  [/\bTran Quoc Tuan\b/gi, 'Trần Quốc Tuấn'],
  [/\bTran Hung Dao\b/gi, 'Trần Hưng Đạo'],
  [/\bLe Loi\b/gi, 'Lê Lợi'],
  [/\bLe Thai To\b/gi, 'Lê Thái Tổ'],
  [/\bNgo Quyen\b/gi, 'Ngô Quyền'],
  [/\bDinh Tien Hoang\b/gi, 'Đinh Tiên Hoàng'],
  [/\bLy Thai To\b/gi, 'Lý Thái Tổ'],
];

export function cleanText(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText;
  for (const [pattern, replacement] of OCR_CLEANUP_RULES) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned.trim();
}

export function normalizeHistoricalTerms(text: string): string {
  if (!text) return '';
  let normalized = text;
  for (const [pattern, replacement] of HISTORICAL_TERM_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

export function preprocessDocumentText(rawText: string): string {
  const cleaned = cleanText(rawText);
  return normalizeHistoricalTerms(cleaned);
}
