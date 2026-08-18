/**
 * Metadata Enricher Engine for Historical Text Chunks
 * Component 3 of Module 0 Data Preprocessing & Ingestion ETL
 */

import { SourceReliability } from '@chronoviet/shared-spec';

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

const HISTORICAL_YEAR_REGEX = /\b(năm|vào năm|thời gian|thế kỷ)\s+(\d{3,4}|[IVXLCDM]+)\b/gi;
const SPECIFIC_YEAR_REGEX = /\b(1[0-9]{3}|20[0-2][0-6]|[9][0-9]{2}|[8][0-9]{2})\b/g;

const DYNASTY_KEYWORDS: Record<string, string> = {
  'tây sơn': 'Nhà Tây Sơn',
  'quang trung': 'Nhà Tây Sơn',
  'nguyễn huệ': 'Nhà Tây Sơn',
  'lê sơ': 'Nhà Lê',
  'lê trung hưng': 'Nhà Lê',
  'hậu lê': 'Nhà Lê',
  'nhà lê': 'Nhà Lê',
  'triều lê': 'Nhà Lê',
  'thời lê': 'Nhà Lê',
  'nhà nguyễn': 'Triều Nguyễn',
  'triều nguyễn': 'Triều Nguyễn',
  'thời nguyễn': 'Triều Nguyễn',
  'nhà trần': 'Nhà Trần',
  'triều trần': 'Nhà Trần',
  'thời trần': 'Nhà Trần',
  'nhà lý': 'Nhà Lý',
  'triều lý': 'Nhà Lý',
  'thời lý': 'Nhà Lý',
  'nhà ngô': 'Nhà Ngô',
  'triều ngô': 'Nhà Ngô',
  'thời ngô': 'Nhà Ngô',
  'nhà đinh': 'Nhà Đinh',
  'triều đinh': 'Nhà Đinh',
  'thời đinh': 'Nhà Đinh',
  'tiền lê': 'Nhà Tiền Lê',
  'nhà tiền lê': 'Nhà Tiền Lê',
  'tiền lý': 'Nhà Tiền Lý',
  'nhà tiền lý': 'Nhà Tiền Lý',
  'nhà mạc': 'Nhà Mạc',
  'triều mạc': 'Nhà Mạc',
  'thời mạc': 'Nhà Mạc',
  'nhà hồ': 'Nhà Hồ',
  'triều hồ': 'Nhà Hồ',
  'hồ quý ly': 'Nhà Hồ',
  'chúa nguyễn': 'Chúa Nguyễn',
  'đàng trong': 'Chúa Nguyễn',
  'chúa trịnh': 'Chúa Trịnh',
  'đàng ngoài': 'Chúa Trịnh',
  'pháp thuộc': 'Thời kỳ Pháp thuộc',
  'thời kỳ pháp thuộc': 'Thời kỳ Pháp thuộc',
  'bắc thuộc': 'Thời kỳ Bắc thuộc',
  'thời kỳ bắc thuộc': 'Thời kỳ Bắc thuộc',
  'kháng chiến chống pháp': 'Thời kỳ Hiện đại',
  'kháng chiến chống mỹ': 'Thời kỳ Hiện đại',
  'việt nam dân chủ cộng hòa': 'Thời kỳ Hiện đại',
  'văn hóa đông sơn': 'Thời kỳ Cổ đại',
  'âu lạc': 'Thời kỳ Cổ đại',
  'văn lang': 'Thời kỳ Cổ đại',
  'hùng vương': 'Thời kỳ Cổ đại',
  'an dương vương': 'Thời kỳ Cổ đại',
  'hồng bàng': 'Thời kỳ Cổ đại',
};

const HISTORICAL_FIGURES_DICTIONARY = [
  'Trần Hưng Đạo',
  'Trần Quốc Tuấn',
  'Hưng Đạo Đại Vương',
  'Ngô Quyền',
  'Lê Lợi',
  'Lê Thái Tổ',
  'Nguyễn Trãi',
  'Nguyễn Huệ',
  'Quang Trung',
  'Hồ Thơm',
  'Bắc Bình Vương',
  'Lý Thái Tổ',
  'Lý Công Uẩn',
  'Lý Thường Kiệt',
  'Đinh Tiên Hoàng',
  'Đinh Bộ Lĩnh',
  'Lê Hoàn',
  'Lê Đại Hành',
  'Trần Nhân Tông',
  'Trần Thánh Tông',
  'Trần Cảnh',
  'Trần Thủ Độ',
  'Võ Nguyên Giáp',
  'Hồ Chí Minh',
];

const HISTORICAL_LOCATIONS_DICTIONARY = [
  'Thăng Long',
  'Đông Quan',
  'Đông Kinh',
  'Hà Nội',
  'Bạch Đằng',
  'Sông Bạch Đằng',
  'Vạn Kiếp',
  'Chi Lăng',
  'Ngọc Hồi',
  'Đống Đa',
  'Lệ Chi Viên',
  'Hoa Lư',
  'Phú Xuân',
  'Thuận Hóa',
  'Trường Yên',
  'Đại La',
  'Cổ Loa',
  'Trống Đồng Ngọc Lũ',
  'Ngọc Lũ',
  'Hàm Tử',
  'Tây Kết',
  'Chương Dương',
];

const ROMAN_CENTURY_MAP: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20, XXI: 21,
};

/**
 * Extracts start and end years from chunk text content
 */
export function extractTimeBounds(text: string): { timeStart?: number; timeEnd?: number } {
  const years: number[] = [];
  
  // Extract specific 3-4 digit years
  const yearMatches = text.match(SPECIFIC_YEAR_REGEX);
  if (yearMatches) {
    for (const y of yearMatches) {
      const yr = parseInt(y, 10);
      if (yr >= 100 && yr <= 2026) {
        years.push(yr);
      }
    }
  }

  // Extract from explicit phrases (years & Roman numeral centuries)
  HISTORICAL_YEAR_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HISTORICAL_YEAR_REGEX.exec(text)) !== null) {
    const keyword = match[1]?.toLowerCase();
    const candidate = match[2];
    const yr = parseInt(candidate, 10);

    if (!isNaN(yr) && yr >= 100 && yr <= 2026) {
      years.push(yr);
    } else if (keyword && (keyword.includes('thế kỷ') || keyword.includes('thế kỉ'))) {
      const romanVal = ROMAN_CENTURY_MAP[candidate.toUpperCase()];
      if (romanVal) {
        years.push((romanVal - 1) * 100 + 1);
        years.push(romanVal * 100);
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
 * Detects Dynasty from document content
 */
export function detectDynasty(text: string): string | undefined {
  const norm = text.toLowerCase();
  for (const [key, dynastyName] of Object.entries(DYNASTY_KEYWORDS)) {
    if (norm.includes(key)) {
      return dynastyName;
    }
  }
  return undefined;
}

/**
 * Extracts key historical figures present in text
 */
export function extractKeyFigures(text: string): string[] {
  const figures = new Set<string>();
  for (const fig of HISTORICAL_FIGURES_DICTIONARY) {
    if (text.includes(fig)) {
      figures.add(fig);
    }
  }
  return Array.from(figures);
}

/**
 * Extracts key historical locations present in text
 */
export function extractLocation(text: string): string | undefined {
  for (const loc of HISTORICAL_LOCATIONS_DICTIONARY) {
    if (text.includes(loc)) {
      return loc;
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
