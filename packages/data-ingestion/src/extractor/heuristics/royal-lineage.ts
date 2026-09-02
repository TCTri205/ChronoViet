import { CandidateEntitySpan } from '@chronoviet/shared-spec';
import { slugify } from '../../text/vietnamese-ner.js';
import { ExtractedTriple } from '../types.js';
import { validateAndCanonicalizeTriple } from '../canonicalizer/validator.js';

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

  const BIRTH_PATTERN = /(?<!\p{L})(?:đã\s+)?(?:sinh\s+ra|sinh\s+được|sinh\s+hạ|sinh|đẻ\s+ra|lập\s+con\s+trai\s+là|lập\s+con\s+là|lập\s+thái\s+tử\s+là|hạ\s+lệnh\s+cho\s+con\s+trưởng|hạ\s+lệnh\s+cho\s+con\s+trai)(?:\s+ra)?(?:\s+(?:hoàng\s+tử|thái\s+tử|con\s+trai|con\s+gái|người\s+con|con|trưởng))?(?!\p{L})/iu;
  const CHILD_OF_PATTERN = /(?<!\p{L})(?:là\s+)?(?:con|con\s+trai|con\s+gái|con\s+trưởng|con\s+thứ|hoàng\s+tử|thái\s+tử)(?:\s+(?:trưởng|thứ|kế\s+vị))?(?:\s+(?:của|do))(?!\p{L})/iu;
  const PASS_THRONE_PATTERN = /(?<!\p{L})(?:rồi\s+)?(?:truyền\s+ngôi|nhường\s+ngôi|trao\s+ngôi|nhường\s+ngai\s+vàng|truyền\s+lại\s+cơ\s+nghiệp|truyền\s+cơ\s+nghiệp|trao\s+cơ\s+nghiệp)(?:\s+(?:báu|vàng|vua))?(?:\s+[^,.]*?)?\s+cho(?:\s+[^,.]*?)?(?!\p{L})/iu;
  const SUCCEED_PATTERN = /(?<!\p{L})(?:nối\s+ngôi|kế\s+vị|nối\s+nghiệp|kế\s+nghiệp|kế\s+thừa\s+sự\s+nghiệp|thừa\s+kế\s+ngai\s+vàng|kế\s+thừa)(?:\s+(?:vua\s+cha|phụ\s+hoàng|cha|tiền\s+nhân|của))?(?!\p{L})/iu;

  for (let i = 0; i < persons.length; i++) {
    const p1 = persons[i];
    for (let j = 0; j < persons.length; j++) {
      if (i === j) continue;
      const p2 = persons[j];

      if (p1.startOffset < p2.startOffset) {
        const charDist = p2.startOffset - p1.endOffset;
        if (charDist > 140 || charDist < 0) continue;

        // Check for intervening persons to prevent multi-generation skip over intermediate heir,
        // but ignore if the intervening person is an appositive alias (e.g. "thái tử Lê Nguyên Long tức vua Lê Thái Tông")
        const interveningPersons = persons.filter(
          (other) => other !== p1 && other !== p2 && other.startOffset > p1.endOffset && other.endOffset < p2.startOffset
        );
        const hasTrueInterveningPerson = interveningPersons.some((other) => {
          const between = text.substring(other.endOffset, p2.startOffset);
          return !/(?<!\p{L})(?:tức|tức\s+vua|hiệu\s+là|tên\s+là|danh\s+hiệu)(?!\p{L})/iu.test(between);
        });
        if (hasTrueInterveningPerson) continue;

        const mid = text.substring(p1.endOffset, p2.startOffset).trim();
        if (mid.includes('\n') || mid.includes('.')) continue;

        // Pattern 1: p1 sinh ra p2 / p1 truyền ngôi cho p2 => p2 ROYAL_LINEAGE p1
        if (BIRTH_PATTERN.test(mid) || PASS_THRONE_PATTERN.test(mid) || /(?<!\p{L})truyền\s+(?:ngôi|lại\s+cơ\s+nghiệp|cơ\s+nghiệp)(?!\p{L})/iu.test(mid)) {
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
