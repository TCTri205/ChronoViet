import { CandidateEntitySpan } from '@chronoviet/shared-spec';
import { slugify } from '../../text/vietnamese-ner.js';
import { ExtractedTriple } from '../types.js';
import { VIETNAMESE_LANDMARK_PARENT_MAP } from '../dictionaries/foreign-entities.js';
import { validateAndCanonicalizeTriple } from '../canonicalizer/validator.js';

import { getSpatialHierarchyLevel } from '../helpers/spatial-level.js';
export { getSpatialHierarchyLevel };

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

      if (locA.isEnclosedModifier && locB.isEnclosedModifier && locA.enclosingSpanText === locB.enclosingSpanText) continue;

      const normA = slugify(locA.text).replace(/^(?:nui|song|thanh|kinh_thanh|co_do|dong|chua|vung|dat|tinh|huyen|thanh_pho)_/, '');
      const normB = slugify(locB.text).replace(/^(?:nui|song|thanh|kinh_thanh|co_do|dong|chua|vung|dat|tinh|huyen|thanh_pho)_/, '');
      if (normA === normB) continue;

      if (MOTION_WORDS.test(mid)) continue;
      if (/\b(nay\s+thuộc|nay\s+là|xưa\s+là|vốn\s+là|xưa\s+nay\s+thuộc)\b/i.test(mid)) continue;

      if (SPATIAL_CONNECTORS.test(mid) || mid === ',') {
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

  // 3. Clause-Level Person, Event & Artifact Spatial Linking
  const standalonePersonIds = new Set(
    candidateSpans
      .filter((s) => s.type === 'HISTORICAL_PERSON' && !s.isEnclosedModifier)
      .map((s) => s.suggestedCanonicalId || slugify(s.text))
  );
  const persons = candidateSpans.filter((s) => {
    if (s.type !== 'HISTORICAL_PERSON') return false;
    if (s.isEnclosedModifier) {
      const id = s.suggestedCanonicalId || slugify(s.text);
      return standalonePersonIds.has(id);
    }
    return true;
  });
  const events = candidateSpans.filter((s) => s.type === 'EVENT_BATTLE');
  const artifacts = candidateSpans.filter((s) => s.type === 'ARTIFACT');

  const SPATIAL_ACTION_VERBS = /\b(tại|ở|ở\s+tại|đóng\s+quân\s+tại|trú\s+tại|định\s+đô\s+ở|đóng\s+đô\s+ở|lập\s+căn\s+cứ\s+tại|xây\s+dựng\s+tại|xây\s+căn\s+cứ\s+tại|tiến\s+ra|giải\s+phóng|tiến\s+công|kinh\s+lược|lập\s+phủ|chỉ\s+huy\s+tại|sở\s+chỉ\s+huy|đồn\s+trú|húc\s+đổ\s+cổng|trực\s+tiếp\s+chỉ\s+huy)\b/i;

  for (const loc of locations) {
    const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;

    for (const ent of [...persons, ...events, ...artifacts]) {
      const minOffset = Math.min(loc.endOffset, ent.endOffset);
      const maxOffset = Math.max(loc.startOffset, ent.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n')) continue;

      const entId = ent.suggestedCanonicalId || `${slugify(ent.text)}`;
      const isIntroductoryClause = /^(?:,\s*)?(?:tại|ở|nơi)\s+/i.test(text.substring(Math.max(0, loc.startOffset - 15), loc.startOffset));

      if (SPATIAL_ACTION_VERBS.test(mid) || isIntroductoryClause || SPATIAL_ACTION_VERBS.test(text.substring(Math.max(0, ent.startOffset - 25), ent.startOffset))) {
        const t = validateAndCanonicalizeTriple(
          { id: entId, name: ent.text, type: ent.type as any },
          'HAPPENED_AT',
          { id: locId, name: loc.text, type: 'LOCATION' },
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

  return results;
}
