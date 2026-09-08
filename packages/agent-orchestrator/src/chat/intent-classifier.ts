/**
 * Multi-Tier Intent Classifier & Fast-Path Router (<1ms execution)
 * SSOT for Chatbot query triage: CHITCHAT vs ENTITY_IDENTITY vs VIDEO_INTENT vs HISTORICAL_QUERY
 * Implements Dual-Key Positive Gating to prevent ungrounded queries from triggering heavy RAG.
 */

import { resolveCanonicalEntity, isKnownMasterEntity, ChatIntent, ChatSubIntent } from '@chronoviet/shared-spec';
import { normalizeResilientText } from './text-normalizer.js';

export type { ChatIntent, ChatSubIntent };

export interface IntentClassificationResult {
  intent: ChatIntent;
  subIntent?: ChatSubIntent;
  confidence: number;
  fastPathResponse?: string;
  suggestedTopic?: string;
  matchedEntityId?: string;
  matchedCanonicalName?: string;
}

// Out of Domain Patterns (Cooking recipes, Stock trading, Generic coding)
const OUT_OF_DOMAIN_PATTERNS = [
  // 1. Culinary & Cooking recipes
  /(?:hướng\s*dẫn|chỉ|dạy|bày|công\s*thức|cách|bí\s*quyết)\s+(?:tôi\s+)?(?:làm|nấu|chế\s*biến|nướng|rán|kho|luộc|hầm|xào|pha|làm\s+món)\s+(?:món|bánh|thịt|cá|canh|nước\s*chấm|nước\s*dùng|phở|bún|trà|cà\s*phê|sinh\s*tố|chè|bánh\s*mì)/i,
  /(?:bánh\s*mì\s*nướng|nồi\s*chiên\s*không\s*dầu|công\s*thức\s*nấu\s*ăn|nguyên\s*liệu\s*nấu\s*ăn|món\s*ngon\s*mỗi\s*ngày|nước\s*dùng\s*phở|nấu\s+phở\s+bò|chuẩn\s+vị\s+hà\s+nội)/i,
  // 2. Finance & Stock market trading
  /(?:mã\s+cổ\s*phiếu|cổ\s*phiếu|chứng\s*khoán|mua\s+vào\s+không|bán\s+ra\s+không|phân\s*tích\s*kỹ\s*thuật|giá\s+vàng|đầu\s*tư\s*tài\s*chính|crypto|bitcoin|tiền\s*ảo|lãi\s*suất\s*ngân\s*hàng)/i,
  // 3. Generic programming & IT troubleshooting
  /(?:hướng\s*dẫn|cách|làm\s*sao\s*để|viết\s+(?:hàm|code|chương\s*trình|script)|lập\s*trình|tính\s+dãy\s*số)\s+(?:viết\s+code|lập\s*trình|cài\s*đặt|debug|deploy|sửa\s*lỗi|tính\s+dãy\s*số\s*fibonacci|fibonacci)?.*?(?:python|javascript|typescript|c\+\+|java|react|docker|kubernetes|node|sql|css|html|fibonacci)/i,
  /(?:hàm\s+python|viết\s+hàm\s+python|dãy\s*số\s*fibonacci|đệ\s*quy\s*có\s*nhớ)/i,
];

// Pure Chitchat & Greeting Patterns (Evaluated on normalized query string and unaccented shadow)
const PURE_CHITCHAT_PATTERNS = [
  /^(?:xin\s+)?chào(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|mọi\s+người|cả\s+nhà|chronoviet|nhé|nhe|nha|ạ|\w+)){0,4}$/i,
  /^(?:hello|hi|hey|alo|halo)(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|chronoviet|nhé|nhe|nha|ạ|ơi|\w+)){0,4}$/i,
  /^(?:good\s+(?:morning|evening|afternoon|night))$/i,
  /^(?:rất\s+)?(?:cảm\s+ơn|cam\s+on|thank\s*you|thanks|thx)(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|chronoviet|nhiều|nhe|nhé|nha|ạ|\w+)){0,4}$/i,
  /^(?:tạm\s+biệt|tam\s+biet|bye|goodbye|bye\s+bye|hẹn\s+gặp\s+lại)(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|chronoviet|nhé|nhe|nha|ạ))?$/i,
  /(?:xin\s+)?chào(?:\s+bạn|\s+bot|\s+chronoviet)?[\s,;:!?-]+(?:bạn\s+là\s+ai|có\s+thể\s+giúp\s+gì|giúp\s+gì\s+cho\s+tôi|bạn\s+tên\s+gì)/i,
  /^(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|bot|chronoviet|ad|admin|cậu|mày)\s+là\s+ai(?:\s+(?:thế|vậy|hả|nhỉ|dạ|\?))?$/i,
  /^(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|bot|chronoviet|ad|admin|cậu|mày)\s+tên\s+(?:là\s+)?gì(?:\s+(?:thế|vậy|hả|nhỉ|dạ|\?))?$/i,
  /^(?:(?:hệ\s*thống\s+)?chronoviet\s+có\s+(?:những\s+)?(?:tính\s*năng|chức\s*năng|khả\s*năng|điểm)\s+gì|tính\s*năng\s+(?:của\s+)?(?:chronoviet|hệ\s*thống)|bạn\s+có\s+thể\s+làm\s+(?:được\s+)?gì)/i,
  /^(?:chronoviet\s+là\s+gì|giới\s+thiệu\s+(?:về\s+)?(?:bản\s+thân|bạn|chronoviet)|hướng\s+dẫn(?:\s+sử\s+dụng)?|giúp\s+tôi\s+với|help)$/i,
];

// Conversational Bot Identity & Persona Inquiry Patterns
const BOT_IDENTITY_PATTERNS = [
  /^(?:(?:cho\s+(?:mình|minh|tôi|toi|em)\s+hỏi|hỏi\s+chút|hỏi\s+xíu|làm\s+ơn\s+cho\s+biết|lam\s+on\s+cho\s+biet|phiền\s+bạn|phien\s+ban)\s*,?\s*)?(?:(?:xin\s+)?chào|chao|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|ban|bot|chronoviet|ad|admin|cậu|cau|mày|may)\s+(?:là\s+ai|la\s+ai|tên\s+(?:là\s+)?gì|ten\s+(?:la\s+)?gi)(?:\s+(?:thế|the|vậy|vay|hả|ha|nhỉ|nhi|dạ|da|nhờ|nho|\?))?$/i,
  /^(?:(?:cho\s+(?:mình|minh|tôi|toi|em)\s+hỏi|làm\s+ơn\s+cho\s+biết|phiền\s+bạn)\s*,?\s*)?(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|ban|bot|chronoviet|ad|admin|cậu)\s+tên\s+(?:là\s+)?gì(?:\s+(?:thế|the|vậy|vay|hả|ha|nhỉ|dạ|\?))?$/i,
  /^(?:who\s+are\s+you|who\s+is\s+chronoviet|what\s+is\s+chronoviet)\b/i,
  /^(?:ai\s+đấy|ai\s+đó|ai\s+thế|ai\s+vậy|ai\s+day|ai\s+the|ai\s+vay)(?:\s*\?)?$/i,
];

// Unaccented shadow matches for greetings and identity
const SHADOW_CHITCHAT_PATTERNS = [
  /^(?:(?:cho\s+(?:minh|toi|em)\s+hoi|lam\s+on\s+cho\s+biet)\s*,?\s*)?(?:xin\s+)?chao(?:\s+(?:ban|bot|ad|admin|em|anh|chi|moi\s+nguoi|chronoviet|nhe|nha|a|\w+))?$/i,
  /^(?:rat\s+)?(?:cam\s+on|thanks)(?:\s+(?:ban|bot|ad|admin|nhi\s*eu|nhe|nha|a|\w+)){0,4}$/i,
  /^(?:tam\s+biet|bye|goodbye)(?:\s+(?:ban|bot|ad|admin|nhe|nha|a))?$/i,
  /^(?:(?:cho\s+(?:minh|toi|em)\s+hoi|lam\s+on\s+cho\s+biet)\s*,?\s*)?(?:(?:xin\s+)?chao|hello|hi|hey|alo|halo)?\s*,?\s*(?:ban|bot|chronoviet)\s+la\s+ai(?:\s+(?:the|vay|ha|\?))?$/i,
  /^(?:(?:cho\s+(?:minh|toi|em)\s+hoi|lam\s+on\s+cho\s+biet)\s*,?\s*)?(?:(?:xin\s+)?chao|hello|hi|hey|alo|halo)?\s*,?\s*(?:ban|bot|chronoviet)\s+ten\s+(?:la\s+)?gi(?:\s+(?:the|vay|ha|\?))?$/i,
];

// Pleasantry Prefix Regex to strip before evaluating substantive historical/video intent
const PLEASANTRY_PREFIX_REGEX = /^(?:xin\s+chào|chào\s+(?:bạn|bot|ad|admin|em|anh|chị|mọi\s+người|cả\s+nhà|chronoviet|ai)?|chào|hello|hi|hey|alo|halo|cho\s+(?:mình|tôi|em)\s+hỏi|làm\s+ơn\s+cho\s+biết|phiền\s+bạn)(?:[\s,;:!?-]+)/i;

const VIDEO_INTENT_PATTERNS = [
  /(?:tạo|làm|sản\s*xuất|dựng|xây\s*dựng|generate|make|edit|chỉnh\s*sửa)(?:\s+[\wà-ỹ]+){0,4}\s+(?:video|clip|phim|thước\s*phim|dự\s*án\s*video|kịch\s*bản\s*video)(?:\s+(?:về|về\s+chủ\s+đề|kể\s+về))?\s*(.+)?/i,
  /(?:chuyển|tổng\s*hợp)\s+(?:thành|sang)\s+video\s*(.+)?/i,
  /(?:video\s*brief|tạo\s*kịch\s*bản\s*video)\s*(.+)?/i,
  /(?:phân\s*cảnh|chỉnh\s*sửa\s*phân\s*cảnh|kéo\s*dài\s*thêm|đổi\s*layout)/i,
];

// Conjunction / Coordinate Entity Query Patterns ("A và B là ai", "quan hệ giữa A và B", "A và B có phải là 2 anh em...")
const CONJUNCTION_ENTITY_PATTERNS = [
  /^(.+?)\s+(?:và|với|cùng)\s+(.+?)\s+là\s+(?:ai|những\s+ai|người\s+như\s+thế\s+nào)(?:\s*\?)?$/i,
  /^(?:quan\s+hệ\s+giữa|mối\s+quan\s+hệ\s+giữa)\s+(.+?)\s+(?:và|với)\s+(.+?)(?:\s+là\s+gì|\s+như\s+thế\s+nào)?(?:\s*\?)?$/i,
  /^(.+?)\s+(?:và|với)\s+(.+?)\s+có\s+(?:mối\s+)?quan\s+hệ\s+(?:gì|như\s+thế\s+nào)(?:\s*\?)?$/i,
  /^(.+?)\s+(?:và|với)\s+(.+?)\s+có\s+phải\s+(?:là\s+)?(?:cùng\s+một\s+người|là\s+một|2\s+người\s+khác\s+nhau|hai\s+người\s+khác\s+nhau|(?:2|hai)?\s*anh\s+em(?:\s+ruột)?)(?:\s*không|\s+hả|\s*\?)?$/i,
  /^(.+?)\s+(?:và|với)\s+(.+?)\s+là\s+(?:cùng\s+một\s+người|là\s+một)\s+(?:hay|hoặc)\s+(?:là\s+)?(?:2|hai)?\s*(?:vị\s+vua|người|nhân\s+vật)\s+khác\s+nhau(?:.*)$/i,
  /^(.+?)\s+(?:và|với)\s+(.+?)\s+là\s+(?:cùng\s+một\s+người|là\s+một|hai\s+người\s+khác\s+nhau|hai\s+vị\s+vua\s+khác\s+nhau)(?:.*)$/i,
];

const SINGLE_ENTITY_IDENTITY_PATTERNS = [
  /^([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)\s+là\s+ai(?:\s*\?)?$/i,
  /^ai\s+là\s+([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)(?:\s*\?)?$/i,
  /^([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)\s+có\s+phải\s+(?:là\s+)?([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)(?:\s*không|\s*\?)?$/i,
  /^tên\s+thật\s+của\s+([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)\s+(?:là\s+gì|\?)/i,
  /^quê\s+quán\s+của\s+([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)\s+(?:ở\s+đâu|\?)/i,
];

function normalizeQueryText(str: string): string {
  return str
    .replace(/[?!.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPleasantryPrefix(text: string): { stripped: string; hasPrefix: boolean } {
  if (PLEASANTRY_PREFIX_REGEX.test(text)) {
    const stripped = text.replace(PLEASANTRY_PREFIX_REGEX, '').trim();
    if (stripped.length >= 3) {
      return { stripped, hasPrefix: true };
    }
  }
  return { stripped: text, hasPrefix: false };
}

// Unicode-safe word boundaries (since standard \b treats Vietnamese accented characters as non-word)
const B_DELIM = '(?=$|[\\s,;!?.:~"\'/()\\-])';

// Conversational and functional stopwords that should never be falsely matched as historical entities
const CONVERSATIONAL_STOPWORDS = new Set([
  'bạn', 'ban', 'banj', 'tôi', 'toi', 'tooi', 'mình', 'minh', 'minhj', 'cậu', 'cau', 'em', 'anh', 'chị', 'chi',
  'bot', 'ad', 'admin', 'ai', 'gì', 'gi', 'nào', 'nao', 'sao', 'đâu', 'dau', 'thế', 'the',
  'vậy', 'vay', 'chào', 'chao', 'hello', 'hi', 'hey', 'alo', 'halo', 'cảm ơn', 'cam on',
  'tạm biệt', 'tam biet', 'hỏi', 'hoi', 'biết', 'biet', 'nghe', 'nói', 'noi', 'làm', 'lam',
  'cho', 'về', 've', 'là', 'la', 'laf', 'có', 'co', 'được', 'duoc', 'xin'
]);

export interface ExtractedHistoricalEntity {
  entityId: string;
  canonicalName: string;
  matchedText: string;
}

/**
 * Extracts recognized master historical entities from queries using windowed n-gram matching (4 to 1 words).
 * Filters out conversational pronouns and stopwords (e.g. preventing 'bạn' from colliding with 'núi Bân').
 */
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
      // Single-word candidates must be >= 3 characters and not conversational pronouns
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

/**
 * Detects if the query contains verified historical temporal or domain lexical markers.
 * Acts as Key 2 in Dual-Key Positive Gating.
 */
function hasHistoricalDomainSignals(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  // 1. Explicit calendar year numbers or BCE/CE notations (prevents arbitrary 3-digit quantities like 500 from firing RAG)
  if (/(?:năm\s+)?(?:\d{1,4}\s*(?:tcn|trước\s+công\s+nguyên|trước\s+cn|scn|sau\s+công\s+nguyên))/i.test(text)) {
    return true;
  }
  if (/\bnăm\s+[1-9]\d{1,3}\b/i.test(text)) {
    return true;
  }
  if (/\b(?:1[0-9]{3}|20[0-2][0-9])\b(?!\s*(?:câu|bài|người|cái|đồng|k|triệu|nghìn|tỷ|usd|vnd))/i.test(text)) {
    return true;
  }

  // 2. Centuries, Reign Eras, or Dynasties (Unicode-safe boundary)
  const centuryRegex = new RegExp(`(?:thế\\s*kỷ|thế\\s*kỉ|tk)\\s*(?:thứ\\s*)?(?:[ivxlcdm]+|\\d{1,2})${B_DELIM}`, 'i');
  if (centuryRegex.test(text)) {
    return true;
  }
  const dynastyRegex = new RegExp(`(?:thời\\s*kỳ|triều\s*đại|niên\\s*hiệu|đời\\s*vua|nhà\\s+(?:lý|trần|lê|nguyễn|hồ|tiền\\s*lê|hậu\\s*lê|ngô|đinh|tây\\s*sơn|mạc))${B_DELIM}`, 'i');
  if (dynastyRegex.test(text)) {
    return true;
  }

  // 3. Historical roles and domain terminology
  const roleRegex = new RegExp(`(?:vua|hoàng\\s*đế|thái\\s*thượng\\s*hoàng|chúa\\s+(?:trịnh|nguyễn)|danh\\s*tướng|tướng\\s*quân|tổng\\s*đốc|kinh\\s*thành|sử\\s*ký|chính\\s*sử|dã\\s*sử|lịch\\s*sử)${B_DELIM}`, 'i');
  if (roleRegex.test(text)) {
    return true;
  }

  // 4. Historical warfare and events terminology
  const warfareRegex = new RegExp(`(?:chiến\\s*dịch|trận\\s*đánh|khởi\\s*nghĩa|chiến\\s*thắng|đại\\s*thắng|đại\\s*phá|cọc\\s*ngầm|chiếu\\s*dời\\s*đô|hịch\\s*tướng\\s*sĩ|bình\\s*ngô\\s*đại\\s*cáo|bài\\s*binh\\s*bố\\s*trận|mai\\s*phục|thủy\\s*chiến)${B_DELIM}`, 'i');
  if (warfareRegex.test(text)) {
    return true;
  }

  return false;
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

  // 1. Out of Domain Identification (< 0.1ms)
  for (const pattern of OUT_OF_DOMAIN_PATTERNS) {
    if (pattern.test(cleanQuery) || pattern.test(trimmed) || pattern.test(cleanShadow)) {
      return {
        intent: 'OUT_OF_DOMAIN',
        confidence: 0.98,
      };
    }
  }

  // 2. Bot Identity & Conversational Persona Inquiry (< 0.1ms)
  for (const pattern of BOT_IDENTITY_PATTERNS) {
    if (pattern.test(cleanQuery) || pattern.test(trimmed) || pattern.test(cleanShadow)) {
      return {
        intent: 'CHITCHAT',
        confidence: 0.99,
      };
    }
  }

  // 3. Pure Chitchat & Greetings (< 0.1ms)
  for (const pattern of PURE_CHITCHAT_PATTERNS) {
    if (pattern.test(cleanQuery) || pattern.test(trimmed)) {
      return {
        intent: 'CHITCHAT',
        confidence: 0.95,
      };
    }
  }

  // Shadow chitchat matching for unaccented queries
  for (const pattern of SHADOW_CHITCHAT_PATTERNS) {
    if (pattern.test(cleanShadow) || pattern.test(shadow)) {
      return {
        intent: 'CHITCHAT',
        confidence: 0.92,
      };
    }
  }

  // Determine effective query by stripping pleasantry prefixes if present (e.g. "Chào bạn, Quang Trung và Nguyễn Huệ là ai?")
  const { stripped: effectiveQuery } = stripPleasantryPrefix(cleanQuery);

  // 4. Video Production Intent (< 0.2ms)
  for (const pattern of VIDEO_INTENT_PATTERNS) {
    const match = effectiveQuery.match(pattern) || trimmed.match(pattern);
    if (match) {
      const topic = (match[1] || effectiveQuery).replace(/[?!.]/g, '').trim();
      return {
        intent: 'VIDEO_INTENT',
        confidence: 0.95,
        suggestedTopic: topic || effectiveQuery,
      };
    }
  }

  // 5. Conjunction Coordinate Entity & Co-reference Identification (< 0.5ms)
  for (const pattern of CONJUNCTION_ENTITY_PATTERNS) {
    const match = effectiveQuery.match(pattern) || cleanQuery.match(pattern);
    if (match) {
      const rawE1 = match[1]?.replace(/[?!.,;:]+$/g, '').trim();
      const rawE2 = match[2]?.replace(/[?!.,;:]+$/g, '').trim();
      if (rawE1 && rawE2 && isKnownMasterEntity(rawE1) && isKnownMasterEntity(rawE2)) {
        const canonical1 = resolveCanonicalEntity(rawE1);
        const canonical2 = resolveCanonicalEntity(rawE2);

        if (canonical1.entityId && canonical2.entityId) {
          return {
            intent: 'ENTITY_IDENTITY',
            confidence: 0.95,
            matchedEntityId: canonical1.entityId,
            matchedCanonicalName: canonical1.canonicalName,
          };
        }
      }
    }
  }

  // 6. Single Entity Identity Identification (< 0.5ms) - Only for verified master entities
  for (const pattern of SINGLE_ENTITY_IDENTITY_PATTERNS) {
    const match = effectiveQuery.match(pattern) || cleanQuery.match(pattern);
    if (match) {
      const entityName = match[1]?.trim();
      const wordCount = entityName ? entityName.split(/\s+/).filter(Boolean).length : 0;
      if (entityName && wordCount >= 1 && wordCount <= 4 && isKnownMasterEntity(entityName)) {
        const canonical = resolveCanonicalEntity(entityName);
        if (canonical.entityId && canonical.canonicalName) {
          return {
            intent: 'ENTITY_IDENTITY',
            confidence: 0.92,
            matchedEntityId: canonical.entityId,
            matchedCanonicalName: canonical.canonicalName,
          };
        }
      }
    }
  }

  // 7. Dual-Key Positive Gating & Sub-Intent Detection
  const extractedEntity =
    extractHistoricalEntityFromQuery(effectiveQuery) ||
    extractHistoricalEntityFromQuery(cleanQuery);

  const hasHistoricalEvidence =
    Boolean(extractedEntity) ||
    hasHistoricalDomainSignals(effectiveQuery) ||
    hasHistoricalDomainSignals(cleanQuery);

  const subIntent = detectHistoricalSubIntent(effectiveQuery || cleanQuery);

  if (hasHistoricalEvidence || subIntent !== 'GENERAL_OVERVIEW') {
    return {
      intent: 'HISTORICAL_QUERY',
      subIntent,
      confidence: 0.9,
      matchedEntityId: extractedEntity?.entityId,
      matchedCanonicalName: extractedEntity?.canonicalName,
    };
  }

  // 8. Safe Conversational Fallback: Route conversational phrasing without historical signals to CHITCHAT (Dynamic LLM)
  // Does NOT hardcode canned responses, allowing the LLM persona to answer dynamically and intelligently.
  const words = cleanQuery.split(/\s+/).filter(Boolean);
  const isConversational =
    words.length <= 8 ||
    /\b(bạn|ban|bot|chronoviet|mình|minh|tôi|toi|cậu|cau|em|anh|ad|admin)\b/i.test(cleanQuery) ||
    /\b(bạn|ban|bot|chronoviet|mình|minh|tôi|toi|cậu|cau|em|anh|ad|admin)\b/i.test(shadow);

  if (isConversational) {
    return {
      intent: 'CHITCHAT',
      confidence: 0.85,
    };
  }

  return {
    intent: 'HISTORICAL_QUERY',
    subIntent: 'GENERAL_OVERVIEW',
    confidence: 0.7,
  };
}

/**
 * Classifies fine-grained historical sub-intents for specialized RAG retrieval budgeting.
 */
export function detectHistoricalSubIntent(queryText: string): ChatSubIntent {
  const norm = queryText.toLowerCase();

  // Genealogy & Kinship
  if (/(?:quan\s+hệ|thân\s+tộc|cha\s+con|mẹ\s+con|anh\s+em|vợ\s+chồng|hậu\s+duệ|tiền\s+bối|dòng\s+dõi|phả\s+hệ|tổ\s+tiên|con\s+của|cha\s+của|mẹ\s+của|vợ\s+của|chồng\s+của|gốc\s+tích\s+dòng\s+họ|đổi\s+họ|ban\s+quốc\s+tính)/i.test(norm)) {
    return 'GENEALOGY_RELATION';
  }

  // Warfare Tactics & Battles
  if (/(?:chiến\s+thuật|kế\s+sách|trận\s+đánh|bài\s+binh|bố\s+trận|đánh\s+như\s+thế\s+nào|diễn\s+biến|mai\s+phục|thủy\s+chiến|hỏa\s+công|cọc\s+ngầm|phục\s+kích|nghi\s+binh|vây\s+hãm|phản\s+công|thế\s+trận)/i.test(norm)) {
    return 'BATTLE_TACTICS';
  }

  // Comparative Synthesis
  if (/(?:so\s+sánh|khác\s+nhau|giống\s+nhau|điểm\s+chung|ai\s+hơn|tương\s+đồng|đối\s+chiếu|phân\s+biệt)/i.test(norm)) {
    return 'COMPARATIVE_SYNTHESIS';
  }

  // Factoid Lookup (Exact Dates, Regnal Eras, Birth/Death)
  if (/(?:năm\s+nào|khi\s+nào|ở\s+đâu|bao\s+nhiêu|ai\s+là\s+người|niên\s+hiệu|tên\s+thật|thọ\s+bao\s+nhiêu|mất\s+năm|sinh\s+năm|tại\s+đâu|vào\s+thời\s+điểm\s+nào)/i.test(norm)) {
    return 'FACTOID_LOOKUP';
  }

  return 'GENERAL_OVERVIEW';
}
