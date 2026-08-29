/**
 * Metadata Enricher Engine for Historical Text Chunks
 * Component 3 of Module 0 Data Preprocessing & Ingestion ETL
 */

import {
  SourceReliability,
  HISTORICAL_PERSON_DICTIONARY,
  HISTORICAL_LOCATION_DICTIONARY,
  VIETNAMESE_PROVINCES_AND_ADMIN_UNITS,
  findHistoricalEpoch,
  HISTORICAL_CHRONOLOGY,
} from '@chronoviet/shared-spec';

export interface EnrichedMetadata {
  title: string;
  sourceName?: string;
  dynasty?: string;
  epochIds?: string[];
  sourceReliability: SourceReliability;
  timeStart?: number;
  timeEnd?: number;
  keyFigures: string[];
  location?: string;
  pageNumber?: number;
  parentChunkId?: string;
}

const HISTORICAL_YEAR_REGEX = /(?:năm|vào năm|thời gian|thế kỷ|thế kỉ|tk)\s+(\d{1,4}|[IVXLCDM]+)(?:\s*(tcn|trước\s+công\s+nguyên|trước\s+cn))?\b/gi;
const SPECIFIC_YEAR_REGEX = /\b(\d{1,4})\s*(tcn|trước\s+công\s+nguyên|trước\s+cn)?\b/gi;

const ROMAN_CENTURY_MAP: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20, XXI: 21,
};

/**
 * Extracts start and end years from chunk text content (supporting BCE, 2-digit ancient years & centuries)
 */
export function extractTimeBounds(text: string): { timeStart?: number; timeEnd?: number } {
  if (!text || typeof text !== 'string') return {};
  const years: number[] = [];
  
  // 1. Extract explicitly prefixed years / centuries
  HISTORICAL_YEAR_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HISTORICAL_YEAR_REGEX.exec(text)) !== null) {
    const fullMatch = match[0].toLowerCase();
    const candidate = match[1];
    const isBCE = !!match[2] || fullMatch.includes('tcn') || fullMatch.includes('trước');
    const yr = parseInt(candidate, 10);

    if (!isNaN(yr) && yr > 0 && yr <= 2026) {
      years.push(isBCE ? -yr : yr);
    } else if (candidate) {
      const romanVal = ROMAN_CENTURY_MAP[candidate.toUpperCase()];
      if (romanVal) {
        years.push((romanVal - 1) * 100 + 1);
        years.push(romanVal * 100);
      }
    }
  }

  // 2. Extract standard 3-4 digit years or BCE years from general text
  SPECIFIC_YEAR_REGEX.lastIndex = 0;
  while ((match = SPECIFIC_YEAR_REGEX.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    const isBCE = !!match[2];
    if (!isNaN(num)) {
      if (isBCE && num > 0 && num <= 3000) {
        years.push(-num);
      } else if (num >= 800 && num <= 2026) {
        years.push(num);
      }
    }
  }

  if (years.length === 0) return {};
  years.sort((a, b) => a - b);
  return {
    timeStart: years[0],
    timeEnd: years[years.length - 1],
  };
}

/**
 * Detects Dynasty from document content using Timeline bounds & weighted keywords
 */
export function detectDynasty(text: string): string | undefined {
  if (!text || typeof text !== 'string') return undefined;
  const norm = text.toLowerCase();

  // Strategy A: Direct Dynasty Mention Matching with specific priorities (Unicode-aware word boundaries)
  const DYNASTY_PRIORITY_PATTERNS: Array<{ regex: RegExp; name: string }> = [
    { regex: /(?<![\p{L}\p{N}])(?:nhà tây sơn|triều tây sơn|thời tây sơn|quân tây sơn|quang trung|nguyễn huệ)(?![\p{L}\p{N}])/iu, name: 'Nhà Tây Sơn' },
    { regex: /(?<![\p{L}\p{N}])(?:nhà nguyễn|triều nguyễn|thời nguyễn|vua gia long|vua minh mạng|vua tự đức)(?![\p{L}\p{N}])/iu, name: 'Nhà Nguyễn' },
    { regex: /(?<![\p{L}\p{N}])(?:nhà lê sơ|triều lê sơ|thời lê sơ|vua lê thái tổ|vua lê thánh tông)(?![\p{L}\p{N}])/iu, name: 'Nhà Lê Sơ' },
    { regex: /(?<![\p{L}\p{N}])(?:lê trung hưng|chúa trịnh|chúa nguyễn|đàng trong|đàng ngoài)(?![\p{L}\p{N}])/iu, name: 'Lê Trung Hưng' },
    { regex: /(?<![\p{L}\p{N}])(?:nhà mạc|triều mạc|thời mạc|mạc đăng dung)(?![\p{L}\p{N}])/iu, name: 'Nhà Mạc' },
    { regex: /(?<![\p{L}\p{N}])(?:nhà hồ|triều hồ|thời hồ|hồ quý ly|hồ hán thương)(?![\p{L}\p{N}])/iu, name: 'Nhà Hồ' },
    { regex: /(?<![\p{L}\p{N}])(?:nhà trần|triều trần|thời trần|vua trần thái tông|trần hưng đạo|trần nhân tông)(?![\p{L}\p{N}])/iu, name: 'Nhà Trần' },
    { regex: /(?<![\p{L}\p{N}])(?:nhà lý|triều lý|thời lý|lý thái tổ|lý thường kiệt)(?![\p{L}\p{N}])/iu, name: 'Nhà Lý' },
    { regex: /(?<![\p{L}\p{N}])(?:tiền lê|nhà tiền lê|triều tiền lê|lê hoàn|lê đại hành)(?![\p{L}\p{N}])/iu, name: 'Nhà Tiền Lê' },
    { regex: /(?<![\p{L}\p{N}])(?:nhà đinh|triều đinh|đinh tiên hoàng|đinh bộ lĩnh)(?![\p{L}\p{N}])/iu, name: 'Nhà Đinh' },
    { regex: /(?<![\p{L}\p{N}])(?:nhà ngô|triều ngô|ngô quyền|tiền ngô vương)(?![\p{L}\p{N}])/iu, name: 'Nhà Ngô' },
    { regex: /(?<![\p{L}\p{N}])(?:tiền lý|nhà tiền lý|lý bí|lý nam đế|vạn xuân)(?![\p{L}\p{N}])/iu, name: 'Nhà Tiền Lý' },
    { regex: /(?<![\p{L}\p{N}])(?:trưng nữ vương|hai bà trưng|trưng trắc|trưng nhị)(?![\p{L}\p{N}])/iu, name: 'Trưng Nữ Vương' },
    { regex: /(?<![\p{L}\p{N}])(?:âu lạc|an dương vương|thục phán)(?![\p{L}\p{N}])/iu, name: 'Âu Lạc' },
    { regex: /(?<![\p{L}\p{N}])(?:văn lang|hùng vương|hồng bàng)(?![\p{L}\p{N}])/iu, name: 'Văn Lang' },
    { regex: /(?<![\p{L}\p{N}])(?:pháp thuộc|thực dân pháp|bảo hộ)(?![\p{L}\p{N}])/iu, name: 'Thời kỳ Pháp thuộc' },
    { regex: /(?<![\p{L}\p{N}])(?:bắc thuộc|đô hộ)(?![\p{L}\p{N}])/iu, name: 'Thời kỳ Bắc thuộc' },
    { regex: /(?<![\p{L}\p{N}])(?:kháng chiến chống pháp|kháng chiến chống mỹ|việt nam dân chủ cộng hòa)(?![\p{L}\p{N}])/iu, name: 'Thời kỳ Hiện đại' },
  ];

  for (const item of DYNASTY_PRIORITY_PATTERNS) {
    if (item.regex.test(norm)) {
      return item.name;
    }
  }

  // Strategy B: Infer from Temporal Bounds
  const bounds = extractTimeBounds(text);
  if (bounds.timeStart !== undefined) {
    const epoch = findHistoricalEpoch(bounds.timeStart);
    if (epoch) {
      return epoch.dynastyName;
    }
  }

  return undefined;
}

/**
 * Extracts key historical figures present in text using SSOT Dictionary
 */
export function extractKeyFigures(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const figures = new Set<string>();
  const textNorm = text.normalize('NFC');
  const textLower = textNorm.toLowerCase();

  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    const nameLower = person.canonicalName.toLowerCase();
    if (textLower.includes(nameLower)) {
      figures.add(person.canonicalName);
      continue;
    }
    for (const alias of person.aliases) {
      if (alias.length >= 3 && textLower.includes(alias.toLowerCase())) {
        figures.add(person.canonicalName);
        break;
      }
    }
  }

  return Array.from(figures);
}

/**
 * Extracts key historical locations present in text using SSOT Dictionaries
 */
export function extractLocation(text: string): string | undefined {
  if (!text || typeof text !== 'string') return undefined;
  const textNorm = text.normalize('NFC');
  const textLower = textNorm.toLowerCase();

  for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    const locLower = loc.canonicalName.toLowerCase();
    if (textLower.includes(locLower)) {
      return loc.canonicalName;
    }
    for (const alias of loc.aliases) {
      if (alias.length >= 3 && textLower.includes(alias.toLowerCase())) {
        return loc.canonicalName;
      }
    }
  }

  for (const prov of VIETNAMESE_PROVINCES_AND_ADMIN_UNITS) {
    if (prov.length >= 4 && textLower.includes(prov.toLowerCase())) {
      return prov;
    }
  }

  return undefined;
}

/**
 * Metadata Enricher: Combines document-level metadata with text-level auto-extracted metadata
 */
export function enrichChunkMetadata(
  text: string,
  docMetadata: {
    title: string;
    sourceName?: string;
    dynasty?: string;
    sourceReliability?: SourceReliability;
    pageNumber?: number;
    keyFigures?: string[];
    location?: string;
    timeStart?: number;
    timeEnd?: number;
    parentChunkId?: string;
  }
): EnrichedMetadata {
  const extractedBounds = extractTimeBounds(text);
  const detectedDynasty = docMetadata.dynasty || detectDynasty(text) || 'Chưa xác định';
  const extractedFigures = extractKeyFigures(text);
  const combinedFigures = Array.from(
    new Set([...(docMetadata.keyFigures || []), ...extractedFigures])
  );
  const detectedLocation = docMetadata.location || extractLocation(text);

  return {
    title: docMetadata.title,
    sourceName: docMetadata.sourceName || docMetadata.title,
    dynasty: detectedDynasty,
    sourceReliability: docMetadata.sourceReliability || 'LEVEL_1',
    timeStart: docMetadata.timeStart ?? extractedBounds.timeStart,
    timeEnd: docMetadata.timeEnd ?? extractedBounds.timeEnd,
    keyFigures: combinedFigures,
    location: detectedLocation,
    pageNumber: docMetadata.pageNumber,
    parentChunkId: docMetadata.parentChunkId,
  };
}

