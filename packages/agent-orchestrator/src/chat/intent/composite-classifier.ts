import {
  resolveCanonicalEntity,
  isKnownMasterEntity,
  ChatIntent,
  ChatSubIntent,
  CompositeIntentResult,
  IntentClause,
  VideoHandoverMetadata,
} from '@chronoviet/shared-spec';
import {
  OUT_OF_DOMAIN_PATTERNS,
  PURE_CHITCHAT_PATTERNS,
  BOT_IDENTITY_PATTERNS,
  SHADOW_CHITCHAT_PATTERNS,
  PLEASANTRY_PREFIX_REGEX,
  SECONDARY_GREETING_PREFIX_REGEX,
  SECONDARY_VIDEO_SUFFIX_REGEX,
  SECONDARY_OOD_SUFFIX_REGEX,
  PRIMARY_VIDEO_START_REGEX,
  VIDEO_INTENT_PATTERNS,
  KINSHIP_AND_RELATION_REGEX,
  SUBSTANTIVE_QUESTION_REGEX,
  DIRECT_CONVERSATIONAL_ADDRESS_REGEX,
  CASUAL_REMARK_REGEX,
  CONJUNCTION_ENTITY_PATTERNS,
  SINGLE_ENTITY_IDENTITY_PATTERNS,
  CONVERSATIONAL_STOPWORDS,
} from './patterns.js';
import { normalizeResilientText } from '../text-normalizer.js';

export interface IntentClassificationSignals {
  hasChitchatGreeting: boolean;
  hasVideoGeneration: boolean;
  hasOutOfDomainTopic: boolean;
  isCoReferenceIdentity: boolean;
}

export interface IntentClassificationResult {
  intent: ChatIntent;
  subIntent?: ChatSubIntent;
  confidence: number;
  fastPathResponse?: string;
  suggestedTopic?: string;
  matchedEntityId?: string;
  matchedCanonicalName?: string;
  signals?: IntentClassificationSignals;
  cleanSearchTopic?: string;
  videoBriefTopic?: string;
  outOfDomainTopic?: string;
  needsSemanticArbitration?: boolean;
  arbitratedEntities?: string[];
  arbitratedFakeEntities?: string[];
  compositeResult?: CompositeIntentResult;
  videoHandover?: VideoHandoverMetadata;
}

function normalizeQueryText(str: string): string {
  return str
    .replace(/[?!.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a composite query into individual semantic clauses while safely preserving coordinate entities
 * (e.g. "Quang Trung và Nguyễn Huệ", "Lê Lợi và Lê Độ").
 */
export function splitQueryIntoSemanticClauses(text: string): string[] {
  for (const pattern of CONJUNCTION_ENTITY_PATTERNS) {
    if (pattern.test(text)) {
      return [text];
    }
  }

  const sentences = text
    .split(/[?.!\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const clauses: string[] = [];
  for (const sentence of sentences) {
    const parts = sentence.split(
      /,\s*(?:và|đồng\s*thời|nhân\s*tiện|tiện\s*thể|với\s*lại)\s+/i
    );

    if (parts.length > 1) {
      for (const p of parts) {
        const trimmed = p.trim();
        if (trimmed.length > 0) clauses.push(trimmed);
      }
    } else {
      clauses.push(sentence);
    }
  }
  return clauses.length > 0 ? clauses : [text];
}

/**
 * Surgically cleans an isolated historical clause by removing leading discourse connectives,
 * conversational inquiry wrappers, and trailing particles.
 */
export function cleanHistoricalClause(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^(?:và|với|cùng|nhân\s*tiện|tiện\s*thể|thế\s*thì|vậy\s*thì|vậy\s*cho\s*hỏi|tiện\s*thể\s*cho\s*hỏi|cho\s*hỏi)[\s,;:!?-]*/i, '').trim();
  cleaned = cleaned.replace(/^(?:bạn\s+có\s+thể\s+(?:cho\s+(?:tôi|mình|em)\s+biết|nói\s+(?:cho\s+)?(?:tôi|mình|em)\s+biết|giúp\s+tôi\s+biết)|cho\s+(?:tôi|mình|em)\s+biết|hãy\s+cho\s+(?:tôi|mình|em)\s+biết|cho\s+(?:tôi|mình|em)\s+hỏi|làm\s+ơn\s+cho\s+biết|hỏi\s+rằng|cho\s+hỏi|bạn\s+có\s+(?:biết|nhớ)|bạn\s+biết\s+về|bạn\s+nghĩ\s+sao\s+về)\s*/i, '').trim();
  cleaned = cleaned.replace(/^(?:(?:xin\s+)?chào(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|mọi\s+người|cả\s+nhà|chronoviet|ai))?|hello|hi|hey|alo|halo)[\s,;:!?-]*/i, '').trim();
  cleaned = cleaned.replace(/^(?:bạn\s+có\s+biết|bạn\s+biết\s+gì\s+về|kể\s+về|kể\s+cho\s+(?:tôi|mình|em)\s+nghe\s+về)\s*/i, '').trim();
  cleaned = cleaned.replace(/^(?:có\s+phải(?:\s+là)?|phải\s+chăng(?:\s+là)?|có\s+đúng(?:\s+là)?|liệu(?:\s+rằng)?|theo\s+(?:bạn|sử\s+sách)\s+thì)\s+/i, '').trim();

  cleaned = cleaned
    .replace(/(?:[\s,;:!?-]+(?:và|với))+$/i, '')
    .replace(/\s+(?:không|thế|vậy|nhỉ|hả|ạ)$/i, '')
    .replace(/[?!.,;:]+$/g, '')
    .trim();

  return cleaned;
}

const B_DELIM = '(?=$|[\\s,;!?.:~"\'/()\\-])';

export interface ExtractedHistoricalEntity {
  entityId: string;
  canonicalName: string;
  matchedText: string;
}

export function extractHistoricalEntityFromQuery(text: string): ExtractedHistoricalEntity | null {
  if (!text || typeof text !== 'string') return null;
  const clean = text.replace(/[,;!?.:~"'/()\\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = clean.split(' ').filter(Boolean);
  const n = tokens.length;

  for (let len = Math.min(4, n); len >= 1; len--) {
    for (let i = 0; i <= n - len; i++) {
      const span = tokens.slice(i, i + len).join(' ');
      const lowerSpan = span.toLowerCase();

      if (CONVERSATIONAL_STOPWORDS.has(lowerSpan)) continue;
      if (len === 1 && (span.length < 3 || lowerSpan === 'bạn' || lowerSpan === 'ban')) continue;

      if (isKnownMasterEntity(span)) {
        const canonical = resolveCanonicalEntity(span);
        if (canonical.entityId && canonical.canonicalName) {
          return { entityId: canonical.entityId, canonicalName: canonical.canonicalName, matchedText: span };
        }
      }
    }
  }
  return null;
}

export function hasHistoricalDomainSignals(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  if (/(?:năm\s+)?(?:\d{1,4}\s*(?:tcn|trước\s+công\s+nguyên|trước\s+cn|scn|sau\s+công\s+nguyên))/i.test(text)) {
    return true;
  }
  if (/\bnăm\s+[1-9]\d{1,3}\b/i.test(text)) {
    return true;
  }
  if (/\b(?:1[0-9]{3}|20[0-2][0-9])\b(?!\s*(?:câu|bài|người|cái|đồng|k|triệu|nghìn|tỷ|usd|vnd))/i.test(text)) {
    return true;
  }

  const centuryRegex = new RegExp(`(?:thế\\s*kỷ|thế\\s*kỉ|tk)\\s*(?:thứ\\s*)?(?:[ivxlcdm]+|\\d{1,2})${B_DELIM}`, 'i');
  if (centuryRegex.test(text)) return true;

  const dynastyRegex = new RegExp(`(?:thời\\s*kỳ|triều\s*đại|niên\\s*hiệu|đời\\s*vua|nhà\\s+(?:lý|trần|lê|nguyễn|hồ|tiền\\s*lê|hậu\\s*lê|ngô|đinh|tây\\s*sơn|mạc))${B_DELIM}`, 'i');
  if (dynastyRegex.test(text)) return true;

  const roleRegex = new RegExp(`(?:vua|hoàng\\s*đế|thái\\s*thượng\\s*hoàng|chúa\\s+(?:trịnh|nguyễn)|danh\\s*tướng|tướng\\s*quân|tổng\\s*đốc|kinh\\s*thành|sử\\s*ký|chính\\s*sử|dã\\s*sử|lịch\\s*sử)${B_DELIM}`, 'i');
  if (roleRegex.test(text)) return true;

  const warfareRegex = new RegExp(`(?:chiến\\s*dịch|trận\\s*đánh|khởi\\s*nghĩa|chiến\\s*thắng|đại\\s*thắng|đại\\s*phá|cọc\\s*ngầm|chiếu\\s*dời\\s*đô|hịch\\s*tướng\\s*sĩ|bình\\s*ngô\\s*đại\\s*cáo|bài\\s*binh\\s*bố\\s*trận|mai\\s*phục|thủy\\s*chiến)${B_DELIM}`, 'i');
  if (warfareRegex.test(text)) return true;

  return false;
}

export function detectHistoricalSubIntent(queryText: string): ChatSubIntent {
  const norm = queryText.toLowerCase();

  if (/(?:quan\s+hệ|thân\s+tộc|cha\s+con|mẹ\s+con|anh\s+em|vợ\s+chồng|hậu\s+duệ|tiền\s+bối|dòng\s+dõi|phả\s+hệ|tổ\s+tiên|con\s+của|cha\s+của|mẹ\s+của|vợ\s+của|chồng\s+của|gốc\s+tích\s+dòng\s+họ|đổi\s+họ|ban\s+quốc\s+tính)/i.test(norm)) {
    return 'GENEALOGY_RELATION';
  }

  if (/(?:chiến\s+thuật|kế\s+sách|trận\s+đánh|bài\s+binh|bố\s+trận|đánh\s+như\s+thế\s+nào|diễn\s+biến|mai\s+phục|thủy\s+chiến|hỏa\s+công|cọc\s+ngầm|phục\s+kích|nghi\s+binh|vây\s+hãm|phản\s+công|thế\s+trận)/i.test(norm)) {
    return 'BATTLE_TACTICS';
  }

  if (/(?:so\s+sánh|khác\s+nhau|giống\s+nhau|điểm\s+chung|ai\s+hơn|tương\s+đồng|đối\s+chiếu|phân\s+biệt)/i.test(norm)) {
    return 'COMPARATIVE_SYNTHESIS';
  }

  if (/(?:là\s+ai|ai\s+là|năm\s+nào|khi\s+nào|ở\s+đâu|bao\s+nhiêu|ai\s+là\s+người|niên\s+hiệu|tên\s+thật|thọ\s+bao\s+nhiêu|mất\s+năm|sinh\s+năm|tại\s+đâu|vào\s+thời\s+điểm\s+nào)/i.test(norm)) {
    return 'FACTOID_LOOKUP';
  }

  return 'GENERAL_OVERVIEW';
}

export function classifyChatIntent(query: string): IntentClassificationResult {
  const { normalized, shadow } = normalizeResilientText(query);
  const trimmed = normalized.trim();

  if (!trimmed) {
    return {
      intent: 'CHITCHAT',
      confidence: 1.0,
    };
  }

  const cleanQuery = normalizeQueryText(trimmed);
  const cleanShadow = normalizeQueryText(shadow);

  // 1. Primary Video Intent
  if (PRIMARY_VIDEO_START_REGEX.test(cleanQuery)) {
    for (const pattern of VIDEO_INTENT_PATTERNS) {
      const match = cleanQuery.match(pattern) || trimmed.match(pattern);
      if (match) {
        const topic = (match[1] || cleanQuery).replace(/[?!.]/g, '').trim();
        return {
          intent: 'VIDEO_INTENT',
          confidence: 0.95,
          suggestedTopic: topic || cleanQuery,
          signals: {
            hasChitchatGreeting: PLEASANTRY_PREFIX_REGEX.test(cleanQuery),
            hasVideoGeneration: true,
            hasOutOfDomainTopic: false,
            isCoReferenceIdentity: false,
          },
        };
      }
    }
  }

  // 2. Dual-Key Historical Evidence Detection
  const initialExtracted =
    extractHistoricalEntityFromQuery(cleanQuery) ||
    extractHistoricalEntityFromQuery(cleanShadow);

  const hasHistoricalEvidence =
    Boolean(initialExtracted) ||
    hasHistoricalDomainSignals(cleanQuery) ||
    hasHistoricalDomainSignals(cleanShadow);

  // 3. Non-Historical Queries Gating
  if (!hasHistoricalEvidence) {
    for (const pattern of OUT_OF_DOMAIN_PATTERNS) {
      if (pattern.test(cleanQuery) || pattern.test(trimmed) || pattern.test(cleanShadow)) {
        return {
          intent: 'OUT_OF_DOMAIN',
          confidence: 0.98,
          signals: {
            hasChitchatGreeting: false,
            hasVideoGeneration: false,
            hasOutOfDomainTopic: true,
            isCoReferenceIdentity: false,
          },
        };
      }
    }

    for (const pattern of BOT_IDENTITY_PATTERNS) {
      if (pattern.test(cleanQuery) || pattern.test(trimmed) || pattern.test(cleanShadow)) {
        return {
          intent: 'CHITCHAT',
          confidence: 0.99,
          signals: {
            hasChitchatGreeting: true,
            hasVideoGeneration: false,
            hasOutOfDomainTopic: false,
            isCoReferenceIdentity: false,
          },
        };
      }
    }

    for (const pattern of PURE_CHITCHAT_PATTERNS) {
      if (pattern.test(cleanQuery) || pattern.test(trimmed)) {
        return {
          intent: 'CHITCHAT',
          confidence: 0.95,
          signals: {
            hasChitchatGreeting: true,
            hasVideoGeneration: false,
            hasOutOfDomainTopic: false,
            isCoReferenceIdentity: false,
          },
        };
      }
    }

    for (const pattern of SHADOW_CHITCHAT_PATTERNS) {
      if (pattern.test(cleanShadow) || pattern.test(shadow)) {
        return {
          intent: 'CHITCHAT',
          confidence: 0.92,
          signals: {
            hasChitchatGreeting: true,
            hasVideoGeneration: false,
            hasOutOfDomainTopic: false,
            isCoReferenceIdentity: false,
          },
        };
      }
    }

    for (const pattern of VIDEO_INTENT_PATTERNS) {
      const match = cleanQuery.match(pattern) || trimmed.match(pattern);
      if (match) {
        const topic = (match[1] || cleanQuery).replace(/[?!.]/g, '').trim();
        return {
          intent: 'VIDEO_INTENT',
          confidence: 0.95,
          suggestedTopic: topic || cleanQuery,
          signals: {
            hasChitchatGreeting: false,
            hasVideoGeneration: true,
            hasOutOfDomainTopic: false,
            isCoReferenceIdentity: false,
          },
        };
      }
    }

    const hasKinshipOrRelation =
      KINSHIP_AND_RELATION_REGEX.test(cleanQuery) ||
      KINSHIP_AND_RELATION_REGEX.test(cleanShadow);

    const hasSubstantiveQuestion =
      SUBSTANTIVE_QUESTION_REGEX.test(cleanQuery) ||
      SUBSTANTIVE_QUESTION_REGEX.test(cleanShadow);

    const isDirectConversationalAddress =
      DIRECT_CONVERSATIONAL_ADDRESS_REGEX.test(cleanQuery) ||
      DIRECT_CONVERSATIONAL_ADDRESS_REGEX.test(cleanShadow);

    const isCasualRemark =
      CASUAL_REMARK_REGEX.test(cleanQuery) ||
      CASUAL_REMARK_REGEX.test(cleanShadow);

    if (hasKinshipOrRelation || hasSubstantiveQuestion) {
      return {
        intent: 'HISTORICAL_QUERY',
        subIntent: detectHistoricalSubIntent(cleanQuery),
        confidence: 0.65,
        needsSemanticArbitration: true,
        cleanSearchTopic: cleanQuery,
      };
    }

    if (isDirectConversationalAddress || isCasualRemark) {
      return {
        intent: 'CHITCHAT',
        confidence: 0.85,
        signals: {
          hasChitchatGreeting: true,
          hasVideoGeneration: false,
          hasOutOfDomainTopic: false,
          isCoReferenceIdentity: false,
        },
      };
    }

    return {
      intent: 'HISTORICAL_QUERY',
      subIntent: 'GENERAL_OVERVIEW',
      confidence: 0.7,
      cleanSearchTopic: cleanQuery,
      needsSemanticArbitration: true,
    };
  }

  // 4. Substantive Historical Query Detected
  const signals: IntentClassificationSignals = {
    hasChitchatGreeting: false,
    hasVideoGeneration: false,
    hasOutOfDomainTopic: false,
    isCoReferenceIdentity: false,
  };

  let videoBriefTopic: string | undefined;
  let outOfDomainTopic: string | undefined;
  let substantiveTarget = cleanQuery;

  const videoMatch = substantiveTarget.match(SECONDARY_VIDEO_SUFFIX_REGEX);
  if (videoMatch && videoMatch[0].length > 0 && videoMatch.index !== undefined) {
    signals.hasVideoGeneration = true;
    const strippedTopic = substantiveTarget.slice(0, videoMatch.index).trim();
    if (strippedTopic.length >= 3) {
      videoBriefTopic = strippedTopic;
      substantiveTarget = strippedTopic;
    }
  }

  const oodMatch = substantiveTarget.match(SECONDARY_OOD_SUFFIX_REGEX);
  if (oodMatch && oodMatch[0].length > 0 && oodMatch.index !== undefined) {
    signals.hasOutOfDomainTopic = true;
    outOfDomainTopic = oodMatch[0]
      .replace(/^(?:[\s,;:!?-]+(?:và\s+)?(?:đồng\s*thời|tiện\s*thể|nhân\s*tiện)?\s*)/i, '')
      .trim();
    const strippedTopic = substantiveTarget.slice(0, oodMatch.index).trim();
    if (strippedTopic.length >= 3) {
      substantiveTarget = strippedTopic;
    }
  }

  const rawClauses = splitQueryIntoSemanticClauses(substantiveTarget);
  const detectedIntentClauses: IntentClause[] = [];
  const historicalClauseCandidates: string[] = [];

  for (const clause of rawClauses) {
    const trimmedClause = clause.trim();
    if (!trimmedClause) continue;

    let isOOD = false;
    for (const pattern of OUT_OF_DOMAIN_PATTERNS) {
      if (pattern.test(trimmedClause)) {
        isOOD = true;
        signals.hasOutOfDomainTopic = true;
        outOfDomainTopic = trimmedClause
          .replace(/^(?:[\s,;:!?-]+(?:và\s+)?(?:đồng\s*thời|tiện\s*thể|nhân\s*tiện)?\s*)/i, '')
          .trim();
        detectedIntentClauses.push({
          intent: 'OUT_OF_DOMAIN',
          confidence: 0.95,
          querySnippet: trimmedClause,
        });
        break;
      }
    }
    if (isOOD) continue;

    let isVideo = false;
    for (const pattern of VIDEO_INTENT_PATTERNS) {
      const vMatch = trimmedClause.match(pattern);
      if (vMatch) {
        isVideo = true;
        signals.hasVideoGeneration = true;
        videoBriefTopic = (vMatch[1] || trimmedClause).replace(/[?!.]/g, '').trim();
        detectedIntentClauses.push({
          intent: 'VIDEO_INTENT',
          confidence: 0.95,
          querySnippet: trimmedClause,
        });
        break;
      }
    }
    if (isVideo) continue;

    const isGreetingOrPersona =
      PURE_CHITCHAT_PATTERNS.some((p) => p.test(trimmedClause)) ||
      BOT_IDENTITY_PATTERNS.some((p) => p.test(trimmedClause)) ||
      CASUAL_REMARK_REGEX.test(trimmedClause) ||
      DIRECT_CONVERSATIONAL_ADDRESS_REGEX.test(trimmedClause) ||
      /^(?:phạm\s*vi\s+(?:tra\s*cứu|hỗ\s*trợ|kiến\s*thức|hoạt\s*động|trợ\s*giúp)|khả\s*năng|bạn\s+có\s+thể\s+(?:giúp|làm)|bạn\s+là\s+ai|tính\s*năng)/i.test(trimmedClause);

    const hasHistInClause =
      Boolean(extractHistoricalEntityFromQuery(trimmedClause)) ||
      hasHistoricalDomainSignals(trimmedClause);

    if (isGreetingOrPersona && !hasHistInClause) {
      signals.hasChitchatGreeting = true;
      detectedIntentClauses.push({
        intent: 'CHITCHAT',
        confidence: 0.95,
        querySnippet: trimmedClause,
      });
      continue;
    }

    historicalClauseCandidates.push(trimmedClause);
    detectedIntentClauses.push({
      intent: 'HISTORICAL_QUERY',
      confidence: 0.9,
      querySnippet: trimmedClause,
    });
  }

  if (PLEASANTRY_PREFIX_REGEX.test(substantiveTarget) || SECONDARY_GREETING_PREFIX_REGEX.test(substantiveTarget)) {
    signals.hasChitchatGreeting = true;
  }

  let cleanSearchTopic = substantiveTarget;
  const hasConversationalPreambleOrSuffix =
    signals.hasChitchatGreeting || signals.hasVideoGeneration || signals.hasOutOfDomainTopic;

  if (hasConversationalPreambleOrSuffix && historicalClauseCandidates.length > 0) {
    cleanSearchTopic = historicalClauseCandidates
      .map((c) => cleanHistoricalClause(c))
      .filter((c) => c.length > 0)
      .join(' ');
  } else {
    cleanSearchTopic = cleanHistoricalClause(substantiveTarget);
  }

  if (!cleanSearchTopic || cleanSearchTopic.length < 2) {
    cleanSearchTopic = cleanHistoricalClause(substantiveTarget) || substantiveTarget;
  }

  // 4c. Conjunction / Coordinate Entity & Co-reference Identification
  for (const pattern of CONJUNCTION_ENTITY_PATTERNS) {
    const match = cleanSearchTopic.match(pattern) || cleanQuery.match(pattern);
    if (match) {
      const rawE1 = match[1]?.replace(/[?!.,;:]+$/g, '').trim();
      const rawE2 = match[2]?.replace(/[?!.,;:]+$/g, '').trim();
      const baseE1 = rawE1?.replace(/\s*\([^)]*\)/g, '').trim() || rawE1;
      const baseE2 = rawE2?.replace(/\s*\([^)]*\)/g, '').trim() || rawE2;
      const isE1Known = isKnownMasterEntity(rawE1) || isKnownMasterEntity(baseE1);
      const isE2Known = isKnownMasterEntity(rawE2) || isKnownMasterEntity(baseE2);

      if (rawE1 && rawE2 && isE1Known && isE2Known) {
        const canonical1 = resolveCanonicalEntity(isKnownMasterEntity(rawE1) ? rawE1 : baseE1);
        const canonical2 = resolveCanonicalEntity(isKnownMasterEntity(rawE2) ? rawE2 : baseE2);

        if (canonical1.entityId && canonical2.entityId) {
          signals.isCoReferenceIdentity = canonical1.entityId === canonical2.entityId;
          const videoHandover: VideoHandoverMetadata = {
            topic: (signals.hasVideoGeneration && videoBriefTopic) ? videoBriefTopic : cleanSearchTopic,
            primaryEntityId: canonical1.entityId,
            canonicalName: canonical1.canonicalName,
          };

          if (!signals.isCoReferenceIdentity) {
            const isKinshipQuestion =
              KINSHIP_AND_RELATION_REGEX.test(cleanSearchTopic || cleanQuery) ||
              /(?:quan\s+hệ|huyết\s+thống|họ\s+hàng|thân\s+tộc)/i.test(cleanSearchTopic || cleanQuery);
            const subIntent: ChatSubIntent = isKinshipQuestion
              ? 'GENEALOGY_RELATION'
              : (/(?:so\s+sánh|vai\s+trò|phân\s+công|nhiệm\s+vụ|khác\s+nhau|ai\s+hơn|đối\s+đầu|đối\s+chiếu)/i.test(cleanQuery)
                ? 'COMPARATIVE_SYNTHESIS'
                : detectHistoricalSubIntent(cleanSearchTopic || cleanQuery));

            const compositeResult: CompositeIntentResult = {
              primaryIntent: 'HISTORICAL_QUERY',
              subIntent,
              confidence: 0.95,
              clauses: detectedIntentClauses,
              hasHistoricalInquiry: true,
              hasGreetingOrIdentity: signals.hasChitchatGreeting,
              hasOutOfDomain: signals.hasOutOfDomainTopic,
              hasVideoRequest: signals.hasVideoGeneration,
              cleanSearchTopics: [cleanSearchTopic],
              videoHandover,
              outOfDomainTopic,
            };
            return {
              intent: 'HISTORICAL_QUERY',
              subIntent,
              confidence: 0.95,
              matchedEntityId: canonical1.entityId,
              matchedCanonicalName: canonical1.canonicalName,
              signals,
              cleanSearchTopic,
              videoBriefTopic,
              outOfDomainTopic,
              compositeResult,
              videoHandover,
            };
          }

          const compositeResult: CompositeIntentResult = {
            primaryIntent: 'ENTITY_IDENTITY',
            confidence: 0.95,
            clauses: detectedIntentClauses,
            hasHistoricalInquiry: true,
            hasGreetingOrIdentity: signals.hasChitchatGreeting,
            hasOutOfDomain: signals.hasOutOfDomainTopic,
            hasVideoRequest: signals.hasVideoGeneration,
            cleanSearchTopics: [cleanSearchTopic],
            videoHandover,
            outOfDomainTopic,
          };
          return {
            intent: 'ENTITY_IDENTITY',
            confidence: 0.95,
            matchedEntityId: canonical1.entityId,
            matchedCanonicalName: canonical1.canonicalName,
            signals,
            cleanSearchTopic,
            videoBriefTopic,
            outOfDomainTopic,
            compositeResult,
            videoHandover,
          };
        }
      }
    }
  }

  // 4c-bis. Universal Multiplicity & Co-reference Detection
  if (!signals.isCoReferenceIdentity) {
    const isIdentityOrKinshipInquiry =
      /(?:cùng\s+một\s+người|là\s+một|hai\s+người|2\s+người|khác\s+nhau|có\s+phải(?:\s+là)?|quan\s+hệ|cha\s+con|anh\s+em|vợ\s+chồng|con\s+của|cha\s+của|huyết\s+thống|vai\s+trò|phân\s+công)/i.test(cleanQuery);

    if (isIdentityOrKinshipInquiry) {
      const cleanTokens = cleanQuery
        .replace(/[,;!?.:~"'/()\\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
      const nTokens = cleanTokens.length;
      const coveredIndices = new Set<number>();
      const foundEntities: Array<{ name: string; entityId: string; canonicalName: string }> = [];

      for (let len = Math.min(4, nTokens); len >= 1; len--) {
        for (let i = 0; i <= nTokens - len; i++) {
          if (Array.from({ length: len }, (_, k) => i + k).some((idx) => coveredIndices.has(idx))) continue;
          const span = cleanTokens.slice(i, i + len).join(' ');
          const lowerSpan = span.toLowerCase();
          if (CONVERSATIONAL_STOPWORDS.has(lowerSpan)) continue;
          if (len === 1 && (span.length < 3 || lowerSpan === 'bạn')) continue;
          if (isKnownMasterEntity(span)) {
            const canon = resolveCanonicalEntity(span);
            if (canon.entityId && canon.canonicalName) {
              foundEntities.push({ name: span, entityId: canon.entityId, canonicalName: canon.canonicalName });
              for (let k = 0; k < len; k++) coveredIndices.add(i + k);
            }
          }
        }
      }

      if (foundEntities.length >= 2) {
        const uniqueEntityIds = new Set(foundEntities.map((f) => f.entityId));

        if (uniqueEntityIds.size === 1) {
          const first = foundEntities[0];
          signals.isCoReferenceIdentity = true;
          const videoHandover: VideoHandoverMetadata = {
            topic: (signals.hasVideoGeneration && videoBriefTopic) ? videoBriefTopic : cleanSearchTopic,
            primaryEntityId: first.entityId,
            canonicalName: first.canonicalName,
          };
          const compositeResult: CompositeIntentResult = {
            primaryIntent: 'ENTITY_IDENTITY',
            confidence: 0.95,
            clauses: detectedIntentClauses,
            hasHistoricalInquiry: true,
            hasGreetingOrIdentity: signals.hasChitchatGreeting,
            hasOutOfDomain: signals.hasOutOfDomainTopic,
            hasVideoRequest: signals.hasVideoGeneration,
            cleanSearchTopics: [cleanSearchTopic],
            videoHandover,
            outOfDomainTopic,
          };
          return {
            intent: 'ENTITY_IDENTITY',
            subIntent: detectHistoricalSubIntent(cleanSearchTopic || cleanQuery),
            confidence: 0.95,
            matchedEntityId: first.entityId,
            matchedCanonicalName: first.canonicalName,
            signals,
            cleanSearchTopic,
            videoBriefTopic,
            outOfDomainTopic,
            compositeResult,
            videoHandover,
          };
        } else if (uniqueEntityIds.size >= 2) {
          const personEntities = foundEntities.filter((f) => f.entityId.startsWith('person_'));
          const personEntityCounts = new Map<string, number>();
          for (const p of personEntities) {
            personEntityCounts.set(p.entityId, (personEntityCounts.get(p.entityId) || 0) + 1);
          }
          const hasCoReferencedPerson = Array.from(personEntityCounts.values()).some((cnt) => cnt >= 2);
          signals.isCoReferenceIdentity = hasCoReferencedPerson;
          const isKinship =
            KINSHIP_AND_RELATION_REGEX.test(cleanQuery) ||
            /(?:quan\s+hệ|huyết\s+thống|họ\s+hàng|thân\s+tộc)/i.test(cleanQuery);
          const first = foundEntities[0];
          const videoHandover: VideoHandoverMetadata = {
            topic: (signals.hasVideoGeneration && videoBriefTopic) ? videoBriefTopic : cleanSearchTopic,
            primaryEntityId: first.entityId,
            canonicalName: first.canonicalName,
          };
          const subIntent: ChatSubIntent = isKinship
            ? 'GENEALOGY_RELATION'
            : (/(?:so\s+sánh|vai\s+trò|phân\s+công|nhiệm\s+vụ|khác\s+nhau|ai\s+hơn|đối\s+đầu|đối\s+chiếu)/i.test(cleanQuery)
              ? 'COMPARATIVE_SYNTHESIS'
              : detectHistoricalSubIntent(cleanSearchTopic || cleanQuery));

          const compositeResult: CompositeIntentResult = {
            primaryIntent: 'HISTORICAL_QUERY',
            subIntent,
            confidence: 0.95,
            clauses: detectedIntentClauses,
            hasHistoricalInquiry: true,
            hasGreetingOrIdentity: signals.hasChitchatGreeting,
            hasOutOfDomain: signals.hasOutOfDomainTopic,
            hasVideoRequest: signals.hasVideoGeneration,
            cleanSearchTopics: [cleanSearchTopic],
            videoHandover,
            outOfDomainTopic,
          };
          return {
            intent: 'HISTORICAL_QUERY',
            subIntent,
            confidence: 0.95,
            matchedEntityId: first.entityId,
            matchedCanonicalName: first.canonicalName,
            signals,
            cleanSearchTopic,
            videoBriefTopic,
            outOfDomainTopic,
            compositeResult,
            videoHandover,
          };
        }
      }
    }
  }

  // 4d. Single Entity Identity Identification
  for (const pattern of SINGLE_ENTITY_IDENTITY_PATTERNS) {
    const match = cleanSearchTopic.match(pattern) || cleanQuery.match(pattern);
    if (match) {
      const entityName = match[1]?.trim();
      const wordCount = entityName ? entityName.split(/\s+/).filter(Boolean).length : 0;
      if (entityName && wordCount >= 1 && wordCount <= 4 && isKnownMasterEntity(entityName)) {
        const canonical = resolveCanonicalEntity(entityName);
        if (canonical.entityId && canonical.canonicalName) {
          const videoHandover: VideoHandoverMetadata = {
            topic: (signals.hasVideoGeneration && videoBriefTopic) ? videoBriefTopic : cleanSearchTopic,
            primaryEntityId: canonical.entityId,
            canonicalName: canonical.canonicalName,
          };
          const compositeResult: CompositeIntentResult = {
            primaryIntent: 'ENTITY_IDENTITY',
            confidence: 0.92,
            clauses: detectedIntentClauses,
            hasHistoricalInquiry: true,
            hasGreetingOrIdentity: signals.hasChitchatGreeting,
            hasOutOfDomain: signals.hasOutOfDomainTopic,
            hasVideoRequest: signals.hasVideoGeneration,
            cleanSearchTopics: [cleanSearchTopic],
            videoHandover,
            outOfDomainTopic,
          };
          return {
            intent: 'ENTITY_IDENTITY',
            confidence: 0.92,
            matchedEntityId: canonical.entityId,
            matchedCanonicalName: canonical.canonicalName,
            signals,
            cleanSearchTopic,
            videoBriefTopic,
            outOfDomainTopic,
            compositeResult,
            videoHandover,
          };
        }
      }
    }
  }

  // 4e. Standard Historical Query Routing with Sub-Intent Detection
  const subIntent = detectHistoricalSubIntent(cleanSearchTopic || cleanQuery);
  const targetEntity =
    extractHistoricalEntityFromQuery(cleanSearchTopic) ||
    initialExtracted;

  const videoHandover: VideoHandoverMetadata = {
    topic: (signals.hasVideoGeneration && videoBriefTopic) ? videoBriefTopic : cleanSearchTopic,
    primaryEntityId: targetEntity?.entityId,
    canonicalName: targetEntity?.canonicalName,
  };

  const compositeResult: CompositeIntentResult = {
    primaryIntent: 'HISTORICAL_QUERY',
    subIntent,
    confidence: 0.9,
    clauses: detectedIntentClauses,
    hasHistoricalInquiry: true,
    hasGreetingOrIdentity: signals.hasChitchatGreeting,
    hasOutOfDomain: signals.hasOutOfDomainTopic,
    hasVideoRequest: signals.hasVideoGeneration,
    cleanSearchTopics: [cleanSearchTopic],
    videoHandover,
    outOfDomainTopic,
  };

  return {
    intent: 'HISTORICAL_QUERY',
    subIntent,
    confidence: 0.9,
    matchedEntityId: targetEntity?.entityId,
    matchedCanonicalName: targetEntity?.canonicalName,
    signals,
    cleanSearchTopic,
    videoBriefTopic,
    outOfDomainTopic,
    compositeResult,
    videoHandover,
  };
}
