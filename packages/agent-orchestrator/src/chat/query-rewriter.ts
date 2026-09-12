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

export const DISCOURSE_CONNECTIVE_PREFIX_REGEX =
  /^(?:vậy\s+thì|thế\s+thì|thế\s+nhưng|vậy\s+cho\s+(?:mình|tôi|em)\s+hỏi|nhân\s+tiện|tiện\s+thể|(?:vậy|thế|còn)(?!\s*(?:kỷ|kỉ|trận|lực|thần|tử|phả|nào|gì|bao\s*nhiêu|sao)))[\s,;:!?-]+/i;

export const CONTINUATION_INTENT_REGEX =
  /^(?:sau\s*đó|khi\s*nào|ở\s*đâu|vì\s*sao|tại\s*sao|như\s*thế\s*nào|kết\s*quả\s*thế\s*nào|ai\s*là|ai\s*đã|vị\s*vua\s*nào|người\s*nào|tướng\s*nào)/i;

export const PRONOUN_COREF_CHECK_REGEX =
  /(?:(?:hai|2|cả\s+hai)\s+(?:vị|người|nhân\s*vật|vua|tướng)(?:\s+(?:này|đó|ấy))?|ông\s*ấy|bà\s*ấy|vị\s*tướng|nhân\s*vật|(?<!\p{L})(?:hắn|hắn\s*ta|ngài|ông|bà)(?!\p{L})|tên\s*tướng|tướng\s*giặc|quân\s*giặc|ông\s*ta|bà\s*ta|người\s*vợ|người\s*chồng|gia\s*tộc|sau\s*đó|khi\s*nào|ở\s*đâu|vì\s*sao|tại\s*sao)/iu;

export function isContinuationOrCoreferenceQuery(
  query: string,
  explicitEntities: string[] = []
): boolean {
  const trimmed = (query || '').trim();
  const stripped = trimmed.replace(DISCOURSE_CONNECTIVE_PREFIX_REGEX, '').trim();

  const hasExplicitSubject =
    explicitEntities.length > 0 ||
    /(?:(?<!\p{L})\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+){1,3}(?!\p{L}))/u.test(stripped);

  const hasAnaphora =
    PRONOUN_COREF_CHECK_REGEX.test(trimmed) || PRONOUN_COREF_CHECK_REGEX.test(stripped);

  // If query starts with interrogative continuation (e.g. "ai là", "vị vua nào"),
  // but already has an explicit proper noun / entity and NO backwards anaphora, it's self-contained.
  const hasInterrogativeContinuation =
    CONTINUATION_INTENT_REGEX.test(trimmed) || CONTINUATION_INTENT_REGEX.test(stripped);

  if (hasInterrogativeContinuation && hasExplicitSubject && !hasAnaphora) {
    return false;
  }

  return hasInterrogativeContinuation || hasAnaphora;
}

/**
 * Detects whether the current query represents a clean Topic Shift (introducing new explicit historical subjects)
 * rather than continuing the previous conversation's focal entity.
 */
export function isTopicShiftQuery(
  query: string,
  history: ChatTurnContext[] = [],
  currentExplicitEntities: string[] = []
): boolean {
  if (!history || history.length === 0) return false;
  if (!currentExplicitEntities || currentExplicitEntities.length === 0) return false;

  const state = extractDialogueState(history);
  const previousEntities = [
    state.primaryEntity,
    ...state.veneratedEntities,
    ...state.adversaryEntities,
    ...state.activeDocuments,
    ...state.activeLocations,
  ]
    .filter((e): e is string => Boolean(e))
    .map((e) => e.toLowerCase());

  // Check if current query introduces an entity absent from previous turns
  const hasNewExplicitEntity = currentExplicitEntities.some(
    (cur) => !previousEntities.some((prev) => prev.includes(cur.toLowerCase()) || cur.toLowerCase().includes(prev))
  );

  const hasAnaphora = PRONOUN_COREF_CHECK_REGEX.test(query);

  if (hasNewExplicitEntity && !hasAnaphora) {
    return true;
  }

  if (isContinuationOrCoreferenceQuery(query, currentExplicitEntities)) {
    return false;
  }

  return hasNewExplicitEntity;
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

  const isContinuation = isContinuationOrCoreferenceQuery(trimmed);

  if (!isContinuation) {
    return trimmed;
  }

  const state = injectedState || extractDialogueState(history);
  const veneratedAnchor = state.veneratedEntities[0];
  const adversaryAnchor = state.adversaryEntities[0];
  const primaryEntity = state.primaryEntity;

  if (!primaryEntity) {
    return trimmed;
  }

  // Strip leading discourse connective if present (e.g. "vậy ông..." -> "ông...")
  let rewritten = trimmed;
  const connectiveMatch = rewritten.match(DISCOURSE_CONNECTIVE_PREFIX_REGEX);
  if (connectiveMatch) {
    rewritten = rewritten.slice(connectiveMatch[0].length).trim();
  }

  // 0. Dual-entity / Plural coreference: "hai vị tướng này", "hai người này", "hai nhân vật này", "cả hai người"
  const dualEntities = state.veneratedEntities.length >= 2
    ? [state.veneratedEntities[0], state.veneratedEntities[1]]
    : [...state.veneratedEntities, ...state.adversaryEntities].length >= 2
    ? [state.veneratedEntities[0] || state.adversaryEntities[0], state.adversaryEntities[0] || state.veneratedEntities[1]]
    : [];

  if (dualEntities.length >= 2) {
    const dualPhrase = `${dualEntities[0]} và ${dualEntities[1]}`;
    rewritten = rewritten.replace(
      /(?:(?:hai|2|cả\s+hai)\s+(?:vị\s+tướng|vị\s+vua|nhân\s+vật|người|vị)(?:\s+(?:này|đó|ấy))?|(?:họ|hai\s+ông|hai\s+bà)(?:\s+(?:này|đó|ấy))?)/giu,
      dualPhrase
    );
  }

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

  // 3. Relational kinship phrases: "người vợ của ông", "người chồng của bà", "gia tộc ông", "với gia tộc ông"
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
    if (/^(?:ông\s*ấy|bà\s*ấy|vị\s*(?:tướng\s*)?(?:này|đó|ấy)|ông|bà|ngài)\s+/iu.test(rewritten)) {
      rewritten = rewritten.replace(
        /^(?:ông\s*ấy|bà\s*ấy|vị\s*(?:tướng\s*)?(?:này|đó|ấy)|ông|bà|ngài)\s+/iu,
        `${veneratedAnchor} `
      );
    }
  }

  // 4. Continuation clauses with Pro-Drop (Ẩn chủ ngữ / Zero-Anaphora)
  if (CONTINUATION_INTENT_REGEX.test(rewritten)) {
    const stripped = rewritten.replace(CONTINUATION_INTENT_REGEX, '').trim();
    const hasExplicitProperNoun = /(?:[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+)/.test(stripped);

    if (!hasExplicitProperNoun) {
      rewritten = `${primaryEntity}: ${rewritten}`;
    }
  }

  // 5. Remaining isolated pronouns
  if (veneratedAnchor) {
    const replaced = rewritten.replace(
      /(?:ông\s*ấy|bà\s*ấy|vị\s*tướng\s*(?:này|đó|ấy)|nhân\s*vật\s*(?:này|đó|ấy)|(?<!\p{L})(?:ông|bà|ngài)(?!\p{L}))/giu,
      veneratedAnchor
    );
    if (replaced !== rewritten) {
      rewritten = replaced;
    }
  }

  return rewritten;
}
