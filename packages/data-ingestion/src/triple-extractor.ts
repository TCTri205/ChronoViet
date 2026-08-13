/**
 * Knowledge Graph Triple Extractor (Subject -> Relation -> Object)
 */

import { resolveCanonicalEntity } from './entity-disambiguator.js';
import { envConfig } from '@chronoviet/shared-spec';

export interface ExtractedTriple {
  sourceEntityId: string;
  sourceEntityName: string;
  relationType: 'PART_OF' | 'LED_BY' | 'HAPPENED_IN' | 'HAPPENED_AT' | 'SAME_AS_LOCATION' | 'ALIAS_OF' | 'ROYAL_LINEAGE' | 'MENTIONED_IN';
  targetEntityId: string;
  targetEntityName: string;
  confidence: number;
}

const HISTORICAL_PATTERNS: Array<{
  regex: RegExp;
  relation: ExtractedTriple['relationType'];
  sourceGroup: number;
  targetGroup: number;
  confidence: number;
}> = [
  // LED_BY: e.g. "Trận Ngọc Hồi do Quang Trung chỉ huy", "Quang Trung lãnh đạo quân Tây Sơn"
  {
    regex: /\b(trận|chiến dịch|cuộc khởi nghĩa)\s+([A-ZÀ-ỹ0-9_\-\s]{1,60}?)\s+(do|dưới sự chỉ huy của|lãnh đạo bởi)\s+([A-ZÀ-ỹ0-9_\-\s]{1,60}?)(?=[.,;!?\n]|$)/gi,
    relation: 'LED_BY',
    sourceGroup: 2,
    targetGroup: 4,
    confidence: 0.95,
  },
  {
    regex: /\b([A-ZÀ-ỹ0-9_\-\s]{1,60}?)\s+(chỉ huy|lãnh đạo|tổng tư lệnh)\s+(trận|cuộc khởi nghĩa|chiến dịch)\s+([A-ZÀ-ỹ0-9_\-\s]{1,60}?)(?=[.,;!?\n]|$)/gi,
    relation: 'LED_BY',
    sourceGroup: 4,
    targetGroup: 1,
    confidence: 0.95,
  },
  // HAPPENED_AT / HAPPENED_IN: e.g. "Trận Tốt Động diễn ra tại Chúc Động", "Trận Ngọc Hồi diễn ra năm 1789"
  {
    regex: /\b(trận|chiến dịch|sự kiện)\s+([A-ZÀ-ỹ0-9_\-\s]{1,60}?)\s+(diễn ra tại|xảy ra ở|tại)\s+([A-ZÀ-ỹ0-9_\-\s]{1,60}?)(?=[.,;!?\n]|$)/gi,
    relation: 'HAPPENED_AT',
    sourceGroup: 2,
    targetGroup: 4,
    confidence: 0.9,
  },
  // ALIAS_OF: e.g. "Quang Trung tức là Nguyễn Huệ", "Nguyễn Huệ tên thật là Hồ Thơm"
  {
    regex: /\b([A-ZÀ-ỹ0-9_\-\s]{1,60}?)\s+(tức là|còn gọi là|tên thật là|tên hiệu là)\s+([A-ZÀ-ỹ0-9_\-\s]{1,60}?)(?=[.,;!?\n]|$)/gi,
    relation: 'ALIAS_OF',
    sourceGroup: 1,
    targetGroup: 3,
    confidence: 1.0,
  },
];

/**
 * Extracts triples from historical text content using pattern-based extraction & entity detection
 */
export function extractTriplesFromText(text: string): ExtractedTriple[] {
  const triples: ExtractedTriple[] = [];
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
          rawSource.length > 1 &&
          rawTarget.length > 1 &&
          rawSource.length <= 120 &&
          rawTarget.length <= 120
        ) {
          const sourceEntity = resolveCanonicalEntity(rawSource);
          const targetEntity = resolveCanonicalEntity(rawTarget);

          triples.push({
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

    // 2. Entity Mention Extraction (Proper Nouns & Capitalized Historical Terms)
    const capMatches = cleanSentence.match(/\b[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)*\b/g);
    if (capMatches) {
      const uniqueTerms = Array.from(new Set(capMatches)).filter(
        (term) => term.length > 3 && !['Trận', 'Cuộc', 'Năm', 'Vào', 'Thời', 'Người', 'Những', 'Đại'].includes(term)
      );

      for (const term of uniqueTerms) {
        const entity = resolveCanonicalEntity(term);
        triples.push({
          sourceEntityId: entity.entityId,
          sourceEntityName: entity.canonicalName,
          relationType: 'MENTIONED_IN',
          targetEntityId: 'doc:historical_context',
          targetEntityName: 'Document Context',
          confidence: 0.85,
        });
      }
    }
  }

  return triples;
}

/**
 * Extracts Knowledge Graph triples using Ollama Local (Qwen / Llama) when Gemini API Key is missing
 */
export async function extractTriplesWithOllamaLocal(text: string): Promise<ExtractedTriple[]> {
  if (!text || text.trim().length < 20) return [];
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

    const host = envConfig.EMBEDDING_API_URL ? new URL(envConfig.EMBEDDING_API_URL).origin : 'http://localhost:11434';
    const apiUrl = `${host}/api/generate`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5',
        prompt,
        stream: false,
        format: 'json',
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama Local HTTP ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    if (!data.response) return [];

    const parsed = JSON.parse(data.response);
    if (!parsed || !Array.isArray(parsed.triples)) return [];

    const validRelations = new Set<ExtractedTriple['relationType']>([
      'PART_OF', 'LED_BY', 'HAPPENED_IN', 'HAPPENED_AT', 'SAME_AS_LOCATION', 'ALIAS_OF', 'ROYAL_LINEAGE', 'MENTIONED_IN'
    ]);

    const triples: ExtractedTriple[] = [];
    for (const item of parsed.triples) {
      if (item.sourceEntity && item.targetEntity && item.relationType && validRelations.has(item.relationType)) {
        const sourceEntity = resolveCanonicalEntity(item.sourceEntity);
        const targetEntity = resolveCanonicalEntity(item.targetEntity);
        triples.push({
          sourceEntityId: sourceEntity.entityId,
          sourceEntityName: sourceEntity.canonicalName,
          relationType: item.relationType,
          targetEntityId: targetEntity.entityId,
          targetEntityName: targetEntity.canonicalName,
          confidence: item.confidence ?? 0.85,
        });
      }
    }
    return triples;
  } catch (_err) {
    return [];
  }
}

/**
 * Extracts Knowledge Graph triples using Google Gemini API or Ollama Local fallback
 */
export async function extractTriplesWithGemini(text: string): Promise<ExtractedTriple[]> {
  const apiKey = envConfig.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return extractTriplesWithOllamaLocal(text);
  }
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

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API HTTP ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) return [];

    const parsed = JSON.parse(rawContent);
    if (!parsed || !Array.isArray(parsed.triples)) return [];

    const validRelations = new Set<ExtractedTriple['relationType']>([
      'PART_OF', 'LED_BY', 'HAPPENED_IN', 'HAPPENED_AT', 'SAME_AS_LOCATION', 'ALIAS_OF', 'ROYAL_LINEAGE', 'MENTIONED_IN'
    ]);

    const triples: ExtractedTriple[] = [];
    for (const item of parsed.triples) {
      if (item.sourceEntity && item.targetEntity && item.relationType && validRelations.has(item.relationType)) {
        const sourceEntity = resolveCanonicalEntity(item.sourceEntity);
        const targetEntity = resolveCanonicalEntity(item.targetEntity);
        triples.push({
          sourceEntityId: sourceEntity.entityId,
          sourceEntityName: sourceEntity.canonicalName,
          relationType: item.relationType,
          targetEntityId: targetEntity.entityId,
          targetEntityName: targetEntity.canonicalName,
          confidence: item.confidence ?? 0.9,
        });
      }
    }
    return triples;
  } catch (err) {
    console.error('[TripleExtractor] Gemini LLM triple extraction failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Asynchronous triple extraction combining Fast-Path Regex patterns & Gemini LLM
 */
export async function extractTriplesFromTextAsync(text: string): Promise<ExtractedTriple[]> {
  const regexTriples = extractTriplesFromText(text);
  const llmTriples = await extractTriplesWithGemini(text);

  const mergedMap = new Map<string, ExtractedTriple>();

  for (const t of [...regexTriples, ...llmTriples]) {
    const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
    const existing = mergedMap.get(key);
    if (!existing || t.confidence > existing.confidence) {
      mergedMap.set(key, t);
    }
  }

  return Array.from(mergedMap.values());
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
