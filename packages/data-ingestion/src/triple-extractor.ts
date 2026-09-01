/**
 * ChronoViet - 2-Stage Knowledge Graph Triple Extractor (Subject -> Relation -> Object)
 * Component 2 of Module 0 Data Preprocessing & Ingestion ETL Engine
 *
 * Characteristics:
 * - 2-Stage Pipeline:
 *   Stage 1: Pure TS Vietnamese Historical NER Candidate Extractor (< 1ms)
 *   Stage 2: Lightweight LLM (Qwen3.5-4B-Instruct Q4_K_M on Port 8094) with Disk Cache & Fallback Engine
 * - Semantic Action Verbs requirement for LED_BY and MENTIONED_IN (eliminates blind 200-char proximity heuristic)
 * - Complete Chronicler Commentary Isolation (2,360+ commentary blocks across Toàn Thư, Cương Mục, Tiêu Án, Chánh Biên)
 * - Strict Canonical Directionality Validation Matrix
 * - 3-Tier Reign Era, Can Chi & Sliding Year Anchor Disambiguation
 * - Constrained Historical Relation Taxonomy (8 Canonical Types)
 */

import {
  resolveCanonicalEntity,
  HistoricalRelationType,
  CandidateEntitySpan,
  getCanonicalEntityIdPrefix,
  inferEntityTypeFromName,
  REIGN_ERA_DICTIONARY,
  CAN_CHI_SET,
  DEITY_TITLE_MAPPINGS,
  HISTORICAL_LOCATION_MAPPINGS,
  findHistoricalEpoch,
  HISTORICAL_PERSON_DICTIONARY,
  isKnownMasterEntity,
} from '@chronoviet/shared-spec';
import {
  envConfig,
  generateLLMCompletion,
  logFallbackAlert,
  createLogger,
  formatConciseError,
} from '@chronoviet/infra';
import {
  extractHistoricalCandidateSpans,
  slugify,
  buildCanonicalId,
  isValidCandidateSpan,
  sanitizeMarkdownFormatting,
} from './text/vietnamese-ner.js';
import { extractionCache } from './cache/extraction-cache.js';

export function isValidEntityName(name: string): boolean {
  return isValidCandidateSpan(name);
}

const log = createLogger({ service: 'data-ingestion' });

export interface ExtractedTriple {
  sourceEntityId: string;
  sourceEntityName: string;
  relationType: HistoricalRelationType;
  targetEntityId: string;
  targetEntityName: string;
  confidence: number;
}

export interface DetailedExtractionResult {
  triples: ExtractedTriple[];
  candidateSpans?: CandidateEntitySpan[];
  provider?: string;
  targetProvider?: string;
  targetId?: string;
  model?: string;
  strategy: 'ensemble_ai' | 'regex_only' | 'rule_based_fallback';
  durationMs: number;
  llmError?: string;
  cached?: boolean;
}

export interface ExtractionOptions {
  strict?: boolean;
  allowFallback?: boolean;
  timeoutMs?: number;
  regexOnly?: boolean;
  stage?: 'vector' | 'graph' | 'all';
  correlationId?: string;
  headingAnchorYear?: number;
  chunkId?: string;
  skipCache?: boolean;
  skipMvRefresh?: boolean;
}

let warnedLlmOffline = false;

export const VALID_RELATIONS = new Set<HistoricalRelationType>([
  'PART_OF',
  'LED_BY',
  'HAPPENED_IN',
  'HAPPENED_AT',
  'SAME_AS_LOCATION',
  'ALIAS_OF',
  'ROYAL_LINEAGE',
  'MENTIONED_IN',
]);

/**
 * Patterns matching all 2,360+ chronicler commentary styles in historical corpora
 */
export const HISTORIAN_COMMENTARY_PATTERNS = [
  /\*\*Lời cẩn án\s*[-–—:]/i,
  /\*\*Lời chua\s*[-–—:]/i,
  /\*\*Lời phê\s*[-–—:]/i,
  /\*\*Lời bàn\s*[-–—:]/i,
  /Sử thần Ngô Sĩ Liên nói:/i,
  /Lê Văn Hưu nói:/i,
  /Phan Phu Tiên nói:/i,
  /Sử thần Hà Sĩ Dương nói:/i,
  /Sử thần Vũ Quỳnh nói:/i,
  /Sử thần bàn rằng:/i,
  /Lời thông luận:/i,
  /Xét sử cũ:/i,
  /Lời Phụ Chú:/i,
];

export function isHistorianCommentaryText(text: string): boolean {
  return HISTORIAN_COMMENTARY_PATTERNS.some((p) => p.test(text));
}

/**
 * Action verbs required for LED_BY relations
 */
const ACTION_VERBS_LED_BY = /\b(lãnh đạo|chỉ huy|thống lĩnh|cầm quân|tướng quân|chủ tướng|thống suất|đốc suất|soạn thảo|khởi xướng|dấy binh|đứng đầu|cầm đầu|tiên phong|chủ trì|chủ mưu|mở khoa thi|khởi công|chỉ đạo)\b/i;

/**
 * Action verbs required for MENTIONED_IN relations
 */
const ACTION_VERBS_MENTIONED_IN = /\b(chép|ghi|viết|biên soạn|soạn thảo|san định|làm thành|tổng kết|ban hành|phê duyệt|theo|trong|trích|bàn rằng|luận rằng|sử chép|cương mục|toàn thư|sách|văn bia|chiếu|hịch|cáo|bài thơ|luật|luật lệ)\b/i;

/**
 * Vietnamese historical entity prefixes to strip during mention normalization
 */
const VI_PREFIX_STRIP_REGEX = /^(?:ở\s+tại|tại|thuộc|nay\s+thuộc|nay\s+là|vốn\s+là|quê\s+ở|vùng|xứ|đất|nước|nhà|triều|thời\s+kỳ|thời|vương\s+triều|bài\s+thơ|bộ\s+luật|sử\s+sách|tác\s+phẩm)\s+/i;

/**
 * Foreign Invading Dynasties, Commanders and Military Forces
 */
export const FOREIGN_DYNASTIES_SET = new Set([
  'dynasty_nam_han',
  'dynasty_tong',
  'dynasty_nha_tong',
  'dynasty_minh',
  'dynasty_nha_minh',
  'dynasty_thanh',
  'dynasty_nha_thanh',
  'dynasty_nguyen_mong',
  'dynasty_quan_nguyen',
  'dynasty_xiem_la',
  'dynasty_dong_han',
  'dynasty_nha_dong_han',
  'dynasty_dong_ngo',
  'dynasty_trieu_tien',
  'dynasty_nha_duong',
  'dynasty_trieu_da',
  'dynasty_nha_trieu',
  'dynasty_bac_thuoc',
  'dynasty_thoi_ky_bac_thuoc',
  'dynasty_phap_thuoc',
  'epoch_bac_thuoc_1',
  'epoch_bac_thuoc_2',
  'epoch_bac_thuoc_3',
]);

export const FOREIGN_COMMANDERS_SET = new Set([
  'person_ton_si_nghi',
  'person_thoat_hoan',
  'person_o_ma_nhi',
  'person_lieu_thang',
  'person_truong_phu',
  'person_quach_quy',
  'person_trieu_da',
  'person_to_dinh',
  'person_ma_vien',
  'person_sam_nghi_dong',
  'person_nguyen_ham',
  'person_sai_phu',
  'person_luu_hoang_thao',
  'person_hoang_thao',
  'person_toa_do',
  'person_van_mang',
  'person_trieu_tiet',
  'person_luc_khanh',
  'person_tich_quang',
]);

export const FOREIGN_INVADING_FORCES_SET = new Set([
  'org_quan_thanh',
  'org_quan_nha_thanh',
  'org_quan_man_thanh',
  'org_quan_xuan_thanh',
  'org_quan_minh',
  'org_quan_nha_minh',
  'org_quan_nguyen_mong',
  'org_quan_mong_co',
  'org_quan_nguyen',
  'org_quan_nam_han',
  'org_quan_dong_han',
  'org_quan_dong_ngo',
  'org_quan_nha_duong',
  'org_quan_tong',
  'org_quan_nha_tong',
  'org_quan_phap',
  'org_quan_my',
  'org_quan_xiem',
  'org_quan_trieu_da',
  'org_quan_an',
  'org_quan_sam_nghi_dong',
  'org_quan_ton_si_nghi',
  'org_quan_o_ma_nhi',
  'org_quan_thoat_hoan',
  'org_quan_lieu_thang',
  'org_quan_to_dinh',
  'org_quan_ma_vien',
]);

export function isForeignInvadingForce(id: string): boolean {
  if (!id) return false;
  const lower = id.toLowerCase();
  if (FOREIGN_INVADING_FORCES_SET.has(lower)) return true;
  if (
    lower.startsWith('org_quan_thanh') ||
    lower.startsWith('org_quan_man_thanh') ||
    lower.startsWith('org_quan_minh') ||
    lower.startsWith('org_quan_mong') ||
    lower.startsWith('org_quan_nguyen_mong') ||
    lower.startsWith('org_quan_nam_han') ||
    lower.startsWith('org_quan_dong_han') ||
    lower.startsWith('org_quan_tong') ||
    lower.startsWith('org_quan_xiem') ||
    lower.startsWith('org_quan_phap') ||
    lower.startsWith('org_quan_my') ||
    lower.startsWith('org_quan_nha_') ||
    lower.startsWith('org_giac_') ||
    lower.startsWith('org_quan_xam_luoc')
  ) {
    return true;
  }
  return false;
}

/**
 * Generic Vietnamese historical honorifics and non-entity nouns
 */
const GENERIC_TITLES_SET = new Set([
  'tiết độ sứ', 'tướng quân', 'chủ tướng', 'thống lĩnh', 'đốc suất',
  'thái sư', 'thái úy', 'vua', 'hoàng đế', 'thái thượng hoàng',
  'quan', 'quân lính', 'giặc', 'sứ quân', 'người', 'ông', 'bà'
]);

/**
 * Normalizes an entity text mention by stripping grammatical prepositions and prefixes
 */
export function normalizeHistoricalMention(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim().replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, '').trim();
  cleaned = cleaned.replace(VI_PREFIX_STRIP_REGEX, '').trim();
  return cleaned;
}

/**
 * Snaps an extracted mention string or ID back to the nearest validated CandidateEntitySpan
 */
export function snapMentionToCandidate(
  mention: string,
  candidateSpans: CandidateEntitySpan[]
): { id: string; name: string; type: string } | null {
  if (!mention || typeof mention !== 'string') return null;
  const rawTrimmed = mention.trim();
  const cleaned = normalizeHistoricalMention(rawTrimmed);
  const lowerRaw = rawTrimmed.toLowerCase();
  const lowerClean = cleaned.toLowerCase();

  // 1. Direct match with candidate suggested ID
  const idMatch = candidateSpans.find((c) => c.suggestedCanonicalId?.toLowerCase() === lowerRaw || c.suggestedCanonicalId?.toLowerCase() === lowerClean);
  if (idMatch) {
    return {
      id: idMatch.suggestedCanonicalId!,
      name: idMatch.text,
      type: idMatch.type,
    };
  }

  // 2. Exact text match against Candidate Spans
  const exactMatch = candidateSpans.find((c) => c.text.toLowerCase() === lowerRaw || c.text.toLowerCase() === lowerClean || normalizeHistoricalMention(c.text).toLowerCase() === lowerClean);
  if (exactMatch) {
    return {
      id: exactMatch.suggestedCanonicalId || buildCanonicalId(exactMatch.text, exactMatch.type),
      name: exactMatch.text,
      type: exactMatch.type,
    };
  }

  // 2b. Check if mention resolves canonically to any candidate span's suggestedCanonicalId or alias, or is a verified master ontology entity
  const resolvedMention = resolveCanonicalEntity(cleaned) || resolveCanonicalEntity(rawTrimmed);
  if (resolvedMention && resolvedMention.type !== 'UNKNOWN') {
    const candidateWithSameCanonicalId = candidateSpans.find(
      (c) => c.suggestedCanonicalId === resolvedMention.entityId
    );
    if (candidateWithSameCanonicalId) {
      const isPrimary = slugify(resolvedMention.canonicalName) === slugify(cleaned);
      return {
        id: isPrimary ? resolvedMention.entityId : buildCanonicalId(cleaned, resolvedMention.type),
        name: cleaned || candidateWithSameCanonicalId.text,
        type: resolvedMention.type,
      };
    }
    if (isKnownMasterEntity(cleaned) || isKnownMasterEntity(rawTrimmed) || isKnownMasterEntity(resolvedMention.entityId)) {
      return {
        id: resolvedMention.entityId,
        name: cleaned,
        type: resolvedMention.type,
      };
    }
  }

  // 3. Substring containment matching within Candidate Spans - Prioritize Known Entities and Longest Match First
  const sortedCandidates = [...candidateSpans].sort((a, b) => {
    const aKnown = a.type !== 'UNKNOWN' && !a.suggestedCanonicalId?.startsWith('unknown_');
    const bKnown = b.type !== 'UNKNOWN' && !b.suggestedCanonicalId?.startsWith('unknown_');
    if (aKnown && !bKnown) return -1;
    if (!aKnown && bKnown) return 1;
    return b.text.length - a.text.length;
  });

  for (const c of sortedCandidates) {
    const cLower = c.text.toLowerCase();
    if (lowerRaw.includes(cLower) || lowerClean.includes(cLower) || cLower.includes(lowerClean)) {
      return {
        id: c.suggestedCanonicalId || buildCanonicalId(c.text, c.type),
        name: c.text,
        type: c.type,
      };
    }
  }

  // 3b. Contextual Event / Action / Construction snapping to single matching candidate
  if (
    lowerRaw.includes('cong_trinh') ||
    lowerRaw.includes('xay_dung') ||
    lowerRaw.includes('khoi_cong') ||
    lowerRaw.includes('dai_cong_trinh') ||
    lowerRaw.includes('chien_dich') ||
    lowerRaw.includes('khoi_nghia') ||
    lowerRaw.includes('tran_danh')
  ) {
    const eventCandidates = candidateSpans.filter((c) => c.type === 'EVENT_BATTLE' || c.suggestedCanonicalId?.startsWith('event_'));
    if (eventCandidates.length === 1) {
      const singleEvent = eventCandidates[0];
      return {
        id: singleEvent.suggestedCanonicalId || buildCanonicalId(singleEvent.text, singleEvent.type),
        name: singleEvent.text,
        type: singleEvent.type,
      };
    }
  }

  // 4. When candidate spans are present, strictly reject hallucinations outside the candidate pool
  if (candidateSpans.length > 0) {
    return null;
  }

  // 5. Check if mention is a generic non-entity title
  if (GENERIC_TITLES_SET.has(lowerClean) || GENERIC_TITLES_SET.has(lowerRaw)) {
    return null;
  }

  // 6. Global canonical dictionary resolution (fallback ONLY when candidate spans were not provided)
  const resolvedClean = resolveCanonicalEntity(cleaned);
  if (resolvedClean) {
    return {
      id: resolvedClean.entityId,
      name: cleaned,
      type: resolvedClean.type,
    };
  }
  const resolvedRaw = resolveCanonicalEntity(rawTrimmed);
  if (resolvedRaw) {
    return {
      id: resolvedRaw.entityId,
      name: rawTrimmed,
      type: resolvedRaw.type,
    };
  }

  // 7. Fallback only when candidate spans were not provided (legacy/standalone mode)
  const inferredType = inferEntityTypeFromName(cleaned);
  if (inferredType === 'UNKNOWN') {
    return null;
  }

  const prefix = getCanonicalEntityIdPrefix(inferredType);
  return {
    id: `${prefix}${slugify(cleaned)}`,
    name: cleaned,
    type: inferredType,
  };
}

/**
 * Syntactic Parenthetical & Relational Fast-Path Matcher
 * Extracts deterministic grammatical patterns:
 * 1. Location equivalents: "LocationA (nay thuộc/nay là/LocationB)" -> LocationA SAME_AS_LOCATION LocationB
 * 2. Aliases: "PersonA (tức/tên thật là/hiệu là/PersonB)" -> PersonB ALIAS_OF PersonA
 */
export function extractSyntacticParentheticalTriples(
  text: string,
  candidateSpans: CandidateEntitySpan[] = []
): ExtractedTriple[] {
  if (!text || typeof text !== 'string') return [];
  const results: ExtractedTriple[] = [];
  const seenKeys = new Set<string>();

  // 1. Parenthetical patterns: Outer ( [prefix] Inner )
  const PARENTHESIS_REGEX = /([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\s\-]+?)\s*\(\s*(nay\s+thuộc|nay\s+là|vốn\s+là|tức|tên\s+thật\s+là|hiệu\s+là|húy\s+là)?\s*([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\s\-]+?)\s*\)/gu;

  let match: RegExpExecArray | null;
  while ((match = PARENTHESIS_REGEX.exec(text)) !== null) {
    let outerRaw = match[1].trim();
    const prefix = (match[2] || '').trim();
    const innerRaw = match[3].trim();
    if (!outerRaw || !innerRaw || outerRaw.length < 2 || innerRaw.length < 2) continue;

    // Isolate immediately preceding titlecased entity name
    const lastTitleCase = outerRaw.match(/(?:[A-ZÀ-Ỹ][a-zà-ỹ0-9\-]+\s*)+$/);
    if (lastTitleCase) {
      outerRaw = lastTitleCase[0].trim();
    }

    // Resolve both entities
    const outerSnapped = snapMentionToCandidate(outerRaw, candidateSpans);
    const innerSnapped = snapMentionToCandidate(innerRaw, candidateSpans);

    const resolvedOuter = (outerSnapped && outerSnapped.id.startsWith('unknown_'))
      ? { id: 'loc_' + outerSnapped.id.replace(/^unknown_/, ''), name: outerSnapped.name, type: 'LOCATION' }
      : (outerSnapped || { id: `loc_${slugify(outerRaw)}`, name: outerRaw, type: 'LOCATION' });

    const resolvedInner = (innerSnapped && innerSnapped.id.startsWith('unknown_'))
      ? { id: 'loc_' + innerSnapped.id.replace(/^unknown_/, ''), name: innerSnapped.name, type: 'LOCATION' }
      : (innerSnapped || { id: `loc_${slugify(innerRaw)}`, name: innerRaw, type: 'LOCATION' });

    // If both are LOCATION:
    if (resolvedOuter.id.startsWith('loc_') && resolvedInner.id.startsWith('loc_')) {
      const rel: HistoricalRelationType = /thuộc/i.test(prefix) ? 'HAPPENED_AT' : 'SAME_AS_LOCATION';
      const triple = validateAndCanonicalizeTriple(
        resolvedOuter,
        rel,
        resolvedInner,
        1.0
      );
      if (triple) {
        const key = `${triple.sourceEntityId}:${triple.relationType}:${triple.targetEntityId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(triple);
        }
      }
    }
    // If both are HISTORICAL_PERSON: ALIAS_OF (Alias -> Official Name)
    else if (resolvedOuter.id.startsWith('person_') && resolvedInner.id.startsWith('person_')) {
      const triple = validateAndCanonicalizeTriple(
        resolvedInner,
        'ALIAS_OF',
        resolvedOuter,
        1.0
      );
      if (triple) {
        const key = `${triple.sourceEntityId}:${triple.relationType}:${triple.targetEntityId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(triple);
        }
      }
    }
  }

  // 2. Inline drift patterns: [Cổ danh] ... (?:và|đến|sau|thời)?\s*(nay là|nay thuộc)\s+([Hiện danh])
  const MULTI_TOPONYM_REGEX = /(?:kinh\s+đô|thành|cố\s+đô|kinh\s+thành)?\s*([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\s\-]+?)\s+(?:sau\s+thời\s+[^,.]*?|\s+sau\s+này\s+)?(?:gọi\s+là|đổi\s+tên\s+thành|thành)\s+([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\s\-]+?)\s*(?:,\s*|\s+và\s+)?(nay\s+là|nay\s+thuộc)\s+(?:thành\s+phố\s+|tỉnh\s+|huyện\s+|thị\s+xã\s+)?([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\s\-]+)/gu;
  while ((match = MULTI_TOPONYM_REGEX.exec(text)) !== null) {
    const rawOld1 = match[1].trim();
    const rawOld2 = match[2].trim();
    const connector = match[3].trim();
    const rawNew = match[4].trim();

    const old1Snapped = snapMentionToCandidate(rawOld1, candidateSpans);
    const old2Snapped = snapMentionToCandidate(rawOld2, candidateSpans);
    const newSnapped = snapMentionToCandidate(rawNew, candidateSpans);

    const rel: HistoricalRelationType = /thuộc/i.test(connector) ? 'HAPPENED_AT' : 'SAME_AS_LOCATION';

    for (const oldSnapped of [old1Snapped, old2Snapped]) {
      const resolvedOld = (oldSnapped && oldSnapped.id.startsWith('unknown_'))
        ? { id: 'loc_' + oldSnapped.id.replace(/^unknown_/, ''), name: oldSnapped.name, type: 'LOCATION' }
        : oldSnapped;

      if (resolvedOld && newSnapped && resolvedOld.id.startsWith('loc_') && newSnapped.id.startsWith('loc_') && resolvedOld.id !== newSnapped.id) {
        const triple = validateAndCanonicalizeTriple(resolvedOld, rel, newSnapped, 1.0);
        if (triple) {
          const key = `${triple.sourceEntityId}:${triple.relationType}:${triple.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push(triple);
          }
        }
      }
    }
  }

  const INLINE_TOPONYM_REGEX = /(?:kinh\s+đô|thành|vùng\s+đất|cố\s+đô|kinh\s+thành|thương\s+cảng)?\s*([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\s\-]+?)(?:,\s*|\s+sau\s+[^,.]*?|\s+và\s+|\s+đến\s+)?(nay\s+là|nay\s+thuộc)\s+(?:thành\s+phố\s+|tỉnh\s+|huyện\s+|thị\s+xã\s+)?([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\s\-]+)/gu;
  while ((match = INLINE_TOPONYM_REGEX.exec(text)) !== null) {
    const rawOld = match[1].trim();
    const connector = match[2].trim();
    const rawNew = match[3].trim();
    if (!rawOld || !rawNew || rawOld.length < 2 || rawNew.length < 2) continue;

    const oldSnapped = snapMentionToCandidate(rawOld, candidateSpans);
    const newSnapped = snapMentionToCandidate(rawNew, candidateSpans);

    const resolvedOld = (oldSnapped && oldSnapped.id.startsWith('unknown_'))
      ? { id: 'loc_' + oldSnapped.id.replace(/^unknown_/, ''), name: oldSnapped.name, type: 'LOCATION' }
      : oldSnapped;

    if (resolvedOld && newSnapped && resolvedOld.id.startsWith('loc_') && newSnapped.id.startsWith('loc_') && resolvedOld.id !== newSnapped.id) {
      const rel: HistoricalRelationType = /thuộc/i.test(connector) ? 'HAPPENED_AT' : 'SAME_AS_LOCATION';
      const triple = validateAndCanonicalizeTriple(
        resolvedOld,
        rel,
        newSnapped,
        1.0
      );
      if (triple) {
        const key = `${triple.sourceEntityId}:${triple.relationType}:${triple.targetEntityId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(triple);
        }
      }
    }
  }

  // 3. Colon dictionary definitions: [Cổ danh]: (?:Bây giờ là|Thời Nguyễn là|Hiện nay là|nay là|tức là)\s*(?:thành\s+phố\s+|tỉnh\s+|huyện\s+|thị\s+xã\s+|thành\s+)?([Hiện danh])
  const COLON_TOPONYM_REGEX = /([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\s\-]+?)\s*:\s*(?:Bây\s+giờ\s+là|Thời\s+Nguyễn\s+là|Hiện\s+nay\s+là|nay\s+là|tức\s+là)\s*(?:thành\s+phố\s+|tỉnh\s+|huyện\s+|thị\s+xã\s+|thành\s+)?([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\s\-]+?)(?:,\s*|\.|\n|$)/gu;
  while ((match = COLON_TOPONYM_REGEX.exec(text)) !== null) {
    const rawOld = match[1].trim();
    const rawNew = match[2].trim();
    if (!rawOld || !rawNew || rawOld.length < 2 || rawNew.length < 2) continue;

    const oldSnapped = snapMentionToCandidate(rawOld, candidateSpans);
    const newSnapped = snapMentionToCandidate(rawNew, candidateSpans);

    const resolvedOld = (oldSnapped && oldSnapped.id.startsWith('unknown_'))
      ? { id: 'loc_' + oldSnapped.id.replace(/^unknown_/, ''), name: oldSnapped.name, type: 'LOCATION' }
      : oldSnapped;

    if (resolvedOld && newSnapped && resolvedOld.id.startsWith('loc_') && newSnapped.id.startsWith('loc_') && resolvedOld.id !== newSnapped.id) {
      const triple = validateAndCanonicalizeTriple(
        resolvedOld,
        'SAME_AS_LOCATION',
        newSnapped,
        1.0
      );
      if (triple) {
        const key = `${triple.sourceEntityId}:${triple.relationType}:${triple.targetEntityId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(triple);
        }
      }
    }
  }

  // 4. Inline Person Alias: [Tên A] (?:tức là|tức|tên thật là|hiệu là|húy là|được tôn xưng là|tên húy là|được xưng tôn)\s+(?:vua|hoàng đế|chúa|đại vương)?\s*([Tên B])
  const INLINE_PERSON_ALIAS_REGEX = /([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+){0,3})\s+(?:tức\s+là|tức|tên\s+thật\s+là|hiệu\s+là|húy\s+là|được\s+tôn\s+xưng\s+là|được\s+xưng\s+tôn|được\s+tôn\s+là|tên\s+húy\s+là)\s+(?:danh\s+hiệu\s+|vua\s+|hoàng\s+đế\s+|chúa\s+|đại\s+vương\s+|tiền\s+nhân\s+)?([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+){0,3})/gu;
  while ((match = INLINE_PERSON_ALIAS_REGEX.exec(text)) !== null) {
    const rawA = match[1].trim();
    const rawB = match[2].trim();
    const aSnapped = snapMentionToCandidate(rawA, candidateSpans);
    const bSnapped = snapMentionToCandidate(rawB, candidateSpans);
    if (aSnapped && bSnapped && aSnapped.id.startsWith('person_') && bSnapped.id.startsWith('person_') && (aSnapped.id !== bSnapped.id || slugify(aSnapped.name) !== slugify(bSnapped.name))) {
      const aId = (aSnapped.id === bSnapped.id && slugify(aSnapped.name) !== slugify(bSnapped.name)) ? `person_${slugify(aSnapped.name)}` : aSnapped.id;
      const bId = (aSnapped.id === bSnapped.id && slugify(aSnapped.name) !== slugify(bSnapped.name)) ? `person_${slugify(bSnapped.name)}` : bSnapped.id;
      const triple = validateAndCanonicalizeTriple(
        { id: aId, name: aSnapped.name, type: 'HISTORICAL_PERSON' },
        'ALIAS_OF',
        { id: bId, name: bSnapped.name, type: 'HISTORICAL_PERSON' },
        1.0
      );
      if (triple) {
        const key = `${triple.sourceEntityId}:${triple.relationType}:${triple.targetEntityId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(triple);
        }
      }
    }
  }

  // 5. Narrative Honorific & Posthumous Title Matcher:
  // e.g. "Phùng Hưng ... được xưng tôn Bố Cái Đại Vương", "Đinh Bộ Lĩnh ... được tôn xưng danh hiệu Vạn Thắng Vương", "Nguyễn Huệ ... lấy hiệu là Quang Trung"
  const LONG_ALIAS_REGEX = /([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+){0,3})[^.,\n]{0,80}?(?:được\s+(?:tôn\s+xưng|xưng\s+tôn|suy\s+tôn|tôn\s+làm|suy\s+tôn\s+làm|phong)|lấy\s+hiệu\s+là|tự\s+xưng\s+là|tên\s+gọi\s+khác\s+là|tôn\s+phong\s+danh\s+hiệu)\s+(?:danh\s+hiệu\s+|vua\s+|hoàng\s+đế\s+|chúa\s+|đại\s+vương\s+|tướng\s+)?([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+){0,3})/gu;
  while ((match = LONG_ALIAS_REGEX.exec(text)) !== null) {
    const rawA = match[1].trim();
    const rawB = match[2].trim();
    if (!rawA || !rawB || rawA.length < 2 || rawB.length < 2) continue;

    const aSnapped = snapMentionToCandidate(rawA, candidateSpans);
    const bSnapped = snapMentionToCandidate(rawB, candidateSpans);
    if (aSnapped && bSnapped && aSnapped.id.startsWith('person_') && bSnapped.id.startsWith('person_') && aSnapped.id !== bSnapped.id) {
      const triple = validateAndCanonicalizeTriple(bSnapped, 'ALIAS_OF', aSnapped, 1.0);
      if (triple) {
        const key = `${triple.sourceEntityId}:${triple.relationType}:${triple.targetEntityId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(triple);
        }
      }
    }
  }

  // 6. Ancient Toponym to Modern Administrative Matcher (Span Pairwise & Regex):
  const locations = candidateSpans.filter((s) => s.type === 'LOCATION');
  const SAME_AS_LOC_PATTERN = /\b(?:xưa\s+nay\s+thuộc|nay\s+thuộc|nay\s+là|ngày\s+nay\s+là|thời\s+nguyễn\s+là|hiện\s+nay\s+là|vốn\s+là|xưa\s+là|tương\s+ứng\s+với|được\s+đổi\s+tên\s+thành)\b/i;
  for (let i = 0; i < locations.length; i++) {
    for (let j = 0; j < locations.length; j++) {
      if (i === j) continue;
      const locA = locations[i];
      const locB = locations[j];
      if (locA.startOffset < locB.startOffset) {
        const charDist = locB.startOffset - locA.endOffset;
        if (charDist > 120 || charDist < 0) continue;
        const mid = text.substring(locA.endOffset, locB.startOffset);
        if (mid.includes('\n') || mid.includes('.')) continue;
        if (SAME_AS_LOC_PATTERN.test(mid)) {
          const sId = locA.suggestedCanonicalId || `loc_${slugify(locA.text)}`;
          const tId = locB.suggestedCanonicalId || `loc_${slugify(locB.text)}`;
          if (sId !== tId) {
            const triple = validateAndCanonicalizeTriple(
              { id: sId, name: locA.text, type: 'LOCATION' },
              'SAME_AS_LOCATION',
              { id: tId, name: locB.text, type: 'LOCATION' },
              1.0
            );
            if (triple) {
              const key = `${triple.sourceEntityId}:${triple.relationType}:${triple.targetEntityId}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                results.push(triple);
              }
            }
          }
        }
      }
    }
  }

  const TOPONYM_REGEX = /([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+){0,3})[^.,\n]{0,60}?(?:xưa\s+nay\s+thuộc|nay\s+là|nay\s+thuộc|xưa\s+là|vốn\s+là)[^.,\n]{0,40}?([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+){0,3})/gu;
  while ((match = TOPONYM_REGEX.exec(text)) !== null) {
    const rawA = match[1].trim();
    const rawB = match[2].trim();
    if (!rawA || !rawB || rawA.length < 2 || rawB.length < 2) continue;

    const aSnapped = snapMentionToCandidate(rawA, candidateSpans);
    const bSnapped = snapMentionToCandidate(rawB, candidateSpans);
    if (aSnapped && bSnapped && aSnapped.id.startsWith('loc_') && bSnapped.id.startsWith('loc_') && aSnapped.id !== bSnapped.id) {
      const triple = validateAndCanonicalizeTriple(aSnapped, 'SAME_AS_LOCATION', bSnapped, 1.0);
      if (triple) {
        const key = `${triple.sourceEntityId}:${triple.relationType}:${triple.targetEntityId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(triple);
        }
      }
    }
  }

  return results;
}

/**
 * Deterministic Kinship & Royal Succession Extractor (Stage 1 Fast-Path)
 * Extracts direct genealogical and succession relationships:
 * - A sinh ra B, A sinh B, A đẻ ra B, A lập con trai là B -> B ROYAL_LINEAGE A
 * - B là con (trưởng|thứ|gái|trai)? của A -> B ROYAL_LINEAGE A
 * - A truyền ngôi cho B -> B ROYAL_LINEAGE A
 * - B nối ngôi / kế vị / kế nghiệp / nối nghiệp A -> B ROYAL_LINEAGE A
 */
export function extractRoyalLineageTriples(
  text: string,
  candidateSpans: CandidateEntitySpan[] = []
): ExtractedTriple[] {
  if (!text || typeof text !== 'string') return [];
  const results: ExtractedTriple[] = [];
  const seenKeys = new Set<string>();

  const persons = candidateSpans
    .filter((s) => s.type === 'HISTORICAL_PERSON')
    .sort((a, b) => a.startOffset - b.startOffset);

  if (persons.length < 2) return [];

  const BIRTH_PATTERN = /^(?:,\s*)?(?:đã\s+)?(?:sinh\s+ra|sinh\s+được|sinh\s+hạ|sinh|đẻ\s+ra|lập\s+con\s+trai\s+là|lập\s+con\s+là|lập\s+thái\s+tử\s+là)(?:\s+ra)?(?:\s+(?:hoàng\s+tử|thái\s+tử|con\s+trai|con\s+gái|người\s+con|con))?\s*$/i;
  const CHILD_OF_PATTERN = /^(?:,\s*)?(?:là\s+)?(?:con|con\s+trai|con\s+gái|con\s+trưởng|con\s+thứ|hoàng\s+tử|thái\s+tử)(?:\s+(?:trưởng|thứ|kế\s+vị))?(?:\s+(?:của|do))\s*$/i;
  const PASS_THRONE_PATTERN = /^(?:,\s*)?(?:rồi\s+)?(?:truyền\s+ngôi|nhường\s+ngôi|trao\s+ngôi|nhường\s+ngai\s+vàng)(?:\s+(?:báu|vàng|vua))?\s+cho(?:\s+(?:dòng\s+dõi|hoàng\s+tử|thái\s+tử|con\s+trai|con|người\s+kế\s+vị|con\s+trai\s+trưởng\s+là\s+thái\s+tử|con\s+trai\s+là\s+thái\s+tử|con\s+trai\s+là|con\s+gái\s+là|người\s+kế\s+vị\s+là))?\s*$/i;
  const SUCCEED_PATTERN = /^(?:,\s*)?(?:nối\s+ngôi|kế\s+vị|nối\s+nghiệp|kế\s+nghiệp|kế\s+thừa\s+sự\s+nghiệp|thừa\s+kế\s+ngai\s+vàng|kế\s+thừa)(?:\s+(?:vua\s+cha|phụ\s+hoàng|cha|tiền\s+nhân|của))?\s*$/i;

  for (let i = 0; i < persons.length; i++) {
    const p1 = persons[i];
    for (let j = 0; j < persons.length; j++) {
      if (i === j) continue;
      const p2 = persons[j];

      if (p1.startOffset < p2.startOffset) {
        const charDist = p2.startOffset - p1.endOffset;
        if (charDist > 120 || charDist < 0) continue;

        // Check for intervening persons to prevent multi-generation skip over intermediate heir
        const hasInterveningPerson = persons.some(
          (other) => other.startOffset > p1.endOffset && other.endOffset < p2.startOffset
        );
        if (hasInterveningPerson) continue;

        const mid = text.substring(p1.endOffset, p2.startOffset).trim();
        if (mid.includes('\n') || mid.includes('.')) continue;

        // Pattern 1: p1 sinh ra p2 / p1 truyền ngôi cho p2 => p2 ROYAL_LINEAGE p1
        if (BIRTH_PATTERN.test(mid) || PASS_THRONE_PATTERN.test(mid)) {
          const sId = p2.suggestedCanonicalId || `person_${slugify(p2.text)}`;
          const tId = p1.suggestedCanonicalId || `person_${slugify(p1.text)}`;
          const t = validateAndCanonicalizeTriple(
            { id: sId, name: p2.text, type: 'HISTORICAL_PERSON' },
            'ROYAL_LINEAGE',
            { id: tId, name: p1.text, type: 'HISTORICAL_PERSON' },
            0.98
          );
          if (t) {
            const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              results.push(t);
            }
          }
        }

        // Pattern 2: p1 là con của p2 / p1 nối ngôi p2 => p1 ROYAL_LINEAGE p2
        if (CHILD_OF_PATTERN.test(mid) || SUCCEED_PATTERN.test(mid)) {
          const sId = p1.suggestedCanonicalId || `person_${slugify(p1.text)}`;
          const tId = p2.suggestedCanonicalId || `person_${slugify(p2.text)}`;
          const t = validateAndCanonicalizeTriple(
            { id: sId, name: p1.text, type: 'HISTORICAL_PERSON' },
            'ROYAL_LINEAGE',
            { id: tId, name: p2.text, type: 'HISTORICAL_PERSON' },
            0.98
          );
          if (t) {
            const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              results.push(t);
            }
          }
        }
      }
    }
  }

  return results;
}

export const VIETNAMESE_LANDMARK_PARENT_MAP: Record<string, string> = {
  'loc_thanh_co_loa': 'loc_dong_anh',
  'loc_co_loa': 'loc_dong_anh',
  'loc_dong_anh': 'loc_thang_long',
  'loc_dinh_doc_lap': 'loc_sai_gon',
  'loc_thuy_dien_hoa_binh': 'loc_hoa_binh',
  'loc_can_cu_vu_quang': 'loc_ha_tinh',
  'loc_vu_quang': 'loc_ha_tinh',
  'loc_can_cu_phu_dien': 'loc_thanh_hoa',
  'loc_phu_dien': 'loc_thanh_hoa',
  'loc_nui_nua': 'loc_thanh_hoa',
  'loc_nong_cong': 'loc_thanh_hoa',
  'loc_vinh_loc': 'loc_thanh_hoa',
  'loc_tho_xuan': 'loc_thanh_hoa',
  'loc_lam_son': 'loc_thanh_hoa',
  'loc_phong_khe': 'loc_dong_anh',
  'loc_nui_ban': 'loc_thua_thien_hue',
  'loc_muong_phang': 'loc_dien_bien',
  'loc_dien_bien_phu': 'loc_dien_bien',
  'loc_thanh_tay_do': 'loc_thanh_hoa',
  'loc_thanh_nha_ho': 'loc_thanh_hoa',
  'loc_nui_soc_son': 'loc_soc_son',
  'loc_soc_son': 'loc_thang_long',
  'loc_duong_lam': 'loc_son_tay',
  'loc_van_mieu': 'loc_thang_long',
  'loc_chua_mot_cot': 'loc_thang_long',
  'loc_hoang_thanh_thang_long': 'loc_thang_long',
  'loc_ben_nha_rong': 'loc_sai_gon',
  'loc_nha_rong': 'loc_sai_gon',
  'loc_phu_xuan': 'loc_thua_thien_hue',
  'loc_chi_linh': 'loc_hai_duong',
  'loc_chi_lang': 'loc_lang_son',
  'loc_xuong_giang': 'loc_bac_giang',
  'loc_tan_trao': 'loc_tuyen_quang',
  'loc_ngoc_hoi': 'loc_thang_long',
  'loc_dong_da': 'loc_thang_long',
};

/**
 * Deterministic Spatial Hierarchy Resolver
 * Extracts nested administrative / topological relations:
 * - Comma separated: "Lam Sơn, Thanh Hóa" -> loc_lam_son HAPPENED_AT loc_thanh_hoa
 * - Spatial prepositions: "Vĩnh Lộc, Thanh Hóa", "huyện Đông Ngàn, tỉnh Bắc Ninh", "nằm ở vị trí hữu ngạn sông Mã... trên đất Cửu Chân"
 */
export function extractSpatialHierarchyTriples(
  text: string,
  candidateSpans: CandidateEntitySpan[] = []
): ExtractedTriple[] {
  if (!text || typeof text !== 'string') return [];
  const results: ExtractedTriple[] = [];
  const seenKeys = new Set<string>();

  const locations = candidateSpans
    .filter((s) => s.type === 'LOCATION' && s.suggestedCanonicalId)
    .sort((a, b) => a.startOffset - b.startOffset);

  if (locations.length < 2) return [];

  // 1. Structural Landmark to Parent Administrative Unit Bridge
  for (let i = 0; i < locations.length; i++) {
    for (let j = 0; j < locations.length; j++) {
      if (i === j) continue;
      const locA = locations[i];
      const locB = locations[j];
      const sId = locA.suggestedCanonicalId || `loc_${slugify(locA.text)}`;
      const tId = locB.suggestedCanonicalId || `loc_${slugify(locB.text)}`;
      if (VIETNAMESE_LANDMARK_PARENT_MAP[sId] === tId) {
        const t = validateAndCanonicalizeTriple(
          { id: sId, name: locA.text, type: 'LOCATION' },
          'HAPPENED_AT',
          { id: tId, name: locB.text, type: 'LOCATION' },
          1.0
        );
        if (t) {
          const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push(t);
          }
        }
      }
    }
  }

  const MOTION_WORDS = /\b(từ|đến|sang|vào|tiến|đánh|về|chảy qua|đổ ra|nối|ranh giới|phân chia)\b/i;
  const SPATIAL_CONNECTORS = /^(?:,\s*(?:huyện|tỉnh|thành\s+phố|thị\s+xã|xã|quận)?\s*|(?:nằm\s+(?:ở|tại)(?:\s+vị\s+trí)?(?:\s+hữu\s+ngạn|\s+tả\s+ngạn)?|tọa\s+lạc\s+tại|thuộc|trên\s+đất|trên|ở\s+tại|ở|tại|ngoài\s+khơi|thuộc\s+về|của)(?:\s+(?:tỉnh|huyện|thành\s+phố|thị\s+xã|quận|xã|xứ|vùng|đất|vùng\s+biển))?\s*)$/i;
  const COORD_CONJUNCTION = /^(?:,\s*|\s+và\s+|\s+cùng\s+)$/i;

  for (let i = 0; i < locations.length; i++) {
    const locA = locations[i];
    for (let j = i + 1; j < locations.length; j++) {
      const locB = locations[j];
      const charDist = locB.startOffset - locA.endOffset;
      if (charDist > 90) break;
      if (charDist < 0) continue;

      const mid = text.substring(locA.endOffset, locB.startOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) break;

      if (MOTION_WORDS.test(mid)) continue;
      if (/\b(nay\s+thuộc|nay\s+là|xưa\s+là|vốn\s+là|xưa\s+nay\s+thuộc)\b/i.test(mid)) continue;

      if (SPATIAL_CONNECTORS.test(mid) || mid === ',' || mid === '') {
        const sId = locA.suggestedCanonicalId || `loc_${slugify(locA.text)}`;
        const tId = locB.suggestedCanonicalId || `loc_${slugify(locB.text)}`;
        if (sId !== tId) {
          const t = validateAndCanonicalizeTriple(
            { id: sId, name: locA.text, type: 'LOCATION' },
            'HAPPENED_AT',
            { id: tId, name: locB.text, type: 'LOCATION' },
            0.98
          );
          if (t) {
            const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              results.push(t);
            }
          }
        }
      } else if (COORD_CONJUNCTION.test(mid) && j + 1 < locations.length) {
        // Coordinated location pair: "Hoàng Sa và Trường Sa trên Biển Đông"
        const locC = locations[j + 1];
        const midC = text.substring(locB.endOffset, locC.startOffset).trim();
        if (SPATIAL_CONNECTORS.test(midC)) {
          const sIdA = locA.suggestedCanonicalId || `loc_${slugify(locA.text)}`;
          const sIdB = locB.suggestedCanonicalId || `loc_${slugify(locB.text)}`;
          const tIdC = locC.suggestedCanonicalId || `loc_${slugify(locC.text)}`;

          for (const sId of [sIdA, sIdB]) {
            if (sId !== tIdC) {
              const t = validateAndCanonicalizeTriple(
                { id: sId, name: sId === sIdA ? locA.text : locB.text, type: 'LOCATION' },
                'HAPPENED_AT',
                { id: tIdC, name: locC.text, type: 'LOCATION' },
                0.98
              );
              if (t) {
                const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);
                  results.push(t);
                }
              }
            }
          }
        }
      }
    }
  }

  return results;
}

/**
 * Deterministic Document Authorship & Mention Extractor (Stage 1 Fast-Path)
 * Captures explicit document creation / promulgation / mention relations:
 * - [Person / Org] (soạn / viết / ban hành / đọc / công bố / ca ngợi / nhắc đến) [Doc]
 * - [Doc] (ghi chép / kể lại / viết về / nhắc đến) [Person / Event]
 */
export function extractSyntacticDocumentTriples(
  text: string,
  candidateSpans: CandidateEntitySpan[] = []
): ExtractedTriple[] {
  if (!text || typeof text !== 'string') return [];
  const results: ExtractedTriple[] = [];
  const seenKeys = new Set<string>();

  const docs = candidateSpans.filter((s) => s.type === 'DOCUMENT_CULTURE');
  const persons = candidateSpans.filter((s) => s.type === 'HISTORICAL_PERSON');
  const orgs = candidateSpans.filter((s) => s.type === 'ORGANIZATION');
  const dynasties = candidateSpans.filter((s) => s.type === 'DYNASTY_ERA');

  if (docs.length === 0) return [];

  const DOC_VERB_STRICT = /\b(soạn\s+thảo|soạn|viết|biên\s+soạn|ban\s+hành|ban|đọc|công\s+bố|ngâm|sáng\s+tác|trứ\s+tác|chủ\s+biên|chủ\s+trì|khởi\s+thảo|ghi\s+chép|chép\s+lại|kể\s+lại|viết\s+về|nhắc\s+đến|xuất\s+hiện\s+trong|ca\s+ngợi|trong|ký\s+kết|ký)\b/i;

  for (const doc of docs) {
    for (const p of [...persons, ...orgs]) {
      const minOffset = Math.min(doc.endOffset, p.endOffset);
      const maxOffset = Math.max(doc.startOffset, p.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;

      if (DOC_VERB_STRICT.test(mid) || mid === '') {
        const pId = p.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(p.type)}${slugify(p.text)}`;
        const docId = doc.suggestedCanonicalId || `doc_${slugify(doc.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: pId, name: p.text, type: p.type as any },
          'MENTIONED_IN',
          { id: docId, name: doc.text, type: 'DOCUMENT_CULTURE' },
          1.0
        );
        if (t) {
          const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push(t);
          }
        }
      }
    }

    for (const dyn of dynasties) {
      const minOffset = Math.min(doc.endOffset, dyn.endOffset);
      const maxOffset = Math.max(doc.startOffset, dyn.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 90 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (/\b(thuộc|thời|nhà|triều|dưới\s+thời|ra\s+đời|ban\s+hành)\b/i.test(mid) || mid === '') {
        const docId = doc.suggestedCanonicalId || `doc_${slugify(doc.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: docId, name: doc.text, type: 'DOCUMENT_CULTURE' },
          'HAPPENED_IN',
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          1.0
        );
        if (t) {
          const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push(t);
          }
        }
      }
    }
  }

  return results;
}

/**
 * Deterministic Dynastic Belonging Extractor (Stage 1 Fast-Path)
 * Captures explicit dynastic belonging relations:
 * - [Vua / Tướng / Người] [Nhà / Triều X] -> (Person PART_OF Dynasty)
 * - [Cổ vật] [Nhà / Triều X] -> (Artifact HAPPENED_IN Dynasty)
 */
export function extractSyntacticDynasticTriples(
  text: string,
  candidateSpans: CandidateEntitySpan[] = []
): ExtractedTriple[] {
  if (!text || typeof text !== 'string') return [];
  const results: ExtractedTriple[] = [];
  const seenKeys = new Set<string>();

  const persons = candidateSpans.filter((s) => s.type === 'HISTORICAL_PERSON');
  const artifacts = candidateSpans.filter((s) => s.type === 'ARTIFACT');
  const dynasties = candidateSpans.filter((s) => s.type === 'DYNASTY_ERA');

  if (dynasties.length === 0) return [];

  const DYNASTY_CONNECTOR = /\b(vua|hoàng\s+đế|chúa|tướng|thái\s+sư|thái\s+úy|quan|nhà|triều|thời|thuộc|dưới\s+thời|sáng\s+lập|dựng\s+nên|trị\s+vì|cai\s+trị|phục\s+vụ)\b/i;

  for (const dyn of dynasties) {
    for (const p of persons) {
      const minOffset = Math.min(dyn.endOffset, p.endOffset);
      const maxOffset = Math.max(dyn.startOffset, p.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 90 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;

      if (DYNASTY_CONNECTOR.test(mid) || mid === '') {
        const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
          'PART_OF',
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          1.0
        );
        if (t) {
          const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push(t);
          }
        }
      }
    }

    for (const art of artifacts) {
      const minOffset = Math.min(dyn.endOffset, art.endOffset);
      const maxOffset = Math.max(dyn.startOffset, art.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 90 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;

      if (/\b(thuộc|thời|nhà|triều|dưới\s+thời|đúc\s+dưới|ra\s+đời|lưu\s+hành)\b/i.test(mid) || mid === '') {
        const artId = art.suggestedCanonicalId || `artifact_${slugify(art.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: artId, name: art.text, type: 'ARTIFACT' },
          'HAPPENED_IN',
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          1.0
        );
        if (t) {
          const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push(t);
          }
        }
      }
    }
  }

  return results;
}

// In extractTriplesFromText:
// 2b. Link Persons -> Locations (HAPPENED_AT) with Strict Prepositions & Historical Actions
const STRICT_LOC_PREP = /^(?:,\s*)?(?:ở\s+tại|ở|tại|đóng\s+đô\s+ở|định\s+đô\s+ở|đóng\s+đô\s+tại|quê\s+ở|sinh\s+tại|mất\s+tại|hy\s+sinh\s+tại|dời\s+đô\s+về|đóng\s+quân\s+tại|đóng\s+quân\s+ở|căn\s+cứ|dựng\s+cờ\s+ở|lên\s+ngôi\s+ở|xây|xây\s+dựng|đắp|lập|dấy\s+binh\s+khởi\s+nghĩa\s+tại|khởi\s+nghĩa\s+tại|lập\s+căn\s+cứ\s+tại|hoạt\s+động\s+tại|tu\s+hành\s+tại|lãnh\s+đạo\s+tại|mở\s+trường\s+tại|ra\s+đi\s+tìm\s+đường\s+cứu\s+nước\s+tại|đọc\s+tuyên\s+ngôn\s+tại|hội\s+đàm\s+tại|tập\s+kết\s+tại|(?:chỉ\s+huy\s+)?(?:tiến\s+về|tiến\s+quân\s+về|tiến\s+đánh|đánh\s+chiếm|giải\s+phóng|hành\s+quân\s+về|hành\s+quân\s+đến|tiến\s+vào))(?:\s+(?:thành\s+phố|tỉnh|huyện|thị\s+xã|vùng|đất))?\s*$/i;

/**
 * Helper to build an entity identifier if not already provided
 */
function buildEntityId(name: string, relationType?: HistoricalRelationType, candidateSpans?: CandidateEntitySpan[]): { id: string; name: string } {
  if (candidateSpans && candidateSpans.length > 0) {
    const snapped = snapMentionToCandidate(name, candidateSpans);
    if (snapped) return { id: snapped.id, name: snapped.name };
  }

  const resolved = resolveCanonicalEntity(name);
  if (resolved && resolved.entityId) {
    return { id: resolved.entityId, name: resolved.canonicalName };
  }

  const cleaned = normalizeHistoricalMention(name);
  const resolvedClean = resolveCanonicalEntity(cleaned);
  if (resolvedClean && resolvedClean.entityId) {
    return { id: resolvedClean.entityId, name: resolvedClean.canonicalName };
  }

  const entityType = inferEntityTypeFromName(cleaned);
  const prefix = getCanonicalEntityIdPrefix(entityType);
  return { id: `${prefix}${slugify(cleaned)}`, name: cleaned };
}

/**
 * Generic 5-Level Administrative & Spatial Hierarchy Classifier
 * Level 4: Macro Region / Nation / Realm (Đại Việt, Đàng Trong, Bắc Kỳ...)
 * Level 3: Province / Central City / Feudal Capital / Prefecture (Hà Nội, Thanh Hóa, Thăng Long...)
 * Level 2: District / County / Town (Đông Anh, Nông Cống, Chi Lăng...)
 * Level 1: Village / Commune / Hamlet (Phú Điền, làng...)
 * Level 0: Specific Site / Monument / Fortress / Temple / River (thành Cổ Loa, đền Hùng...)
 */
export function getSpatialHierarchyLevel(name: string, id: string): number {
  const norm = name.toLowerCase().trim();
  // Level 4: Macro Region / Realm / State / Country
  if (/(?:^|\s)(việt\s+nam|đại\s+việt|đại\s+nam|đàng\s+trong|đàng\s+ngoài|bắc\s+kỳ|trung\s+kỳ|nam\s+kỳ|xứ\s+đoài|xứ\s+kinh\s+bắc|xứ\s+sơn\s+nam|kinh\s+bắc|sơn\s+nam|bắc\s+hà|nam\s+hà|nam\s+bộ|bắc\s+bộ|trung\s+bộ|tây\s+nguyên|miền\s+nam|miền\s+bắc|miền\s+trung|giao\s+châu|hoan\s+châu|ái\s+châu)(?:$|\s)/i.test(norm)) {
    return 4;
  }
  // Level 3: Province / Central City / Feudal Capital / Prefecture / Circuit
  if (/(?:^|\s)(tỉnh|thành\s+phố|kinh\s+đô|kinh\s+thành|hoàng\s+thành|thăng\s+long|hà\s+nội|sài\s+gòn|gia\s+định|huế|phú\s+xuân|đông\s+kinh|đông\s+quan|đại\s+la|tống\s+bình|hoa\s+lư|phủ|trấn|châu)(?:$|\s)/i.test(norm) || /^(?:loc_ha_noi|loc_thang_long|loc_thanh_hoa|loc_lang_son|loc_quang_ninh|loc_sai_gon|loc_hue|loc_tien_giang|loc_can_tho|loc_nghe_an|loc_hai_duong|loc_bac_ninh|loc_ninh_binh|loc_quang_nam|loc_da_nang)$/.test(id)) {
    return 3;
  }
  // Level 2: District / Town / County
  if (/(?:^|\s)(huyện|quận|thị\s+xã)(?:$|\s)/i.test(norm)) {
    return 2;
  }
  // Level 1: Village / Commune / Ward / Hamlet
  if (/(?:^|\s)(xã|phường|thị\s+trấn|làng|thôn|ấp|bản|mường)(?:$|\s)/i.test(norm)) {
    return 1;
  }
  // Level 0: Specific Site / Monument / Fortress / Temple / Mountain / River / Island
  return 0;
}

/**
 * Validate and enforce Canonical Directionality Matrix ($S \to R \to O$)
 */
export function validateAndCanonicalizeTriple(
  source: { id: string; name: string; type?: string },
  relation: HistoricalRelationType,
  target: { id: string; name: string; type?: string },
  confidence: number = 0.95,
  headingAnchorYear?: number
): ExtractedTriple | null {
  if (!source.id || !target.id || !relation || !VALID_RELATIONS.has(relation)) {
    return null;
  }

  let sId = source.id.toLowerCase();
  let sName = source.name;
  let tId = target.id.toLowerCase();
  let tName = target.name;
  let rel = relation;

  // Resolve Deity Titles (except when extracting ALIAS_OF or SAME_AS_LOCATION)
  if (rel !== 'ALIAS_OF' && rel !== 'SAME_AS_LOCATION') {
    const lowerS = sName.toLowerCase();
    if (DEITY_TITLE_MAPPINGS[lowerS]) {
      sId = DEITY_TITLE_MAPPINGS[lowerS].canonicalId;
      sName = DEITY_TITLE_MAPPINGS[lowerS].canonicalName;
    }
    const lowerT = tName.toLowerCase();
    if (DEITY_TITLE_MAPPINGS[lowerT]) {
      tId = DEITY_TITLE_MAPPINGS[lowerT].canonicalId;
      tName = DEITY_TITLE_MAPPINGS[lowerT].canonicalName;
    }
  }

  // Resolve raw numeric years or Can Chi to canonical dynasty/epoch
  if (/^\d{1,4}$/.test(tName) || /^\d{1,4}$/.test(tId.replace(/^[a-z]+_/, ''))) {
    const rawYr = tName.match(/\d{1,4}/)?.[0] || tId.match(/\d{1,4}/)?.[0];
    const yr = parseInt(rawYr || '0', 10);
    if (!isNaN(yr)) {
      const epoch = findHistoricalEpoch(yr);
      if (epoch) {
        tId = epoch.dynastyId;
      }
    }
  }

  // Master Canonical Entity ID Resolution (for all relations EXCEPT ALIAS_OF)
  if (rel !== 'ALIAS_OF') {
    // 1. Resolve Person to Master Canonical ID
    if (sId.startsWith('person_') || source.type === 'HISTORICAL_PERSON') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('person_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('person_') || target.type === 'HISTORICAL_PERSON') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('person_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }

    // 2. Resolve Dynasties / Eras
    if (sId.startsWith('dynasty_') || source.type === 'DYNASTY_ERA') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && (sCanon.entityId.startsWith('dynasty_') || sCanon.entityId.startsWith('epoch_'))) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('dynasty_') || target.type === 'DYNASTY_ERA') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && (tCanon.entityId.startsWith('dynasty_') || tCanon.entityId.startsWith('epoch_'))) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }

    // 3. Resolve Organizations
    if (sId.startsWith('org_') || source.type === 'ORGANIZATION') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('org_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('org_') || target.type === 'ORGANIZATION') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('org_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }

    // 4. Resolve Events
    if (sId.startsWith('event_') || source.type === 'EVENT_BATTLE') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('event_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('event_') || target.type === 'EVENT_BATTLE') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('event_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }

    // 5. Resolve Documents & Artifacts
    if (sId.startsWith('doc_') || source.type === 'DOCUMENT_CULTURE') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('doc_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('doc_') || target.type === 'DOCUMENT_CULTURE') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('doc_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }
    if (sId.startsWith('artifact_') || source.type === 'ARTIFACT') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('artifact_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('artifact_') || target.type === 'ARTIFACT') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('artifact_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }

    // 6. Resolve Locations
    if (sId.startsWith('loc_') || source.type === 'LOCATION') {
      const sCanon = resolveCanonicalEntity(sName) || resolveCanonicalEntity(sId);
      if (sCanon && sCanon.entityId && sCanon.entityId.startsWith('loc_')) {
        sId = sCanon.entityId;
        sName = sCanon.canonicalName || sName;
      }
    }
    if (tId.startsWith('loc_') || target.type === 'LOCATION') {
      const tCanon = resolveCanonicalEntity(tName) || resolveCanonicalEntity(tId);
      if (tCanon && tCanon.entityId && tCanon.entityId.startsWith('loc_')) {
        tId = tCanon.entityId;
        tName = tCanon.canonicalName || tName;
      }
    }
  }

  // Normalize Relation by Entity Target Ontology Type:
  if (rel === 'HAPPENED_IN' && tId.startsWith('loc_')) {
    rel = 'HAPPENED_AT';
  }
  if (rel === 'HAPPENED_AT' && (tId.startsWith('dynasty_') || tId.startsWith('epoch_'))) {
    rel = 'HAPPENED_IN';
  }
  if (rel === 'HAPPENED_IN' && sId.startsWith('person_') && tId.startsWith('dynasty_')) {
    rel = 'PART_OF';
  }
  if (rel === 'LED_BY' && sId.startsWith('dynasty_') && tId.startsWith('person_')) {
    rel = 'PART_OF';
    const tempId = sId;
    const tempName = sName;
    sId = tId;
    sName = tName;
    tId = tempId;
    tName = tempName;
  }
  if (rel === 'PART_OF' && (sId.startsWith('event_') || sId.startsWith('artifact_') || sId.startsWith('doc_')) && (tId.startsWith('dynasty_') || tId.startsWith('epoch_'))) {
    rel = 'HAPPENED_IN';
  }
  if (rel === 'PART_OF' && (sId.startsWith('person_') || sId.startsWith('org_') || sId.startsWith('loc_')) && tId.startsWith('loc_')) {
    rel = 'HAPPENED_AT';
  }
  if (rel === 'LED_BY' && sId.startsWith('person_') && tId.startsWith('loc_')) {
    rel = 'HAPPENED_AT';
  }
  if (rel === 'LED_BY' && sId.startsWith('loc_') && tId.startsWith('person_')) {
    rel = 'HAPPENED_AT';
    const tempId = sId;
    const tempName = sName;
    sId = tId;
    sName = tName;
    tId = tempId;
    tName = tempName;
  }
  if (rel === 'LED_BY' && sId.startsWith('person_') && tId.startsWith('doc_')) {
    rel = 'MENTIONED_IN';
  }
  if (rel === 'LED_BY' && sId.startsWith('doc_') && tId.startsWith('person_')) {
    rel = 'MENTIONED_IN';
    const tempId = sId;
    const tempName = sName;
    sId = tId;
    sName = tName;
    tId = tempId;
    tName = tempName;
  }
  if (rel === 'MENTIONED_IN' && sId.startsWith('doc_') && tId.startsWith('person_')) {
    const tempId = sId;
    const tempName = sName;
    sId = tId;
    sName = tName;
    tId = tempId;
    tName = tempName;
  }
  if (rel === 'MENTIONED_IN' && sId.startsWith('doc_') && (tId.startsWith('dynasty_') || tId.startsWith('epoch_'))) {
    rel = 'HAPPENED_IN';
  }
  if (rel === 'MENTIONED_IN' && (sId.startsWith('dynasty_') || sId.startsWith('epoch_')) && tId.startsWith('doc_')) {
    rel = 'HAPPENED_IN';
    const tempId = sId;
    const tempName = sName;
    sId = tId;
    sName = tName;
    tId = tempId;
    tName = tempName;
  }

  // 1. LED_BY: Event / Battle / Campaign / Organization -> Person / Organization
  if (rel === 'LED_BY') {
    if ((sId.startsWith('person_') || sId.startsWith('org_')) && tId.startsWith('event_')) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
    // Strict Guard: Source must be event or org
    if (!sId.startsWith('event_') && !sId.startsWith('org_')) {
      return null;
    }
    // Target can be person or organization (e.g. event led by org)
    if (!tId.startsWith('person_') && !tId.startsWith('org_')) {
      return null;
    }
  }

  // 2. HAPPENED_AT: Event / Di tích / Công trình / Cổ vật / Nhân vật / Địa danh cụ thể -> Location
  if (rel === 'HAPPENED_AT') {
    if (!tId.startsWith('loc_') && sId.startsWith('loc_')) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
    // Strict Guard: Target MUST be Location
    if (!tId.startsWith('loc_')) {
      return null;
    }
    // Source cannot be dynasty
    if (sId.startsWith('dynasty_')) {
      return null;
    }
  }

  // 3. HAPPENED_IN: Event / Person / Artifact / Document -> Dynasty / Era
  if (rel === 'HAPPENED_IN') {
    if ((sId.startsWith('dynasty_') || sId.startsWith('epoch_')) && (tId.startsWith('event_') || tId.startsWith('person_') || tId.startsWith('artifact_') || tId.startsWith('doc_'))) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
    if (!tId.startsWith('dynasty_') && !tId.startsWith('epoch_')) {
      return null;
    }
    if (sId.startsWith('dynasty_') || sId.startsWith('epoch_') || sId.startsWith('loc_')) {
      return null;
    }
  }

  // 4. SAME_AS_LOCATION: Historical Location -> Modern Location
  if (rel === 'SAME_AS_LOCATION') {
    if (!sId.startsWith('loc_') || !tId.startsWith('loc_')) {
      return null;
    }
    // Rivers, mountains, gulfs cannot be SAME_AS_LOCATION
    if (
      sId.startsWith('loc_song_') || tId.startsWith('loc_song_') ||
      sId.startsWith('loc_nui_') || tId.startsWith('loc_nui_') ||
      sId.startsWith('loc_vinh_ha_long') || tId.startsWith('loc_vinh_ha_long')
    ) {
      return null;
    }
  }

  // 5. MENTIONED_IN: Entity (Person/Org/Dynasty) -> Document
  if (rel === 'MENTIONED_IN') {
    if (sId.startsWith('doc_') && !tId.startsWith('doc_')) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
    if (!tId.startsWith('doc_') || sId.startsWith('doc_')) {
      return null;
    }
    // Only persons, organizations, or dynasties can author or be mentioned in documents
    if (!sId.startsWith('person_') && !sId.startsWith('org_') && !sId.startsWith('dynasty_')) {
      return null;
    }
  }

  // 6. ROYAL_LINEAGE: Person -> Person (Younger successor -> Older predecessor)
  if (rel === 'ROYAL_LINEAGE') {
    if (!sId.startsWith('person_') || !tId.startsWith('person_')) {
      return null;
    }
    const sPerson = HISTORICAL_PERSON_DICTIONARY[sId];
    const tPerson = HISTORICAL_PERSON_DICTIONARY[tId];
    if (sPerson?.timeRange?.start && tPerson?.timeRange?.start) {
      const isBCE = sPerson.timeRange.start < 0 || tPerson.timeRange.start < 0;
      const yearDiff = Math.abs(sPerson.timeRange.start - tPerson.timeRange.start);
      // Royal succession or parent-child lineage cannot span > 120 years unless BCE mythical period
      if (!isBCE && yearDiff > 120) {
        return null;
      }
      if (sPerson.timeRange.start < tPerson.timeRange.start) {
        const tempId = sId;
        const tempName = sName;
        sId = tId;
        sName = tName;
        tId = tempId;
        tName = tempName;
      }
    }
  }

  // Strictly reject ungrounded/hallucinated entities
  if (sId.startsWith('unknown_') || tId.startsWith('unknown_')) {
    return null;
  }

  // HAPPENED_IN: Vietnamese events, artifacts, documents cannot have HAPPENED_IN foreign invading dynasties
  if (rel === 'HAPPENED_IN') {
    if (FOREIGN_DYNASTIES_SET.has(tId) && !FOREIGN_INVADING_FORCES_SET.has(sId) && !isForeignInvadingForce(sId) && !FOREIGN_COMMANDERS_SET.has(sId)) {
      return null;
    }
  }

  // 7. PART_OF: Entity -> Dynasty / Org / State / Event
  if (rel === 'PART_OF') {
    if (sId.startsWith('loc_') && (tId.startsWith('dynasty_') || tId.startsWith('epoch_') || tId.startsWith('loc_'))) {
      return null;
    }
    if (sId.startsWith('dynasty_') && tId.startsWith('loc_')) {
      return null;
    }
    if (sId.startsWith('person_') && tId.startsWith('person_')) {
      return null;
    }
    if (tId.startsWith('person_')) {
      return null;
    }
    if (sId.startsWith('person_') && tId.startsWith('loc_')) {
      return null;
    }
    // Prevent Vietnamese historical figures, events, artifacts from being labeled as PART_OF foreign invading dynasties or forces
    const isTargetForeign = FOREIGN_DYNASTIES_SET.has(tId) || FOREIGN_INVADING_FORCES_SET.has(tId) || isForeignInvadingForce(tId);
    const isSourceForeign = FOREIGN_COMMANDERS_SET.has(sId) || FOREIGN_INVADING_FORCES_SET.has(sId) || isForeignInvadingForce(sId);
    if (isTargetForeign && !isSourceForeign) {
      return null;
    }
    if (isSourceForeign && !isTargetForeign) {
      return null;
    }
  }

  // LED_BY: Foreign invading forces cannot be led by Vietnamese defending commanders, and Vietnamese events cannot be led by foreign commanders
  if (rel === 'LED_BY') {
    if (sId.startsWith('dynasty_') || tId.startsWith('dynasty_')) {
      return null;
    }
    const isSourceForeignForce = FOREIGN_INVADING_FORCES_SET.has(sId) || isForeignInvadingForce(sId);
    const isTargetForeignCommander = FOREIGN_COMMANDERS_SET.has(tId);
    if (isSourceForeignForce && !isTargetForeignCommander) {
      return null;
    }
    if (!isSourceForeignForce && isTargetForeignCommander) {
      return null;
    }
    if (sId.startsWith('person_') && (isSourceForeignForce || isForeignInvadingForce(tId) || FOREIGN_INVADING_FORCES_SET.has(tId) || FOREIGN_COMMANDERS_SET.has(tId))) {
      return null;
    }
  }

  // 8. ALIAS_OF & SAME_AS_LOCATION: Ensure source alias points to target canonical entity
  if (rel === 'ALIAS_OF' || rel === 'SAME_AS_LOCATION') {
    sName = source.name;
    tName = target.name;
    const prefix = getCanonicalEntityIdPrefix(source.type || target.type || (rel === 'SAME_AS_LOCATION' ? 'LOCATION' : 'HISTORICAL_PERSON'));
    const sSlugId = source.id && !source.id.startsWith('unknown_') ? source.id : `${prefix}${slugify(sName)}`;
    const tSlugId = target.id && !target.id.startsWith('unknown_') ? target.id : `${prefix}${slugify(tName)}`;

    sId = sSlugId;
    tId = tSlugId;
  }

  // Type consistency guard for ALIAS_OF & SAME_AS_LOCATION
  if (rel === 'ALIAS_OF') {
    const isPerson = sId.startsWith('person_') && tId.startsWith('person_');
    const isLoc = sId.startsWith('loc_') && tId.startsWith('loc_');
    const isOrg = sId.startsWith('org_') && tId.startsWith('org_');
    if (!isPerson && !isLoc && !isOrg) {
      return null;
    }
    // ALIAS_OF Directional Convention: (Surface Alias -> Master Canonical ID)
    const origSName = sName;
    const origTName = tName;
    const sCanon = resolveCanonicalEntity(origSName) || resolveCanonicalEntity(sId);
    const tCanon = resolveCanonicalEntity(origTName) || resolveCanonicalEntity(tId);
    const master = tCanon?.entityId ? tCanon : (sCanon?.entityId ? sCanon : null);

    const typePrefix = isLoc ? 'loc_' : (isOrg ? 'org_' : 'person_');

    if (master) {
      let aliasName = origSName;
      if (slugify(origSName) === slugify(master.canonicalName) && slugify(origTName) !== slugify(master.canonicalName)) {
        aliasName = origTName;
      } else if (slugify(origTName) === slugify(master.canonicalName) && slugify(origSName) !== slugify(master.canonicalName)) {
        aliasName = origSName;
      } else {
        const sIsCanon = origSName.toLowerCase() === master.canonicalName.toLowerCase();
        const tIsCanon = origTName.toLowerCase() === master.canonicalName.toLowerCase();
        if (sIsCanon && !tIsCanon) {
          aliasName = origTName;
        } else if (tIsCanon && !sIsCanon) {
          aliasName = origSName;
        } else {
          aliasName = origSName !== master.canonicalName ? origSName : origTName;
        }
      }

      sId = `${typePrefix}${slugify(aliasName)}`;
      sName = aliasName;
      tId = master.entityId;
      tName = master.canonicalName;
    } else {
      if (sId === tId && origSName !== origTName) {
        sId = `${typePrefix}${slugify(origSName)}`;
        tId = `${typePrefix}${slugify(origTName)}`;
      }
    }

    if (sId === tId) {
      return null;
    }
  }
  if (rel === 'SAME_AS_LOCATION') {
    if (!sId.startsWith('loc_') || !tId.startsWith('loc_')) {
      return null;
    }
    // Check if mapping is a known historical location mapping (e.g. Thang Long <-> Ha Noi, Tay Do <-> Can Tho/Thanh Hoa, Phong Khe <-> Dong Anh)
    const isKnownLocationMapping = (s: string, t: string) => {
      const pair = `${s}::${t}`;
      const revPair = `${t}::${s}`;
      const ALLOWED_MAPPINGS = new Set([
        'loc_thang_long::loc_ha_noi', 'loc_ha_noi::loc_thang_long',
        'loc_dai_la::loc_ha_noi', 'loc_ha_noi::loc_dai_la',
        'loc_dong_kinh::loc_ha_noi', 'loc_ha_noi::loc_dong_kinh',
        'loc_dong_quan::loc_ha_noi', 'loc_ha_noi::loc_dong_quan',
        'loc_tong_binh::loc_ha_noi', 'loc_ha_noi::loc_tong_binh',
        'loc_tay_do::loc_can_tho', 'loc_can_tho::loc_tay_do',
        'loc_tay_do::loc_thanh_hoa', 'loc_thanh_hoa::loc_tay_do',
        'loc_phong_khe::loc_dong_anh', 'loc_dong_anh::loc_phong_khe',
        'loc_phong_khe::loc_ha_noi', 'loc_ha_noi::loc_phong_khe',
        'loc_ha_tay::loc_ha_noi', 'loc_ha_noi::loc_ha_tay',
        'loc_phu_xuan::loc_hue', 'loc_hue::loc_phu_xuan',
        'loc_thuan_hoa::loc_hue', 'loc_hue::loc_thuan_hoa',
        'loc_hoa_lu::loc_ninh_binh', 'loc_ninh_binh::loc_hoa_lu',
        'loc_sai_gon::loc_ho_chi_minh', 'loc_ho_chi_minh::loc_sai_gon',
        'loc_gia_dinh::loc_ho_chi_minh', 'loc_ho_chi_minh::loc_gia_dinh',
      ]);
      return ALLOWED_MAPPINGS.has(pair) || ALLOWED_MAPPINGS.has(revPair);
    };

    // Reject distinct historical capitals / separate major cities UNLESS they have historical correspondence
    const DISTINCT_CITIES = new Set(['loc_hoa_lu', 'loc_thang_long', 'loc_hue', 'loc_sai_gon', 'loc_da_nang', 'loc_ha_noi', 'loc_can_tho', 'loc_quy_nhon', 'loc_viet_tri']);
    if (DISTINCT_CITIES.has(sId) && DISTINCT_CITIES.has(tId) && sId !== tId && !isKnownLocationMapping(sId, tId)) {
      return null;
    }
    // Specific religious/smaller monuments located in a district/province must be HAPPENED_AT, not SAME_AS_LOCATION
    const MONUMENT_PREFIXES = ['loc_den_', 'loc_chua_', 'loc_lang_', 'loc_don_', 'loc_dinh_', 'loc_thuy_dien_', 'loc_ben_', 'loc_cau_', 'loc_nha_rong', 'loc_the_mieu'];
    if (MONUMENT_PREFIXES.some(p => sId.startsWith(p))) {
      rel = 'HAPPENED_AT';
    }
  }

  // 9. Spatial Hierarchy Directional Normalization (Child -> Parent in HAPPENED_AT)
  if (rel === 'HAPPENED_AT' && sId.startsWith('loc_') && tId.startsWith('loc_')) {
    const sLevel = getSpatialHierarchyLevel(sName, sId);
    const tLevel = getSpatialHierarchyLevel(tName, tId);
    // If source is at a strictly higher administrative/spatial level than target, normalize direction to Child -> Parent
    if (sLevel > tLevel) {
      const tempId = sId; sId = tId; tId = tempId;
      const tempName = sName; sName = tName; tName = tempName;
    }
  }

  // Self-loop prevention
  if (sId === tId) {
    return null;
  }

  return {
    sourceEntityId: sId,
    sourceEntityName: sName,
    relationType: rel,
    targetEntityId: tId,
    targetEntityName: tName,
    confidence: Number(confidence.toFixed(2)),
  };
}

/**
 * Stage 1 Fast-Path Rule-Based & Candidate-Guided Triple Extractor
 */
export function extractTriplesFromText(text: string, options?: { headingAnchorYear?: number }): ExtractedTriple[] {
  if (!text || typeof text !== 'string') return [];

  const isCommentary = isHistorianCommentaryText(text);
  const candidateSpans = extractHistoricalCandidateSpans(text);
  const triples: ExtractedTriple[] = [];

  const persons = candidateSpans.filter((s) => s.type === 'HISTORICAL_PERSON');
  const events = candidateSpans.filter((s) => s.type === 'EVENT_BATTLE');
  const locations = candidateSpans.filter((s) => s.type === 'LOCATION');
  const dynasties = candidateSpans.filter((s) => s.type === 'DYNASTY_ERA');
  const docs = candidateSpans.filter((s) => s.type === 'DOCUMENT_CULTURE');
  const orgs = candidateSpans.filter((s) => s.type === 'ORGANIZATION');
  const artifacts = candidateSpans.filter((s) => s.type === 'ARTIFACT');

  // 1. Link Events -> Leaders (LED_BY) with Strict Action Verb Guard
  if (!isCommentary) {
    for (const ev of events) {
      for (const p of persons) {
        if (ev.startOffset >= p.endOffset) {
          const charDist = ev.startOffset - p.endOffset;
          if (charDist > 65) continue;
          const mid = text.substring(p.endOffset, ev.startOffset).trim();
          if (mid.includes('\n') || mid.includes('.')) continue;
          if (ACTION_VERBS_LED_BY.test(mid) || /\b(lãnh\s+đạo|chỉ\s+huy|thống\s+lĩnh|chủ\s+trì|tiến\s+đánh|đại\s+phá|đánh\s+tan|khởi\s+xướng|chỉ\s+đạo)\b/i.test(mid)) {
            const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
            const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
            const t = validateAndCanonicalizeTriple(
              { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
              'LED_BY',
              { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
              0.98,
              options?.headingAnchorYear
            );
            if (t) triples.push(t);
          }
        } else if (p.startOffset >= ev.endOffset) {
          const charDist = p.startOffset - ev.endOffset;
          if (charDist > 75) continue;
          const mid = text.substring(ev.endOffset, p.startOffset).trim();
          if (mid.includes('\n') || mid.includes('.')) continue;
          const postPersonText = text.substring(p.endOffset, Math.min(text.length, p.endOffset + 35));
          const hasLeaderAction = ACTION_VERBS_LED_BY.test(mid) ||
            /\b(do|dưới\s+sự\s+lãnh\s+đạo\s+của|lãnh\s+đạo|chỉ\s+huy|thống\s+lĩnh|khởi\s+xướng)\b/i.test(mid) ||
            ACTION_VERBS_LED_BY.test(postPersonText) ||
            /\b(lãnh\s+đạo|chỉ\s+huy|khởi\s+xướng|chỉ\s+đạo)\b/i.test(postPersonText);
          if (hasLeaderAction) {
            const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
            const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
            const t = validateAndCanonicalizeTriple(
              { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
              'LED_BY',
              { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
              0.98,
              options?.headingAnchorYear
            );
            if (t) triples.push(t);
          }
        }
      }
    }
  }

  // 2. Link Events -> Locations (HAPPENED_AT)
  for (const ev of events) {
    for (const loc of locations) {
      const minOffset = Math.min(ev.endOffset, loc.endOffset);
      const maxOffset = Math.max(ev.startOffset, loc.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 80 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (/^(?:,\s*)?(?:diễn\s+ra\s+tại|diễn\s+ra\s+ở|tại|ở|trên|trên\s+sông|tại\s+vùng|tại\s+cửa\s+biển|ngoài\s+khơi)(?:\s+(?:thành\s+phố|tỉnh|huyện|thị\s+xã|sông|núi|vùng|đất))?\s*$/i.test(mid) || /\b(tại|ở|trên|diễn\s+ra)\b/i.test(mid) || mid === ',' || mid === '') {
        const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
        const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
          'HAPPENED_AT',
          { id: locId, name: loc.text, type: 'LOCATION' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 2b. Link Persons -> Locations (HAPPENED_AT) with Prepositions & Actions (Bi-directional)
  const STRICT_LOC_PREP_INNER = /^(?:,\s*)?(?:ở\s+tại|ở|tại|đóng\s+đô\s+ở|định\s+đô\s+ở|đóng\s+đô\s+tại|quê\s+ở|sinh\s+tại|mất\s+tại|hy\s+sinh\s+tại|dời\s+đô\s+về|đóng\s+quân\s+tại|đóng\s+quân\s+ở|căn\s+cứ|dựng\s+cờ\s+ở|lên\s+ngôi\s+ở|xây|xây\s+dựng|đắp|lập|dấy\s+binh\s+khởi\s+nghĩa\s+tại|khởi\s+nghĩa\s+tại|lập\s+căn\s+cứ\s+tại|hoạt\s+động\s+tại|tu\s+hành\s+tại|lãnh\s+đạo\s+tại|mở\s+trường\s+tại|ra\s+đi\s+tìm\s+đường\s+cứu\s+nước\s+tại|đọc\s+tuyên\s+ngôn\s+tại|hội\s+đàm\s+tại|tập\s+kết\s+tại|(?:chỉ\s+huy\s+)?(?:tiến\s+về|tiến\s+quân\s+về|tiến\s+đánh|đánh\s+chiếm|giải\s+phóng|hành\s+quân\s+về|hành\s+quân\s+đến|tiến\s+vào))(?:\s+(?:thành\s+phố|tỉnh|huyện|thị\s+xã|vùng|đất))?\s*$/i;
  for (const p of persons) {
    for (const loc of locations) {
      const minOffset = Math.min(p.endOffset, loc.endOffset);
      const maxOffset = Math.max(p.startOffset, loc.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;

      const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
      const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;

      if (
        STRICT_LOC_PREP_INNER.test(mid) ||
        /\b(tại|ở|về|đến|xây|dựng|đóng\s+đô|dời\s+đô|định\s+đô|lên\s+ngôi|chiếm|đại\s+phá|đánh\s+tan|phất\s+cờ|khởi\s+nghĩa|dấy\s+binh|quê|sinh|mất|hy\s+sinh|căn\s+cứ|hoạt\s+động|lãnh\s+đạo|hành\s+quân|tiến\s+về|tiến\s+quân|trên)\b/i.test(mid)
      ) {
        const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
        const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
          'HAPPENED_AT',
          { id: locId, name: loc.text, type: 'LOCATION' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 2c. Link Artifacts & Documents -> Locations (HAPPENED_AT) (Bi-directional)
  for (const item of [...artifacts, ...docs]) {
    for (const loc of locations) {
      const minOffset = Math.min(item.endOffset, loc.endOffset);
      const maxOffset = Math.max(item.startOffset, loc.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (/^(?:,\s*)?(?:được\s+tìm\s+thấy\s+ở|được\s+lưu\s+giữ\s+tại|đặt\s+tại|tại|ở|lưu\s+tại|vang\s+lên\s+trên|viết\s+tại|ra\s+đời\s+tại|đọc\s+tại)(?:\s+(?:thành\s+phố|tỉnh|huyện|thị\s+xã|sông|núi|vùng|đất))?\s*$/i.test(mid) || /\b(ở|tại|trên|tìm\s+thấy|lưu\s+giữ|đặt)\b/i.test(mid)) {
        const itemId = item.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(item.type)}${slugify(item.text)}`;
        const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: itemId, name: item.text, type: item.type },
          'HAPPENED_AT',
          { id: locId, name: loc.text, type: 'LOCATION' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 3. Link Events -> Dynasties / Eras (HAPPENED_IN)
  for (const ev of events) {
    for (const dyn of dynasties) {
      const minOffset = Math.min(ev.endOffset, dyn.endOffset);
      const maxOffset = Math.max(ev.startOffset, dyn.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 90 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (/^(?:,\s*)?(?:thuộc\s+thời|ở\s+thời|dưới\s+thời|thời\s+kỳ|thời|nhà|triều)\s*$/i.test(mid) || mid === '' || /\b(thời|nhà|triều)\b/i.test(mid)) {
        const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
          'HAPPENED_IN',
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 4. Link Documents -> Persons/Entities (MENTIONED_IN)
  const AUTHORSHIP_STRICT = /^(?:,\s*)?(?:do\s+)?(?:soạn|viết|biên\s+soạn|soạn\s+thảo|ban\s+hành|ban|đọc|ngâm|sáng\s+tác|trứ\s+tác|chủ\s+biên|chủ\s+trì|khởi\s+thảo|công\s+bố|của|ghi\s+trong|chép\s+trong|được\s+ghi\s+trong|nhắc\s+đến\s+trong|thuộc\s+về|ký|ký\s+kết|tham\s+gia)\s*$/i;
  for (const doc of docs) {
    for (const item of [...persons, ...orgs, ...events, ...dynasties, ...artifacts]) {
      const minOffset = Math.min(doc.endOffset, item.endOffset);
      const maxOffset = Math.max(doc.startOffset, item.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (AUTHORSHIP_STRICT.test(mid) || mid === '' || /\b(soạn|viết|ban|của|ghi|chép|kể|nhắc|ký|ký\s+kết|thông\s+qua|ban\s+hành|truyền\s+thuyết|trong)\b/i.test(mid)) {
        const docId = doc.suggestedCanonicalId || `doc_${slugify(doc.text)}`;
        const itemId = item.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(item.type)}${slugify(item.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: itemId, name: item.text, type: item.type },
          'MENTIONED_IN',
          { id: docId, name: doc.text, type: 'DOCUMENT_CULTURE' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 4b. Link Documents -> Dynasties (HAPPENED_IN)
  for (const doc of docs) {
    for (const dyn of dynasties) {
      const minOffset = Math.min(doc.endOffset, dyn.endOffset);
      const maxOffset = Math.max(doc.startOffset, dyn.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 100 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (/^(?:,\s*)?(?:thuộc\s+thời|ở\s+thời|dưới\s+thời|thời\s+kỳ|thời|nhà|triều|ra\s+đời\s+thời|ban\s+hành\s+thời)\s*$/i.test(mid) || mid === '' || /\b(thời|nhà|triều)\b/i.test(mid)) {
        const docId = doc.suggestedCanonicalId || `doc_${slugify(doc.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: docId, name: doc.text, type: 'DOCUMENT_CULTURE' },
          'HAPPENED_IN',
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 5. Link Artifacts -> Eras/Dynasties (HAPPENED_IN / PART_OF)
  for (const art of artifacts) {
    for (const dyn of dynasties) {
      const minOffset = Math.min(art.endOffset, dyn.endOffset);
      const maxOffset = Math.max(art.startOffset, dyn.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (/^(?:,\s*)?(?:là\s+biểu\s+tượng\s+văn\s+minh\s+thời\s+đại|thuộc\s+thời\s+kỳ|thuộc\s+thời|thời\s+đại|thời|nhà|triều)\s*$/i.test(mid) || mid === '' || /\b(thời|nhà|triều|văn\s+minh|chế\s+tạo|giúp|thuộc)\b/i.test(mid)) {
        const artId = art.suggestedCanonicalId || `artifact_${slugify(art.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: artId, name: art.text, type: 'ARTIFACT' },
          'HAPPENED_IN',
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 5b. Strict Sovereignty / Dynasty / Organization PART_OF ("vua nhà Lý", "lập nên nhà Âu Lạc", "thuộc triều đại Tây Sơn", "gia nhập Hội Việt Nam Cách mạng Thanh niên")
  const STRICT_SOVEREIGNTY_REGEX = /^(?:,\s*)?(?:là\s+)?(?:vua|hoàng\s+đế|chúa|danh\s+tướng|tướng|thái\s+sư|thái\s+úy|quan)\s+(?:nhà|triều|thời)\s*$/i;
  const STRICT_FOUNDING_REGEX = /^(?:,\s*)?(?:đã\s+)?(?:sáng\s+lập|lập\s+nên|lập\s+ra|dựng\s+nên|thành\s+lập)\s+(?:nhà\s+nước\s+|triều\s+đại\s+|vương\s+triều\s+|nhà\s+|triều\s+|nước\s+)?$/i;
  const STRICT_SUBORDINATION_REGEX = /^(?:,\s*)?(?:thuộc|thuộc\s+về|phò\s+tá|phục\s+vụ|gia\s+nhập|tham\s+gia)(?:\s+(?:triều\s+đại|vương\s+triều|nhà|triều|thời\s+kỳ|thời|tổ\s+chức|phong\s+trào))?\s*$/i;
  const SOVEREIGNTY_KEYWORDS = /\b(vua|hoàng\s+đế|chúa|lập\s+nên|dựng\s+nên|thành\s+lập|sáng\s+lập|củng\s+cố|bảo\s+vệ|chế\s+tạo|phò\s+tá|phục\s+vụ|gia\s+nhập|tham\s+gia|thuộc|thống\s+lĩnh|chỉ\s+huy|lãnh\s+đạo|truất\s+ngôi|lên\s+ngôi|trị\s+vì|cai\s+trị|giúp\s+sức)\b/i;
  for (const p of persons) {
    for (const targetEnt of [...dynasties, ...orgs]) {
      const minOffset = Math.min(p.endOffset, targetEnt.endOffset);
      const maxOffset = Math.max(p.startOffset, targetEnt.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (STRICT_SOVEREIGNTY_REGEX.test(mid) || STRICT_FOUNDING_REGEX.test(mid) || STRICT_SUBORDINATION_REGEX.test(mid) || SOVEREIGNTY_KEYWORDS.test(mid)) {
        const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
        const tId = targetEnt.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(targetEnt.type)}${slugify(targetEnt.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
          'PART_OF',
          { id: tId, name: targetEnt.text, type: targetEnt.type },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 6. Link Organizations -> Leaders (LED_BY) with Strict Action Verb Guard
  if (!isCommentary) {
    for (const org of orgs) {
      for (const p of persons) {
        const minOffset = Math.min(org.endOffset, p.endOffset);
        const maxOffset = Math.max(org.startOffset, p.startOffset);
        const charDist = maxOffset - minOffset;
        if (charDist > 80 || charDist < 0) continue;
        const mid = text.substring(minOffset, maxOffset).trim();
        if (mid.includes('\n') || mid.includes('.')) continue;
        if (ACTION_VERBS_LED_BY.test(mid) || /^(?:,\s*)?(?:do|lãnh\s+đạo|chỉ\s+huy|đứng\s+đầu)\s*$/i.test(mid)) {
          const orgId = org.suggestedCanonicalId || `org_${slugify(org.text)}`;
          const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
          const t = validateAndCanonicalizeTriple(
            { id: orgId, name: org.text, type: 'ORGANIZATION' },
            'LED_BY',
            { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
            0.98,
            options?.headingAnchorYear
          );
          if (t) triples.push(t);
        }
      }
    }
  }

  // 7. Strict ALIAS_OF & SAME_AS_LOCATION (Strictly Adjacent Person-Person or Location-Location)
  const STRICT_ALIAS_REGEX = /^(?:[,\(]\s*)?(?:tức(?:\s+là)?|còn\s+gọi\s+(?:là)?|thường\s+gọi\s+(?:là)?|hay(?:\s+còn\s+gọi\s+là)?|tên\s+khác\s+là|tên\s+thật\s+là|tên\s+húy\s+là|tự\s+là|tự\s+hiệu\s+là|hiệu\s+là|danh\s+xưng\s+là|tôn\s+xưng\s+là|nguyên\s+danh\s+là|niên\s+hiệu\s+là|miếu\s+hiệu\s+là|đổi\s+họ\s+thành|lấy\s+miếu\s+hiệu\s+là|lấy\s+niên\s+hiệu\s+là|xưng\s+là|là\s+danh\s+xưng\s+của|là\s+tôn\s+xưng\s+của|được\s+suy\s+tôn\s+là|được\s+tôn\s+là|được\s+phong\s+là)\s*(?:vua\s+|chúa\s+|chủ\s+tịch\s+|tướng\s+)?$/i;
  const STRICT_SAME_LOC_REGEX = /^(?:[,\(]\s*)?(?:nay\s+là|nay\s+thuộc|xưa\s+thuộc|xưa\s+là|vốn\s+là|còn\s+gọi\s+là|tên\s+cũ\s+là|tên\s+gọi\s+khác\s+là|trước\s+đây\s+là|thời\s+Bắc\s+thuộc\s+nay\s+là|thời\s+xưa\s+nay\s+là)\s*(?:thành\s+phố|tỉnh|huyện|thị\s+xã|địa\s+giới\s+hành\s+chính\s+của\s+tỉnh)?\s*$/i;

  for (let i = 0; i < candidateSpans.length; i++) {
    const s1 = candidateSpans[i];
    for (let j = i + 1; j < candidateSpans.length; j++) {
      const s2 = candidateSpans[j];
      const charDist = s2.startOffset - s1.endOffset;
      if (charDist > 75 || charDist < 0) continue;

      const sub = text.substring(s1.endOffset, s2.startOffset).trim();
      if (sub.includes('\n') || sub.includes('.')) continue;

      // STRICT TYPE MATCHING REQUIRED:
      if (s1.type === 'HISTORICAL_PERSON' && s2.type === 'HISTORICAL_PERSON') {
        if (STRICT_ALIAS_REGEX.test(sub)) {
          const id1 = s1.suggestedCanonicalId || `person_${slugify(s1.text)}`;
          const id2 = s2.suggestedCanonicalId || `person_${slugify(s2.text)}`;
          const t = validateAndCanonicalizeTriple(
            { id: id1, name: s1.text, type: 'HISTORICAL_PERSON' },
            'ALIAS_OF',
            { id: id2, name: s2.text, type: 'HISTORICAL_PERSON' },
            1.0,
            options?.headingAnchorYear
          );
          if (t) triples.push(t);
        }
      } else if (s1.type === 'LOCATION' && s2.type === 'LOCATION') {
        if (/^(?:,\s*)?(?:xưa\s+nay\s+thuộc|nay\s+thuộc|nay\s+là|vốn\s+là|hiện\s+nay\s+là|tương\s+ứng\s+với|chính\s+là|tức\s+là)(?:\s+(?:thành\s+phố|tỉnh|huyện|thị\s+xã|quận|xã|vùng))?\s*$/i.test(sub) || /^(?:,\s*)?(?:kinh\s+đô\s+[^,.]+\s+)?(?:xưa\s+nay\s+thuộc|nay\s+thuộc|nay\s+là)\s*(?:huyện\s+|tỉnh\s+|thành\s+phố\s+)?$/i.test(sub)) {
          const id1 = s1.suggestedCanonicalId || `loc_${slugify(s1.text)}`;
          const id2 = s2.suggestedCanonicalId || `loc_${slugify(s2.text)}`;
          const t = validateAndCanonicalizeTriple(
            { id: id1, name: s1.text, type: 'LOCATION' },
            'SAME_AS_LOCATION',
            { id: id2, name: s2.text, type: 'LOCATION' },
            1.0,
            options?.headingAnchorYear
          );
          if (t) triples.push(t);
        }
      }
    }
  }

  // 8. Merge deterministic parenthetical triples (SAME_AS_LOCATION / ALIAS_OF)
  const syntacticTriples = extractSyntacticParentheticalTriples(text, candidateSpans);
  const seenKeys = new Set(triples.map((t) => `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`));
  for (const st of syntacticTriples) {
    const key = `${st.sourceEntityId}:${st.relationType}:${st.targetEntityId}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      triples.push(st);
    }
  }

  // 8b. Merge deterministic royal lineage triples (genealogy / succession)
  const lineageTriples = extractRoyalLineageTriples(text, candidateSpans);
  for (const lt of lineageTriples) {
    const key = `${lt.sourceEntityId}:${lt.relationType}:${lt.targetEntityId}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      triples.push(lt);
    }
  }

  // 9. Merge deterministic spatial hierarchy triples (nested locations)
  const spatialTriples = extractSpatialHierarchyTriples(text, candidateSpans);
  for (const spt of spatialTriples) {
    const key = `${spt.sourceEntityId}:${spt.relationType}:${spt.targetEntityId}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      triples.push(spt);
    }
  }

  // 10. Guarded Macro Header Banner Context Propagation
  // When text contains a hierarchical banner [Kỷ/Triều Đại: <Dynasty>], safely propagate the macro dynasty/era
  // to artifacts, cultural documents, domestic events, and founding/sovereignty figures.
  const bannerDynastyMatch = text.match(/\[(?:Kỷ\/Triều\s*Đại|Triều\s*Đại|Kỷ):\s*([^\]]+)\]/i);
  if (bannerDynastyMatch) {
    const rawBannerDynasty = bannerDynastyMatch[1].trim();
    const resolvedBannerDyn = resolveCanonicalEntity(rawBannerDynasty);
    const bannerDynId = (resolvedBannerDyn?.entityId && (resolvedBannerDyn.entityId.startsWith('dynasty_') || resolvedBannerDyn.entityId.startsWith('epoch_')))
      ? resolvedBannerDyn.entityId
      : (dynasties.find((d) => d.suggestedCanonicalId?.startsWith('dynasty_') || d.suggestedCanonicalId?.startsWith('epoch_'))?.suggestedCanonicalId || `dynasty_${slugify(rawBannerDynasty)}`);

    if (bannerDynId && (bannerDynId.startsWith('dynasty_') || bannerDynId.startsWith('epoch_'))) {
      const bannerDynName = resolvedBannerDyn?.canonicalName || rawBannerDynasty;

      // 10a. Link Artifacts & Documents to Banner Dynasty (HAPPENED_IN)
      for (const item of [...artifacts, ...docs]) {
        const itemId = item.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(item.type)}${slugify(item.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: itemId, name: item.text, type: item.type },
          'HAPPENED_IN',
          { id: bannerDynId, name: bannerDynName, type: 'DYNASTY_ERA' },
          0.95,
          options?.headingAnchorYear
        );
        if (t) {
          const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            triples.push(t);
          }
        }
      }

      // 10b. Link Events & Battles to Banner Dynasty (HAPPENED_IN)
      for (const ev of events) {
        const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
          'HAPPENED_IN',
          { id: bannerDynId, name: bannerDynName, type: 'DYNASTY_ERA' },
          0.94,
          options?.headingAnchorYear
        );
        if (t) {
          const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            triples.push(t);
          }
        }
      }

      // 10c. Link Sovereignty / Founding figures with explicit state actions (PART_OF Banner Dynasty)
      const SOVEREIGNTY_VERBS = /\b(vua|hoàng\s+đế|thái\s+thượng\s+hoàng|chúa|xưng\s+vương|lập\s+quốc|lập\s+nên|lập\s+ra|dựng\s+nước|dời\s+đô|định\s+đô|đóng\s+đô|lên\s+ngôi|trị\s+vì|sáng\s+lập|thành\s+lập|tướng\s+quốc|thái\s+sư|thái\s+úy|nghĩa\s+quân|khởi\s+nghĩa|đầu\s+quân|phò\s+tá|phụng\s+sự|lãnh\s+đạo|chủ\s+trì|tổng\s+bí\s+thư|thủ\s+tướng|chủ\s+tịch)\b/i;
      for (const p of persons) {
        const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
        const minOffset = Math.max(0, p.startOffset - 80);
        const maxOffset = Math.min(text.length, p.endOffset + 80);
        const snippet = text.substring(minOffset, maxOffset);
        if (SOVEREIGNTY_VERBS.test(snippet)) {
          const t = validateAndCanonicalizeTriple(
            { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
            'PART_OF',
            { id: bannerDynId, name: bannerDynName, type: 'DYNASTY_ERA' },
            0.95,
            options?.headingAnchorYear
          );
          if (t) {
            const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              triples.push(t);
            }
          }
        }
      }
    }
  }

  return triples;
}

export const MAX_CANDIDATE_SPANS_IN_PROMPT = 30;

/**
 * Stage 2 Lightweight LLM Extraction with Disk Cache & Exponential Backoff
 */
export async function extractTriplesWithLLMDetailed(
  text: string,
  options?: ExtractionOptions
): Promise<{ triples: ExtractedTriple[]; candidateSpans: CandidateEntitySpan[]; res?: any; error?: string }> {
  const candidateSpans = extractHistoricalCandidateSpans(text);

  // 1. Check Disk Cache first (unless skipCache is requested)
  if (!options?.skipCache) {
    try {
      const cached = await extractionCache.get(text);
      if (cached !== null && Array.isArray(cached)) {
        return {
          triples: cached,
          candidateSpans,
          res: {
            provider: (cached as any)?._meta?.provider || 'LOCAL_CACHE',
            model: (cached as any)?._meta?.model || 'disk_cache',
            cached: true,
          },
        };
      }
    } catch {
      // Non-fatal cache lookup failure
    }
  }

  // Deduplicate unique candidate entities for compact prompt while preserving natural reading order
  const seenCandidateKeys = new Set<string>();
  const uniqueCandidateSpans = candidateSpans.filter((c) => {
    const key = `${c.type}:${c.text.trim().toLowerCase()}`;
    if (seenCandidateKeys.has(key)) return false;
    seenCandidateKeys.add(key);
    return true;
  });

  const promptCandidateSpans = uniqueCandidateSpans.slice(0, MAX_CANDIDATE_SPANS_IN_PROMPT);

  // Pure Geographic Distractor Guard: If text has only locations and no historical events/actions/sites/toponyms, return 0 triples
  const hasHistoricalTypes = promptCandidateSpans.some((c) => c.type !== 'LOCATION');
  const locSpans = promptCandidateSpans.filter((s) => s.type === 'LOCATION');
  const HISTORICAL_ACTION_KEYWORDS = /\b(chiến thắng|đại thắng|đánh tan|đánh đuổi|khởi nghĩa|dấy binh|đóng đô|dời đô|lên ngôi|sáng lập|thành lập|trị vì|xây dựng|khánh thành|chiếm|giải phóng|ký kết|ban hành|soạn thảo|tác phẩm|tiêu biểu|đối đầu|phò tá|tu hành|được tôn|sáng chế|lập ra|lập nên|khẩn hoang|đúc|phong cho|họp|hội nghị|vương triều|triều đại|công cuộc|thuộc|tọa lạc|nằm tại|trên dòng|thương cảng|kinh thành|đô thành|di tích|thành trì|cổ thành|thành cổ|đồn|bến|cửa biển|chiến dịch|trận|bùng nổ|xâm lược|phản công|gia nhập|gọi là|còn gọi|đổi tên|tên là|mang tên|tên gọi|tên cũ|huyết mạch|tuyến đường|tuyến|địa giới|hành chính|xưa nay|tương ứng|vốn là|trước đây)\b/i;
  if (!hasHistoricalTypes && !HISTORICAL_ACTION_KEYWORDS.test(text) && locSpans.length < 2) {
    return {
      triples: [],
      candidateSpans,
      res: { provider: 'DISTRACTOR_GUARD', model: 'rule_guard' },
    };
  }

  // Build categorized representation for clean LLM context
  const enumMap = new Map<string, CandidateEntitySpan>();
  const personSpans = promptCandidateSpans.filter((s) => s.type === 'HISTORICAL_PERSON');
  const dynSpans = promptCandidateSpans.filter((s) => s.type === 'DYNASTY_ERA');
  const evSpans = promptCandidateSpans.filter((s) => s.type === 'EVENT_BATTLE');
  const orgSpans = promptCandidateSpans.filter((s) => s.type === 'ORGANIZATION');
  const artSpans = promptCandidateSpans.filter((s) => s.type === 'ARTIFACT');
  const docSpans = promptCandidateSpans.filter((s) => s.type === 'DOCUMENT_CULTURE');

  const buildDistinctSpanId = (span: CandidateEntitySpan): string => {
    // If multiple candidate spans share the same suggestedCanonicalId, disambiguate using text slug
    const sameCanonicalCount = promptCandidateSpans.filter(
      (c) => c.suggestedCanonicalId && c.suggestedCanonicalId === span.suggestedCanonicalId
    ).length;
    if (sameCanonicalCount > 1) {
      const prefix = getCanonicalEntityIdPrefix(span.type);
      return `${prefix}${slugify(span.text)}`;
    }
    return span.suggestedCanonicalId || buildCanonicalId(span.text, span.type);
  };

  const categorizedLines: string[] = [];
  if (personSpans.length > 0) {
    categorizedLines.push(`- NHÂN VẬT & LÃNH ĐẠO (HISTORICAL PERSON / LEADER): ${personSpans.map((s) => `"${s.text}" [ID: ${buildDistinctSpanId(s)}]`).join(', ')}`);
  }
  const geoEventOrgSpans = [...locSpans, ...dynSpans, ...evSpans, ...orgSpans];
  if (geoEventOrgSpans.length > 0) {
    categorizedLines.push(`- ĐỊA BÀN, CHIẾN TRẬN, TỔ CHỨC & TRIỀU ĐẠI (LOCATION / EVENT / DYNASTY / ORG): ${geoEventOrgSpans.map((s) => `"${s.text}" [ID: ${buildDistinctSpanId(s)}]`).join(', ')}`);
  }
  const docArtSpans = [...artSpans, ...docSpans];
  if (docArtSpans.length > 0) {
    categorizedLines.push(`- VĂN KIỆN, HIỆP ĐỊNH & CỔ VẬT (DOCUMENT / ARTIFACT): ${docArtSpans.map((s) => `"${s.text}" [ID: ${buildDistinctSpanId(s)}]`).join(', ')}`);
  }

  promptCandidateSpans.forEach((span, idx) => {
    const code = `E${idx + 1}`;
    const distinctId = buildDistinctSpanId(span);
    enumMap.set(code, span);
    enumMap.set(distinctId.toLowerCase(), span);
    if (span.suggestedCanonicalId) {
      enumMap.set(span.suggestedCanonicalId.toLowerCase(), span);
    }
    enumMap.set(span.text.toLowerCase(), span);
    enumMap.set(normalizeHistoricalMention(span.text).toLowerCase(), span);
  });

  // Register contextual epithets and title pronouns to the leading person in snippet
  const leadPerson = personSpans[0];
  if (leadPerson) {
    const ANAPHORA_SYNONYMS = [
      'người đứng đầu chính phủ',
      'người đứng đầu',
      'vị tư lệnh',
      'tư lệnh',
      'tổng tư lệnh',
      'vị tổng tư lệnh',
      'vị thủ lĩnh',
      'vị thủ lĩnh cần vương',
      'thủ lĩnh cần vương',
      'vị anh hùng áo vải',
      'anh hùng áo vải',
      'người anh hùng áo vải',
      'vị anh hùng',
      'người anh hùng dân tộc',
      'vị danh tướng',
      'vị tướng lĩnh',
      'vị lãnh tụ',
      'lãnh tụ',
      'nhà vua',
      'hoàng đế',
      'vua',
      'vị hoàng đế',
      'quân vương',
      'chúa tiên',
      'vạn thắng vương',
      'bình định vương',
      'hưng đạo đại vương',
      'hưng đạo vương',
      'đức thánh trần',
    ];
    for (const syn of ANAPHORA_SYNONYMS) {
      if (!enumMap.has(syn)) {
        enumMap.set(syn, leadPerson);
      }
    }
  }

  try {
    const systemPrompt = `Bạn là Extraction Engine trích xuất Đồ thị Tri thức Lịch sử Việt Nam (ChronoViet Knowledge Graph).
Nhiệm vụ: Trích xuất TOÀN BỘ các bộ ba quan hệ ngữ nghĩa (s -> r -> o) giữa các thực thể đã cho trong danh sách.

8 LOẠI QUAN HỆ CHUẨN:
1. LED_BY: [Trận đánh / Khởi nghĩa / Chiến dịch / Tổ chức / Công trình / Khoa thi] -> LED_BY -> [Người chỉ huy / Lãnh đạo / Chủ trì]
2. HAPPENED_AT: [Nhân vật / Sự kiện / Địa danh con / Di tích / Công trình / Văn kiện / Cổ vật] -> HAPPENED_AT -> [Địa danh / Tỉnh / Huyện / Núi / Sông]
3. HAPPENED_IN: [Sự kiện / Di tích / Văn kiện / Bộ luật / Cổ vật / Tác phẩm] -> HAPPENED_IN -> [Triều đại / Thời kỳ / Kỷ nguyên]
4. PART_OF: [Nhân vật / Người tham gia / Quốc gia / Vua / Tướng / Người đỗ đạt] -> PART_OF -> [Triều đại / Tổ chức / Phong trào / Khoa thi / Tổ chức quốc tế]
5. SAME_AS_LOCATION: [Địa danh cổ / Cố danh / Tên cũ] -> SAME_AS_LOCATION -> [Địa danh hiện đại / Tên mới]
6. ALIAS_OF: [Tên khác / Tên húy / Tự hiệu / Danh hiệu / Tuyến đường khác] -> ALIAS_OF -> [Tên chuẩn chính thức]
7. ROYAL_LINEAGE: [Vua con / Người kế vị] -> ROYAL_LINEAGE -> [Vua cha / Tiền nhân]
8. MENTIONED_IN: [Tác giả / Người ban hành / Soạn thảo / Ký kết / Quốc gia / Nhân vật xuất hiện] -> MENTIONED_IN -> [Tác phẩm / Bộ luật / Chiếu / Hịch / Văn kiện / Hiệp định / Di chúc]

QUY TẮC RÀ SOÁT VÉT CẠN (EXHAUSTIVE EXTRACTION):
- Dời đô từ A về B: Trích xuất [Nhân vật] HAPPENED_AT [A], [Nhân vật] HAPPENED_AT [B], và nếu có Chiếu dời đô: [Chiếu dời đô] HAPPENED_AT [A] và [Chiếu dời đô] HAPPENED_AT [B].
- Kinh lược / Mở đất / Lập phủ tại A: [Nhân vật] HAPPENED_AT [A] và [Nhân vật] PART_OF [Triều đại/Chúa].
- Soạn thảo / Ban hành / San định Văn kiện / Bộ luật: [Nhân vật] MENTIONED_IN [Văn kiện], [Văn kiện] HAPPENED_IN [Triều đại].
- Mở khoa thi / Tham gia phong trào: [Khoa thi] LED_BY [Vua/Chủ trì], [Người đỗ đạt] PART_OF [Khoa thi].
- Quốc gia gia nhập Tổ chức Quốc tế / Ký Điều ước: [Quốc gia] PART_OF [Tổ chức quốc tế], [Quốc gia] MENTIONED_IN [Hiệp định/Điều ước].
- Đồng tham chiếu (Anaphora): Đại từ/danh xưng tôn xưng (Vị danh tướng, Vị thủ lĩnh, Tổng Tư lệnh, Hoàng đế, Người đứng đầu chính phủ...) quy về ID nhân vật chủ thể đã nêu trước đó.

RÀNG BUỘC PHỦ ĐỊNH (ANTI-PATTERNS):
- CHỈ sử dụng ID thực thể có trong danh sách được cấp hoặc xuất hiện trong văn bản. TUYỆT ĐỐI KHÔNG tự bịa thực thể mới.
- Triều đại KHÔNG BAO GIỜ là PART_OF của Địa danh (và ngược lại).
- Không gán tướng lĩnh/nhân vật PART_OF hoặc LED_BY quân xâm lược.

VÍ DỤ MẪU (GENERIC SLOTS):
Ví dụ 1 (Nhân vật, Địa bàn, Triều đại & Công trình):
Văn bản: "Vua An Dương Vương xây Loa Thành tại Phong Khê để bảo vệ nhà nước Âu Lạc."
{"triples": [
  {"s": "person_an_duong_vuong", "r": "PART_OF", "o": "dynasty_au_lac"},
  {"s": "person_an_duong_vuong", "r": "HAPPENED_AT", "o": "loc_thanh_co_loa"},
  {"s": "loc_thanh_co_loa", "r": "HAPPENED_AT", "o": "loc_phong_khe"},
  {"s": "loc_thanh_co_loa", "r": "HAPPENED_IN", "o": "dynasty_au_lac"}
]}

Ví dụ 2 (Dời đô từ A về B & Chiếu dời đô):
Văn bản: "Lý Thái Tổ ban Chiếu dời đô dời kinh đô từ Hoa Lư về Thăng Long."
{"triples": [
  {"s": "person_ly_thai_to", "r": "MENTIONED_IN", "o": "doc_chieu_doi_do"},
  {"s": "person_ly_thai_to", "r": "HAPPENED_AT", "o": "loc_hoa_lu"},
  {"s": "person_ly_thai_to", "r": "HAPPENED_AT", "o": "loc_thang_long"},
  {"s": "doc_chieu_doi_do", "r": "HAPPENED_AT", "o": "loc_hoa_lu"},
  {"s": "doc_chieu_doi_do", "r": "HAPPENED_AT", "o": "loc_thang_long"}
]}

Ví dụ 3 (Đồng tham chiếu, Khởi nghĩa & Nhiều nhân vật):
Văn bản: "Phan Đình Phùng lãnh đạo khởi nghĩa Hương Khê. Vị thủ lĩnh đã cùng Cao Thắng xây căn cứ tại Vụ Quang Hà Tĩnh."
{"triples": [
  {"s": "event_khoi_nghia_huong_khe", "r": "LED_BY", "o": "person_phan_dinh_phung"},
  {"s": "person_phan_dinh_phung", "r": "HAPPENED_AT", "o": "loc_vu_quang"},
  {"s": "person_phan_dinh_phung", "r": "HAPPENED_AT", "o": "loc_ha_tinh"},
  {"s": "person_cao_thang", "r": "HAPPENED_AT", "o": "loc_vu_quang"},
  {"s": "loc_vu_quang", "r": "HAPPENED_AT", "o": "loc_ha_tinh"}
]}

Ví dụ 4 (Quốc gia gia nhập Tổ chức Quốc tế / Ký Điều ước):
Văn bản: "Việt Nam chính thức gia nhập WTO và ký kết Hiệp định BTA mở ra thời kỳ hội nhập."
{"triples": [
  {"s": "dynasty_viet_nam", "r": "PART_OF", "o": "org_wto"},
  {"s": "dynasty_viet_nam", "r": "MENTIONED_IN", "o": "doc_hiep_dinh_bta"}
]}

ĐẦU RA DUY NHẤT (JSON):
{
  "triples": [
    { "s": "ID_HOẶC_TÊN_THỰC_THỂ_1", "r": "TÊN_QUAN_HỆ", "o": "ID_HOẶC_TÊN_THỰC_THỂ_2" }
  ]
}`;

    const userPrompt = `DANH SÁCH THỰC THỂ CÓ TRONG VĂN BẢN:
${categorizedLines.join('\n')}

VĂN BẢN (TEXT):
"""
${text}
"""

Hãy rà soát kỹ từng thực thể (Địa bàn HAPPENED_AT, Lãnh đạo LED_BY, Quy thuộc PART_OF/HAPPENED_IN/MENTIONED_IN, Kế vị ROYAL_LINEAGE, Tên hiệu ALIAS_OF/SAME_AS_LOCATION) để trích xuất JSON mảng ĐẦY ĐỦ toàn bộ các quan hệ chính xác:`;

    const callLlm = async (prompt: string, initialTemperature: number, maxTokens: number) => {
      // 4-tier exponential backoff (500ms, 1000ms, 2000ms, 4000ms) with temperature decay for Qwen 3.5 4B
      let attempt = 0;
      let lastErr: any;
      const maxRetries = 4;

      while (attempt < maxRetries) {
        try {
          return await generateLLMCompletion(
            [
              { role: 'system', content: prompt },
              { role: 'user', content: userPrompt },
            ],
            {
              task: 'extraction',
              temperature: initialTemperature,
              max_tokens: maxTokens,
              response_format: { type: 'json_object' },
              timeoutMs:
                options?.timeoutMs ??
                (envConfig.USE_LOCAL_LLM ? (envConfig.LOCAL_LLM_TIMEOUT_MS || 15000) : envConfig.REMOTE_FALLBACK_TIMEOUT_MS),
            }
          );
        } catch (err: any) {
          lastErr = err;
          attempt++;
          if (attempt < maxRetries) {
            const backoffMs = 500 * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, backoffMs));
          }
        }
      }
      throw lastErr;
    };

    const resolveEntityFromRaw = (
      rawName?: string,
      rawId?: string
    ): { id: string; name: string; type?: string } | null => {
      const raw = (rawId || rawName || '').trim();
      if (!raw) return null;
      const s = raw.replace(/^(?:\[?id[:_\s-]*|entity[:_\s-]*)/i, '').replace(/[\])]+$/, '').trim();
      if (!s) return null;
      const sLower = s.toLowerCase();
      const rawLower = raw.toLowerCase();

      // 1. Direct slot code or distinct ID lookup in enumMap
      if (enumMap.has(sLower)) {
        const matched = enumMap.get(sLower)!;
        return {
          id: buildDistinctSpanId(matched),
          name: matched.text,
          type: matched.type,
        };
      }
      if (enumMap.has(rawLower)) {
        const matched = enumMap.get(rawLower)!;
        return {
          id: buildDistinctSpanId(matched),
          name: matched.text,
          type: matched.type,
        };
      }

      const codeMatch = s.match(/^(?:\[|\()?E(\d+)(?:\]|\))?(?::|\s*[-–—]\s*|\s+.*)?$/i) || s.match(/\bE(\d+)\b/i);
      if (codeMatch) {
        const code = `E${codeMatch[1]}`;
        if (enumMap.has(code)) {
          const matched = enumMap.get(code)!;
          return {
            id: buildDistinctSpanId(matched),
            name: matched.text,
            type: matched.type,
          };
        }
      }

      // 2. Direct ID lookup in Candidate Spans by distinctId or suggestedCanonicalId
      const candidateById = candidateSpans.find(
        (c) => buildDistinctSpanId(c).toLowerCase() === sLower || c.suggestedCanonicalId?.toLowerCase() === sLower
      );
      if (candidateById) {
        return {
          id: buildDistinctSpanId(candidateById),
          name: candidateById.text,
          type: candidateById.type,
        };
      }

      // 3. Direct Name lookup in Candidate Spans
      const candidateByText = candidateSpans.find(
        (c) => c.text.toLowerCase() === sLower || normalizeHistoricalMention(c.text).toLowerCase() === sLower
      );
      if (candidateByText) {
        return {
          id: buildDistinctSpanId(candidateByText),
          name: candidateByText.text,
          type: candidateByText.type,
        };
      }

      // 4. Mention snapping fallback
      const snapped = snapMentionToCandidate(s, candidateSpans);
      if (snapped) {
        return { id: snapped.id, name: snapped.name, type: snapped.type };
      }

      const directCanon = resolveCanonicalEntity(s) || resolveCanonicalEntity(normalizeHistoricalMention(s));
      if (directCanon && directCanon.entityId && !directCanon.entityId.startsWith('unknown_')) {
        const isPrimary = slugify(directCanon.canonicalName) === slugify(s);
        return {
          id: isPrimary ? directCanon.entityId : buildCanonicalId(s, directCanon.type),
          name: directCanon.canonicalName || s,
          type: directCanon.type,
        };
      }

      return null;
    };

    const NEGATION_PATTERNS = /\b(không|chẳng|chưa|chưa từng|bác bỏ|phản đối|bất thành|thất bại|không thể|không phải|không được|bất phân|không phục)\b/i;

    const parseContentToRawTriples = (content: string): { rawTriples: any[]; parseFailed: boolean } => {
      let jsonStr = content.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/^[\s\S]*?```json\s*/i, '').replace(/\s*```[\s\S]*$/, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/^[\s\S]*?```\s*/, '').replace(/\s*```[\s\S]*$/, '');
      }

      let rawTriples: any[] = [];
      let parseFailed = false;

      // Pre-heal common JSON syntax flaws from quantized models (e.g. "o": "E4} -> "o": "E4"})
      const healedJsonStr = jsonStr
        .replace(/"(E\d+)(?=[,}])/g, '"$1"')
        .replace(/"([a-zA-Z0-9_-]+)(?=[,}])/g, '"$1"');

      try {
        const parsed = JSON.parse(healedJsonStr);
        if (parsed && Array.isArray(parsed.triples)) {
          rawTriples = parsed.triples;
        } else if (Array.isArray(parsed)) {
          rawTriples = parsed;
        }
      } catch {
        parseFailed = true;
        const cleanVal = (v?: string) => (v ? v.trim().replace(/^["']|["']$/g, '') : undefined);
        // Tolerant regex fallback supporting quoted strings with spaces or unquoted tokens
        const objectRegex = /\{\s*"(?:s|source(?:Entity)?)"\s*:\s*(?:"([^"]+)"|([^,}\s]+))\s*,\s*(?:"source(?:Entity)?Id"\s*:\s*(?:"([^"]+)"|([^,}\s]+))\s*,\s*)?"(?:r|rel|relation(?:Type)?)"\s*:\s*(?:"([^"]+)"|([^,}\s]+))\s*,\s*"(?:o|target(?:Entity)?)"\s*:\s*(?:"([^"]+)"|([^,}\s]+))(?:,\s*"(?:target(?:Entity)?Id)"\s*:\s*(?:"([^"]+)"|([^,}\s]+)))?(?:,\s*"(?:evidence)"\s*:\s*"([^"]+)")?(?:,\s*"(?:confidence)"\s*:\s*([0-9.]+))?\s*\}/g;
        let match;
        while ((match = objectRegex.exec(jsonStr)) !== null) {
          rawTriples.push({
            s: cleanVal(match[1] || match[2]),
            sourceEntityId: cleanVal(match[3] || match[4]),
            rel: cleanVal(match[5] || match[6]),
            o: cleanVal(match[7] || match[8]),
            targetEntityId: cleanVal(match[9] || match[10]),
            evidence: cleanVal(match[11]),
            confidence: match[12] ? parseFloat(match[12]) : 0.95,
          });
        }
      }
      return { rawTriples, parseFailed };
    };

    const parseAndValidateResult = (content: string): { triples: ExtractedTriple[]; parseFailed: boolean } => {
      const p = parseContentToRawTriples(content);
      const allRaw = p.rawTriples;
      const parseFailed = p.parseFailed && allRaw.length === 0;

      const validatedTriples: ExtractedTriple[] = [];
      const seenKeys = new Set<string>();
      const textLower = text.toLowerCase();

      for (const raw of allRaw) {
        if (process.env.DEBUG_EXTRACTION) {
          console.log('[DEBUG_EXTRACTION] Raw item:', raw);
        }
        const sRaw = raw.s || raw.sourceEntity || raw.source;
        const sRawId = raw.sourceEntityId || raw.sourceId;
        const tRaw = raw.o || raw.targetEntity || raw.target;
        const tRawId = raw.targetEntityId || raw.targetId;
        const relRaw = (raw.r || raw.rel || raw.relationType || raw.relation || '').trim().toUpperCase() as HistoricalRelationType;

        if (!relRaw || !VALID_RELATIONS.has(relRaw)) continue;

        // Negation Gate: reject if evidence explicitly contains negation
        if (raw.evidence && typeof raw.evidence === 'string' && NEGATION_PATTERNS.test(raw.evidence)) {
          continue;
        }

        const resolvedS = resolveEntityFromRaw(sRaw, sRawId);
        const resolvedT = resolveEntityFromRaw(tRaw, tRawId);

        if (!resolvedS || !resolvedT) continue;

        // Evidence Grounding Verification
        let conf = raw.confidence ?? 0.95;
        if (raw.evidence && typeof raw.evidence === 'string') {
          const evClean = raw.evidence.trim().toLowerCase();
          if (evClean.length >= 3 && textLower.includes(evClean)) {
            conf = Math.min(1.0, conf + 0.03);
          }
        }

        const validated = validateAndCanonicalizeTriple(
          resolvedS,
          relRaw,
          resolvedT,
          conf,
          options?.headingAnchorYear
        );

        if (validated) {
          const key = `${validated.sourceEntityId}:${validated.relationType}:${validated.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            validatedTriples.push(validated);
          }
        }
      }

      // Existing entity pairs already covered by LLM or preceding extractions
      const hasPair = (idA: string, idB: string) => {
        const a = idA.toLowerCase();
        const b = idB.toLowerCase();
        return validatedTriples.some((vt) => {
          const va = vt.sourceEntityId.toLowerCase();
          const vb = vt.targetEntityId.toLowerCase();
          return (va === a && vb === b) || (va === b && vb === a);
        });
      };

      // 1. Add deterministic syntactic parenthetical triples (SAME_AS_LOCATION / ALIAS_OF)
      const syntacticTriples = extractSyntacticParentheticalTriples(text, candidateSpans);
      for (const st of syntacticTriples) {
        const key = `${st.sourceEntityId}:${st.relationType}:${st.targetEntityId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          validatedTriples.push(st);
        }
      }

      // 2. Add deterministic royal lineage triples (genealogy / succession)
      const lineageTriples = extractRoyalLineageTriples(text, candidateSpans);
      for (const lt of lineageTriples) {
        const key = `${lt.sourceEntityId}:${lt.relationType}:${lt.targetEntityId}`;
        if (!seenKeys.has(key) && !hasPair(lt.sourceEntityId, lt.targetEntityId)) {
          seenKeys.add(key);
          validatedTriples.push(lt);
        }
      }

      // 3. Complementary Residual Extraction for remaining high-precision syntactic patterns
      const spatialTriples = extractSpatialHierarchyTriples(text, candidateSpans);
      for (const spt of spatialTriples) {
        const key = `${spt.sourceEntityId}:${spt.relationType}:${spt.targetEntityId}`;
        if (!seenKeys.has(key) && !hasPair(spt.sourceEntityId, spt.targetEntityId)) {
          seenKeys.add(key);
          validatedTriples.push(spt);
        }
      }

      const docTriples = extractSyntacticDocumentTriples(text, candidateSpans);
      for (const dt of docTriples) {
        const key = `${dt.sourceEntityId}:${dt.relationType}:${dt.targetEntityId}`;
        if (!seenKeys.has(key) && !hasPair(dt.sourceEntityId, dt.targetEntityId)) {
          seenKeys.add(key);
          validatedTriples.push(dt);
        }
      }

      const dynTriples = extractSyntacticDynasticTriples(text, candidateSpans);
      for (const dynt of dynTriples) {
        const key = `${dynt.sourceEntityId}:${dynt.relationType}:${dynt.targetEntityId}`;
        const hasExistingDynasty = validatedTriples.some(
          (vt) =>
            vt.sourceEntityId.toLowerCase() === dynt.sourceEntityId.toLowerCase() &&
            (vt.relationType === 'PART_OF' || vt.relationType === 'HAPPENED_IN')
        );
        if (!seenKeys.has(key) && !hasPair(dynt.sourceEntityId, dynt.targetEntityId) && !hasExistingDynasty) {
          seenKeys.add(key);
          validatedTriples.push(dynt);
        }
      }

      return { triples: validatedTriples, parseFailed };
    };

    // Execute Unified Single-Pass Extraction with Qwen 3.5 4B
    const res = await callLlm(systemPrompt, 0.0, 450);
    let parsedResult = parseAndValidateResult(res.content || '');

    // Persist to Disk Cache (unless skipCache is requested)
    if (!options?.skipCache && !parsedResult.parseFailed) {
      await extractionCache.set(
        text,
        options?.chunkId || `chunk_${Date.now()}`,
        parsedResult.triples,
        { provider: res?.provider, model: res?.model }
      ).catch(() => {});
    }

    return {
      triples: parsedResult.triples,
      candidateSpans,
      res,
    };
  } catch (err) {
    const errMsg = formatConciseError(err);

    const isStrict = options?.strict !== false && (options?.strict === true || envConfig.EVAL_STRICT || !options?.allowFallback);

    if (isStrict) {
      throw new Error(`Stage 2 LLM Triple Extraction failed: ${errMsg}. Pass allowFallback=true for offline fallback.`);
    }

    if (!warnedLlmOffline) {
      log.warn('triple_extract.llm_offline', 'LLM extraction offline; using Stage 1 guided fallback', { reason: errMsg });
      logFallbackAlert({
        subsystem: 'LLM_GATEWAY',
        primaryTarget: `Local LLM Extraction (Port 8094) [qwen3.5-4b-instruct-q4_k_m]`,
        fallbackTarget: 'Stage 1 Candidate-Guided Rule Extractor',
        reason: errMsg,
        actionRequired: 'Start extraction server on port 8094 with: pnpm ai:extract or pnpm ai:lite',
      });
      warnedLlmOffline = true;
    }

    // Use deterministic Stage 1 candidate-guided triples as graceful fallback only when allowFallback=true
    const fallbackTriples = extractTriplesFromText(text, options);
    return {
      triples: fallbackTriples,
      candidateSpans,
      error: errMsg,
    };
  }
}

/**
 * Asynchronous two-tier ensemble extraction with detailed execution telemetry
 */
export async function extractTriplesFromTextDetailedAsync(
  text: string,
  options?: ExtractionOptions
): Promise<DetailedExtractionResult> {
  const startTime = Date.now();
  const fastPathTriples = extractTriplesFromText(text, options);

  if (options?.regexOnly) {
    return {
      triples: fastPathTriples,
      strategy: 'regex_only',
      durationMs: Date.now() - startTime,
    };
  }

  const { triples: llmTriples, candidateSpans, res, error } = await extractTriplesWithLLMDetailed(text, options);

  // 3-Stage Ensemble Fusion & Deduplication Gate:
  // Combines high-confidence deterministic Stage 1 Fast-Path Triples with Stage 2 Semantic LLM Triples
  const finalTriples: ExtractedTriple[] = [];
  const seenKeys = new Set<string>();

  const addTriple = (t: ExtractedTriple) => {
    const key = `${t.sourceEntityId.toLowerCase()}::${t.relationType.toUpperCase()}::${t.targetEntityId.toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      finalTriples.push(t);
    }
  };

  // 1. Add LLM Triples (which already include deterministic syntactic and lineage triples)
  if (llmTriples && Array.isArray(llmTriples) && llmTriples.length > 0) {
    for (const t of llmTriples) {
      addTriple(t);
    }
    // Safely merge deterministic triples (ALIAS_OF, SAME_AS_LOCATION, ROYAL_LINEAGE, or high-confidence LED_BY) for untouched pairs
    const hasPair = (idA: string, idB: string) => {
      const a = idA.toLowerCase();
      const b = idB.toLowerCase();
      return finalTriples.some((vt) => {
        const va = vt.sourceEntityId.toLowerCase();
        const vb = vt.targetEntityId.toLowerCase();
        return (va === a && vb === b) || (va === b && vb === a);
      });
    };
    for (const ft of fastPathTriples) {
      if (!hasPair(ft.sourceEntityId, ft.targetEntityId)) {
        if (
          ft.relationType === 'ALIAS_OF' ||
          ft.relationType === 'SAME_AS_LOCATION' ||
          ft.relationType === 'ROYAL_LINEAGE' ||
          ft.relationType === 'MENTIONED_IN' ||
          ft.relationType === 'HAPPENED_IN' ||
          ft.confidence >= 0.95
        ) {
          addTriple(ft);
        }
      }
    }
  } else {
    // 2. Fallback to Fast-Path Triples ONLY when LLM is unavailable or produces no output
    for (const t of fastPathTriples) {
      addTriple(t);
    }
  }

  const durationMs = Date.now() - startTime;
  const strategy: DetailedExtractionResult['strategy'] = error ? 'rule_based_fallback' : 'ensemble_ai';
  const isCached = (llmTriples as any)?._meta?.cached === true || res?.cached === true;

  return {
    triples: finalTriples,
    candidateSpans,
    provider: res?.provider,
    targetProvider: res?.targetProvider,
    targetId: res?.targetId,
    model: res?.model,
    strategy,
    durationMs: isCached ? 0 : durationMs,
    llmError: error,
    cached: isCached,
  };
}

/**
 * Asynchronous two-tier ensemble extraction combining Stage 1 NER & Stage 2 LLM Engine
 */
export async function extractTriplesFromTextAsync(
  text: string,
  options?: ExtractionOptions
): Promise<ExtractedTriple[]> {
  const detailed = await extractTriplesFromTextDetailedAsync(text, options);
  const triples = detailed.triples;
  (triples as any)._meta = {
    provider: detailed.provider,
    targetProvider: detailed.targetProvider,
    targetId: detailed.targetId,
    model: detailed.model,
    durationMs: detailed.durationMs,
    strategy: detailed.strategy,
    llmError: detailed.llmError,
    cached: detailed.cached ?? false,
  };
  return triples;
}

/**
 * Extract triples using LLM (Direct array wrapper)
 */
export async function extractTriplesWithLLM(
  text: string,
  options?: ExtractionOptions
): Promise<ExtractedTriple[]> {
  const result = await extractTriplesWithLLMDetailed(text, options);
  return result.triples;
}

/**
 * 3-Step Historical Conflict Resolution Protocol
 */
export function resolveHistoricalConflict(
  edgeA: { confidence: number; sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'; sourceName?: string },
  edgeB: { confidence: number; sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'; sourceName?: string }
): { action: 'KEEP_A' | 'KEEP_B' | 'MULTI_PERSPECTIVE'; rationale: string } {
  const wA = edgeA.sourceReliability === 'LEVEL_1' ? 1.0 : edgeA.sourceReliability === 'LEVEL_2' ? 0.8 : 0.5;
  const wB = edgeB.sourceReliability === 'LEVEL_1' ? 1.0 : edgeB.sourceReliability === 'LEVEL_2' ? 0.8 : 0.5;

  const scoreA = edgeA.confidence * wA;
  const scoreB = edgeB.confidence * wB;
  const delta = Math.abs(scoreA - scoreB);

  if ((edgeA.sourceReliability === 'LEVEL_1' && edgeB.sourceReliability === 'LEVEL_1') || delta <= 0.15) {
    return {
      action: 'MULTI_PERSPECTIVE',
      rationale: `Protracted debate threshold met (delta=${delta.toFixed(2)} <= 0.15 or both Level 1). Storing both perspectives.`,
    };
  }

  if (scoreA > scoreB) {
    return { action: 'KEEP_A', rationale: `Edge A score (${scoreA.toFixed(2)}) > Edge B score (${scoreB.toFixed(2)})` };
  } else {
    return { action: 'KEEP_B', rationale: `Edge B score (${scoreB.toFixed(2)}) >= Edge A score (${scoreA.toFixed(2)})` };
  }
}
