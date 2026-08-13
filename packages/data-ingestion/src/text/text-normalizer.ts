/**
 * Text Cleaning & Sino-Vietnamese Normalization Engine for Historical Documents
 */

const OCR_CLEANUP_RULES: Array<[RegExp, string]> = [
  [/[\r\n]+/g, '\n'],
  [/[ \t]+/g, ' '],
  [/\b([a-zA-ZÀ-ỹ]+)-\s*\n\s*([a-zA-ZÀ-ỹ]+)\b/g, '$1$2'], // Fix hyphenated line-breaks
  [/[^\S\r\n]+\n/g, '\n'], // Trim trailing whitespace per line
  [/\n{3,}/g, '\n\n'], // Max 2 consecutive linebreaks
  [/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''], // Remove non-printable control chars
  [/\[\s*Trang\s+\d+\s*\]/gi, ''], // Remove inline page tags like [Trang 12]
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
  [/\bDai La\b/gi, 'Đại La'],
  [/\bTong Binh\b/gi, 'Tống Bình'],
  [/\bPhu Xuan\b/gi, 'Phú Xuân'],
  [/\bThuan Hoa\b/gi, 'Thuận Hóa'],
  [/\bHoa Lu\b/gi, 'Hoa Lư'],
];

/**
 * Cleans OCR artifacts, hyphen breaks, control chars, and excessive whitespace
 * Enforces Unicode NFC normalization
 */
export function cleanOcrArtifacts(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText.normalize('NFC');
  for (const [pattern, replacement] of OCR_CLEANUP_RULES) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned.trim();
}

/**
 * Normalizes unaccented Sino-Vietnamese / historical terms to standard accented forms
 */
export function normalizeHistoricalTerms(text: string): string {
  if (!text) return '';
  let normalized = text;
  for (const [pattern, replacement] of HISTORICAL_TERM_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

/**
 * Preserves historical compound word boundaries for downstream NER & NLP processing
 */
export function segmentVietnameseWords(text: string): string {
  if (!text) return '';
  // Preserves multi-syllable historical compound entities
  const compoundTerms = [
    'Quang Trung', 'Nguyễn Huệ', 'Trần Hưng Đạo', 'Trần Quốc Tuấn', 'Lê Lợi',
    'Ngô Quyền', 'Đinh Tiên Hoàng', 'Lý Thái Tổ', 'Lý Công Uẩn', 'Nguyễn Trãi',
    'Thăng Long', 'Đông Quan', 'Đông Kinh', 'Đại Việt', 'Đại Nam', 'Văn Lang', 'Âu Lạc',
    'Phú Xuân', 'Thuận Hóa', 'Hoa Lư', 'Bạch Đằng', 'Chi Lăng', 'Mã Yên', 'Tốt Động',
    'Chúc Động', 'Ngọc Hồi', 'Đống Đa', 'Rạch Gầm', 'Xoài Mút'
  ];

  let segmented = text;
  for (const term of compoundTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    segmented = segmented.replace(regex, term);
  }
  return segmented;
}

/**
 * Complete document normalization pipeline combining OCR cleaning, NFC normalization and term normalization
 */
export function normalizeText(rawText: string): string {
  const cleaned = cleanOcrArtifacts(rawText);
  const normalized = normalizeHistoricalTerms(cleaned);
  return segmentVietnameseWords(normalized);
}

// Backward compatibility aliases matching text-cleaner.ts
export const cleanText = cleanOcrArtifacts;
export const preprocessDocumentText = normalizeText;
