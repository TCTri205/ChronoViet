import {
  resolveCanonicalEntity,
  CandidateEntitySpan,
  getCanonicalEntityIdPrefix,
  inferEntityTypeFromName,
  isKnownMasterEntity,
  HistoricalRelationType,
} from '@chronoviet/shared-spec';
import {
  slugify,
  buildCanonicalId,
} from '../../text/vietnamese-ner.js';

/**
 * Action verbs required for LED_BY relations
 */
export const ACTION_VERBS_LED_BY = /(?<!\p{L})(lãnh đạo|chỉ huy|thống lĩnh|cầm quân|tướng quân|chủ tướng|thống suất|đốc suất|soạn thảo|khởi xướng|dấy binh|đứng đầu|cầm đầu|tiên phong|chủ trì|chủ mưu|mở khoa thi|mở|khởi công|chỉ đạo|sáng lập|thành lập|sáng chế|lập nên|lập ra|khởi lập|chủ xướng)(?!\p{L})/iu;

/**
 * Action verbs required for MENTIONED_IN relations
 */
export const ACTION_VERBS_MENTIONED_IN = /(?<!\p{L})(chép|ghi|viết|biên soạn|soạn thảo|san định|làm thành|tổng kết|ban hành|phê duyệt|theo|trong|trích|bàn rằng|luận rằng|sử chép|cương mục|toàn thư|sách|văn bia|chiếu|hịch|cáo|bài thơ|luật|luật lệ)(?!\p{L})/iu;

/**
 * Vietnamese historical entity prefixes to strip during mention normalization
 */
export const VI_PREFIX_STRIP_REGEX = /^(?:ở\s+tại|tại|thuộc|nay\s+thuộc|nay\s+là|vốn\s+là|quê\s+ở|vùng|xứ|đất|nước|nhà|triều|thời\s+kỳ|thời|vương\s+triều|bài\s+thơ|bộ\s+luật|sử\s+sách|tác\s+phẩm)\s+/i;

/**
 * Generic Vietnamese historical honorifics and non-entity nouns
 */
export const GENERIC_TITLES_SET = new Set([
  'tiết độ sứ', 'tướng quân', 'chủ tướng', 'thống lĩnh', 'đốc suất',
  'thái sư', 'thái úy', 'vua', 'hoàng đế', 'thái thượng hoàng',
  'quan', 'quân lính', 'giặc', 'sứ quân', 'người', 'ông', 'bà'
]);

/**
 * Normalizes an entity text mention by stripping grammatical prepositions and prefixes
 */
export function normalizeHistoricalMention(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim().replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, '').trim();
  cleaned = cleaned.replace(VI_PREFIX_STRIP_REGEX, '').trim();
  return cleaned;
}

/**
 * Snaps an extracted mention string or ID back to the nearest validated CandidateEntitySpan
 */
export function snapMentionToCandidate(
  mention: string,
  candidateSpans: CandidateEntitySpan[]
): { id: string; name: string; type: string } | null {
  if (!mention || typeof mention !== 'string') return null;
  const rawTrimmed = mention.trim();
  const cleaned = normalizeHistoricalMention(rawTrimmed);
  const lowerRaw = rawTrimmed.toLowerCase();
  const lowerClean = cleaned.toLowerCase();

  // 1. Direct match with candidate suggested ID
  const idMatch = candidateSpans.find((c) => c.suggestedCanonicalId?.toLowerCase() === lowerRaw || c.suggestedCanonicalId?.toLowerCase() === lowerClean);
  if (idMatch) {
    return {
      id: idMatch.suggestedCanonicalId!,
      name: idMatch.text,
      type: idMatch.type,
    };
  }

  // 2. Exact text match against Candidate Spans
  const exactMatch = candidateSpans.find((c) => c.text.toLowerCase() === lowerRaw || c.text.toLowerCase() === lowerClean || normalizeHistoricalMention(c.text).toLowerCase() === lowerClean);
  if (exactMatch) {
    return {
      id: exactMatch.suggestedCanonicalId || buildCanonicalId(exactMatch.text, exactMatch.type),
      name: exactMatch.text,
      type: exactMatch.type,
    };
  }

  // 2b. Check if mention resolves canonically to any candidate span's suggestedCanonicalId or alias
  const resolvedMention = resolveCanonicalEntity(cleaned) || resolveCanonicalEntity(rawTrimmed);
  if (resolvedMention && resolvedMention.type !== 'UNKNOWN') {
    const candidateWithSameCanonicalId = candidateSpans.find(
      (c) => c.suggestedCanonicalId === resolvedMention.entityId
    );
    if (candidateWithSameCanonicalId) {
      const isPrimary = slugify(resolvedMention.canonicalName) === slugify(cleaned);
      return {
        id: isPrimary ? resolvedMention.entityId : buildCanonicalId(cleaned, resolvedMention.type),
        name: cleaned || candidateWithSameCanonicalId.text,
        type: resolvedMention.type,
      };
    }
    const candidateTexts = candidateSpans.map(c => c.text.toLowerCase()).join(' ');
    if (candidateTexts.includes(lowerClean) || candidateTexts.includes(lowerRaw)) {
      if (isKnownMasterEntity(cleaned) || isKnownMasterEntity(rawTrimmed) || isKnownMasterEntity(resolvedMention.entityId)) {
        return {
          id: resolvedMention.entityId,
          name: cleaned,
          type: resolvedMention.type,
        };
      }
    }
  }

  // 3. Substring containment matching within Candidate Spans - Prioritize Known Entities and Longest Match First
  const sortedCandidates = [...candidateSpans].sort((a, b) => {
    const aKnown = a.type !== 'UNKNOWN' && !a.suggestedCanonicalId?.startsWith('unknown_');
    const bKnown = b.type !== 'UNKNOWN' && !b.suggestedCanonicalId?.startsWith('unknown_');
    if (aKnown && !bKnown) return -1;
    if (!aKnown && bKnown) return 1;
    return b.text.length - a.text.length;
  });

  for (const c of sortedCandidates) {
    const cLower = c.text.toLowerCase();
    if (lowerRaw === cLower || lowerClean === cLower || lowerRaw.includes(cLower) || lowerClean.includes(cLower)) {
      return {
        id: c.suggestedCanonicalId || buildCanonicalId(c.text, c.type),
        name: c.text,
        type: c.type,
      };
    }
  }

  // 3b. Contextual Event / Action / Construction snapping to single matching candidate
  if (
    lowerRaw.includes('cong_trinh') ||
    lowerRaw.includes('xay_dung') ||
    lowerRaw.includes('khoi_cong') ||
    lowerRaw.includes('dai_cong_trinh') ||
    lowerRaw.includes('chien_dich') ||
    lowerRaw.includes('khoi_nghia') ||
    lowerRaw.includes('tran_danh')
  ) {
    const eventCandidates = candidateSpans.filter((c) => c.type === 'EVENT_BATTLE' || c.suggestedCanonicalId?.startsWith('event_'));
    if (eventCandidates.length === 1) {
      const singleEvent = eventCandidates[0];
      return {
        id: singleEvent.suggestedCanonicalId || buildCanonicalId(singleEvent.text, singleEvent.type),
        name: singleEvent.text,
        type: singleEvent.type,
      };
    }
  }

  // 4. When candidate spans are present, strictly reject hallucinations outside the candidate pool
  if (candidateSpans.length > 0) {
    return null;
  }

  // 5. Check if mention is a generic non-entity title
  if (GENERIC_TITLES_SET.has(lowerClean) || GENERIC_TITLES_SET.has(lowerRaw)) {
    return null;
  }

  // 6. Global canonical dictionary resolution (fallback ONLY when candidate spans were not provided)
  const resolvedClean = resolveCanonicalEntity(cleaned);
  if (resolvedClean) {
    return {
      id: resolvedClean.entityId,
      name: cleaned,
      type: resolvedClean.type,
    };
  }
  const resolvedRaw = resolveCanonicalEntity(rawTrimmed);
  if (resolvedRaw) {
    return {
      id: resolvedRaw.entityId,
      name: rawTrimmed,
      type: resolvedRaw.type,
    };
  }

  // 7. Fallback only when candidate spans were not provided (legacy/standalone mode)
  const inferredType = inferEntityTypeFromName(cleaned);
  if (inferredType === 'UNKNOWN') {
    return null;
  }

  const prefix = getCanonicalEntityIdPrefix(inferredType);
  return {
    id: `${prefix}${slugify(cleaned)}`,
    name: cleaned,
    type: inferredType,
  };
}
