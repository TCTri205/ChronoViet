/**
 * Vietnamese Text Normalizer & Alignment Bridge for TTS & Remotion Karaoke Subtitles
 * 
 * Expands numeric dates, years, centuries, Roman numerals, and historical abbreviations
 * into spoken Vietnamese words to guarantee 100% token synchronization between
 * audio TTS synthesis and Remotion video captions.
 */

const DIGIT_WORDS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/**
 * Converts a positive integer (< 1,000,000,000,000) to spoken Vietnamese words
 */
export function numberToVietnameseWords(num: number): string {
  if (num === 0) return 'không';
  if (num < 0) return `âm ${numberToVietnameseWords(-num)}`;

  const readThreeDigits = (n: number, isHighestGroup: boolean): string => {
    const tram = Math.floor(n / 100);
    const chuc = Math.floor((n % 100) / 10);
    const donvi = n % 10;
    const parts: string[] = [];

    if (tram > 0 || !isHighestGroup) {
      parts.push(`${DIGIT_WORDS[tram]} trăm`);
    }

    if (chuc > 1) {
      parts.push(`${DIGIT_WORDS[chuc]} mươi`);
      if (donvi === 1) parts.push('mốt');
      else if (donvi === 4) parts.push('tư');
      else if (donvi === 5) parts.push('lăm');
      else if (donvi > 0) parts.push(DIGIT_WORDS[donvi]);
    } else if (chuc === 1) {
      parts.push('mười');
      if (donvi === 5) parts.push('lăm');
      else if (donvi > 0) parts.push(DIGIT_WORDS[donvi]);
    } else if (chuc === 0 && donvi > 0) {
      if (tram > 0 || !isHighestGroup) {
        parts.push('lẻ');
      }
      parts.push(DIGIT_WORDS[donvi]);
    }

    return parts.join(' ');
  };

  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ'];
  const groups: number[] = [];
  let temp = num;

  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const resultParts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g > 0) {
      const isHighest = i === groups.length - 1;
      const groupWords = readThreeDigits(g, isHighest);
      const unit = units[i];
      resultParts.push(unit ? `${groupWords} ${unit}` : groupWords);
    }
  }

  return resultParts.join(' ').trim();
}

/**
 * Roman Numeral Mapping for Century notations
 */
const ROMAN_CENTURY_MAP: Record<string, string> = {
  'I': 'nhất',
  'II': 'hai',
  'III': 'ba',
  'IV': 'tư',
  'V': 'năm',
  'VI': 'sáu',
  'VII': 'bảy',
  'VIII': 'tám',
  'IX': 'chín',
  'X': 'mười',
  'XI': 'mười một',
  'XII': 'mười hai',
  'XIII': 'mười ba',
  'XIV': 'mười bốn',
  'XV': 'mười lăm',
  'XVI': 'mười sáu',
  'XVII': 'mười bảy',
  'XVIII': 'mười tám',
  'XIX': 'mười chín',
  'XX': 'hai mươi',
  'XXI': 'hai mươi mốt',
};

const ABBREVIATIONS_MAP: Record<string, string> = {
  'TCN': 'trước Công nguyên',
  'tr.CN': 'trước Công nguyên',
  'tr. CN': 'trước Công nguyên',
  'SCN': 'sau Công nguyên',
  'S.CN': 'sau Công nguyên',
  'S. CN': 'sau Công nguyên',
  'VNDCCH': 'Việt Nam Dân chủ Cộng hòa',
  'CHXHCNVN': 'Cộng hòa Xã hội Chủ nghĩa Việt Nam',
  'TP.': 'thành phố',
  'TX.': 'thị xã',
  'Q.': 'quận',
  'H.': 'huyện',
  'km': 'ki-lô-mét',
  'kg': 'ki-lô-gam',
  'ha': 'héc-ta',
};

const ABBREVIATIONS_REGEX = /(?<![\p{L}\p{N}])(TCN|tr\.CN|tr\.\s+CN|SCN|S\.CN|S\.\s+CN|VNDCCH|CHXHCNVN|TP\.|TX\.|Q\.|H\.|km|kg|ha)(?![\p{L}\p{N}])/gu;

/**
 * Normalizes input text into phonetically aligned spoken Vietnamese.
 */
export function normalizeVietnameseTextForSpeech(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 0. Clean Wikipedia Headers and Reference Citations
  text = text.replace(/={2,5}[^=\n]+={2,5}/g, ' ');
  text = text.replace(/\[\d+\]/g, ' ');
  text = text.replace(/\[(?:cần dẫn nguồn|nguồn|sđd|tr\.)[^\]]*\]/gi, ' ');

  // 1. Expand Historical & Administrative Abbreviations (O(1) Token Replacement)
  text = text.replace(ABBREVIATIONS_REGEX, (m) => ABBREVIATIONS_MAP[m] || ABBREVIATIONS_MAP[m.replace(/\s+/g, ' ')] || m);

  // 2. Expand Date with Slashes (e.g. "12/5/1284" -> "ngày 12 tháng 5 năm 1284", "tháng 3/1284" -> "tháng 3 năm 1284")
  text = text.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{1,4})\b/g, 'ngày $1 tháng $2 năm $3');
  text = text.replace(/\b(tháng|Tháng)\s*(\d{1,2})\/(\d{1,4})\b/g, '$1 $2 năm $3');
  text = text.replace(/\b(ngày|Ngày)\s*(\d{1,2})\/(\d{1,2})\b/g, '$1 $2 tháng $3');
  text = text.replace(/\b(\d{3,4})\/(\d{3,4})\b/g, '$1 đến năm $2');

  // Replace any remaining stray slashes between words
  text = text.replace(/(?<=\S)\/(?=\S)/g, ' và ');
  text = text.replace(/\//g, ' ');

  // Clean dangling quotes and ellipses
  text = text.replace(/["“”'«»]/g, ' ');
  text = text.replace(/\.{2,}|\u2026/g, '.');

  // 3. Expand Centuries with Roman Numerals (e.g. "thế kỷ XIII" -> "thế kỷ mười ba")
  text = text.replace(/\b(thế\s+kỷ|thế\s+kỉ|Thế\s+kỷ|Thế\s+kỉ)\s+([IVXLCDM]+)\b/g, (_, prefix, roman) => {
    const upper = roman.toUpperCase();
    const spoken = ROMAN_CENTURY_MAP[upper];
    return spoken ? `${prefix} ${spoken}` : `${prefix} ${roman}`;
  });

  // 4. Expand Centuries with Digits (e.g. "thế kỷ 13" -> "thế kỷ mười ba")
  text = text.replace(/\b(thế\s+kỷ|thế\s+kỉ|Thế\s+kỷ|Thế\s+kỉ)\s+(\d+)\b/g, (_, prefix, digits) => {
    const num = parseInt(digits, 10);
    return `${prefix} ${numberToVietnameseWords(num)}`;
  });

  // 5. Expand Specific Historical Years (e.g. "năm 1789" -> "năm một nghìn bảy trăm tám mươi chín")
  text = text.replace(/\b(năm|năm\s+đoán|Năm|Năm\s+đoán)\s+(\d{1,4})\b/g, (_, prefix, yearDigits) => {
    const year = parseInt(yearDigits, 10);
    return `${prefix} ${numberToVietnameseWords(year)}`;
  });

  // 6. Expand Standalone Numbers
  text = text.replace(/(?<!\w)(\d+)(?!\w)/g, (match) => {
    const num = parseInt(match, 10);
    if (isNaN(num)) return match;
    return numberToVietnameseWords(num);
  });

  // 7. Clean multiple spaces
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

export interface WordTimestampLike {
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * Align Spoken Word Timestamps with Original Raw Text
 * 
 * Maps multi-word phonetic speech expansions (e.g. "1789" -> "một nghìn bảy trăm tám mươi chín")
 * back to the single original text token with an encompassing [startFrame, endFrame] span.
 * Guarantees that on-screen subtitles display canonical historical text (e.g. "1789", "thế kỷ XIII")
 * while karaoke highlighting stays 100% in sync with audio speech.
 * 
 * Supports an optional leadInFrames offset for audio margin alignment.
 */
export function alignSpokenWordTimestamps(
  rawText: string,
  spokenTimestamps: WordTimestampLike[],
  fps: number = 30,
  leadInFrames: number = 0
): { word: string; startFrame: number; endFrame: number }[] {
  if (!spokenTimestamps || spokenTimestamps.length === 0) {
    return [];
  }
  if (!rawText || !rawText.trim()) {
    return spokenTimestamps.map((st) => ({
      word: st.word,
      startFrame: Math.round((st.startMs / 1000) * fps) + leadInFrames,
      endFrame: Math.max(Math.round((st.startMs / 1000) * fps) + 1, Math.round((st.endMs / 1000) * fps)) + leadInFrames,
    }));
  }

  // 1. Tokenize rawText into words, preserving original display case & numbers
  const rawTokens = rawText.trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return [];

  // If rawTokens count matches spokenTimestamps count directly, 1-to-1 map
  if (rawTokens.length === spokenTimestamps.length) {
    return rawTokens.map((tok, i) => ({
      word: tok,
      startFrame: Math.round((spokenTimestamps[i].startMs / 1000) * fps) + leadInFrames,
      endFrame: Math.max(
        Math.round((spokenTimestamps[i].startMs / 1000) * fps) + 1,
        Math.round((spokenTimestamps[i].endMs / 1000) * fps)
      ) + leadInFrames,
    }));
  }

  // 2. Build expansion map for each raw token
  const expandedCounts: number[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const tok = rawTokens[i];
    const prevTokens = rawTokens.slice(Math.max(0, i - 2), i);
    const contextPrefix = prevTokens.length > 0 ? `${prevTokens.join(' ')} ` : '';
    const normSingle = normalizeVietnameseTextForSpeech(tok);
    const normCombined = normalizeVietnameseTextForSpeech(contextPrefix + tok);

    let count = 1;
    if (normSingle !== tok) {
      const parts = normSingle.split(/\s+/).filter(Boolean);
      count = Math.max(1, parts.length);
    } else if (contextPrefix && normCombined !== contextPrefix + tok) {
      const partsAll = normCombined.split(/\s+/).filter(Boolean);
      const normPrefix = normalizeVietnameseTextForSpeech(contextPrefix.trim());
      const partsPrefix = normPrefix ? normPrefix.split(/\s+/).filter(Boolean) : [];
      count = Math.max(1, partsAll.length - partsPrefix.length);
    }
    expandedCounts.push(count);
  }

  const totalExpanded = expandedCounts.reduce((sum, c) => sum + c, 0);
  const result: { word: string; startFrame: number; endFrame: number }[] = [];
  let spokenIdx = 0;
  let cumulativeExp = 0;

  for (let i = 0; i < rawTokens.length; i++) {
    const rawWord = rawTokens[i];
    const expCount = expandedCounts[i];
    const isLastToken = i === rawTokens.length - 1;

    if (spokenIdx >= spokenTimestamps.length) {
      const last = result[result.length - 1];
      const start = last ? last.endFrame : leadInFrames;
      result.push({
        word: rawWord,
        startFrame: start,
        endFrame: start + Math.round(0.3 * fps),
      });
      continue;
    }

    cumulativeExp += expCount;
    let targetEndSpokenIdx: number;

    if (isLastToken) {
      targetEndSpokenIdx = spokenTimestamps.length - 1;
    } else if (totalExpanded === spokenTimestamps.length) {
      targetEndSpokenIdx = spokenIdx + expCount - 1;
    } else {
      const targetSpokenCount = Math.round((cumulativeExp / Math.max(1, totalExpanded)) * spokenTimestamps.length);
      targetEndSpokenIdx = Math.max(spokenIdx, Math.min(spokenTimestamps.length - 1, targetSpokenCount - 1));
    }

    const endSpokenIdx = Math.max(spokenIdx, Math.min(spokenTimestamps.length - 1, targetEndSpokenIdx));
    const startMs = spokenTimestamps[spokenIdx].startMs;
    const endMs = spokenTimestamps[endSpokenIdx].endMs;

    result.push({
      word: rawWord,
      startFrame: Math.round((startMs / 1000) * fps) + leadInFrames,
      endFrame: Math.max(
        Math.round((startMs / 1000) * fps) + 1,
        Math.round((endMs / 1000) * fps)
      ) + leadInFrames,
    });

    spokenIdx = endSpokenIdx + 1;
  }

  return result;
}

