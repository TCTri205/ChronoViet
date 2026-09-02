import { CandidateEntitySpan, getCanonicalEntityIdPrefix } from '@chronoviet/shared-spec';
import { slugify } from '../../text/vietnamese-ner.js';
import { ExtractedTriple } from '../types.js';
import { validateAndCanonicalizeTriple } from '../canonicalizer/validator.js';

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

  const DOC_VERB_STRICT = /\b(soạn\s+thảo|soạn|soạn\s+xong|viết|biên\s+soạn|ban\s+hành|ban|đọc|công\s+bố|ngâm|sáng\s+tác|trứ\s+tác|chủ\s+biên|chủ\s+trì|khởi\s+thảo|ghi\s+chép|chép\s+lại|kể\s+lại|viết\s+về|nhắc\s+đến|xuất\s+hiện\s+trong|ca\s+ngợi|khen\s+ngợi|khen|dâng|dâng\s+lên|trình|trong|ký\s+kết|ký|hoàn\s+thành|thảo|thảo\s+bài|khởi\s+xướng|khởi\s+xướng\s+dựng|dựng|mở\s+đầu|tổng\s+kết|bằng|qua|tác\s+giả|bài\s+thơ|cuốn|sách|tác\s+phẩm|xướng\s+họa|khắc|ghi\s+danh|san\s+định|khảo\s+cứu|khảo\s+tả|luận\s+bàn|chép|lên|cho|tới)\b/i;

  const locations = candidateSpans.filter((s) => s.type === 'LOCATION');

  for (const doc of docs) {
    for (const p of [...persons, ...orgs]) {
      const minOffset = Math.min(doc.endOffset, p.endOffset);
      const maxOffset = Math.max(doc.startOffset, p.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 180 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n')) continue;

      if (DOC_VERB_STRICT.test(mid) || mid === '' || /\b(dâng|khen\s+ngợi|ca\s+ngợi|trong)\b/i.test(text.substring(Math.max(0, p.startOffset - 25), Math.min(text.length, doc.endOffset + 25)))) {
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

    for (const loc of locations) {
      const minOffset = Math.min(doc.endOffset, loc.endOffset);
      const maxOffset = Math.max(doc.startOffset, loc.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n')) continue;
      if (/\b(tại|ở|dựng\s+tại|khắc\s+tại|đặt\s+tại|lưu\s+tại|ở\s+tại)\b/i.test(mid) || /^(?:tại|ở)\s+/i.test(text.substring(0, loc.endOffset)) || mid === '') {
        const docId = doc.suggestedCanonicalId || `doc_${slugify(doc.text)}`;
        const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: docId, name: doc.text, type: 'DOCUMENT_CULTURE' },
          'HAPPENED_AT',
          { id: locId, name: loc.text, type: 'LOCATION' },
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
