/**
 * Knowledge Graph Triple Extractor (Subject -> Relation -> Object)
 */

import { resolveCanonicalEntity } from './entity-disambiguator.js';

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
    regex: /\b(trận|chiến dịch|cuộc khởi nghĩa)\s+([A-ZÀ-ỹ\s]+)\s+(do|dưới sự chỉ huy của|lãnh đạo bởi)\s+([A-ZÀ-ỹ\s]+)\b/gi,
    relation: 'LED_BY',
    sourceGroup: 2,
    targetGroup: 4,
    confidence: 0.95,
  },
  {
    regex: /\b([A-ZÀ-ỹ\s]+)\s+(chỉ huy|lãnh đạo|tổng tư lệnh)\s+(trận|cuộc khởi nghĩa|chiến dịch)\s+([A-ZÀ-ỹ\s]+)\b/gi,
    relation: 'LED_BY',
    sourceGroup: 4,
    targetGroup: 1,
    confidence: 0.95,
  },
  // HAPPENED_AT / HAPPENED_IN: e.g. "Trận Tốt Động diễn ra tại Chúc Động", "Trận Ngọc Hồi diễn ra năm 1789"
  {
    regex: /\b(trận|chiến dịch|sự kiện)\s+([A-ZÀ-ỹ\s]+)\s+(diễn ra tại|xảy ra ở|tại)\s+([A-ZÀ-ỹ\s]+)\b/gi,
    relation: 'HAPPENED_AT',
    sourceGroup: 2,
    targetGroup: 4,
    confidence: 0.9,
  },
  // ALIAS_OF: e.g. "Quang Trung tức là Nguyễn Huệ", "Nguyễn Huệ tên thật là Hồ Thơm"
  {
    regex: /\b([A-ZÀ-ỹ\s]+)\s+(tức là|còn gọi là|tên thật là|tên hiệu là)\s+([A-ZÀ-ỹ\s]+)\b/gi,
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
  const cleanText = text.replace(/[\r\n]+/g, ' ');

  // 1. Pattern-based Triple Extraction
  for (const pattern of HISTORICAL_PATTERNS) {
    const regex = new RegExp(pattern.regex);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(cleanText)) !== null) {
      const rawSource = match[pattern.sourceGroup]?.trim();
      const rawTarget = match[pattern.targetGroup]?.trim();

      if (rawSource && rawTarget && rawSource.length > 1 && rawTarget.length > 1) {
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
  const capMatches = cleanText.match(/\b[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)*\b/g);
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

  return triples;
}
