import { CandidateEntitySpan, HistoricalRelationType } from '@chronoviet/shared-spec';
import { slugify } from '../../text/vietnamese-ner.js';
import { ExtractedTriple } from '../types.js';
import { snapMentionToCandidate } from '../helpers/mention-resolver.js';
import { validateAndCanonicalizeTriple } from '../canonicalizer/validator.js';

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

  // 4. Inline Person Alias & Reign Name: [Tên A] ... [Tên B]
  const INLINE_PERSON_ALIAS_REGEX = /([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+){0,3})\s+(?:tức\s+là|tức|tên\s+thật\s+là|hiệu\s+là|húy\s+là|được\s+tôn\s+xưng(?:\s+danh\s+hiệu)?\s+là|được\s+tôn\s+xưng\s+danh\s+hiệu|tôn\s+xưng\s+danh\s+hiệu|được\s+xưng\s+tôn|được\s+tôn\s+là|tên\s+húy\s+là|có\s+tên\s+khai\s+sinh\s+là|tên\s+khai\s+sinh\s+là|thời\s+trẻ\s+mang\s+tên|lên\s+ngôi\s+(?:hoàng\s+đế|Hoàng\s+đế|Hoàng\s+Đế|vua)\s+(?:lấy\s+(?:tôn\s+hiệu|niên\s+hiệu|hiệu)\s+là\s+)?|lên\s+ngôi\s+(?:hoàng\s+đế|Hoàng\s+đế|Hoàng\s+Đế|vua)\s+|xưng\s+(?:hoàng\s+đế|vương)\s+(?:lấy\s+(?:tôn\s+hiệu|niên\s+hiệu|hiệu)\s+là\s+)?|lấy\s+(?:tôn\s+hiệu|niên\s+hiệu|hiệu)\s+là)\s+(?:danh\s+hiệu\s+|vua\s+|hoàng\s+đế\s+|chúa\s+|đại\s+vương\s+|tiền\s+nhân\s+)?([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+){0,3})/gu;
  while ((match = INLINE_PERSON_ALIAS_REGEX.exec(text)) !== null) {
    const rawA = match[1].trim();
    const rawB = match[2].trim();
    const aSnapped = snapMentionToCandidate(rawA, candidateSpans);
    const bSnapped = snapMentionToCandidate(rawB, candidateSpans);
    if (aSnapped && bSnapped && aSnapped.id.startsWith('person_') && bSnapped.id.startsWith('person_') && (aSnapped.id !== bSnapped.id || slugify(aSnapped.name) !== slugify(bSnapped.name))) {
      const aId = (aSnapped.id === bSnapped.id && slugify(aSnapped.name) !== slugify(bSnapped.name)) ? `person_${slugify(aSnapped.name)}` : aSnapped.id;
      const bId = (aSnapped.id === bSnapped.id && slugify(aSnapped.name) !== slugify(bSnapped.name)) ? `person_${slugify(bSnapped.name)}` : bSnapped.id;
      
      // Determine standard alias direction (e.g. Birth Name -> Reign Name, or Title -> Official Name)
      const isReignTitleOrEpithet = /(?:quang_trung|gia_long|le_thai_to|dinh_tien_hoang)/i.test(bId);
      const s = isReignTitleOrEpithet ? aSnapped : bSnapped;
      const t = isReignTitleOrEpithet ? bSnapped : aSnapped;
      const sId = isReignTitleOrEpithet ? aId : bId;
      const tId = isReignTitleOrEpithet ? bId : aId;

      const triple = validateAndCanonicalizeTriple(
        { id: sId, name: s.name, type: 'HISTORICAL_PERSON' },
        'ALIAS_OF',
        { id: tId, name: t.name, type: 'HISTORICAL_PERSON' },
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

  // 5. Narrative Honorific & Posthumous Title Matcher
  const LONG_ALIAS_REGEX = /([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+){0,3})[^.,\n]{0,80}?(?:được\s+(?:tôn\s+xưng|xưng\s+tôn|suy\s+tôn|tôn\s+làm|suy\s+tôn\s+làm|phong)(?:\s+danh\s+hiệu)?|tôn\s+xưng\s+danh\s+hiệu|lấy\s+(?:tôn\s+hiệu|niên\s+hiệu|hiệu)\s+là|tự\s+xưng\s+là|tên\s+gọi\s+khác\s+là|tôn\s+phong\s+danh\s+hiệu)\s+(?:danh\s+hiệu\s+|vua\s+|hoàng\s+đế\s+|chúa\s+|đại\s+vương\s+|tướng\s+)?([A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ0-9\-]+){0,3})/gu;
  while ((match = LONG_ALIAS_REGEX.exec(text)) !== null) {
    const rawA = match[1].trim();
    const rawB = match[2].trim();
    if (!rawA || !rawB || rawA.length < 2 || rawB.length < 2) continue;

    const aSnapped = snapMentionToCandidate(rawA, candidateSpans);
    const bSnapped = snapMentionToCandidate(rawB, candidateSpans);
    if (aSnapped && bSnapped && aSnapped.id.startsWith('person_') && bSnapped.id.startsWith('person_') && (aSnapped.id !== bSnapped.id || slugify(aSnapped.name) !== slugify(bSnapped.name))) {
      const aId = (aSnapped.id === bSnapped.id && slugify(aSnapped.name) !== slugify(bSnapped.name)) ? `person_${slugify(aSnapped.name)}` : aSnapped.id;
      const bId = (aSnapped.id === bSnapped.id && slugify(aSnapped.name) !== slugify(bSnapped.name)) ? `person_${slugify(bSnapped.name)}` : bSnapped.id;
      
      const isReignTitleOrEpithet = /(?:quang_trung|gia_long|le_thai_to|dinh_tien_hoang)/i.test(bId);
      const s = isReignTitleOrEpithet ? aSnapped : bSnapped;
      const t = isReignTitleOrEpithet ? bSnapped : aSnapped;
      const sId = isReignTitleOrEpithet ? aId : bId;
      const tId = isReignTitleOrEpithet ? bId : aId;

      const triple = validateAndCanonicalizeTriple(
        { id: sId, name: s.name, type: 'HISTORICAL_PERSON' },
        'ALIAS_OF',
        { id: tId, name: t.name, type: 'HISTORICAL_PERSON' },
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

  // 6. Ancient Toponym to Modern Administrative Matcher (Span Pairwise & Regex)
  const locations = candidateSpans.filter((s) => s.type === 'LOCATION');
  const SAME_AS_LOC_PATTERN = /\b(?:xưa\s+nay\s+thuộc|nay\s+thuộc|nay\s+là|ngày\s+nay\s+là|thời\s+nguyễn\s+là|hiện\s+nay\s+là|vốn\s+là|xưa\s+là|tương\s+ứng\s+với|được\s+đổi\s+tên\s+thành)\b/i;
  for (let i = 0; i < locations.length; i++) {
    for (let j = 0; j < locations.length; j++) {
      if (i === j) continue;
      const locA = locations[i];
      const locB = locations[j];
      if (locA.startOffset < locB.startOffset) {
        // Skip if locA and locB are prefix-expanded variants of each other (e.g. núi Yên Tử vs Yên Tử)
        const normA = slugify(locA.text).replace(/^(?:nui|song|thanh|kinh_thanh|co_do|dong|chua|vung|dat|tinh|huyen|thanh_pho)_/, '');
        const normB = slugify(locB.text).replace(/^(?:nui|song|thanh|kinh_thanh|co_do|dong|chua|vung|dat|tinh|huyen|thanh_pho)_/, '');
        if (normA === normB) continue;

        // Skip if both are enclosed inside the same composite event
        if (locA.isEnclosedModifier && locB.isEnclosedModifier && locA.enclosingSpanText === locB.enclosingSpanText) continue;

        // Skip if there is an intervening location between locA and locB
        const hasInterveningLoc = locations.some(
          (m) => m !== locA && m !== locB && m.startOffset > locA.endOffset && m.endOffset < locB.startOffset
        );
        if (hasInterveningLoc) continue;

        const charDist = locB.startOffset - locA.endOffset;
        if (charDist > 120 || charDist < 0) continue;
        const mid = text.substring(locA.endOffset, locB.startOffset);
        if (mid.includes('\n') || mid.includes('.')) continue;
        const LOC_ALIAS_PATTERN = /\b(?:còn\s+được\s+gọi\s+là|còn\s+gọi\s+là|còn\s+có\s+tên\s+là|tên\s+gọi\s+khác\s+là)\b/i;
        if (LOC_ALIAS_PATTERN.test(mid)) {
          const sId = locA.suggestedCanonicalId || `loc_${slugify(locA.text)}`;
          const tId = locB.suggestedCanonicalId || `loc_${slugify(locB.text)}`;
          if (sId !== tId) {
            const triple = validateAndCanonicalizeTriple(
              { id: sId, name: locA.text, type: 'LOCATION' },
              'ALIAS_OF',
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
        } else if (SAME_AS_LOC_PATTERN.test(mid)) {
          const isContainment = /\b(?:thuộc|nằm\s+tại|ở|tại)\b/i.test(mid) || /\btỉnh\s+/i.test(mid);
          const sId = locA.suggestedCanonicalId || `loc_${slugify(locA.text)}`;
          const tId = locB.suggestedCanonicalId || `loc_${slugify(locB.text)}`;
          if (sId !== tId) {
            const relType: HistoricalRelationType = isContainment ? 'HAPPENED_AT' : 'SAME_AS_LOCATION';
            const triple = validateAndCanonicalizeTriple(
              { id: sId, name: locA.text, type: 'LOCATION' },
              relType,
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

  return results;
}
