/**
 * 2-Stage Knowledge Graph Triple Extractor (Subject -> Relation -> Object)
 * Component 2 of Module 0 Data Preprocessing & Ingestion ETL Engine
 *
 * Characteristics:
 * - 2-Stage Pipeline:
 *   Stage 1: Pure TS Vietnamese Historical NER Candidate Extractor (< 1ms)
 *   Stage 2: Lightweight LLM (Qwen3.5-4B-Instruct Q4_K_M on Port 8094) / Fallback Engine
 * - Strict Canonical Directionality Validation Matrix
 * - Constrained Historical Relation Taxonomy (8 Canonical Types)
 */

import {
  resolveCanonicalEntity,
  envConfig,
  generateLLMCompletion,
  logFallbackAlert,
  createLogger,
  formatConciseError,
  HistoricalRelationType,
  CandidateEntitySpan,
  getCanonicalEntityIdPrefix,
} from '@chronoviet/shared-spec';
import { extractHistoricalCandidateSpans, slugify, buildCanonicalId, isValidCandidateSpan } from './text/vietnamese-ner.js';

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
}

let warnedLlmOffline = false;

const VALID_RELATIONS = new Set<HistoricalRelationType>([
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
 * Validate and enforce Canonical Directionality Matrix ($S \to R \to O$)
 */
export function validateAndCanonicalizeTriple(
  source: { id: string; name: string; type?: string },
  relation: HistoricalRelationType,
  target: { id: string; name: string; type?: string },
  confidence: number = 0.95
): ExtractedTriple | null {
  if (!source.id || !target.id || !relation || !VALID_RELATIONS.has(relation)) {
    return null;
  }

  let sId = source.id.toLowerCase();
  let sName = source.name;
  let tId = target.id.toLowerCase();
  let tName = target.name;
  let rel = relation;

  // 1. LED_BY: Event / Movement / Org -> Person
  if (rel === 'LED_BY') {
    if (sId.startsWith('person_') && (tId.startsWith('event_') || tId.startsWith('org_'))) {
      // Invert: Person -[LED_BY]-> Event => Event -[LED_BY]-> Person
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
      // Invert: Loc -[HAPPENED_AT]-> Event => Event -[HAPPENED_AT]-> Loc
      const tempId = sId;
      const tempName = sName;
      sId = tId;
      sName = tName;
      tId = tempId;
      tName = tempName;
    }
  }

  // 3. HAPPENED_IN: Event -> Dynasty / Era
  if (rel === 'HAPPENED_IN') {
    if (sId.startsWith('dynasty_') && tId.startsWith('event_')) {
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
export function extractTriplesFromText(text: string): ExtractedTriple[] {
  if (!text || typeof text !== 'string') return [];

  const candidateSpans = extractHistoricalCandidateSpans(text);
  const triples: ExtractedTriple[] = [];
  const textLower = text.toLowerCase();

  // Find candidate by category
  const persons = candidateSpans.filter((s) => s.type === 'HISTORICAL_PERSON');
  const events = candidateSpans.filter((s) => s.type === 'EVENT_BATTLE');
  const locations = candidateSpans.filter((s) => s.type === 'LOCATION');
  const dynasties = candidateSpans.filter((s) => s.type === 'DYNASTY_ERA');
  const docs = candidateSpans.filter((s) => s.type === 'DOCUMENT_CULTURE');
  const orgs = candidateSpans.filter((s) => s.type === 'ORGANIZATION');
  const artifacts = candidateSpans.filter((s) => s.type === 'ARTIFACT');

  const MAX_ENTITY_PROXIMITY_CHARS = 200;

  // 1. Link Events -> Leaders (LED_BY)
  for (const ev of events) {
    for (const p of persons) {
      if (Math.abs(ev.startOffset - p.startOffset) > MAX_ENTITY_PROXIMITY_CHARS) continue;
      const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
      const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
      const t = validateAndCanonicalizeTriple(
        { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
        'LED_BY',
        { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
        0.96
      );
      if (t) triples.push(t);
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
        0.95
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
        0.94
      );
      if (t) triples.push(t);
    }
  }

  // 4. Link Documents -> Persons/Authors (MENTIONED_IN)
  for (const doc of docs) {
    for (const p of persons) {
      if (Math.abs(doc.startOffset - p.startOffset) > MAX_ENTITY_PROXIMITY_CHARS) continue;
      const docId = doc.suggestedCanonicalId || `doc_${slugify(doc.text)}`;
      const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
      const t = validateAndCanonicalizeTriple(
        { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
        'MENTIONED_IN',
        { id: docId, name: doc.text, type: 'DOCUMENT_CULTURE' },
        0.95
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
        0.95
      );
      if (t) triples.push(t);
    }
  }

  // 6. Link Organizations -> Leaders (LED_BY)
  for (const org of orgs) {
    for (const p of persons) {
      if (Math.abs(org.startOffset - p.startOffset) > MAX_ENTITY_PROXIMITY_CHARS) continue;
      const orgId = org.suggestedCanonicalId || `org_${slugify(org.text)}`;
      const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
      const t = validateAndCanonicalizeTriple(
        { id: orgId, name: org.text, type: 'ORGANIZATION' },
        'LED_BY',
        { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
        0.95
      );
      if (t) triples.push(t);
    }
  }

  // 7. ALIAS_OF (e.g. "Quang Trung tức là Nguyễn Huệ", "còn gọi là", "hiệu là")
  const aliasRegex = /(?:tức\s+là|còn\s+gọi\s+là|tên\s+khác\s+là|hiệu\s+là|tên\s+thật\s+là|niên\s+hiệu\s+là)/i;
  const MAX_RELATION_WINDOW_CHARS = 100;

  if (aliasRegex.test(text)) {
    for (let i = 0; i < candidateSpans.length; i++) {
      const s1 = candidateSpans[i];
      for (let j = i + 1; j < candidateSpans.length; j++) {
        const s2 = candidateSpans[j];
        const charDist = s2.startOffset - s1.endOffset;
        if (charDist > MAX_RELATION_WINDOW_CHARS) break; // candidateSpans is sorted by startOffset; early exit
        if (charDist < 0) continue;

        const sub = text.substring(s1.endOffset, s2.startOffset).trim();
        if (sub.includes('\n') || sub.includes('.')) continue; // Never bridge across sentences

        if (aliasRegex.test(sub) && s1.text.toLowerCase() !== s2.text.toLowerCase()) {
          const sId = buildCanonicalId(s1.text, s1.type);
          const tId = buildCanonicalId(s2.text, s2.type);
          const t = validateAndCanonicalizeTriple(
            { id: sId, name: s1.text },
            'ALIAS_OF',
            { id: tId, name: s2.text },
            1.0
          );
          if (t) triples.push(t);
        }
      }
    }
  }

  // 8. PART_OF (e.g. "Nguyễn Huệ thuộc triều đại Tây Sơn", "nằm trong", "thuộc")
  const partOfRegex = /(?:thuộc\s+(?:triều\s+đại|nước|tập\s+đoàn|đội\s+quân)?|nằm\s+trong|là\s+một\s+phần\s+của)/i;
  if (partOfRegex.test(text)) {
    for (let i = 0; i < candidateSpans.length; i++) {
      const s1 = candidateSpans[i];
      for (let j = i + 1; j < candidateSpans.length; j++) {
        const s2 = candidateSpans[j];
        const charDist = s2.startOffset - s1.endOffset;
        if (charDist > MAX_RELATION_WINDOW_CHARS) break; // candidateSpans is sorted by startOffset; early exit
        if (charDist < 0) continue;

        const sub = text.substring(s1.endOffset, s2.startOffset).trim();
        if (sub.includes('\n') || sub.includes('.')) continue; // Never bridge across sentences

        if (partOfRegex.test(sub)) {
          const t = validateAndCanonicalizeTriple(
            { id: s1.suggestedCanonicalId || `ent_${slugify(s1.text)}`, name: s1.text },
            'PART_OF',
            { id: s2.suggestedCanonicalId || `dynasty_${slugify(s2.text)}`, name: s2.text },
            0.95
          );
          if (t) triples.push(t);
        }
      }
    }
  }

  // Deduplicate triples
  const uniqueMap = new Map<string, ExtractedTriple>();
  for (const t of triples) {
    const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, t);
    }
  }

  return Array.from(uniqueMap.values());
}

export const MAX_CANDIDATE_SPANS_IN_PROMPT = 30;

/**
 * Stage 2 Lightweight LLM Extraction (Port 8094 / Qwen3.5-4B-Instruct)
 */
export async function extractTriplesWithLLMDetailed(
  text: string,
  options?: ExtractionOptions
): Promise<{ triples: ExtractedTriple[]; candidateSpans: CandidateEntitySpan[]; res?: any; error?: string }> {
  // Stage 1: Extract Candidate Spans first
  const candidateSpans = extractHistoricalCandidateSpans(text);

  // Deduplicate unique candidate entities for compact and token-efficient prompt
  const seenCandidateKeys = new Set<string>();
  const uniqueCandidateSpans = candidateSpans.filter((c) => {
    const key = `${c.type}:${(c.suggestedCanonicalId || c.text).toLowerCase()}`;
    if (seenCandidateKeys.has(key)) return false;
    seenCandidateKeys.add(key);
    return true;
  });

  const promptCandidateSpans = uniqueCandidateSpans.slice(0, MAX_CANDIDATE_SPANS_IN_PROMPT);

  try {
    const prompt = `Bạn là chuyên gia trích xuất Đồ thị Tri thức Lịch sử Việt Nam (Vietnamese History Knowledge Graph).
Dưới đây là đoạn văn bản lịch sử và danh sách thực thể ứng viên đã được nhận diện (Stage 1 Candidate Entities):

THỰC THỂ ỨNG VIÊN (CANDIDATE ENTITIES):
${promptCandidateSpans.map((c) => `- [${c.type}] "${c.text}" (ID đề xuất: ${c.suggestedCanonicalId})`).join('\n')}

VĂN BẢN (TEXT):
"""
${text}
"""

HÃY TRÍCH XUẤT CÁC BỘ BA QUAN HỆ (KNOWLEDGE TRIPLES) THEO CÁC QUY TẮC SAU:
1. Chỉ sử dụng 8 loại quan hệ chuẩn (relationType):
   - LED_BY: [Event/Movement/Org] -> [Person] (Ví dụ: event_ngoc_hoi_dong_da -> LED_BY -> person_quang_trung)
   - PART_OF: [Sub-entity/Artifact/Org] -> [Parent-entity/Dynasty/Org] (Ví dụ: artifact_trong_dong_dong_son -> PART_OF -> dynasty_van_lang)
   - HAPPENED_IN: [Event/Rule] -> [Dynasty/Era] (Ví dụ: event_ngoc_hoi_dong_da -> HAPPENED_IN -> dynasty_nha_tay_son)
   - HAPPENED_AT: [Event] -> [Location] (Ví dụ: event_ngoc_hoi_dong_da -> HAPPENED_AT -> loc_thang_long)
   - SAME_AS_LOCATION: [Historical Loc] -> [Modern Loc] (Ví dụ: loc_thang_long -> SAME_AS_LOCATION -> loc_ha_noi)
   - ALIAS_OF: [Alias/Variant] -> [Canonical Entity] (Ví dụ: person_nguyen_hue -> ALIAS_OF -> person_quang_trung)
   - ROYAL_LINEAGE: [Child/Successor] -> [Royal Parent/Ancestor] (Ví dụ: person_le_thai_tong -> ROYAL_LINEAGE -> person_le_thai_to)
   - MENTIONED_IN: [Entity] -> [Document/Book] (Ví dụ: person_ly_thai_to -> MENTIONED_IN -> doc_chieu_doi_do)

2. Trả về đúng định dạng JSON:
{
  "triples": [
    {
      "sourceEntity": "Tên thực thể nguồn",
      "sourceEntityId": "id_nguon",
      "relationType": "LED_BY",
      "targetEntity": "Tên thực thể đích",
      "targetEntityId": "id_dich",
      "confidence": 0.95
    }
  ]
}`;

    const res = await generateLLMCompletion(
      [
        {
          role: 'system',
          content: 'You are a Vietnamese History Knowledge Graph Extractor. Output strictly valid JSON matching the schema.',
        },
        { role: 'user', content: prompt },
      ],
      {
        task: 'extraction', // Routes to Port 8094 (Qwen3.5-4B-Instruct)
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        timeoutMs:
          options?.timeoutMs ??
          (envConfig.USE_LOCAL_LLM ? (envConfig.LOCAL_LLM_TIMEOUT_MS || 120000) : envConfig.REMOTE_FALLBACK_TIMEOUT_MS),
      }
    );

    let jsonStr = res.content.trim();
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.replace(/^[\s\S]*?```json\s*/i, '').replace(/\s*```[\s\S]*$/, '');
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/^[\s\S]*?```\s*/, '').replace(/\s*```[\s\S]*$/, '');
    }

    let rawTriples: any[] = [];
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && Array.isArray(parsed.triples)) {
        rawTriples = parsed.triples;
      }
    } catch {
      // Regex extraction fallback from JSON string
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

    for (const raw of rawTriples) {
      if (!raw.sourceEntity || !raw.targetEntity || !raw.relationType) continue;
      if (!VALID_RELATIONS.has(raw.relationType as HistoricalRelationType)) continue;

      const sName = String(raw.sourceEntity).trim();
      const tName = String(raw.targetEntity).trim();
      const sId = raw.sourceEntityId || buildCanonicalId(sName, 'HISTORICAL_PERSON');
      const tId = raw.targetEntityId || buildCanonicalId(tName, 'LOCATION');

      const validated = validateAndCanonicalizeTriple(
        { id: sId, name: sName },
        raw.relationType as HistoricalRelationType,
        { id: tId, name: tName },
        raw.confidence ?? 0.95
      );

      if (validated) {
        validatedTriples.push(validated);
      }
    }

    return {
      triples: validatedTriples,
      candidateSpans,
      res,
    };
  } catch (err) {
    const errMsg = formatConciseError(err);

    if (options?.strict || envConfig.EVAL_STRICT || !options?.allowFallback) {
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

    // Use deterministic Stage 1 candidate-guided triples as graceful fallback
    const fallbackTriples = extractTriplesFromText(text);
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
    const regexTriples = extractTriplesFromText(text);
    return {
      triples: regexTriples,
      strategy: 'regex_only',
      durationMs: Date.now() - startTime,
    };
  }

  const { triples, candidateSpans, res, error } = await extractTriplesWithLLMDetailed(text, options);

  const durationMs = Date.now() - startTime;
  const strategy: DetailedExtractionResult['strategy'] = error ? 'rule_based_fallback' : 'ensemble_ai';

  return {
    triples,
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
