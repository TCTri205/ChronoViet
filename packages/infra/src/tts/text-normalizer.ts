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

  // 1. Expand Historical & Administrative Abbreviations (O(1) Token Replacement)
  text = text.replace(ABBREVIATIONS_REGEX, (m) => ABBREVIATIONS_MAP[m] || ABBREVIATIONS_MAP[m.replace(/\s+/g, ' ')] || m);

  // 2. Expand Centuries with Roman Numerals (e.g. "thế kỷ XIII" -> "thế kỷ mười ba")
  text = text.replace(/\b(thế\s+kỷ|thế\s+kỉ|Thế\s+kỷ|Thế\s+kỉ)\s+([IVXLCDM]+)\b/g, (_, prefix, roman) => {
    const upper = roman.toUpperCase();
    const spoken = ROMAN_CENTURY_MAP[upper];
    return spoken ? `${prefix} ${spoken}` : `${prefix} ${roman}`;
  });

  // 3. Expand Centuries with Digits (e.g. "thế kỷ 13" -> "thế kỷ mười ba")
  text = text.replace(/\b(thế\s+kỷ|thế\s+kỉ|Thế\s+kỷ|Thế\s+kỉ)\s+(\d+)\b/g, (_, prefix, digits) => {
    const num = parseInt(digits, 10);
    return `${prefix} ${numberToVietnameseWords(num)}`;
  });

  // 4. Expand Specific Historical Years (e.g. "năm 1789" -> "năm một nghìn bảy trăm tám mươi chín")
  text = text.replace(/\b(năm|năm\s+đoán|Năm|Năm\s+đoán)\s+(\d{1,4})\b/g, (_, prefix, yearDigits) => {
    const year = parseInt(yearDigits, 10);
    return `${prefix} ${numberToVietnameseWords(year)}`;
  });

  // 5. Expand Standalone Numbers
  text = text.replace(/(?<!\w)(\d+)(?!\w)/g, (match) => {
    const num = parseInt(match, 10);
    if (isNaN(num)) return match;
    return numberToVietnameseWords(num);
  });

  // 6. Clean multiple spaces
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
