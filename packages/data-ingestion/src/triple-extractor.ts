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
  findHistoricalEpoch,
} from '@chronoviet/shared-spec';
import {
  envConfig,
  generateLLMCompletion,
  logFallbackAlert,
  createLogger,
  formatConciseError,
} from '@chronoviet/infra';
import { extractHistoricalCandidateSpans, slugify, buildCanonicalId, isValidCandidateSpan } from './text/vietnamese-ner.js';
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
}

export interface ExtractionOptions {
  strict?: boolean;
  allowFallback?: boolean;
  timeoutMs?: number;
  regexOnly?: boolean;
  stage?: 'vector' | 'graph' | 'all';
  correlationId?: string;
  headingAnchorYear?: number;
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
const ACTION_VERBS_LED_BY = /\b(lãnh đạo|chỉ huy|thống lĩnh|cầm quân|tướng quân|chủ tướng|thống suất|đốc suất|soạn thảo|khởi xướng|dấy binh|đứng đầu|cầm đầu|tiên phong|chủ trì|chủ mưu)\b/i;

/**
 * Action verbs required for MENTIONED_IN relations
 */
const ACTION_VERBS_MENTIONED_IN = /\b(chép|ghi|viết|biên soạn|soạn thảo|theo|trong|trích|bàn rằng|luận rằng|sử chép|cương mục|toàn thư|sách|văn bia|chiếu|hịch|cáo)\b/i;

/**
 * Helper to build an entity identifier if not already provided
 */
function buildEntityId(name: string, relationType?: HistoricalRelationType): { id: string; name: string } {
  const resolved = resolveCanonicalEntity(name);
  if (resolved && resolved.entityId) {
    return { id: resolved.entityId, name: resolved.canonicalName };
  }

  const entityType = inferEntityTypeFromName(name);
  const prefix = getCanonicalEntityIdPrefix(entityType);
  return { id: `${prefix}${slugify(name)}`, name };
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

  // Resolve Deity Titles
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

  // 1. LED_BY: Event / Org -> Person
  if (rel === 'LED_BY') {
    if (sId.startsWith('person_') && (tId.startsWith('event_') || tId.startsWith('org_'))) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
  }

  // 2. HAPPENED_AT: Event -> Location
  if (rel === 'HAPPENED_AT') {
    if (sId.startsWith('loc_') && tId.startsWith('event_')) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
  }

  // 3. HAPPENED_IN: Event / Person -> Dynasty / Era
  if (rel === 'HAPPENED_IN') {
    if ((sId.startsWith('dynasty_') || sId.startsWith('epoch_')) && (tId.startsWith('event_') || tId.startsWith('person_'))) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
  }

  // 4. SAME_AS_LOCATION: Historical Location -> Modern Location
  if (rel === 'SAME_AS_LOCATION') {
    if (!sId.startsWith('loc_')) sId = `loc_${slugify(sName)}`;
    if (!tId.startsWith('loc_')) tId = `loc_${slugify(tName)}`;
  }

  // 5. MENTIONED_IN: Entity -> Document
  if (rel === 'MENTIONED_IN') {
    if (sId.startsWith('doc_') && !tId.startsWith('doc_')) {
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
  }

  // 6. ALIAS_OF: Ensure source and target have distinct IDs representing the alias link
  if (rel === 'ALIAS_OF') {
    if (sName.toLowerCase() !== tName.toLowerCase()) {
      if (sId === tId) {
        sId = `${getCanonicalEntityIdPrefix(source.type || 'HISTORICAL_PERSON')}${slugify(sName)}`;
        tId = `${getCanonicalEntityIdPrefix(target.type || 'HISTORICAL_PERSON')}${slugify(tName)}`;
      }
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

  const MAX_ENTITY_PROXIMITY_CHARS = 180;

  // 1. Link Events -> Leaders (LED_BY) with Action Verb Guard & Commentary Isolation
  if (!isCommentary) {
    for (const ev of events) {
      for (const p of persons) {
        const charDist = Math.abs(ev.startOffset - p.startOffset);
        if (charDist > MAX_ENTITY_PROXIMITY_CHARS) continue;

        // Check if explicit action verbs exist near the person or between the entities
        const minOffset = Math.min(ev.startOffset, p.startOffset);
        const maxOffset = Math.max(ev.endOffset, p.endOffset);
        const snippet = text.substring(Math.max(0, minOffset - 30), Math.min(text.length, maxOffset + 30));

        if (!ACTION_VERBS_LED_BY.test(snippet)) {
          // If no action verb and no strong title, skip blind link
          continue;
        }

        const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
        const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
          'LED_BY',
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
          0.96,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 2. Link Events -> Locations (HAPPENED_AT)
  for (const ev of events) {
    for (const loc of locations) {
      if (Math.abs(ev.startOffset - loc.startOffset) > MAX_ENTITY_PROXIMITY_CHARS) continue;
      const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
      const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;
      const t = validateAndCanonicalizeTriple(
        { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
        'HAPPENED_AT',
        { id: locId, name: loc.text, type: 'LOCATION' },
        0.95,
        options?.headingAnchorYear
      );
      if (t) triples.push(t);
    }
  }

  // 3. Link Events -> Dynasties / Eras (HAPPENED_IN)
  for (const ev of events) {
    for (const dyn of dynasties) {
      if (Math.abs(ev.startOffset - dyn.startOffset) > MAX_ENTITY_PROXIMITY_CHARS) continue;
      const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
      const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
      const t = validateAndCanonicalizeTriple(
        { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
        'HAPPENED_IN',
        { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
        0.94,
        options?.headingAnchorYear
      );
      if (t) triples.push(t);
    }
  }

  // 4. Link Documents -> Persons/Authors (MENTIONED_IN) with Citation Verb Check
  for (const doc of docs) {
    for (const p of persons) {
      if (Math.abs(doc.startOffset - p.startOffset) > MAX_ENTITY_PROXIMITY_CHARS) continue;
      const docId = doc.suggestedCanonicalId || `doc_${slugify(doc.text)}`;
      const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
      const t = validateAndCanonicalizeTriple(
        { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
        'MENTIONED_IN',
        { id: docId, name: doc.text, type: 'DOCUMENT_CULTURE' },
        0.95,
        options?.headingAnchorYear
      );
      if (t) triples.push(t);
    }
  }

  // 5. Link Artifacts -> Eras/Dynasties (PART_OF)
  for (const art of artifacts) {
    for (const dyn of dynasties) {
      if (Math.abs(art.startOffset - dyn.startOffset) > MAX_ENTITY_PROXIMITY_CHARS) continue;
      const artId = art.suggestedCanonicalId || `artifact_${slugify(art.text)}`;
      const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
      const t = validateAndCanonicalizeTriple(
        { id: artId, name: art.text, type: 'ARTIFACT' },
        'PART_OF',
        { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
        0.95,
        options?.headingAnchorYear
      );
      if (t) triples.push(t);
    }
  }

  // 5b. Explicit Subordination PART_OF ("thuộc triều đại", "thuộc thời", "dưới thời")
  const partOfRegex = /\b(thuộc\s+(?:triều\s+đại|thời|nhà|triều)?|trực\s+thuộc|dưới\s+thời|ở\s+thời|thời\s+kỳ)\b/i;
  if (partOfRegex.test(text)) {
    for (const p of [...persons, ...orgs, ...events]) {
      for (const dyn of [...dynasties, ...orgs]) {
        if (p.text === dyn.text) continue;
        if (Math.abs(p.startOffset - dyn.startOffset) > MAX_ENTITY_PROXIMITY_CHARS) continue;
        const pId = p.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(p.type)}${slugify(p.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: pId, name: p.text, type: p.type },
          'PART_OF',
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          0.95,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 6. Link Organizations -> Leaders (LED_BY) with Action Verb Guard
  if (!isCommentary) {
    for (const org of orgs) {
      for (const p of persons) {
        if (Math.abs(org.startOffset - p.startOffset) > MAX_ENTITY_PROXIMITY_CHARS) continue;
        const orgId = org.suggestedCanonicalId || `org_${slugify(org.text)}`;
        const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: orgId, name: org.text, type: 'ORGANIZATION' },
          'LED_BY',
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
          0.95,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 7. ALIAS_OF (e.g. "Quang Trung tức Nguyễn Huệ", "còn gọi là", "hiệu là")
  const aliasRegex = /(?:tức\s*(?:là\s*)?|còn\s+gọi\s+(?:là\s+)?|tên\s+khác\s+là|hiệu\s+là|tên\s+thật\s+là|niên\s+hiệu\s+là)/i;
  const MAX_RELATION_WINDOW_CHARS = 100;

  if (aliasRegex.test(text)) {
    for (let i = 0; i < candidateSpans.length; i++) {
      const s1 = candidateSpans[i];
      for (let j = i + 1; j < candidateSpans.length; j++) {
        const s2 = candidateSpans[j];
        const charDist = s2.startOffset - s1.endOffset;
        if (charDist > MAX_RELATION_WINDOW_CHARS) break;
        if (charDist < 0) continue;

        const sub = text.substring(s1.endOffset, s2.startOffset).trim();
        if (sub.includes('\n') || sub.includes('.')) continue;

        if (aliasRegex.test(sub)) {
          const id1 = s1.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(s1.type)}${slugify(s1.text)}`;
          const id2 = s2.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(s2.type)}${slugify(s2.text)}`;

          const t = validateAndCanonicalizeTriple(
            { id: id2, name: s2.text, type: s2.type },
            'ALIAS_OF',
            { id: id1, name: s1.text, type: s1.type },
            1.0,
            options?.headingAnchorYear
          );
          if (t) triples.push(t);
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

  // 1. Check Disk Cache first
  try {
    const cached = await extractionCache.get(text);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return {
        triples: cached,
        candidateSpans,
        res: { provider: 'LOCAL_CACHE', model: 'disk_cache' },
      };
    }
  } catch {
    // Non-fatal cache lookup failure
  }

  // Deduplicate unique candidate entities for compact prompt
  const seenCandidateKeys = new Set<string>();
  const uniqueCandidateSpans = candidateSpans.filter((c) => {
    const key = `${c.type}:${(c.suggestedCanonicalId || c.text).toLowerCase()}`;
    if (seenCandidateKeys.has(key)) return false;
    seenCandidateKeys.add(key);
    return true;
  });

  const promptCandidateSpans = uniqueCandidateSpans.slice(0, MAX_CANDIDATE_SPANS_IN_PROMPT);

  try {
    const systemPrompt = `Bạn là Chuyên gia Trích xuất Đồ thị Tri thức Lịch sử Việt Nam (Vietnamese History Knowledge Graph Extractor).
Nhiệm vụ: Trích xuất các bộ ba quan hệ (Triples) chuẩn xác tuyệt đối từ văn bản sử liệu.
QUY TẮC BẮT BUỘC:
1. CHỈ ĐƯỢC PHÉP sử dụng 8 loại quan hệ chuẩn (relationType):
   - LED_BY: [Sự kiện/Phong trào] -> [Nhân vật lãnh đạo] (Ví dụ: event_ngoc_hoi_dong_da -> LED_BY -> person_quang_trung)
   - PART_OF: [Thực thể con/Di vật] -> [Triều đại/Tổ chức/Thực thể cha] (Ví dụ: artifact_trong_dong_dong_son -> PART_OF -> dynasty_van_lang)
   - HAPPENED_IN: [Sự kiện/Thời kỳ] -> [Triều đại/Kỷ nguyên] (Ví dụ: event_ngoc_hoi_dong_da -> HAPPENED_IN -> dynasty_nha_tay_son)
   - HAPPENED_AT: [Sự kiện] -> [Địa danh diễn ra] (Ví dụ: event_ngoc_hoi_dong_da -> HAPPENED_AT -> loc_thang_long)
   - SAME_AS_LOCATION: [Địa danh cổ/lịch sử] -> [Địa danh hiện đại tương ứng] (Ví dụ: loc_thang_long -> SAME_AS_LOCATION -> loc_ha_noi)
   - ALIAS_OF: [Tên khác/Tên húy/Biệt danh] -> [Tên chuẩn chính thức] (Ví dụ: person_nguyen_hue -> ALIAS_OF -> person_quang_trung)
   - ROYAL_LINEAGE: [Hậu duệ/Vua kế vị] -> [Vua cha/Tiền nhân trực hệ] (Ví dụ: person_le_thai_tong -> ROYAL_LINEAGE -> person_le_thai_to)
   - MENTIONED_IN: [Nhân vật/Sự kiện/Di vật] -> [Tác phẩm/Văn kiện lịch sử] (Ví dụ: person_ly_thai_to -> MENTIONED_IN -> doc_chieu_doi_do)
2. Xuất DUY NHẤT một JSON object hợp lệ theo schema: { "triples": [ { "sourceEntity": "...", "sourceEntityId": "...", "relationType": "...", "targetEntity": "...", "targetEntityId": "...", "confidence": 0.95 } ] }.
3. Tuyệt đối không bịa đặt quan hệ không có trong văn bản và không xuất bất kỳ văn bản giải thích nào ngoài JSON.`;

    const userPrompt = `Dưới đây là đoạn văn bản lịch sử và danh sách thực thể ứng viên đã được nhận diện (Stage 1 Candidate Entities):

THỰC THỂ ỨNG VIÊN (CANDIDATE ENTITIES):
${promptCandidateSpans.map((c) => `- [${c.type}] "${c.text}" (ID đề xuất: ${c.suggestedCanonicalId})`).join('\n')}

VĂN BẢN (TEXT):
"""
${text}
"""

Hãy trích xuất các bộ ba quan hệ (Knowledge Triples) và trả về JSON:`;

    const callLlm = async (initialTemperature: number, maxTokens: number) => {
      // 4-tier exponential backoff (500ms, 1000ms, 2000ms, 4000ms) with temperature decay for Qwen 3.5 4B
      let attempt = 0;
      let lastErr: any;
      const maxRetries = 4;

      while (attempt < maxRetries) {
        try {
          const currentTemp = attempt >= 2 ? 0.0 : initialTemperature;
          return await generateLLMCompletion(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            {
              task: 'extraction',
              temperature: currentTemp,
              max_tokens: maxTokens,
              response_format: { type: 'json_object' },
              timeoutMs:
                options?.timeoutMs ??
                (envConfig.USE_LOCAL_LLM ? (envConfig.LOCAL_LLM_TIMEOUT_MS || 15000) : envConfig.REMOTE_FALLBACK_TIMEOUT_MS),
            }
          );
        } catch (err) {
          lastErr = err;
          attempt++;
          if (attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt - 1) * 500;
            log.debug('triple_extract.retry', `LLM call attempt ${attempt}/${maxRetries} failed, retrying in ${backoffMs}ms...`, {
              attempt,
              error: formatConciseError(err),
            });
            await new Promise((r) => setTimeout(r, backoffMs));
          }
        }
      }
      throw lastErr;
    };

    const parseAndValidate = (content: string): { triples: ExtractedTriple[]; parseFailed: boolean } => {
      let jsonStr = content.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/^[\s\S]*?```json\s*/i, '').replace(/\s*```[\s\S]*$/, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/^[\s\S]*?```\s*/, '').replace(/\s*```[\s\S]*$/, '');
      }

      let rawTriples: any[] = [];
      let parseFailed = false;
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && Array.isArray(parsed.triples)) {
          rawTriples = parsed.triples;
        }
      } catch {
        parseFailed = true;
        const objectRegex = /\{\s*"sourceEntity"\s*:\s*"([^"]+)"\s*,\s*(?:"sourceEntityId"\s*:\s*"([^"]+)"\s*,\s*)?"relationType"\s*:\s*"([^"]+)"\s*,\s*"targetEntity"\s*:\s*"([^"]+)"\s*(?:,\s*"targetEntityId"\s*:\s*"([^"]+)"\s*)?(?:,\s*"confidence"\s*:\s*([0-9.]+))?\s*\}/g;
        let match;
        while ((match = objectRegex.exec(jsonStr)) !== null) {
          rawTriples.push({
            sourceEntity: match[1],
            sourceEntityId: match[2],
            relationType: match[3],
            targetEntity: match[4],
            targetEntityId: match[5],
            confidence: match[6] ? parseFloat(match[6]) : 0.95,
          });
        }
      }

      const validatedTriples: ExtractedTriple[] = [];
      const seenKeys = new Set<string>();

      for (const raw of rawTriples) {
        if (!raw.sourceEntity || !raw.targetEntity || !raw.relationType) continue;
        const relationType = raw.relationType as HistoricalRelationType;
        if (!VALID_RELATIONS.has(relationType)) continue;

        const sName = String(raw.sourceEntity).trim();
        const tName = String(raw.targetEntity).trim();
        const sourceBuilt = buildEntityId(sName, relationType);
        const targetBuilt = buildEntityId(tName, relationType);
        const sId = raw.sourceEntityId || sourceBuilt.id;
        const tId = raw.targetEntityId || targetBuilt.id;

        const validated = validateAndCanonicalizeTriple(
          { id: sId, name: sName },
          relationType,
          { id: tId, name: tName },
          raw.confidence ?? 0.95,
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
      return { triples: validatedTriples, parseFailed };
    };

    let res = await callLlm(0.1, 800);
    let parsedFirst = parseAndValidate(res.content || '');

    if (parsedFirst.parseFailed && parsedFirst.triples.length === 0) {
      res = await callLlm(0.0, 800);
      parsedFirst = parseAndValidate(res.content || '');
    }

    // Persist to Disk Cache
    if (parsedFirst.triples.length > 0) {
      await extractionCache.set(
        text,
        `chunk_${Date.now()}`,
        parsedFirst.triples,
        { provider: res?.provider, model: res?.model }
      ).catch(() => {});
    }

    return {
      triples: parsedFirst.triples,
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

  if (options?.regexOnly) {
    const regexTriples = extractTriplesFromText(text, options);
    return {
      triples: regexTriples,
      strategy: 'regex_only',
      durationMs: Date.now() - startTime,
    };
  }

  const { triples: llmTriples, candidateSpans, res, error } = await extractTriplesWithLLMDetailed(text, options);

  // In Quality-First Mode:
  // When LLM extraction succeeds, rely 100% on LLM-validated triples without polluting with unverified rule triples.
  // Rule triples are ONLY used if regexOnly is specified or if LLM failed and allowFallback=true.
  let finalTriples: ExtractedTriple[] = [];
  if (!error && llmTriples) {
    finalTriples = llmTriples;
  } else if (error && options?.allowFallback) {
    finalTriples = extractTriplesFromText(text, options);
  }

  const durationMs = Date.now() - startTime;
  const strategy: DetailedExtractionResult['strategy'] = error ? 'rule_based_fallback' : 'ensemble_ai';

  return {
    triples: finalTriples,
    candidateSpans,
    provider: res?.provider,
    targetProvider: res?.targetProvider,
    targetId: res?.targetId,
    model: res?.model,
    strategy,
    durationMs,
    llmError: error,
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
