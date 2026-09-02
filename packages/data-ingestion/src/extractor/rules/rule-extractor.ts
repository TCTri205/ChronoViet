import {
  resolveCanonicalEntity,
  getCanonicalEntityIdPrefix,
} from '@chronoviet/shared-spec';
import {
  extractHistoricalCandidateSpans,
  slugify,
} from '../../text/vietnamese-ner.js';
import { ExtractedTriple, isHistorianCommentaryText } from '../types.js';
import { ACTION_VERBS_LED_BY } from '../helpers/mention-resolver.js';
import { validateAndCanonicalizeTriple } from '../canonicalizer/validator.js';
import { extractSyntacticParentheticalTriples } from '../heuristics/parenthetical.js';
import { extractRoyalLineageTriples } from '../heuristics/royal-lineage.js';
import { extractSpatialHierarchyTriples } from '../heuristics/spatial.js';

/**
 * Stage 1 Fast-Path Rule-Based & Candidate-Guided Triple Extractor
 */
export function extractTriplesFromText(text: string, options?: { headingAnchorYear?: number }): ExtractedTriple[] {
  if (!text || typeof text !== 'string') return [];

  const isCommentary = isHistorianCommentaryText(text);
  const candidateSpans = extractHistoricalCandidateSpans(text);
  const triples: ExtractedTriple[] = [];

  // Sentential Discourse Anaphora:
  // Detect historical pronouns in sentence S_i that refer to S_{i-1}'s principal leader/person
  const sentences = text.split(/(?<=[.!?])\s+/);
  const GENERIC_ANAPHORA_PRONOUNS = [
    'người đứng đầu chính phủ',
    'người đứng đầu',
    'vị tư lệnh',
    'tổng tư lệnh',
    'vị tổng tư lệnh',
    'vị thủ lĩnh',
    'vị thủ lĩnh cần vương',
    'thủ lĩnh cần vương',
    'vị danh tướng',
    'vị tướng lĩnh',
    'vị lãnh tụ',
    'vị anh hùng áo vải',
    'người anh hùng áo vải',
    'nhà vua',
    'vị hoàng đế',
    'thục vương',
    'nữ vương',
    'vạn thắng vương',
    'bình định vương',
    'hưng đạo đại vương',
    'hưng đạo vương',
    'chúa tiên',
  ];

  const EPITHET_PERSON_MAP: Record<string, string> = {
    'thục vương': 'person_an_duong_vuong',
    'nữ vương': 'person_hai_ba_trung',
    'vạn thắng vương': 'person_dinh_tien_hoang',
    'bình định vương': 'person_le_loi',
    'hưng đạo đại vương': 'person_tran_hung_dao',
    'hưng đạo vương': 'person_tran_hung_dao',
    'chúa tiên': 'person_nguyen_hoang',
    'vị anh hùng áo vải': 'person_quang_trung',
    'người anh hùng áo vải': 'person_quang_trung',
  };

  const initialPersons = candidateSpans.filter((s) => s.type === 'HISTORICAL_PERSON');
  const leadPerson = initialPersons[0];

  for (let sIdx = 1; sIdx < sentences.length; sIdx++) {
    const sent = sentences[sIdx];
    const sentLower = sent.toLowerCase();
    const prevSentencePersons = initialPersons.filter((p) => sentences[sIdx - 1].includes(p.text));
    const targetPerson = prevSentencePersons[0] || leadPerson;
    if (!targetPerson) continue;

    for (const pronoun of GENERIC_ANAPHORA_PRONOUNS) {
      const pIdx = sentLower.indexOf(pronoun);
      if (pIdx !== -1) {
        const sentStart = text.indexOf(sent);
        const startOffset = sentStart + pIdx;
        const endOffset = startOffset + pronoun.length;
        const alreadyExists = candidateSpans.some(
          (s) => Math.max(s.startOffset, startOffset) < Math.min(s.endOffset, endOffset)
        );
        if (!alreadyExists) {
          const canonId = EPITHET_PERSON_MAP[pronoun] || targetPerson.suggestedCanonicalId || `person_${slugify(targetPerson.text)}`;
          candidateSpans.push({
            text: text.substring(startOffset, endOffset),
            type: 'HISTORICAL_PERSON',
            startOffset,
            endOffset,
            confidence: 0.95,
            sourceLayer: 'HYBRID',
            suggestedCanonicalId: canonId,
            priority: 25,
          });
        }
      }
    }
  }

  // Persons that have at least one standalone occurrence (not enclosed inside an Event or Org)
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
  // console.log('DEBUG persons:', persons);
  const events = candidateSpans.filter((s) => s.type === 'EVENT_BATTLE');
  const locations = candidateSpans.filter((s) => s.type === 'LOCATION');
  const dynasties = candidateSpans.filter((s) => s.type === 'DYNASTY_ERA');
  const docs = candidateSpans.filter((s) => s.type === 'DOCUMENT_CULTURE');
  const orgs = candidateSpans.filter((s) => s.type === 'ORGANIZATION');
  const artifacts = candidateSpans.filter((s) => s.type === 'ARTIFACT');

  // 1. Link Events -> Leaders (LED_BY) with Strict Action Verb Guard
  if (!isCommentary) {
    for (const ev of events) {
      for (const p of persons) {
        if (ev.startOffset >= p.endOffset) {
          const charDist = ev.startOffset - p.endOffset;
          if (charDist > 75) continue;
          const mid = text.substring(p.endOffset, ev.startOffset).trim();
          if (mid.includes('\n') || mid.includes('.')) continue;
          if (ACTION_VERBS_LED_BY.test(mid) || /(?<!\p{L})(lãnh\s+đạo|chỉ\s+huy|thống\s+lĩnh|chủ\s+trì|tiến\s+đánh|đại\s+phá|đánh\s+tan|khởi\s+xướng|chỉ\s+đạo)(?!\p{L})/iu.test(mid)) {
            const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
            const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
            const t = validateAndCanonicalizeTriple(
              { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
              'LED_BY',
              { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
              0.98,
              options?.headingAnchorYear
            );
            if (t) triples.push(t);
          }
        } else if (p.startOffset >= ev.endOffset) {
          const charDist = p.startOffset - ev.endOffset;
          if (charDist > 75) continue;
          const mid = text.substring(ev.endOffset, p.startOffset).trim();
          if (mid.includes('\n') || mid.includes('.')) continue;
          const postPersonText = text.substring(p.endOffset, Math.min(text.length, p.endOffset + 35));
          const hasLeaderAction = ACTION_VERBS_LED_BY.test(mid) ||
            /(?<!\p{L})(do|dưới\s+sự\s+lãnh\s+đạo\s+của|lãnh\s+đạo|chỉ\s+huy|thống\s+lĩnh|khởi\s+xướng)(?!\p{L})/iu.test(mid) ||
            ACTION_VERBS_LED_BY.test(postPersonText) ||
            /(?<!\p{L})(lãnh\s+đạo|chỉ\s+huy|khởi\s+xướng|chỉ\s+đạo)(?!\p{L})/iu.test(postPersonText);
          if (hasLeaderAction) {
            const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
            const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
            const t = validateAndCanonicalizeTriple(
              { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
              'LED_BY',
              { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
              0.98,
              options?.headingAnchorYear
            );
            if (t) triples.push(t);
          }
        }
      }
    }
  }

  // 2. Link Events -> Locations (HAPPENED_AT)
  for (const ev of events) {
    for (const loc of locations) {
      // 2a. Enclosed Toponym in Event Name (e.g., "Chiến dịch Điện Biên Phủ" contains "Điện Biên Phủ", "Khởi nghĩa Yên Bái" contains "Yên Bái")
      if (loc.startOffset >= ev.startOffset && loc.endOffset <= ev.endOffset) {
        const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
        const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
          'HAPPENED_AT',
          { id: locId, name: loc.text, type: 'LOCATION' },
          1.0,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
        continue;
      }

      const minOffset = Math.min(ev.endOffset, loc.endOffset);
      const maxOffset = Math.max(ev.startOffset, loc.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 90 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (/^(?:,\s*)?(?:diễn\s+ra\s+tại|diễn\s+ra\s+ở|tại|ở|trên|trên\s+sông|tại\s+vùng|tại\s+cửa\s+biển|ngoài\s+khơi)(?:\s+(?:thành\s+phố|tỉnh|huyện|thị\s+xã|sông|núi|vùng|đất))?\s*$/i.test(mid) || /(?<!\p{L})(tại|ở|trên|diễn\s+ra)(?!\p{L})/iu.test(mid) || mid === ',' || mid === '') {
        const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
        const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
          'HAPPENED_AT',
          { id: locId, name: loc.text, type: 'LOCATION' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 2b. Link Persons -> Locations (HAPPENED_AT) with Prepositions & Actions (Bi-directional)
  const STRICT_LOC_PREP_INNER = /^(?:,\s*)?(?:ở\s+tại|ở|tại|đóng\s+đô\s+ở|định\s+đô\s+ở|đóng\s+đô\s+tại|quê\s+ở|sinh\s+tại|mất\s+tại|hy\s+sinh\s+tại|dời\s+đô\s+về|dời\s+đô|đóng\s+quân\s+tại|đóng\s+quân\s+ở|căn\s+cứ|dựng\s+cờ\s+ở|lên\s+ngôi\s+ở|xây|xây\s+dựng|cho\s+xây\s+dựng|cho\s+xây|cho\s+đúc|cho\s+đặt|làm\s+nơi\s+an\s+nghỉ|đắp|lập|dấy\s+binh\s+khởi\s+nghĩa\s+tại|khởi\s+nghĩa\s+tại|lập\s+căn\s+cứ\s+tại|hoạt\s+động\s+tại|tu\s+hành\s+tại|lãnh\s+đạo\s+tại|mở\s+trường\s+tại|ra\s+đi\s+tìm\s+đường\s+cứu\s+nước\s+tại|đọc\s+tuyên\s+ngôn\s+tại|hội\s+đàm\s+tại|tập\s+kết\s+tại|(?:chỉ\s+huy\s+)?(?:tiến\s+về|tiến\s+quân\s+về|tiến\s+đánh|đánh\s+chiếm|giải\s+phóng|hành\s+quân\s+về|hành\s+quân\s+đến|tiến\s+vào))(?:\s+(?:thành\s+phố|tỉnh|huyện|thị\s+xã|vùng|đất))?\s*$/i;
  for (const p of persons) {
    for (const loc of locations) {
      const minOffset = Math.min(p.endOffset, loc.endOffset);
      const maxOffset = Math.max(p.startOffset, loc.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;

      // If mid begins with sequential conjunction "rồi / sau đó", the person immediately preceding mid
      // was the direct object/recipient of the prior action, not the subject of the ensuing action at loc!
      if (/^(?:rồi|sau\s+đó)\s+/i.test(mid) && p.endOffset <= loc.startOffset) continue;

      // Anti-clique: If there is an intermediate location between p and loc, loc is a spatial modifier of that location, not p!
      const hasIntermediateLoc = locations.some((other) => other !== loc && other.startOffset >= minOffset && other.endOffset <= maxOffset);
      if (hasIntermediateLoc) continue;

      // Inverted Locative Topic support: "Tại/Ở [Loc], [Person]..."
      let isInvertedTopic = false;
      if (loc.endOffset <= p.startOffset) {
        const preLocText = text.substring(Math.max(0, loc.startOffset - 35), loc.startOffset).trim();
        const hasInvertedLocPrep = /(?:^|[.\n?!]\s*)(?:tại|ở|trên|từ|về|đến|bên)(?:\s+(?:sở\s+chỉ\s+huy|chiến\s+lũy|căn\s+cứ|doanh\s+trại|vùng|mặt\s+trận|thành|cửa))?\s*$/iu.test(preLocText) ||
          /(?<!\p{L})(tại|ở|trên)(?:\s+(?:sở\s+chỉ\s+huy|chiến\s+lũy|căn\s+cứ|doanh\s+trại|vùng|mặt\s+trận|thành|cửa))?(?!\p{L})/iu.test(preLocText);
        const isLocCommaPerson = /^(?:,\s*)?(?:thì|đã|liền)?\s*$/i.test(mid) || mid === ',' || mid === '';
        if (hasInvertedLocPrep && isLocCommaPerson) {
          isInvertedTopic = true;
        }
      }

      // Guard: If there is an Event in the sentence linking this person (as commander) to this location,
      // and mid contains battle leadership verbs rather than personal stay/residence, avoid emitting duplicate Person HAPPENED_AT Location.
      const hasBattleEventAtLoc = events.some((ev) => {
        const isNearPerson = Math.abs(ev.startOffset - p.endOffset) < 90 || Math.abs(p.startOffset - ev.endOffset) < 90;
        const isNearLoc = Math.abs(ev.startOffset - loc.endOffset) < 90 || Math.abs(loc.startOffset - ev.endOffset) < 90;
        return isNearPerson && isNearLoc;
      });
      const hasPersonalResidenceVerb = /(quê|sinh|mất|hy\s+sinh|đóng\s+đô|dời\s+đô|an\s+táng|tu\s+hành|lập\s+căn\s+cứ)/i.test(mid) ||
        /(quê|sinh|mất|hy\s+sinh|đóng\s+đô|dời\s+đô|an\s+táng|tu\s+hành|lập\s+căn\s+cứ)/i.test(text.substring(p.startOffset, Math.min(text.length, p.endOffset + 40)));
      if (hasBattleEventAtLoc && !hasPersonalResidenceVerb && /(chỉ\s+huy|lãnh\s+đạo|thống\s+lĩnh|cầm\s+quân)/i.test(mid)) {
        continue;
      }

      if (
        isInvertedTopic ||
        STRICT_LOC_PREP_INNER.test(mid) ||
        /(?<!\p{L})(tại|ở|về|đến|từ|xây|dựng|cho\s+xây|cho\s+đúc|cho\s+đặt|đóng\s+đô|dời\s+đô|định\s+đô|lên\s+ngôi|chiếm|đại\s+phá|đánh\s+tan|phất\s+cờ|khởi\s+nghĩa|dấy\s+binh|quê|sinh|mất|hy\s+sinh|căn\s+cứ|hoạt\s+động|lãnh\s+đạo|hành\s+quân|tiến\s+về|tiến\s+quân|trên)(?!\p{L})/iu.test(mid)
      ) {
        const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
        const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
          'HAPPENED_AT',
          { id: locId, name: loc.text, type: 'LOCATION' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);

        // If inverted topic links a commander to command post, also link their led battle event to this command location
        if (isInvertedTopic) {
          for (const ev of events) {
            const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
            const evLocTriple = validateAndCanonicalizeTriple(
              { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
              'HAPPENED_AT',
              { id: locId, name: loc.text, type: 'LOCATION' },
              0.98,
              options?.headingAnchorYear
            );
            if (evLocTriple) triples.push(evLocTriple);
          }
        }
      }
    }
  }

  // 2c. Link Artifacts & Documents -> Locations (HAPPENED_AT) (Bi-directional)
  for (const item of [...artifacts, ...docs]) {
    for (const loc of locations) {
      const minOffset = Math.min(item.endOffset, loc.endOffset);
      const maxOffset = Math.max(item.startOffset, loc.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;

      let isInvertedTopic = false;
      if (loc.endOffset <= item.startOffset) {
        const preLocText = text.substring(Math.max(0, loc.startOffset - 35), loc.startOffset).trim();
        const hasInvertedLocPrep = /(?:^|[.\n?!]\s*)(?:tại|ở|trên|từ|về|đến|bên)(?:\s+(?:sở\s+chỉ\s+huy|chiến\s+lũy|căn\s+cứ|doanh\s+trại|vùng|mặt\s+trận|thành|cửa))?\s*$/iu.test(preLocText) ||
          /(?<!\p{L})(tại|ở|trên)(?!\p{L})/iu.test(preLocText);
        const hasCreationAction = /(hoàn\s+thành|soạn|viết|sáng\s+tác|khởi\s+thảo|ban\s+hành|ngâm|đọc|dựng|khắc|ghi|đúc|chế\s+tạo)/i.test(mid) ||
          /(hoàn\s+thành|soạn|viết|sáng\s+tác|khởi\s+thảo|ban\s+hành|ngâm|đọc|dựng|khắc|ghi|đúc|chế\s+tạo)/i.test(text.substring(Math.max(0, item.startOffset - 40), item.endOffset));
        if (hasInvertedLocPrep && hasCreationAction) {
          isInvertedTopic = true;
        }
      }

      if (
        isInvertedTopic ||
        /^(?:,\s*)?(?:được\s+tìm\s+thấy\s+ở|được\s+lưu\s+giữ\s+tại|đặt\s+tại|tại|ở|lưu\s+tại|vang\s+lên\s+trên|viết\s+tại|ra\s+đời\s+tại|đọc\s+tại)(?:\s+(?:thành\s+phố|tỉnh|huyện|thị\s+xã|sông|núi|vùng|đất))?\s*$/i.test(mid) ||
        /(?<!\p{L})(ở|tại|trên|bên|bên\s+bờ|tìm\s+thấy|lưu\s+giữ|đặt|từ|về|đến|vang\s+lên|ban\s+hành|dời\s+đô)(?!\p{L})/iu.test(mid)
      ) {
        const itemId = item.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(item.type)}${slugify(item.text)}`;
        const locId = loc.suggestedCanonicalId || `loc_${slugify(loc.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: itemId, name: item.text, type: item.type },
          'HAPPENED_AT',
          { id: locId, name: loc.text, type: 'LOCATION' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 3. Link Events -> Dynasties / Eras (HAPPENED_IN)
  for (const ev of events) {
    for (const dyn of dynasties) {
      const minOffset = Math.min(ev.endOffset, dyn.endOffset);
      const maxOffset = Math.max(ev.startOffset, dyn.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 90 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (/^(?:,\s*)?(?:thuộc\s+thời|ở\s+thời|dưới\s+thời|thời\s+kỳ|thời|nhà|triều)\s*$/i.test(mid) || mid === '' || /(?<!\p{L})(thời|nhà|triều|phòng\s+tuyến|tấn\s+công|chống)(?!\p{L})/iu.test(mid)) {
        const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
          'HAPPENED_IN',
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 4. Link Documents -> Persons/Entities (MENTIONED_IN)
  const AUTHORSHIP_STRICT = /^(?:,\s*)?(?:do\s+)?(?:soạn|viết|biên\s+soạn|soạn\s+thảo|ban\s+hành|ban|đọc|ngâm|sáng\s+tác|trứ\s+tác|chủ\s+biên|chủ\s+trì|khởi\s+thảo|công\s+bố|của|ghi\s+trong|chép\s+trong|được\s+ghi\s+trong|nhắc\s+đến\s+trong|thuộc\s+về|ký|ký\s+kết|tham\s+gia)\s*$/i;
  for (const doc of docs) {
    for (const item of [...persons, ...orgs, ...events, ...dynasties, ...artifacts]) {
      const minOffset = Math.min(doc.endOffset, item.endOffset);
      const maxOffset = Math.max(doc.startOffset, item.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      const postItemText = text.substring(item.endOffset, Math.min(text.length, item.endOffset + 25));
      const isPassiveAuthor = /^\s*(?:do|của)\s*$/i.test(mid) && /\b(soạn|biên\s+soạn|viết|sáng\s+tác|trứ\s+tác)\b/i.test(postItemText);
      if (AUTHORSHIP_STRICT.test(mid) || isPassiveAuthor || mid === '' || /(?<!\p{L})(soạn|viết|ban|của|ghi|chép|kể|nhắc|ký|ký\s+kết|thông\s+qua|ban\s+hành|truyền\s+thuyết|trong)(?!\p{L})/iu.test(mid)) {
        const docId = doc.suggestedCanonicalId || `doc_${slugify(doc.text)}`;
        const itemId = item.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(item.type)}${slugify(item.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: itemId, name: item.text, type: item.type },
          'MENTIONED_IN',
          { id: docId, name: doc.text, type: 'DOCUMENT_CULTURE' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 4b. Link Documents -> Dynasties (HAPPENED_IN)
  const HISTORICAL_COMMENTARY_PATTERN = /(?<!\p{L})(luận\s+bàn|bàn\s+về|khảo\s+cứu|khảo\s+tả|ghi\s+chép\s+về|viết\s+về|chép\s+lại|nhắc\s+đến|đánh\s+giá)(?!\p{L})/iu;
  for (const doc of docs) {
    for (const dyn of dynasties) {
      const minOffset = Math.min(doc.endOffset, dyn.endOffset);
      const maxOffset = Math.max(doc.startOffset, dyn.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 100 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (HISTORICAL_COMMENTARY_PATTERN.test(mid)) continue;
      if (/^(?:,\s*)?(?:thuộc\s+thời|ở\s+thời|dưới\s+thời|thời\s+kỳ|thời|nhà|triều|ra\s+đời\s+thời|ban\s+hành\s+thời)\s*$/i.test(mid) || mid === '' || /(?<!\p{L})(thời|nhà|triều)(?!\p{L})/iu.test(mid)) {
        const docId = doc.suggestedCanonicalId || `doc_${slugify(doc.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: docId, name: doc.text, type: 'DOCUMENT_CULTURE' },
          'HAPPENED_IN',
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 5. Link Artifacts -> Eras/Dynasties (HAPPENED_IN / PART_OF)
  for (const art of artifacts) {
    for (const dyn of dynasties) {
      const minOffset = Math.min(art.endOffset, dyn.endOffset);
      const maxOffset = Math.max(art.startOffset, dyn.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (/^(?:,\s*)?(?:là\s+biểu\s+tượng\s+văn\s+minh\s+thời\s+đại|thuộc\s+thời\s+kỳ|thuộc\s+thời|thời\s+đại|thời|nhà|triều)\s*$/i.test(mid) || mid === '' || /(?<!\p{L})(thời|nhà|triều|văn\s+minh|chế\s+tạo|giúp|thuộc)(?!\p{L})/iu.test(mid)) {
        const artId = art.suggestedCanonicalId || `artifact_${slugify(art.text)}`;
        const dynId = dyn.suggestedCanonicalId || `dynasty_${slugify(dyn.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: artId, name: art.text, type: 'ARTIFACT' },
          'HAPPENED_IN',
          { id: dynId, name: dyn.text, type: 'DYNASTY_ERA' },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 5b. Strict Sovereignty / Dynasty / Organization PART_OF
  const STRICT_SOVEREIGNTY_REGEX = /^(?:,\s*)?(?:là\s+)?(?:vua|hoàng\s+đế|chúa|danh\s+tướng|tướng|thái\s+sư|thái\s+úy|quan)\s+(?:nhà|triều|thời)\s*$/i;
  const STRICT_FOUNDING_REGEX = /^(?:,\s*)?(?:đã\s+)?(?:sáng\s+lập|lập\s+nên|lập\s+ra|dựng\s+nên|dựng\s+nước|thành\s+lập|khởi\s+dựng|mở\s+đầu|mở\s+nền)(?:\s+(?:nhà\s+nước|triều\s+đại|vương\s+triều|nhà|triều|nước))?\s*$/i;
  const STRICT_SUBORDINATION_REGEX = /^(?:,\s*)?(?:thuộc|thuộc\s+về|phò\s+tá|phụng\s+sự|phục\s+vụ|gia\s+nhập|tham\s+gia|đầu\s+quân|giúp|hỗ\s+trợ|sát\s+cánh)(?:\s+(?:triều\s+đại|vương\s+triều|nhà|triều|thời\s+kỳ|thời|tổ\s+chức|phong\s+trào|nghĩa\s+quân|quân))?\s*$/i;
  const SOVEREIGNTY_KEYWORDS = /(?<!\p{L})(vua|hoàng\s+đế|chúa|lập\s+nên|lập\s+ra|lập\s+quốc|dựng\s+nước|dựng\s+nên|thành\s+lập|sáng\s+lập|khởi\s+dựng|củng\s+cố|bảo\s+vệ|chế\s+tạo|phò\s+tá|phụng\s+sự|phục\s+vụ|gia\s+nhập|tham\s+gia|đầu\s+quân|thuộc|thống\s+lĩnh|chỉ\s+huy|lãnh\s+đạo|lên\s+ngôi|trị\s+vì|cai\s+trị|giúp\s+sức|giúp|hỗ\s+trợ|cho\s+nhà|cho\s+triều|cho\s+nước|trấn\s+thủ|kinh\s+lược|phụ\s+chính|tạo\s+lập|mở\s+mang|mở\s+cõi|đặt\s+nền\s+móng|văn\s+trị)(?!\p{L})/iu;
  const ADVERSARIAL_DEPOSITION_KEYWORDS = /(?<!\p{L})(truất\s+ngôi|phế\s+truất|lật\s+đổ|đánh\s+đổ|đánh\s+tan|tiêu\s+diệt|chống\s+lại|chống\s+nhà|khởi\s+nghĩa\s+chống|kháng\s+cự)(?!\p{L})/iu;
  for (const p of persons) {
    for (const targetEnt of [...dynasties, ...orgs]) {
      const minOffset = Math.min(p.endOffset, targetEnt.endOffset);
      const maxOffset = Math.max(p.startOffset, targetEnt.startOffset);
      const charDist = maxOffset - minOffset;
      if (charDist > 120 || charDist < 0) continue;
      const mid = text.substring(minOffset, maxOffset).trim();
      if (mid.includes('\n') || mid.includes('.')) continue;
      if (HISTORICAL_COMMENTARY_PATTERN.test(mid)) continue;
      if (ADVERSARIAL_DEPOSITION_KEYWORDS.test(mid)) continue;
      if (STRICT_SOVEREIGNTY_REGEX.test(mid) || STRICT_FOUNDING_REGEX.test(mid) || STRICT_SUBORDINATION_REGEX.test(mid) || SOVEREIGNTY_KEYWORDS.test(mid)) {
        const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
        const tId = targetEnt.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(targetEnt.type)}${slugify(targetEnt.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
          'PART_OF',
          { id: tId, name: targetEnt.text, type: targetEnt.type },
          0.98,
          options?.headingAnchorYear
        );
        if (t) triples.push(t);
      }
    }
  }

  // 6. Link Organizations -> Leaders (LED_BY) with Strict Action Verb Guard
  if (!isCommentary) {
    for (const org of orgs) {
      for (const p of persons) {
        const minOffset = Math.min(org.endOffset, p.endOffset);
        const maxOffset = Math.max(org.startOffset, p.startOffset);
        const charDist = maxOffset - minOffset;
        if (charDist > 80 || charDist < 0) continue;
        const mid = text.substring(minOffset, maxOffset).trim();
        if (mid.includes('\n') || mid.includes('.')) continue;
        if (ACTION_VERBS_LED_BY.test(mid) || /^(?:,\s*)?(?:do|lãnh\s+đạo|chỉ\s+huy|đứng\s+đầu)\s*$/i.test(mid)) {
          const orgId = org.suggestedCanonicalId || `org_${slugify(org.text)}`;
          const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
          const t = validateAndCanonicalizeTriple(
            { id: orgId, name: org.text, type: 'ORGANIZATION' },
            'LED_BY',
            { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
            0.98,
            options?.headingAnchorYear
          );
          if (t) triples.push(t);
        }
      }
    }
  }

  // 7. Strict ALIAS_OF & SAME_AS_LOCATION (Strictly Adjacent Person-Person or Location-Location)
  const STRICT_ALIAS_REGEX = /^(?:[,\(]\s*)?(?:tức(?:\s+là)?|còn\s+gọi\s+(?:là)?|thường\s+gọi\s+(?:là)?|hay(?:\s+còn\s+gọi\s+là)?|tên\s+khác\s+là|tên\s+thật\s+là|tên\s+húy\s+là|tên\s+khai\s+sinh\s+là|vốn\s+(?:mang\s+)?(?:tên\s+)?(?:khai\s+sinh\s+là|tên\s+là)|tự\s+là|tự\s+hiệu\s+là|hiệu\s+là|danh\s+xưng\s+là|tôn\s+xưng\s+là|nguyên\s+danh\s+là|niên\s+hiệu\s+là|miếu\s+hiệu\s+là|đổi\s+họ\s+thành|lấy\s+miếu\s+hiệu\s+là|lấy\s+niên\s+hiệu\s+là|xưng\s+là|là\s+danh\s+xưng\s+của|là\s+tôn\s+xưng\s+của|được\s+suy\s+tôn\s+là|được\s+tôn\s+là|được\s+phong\s+là|lên\s+ngôi\s+(?:hoàng\s+đế|vua)?|được(?:\s+[^,.]+)?\s+(?:tôn\s+kính\s+gọi|tôn\s+xưng|gọi)(?:\s+(?:bằng\s+danh\s+xưng|bằng\s+tên|là))?)\s*(?:vua\s+|chúa\s+|chủ\s+tịch\s+|tướng\s+|hoàng\s+đế\s+)?$/iu;

  for (let i = 0; i < candidateSpans.length; i++) {
    const s1 = candidateSpans[i];
    for (let j = i + 1; j < candidateSpans.length; j++) {
      const s2 = candidateSpans[j];
      const charDist = s2.startOffset - s1.endOffset;
      if (charDist > 85 || charDist < 0) continue;

      const sub = text.substring(s1.endOffset, s2.startOffset).trim();
      if (sub.includes('\n') || sub.includes('.')) continue;

      // STRICT TYPE MATCHING REQUIRED:
      if (s1.type === 'HISTORICAL_PERSON' && s2.type === 'HISTORICAL_PERSON') {
        if (STRICT_ALIAS_REGEX.test(sub)) {
          const id1 = s1.suggestedCanonicalId || `person_${slugify(s1.text)}`;
          const id2 = s2.suggestedCanonicalId || `person_${slugify(s2.text)}`;
          const t = validateAndCanonicalizeTriple(
            { id: id1, name: s1.text, type: 'HISTORICAL_PERSON' },
            'ALIAS_OF',
            { id: id2, name: s2.text, type: 'HISTORICAL_PERSON' },
            1.0,
            options?.headingAnchorYear
          );
          if (t) triples.push(t);
        }
      } else if (s1.type === 'LOCATION' && s2.type === 'LOCATION') {
        const normA = slugify(s1.text).replace(/^(?:nui|song|thanh|kinh_thanh|co_do|dong|chua|vung|dat|tinh|huyen|thanh_pho)_/, '');
        const normB = slugify(s2.text).replace(/^(?:nui|song|thanh|kinh_thanh|co_do|dong|chua|vung|dat|tinh|huyen|thanh_pho)_/, '');
        if (normA === normB) continue;

        const isEquivalence =
          /^(?:,\s*)?(?:nay\s+là|vốn\s+là|hiện\s+nay\s+là|tương\s+ứng\s+với|chính\s+là|tức\s+là|còn\s+được\s+gọi\s+là|được\s+gọi\s+là)(?:\s+(?:thành\s+phố|tỉnh|huyện|thị\s+xã|quận|xã|vùng))?\s*$/i.test(sub) ||
          /(?<!\p{L})(?:nay\s+là|vốn\s+là|tương\s+ứng\s+với|chính\s+là|còn\s+được\s+gọi\s+là|được\s+gọi\s+là)(?!\p{L})/iu.test(sub);

        if (isEquivalence && !/\bthuộc\b/i.test(sub)) {
          const id1 = s1.suggestedCanonicalId || `loc_${slugify(s1.text)}`;
          const id2 = s2.suggestedCanonicalId || `loc_${slugify(s2.text)}`;
          const t = validateAndCanonicalizeTriple(
            { id: id1, name: s1.text, type: 'LOCATION' },
            'SAME_AS_LOCATION',
            { id: id2, name: s2.text, type: 'LOCATION' },
            1.0,
            options?.headingAnchorYear
          );
          if (t) triples.push(t);
        }
      }
    }
  }

  // 8. Merge deterministic parenthetical triples (SAME_AS_LOCATION / ALIAS_OF)
  const syntacticTriples = extractSyntacticParentheticalTriples(text, candidateSpans);
  const seenKeys = new Set(triples.map((t) => `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`));
  for (const st of syntacticTriples) {
    const key = `${st.sourceEntityId}:${st.relationType}:${st.targetEntityId}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      triples.push(st);
    }
  }

  // 8b. Merge deterministic royal lineage triples (genealogy / succession)
  const lineageTriples = extractRoyalLineageTriples(text, candidateSpans);
  for (const lt of lineageTriples) {
    const key = `${lt.sourceEntityId}:${lt.relationType}:${lt.targetEntityId}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      triples.push(lt);
    }
  }

  // 9. Merge deterministic spatial hierarchy triples (nested locations)
  const spatialTriples = extractSpatialHierarchyTriples(text, candidateSpans);
  for (const spt of spatialTriples) {
    const key = `${spt.sourceEntityId}:${spt.relationType}:${spt.targetEntityId}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      triples.push(spt);
    }
  }

  // 10. Guarded Macro Header Banner Context Propagation
  const bannerDynastyMatch = text.match(/\[(?:Kỷ\/Triều\s*Đại|Triều\s*Đại|Kỷ):\s*([^\]]+)\]/i);
  if (bannerDynastyMatch) {
    const rawBannerDynasty = bannerDynastyMatch[1].trim();
    const resolvedBannerDyn = resolveCanonicalEntity(rawBannerDynasty);
    const bannerDynId = (resolvedBannerDyn?.entityId && (resolvedBannerDyn.entityId.startsWith('dynasty_') || resolvedBannerDyn.entityId.startsWith('epoch_')))
      ? resolvedBannerDyn.entityId
      : (dynasties.find((d) => d.suggestedCanonicalId?.startsWith('dynasty_') || d.suggestedCanonicalId?.startsWith('epoch_'))?.suggestedCanonicalId || `dynasty_${slugify(rawBannerDynasty)}`);

    if (bannerDynId && (bannerDynId.startsWith('dynasty_') || bannerDynId.startsWith('epoch_'))) {
      const bannerDynName = resolvedBannerDyn?.canonicalName || rawBannerDynasty;

      // 10a. Link Artifacts & Documents to Banner Dynasty (HAPPENED_IN)
      for (const item of [...artifacts, ...docs]) {
        const itemId = item.suggestedCanonicalId || `${getCanonicalEntityIdPrefix(item.type)}${slugify(item.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: itemId, name: item.text, type: item.type },
          'HAPPENED_IN',
          { id: bannerDynId, name: bannerDynName, type: 'DYNASTY_ERA' },
          0.95,
          options?.headingAnchorYear
        );
        if (t) {
          const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            triples.push(t);
          }
        }
      }

      // 10b. Link Events & Battles to Banner Dynasty (HAPPENED_IN)
      for (const ev of events) {
        const evId = ev.suggestedCanonicalId || `event_${slugify(ev.text)}`;
        const t = validateAndCanonicalizeTriple(
          { id: evId, name: ev.text, type: 'EVENT_BATTLE' },
          'HAPPENED_IN',
          { id: bannerDynId, name: bannerDynName, type: 'DYNASTY_ERA' },
          0.94,
          options?.headingAnchorYear
        );
        if (t) {
          const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            triples.push(t);
          }
        }
      }

      // 10c. Link Sovereignty / Founding figures with explicit state actions (PART_OF Banner Dynasty)
      const SOVEREIGNTY_VERBS = /(?<!\p{L})(vua|hoàng\s+đế|thái\s+thượng\s+hoàng|chúa|xưng\s+vương|lập\s+quốc|lập\s+nên|lập\s+ra|dựng\s+nước|dời\s+đô|định\s+đô|đóng\s+đô|lên\s+ngôi|trị\s+vì|sáng\s+lập|thành\s+lập|tướng\s+quốc|thái\s+sư|thái\s+úy|nghĩa\s+quân|khởi\s+nghĩa|đầu\s+quân|phò\s+tá|phụng\s+sự|lãnh\s+đạo|chủ\s+trì|tổng\s+bí\s+thư|thủ\s+tướng|chủ\s+tịch)(?!\p{L})/iu;
      for (const p of persons) {
        const pId = p.suggestedCanonicalId || `person_${slugify(p.text)}`;
        const minOffset = Math.max(0, p.startOffset - 80);
        const maxOffset = Math.min(text.length, p.endOffset + 80);
        const snippet = text.substring(minOffset, maxOffset);
        if (SOVEREIGNTY_VERBS.test(snippet)) {
          const t = validateAndCanonicalizeTriple(
            { id: pId, name: p.text, type: 'HISTORICAL_PERSON' },
            'PART_OF',
            { id: bannerDynId, name: bannerDynName, type: 'DYNASTY_ERA' },
            0.95,
            options?.headingAnchorYear
          );
          if (t) {
            const key = `${t.sourceEntityId}:${t.relationType}:${t.targetEntityId}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              triples.push(t);
            }
          }
        }
      }
    }
  }

  return triples;
}
