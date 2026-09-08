import { resolveCanonicalEntity, removeVietnameseAccents, isKnownMasterEntity } from '@chronoviet/shared-spec';

export interface ChatTurnContext {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationDialogueState {
  veneratedEntities: string[];
  adversaryEntities: string[];
  activeLocations: string[];
  activeDocuments: string[];
  activeDynasty?: string;
  activeTemporalYears: number[];
  primaryEntity?: string;
  contextBanner?: string;
}

const KNOWN_ADVERSARY_PERSONS = new Set([
  'thoát hoan',
  'ô mã nhi',
  'toa đô',
  'tô định',
  'mã viện',
  'vương thông',
  'liễu thăng',
  'trương phụ',
  'mộc thạnh',
  'sầm nghi đống',
  'tôn sĩ nghị',
  'de castries',
  'navarre',
  'christian de castries',
  'henri navarre',
  'tôn hạo',
  'cao biền',
]);

const DOCUMENT_KEYWORDS = /(?:chiếu|hịch|cáo|sách|thư|tập|ký|lục|tuyên\s*ngôn)/i;

/**
 * Extracts and tracks dialogue state across turns using deterministic Stage-1 entity typing
 * without adding LLM latency or hardware overhead (< 0.5ms).
 */
export function extractDialogueState(
  history: ChatTurnContext[] = [],
  currentQuery?: string
): ConversationDialogueState {
  const veneratedEntities: string[] = [];
  const adversaryEntities: string[] = [];
  const activeLocations: string[] = [];
  const activeDocuments: string[] = [];
  const activeTemporalYears: number[] = [];
  const allEntities: string[] = [];
  let activeDynasty: string | undefined;

  if ((!history || history.length === 0) && (!currentQuery || !currentQuery.trim())) {
    return {
      veneratedEntities,
      adversaryEntities,
      activeLocations,
      activeDocuments,
      activeTemporalYears,
    };
  }

  const addNamedEntity = (rawName: string) => {
    if (!rawName || rawName.trim().length <= 2) return;
    const clean = rawName.trim();
    if (!isKnownMasterEntity(clean)) return;
    const resolved = resolveCanonicalEntity(clean);
    const canonical = resolved.canonicalName || clean;
    const lower = canonical.toLowerCase();

    if (!allEntities.includes(canonical)) {
      allEntities.push(canonical);
    }

    if (resolved.type === 'LOCATION' || /(?:kinh\s*đô|thành|sông|núi|tỉnh|cửa\s*biển|vườn)\s+[A-ZÀ-Ỹ]/i.test(clean)) {
      if (!activeLocations.includes(canonical)) activeLocations.push(canonical);
      return;
    }

    if (resolved.type === 'DOCUMENT_CULTURE' || DOCUMENT_KEYWORDS.test(clean) || resolved.type === 'EVENT' || /(?:chiếu|hịch|cáo|sách)\s+[A-ZÀ-Ỹ]/i.test(clean)) {
      if (!activeDocuments.includes(canonical)) activeDocuments.push(canonical);
      return;
    }

    if (resolved.type === 'HISTORICAL_PERSON' || /^[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+$/.test(clean)) {
      if (KNOWN_ADVERSARY_PERSONS.has(lower) || /(?:tướng\s*giặc|thái\s*thú|chỉ\s*huy\s*pháp|tướng\s*mông)/i.test(clean)) {
        if (!adversaryEntities.includes(canonical)) adversaryEntities.push(canonical);
      } else {
        if (!veneratedEntities.includes(canonical)) veneratedEntities.push(canonical);
      }
      return;
    }

    if (/(?:nhà|triều)\s+(?:lý|trần|lê|nguyễn|đinh|tiền\s*lê|hồ|tây\s*sơn|mạc|ngô)/i.test(clean)) {
      activeDynasty = canonical;
    }
  };

  const scanText = (text: string) => {
    // 1. Scan Proper Noun candidates (2-4 capitalized words) using Unicode property lookaround (NOT \b which breaks on accented letters)
    const matches = text.match(/(?:(?<!\p{L})\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+){1,3}(?!\p{L}))/gu);
    if (matches) {
      for (const m of matches) {
        addNamedEntity(m);
      }
    }

    // 2. Scan quoted works e.g. "Bình Ngô Đại Cáo", "Chiếu dời đô"
    const quoted = text.match(/["“]([^"”]{3,40})["”]/g);
    if (quoted) {
      for (const q of quoted) {
        addNamedEntity(q.replace(/["“”]/g, ''));
      }
    }

    // 3. Scan years
    const yearMatches = text.match(/\b(?:năm\s+)?(\d{2,4})(?:\s*(?:TCN|SCN))?\b/gi);
    if (yearMatches) {
      for (const y of yearMatches) {
        const num = parseInt(y.replace(/\D/g, ''), 10);
        if (num >= 40 && num <= 2026 && !activeTemporalYears.includes(num)) {
          activeTemporalYears.push(num);
        }
      }
    }
  };

  // Chronological scan: user turns take priority, assistant turns follow
  const userTurns = history.filter((t) => t.role === 'user');
  for (const turn of userTurns) {
    scanText(turn.content);
  }

  const recentAssistantTurns = history.filter((t) => t.role === 'assistant').slice(-2);
  for (const turn of recentAssistantTurns) {
    scanText(turn.content);
  }

  if (currentQuery && currentQuery.trim()) {
    scanText(currentQuery.trim());
  }

  const primaryEntity = veneratedEntities[0] || adversaryEntities[0] || activeDocuments[0] || activeLocations[0];

  // Construct structured context banner if meaningful context exists
  let contextBanner: string | undefined;
  const bannerParts: string[] = [];
  if (primaryEntity) bannerParts.push(`Nhân vật / Chủ đề trọng tâm: ${primaryEntity}`);
  if (activeDocuments.length > 0) bannerParts.push(`Văn kiện / Tác phẩm: ${activeDocuments.slice(0, 2).join(', ')}`);
  if (activeLocations.length > 0) bannerParts.push(`Địa danh liên quan: ${activeLocations.slice(0, 2).join(', ')}`);
  if (activeDynasty) bannerParts.push(`Triều đại: ${activeDynasty}`);
  if (activeTemporalYears.length > 0) bannerParts.push(`Niên đại: ${activeTemporalYears.slice(0, 2).join(', ')}`);

  if (bannerParts.length > 0 && history.length >= 2) {
    contextBanner = `[MẠCH NGỮ CẢNH HỘI THOẠI ĐANG TIẾP DIỄN: ${bannerParts.join(' | ')}]`;
  }

  return {
    veneratedEntities,
    adversaryEntities,
    activeLocations,
    activeDocuments,
    activeDynasty,
    activeTemporalYears,
    primaryEntity,
    contextBanner,
  };
}

export interface TypedRecentEntities {
  persons: string[];
  locations: string[];
  others: string[];
  all: string[];
}

export function extractTypedRecentEntities(history: ChatTurnContext[]): TypedRecentEntities {
  const state = extractDialogueState(history);
  return {
    persons: [...state.veneratedEntities, ...state.adversaryEntities],
    locations: state.activeLocations,
    others: state.activeDocuments,
    all: [
      ...state.veneratedEntities,
      ...state.adversaryEntities,
      ...state.activeDocuments,
      ...state.activeLocations,
    ],
  };
}

export function extractRecentEntities(history: ChatTurnContext[]): string[] {
  return extractTypedRecentEntities(history).all;
}

export const CONTINUATION_INTENT_REGEX =
  /^(?:sau\s*đó|khi\s*nào|ở\s*đâu|vì\s*sao|tại\s*sao|như\s*thế\s*nào|kết\s*quả\s*thế\s*nào|ai\s*là|ai\s*đã|vị\s*vua\s*nào|người\s*nào|tướng\s*nào)/i;

export const PRONOUN_COREF_CHECK_REGEX =
  /(?:ông\s*ấy|bà\s*ấy|vị\s*tướng|nhân\s*vật|hắn|hắn\s*ta|tên\s*tướng|tướng\s*giặc|quân\s*giặc|ngài|ông\s*ta|bà\s*ta|(?:^|[\s,;:.!?])ông(?:$|[\s,;:.!?])|(?:^|[\s,;:.!?])bà(?:$|[\s,;:.!?])|người\s*vợ|người\s*chồng|gia\s*tộc|sau\s*đó|khi\s*nào|ở\s*đâu|vì\s*sao|tại\s*sao)/i;

export function isContinuationOrCoreferenceQuery(query: string): boolean {
  const trimmed = (query || '').trim();
  return CONTINUATION_INTENT_REGEX.test(trimmed) || PRONOUN_COREF_CHECK_REGEX.test(trimmed);
}

/**
 * Rewrites a user query to be self-contained for RAG retrieval using Dialogue State Tracking
 * without mutating or butchering the natural phrasing of the user's question.
 */
export function rewriteMultiTurnQuery(
  query: string,
  history: ChatTurnContext[] = [],
  injectedState?: ConversationDialogueState
): string {
  const trimmed = query.trim();
  if (!history || history.length === 0) {
    return trimmed;
  }

  const isContinuation = CONTINUATION_INTENT_REGEX.test(trimmed);
  const hasPronoun = PRONOUN_COREF_CHECK_REGEX.test(trimmed);

  if (!isContinuation && !hasPronoun) {
    return trimmed;
  }

  const state = injectedState || extractDialogueState(history);
  const veneratedAnchor = state.veneratedEntities[0];
  const adversaryAnchor = state.adversaryEntities[0];
  const primaryEntity = state.primaryEntity;

  if (!primaryEntity) {
    return trimmed;
  }

  let rewritten = trimmed;

  // 1. Adversary pronouns: "hắn", "hắn ta", "tên tướng đó", "tướng giặc đó" (excluding interrogative "tướng giặc nào")
  if (adversaryAnchor && /(?:hắn\s*ta|hắn|(?:tên\s*tướng|tướng\s*giặc|quân\s*giặc)\s+(?:này|đó|ấy))/i.test(rewritten)) {
    rewritten = rewritten.replace(
      /(?:hắn\s*ta|hắn|(?:tên\s*tướng|tướng\s*giặc|quân\s*giặc)\s+(?:này|đó|ấy))/gi,
      adversaryAnchor
    );
  }

  // 2. Event & campaign phrases: "cuộc khởi nghĩa", "trận đánh", "chiến dịch" (when not already followed by a proper noun)
  if (veneratedAnchor || primaryEntity) {
    const anchor = veneratedAnchor || primaryEntity;
    rewritten = rewritten.replace(
      /(?:cuộc\s*khởi\s*nghĩa|trận\s*đánh|chiến\s*dịch|triều\s*đại)\s*(?:này|đó|ấy)?(?!\s+[A-ZÀ-Ỹ])/gi,
      (match) => `${match.trim()} ${anchor}`
    );
  }

  // 2. Relational kinship phrases: "người vợ của ông", "người chồng của bà", "gia tộc ông", "với gia tộc ông"
  if (veneratedAnchor) {
    rewritten = rewritten.replace(
      /(?:người\s*vợ|vợ|người\s*chồng|chồng|thân\s*phụ|thân\s*mẫu|cha|mẹ|anh|em|con|tướng|quân\s*sư|thầy|tác\s*phẩm|câu\s*nói|chiến\s*công|vai\s*trò|công\s*lao|gia\s*tộc)\s+(?:của\s+)?(?:ông\s*ấy|bà\s*ấy|ông|bà|ngài|vị\s*(?:tướng\s*)?(?:này|đó|ấy))/gi,
      (match) => match.replace(/(?:ông\s*ấy|bà\s*ấy|ông|bà|ngài|vị\s*(?:tướng\s*)?(?:này|đó|ấy))$/i, veneratedAnchor)
    );

    rewritten = rewritten.replace(
      /(?:với\s+gia\s+tộc|cho|với|của)\s+(?:ông\s*ấy|bà\s*ấy|ông|bà|ngài|vị\s*(?:tướng\s*)?(?:này|đó|ấy))(?=[\s,?.!]|$)/gi,
      (match) => match.replace(/(?:ông\s*ấy|bà\s*ấy|ông|bà|ngài|vị\s*(?:tướng\s*)?(?:này|đó|ấy))$/i, veneratedAnchor)
    );

    // Leading subject: "Ông có...", "Bà có...", "Ngài..."
    if (/^(?:ông\s*ấy|bà\s*ấy|vị\s*(?:tướng\s*)?(?:này|đó|ấy)|ông|bà|ngài)\s+/i.test(rewritten)) {
      rewritten = rewritten.replace(
        /^(?:ông\s*ấy|bà\s*ấy|vị\s*(?:tướng\s*)?(?:này|đó|ấy)|ông|bà|ngài)\s+/i,
        `${veneratedAnchor} `
      );
    }
  }

  // 3. Continuation clauses with Pro-Drop (Ẩn chủ ngữ / Zero-Anaphora)
  if (CONTINUATION_INTENT_REGEX.test(rewritten)) {
    const stripped = rewritten.replace(CONTINUATION_INTENT_REGEX, '').trim();
    const hasExplicitProperNoun = /(?:[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+)/.test(stripped);

    if (!hasExplicitProperNoun) {
      rewritten = `${primaryEntity}: ${rewritten}`;
    } else {
      // If query mentions an active location or concept, attach active document or person context
      const docAnchor = state.activeDocuments[0] || veneratedAnchor;
      if (docAnchor && !rewritten.toLowerCase().includes(docAnchor.toLowerCase())) {
        rewritten = `${rewritten} (${docAnchor})`;
      }
    }
  }

  // 4. Remaining isolated pronouns
  if (rewritten === trimmed && veneratedAnchor) {
    const replaced = rewritten.replace(
      /(?:ông\s*ấy|bà\s*ấy|vị\s*tướng\s*(?:này|đó|ấy)|nhân\s*vật\s*(?:này|đó|ấy))/i,
      veneratedAnchor
    );
    if (replaced !== rewritten) {
      rewritten = replaced;
    }
  }

  return rewritten;
}
