/**
 * Question Entity Extraction & Keyword Parsing (Question NER)
 * Component of Chrono-RAG Runtime
 *
 * Characteristics:
 * - Powered by Stage 1 Pure TS Historical NER Engine (< 1ms execution, 0 LLM latency)
 * - Resolves canonical master entities and aliases deterministically
 * - Extracts temporal keywords and historical entities for hybrid graph retrieval
 */

import {
  resolveCanonicalEntity,
  resolveEntityAlias,
  isKnownMasterEntity,
  HISTORICAL_PERSON_DICTIONARY,
  MODERN_TECH_LEXICON,
  MYTHOLOGICAL_ENTITIES_LEXICON,
  MODERN_POLITICAL_LEGAL_LEXICON,
  removeVietnameseAccents,
} from '@chronoviet/shared-spec';
import { extractHistoricalCandidateSpans } from '@chronoviet/data-ingestion';

export interface ExtractedQueryInfo {
  entityIds: string[];
  entityNames: string[];
  keywords: string[];
  extractedYears: number[];
  temporalRange?: { start: number; end: number };
}

export interface HistoricalTemporalInfo {
  extractedYears: number[];
  temporalRange?: { start: number; end: number };
}

export interface HistoricalPremiseValidationResult {
  hasPremiseConflict: boolean;
  conflictReason?: string;
  suggestedRefutationTopic?: string;
  conflictType?: 'ANACHRONISTIC_WEAPONRY_TECH' | 'MYTHOLOGY_HISTORICAL_INCOMPATIBILITY' | 'CHRONOLOGY_MISMATCH';
}

const ROMAN_NUMERAL_MAP: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20, xxi: 21,
};

/**
 * Fast pure TypeScript historical temporal extractor (< 0.1ms)
 * Parses AD years, 2-digit "năm XX", BCE/TCN negative years, and Roman/Arabic centuries.
 */
export function extractHistoricalYears(queryText: string): HistoricalTemporalInfo {
  if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
    return { extractedYears: [] };
  }

  const years: number[] = [];
  let temporalRange: { start: number; end: number } | undefined;

  const normalized = queryText.toLowerCase();

  // 1. Parse Year Ranges (e.g. "1945-1954", "1407 - 1427")
  const rangeRegex = /\b(\d{3,4})\s*[-–—]\s*(\d{3,4})\b/g;
  let rangeMatch: RegExpExecArray | null;
  while ((rangeMatch = rangeRegex.exec(normalized)) !== null) {
    const y1 = parseInt(rangeMatch[1], 10);
    const y2 = parseInt(rangeMatch[2], 10);
    if (y1 >= 100 && y1 <= 2100 && y2 >= 100 && y2 <= 2100) {
      if (!years.includes(y1)) years.push(y1);
      if (!years.includes(y2)) years.push(y2);
      temporalRange = { start: Math.min(y1, y2), end: Math.max(y1, y2) };
    }
  }

  // 2. Parse BCE / TCN Years (e.g. "257 TCN", "257 trước CN", "năm 257 trước công nguyên")
  const bceRegex = /(?:năm\s+)?(\d{1,4})\s*(?:tcn|trước\s+công\s+nguyên|trước\s+cn)\b/gi;
  let bceMatch: RegExpExecArray | null;
  while ((bceMatch = bceRegex.exec(normalized)) !== null) {
    const rawVal = parseInt(bceMatch[1], 10);
    if (!isNaN(rawVal) && rawVal > 0) {
      const bceYear = -rawVal;
      if (!years.includes(bceYear)) {
        years.push(bceYear);
      }
    }
  }

  // 3. Parse Roman & Arabic Centuries (e.g. "thế kỷ XIII", "thế kỷ 13", "thế kỷ X", "thế kỷ thứ 10", "tk 13")
  const centuryRegex = /(?:thế\s+kỷ|thế\s+kỉ|tk)\s*(?:thứ\s+)?([ivxlcdm]+|\d{1,2})\b/gi;
  let centMatch: RegExpExecArray | null;
  while ((centMatch = centuryRegex.exec(normalized)) !== null) {
    const rawCent = centMatch[1].trim().toLowerCase();
    let centNum: number | undefined = ROMAN_NUMERAL_MAP[rawCent];
    if (!centNum && /^\d{1,2}$/.test(rawCent)) {
      centNum = parseInt(rawCent, 10);
    }
    if (centNum && centNum >= 1 && centNum <= 21) {
      const start = (centNum - 1) * 100 + 1;
      const end = centNum * 100;
      const median = (centNum - 1) * 100 + 50;
      if (!years.includes(median)) {
        years.push(median);
      }
      if (!temporalRange) {
        temporalRange = { start, end };
      }
    }
  }

  // 4. Parse 2-Digit Prefixed Years (e.g. "năm 40", "vào năm 99")
  const twoDigitYearRegex = /(?:vào\s+năm|năm)\s+(\d{1,2})\b(?!\s*(?:tcn|trước))/gi;
  let twoDigitMatch: RegExpExecArray | null;
  while ((twoDigitMatch = twoDigitYearRegex.exec(normalized)) !== null) {
    const val = parseInt(twoDigitMatch[1], 10);
    if (!isNaN(val) && val > 0 && val <= 99) {
      if (!years.includes(val)) {
        years.push(val);
      }
    }
  }

  // 5. Parse 3-4 Digit AD Years (e.g. "938", "1010", "1288", "1789", "1945", "1975")
  const adYearRegex = /\b(\d{3,4})\b/g;
  let adMatch: RegExpExecArray | null;
  while ((adMatch = adYearRegex.exec(normalized)) !== null) {
    const val = parseInt(adMatch[1], 10);
    if (val >= 100 && val <= 2100) {
      const matchIdx = adMatch.index;
      const afterText = normalized.slice(matchIdx + adMatch[0].length).trim();
      const beforeText = normalized.slice(0, matchIdx).trim();

      const isQuantityUnit = /^(?:vạn|người|quân|lính|chiến thuyền|thuyền|km|mét|m|ha|đồng|trang|câu|chữ|bài|phút|giờ|lần)\b/.test(afterText);
      const isDuration = /^năm\b/.test(afterText) && !/^(?:từ|đến|trong|vào)\s*$/.test(beforeText.slice(-6));
      const isCountPrefix = /(?:top|thứ|hạng|hơn|khoảng|gần|hàng)\s*$/.test(beforeText);
      const isBce = /^(?:tcn|trước\s+công\s+nguyên|trước\s+cn)\b/.test(afterText);

      if (!isQuantityUnit && !isDuration && !isBce && (!isCountPrefix || val > 500)) {
        if (!years.includes(val)) {
          years.push(val);
        }
      }
    }
  }

  return {
    extractedYears: years,
    temporalRange,
  };
}

export const QUESTION_STOPWORDS = new Set([
  'ai', 'gì', 'nào', 'đâu', 'khi', 'bao', 'năm', 'thế', 'sao', 'tại',
  'là', 'của', 'và', 'trong', 'với', 'ở', 'được', 'vào', 'có', 'đã', 'sẽ', 'đang',
  'như', 'thì', 'ra', 'lại', 'về', 'cho', 'này', 'đó', 'kia', 'hãy', 'kể',
  'biết', 'tóm', 'tắt', 'diễn', 'biến', 'nguyên', 'nhân', 'kết', 'quả',
  'ý', 'nghĩa', 'lịch', 'sử', 'trận', 'đánh', 'chiến', 'thắng',
  'do', 'nhà', 'nước', 'thuộc', 'thời', 'kỳ', 'bởi', 'vì', 'nên', 'mà',
  'các', 'những', 'rất', 'cũng', 'để', 'vẫn', 'từng', 'qua', 'lên', 'xuống',
  'nơi', 'sau', 'trước', 'tháng', 'ngày'
]);

export function extractQueryEntities(queryText: string): ExtractedQueryInfo {
  if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
    return { entityIds: [], entityNames: [], keywords: [], extractedYears: [] };
  }

  const entityIds: string[] = [];
  const entityNames: string[] = [];

  // 1. Stage 1 Pure TS Historical NER Extraction (< 1ms)
  const candidateSpans = extractHistoricalCandidateSpans(queryText);

  for (const span of candidateSpans) {
    let entityId: string = span.suggestedCanonicalId || `ent_${span.text}`;
    let entityName: string = span.text;

    const canonicalInfo = resolveCanonicalEntity(span.text);
    if (canonicalInfo && canonicalInfo.entityId) {
      entityId = canonicalInfo.entityId;
      entityName = canonicalInfo.canonicalName;
    }

    if (!entityIds.includes(entityId)) {
      entityIds.push(entityId);
      entityNames.push(entityName);
    }
  }

  // 2. Multi-Word Token Scanning via O(1) Fast Entity Map (sub-millisecond unaccented & alias resolution)
  const rawCleanTokens = queryText
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const maxWindow = Math.min(4, rawCleanTokens.length);
  for (let w = maxWindow; w >= 1; w--) {
    for (let i = 0; i <= rawCleanTokens.length - w; i++) {
      const phrase = rawCleanTokens.slice(i, i + w).join(' ');
      if (w === 1 && phrase.length < 3) continue;
      const resolved = resolveEntityAlias(phrase);
      if (resolved?.canonicalId && isKnownMasterEntity(resolved.canonicalId)) {
        if (!entityIds.includes(resolved.canonicalId)) {
          entityIds.push(resolved.canonicalId);
          entityNames.push(resolved.canonicalName);
        }
      }
    }
  }

  // 3. Keyword Extraction from tokens (filtering question stopwords)
  const tokens = queryText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !QUESTION_STOPWORDS.has(w));

  const keywords = Array.from(new Set(tokens));

  // 4. Temporal Extraction (< 0.1ms)
  const temporalInfo = extractHistoricalYears(queryText);

  return {
    entityIds,
    entityNames,
    keywords,
    extractedYears: temporalInfo.extractedYears,
    temporalRange: temporalInfo.temporalRange,
  };
}

/**
 * Deterministic Historical Premise Incompatibility & Adversarial Trap Validator (< 0.5ms)
 * Validates temporal consistency, technological anachronisms, and mythological-historical boundaries.
 */
export function validateQueryHistoricalPremises(
  queryText: string,
  extractedInfo?: ExtractedQueryInfo
): HistoricalPremiseValidationResult {
  if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
    return { hasPremiseConflict: false };
  }

  const info = extractedInfo || extractQueryEntities(queryText);
  const qLower = queryText.toLowerCase();
  const qUnaccented = removeVietnameseAccents(qLower);

  // Check 1: Mythological Entities paired with Modern Treaties/Conferences/Events
  for (const myth of MYTHOLOGICAL_ENTITIES_LEXICON) {
    const mythUnaccented = removeVietnameseAccents(myth);
    const mythPattern = new RegExp(`(?<![\\p{L}\\p{N}])${myth}(?![\\p{L}\\p{N}])`, 'iu');
    const mythUnaccentedPattern = new RegExp(`(?<![\\p{L}\\p{N}])${mythUnaccented}(?![\\p{L}\\p{N}])`, 'iu');
    if (mythPattern.test(qLower) || mythUnaccentedPattern.test(qUnaccented)) {
      for (const treaty of MODERN_POLITICAL_LEGAL_LEXICON) {
        const treatyUnaccented = removeVietnameseAccents(treaty);
        const treatyPattern = new RegExp(`(?<![\\p{L}\\p{N}])${treaty}(?![\\p{L}\\p{N}])`, 'iu');
        const treatyUnaccentedPattern = new RegExp(`(?<![\\p{L}\\p{N}])${treatyUnaccented}(?![\\p{L}\\p{N}])`, 'iu');
        if (treatyPattern.test(qLower) || treatyUnaccentedPattern.test(qUnaccented)) {
          const canonicalMyth = resolveCanonicalEntity(myth).canonicalName;
          return {
            hasPremiseConflict: true,
            conflictType: 'MYTHOLOGY_HISTORICAL_INCOMPATIBILITY',
            conflictReason: `Nhân vật thần thoại/truyền thuyết (${canonicalMyth}) không thể tham gia hoặc ký kết sự kiện lịch sử (${treaty}).`,
            suggestedRefutationTopic: `${canonicalMyth} là nhân vật thần thoại/truyền thuyết, không tham gia sự kiện lịch sử ${treaty}.`,
          };
        }
      }
    }
  }

  // Check 2: Anachronistic Technology / Modern Weaponry paired with Pre-modern historical entities
  let matchedTech: string | undefined;
  for (const tech of MODERN_TECH_LEXICON) {
    const techUnaccented = removeVietnameseAccents(tech);
    const techPattern = new RegExp(`(?<![\\p{L}\\p{N}])${tech}(?![\\p{L}\\p{N}])`, 'iu');
    const techUnaccentedPattern = new RegExp(`(?<![\\p{L}\\p{N}])${techUnaccented}(?![\\p{L}\\p{N}])`, 'iu');
    if (techPattern.test(qLower) || techUnaccentedPattern.test(qUnaccented)) {
      matchedTech = tech;
      break;
    }
  }

  if (matchedTech) {
    for (const entId of info.entityIds) {
      const person = HISTORICAL_PERSON_DICTIONARY[entId];
      if (person && person.timeRange && person.timeRange.end !== undefined && person.timeRange.end < 1850) {
        return {
          hasPremiseConflict: true,
          conflictType: 'ANACHRONISTIC_WEAPONRY_TECH',
          conflictReason: `Vũ khí/công nghệ hiện đại (${matchedTech}) không tồn tại trong thời kỳ của ${person.canonicalName} (${person.dynasty || 'cổ-trung đại'}).`,
          suggestedRefutationTopic: `Thời kỳ của ${person.canonicalName} chưa có ${matchedTech}.`,
        };
      }
    }

    // Check pre-modern battle names / centuries
    const preModernBattles = [
      'bạch đằng', 'chi lăng', 'xương giang', 'ngọc hồi', 'đống đa', 'như nguyệt', 'rạch gầm', 'xoài mút', 'cổ loa',
    ];
    for (const battle of preModernBattles) {
      if (qLower.includes(battle) || qUnaccented.includes(removeVietnameseAccents(battle))) {
        const maxYear = info.extractedYears.length > 0 ? Math.max(...info.extractedYears) : 0;
        if (maxYear < 1850) {
          return {
            hasPremiseConflict: true,
            conflictType: 'ANACHRONISTIC_WEAPONRY_TECH',
            conflictReason: `Vũ khí/công nghệ hiện đại (${matchedTech}) không thể xuất hiện trong trận ${battle}.`,
            suggestedRefutationTopic: `Trong trận đánh ${battle}, quân dân ta không sử dụng ${matchedTech}.`,
          };
        }
      }
    }
  }

  // Check 3: Severe Chronology Mismatch for Figures / Events
  // Whitelist comparative multi-entity queries (e.g. "So sánh Ngô Quyền năm 938 và Trần Hưng Đạo năm 1288")
  const isComparative = /\b(so sánh|khác nhau|đối chiếu|cả hai|so với|tương đồng|khác biệt)\b/i.test(qLower);
  if (!isComparative && info.extractedYears.length > 0) {
    for (const entId of info.entityIds) {
      const person = HISTORICAL_PERSON_DICTIONARY[entId];
      if (person && person.timeRange?.start !== undefined && person.timeRange?.end !== undefined) {
        for (const yr of info.extractedYears) {
          if (yr > 0 && (yr < person.timeRange.start - 60 || yr > person.timeRange.end + 60)) {
            if (Math.abs(yr - person.timeRange.start) > 100 && Math.abs(yr - person.timeRange.end) > 100) {
              return {
                hasPremiseConflict: true,
                conflictType: 'CHRONOLOGY_MISMATCH',
                conflictReason: `Năm ${yr} mâu thuẫn hoàn toàn với thời đại của ${person.canonicalName} (${person.timeRange.start}-${person.timeRange.end}, ${person.dynasty || ''}).`,
                suggestedRefutationTopic: `${person.canonicalName} không sống vào năm ${yr}.`,
              };
            }
          }
        }
      }
    }
  }

  return { hasPremiseConflict: false };
}
