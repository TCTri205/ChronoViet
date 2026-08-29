/**
 * ChronoViet - Layer 0 Corpus Preprocessor & Text Sanitizer
 *
 * Implements Layer 0 Preprocessing & Sanitization:
 * - Encoding normalizer & NFC canonicalization
 * - 3-Token Lookahead Phonetic Syllable Healer with Lexicon validation
 * - Single-letter word protections & Case preservation
 * - Hyphen un-hyphenation with military code & date range whitelist
 * - MediaWiki cleanup, OCR pipe table unwrapping, split heading merge
 * - Strict Mộc Bản page regex preserving Gregorian years [40] and editorial bracketed figures
 * - Footnote superscripts, dialogue pseudo-heading demotion, and annual wiki noise filtering
 */

import {
  isValidSyllable,
  isStandaloneSingleLetterWord,
  isNonStandaloneFragment,
} from './vietnamese-syllables.js';

export interface PreprocessOptions {
  filename?: string;
  isWiki?: boolean;
  isChronicle?: boolean;
}

export interface PreprocessResult {
  cleanedText: string;
  isQuarantineStub: boolean;
  wordCount: number;
  qualityScore: number;
  metadata?: Record<string, any>;
}

// Whitelist patterns for hyphen preservation (military codes & date ranges)
const WHITELIST_HYPHEN_PATTERNS = [
  /\b\d{1,4}\s*[-–—]\s*\d{1,4}\b/g, // Date ranges: 1954-1975, 1115-1079, 12-15
  /\b(?:B-52|B-52G|MiG-21|MiG-21MF|MiG-17|MiG-19|AK-47|C-130|C-119|C-47|P-38|F-4|UH-1A|T-54|T-34)\b/gi,
];

// Typical Vietnamese family names for retention filtering in annual wikis
const VIETNAMESE_SURNAMES = new Set([
  'nguyễn', 'trần', 'lê', 'phạm', 'hoàng', 'huỳnh', 'phan', 'vũ', 'võ', 'đặng',
  'bùi', 'đỗ', 'hồ', 'ngô', 'dương', 'lý', 'đinh', 'đoàn', 'lâm', 'trịnh', 'mai',
  'đào', 'cao', 'hà', 'lưu', 'lương', 'thái', 'châu', 'tạ', 'phùng', 'tô', 'vương',
  'quách', 'nhâm', 'tôn', 'khuất', 'tống', 'uông', 'trương'
]);

// Vietnamese leadership titles & notable positions
const VIETNAMESE_NOTABLE_POSITIONS = [
  'chủ tịch', 'thủ tướng', 'tổng bí thư', 'ủy viên', 'đại tướng', 'trung tướng',
  'thiếu tướng', 'tướng', 'anh hùng', 'vua', 'hoàng đế', 'thái tử', 'chúa',
  'nhà văn', 'nhà thơ', 'nhạc sĩ', 'họa sĩ', 'giáo sư', 'viện sĩ', 'sử gia',
  'bác sĩ', 'bộ trưởng', 'thứ trưởng', 'bí thư', 'đại sứ', 'chính trị gia'
];

/**
 * 1. Normalize Encoding, Glyphs, and CJK Punctuation (Unicode NFC)
 */
export function normalizeEncodingAndGlyphs(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let res = text.normalize('NFC');

  // Strip invisible control characters (keep newline and tab)
  res = res.replace(/[\u200B\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  // Normalize non-breaking spaces
  res = res.replace(/\u00A0/g, ' ');

  // Legacy OCR transliterations
  res = res.replace(/[ñÑðÐ]/g, (c) => (c === 'ñ' ? 'đ' : 'Đ'));

  // CJK fullwidth punctuation to ASCII
  res = res.replace(/，/g, ', ')
           .replace(/。/g, '. ')
           .replace(/：/g, ': ')
           .replace(/？/g, '? ')
           .replace(/！/g, '! ')
           .replace(/；/g, '; ');

  // Normalize trailing orphan spaces after punctuation at end of line
  res = res.replace(/([,.;:!?])\s+$/gm, '$1');

  return res;
}

/**
 * 2. Guarded Soft-Wrap Paragraph Unwrapping
 * Joins lines that do not end in sentence-terminal punctuation or markdown structural blocks.
 */
export function unwrapGuardedSoftWraps(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const unwrappedLines: string[] = [];
  let inFrontmatter = false;
  let buffer = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check YAML frontmatter boundaries
    if (trimmed === '---') {
      if (i === 0) {
        inFrontmatter = true;
        unwrappedLines.push(rawLine);
        continue;
      } else if (inFrontmatter) {
        inFrontmatter = false;
        unwrappedLines.push(rawLine);
        continue;
      }
    }

    if (inFrontmatter) {
      unwrappedLines.push(rawLine);
      continue;
    }

    // Markdown blocks that MUST NOT be unwrapped
    const isMarkdownBlock =
      trimmed.startsWith('#') ||
      trimmed.startsWith('==') ||
      trimmed.startsWith('* ') ||
      trimmed.startsWith('- ') ||
      trimmed.startsWith('+ ') ||
      /^\d+\.\s/.test(trimmed) ||
      trimmed.startsWith('> ') ||
      trimmed.startsWith('|') ||
      trimmed === '---' ||
      trimmed === '***';

    if (isMarkdownBlock || trimmed === '') {
      if (buffer.length > 0) {
        unwrappedLines.push(buffer);
        buffer = '';
      }
      unwrappedLines.push(rawLine);
      continue;
    }

    // Accumulate prose line
    if (buffer.length === 0) {
      buffer = rawLine;
    } else {
      // Check if buffer ends with sentence terminal punctuation
      const lastChar = buffer.trim().slice(-1);
      if (/[\.\?\!\:\#]/.test(lastChar)) {
        unwrappedLines.push(buffer);
        buffer = rawLine;
      } else {
        buffer = buffer + ' ' + trimmed;
      }
    }
  }

  if (buffer.length > 0) {
    unwrappedLines.push(buffer);
  }

  return unwrappedLines.join('\n');
}

/**
 * 3. Fix OCR Mid-word Casing Errors
 */
export function fixInternalCasingErrors(text: string): string {
  if (!text) return '';

  let res = text.normalize('NFC');

  // Specific common historical OCR casing glitches
  res = res.replace(/\bkhôNg\b/g, 'không')
           .replace(/\bLInh\b/g, 'Linh')
           .replace(/CÙ\s+Thị/g, 'Cù Thị')
           .replace(/thế\s+Kỷ/gi, 'thế kỷ')
           .replace(/\bngƯời\b/gi, (m) => (m[0] === 'N' ? 'Người' : 'người'))
           .replace(/\bvƯơng\b/gi, (m) => (m[0] === 'V' ? 'Vương' : 'vương'));

  // Generic repair for 1 isolated uppercase letter inside lowercase word: e.g. "thIên" -> "thiên"
  res = res.replace(/([\p{Ll}]{2,})([\p{Lu}])([\p{Ll}]+)/gu, (_, pre, upper, post) => {
    return pre + upper.toLowerCase() + post;
  });

  return res;
}

/**
 * 4. Separate Glued Words and Numbers
 */
export function separateGluedWordsAndNumbers(text: string): string {
  if (!text) return '';

  return text
    // năm1973 -> năm 1973, tháng12 -> tháng 12, ngày30 -> ngày 30, tờ8b -> tờ 8b, trang29 -> trang 29
    .replace(/\b(năm|tháng|ngày|tờ|trang|thế kỷ|khoảng|hồi|đời|vua|tập)(\d+)/gi, '$1 $2')
    // số glued với chữ: 1973tại -> 1973 tại (excluding page designators 8a, 8b, 15b)
    .replace(/(\d+)([\p{L}])/gu, (m, num, letter) => {
      if (/^[ab]$/i.test(letter)) return m;
      return `${num} ${letter}`;
    })
    // Glued conjunctions: vàđem -> và đem, vàcho -> và cho, màkhông -> mà không
    .replace(/\b(và|mà|để|hoặc|nhưng)(đem|cho|không|có|là|được|bị|thì|phải)\b/gi, '$1 $2');
}

/**
 * 5. Normalize Punctuation Spacing & Multi-dot Sequences
 */
export function normalizePunctuationSpacing(text: string): string {
  if (!text) return '';

  return text
    // Orphan spaces before punctuation: nhà Lê , -> nhà Lê,
    .replace(/\s+([,.;:!?])/g, '$1')
    // Multi-dot sequences: .... -> ...
    .replace(/\.{2,}/g, '...')
    // Multi-spaces -> single space (preserving newlines)
    .replace(/[ \t]{2,}/g, ' ');
}

/**
 * 6. Phonetic Syllable Healer (3-Token Lookahead & 2-Piece with Single-Letter Protection)
 */
export function healSplitSyllablesWithLexicon(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const healedLines: string[] = [];

  for (const line of lines) {
    // Preserve markdown headings & tables as-is for syllable healing
    if (line.startsWith('#') || line.startsWith('|') || line.startsWith('---')) {
      healedLines.push(line);
      continue;
    }

    const tokens = line.split(/(\s+)/);
    const outTokens: string[] = [];
    let i = 0;

    while (i < tokens.length) {
      const tok = tokens[i];
      if (/^\s+$/.test(tok) || tok === '') {
        outTokens.push(tok);
        i++;
        continue;
      }

      // Check 3-Token lookahead (Token[i] + space + Token[i+2] + space + Token[i+4])
      if (i + 4 < tokens.length && /^\s+$/.test(tokens[i + 1]) && /^\s+$/.test(tokens[i + 3])) {
        const t1 = tokens[i];
        const t2 = tokens[i + 2];
        const t3 = tokens[i + 4];

        // Guard against tokens containing digits, brackets, or punctuation
        if (!/[\d\[\]\(\)\{\}<>,.;:!?]/.test(t1) && !/[\d\[\]\(\)\{\}<>,.;:!?]/.test(t2) && !/[\d\[\]\(\)\{\}<>,.;:!?]/.test(t3)) {
          const cleanT1 = t1.trim();
          const cleanT2 = t2.trim();
          const cleanT3 = t3.trim();

          if (cleanT1.length > 0 && cleanT2.length > 0 && cleanT3.length > 0) {
            const mergedClean = (cleanT1 + cleanT2 + cleanT3).toLowerCase().normalize('NFC');
            const hasFragment = isNonStandaloneFragment(cleanT1) || isNonStandaloneFragment(cleanT2) || isNonStandaloneFragment(cleanT3);
            const notSingleLetter = !isStandaloneSingleLetterWord(cleanT1) && !isStandaloneSingleLetterWord(cleanT2) && !isStandaloneSingleLetterWord(cleanT3);

            if (isValidSyllable(mergedClean) && (hasFragment || notSingleLetter) && cleanT1.length <= 4 && cleanT2.length <= 4 && cleanT3.length <= 4) {
              let finalWord = mergedClean;
              if (cleanT1[0] && cleanT1[0] === cleanT1[0].toUpperCase()) {
                finalWord = finalWord.charAt(0).toUpperCase() + finalWord.slice(1);
              }
              outTokens.push(finalWord);
              i += 5;
              continue;
            }
          }
        }
      }

      // Check 2-Token lookahead (Token[i] + space + Token[i+2])
      if (i + 2 < tokens.length && /^\s+$/.test(tokens[i + 1])) {
        const t1 = tokens[i];
        const t2 = tokens[i + 2];

        // Guard against tokens containing digits, brackets, or punctuation
        if (!/[\d\[\]\(\)\{\}<>,.;:!?]/.test(t1) && !/[\d\[\]\(\)\{\}<>,.;:!?]/.test(t2)) {
          const cleanT1 = t1.trim();
          const cleanT2 = t2.trim();

          if (cleanT1.length > 0 && cleanT2.length > 0) {
            const mergedClean = (cleanT1 + cleanT2).toLowerCase().normalize('NFC');
            const t1IsFragment = isNonStandaloneFragment(cleanT1) || !isValidSyllable(cleanT1);
            const t2IsFragment = isNonStandaloneFragment(cleanT2) || !isValidSyllable(cleanT2);
            const neitherIsSingleLetter = !isStandaloneSingleLetterWord(cleanT1) && !isStandaloneSingleLetterWord(cleanT2);

            // Special legacy OCR handling: e.g. "ñời ñờ i" -> "đời đời"
            if (cleanT1.toLowerCase() === 'ñờ' && cleanT2.toLowerCase() === 'i') {
              outTokens.push(cleanT1[0] === cleanT1[0].toUpperCase() ? 'Đời' : 'đời');
              i += 3;
              continue;
            }

            if (isValidSyllable(mergedClean) && neitherIsSingleLetter && cleanT1.length <= 5 && cleanT2.length <= 5) {
              let finalWord = mergedClean;
              if (cleanT1[0] && cleanT1[0] === cleanT1[0].toUpperCase()) {
                finalWord = finalWord.charAt(0).toUpperCase() + finalWord.slice(1);
              }
              outTokens.push(finalWord);
              i += 3;
              continue;
            }
          }
        }
      }

      outTokens.push(tok);
      i++;
    }

    healedLines.push(outTokens.join(''));
  }

  return healedLines.join('\n');
}

/**
 * 7. Un-hyphenate Vietnamese Compound Words & Multi-part Names (with Military & Date Whitelist)
 */
export function normalizeHyphenatedVietnameseWords(text: string): string {
  if (!text) return '';

  // First: Strip translator tags & woodblock blanks BEFORE un-hyphenation
  let res = text
    .replace(/(?:-ND|\bND\b|\(BD:LML\)|\(BD:VSH\))/g, '')
    .replace(/_{2,}|-{3,}/g, '...');

  // Tokenize or replace hyphens while protecting whitelisted tokens
  const whitelistPlaceholders: Array<{ placeholder: string; original: string }> = [];
  let placeholderCounter = 0;

  for (const pattern of WHITELIST_HYPHEN_PATTERNS) {
    res = res.replace(pattern, (match) => {
      const ph = `__WL_HYPHEN_${placeholderCounter++}__`;
      whitelistPlaceholders.push({ placeholder: ph, original: match });
      return ph;
    });
  }

  // Globally un-hyphenate Vietnamese words using lookaround
  res = res.replace(/(?<=[\p{L}])[-–—]+(?=[\p{L}])/gu, ' ');

  // Restore whitelisted hyphen patterns
  for (const item of whitelistPlaceholders) {
    res = res.replace(item.placeholder, item.original);
  }

  return res;
}

/**
 * 8. Clean MediaWiki Remnants & Trailing Bibliography
 */
export function cleanMediaWikiRemnants(text: string): string {
  if (!text) return '';

  let res = text;

  // Broken piped links: [[17 tháng 9|17]] -> 17 tháng 9, [[Nguyễn Huệ|Quang Trung]] -> Nguyễn Huệ
  res = res.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, '$1');
  res = res.replace(/\[\[([^\]]+)\]\]/g, '$1');

  // Strip MediaWiki templates: {{...}}
  res = res.replace(/\{\{[^\{\}]*\}\}/g, '');

  // Strip trailing bibliography sections
  const bibPattern = /==\s*(?:Chú thích|Nguồn tham khảo|Tài liệu tham khảo|Liên kết ngoài|Đọc thêm|Xem thêm)\s*==[\s\S]*$/i;
  res = res.replace(bibPattern, '');

  return res.trim();
}

/**
 * 9. Unwrap Broken OCR Tables into Natural Continuous Prose
 */
export function unwrapBrokenOcrTables(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const resultLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Check if line is a broken OCR margin note / table fragment: |thư|Lạc cáo|||| or |Tức đất ba châu...|
    if (trimmed.startsWith('|') && (trimmed.endsWith('|') || trimmed.includes('||'))) {
      if (/^\|[\s\-:]+\|\s*$/.test(trimmed)) {
        continue;
      }
      const flattened = trimmed
        .replace(/\|+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (flattened.length > 0) {
        resultLines.push(flattened);
      }
    } else {
      resultLines.push(line);
    }
  }

  return resultLines.join('\n');
}

/**
 * 10. Merge Adjacent Broken H5 Headings
 */
export function mergeAdjacentSplitHeadings(text: string): string {
  if (!text) return '';

  return text.replace(
    /^(#####\s+[^\n]+)\n+(?:#####\s+)([\p{Ll}\(\[].*)$/gmu,
    '$1 $2'
  );
}

/**
 * 11. Normalize Piped Web Crawler Watermarks & Strip Running Watermarks
 */
export function normalizePipedWatermarks(text: string): string {
  if (!text) return '';

  let res = text;

  // Piped web crawler watermarks: [https://...|Uất] -> Uất, [http://...|Thần] -> Thần
  res = res.replace(/\[https?:\/\/[^\|\]]+\|([^\]]+)\]/gi, '$1');

  // Strip standalone running watermarks
  res = res.replace(/<u>\[?https?:\/\/[^\s\]]+\]?<\/u>\s*(?:Page\s*\d+)?/gi, '');

  return res;
}

/**
 * 12. Clean Woodblock Page Markers with Strict Mộc Bản Regex
 * Strictly preserves 924 Gregorian calendar years in brackets and bracketed editorial historical names.
 */
export function cleanWoodblockPageMarkers(text: string): string {
  if (!text) return '';

  // Strict Page Pattern Regex: matches [1a], [24b], **[18a]**, [tờ 8b], [tờ** **8b], **[tờ 8b]**
  const STRICT_MOC_BAN_REGEX = /(?:\*{0,2}\[\*{0,2}\s*tờ[\s*]*\d+\s*[ab]?\s*\*{0,2}\]\*{0,2}\.?|\*{0,2}\[\*{0,2}\s*\d+\s*[ab]\s*\*{0,2}\]\*{0,2}\.?)/gi;

  return text.replace(STRICT_MOC_BAN_REGEX, ' ');
}

/**
 * 13. Clean Footnotes, Superscripts & Annotations
 */
export function cleanFootnotesAndSuperscripts(text: string): string {
  if (!text) return '';

  let res = text;

  // Punctuation-adjacent superscript footnote numbers: Kinh Dịch¹ -> Kinh Dịch, không¹?". -> không?".
  res = res.replace(/([^\s\d])[\u00B9\u00B2\u00B3\u2070\u2074-\u2079]+/g, '$1');

  // Punctuation-adjacent bracket numbers (1-2 digits only): Kinh Dịch[1] -> Kinh Dịch
  res = res.replace(/([\p{L}.,?!])\[\d{1,2}\]/gu, '$1');

  // Strip Chinese characters annotations in lead paragraph: (chữ Hán: ...)
  res = res.replace(/\(\s*chữ\s+Hán\s*:[^\)]*\)/gi, '');

  // Strip publishing catalog tables: |Tựa sách:|...| and running headers: <u>\d*...</u>
  res = res.replace(/\|Tựa\s+sách:[^\|]*\|[^\|]*\|/gi, '');
  res = res.replace(/<u>\d*\s*[^<]*<\/u>/gi, '');

  return res;
}

/**
 * 14. Demote Dialogue Pseudo-Headings to Regular Paragraphs
 */
export function demoteDialoguePseudoHeadings(text: string): string {
  if (!text) return '';

  return text.replace(
    /^#####\s+(Sử\s+Trung\s+nói:|Thật\s+là:|Sư\s+nói:|Khắc\s+Chung\s+đáp:|Ô\s+Mã\s+Nhi\s+nói:|Lê\s+Văn\s+Hưu\s+nói:|Ngô\s+Sĩ\s+Liên\s+nói:)/gmu,
    '**$1**'
  );
}

/**
 * 15. Contextual Line & Section Filtering in Annual Wikipedia Files (1954.md, 1973.md)
 */
export function filterAnnualWikiNoise(text: string, filename?: string): string {
  if (!text) return '';
  if (!filename || !/19\d\d\.md$/i.test(filename)) {
    return text;
  }

  let res = text;

  // 1. Prune 100% of modern international award sections
  res = res.replace(/==\s*Giải(?:\s+thưởng)?\s+Nobel\s*==[\s\S]*?(?===|\n\n#|$)/gi, '');
  res = res.replace(/==\s*Trúng\s+cử\s*==[\s\S]*?(?===|\n\n#|$)/gi, '');

  // 2. Filter lines in == Sinh == and == Mất ==
  const lines = res.split('\n');
  const filteredLines: string[] = [];
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('==')) {
      currentSection = trimmed.toLowerCase();
      filteredLines.push(line);
      continue;
    }

    if (currentSection.includes('sinh') || currentSection.includes('mất')) {
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        const lower = trimmed.toLowerCase();
        const hasPosition = VIETNAMESE_NOTABLE_POSITIONS.some((pos) => lower.includes(pos));
        const hasViKeyword = lower.includes('việt nam') || lower.includes('hà nội') || lower.includes('sài gòn');
        const words = trimmed.replace(/^[*\-\s\d.,:()]+/, '').trim().split(/\s+/);
        const firstWord = words[0]?.toLowerCase() || '';
        const hasViSurname = VIETNAMESE_SURNAMES.has(firstWord);

        if (hasPosition || hasViKeyword || hasViSurname) {
          filteredLines.push(line);
        }
        continue;
      }
    }

    if (currentSection.includes('sự kiện')) {
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        const lower = trimmed.toLowerCase();
        const isViEvent =
          lower.includes('việt nam') ||
          lower.includes('điện biên phủ') ||
          lower.includes('genève') ||
          lower.includes('geneva') ||
          lower.includes('paris') ||
          lower.includes('hiệp định') ||
          lower.includes('đak pơ') ||
          lower.includes('đắk pơ') ||
          lower.includes('hà nội') ||
          lower.includes('sài gòn') ||
          lower.includes('đông dương') ||
          lower.includes('seato') ||
          lower.includes('lào') ||
          lower.includes('campuchia') ||
          lower.includes('quân đội') ||
          lower.includes('chiến dịch') ||
          lower.includes('đình chiến') ||
          lower.includes('ngừng bắn');

        const isNoise =
          lower.includes('oscar') ||
          lower.includes('doraemon') ||
          lower.includes('tai nạn máy bay tại nigeria') ||
          lower.includes('bầu cử liên bang thụy sĩ');

        if (isViEvent && !isNoise) {
          filteredLines.push(line);
        } else if (!isNoise && (lower.includes('thủ tướng') || lower.includes('chủ tịch') || lower.includes('tổng thống'))) {
          filteredLines.push(line);
        }
        continue;
      }
    }

    filteredLines.push(line);
  }

  return filteredLines.join('\n');
}

/**
 * Master Preprocess Document Pipeline
 */
export function preprocessCorpusDocument(
  rawText: string,
  options: PreprocessOptions = {}
): PreprocessResult {
  if (!rawText || typeof rawText !== 'string') {
    return {
      cleanedText: '',
      isQuarantineStub: true,
      wordCount: 0,
      qualityScore: 0,
    };
  }

  // 1. Encoding & Glyphs
  let text = normalizeEncodingAndGlyphs(rawText);

  // 2. Guarded Soft-Wrap Unwrapping
  text = unwrapGuardedSoftWraps(text);

  // 3. MediaWiki cleanup (if wiki)
  if (options.isWiki || options.filename?.endsWith('.md')) {
    text = cleanMediaWikiRemnants(text);
  }

  // 4. OCR Table unwrapping & Watermark cleanup
  text = unwrapBrokenOcrTables(text);
  text = normalizePipedWatermarks(text);

  // 5. Woodblock Page markers (Strict regex)
  text = cleanWoodblockPageMarkers(text);

  // 6. Footnotes, Superscripts & Dialogue Pseudo-Headings
  text = cleanFootnotesAndSuperscripts(text);
  text = demoteDialoguePseudoHeadings(text);
  text = mergeAdjacentSplitHeadings(text);

  // 7. Casing errors & Glued words
  text = fixInternalCasingErrors(text);
  text = separateGluedWordsAndNumbers(text);

  // 8. Syllable healing with 3-token lookahead lexicon
  text = healSplitSyllablesWithLexicon(text);

  // 9. Multi-part un-hyphenation (with whitelist)
  text = normalizeHyphenatedVietnameseWords(text);

  // 10. Annual wiki noise filtering
  text = filterAnnualWikiNoise(text, options.filename);

  // 11. Final punctuation spacing normalization
  text = normalizePunctuationSpacing(text).trim();

  // Calculate statistics
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  // Check if stub / bitmap quarantine candidate
  const isQuarantineStub =
    rawText.includes('document_type: "Bitmap Scanned Document') ||
    (wordCount < 250 && !options.isWiki);

  // Compute Cleanliness Quality Score (target >= 99.5%)
  const brokenOcrPipes = (text.match(/\|{2,}/g) || []).length;
  const rawMocBanLeft = (text.match(/\[tờ\s*\d+[ab]?\]/gi) || []).length;
  const legacyGlyphsLeft = (text.match(/[ñÑðÐ]/g) || []).length;

  let qualityScore = 100.0;
  qualityScore -= brokenOcrPipes * 0.5;
  qualityScore -= rawMocBanLeft * 0.5;
  qualityScore -= legacyGlyphsLeft * 1.0;
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    cleanedText: text,
    isQuarantineStub,
    wordCount,
    qualityScore,
    metadata: {
      is_quarantine_stub: isQuarantineStub,
      word_count: wordCount,
      cleaned_at: new Date().toISOString(),
    },
  };
}
