import { CandidateEntitySpan } from '@chronoviet/shared-spec';
import { slugify } from '../../text/vietnamese-ner.js';
import { ExtractedTriple } from '../types.js';
import { validateAndCanonicalizeTriple } from '../canonicalizer/validator.js';

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

  const DYNASTY_CONNECTOR = /\b(vua|hoàng\s+đế|chúa|tướng|thái\s+sư|thái\s+úy|quan|nhà|triều|thời|thuộc|dưới\s+thời|sáng\s+lập|dựng\s+nên|trị\s+vì|cai\s+trị|phục\s+vụ|vâng\s+mệnh|thống\s+lĩnh|thống\s+suất|mở\s+mang|mở\s+cõi|đặt\s+nền\s+móng|kinh\s+lược|trấn\s+thủ|phụ\s+chính|được\s+phong|dốc\s+lòng|phò\s+tá|xây\s+dựng|gia\s+nhập|hội\s+nhập|truất\s+ngôi|đốc\s+suất|chế\s+tạo|gây\s+dựng(\s+cơ\s+nghiệp)?|phòng\s+thủ\s+cho|khởi\s+dựng|lập\s+ra|lập\s+nên)\b/i;
  const HISTORICAL_COMMENTARY_PATTERN = /\b(luận\s+bàn|bàn\s+về|khảo\s+cứu|khảo\s+tả|ghi\s+chép\s+về|viết\s+về|chép\s+lại|nhắc\s+đến|đánh\s+giá)\b/i;

  const orgs = candidateSpans.filter((s) => s.type === 'ORGANIZATION');

  for (const dyn of dynasties) {
    for (const p of persons) {
      const minOffset = Math.min(dyn.endOffset, p.endOffset);
      const maxOffset = Math.max(dyn.startOffset, p.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;

      // Meta-discourse protection: Historians discussing past eras should NOT be assigned PART_OF that dynasty
      if (HISTORICAL_COMMENTARY_PATTERN.test(mid) || HISTORICAL_COMMENTARY_PATTERN.test(text.substring(Math.max(0, p.startOffset - 25), Math.min(text.length, p.endOffset + 25)))) {
        continue;
      }

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

    const docs = candidateSpans.filter((s) => s.type === 'DOCUMENT_CULTURE');
    for (const item of [...artifacts, ...docs]) {
      const minOffset = Math.min(dyn.endOffset, item.endOffset);
      const maxOffset = Math.max(dyn.startOffset, item.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 160 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      const dotCount = (mid.match(/\./g) || []).length;
      if (mid.includes('\n') || dotCount > 1) continue;
      if (dotCount === 1 && !/(?:chế\s+tạo|sáng\s+chế|đúc|ban\s+hành|biên\s+soạn|soạn\s+thảo)/i.test(mid)) continue;

      // Meta-discourse protection: Commentary books/documents discussing past eras should NOT have HAPPENED_IN that dynasty
      if (HISTORICAL_COMMENTARY_PATTERN.test(mid) || HISTORICAL_COMMENTARY_PATTERN.test(text.substring(Math.max(0, item.startOffset - 25), Math.min(text.length, item.endOffset + 25)))) {
        continue;
      }

      const dynContext = text.substring(Math.max(0, dyn.startOffset - 20), dyn.endOffset);
      if (/(?:truất\s+ngôi|lật\s+đổ|thay\s+thế|lật\s+nhà|chấm\s+dứt)/i.test(dynContext)) {
        continue;
      }

      if (/(?<!\p{L})(thuộc|thời|nhà|triều|dưới\s+thời|đúc\s+dưới|đúc|ra\s+đời|lưu\s+hành|trang\s+bị|chế\s+tạo|sáng\s+chế|ban\s+hành|ngâm|đọc|sáng\s+tác|viết|ba\s+quân|khích\s+lệ|cổ\s+vũ)(?!\p{L})/iu.test(mid) || mid === '') {
        const itemId = item.suggestedCanonicalId || `${item.type === 'DOCUMENT_CULTURE' ? 'doc_' : 'artifact_'}${slugify(item.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: itemId, name: item.text, type: item.type },
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

    // 2a. Organization -> Dynasty (e.g. Quốc Sử Quán triều Nguyễn)
    for (const org of orgs) {
      const minOffset = Math.min(dyn.endOffset, org.endOffset);
      const maxOffset = Math.max(dyn.startOffset, org.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 60 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;

      if (/\b(thuộc|thời|nhà|triều|dưới\s+thời)\b/i.test(mid) || mid === '') {
        const orgId = org.suggestedCanonicalId || `org_${slugify(org.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: orgId, name: org.text, type: 'ORGANIZATION' },
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

    // 2c. State/Country joins International Organization: "Việt Nam gia nhập WTO"
    for (const org of orgs) {
      const minOffset = Math.min(dyn.endOffset, org.endOffset);
      const maxOffset = Math.max(dyn.startOffset, org.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 80 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;

      if (/\b(gia\s+nhập|tham\s+gia|thành\s+viên|hội\s+nhập)\b/i.test(mid)) {
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const orgId = org.suggestedCanonicalId || `org_${slugify(org.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          'PART_OF',
          { id: orgId, name: org.text, type: 'ORGANIZATION' },
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

  // 2b. Organization Founding & Membership (e.g. Hội Tao Đàn, Đảng phái, Nghĩa quân, Chính phủ)
  for (const org of orgs) {
    for (const p of persons) {
      const minOffset = Math.min(org.endOffset, p.endOffset);
      const maxOffset = Math.max(org.startOffset, p.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 140 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n')) continue;

      const orgId = org.suggestedCanonicalId || `org_${slugify(org.text)}`;
      const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;

      const isFounderBeforeOrg = p.endOffset <= org.startOffset && (
        /\b(sáng\s+lập|thành\s+lập|dựng\s+nên|chủ\s+trì|lãnh\s+đạo|đứng\s+đầu|khởi\s+xướng)\b/i.test(mid) ||
        /\b(sáng\s+lập|thành\s+lập)\b/i.test(text.substring(Math.max(0, org.startOffset - 20), org.startOffset))
      );
      const isLeaderAfterOrg = p.startOffset >= org.endOffset && /\b(chủ\s+trì|lãnh\s+đạo|đứng\s+đầu|khởi\s+xướng)\b/i.test(mid);

      if (isFounderBeforeOrg || isLeaderAfterOrg) {
        const t = validateAndCanonicalizeTriple(
          { id: orgId, name: org.text, type: 'ORGANIZATION' },
          'LED_BY',
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
          1.0
        );
        if (t) {
          const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push(t);
          }
        }
      } else if (/\b(cùng|và|tham\s+gia|gia\s+nhập|hội\s+viên|thành\s+viên|xướng\s+họa|đại\s+diện|thay\s+mặt|phò\s+tá|giúp|sát\s+cánh|đoàn\s+viên)\b/i.test(mid) ||
                 /\b(đại\s+diện|thay\s+mặt|giúp)\b/i.test(text.substring(Math.max(0, p.startOffset - 20), Math.min(text.length, org.endOffset + 20)))) {
        const t = validateAndCanonicalizeTriple(
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
          'PART_OF',
          { id: orgId, name: org.text, type: 'ORGANIZATION' },
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

  // 3. Generic Event / Battle / Movement / Exam Leadership & Participation
  const events = candidateSpans.filter((s) => s.type === 'EVENT_BATTLE');
  const EXAM_KEYWORDS = /\b(thi|khoa\s+thi|kỳ\s+thi|khoa\s+mục|hội\s+thi)\b/i;
  const RULER_PATTERN = /\b(?:đời\s+vua|thời\s+vua|triều\s+vua|vua|hoàng\s+đế|chúa)\b/i;
  const EVENT_LEAD_VERB = /\b(lãnh\s+đạo|khởi\s+xướng|chỉ\s+huy|chủ\s+trì|mở\s+đầu|khởi\s+công|chỉ\s+đạo|tổng\s+tư\s+lệnh|tư\s+lệnh|chủ\s+tịch|tổng\s+bí\s+thư)\b/i;

  for (const ev of events) {
    for (const p of persons) {
      const minOffset = Math.min(ev.endOffset, p.endOffset);
      const maxOffset = Math.max(ev.startOffset, p.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 140 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n')) continue;

      const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
      const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;

      // 1. Leader presiding over / leading event or exam (Excluding scholars who passed the exam)
      const isScholar = /\b(đỗ|thủ\s+khoa|trạng\s+nguyên|bảng\s+nhãn|thám\s+hoa|tiến\s+sĩ|trúng\s+tuyển|dự\s+thi)\b/i.test(
        text.substring(Math.max(0, p.startOffset - 20), Math.min(text.length, p.endOffset + 20))
      );

      if (
        !isScholar &&
        ((EXAM_KEYWORDS.test(ev.text) && (RULER_PATTERN.test(mid) || /\b(?:vua|hoàng\s+đế|chúa)\s+/i.test(text.substring(Math.max(0, p.startOffset - 15), p.startOffset)))) ||
        EVENT_LEAD_VERB.test(mid) ||
        EVENT_LEAD_VERB.test(text.substring(Math.max(0, p.startOffset - 25), p.startOffset)) ||
        EVENT_LEAD_VERB.test(text.substring(p.endOffset, Math.min(text.length, p.endOffset + 25))))
      ) {
        const t = validateAndCanonicalizeTriple(
          { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
          'LED_BY',
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
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

      // 2. Scholar / participant in event or exam
      if (
        /\b(đỗ|thủ\s+khoa|trạng\s+nguyên|bảng\s+nhãn|thám\s+hoa|tiến\s+sĩ|trúng\s+tuyển|dự\s+thi)\b/i.test(text.substring(Math.max(0, p.endOffset), ev.startOffset)) ||
        /\b(đỗ|thủ\s+khoa|trạng\s+nguyên|bảng\s+nhãn|thám\s+hoa|tiến\s+sĩ|trúng\s+tuyển|dự\s+thi)\b/i.test(mid) ||
        /\b(tham\s+gia|hưởng\s+ứng|theo|dưới\s+trướng|cùng)\b/i.test(mid) ||
        (isScholar && charDist < 90)
      ) {
        const t = validateAndCanonicalizeTriple(
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
          'PART_OF',
          { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
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
