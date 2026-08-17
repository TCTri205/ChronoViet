/**
 * Knowledge Graph Triple Extractor (Subject -> Relation -> Object)
 * Component 2 of Module 0 Data Preprocessing & Ingestion ETL
 */

import {
  resolveCanonicalEntity,
  HISTORICAL_PERSON_DICTIONARY,
  HISTORICAL_LOCATION_DICTIONARY,
} from './entity-disambiguator.js';
import {
  envConfig,
  generateLLMCompletion,
  logFallbackAlert,
  createLogger,
} from '@chronoviet/shared-spec';

const log = createLogger({ service: 'data-ingestion' });

export interface ExtractedTriple {
  sourceEntityId: string;
  sourceEntityName: string;
  relationType: 'PART_OF' | 'LED_BY' | 'HAPPENED_IN' | 'HAPPENED_AT' | 'SAME_AS_LOCATION' | 'ALIAS_OF' | 'ROYAL_LINEAGE' | 'MENTIONED_IN';
  targetEntityId: string;
  targetEntityName: string;
  confidence: number;
}

const GENERIC_EXCLUSION_TERMS = new Set([
  'năm', 'tháng', 'ngày', 'vào', 'thời', 'người', 'những', 'đại', 'vua', 'quân',
  'tướng', 'nhà', 'triều', 'nước', 'một', 'các', 'được', 'có', 'tại', 'sau', 'khi',
  'lại', 'về', 'đã', 'sẽ', 'cũng', 'thì', 'là', 'sự', 'việc', 'đây', 'đó', 'ông',
  'bà', 'cha', 'mẹ', 'con', 'cháu', 'anh', 'em', 'trận', 'cuộc', 'bởi', 'do',
  'tất cả', 'phần lớn', 'nhiều', 'rất', 'quá', 'rồi', 'đang', 'như', 'vì'
]);

/**
 * Strict validation filter to prevent LLM hallucination and generic tokens
 */
export function isValidEntityName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim();
  if (clean.length < 3 || clean.length > 50) return false;
  if (/^\d+/.test(clean)) return false; // Starts with digit/footnote number
  if (/[\[\]\(\)=\/\\<>|#*]/.test(clean)) return false; // Special characters/markup
  const words = clean.split(/\s+/);
  if (words.length > 5) return false; // Sentences or long clauses
  if (GENERIC_EXCLUSION_TERMS.has(clean.toLowerCase())) return false;
  if (!/[a-zA-Zà-ỹÀ-Ỹ]/.test(clean)) return false;
  // First word must start with an uppercase letter
  if (!/^[A-ZÀ-Ỹ]/.test(words[0])) return false;
  // Last word must start with an uppercase letter
  if (!/^[A-ZÀ-Ỹ0-9]/.test(words[words.length - 1])) return false;
  return true;
}

const PROPER_NOUN_PATTERN = '([A-ZÀ-Ỹ][a-zà-ỹ0-9_\\-]*(?:\\s+[A-ZÀ-Ỹ0-9_\\-][a-zà-ỹ0-9_\\-]*){0,4})';

const HISTORICAL_PATTERNS: Array<{
  regex: RegExp;
  relation: ExtractedTriple['relationType'];
  sourceGroup: number;
  targetGroup: number;
  confidence: number;
}> = [
  // LED_BY: e.g. "Trận Ngọc Hồi do Quang Trung chỉ huy", "Quang Trung lãnh đạo quân Tây Sơn"
  {
    regex: new RegExp(`\\b(?:trận|chiến dịch|cuộc khởi nghĩa)\\s+${PROPER_NOUN_PATTERN}\\s+(?:do|dưới sự chỉ huy của|lãnh đạo bởi)\\s+${PROPER_NOUN_PATTERN}(?=[.,;!?\\n]|$)`, 'gi'),
    relation: 'LED_BY',
    sourceGroup: 1,
    targetGroup: 2,
    confidence: 0.95,
  },
  {
    regex: new RegExp(`\\b${PROPER_NOUN_PATTERN}\\s+(?:chỉ huy|lãnh đạo|tổng tư lệnh)\\s+(?:trận|cuộc khởi nghĩa|chiến dịch)\\s+${PROPER_NOUN_PATTERN}(?=[.,;!?\\n]|$)`, 'gi'),
    relation: 'LED_BY',
    sourceGroup: 2,
    targetGroup: 1,
    confidence: 0.95,
  },
  // HAPPENED_AT / HAPPENED_IN: e.g. "Trận Tốt Động diễn ra tại Chúc Động"
  {
    regex: new RegExp(`\\b(?:trận|chiến dịch|sự kiện)\\s+${PROPER_NOUN_PATTERN}\\s+(?:diễn ra tại|xảy ra ở|tại)\\s+${PROPER_NOUN_PATTERN}(?=[.,;!?\\n]|$)`, 'gi'),
    relation: 'HAPPENED_AT',
    sourceGroup: 1,
    targetGroup: 2,
    confidence: 0.9,
  },
  // ALIAS_OF: e.g. "Quang Trung tức là Nguyễn Huệ", "Nguyễn Huệ tên thật là Hồ Thơm"
  {
    regex: new RegExp(`\\b${PROPER_NOUN_PATTERN}\\s+(?:tức là|còn gọi là|tên thật là|tên hiệu là|tên gọi khác là)\\s+${PROPER_NOUN_PATTERN}(?=[.,;!?\\n]|$)`, 'gi'),
    relation: 'ALIAS_OF',
    sourceGroup: 1,
    targetGroup: 2,
    confidence: 1.0,
  },
];

/**
 * Extracts triples from historical text content using pattern-based extraction & canonical dictionary detection
 */
export function extractTriplesFromText(text: string): ExtractedTriple[] {
  const rawTriples: ExtractedTriple[] = [];
  const sentences = text.split(/(?<=[.!?\n])\s+/);

  for (const sentence of sentences) {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) continue;

    // 1. Pattern-based Triple Extraction per sentence
    for (const pattern of HISTORICAL_PATTERNS) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(cleanSentence)) !== null) {
        const rawSource = match[pattern.sourceGroup]?.trim();
        const rawTarget = match[pattern.targetGroup]?.trim();

        if (
          rawSource &&
          rawTarget &&
          isValidEntityName(rawSource) &&
          isValidEntityName(rawTarget)
        ) {
          const sourceEntity = resolveCanonicalEntity(rawSource);
          const targetEntity = resolveCanonicalEntity(rawTarget);

          rawTriples.push({
            sourceEntityId: sourceEntity.entityId,
            sourceEntityName: sourceEntity.canonicalName,
            relationType: pattern.relation,
            targetEntityId: targetEntity.entityId,
            targetEntityName: targetEntity.canonicalName,
            confidence: pattern.confidence,
          });
        }
      }
    }

    // 2. Canonical Historical Entity Mentions (from Ground-Truth Master Dictionaries)
    for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
      if (
        cleanSentence.includes(person.canonicalName) ||
        person.aliases.some((a) => a.length >= 3 && cleanSentence.includes(a))
      ) {
        rawTriples.push({
          sourceEntityId: person.entityId,
          sourceEntityName: person.canonicalName,
          relationType: 'MENTIONED_IN',
          targetEntityId: 'doc:historical_context',
          targetEntityName: 'Document Context',
          confidence: 1.0,
        });
      }
    }

    for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
      if (
        cleanSentence.includes(loc.canonicalName) ||
        loc.aliases.some((a) => a.length >= 3 && cleanSentence.includes(a))
      ) {
        rawTriples.push({
          sourceEntityId: loc.entityId,
          sourceEntityName: loc.canonicalName,
          relationType: 'HAPPENED_AT',
          targetEntityId: 'doc:historical_context',
          targetEntityName: 'Document Context',
          confidence: 0.95,
        });
      }
    }
  }

  // Deduplicate triples preserving highest confidence
  const uniqueMap = new Map<string, ExtractedTriple>();
  for (const t of rawTriples) {
    const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
    const existing = uniqueMap.get(key);
    if (!existing || t.confidence > existing.confidence) {
      uniqueMap.set(key, t);
    }
  }

  return Array.from(uniqueMap.values());
}

let warnedLlmOffline = false;

export interface ExtractionOptions {
  strict?: boolean;
  allowFallback?: boolean;
  regexOnly?: boolean;
  timeoutMs?: number;
}

/**
 * Extracts Knowledge Graph triples using Primary Local Model (llama-server) or Cloud Fallback
 */
export async function extractTriplesWithLLM(
  text: string,
  options?: ExtractionOptions
): Promise<ExtractedTriple[]> {
  if (!text || text.trim().length < 20) {
    return [];
  }

  try {
    const prompt = `Bạn là chuyên gia phân tích tri thức Lịch sử Việt Nam. Hãy trích xuất tất cả các mối quan hệ bộ ba (Subject -> Relation -> Object) từ đoạn văn bản sau.

Yêu cầu output: Trả về duy nhất 1 JSON object có định dạng:
{
  "triples": [
    {
      "sourceEntity": "tên thực thể nguồn",
      "relationType": "LED_BY" | "HAPPENED_IN" | "HAPPENED_AT" | "ALIAS_OF" | "ROYAL_LINEAGE" | "PART_OF" | "MENTIONED_IN",
      "targetEntity": "tên thực thể đích",
      "confidence": 0.95
    }
  ]
}

Văn bản:
"""
${text.slice(0, 3500)}
"""`;

    const res = await generateLLMCompletion(
      [
        { role: 'system', content: 'You are a Vietnamese History Knowledge Graph Specialist. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      {
        temperature: 0.1,
        response_format: { type: 'json_object' },
        timeoutMs: options?.timeoutMs ?? envConfig.REMOTE_FALLBACK_TIMEOUT_MS,
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
      // Fallback: extract individual triple objects if response was truncated
      const objectRegex = /\{\s*"sourceEntity"\s*:\s*"([^"]+)"\s*,\s*"relationType"\s*:\s*"([^"]+)"\s*,\s*"targetEntity"\s*:\s*"([^"]+)"(?:\s*,\s*"confidence"\s*:\s*([0-9.]+))?\s*\}/g;
      let match;
      while ((match = objectRegex.exec(jsonStr)) !== null) {
        rawTriples.push({
          sourceEntity: match[1],
          relationType: match[2],
          targetEntity: match[3],
          confidence: match[4] ? parseFloat(match[4]) : 0.9,
        });
      }
    }

    if (rawTriples.length === 0) return [];

    const validRelations = new Set<ExtractedTriple['relationType']>([
      'PART_OF', 'LED_BY', 'HAPPENED_IN', 'HAPPENED_AT', 'SAME_AS_LOCATION', 'ALIAS_OF', 'ROYAL_LINEAGE', 'MENTIONED_IN'
    ]);

    const triples: ExtractedTriple[] = [];
    for (const item of rawTriples) {
      if (
        item.sourceEntity &&
        item.targetEntity &&
        item.relationType &&
        validRelations.has(item.relationType) &&
        isValidEntityName(item.sourceEntity) &&
        isValidEntityName(item.targetEntity)
      ) {
        const sourceEntity = resolveCanonicalEntity(item.sourceEntity);
        const targetEntity = resolveCanonicalEntity(item.targetEntity);

        if (!isValidEntityName(sourceEntity.canonicalName) || !isValidEntityName(targetEntity.canonicalName)) {
          continue;
        }

        triples.push({
          sourceEntityId: sourceEntity.entityId,
          sourceEntityName: sourceEntity.canonicalName,
          relationType: item.relationType,
          targetEntityId: targetEntity.entityId,
          targetEntityName: targetEntity.canonicalName,
          confidence: item.confidence ?? (res.provider === 'LOCAL_LLM' ? 0.95 : 0.9),
        });
      }
    }
    return triples;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // Default mode requires full LLM extraction. Do not silently fallback unless allowFallback is explicitly set.
    if (options?.strict || envConfig.EVAL_STRICT || !options?.allowFallback) {
      throw new Error(`LLM Triple Extraction failed: ${errMsg}. If you intend to run in offline fallback mode, pass --allow-fallback or --regex-only.`);
    }

    if (!warnedLlmOffline) {
      log.warn('triple_extract.llm_offline', 'LLM gateway offline; falling back to rule-based dictionary matcher', {
        reason: errMsg,
      });
      logFallbackAlert({
        subsystem: 'LLM_GATEWAY',
        primaryTarget: `Local LLM Gateway (${envConfig.LLM_BASE_URL}) [${envConfig.LOCAL_LLM_PRIMARY_MODEL}]`,
        fallbackTarget: 'Rule-Based Regex Pattern Matcher & Canonical Ground-Truth Dictionaries',
        reason: errMsg,
        actionRequired: 'Start llama-server (e.g. llama-server -m models/... --port 8080) or set AGNES_API_KEY in .env',
      });
      warnedLlmOffline = true;
    } else {
      log.debug('triple_extract.llm_skipped', 'LLM unavailable; using rule-based extraction', {
        reason: errMsg,
      });
    }
    return [];
  }
}

/**
 * Asynchronous two-tier ensemble extraction combining Fast-Path Master Dictionaries & LLM Gateway
 */
export async function extractTriplesFromTextAsync(
  text: string,
  options?: ExtractionOptions
): Promise<ExtractedTriple[]> {
  const startTime = Date.now();
  const regexTriples = extractTriplesFromText(text);

  if (options?.regexOnly) {
    return regexTriples;
  }

  const llmTriples = await extractTriplesWithLLM(text, options);

  const mergedMap = new Map<string, ExtractedTriple>();

  for (const t of [...regexTriples, ...llmTriples]) {
    const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
    const existing = mergedMap.get(key);
    if (!existing || t.confidence > existing.confidence) {
      mergedMap.set(key, t);
    }
  }

  const result = Array.from(mergedMap.values());
  const durationMs = Date.now() - startTime;

  log.debug('triple_extract.completed', 'Triple extraction completed', {
    regexCount: regexTriples.length,
    llmCount: llmTriples.length,
    mergedCount: result.length,
    strategy: llmTriples.length > 0 ? 'ensemble_ai' : 'rule_based_fallback',
    durationMs,
  });

  return result;
}

/**
 * 3-Step Historical Conflict Resolution Protocol (Spec Section 5.2)
 * Determines whether two conflicting relationship edges should be overridden or kept as parallel Multi-Perspective Edges.
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

  // Condition 1: Both Level 1 OR confidence delta <= 0.15 => Multi-Perspective
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
