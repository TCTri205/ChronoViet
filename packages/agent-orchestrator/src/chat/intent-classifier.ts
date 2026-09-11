/**
 * Multi-Tier Intent Classifier & Fast-Path Router (<1ms execution)
 * SSOT for Chatbot query triage: CHITCHAT vs ENTITY_IDENTITY vs VIDEO_INTENT vs HISTORICAL_QUERY
 * Implements Dual-Key Positive Gating to prevent ungrounded queries from triggering heavy RAG.
 */

import {
  resolveCanonicalEntity,
  isKnownMasterEntity,
  ChatIntent,
  ChatSubIntent,
  CompositeIntentResult,
  IntentClause,
  VideoHandoverMetadata,
} from '@chronoviet/shared-spec';
import { normalizeResilientText } from './text-normalizer.js';

export type { ChatIntent, ChatSubIntent };

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
  /^(?:phạm\s*vi\s+(?:tra\s*cứu|hỗ\s*trợ|kiến\s*thức|hoạt\s*động)|khả\s*năng\s+tra\s*cứu|bạn\s+có\s+thể\s+(?:giúp|làm)\s+(?:được\s+)?gì|bạn\s+(?:biết\s+gì|giúp\s+được\s+gì|làm\s+được\s+gì))/i,
  /(?:phạm\s*vi\s+tra\s*cứu\s+(?:của\s+)?(?:bạn|bot|chronoviet|hệ\s*thống))/i,
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

// Secondary Greeting / Pleasantry / Bot Identity Clauses (to strip from compound queries)
const SECONDARY_GREETING_PREFIX_REGEX =
  /^(?:(?:xin\s+)?chào(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|mọi\s+người|cả\s+nhà|chronoviet|ai))?|hello|hi|hey|alo|halo)(?:[\s,;:!?-]+(?:bạn\s+là\s+ai|bạn\s+tên\s+(?:là\s+)?gì|bạn\s+có\s+thể\s+(?:làm|giúp)\s+(?:được\s+)?gì(?:\s+cho\s+tôi)?))?(?:[\s,;:!?-]+(?:và|với|cùng|nhân\s+tiện|tiện\s+thể|cho\s+(?:mình|tôi|em)\s+hỏi|hãy\s+cho\s+(?:mình|tôi|em)\s+biết|cho\s+biết|bạn\s+có\s+thể\s+cho\s+(?:tôi|mình|em)\s+biết))?\s*/i;

const SECONDARY_BOT_IDENTITY_PREFIX_REGEX =
  /^(?:(?:cho\s+(?:mình|tôi|em)\s+hỏi|làm\s+ơn\s+cho\s+biết|phiền\s+bạn)\s*,?\s*)?(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|bot|chronoviet|ad|admin|cậu)\s+(?:là\s+ai|tên\s+(?:là\s+)?gì|có\s+thể\s+giúp\s+gì(?:\s+cho\s+tôi)?)(?:[\s,;:!?-]+(?:và|với|cùng|nhân\s+tiện|tiện\s+thể|hãy\s+cho\s+(?:tôi|em|mình)\s+biết|cho\s+biết|bạn\s+có\s+thể\s+cho\s+(?:tôi|mình|em)\s+biết))?\s*/i;

// Secondary Video Generation Suffix Clauses (to strip from compound queries)
const SECONDARY_VIDEO_SUFFIX_REGEX =
  /(?:[\s,;:!?-]+(?:và|đồng\s*thời|tiện\s*thể|nhân\s*tiện)?\s*(?:hãy\s+)?(?:tạo|làm|dựng|sản\s*xuất|generate|make)\s+(?:cho\s+tôi\s+)?(?:video|clip|phim|thước\s*phim)(?:\s+(?:về\s+(?:chủ\s+đề\s+này|nó|sự\s+kiện\s+này|nhân\s+vật\s+này)|ngắn|chi\s+tiết))?(?:\s+(?:giúp\s+tôi|nhé|nhe|nha|ạ|với))?[\s.?!]*)$/i;

// Secondary Out-of-Domain Suffix Clauses (to strip from compound queries)
const SECONDARY_OOD_SUFFIX_REGEX =
  /(?:[\s,;:!?-]+(?:và\s+)?(?:nhân\s*tiện|tiện\s*thể|đồng\s*thời)?\s*(?:chỉ|hướng\s*dẫn|dạy|bày|nói|cho\s+(?:tôi|mình|em)\s+biết)\s+(?:cách\s+|công\s*thức\s+)?(?:tôi\s+)?(?:làm|nấu|chế\s*biến|pha|nướng|viết\s+code|đầu\s*tư).*)$/i;

// Conversational Inquiry Prefix wrapper (e.g. "bạn có thể cho tôi biết Bác Hồ là ai không?")
const CONVERSATIONAL_INQUIRY_WRAPPER_REGEX =
  /^(?:bạn\s+có\s+thể\s+(?:cho\s+(?:tôi|mình|em)\s+biết|nói\s+(?:cho\s+)?(?:tôi|mình|em)\s+biết|giúp\s+tôi\s+biết)|cho\s+(?:tôi|mình|em)\s+biết|hãy\s+cho\s+(?:tôi|mình|em)\s+biết|cho\s+(?:tôi|mình|em)\s+hỏi|làm\s+ơn\s+cho\s+biết|hỏi\s+rằng|cho\s+hỏi)\s*/i;

// Primary Video Intent Prefix: The user specifically starts by commanding a video production
const PRIMARY_VIDEO_START_REGEX =
  /^(?:(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)(?:\s+[a-zà-ỹ\w]+)?[\s,;:!?-]+)?(?:hãy\s+|bạn\s+có\s+thể\s+|giúp\s+tôi\s+)?(?:tạo|làm|sản\s*xuất|dựng|xây\s*dựng|generate|make|edit|chỉnh\s*sửa|chuyển|tổng\s*hợp|video\s*brief)\b/i;

const VIDEO_INTENT_PATTERNS = [
  /(?:tạo|làm|sản\s*xuất|dựng|xây\s*dựng|generate|make|edit|chỉnh\s*sửa)(?:\s+[\wà-ỹ]+){0,4}\s+(?:video|clip|phim|thước\s*phim|dự\s*án\s*video|kịch\s*bản\s*video)(?:\s+(?:về|về\s+chủ\s+đề|kể\s+về))?\s*(.+)?/i,
  /(?:chuyển|tổng\s*hợp)\s+(?:thành|sang)\s+video\s*(.+)?/i,
  /(?:video\s*brief|tạo\s*kịch\s*bản\s*video)\s*(.+)?/i,
  /(?:phân\s*cảnh|chỉnh\s*sửa\s*phân\s*cảnh|kéo\s*dài\s*thêm|đổi\s*layout)/i,
];

// Kinship, lineage, and family relations patterns (not conversational pronouns)
export const KINSHIP_AND_RELATION_REGEX =
  /(?:(?:2|hai)?\s*anh\s+em(?:\s+ruột)?|chị\s+em(?:\s+ruột)?|cha\s+con|mẹ\s+con|vợ\s+chồng|huynh\s+đệ|tỷ\s+muội|đồng\s+môn|thầy\s+trò|tướng\s+sĩ|quân\s+thần|dòng\s+họ|tông\s+tộc|anh\s+hùng|anh\s+ruột|em\s+ruột|anh\s+trai|em\s+trai|chị\s+gái|em\s+gái|ông\s+cháu|bà\s+cháu|tiền\s+bối|hậu\s+duệ|thân\s+tộc|phả\s+hệ|tổ\s+tiên|huyết\s+thống|cột\s+chèo)/i;

// Substantive interrogative syntax (questions asking for facts, identities, locations, or dates)
export const SUBSTANTIVE_QUESTION_REGEX =
  /(?:có\s+phải(?:\s+là)?|phải\s+chăng|là\s+ai|ở\s+đâu|khi\s+nào|thời\s+nào|năm\s+nào|tại\s+sao|vì\s+sao|như\s+thế\s+nào|ra\s+sao|mấy\s+người|bao\s+nhiêu|ai\s+là|vị\s+vua|vị\s+tướng|nhân\s+vật|sự\s+kiện|chiến\s+công|công\s+tích|diễn\s+biến|kế\s+sách|trận\s+đánh)(?:$|[\s,;:.!?])/i;

// Direct second-person address or personal chitchat aimed at the bot persona
export const DIRECT_CONVERSATIONAL_ADDRESS_REGEX =
  /(?:^(?:ơi\s+)?(?:bạn|bot|chronoviet|cậu|mày|ad|admin)\b|\b(?:ơi\s+)?(?:bạn|bot|chronoviet|cậu|mày|ad|admin)(?:$|[\s,;:.!?])|^(?:anh|em|chị)\s+ơi\b|\b(?:anh|em|chị)\s+ơi(?:$|[\s,;:.!?])|\b(?:tôi|mình|em)\s+(?:có\s+\d+\s+câu\s+hỏi\s+về\s+bạn|buồn|vui|chán|mệt|đang\s+rảnh|thích|ghét)\b)/i;

// Casual chat remarks (weather, modern life complaints, short pleasantries without question syntax)
export const CASUAL_REMARK_REGEX =
  /(?:^|[\s,;:.!?])(?:nhà\s+lên\s+giá|giá\s+(?:nhà|xăng|vàng|đất|xe)|thời\s+tiết|trời\s+(?:nắng|mưa|đẹp|lạnh|nóng|âm\s+u|gió)|hôm\s+nay\s+(?:mệt|vui|buồn|chán|bận)|mệt\s+mỏi|chán\s+(?:quá|ghê|thế)|buồn\s+(?:quá|ngủ)|vui\s+quá|đói\s+bụng|đi\s+(?:ngủ|ăn|chơi)|chúc\s+ngủ\s+ngon|ha\s*ha|hi\s*hi|hê\s*hê|cũng\s+được|thế\s+à|vậy\s+à|ừ\s+nhỉ|ok\s+bạn|được\s+đấy)(?:$|[\s,;:.!?])|(?:\b(?:quá|lắm|ghê)\b.*(?:\b(?:nhỉ|nhe|nhé|nha|thế)\b)?$)/i;

// Conjunction / Coordinate Entity Query Patterns ("A và B là ai", "quan hệ giữa A và B", "A và B có phải là 2 anh em...")
const CONJUNCTION_ENTITY_PATTERNS = [
  /^(.+?)\s+(?:và|với|cùng)\s+(.+?)\s+là\s+(?:ai|những\s+ai|người\s+như\s+thế\s+nào)(?:\s*\?)?$/i,
  /^(?:quan\s+hệ\s+giữa|mối\s+quan\s+hệ\s+giữa)\s+(.+?)\s+(?:và|với)\s+(.+?)(?:\s+là\s+gì|\s+như\s+thế\s+nào)?(?:\s*\?)?$/i,
  /^(.+?)\s+(?:và|với)\s+(.+?)\s+có\s+(?:mối\s+)?quan\s+hệ\s+(?:gì|như\s+thế\s+nào)(?:\s*\?)?$/i,
  /^(.+?)\s+(?:và|với)\s+(.+?)\s+có\s+phải\s+(?:là\s+)?(?:cùng\s+một\s+người|là\s+một|2\s+người\s+khác\s+nhau|hai\s+người\s+khác\s+nhau|(?:2|hai)?\s*anh\s+em(?:\s+ruột)?)(?:\s*không|\s+hay\s+không|\s+phải\s+không|\s+hả|\s*\?)?$/i,
  /^(.+?)\s+(?:và|với)\s+(.+?)\s+là\s+(?:cùng\s+một\s+người|là\s+một)\s+(?:hay|hoặc)\s+(?:là\s+)?(?:2|hai)?\s*(?:vị\s+vua|người|nhân\s+vật)\s+khác\s+nhau(?:.*)$/i,
  /^(.+?)\s+(?:và|với)\s+(.+?)\s+là\s+(?:cùng\s+một\s+người|là\s+một|hai\s+người\s+khác\s+nhau|hai\s+vị\s+vua\s+khác\s+nhau)(?:.*)$/i,
];

const SINGLE_ENTITY_IDENTITY_PATTERNS = [
  /^([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)\s+là\s+ai(?:\s+(?:thế|vậy|không|hả|nhỉ|ạ))?(?:\s*\?)?$/i,
  /^ai\s+là\s+([A-ZÀ-Ỹa-zà-ỹ\s0-9-]+)(?:\s+(?:thế|vậy|không|hả|nhỉ|ạ))?(?:\s*\?)?$/i,
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

/**
 * Splits a composite query into individual semantic clauses while safely preserving coordinate entities
 * (e.g. "Quang Trung và Nguyễn Huệ", "Lê Lợi và Lê Độ").
 */
export function splitQueryIntoSemanticClauses(text: string): string[] {
  // Never split coordinate entity questions
  for (const pattern of CONJUNCTION_ENTITY_PATTERNS) {
    if (pattern.test(text)) {
      return [text];
    }
  }

  // Split on sentence terminators: ? . ! ; \n
  const sentences = text
    .split(/[?.!\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const clauses: string[] = [];
  for (const sentence of sentences) {
    // Check compound comma connectives separating secondary clauses:
    // e.g. "Vua Quang Trung mất năm nào, và nhân tiện chỉ tôi nấu phở bò"
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
  // 1. Strip leading connectives
  cleaned = cleaned.replace(/^(?:và|với|cùng|nhân\s*tiện|tiện\s*thể|thế\s*thì|vậy\s*thì|vậy\s*cho\s*hỏi|tiện\s*thể\s*cho\s*hỏi|cho\s*hỏi)[\s,;:!?-]*/i, '').trim();
  
  // 2. Strip conversational inquiry wrappers
  cleaned = cleaned.replace(/^(?:bạn\s+có\s+thể\s+(?:cho\s+(?:tôi|mình|em)\s+biết|nói\s+(?:cho\s+)?(?:tôi|mình|em)\s+biết|giúp\s+tôi\s+biết)|cho\s+(?:tôi|mình|em)\s+biết|hãy\s+cho\s+(?:tôi|mình|em)\s+biết|cho\s+(?:tôi|mình|em)\s+hỏi|làm\s+ơn\s+cho\s+biết|hỏi\s+rằng|cho\s+hỏi|bạn\s+có\s+(?:biết|nhớ)|bạn\s+biết\s+về|bạn\s+nghĩ\s+sao\s+về)\s*/i, '').trim();
  
  // 3. Strip pleasantry prefixes if still present
  cleaned = cleaned.replace(/^(?:(?:xin\s+)?chào(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|mọi\s+người|cả\s+nhà|chronoviet|ai))?|hello|hi|hey|alo|halo)[\s,;:!?-]*/i, '').trim();

  // 4. Strip secondary question wrappers e.g. "bạn có biết"
  cleaned = cleaned.replace(/^(?:bạn\s+có\s+biết|bạn\s+biết\s+gì\s+về|kể\s+về|kể\s+cho\s+(?:tôi|mình|em)\s+nghe\s+về)\s*/i, '').trim();
  
  // 5. Strip trailing question particles
  cleaned = cleaned
    .replace(/(?:[\s,;:!?-]+(?:và|với))+$/i, '')
    .replace(/\s+(?:không|thế|vậy|nhỉ|hả|ạ)$/i, '')
    .replace(/[?!.,;:]+$/g, '')
    .trim();

  return cleaned;
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

  // 1. Primary Video Intent: Queries that explicitly start with a direct video generation command
  // E.g., "Tạo video về Chiến thắng Bạch Đằng năm 938" or "Hãy làm một video 3 phút về cuộc đời Trần Hưng Đạo"
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

  // 2. Dual-Key Historical Evidence Detection (Master Entities + Domain/Warfare/Chronology Signals)
  const initialExtracted =
    extractHistoricalEntityFromQuery(cleanQuery) ||
    extractHistoricalEntityFromQuery(cleanShadow);

  const hasHistoricalEvidence =
    Boolean(initialExtracted) ||
    hasHistoricalDomainSignals(cleanQuery) ||
    hasHistoricalDomainSignals(cleanShadow);

  // 3. Non-Historical Queries Gating: If NO historical evidence is present, route purely among OOD, Chitchat, Video, or Fallback
  if (!hasHistoricalEvidence) {
    // 3a. Out of Domain Identification (< 0.1ms)
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

    // 3b. Bot Identity & Conversational Persona Inquiry (< 0.1ms)
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

    // 3c. Pure Chitchat & Greetings (< 0.1ms)
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

    // Shadow chitchat matching for unaccented queries
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

    // 3d. Video Intent without specific master entity (e.g. "hướng dẫn tạo video", "đổi layout phân cảnh")
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

    // 3e. Linguistic Disambiguation: Kinship vs Conversational Fallback
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

    // If query expresses kinship relations or substantive question structure without indexed entities,
    // escalate to HISTORICAL_QUERY and tag for Tier 2 Semantic Arbitration
    if (hasKinshipOrRelation || hasSubstantiveQuestion) {
      return {
        intent: 'HISTORICAL_QUERY',
        subIntent: detectHistoricalSubIntent(cleanQuery),
        confidence: 0.65,
        needsSemanticArbitration: true,
        cleanSearchTopic: cleanQuery,
      };
    }

    // Direct conversational address or casual life remarks without question structure -> CHITCHAT
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

    // Ambiguous substantive phrase (e.g. unindexed person name, battle, or concept)
    return {
      intent: 'HISTORICAL_QUERY',
      subIntent: 'GENERAL_OVERVIEW',
      confidence: 0.7,
      cleanSearchTopic: cleanQuery,
      needsSemanticArbitration: true,
    };
  }

  // 4. Substantive Historical Query Detected: Multi-Intent Signal Extraction & Surgical Cleansing
  const signals: IntentClassificationSignals = {
    hasChitchatGreeting: false,
    hasVideoGeneration: false,
    hasOutOfDomainTopic: false,
    isCoReferenceIdentity: false,
  };

  let videoBriefTopic: string | undefined;
  let outOfDomainTopic: string | undefined;
  let substantiveTarget = cleanQuery;

  // 4a. Isolate secondary video production suffix if present (e.g. "... và tạo video giúp tôi")
  const videoMatch = substantiveTarget.match(SECONDARY_VIDEO_SUFFIX_REGEX);
  if (videoMatch && videoMatch[0].length > 0 && videoMatch.index !== undefined) {
    signals.hasVideoGeneration = true;
    const strippedTopic = substantiveTarget.slice(0, videoMatch.index).trim();
    if (strippedTopic.length >= 3) {
      videoBriefTopic = strippedTopic;
      substantiveTarget = strippedTopic;
    }
  }

  // Isolate secondary out-of-domain suffix if present (e.g. "... và nhân tiện chỉ tôi nấu phở bò")
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

  // 4b. Break down remaining query into semantic clauses for multi-intent triage
  const rawClauses = splitQueryIntoSemanticClauses(substantiveTarget);
  const detectedIntentClauses: IntentClause[] = [];
  const historicalClauseCandidates: string[] = [];

  for (const clause of rawClauses) {
    const trimmedClause = clause.trim();
    if (!trimmedClause) continue;

    // Check OOD
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

    // Check Video Intent
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

    // Check Chitchat / Greeting / Identity / Scope inquiry
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

    // Substantive historical/contextual clause (preserve multi-part questions)
    historicalClauseCandidates.push(trimmedClause);
    detectedIntentClauses.push({
      intent: 'HISTORICAL_QUERY',
      confidence: 0.9,
      querySnippet: trimmedClause,
    });
  }

  // Also check whole-query patterns for secondary greeting prefix
  if (PLEASANTRY_PREFIX_REGEX.test(substantiveTarget) || SECONDARY_GREETING_PREFIX_REGEX.test(substantiveTarget)) {
    signals.hasChitchatGreeting = true;
  }

  // 4c. Derive cleanSearchTopic:
  // If the query contains conversational preambles, video suffix, or OOD clauses, isolate and join the substantive clauses.
  // Otherwise, preserve the full original cleanQuery without destructive sentence dismantling.
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

  // Fallback: If cleanSearchTopic is empty or was stripped completely, revert to cleanHistoricalClause on substantiveTarget
  if (!cleanSearchTopic || cleanSearchTopic.length < 2) {
    cleanSearchTopic = cleanHistoricalClause(substantiveTarget) || substantiveTarget;
  }

  // 4c. Conjunction / Coordinate Entity & Co-reference Identification (< 0.5ms)
  for (const pattern of CONJUNCTION_ENTITY_PATTERNS) {
    const match = cleanSearchTopic.match(pattern) || cleanQuery.match(pattern);
    if (match) {
      const rawE1 = match[1]?.replace(/[?!.,;:]+$/g, '').trim();
      const rawE2 = match[2]?.replace(/[?!.,;:]+$/g, '').trim();
      if (rawE1 && rawE2 && isKnownMasterEntity(rawE1) && isKnownMasterEntity(rawE2)) {
        const canonical1 = resolveCanonicalEntity(rawE1);
        const canonical2 = resolveCanonicalEntity(rawE2);

        if (canonical1.entityId && canonical2.entityId) {
          signals.isCoReferenceIdentity = canonical1.entityId === canonical2.entityId;
          const videoHandover: VideoHandoverMetadata = {
            topic: (signals.hasVideoGeneration && videoBriefTopic) ? videoBriefTopic : cleanSearchTopic,
            primaryEntityId: canonical1.entityId,
            canonicalName: canonical1.canonicalName,
          };

          // If entities are distinct and question asks about kinship, route to HISTORICAL_QUERY with GENEALOGY_RELATION
          const isKinshipQuestion = /(?:anh\s+em|chị\s+em|cha\s+con|mẹ\s+con|vợ\s+chồng|dòng\s+họ|thân\s+tộc)/i.test(cleanSearchTopic || cleanQuery);
          if (!signals.isCoReferenceIdentity && isKinshipQuestion) {
            const compositeResult: CompositeIntentResult = {
              primaryIntent: 'HISTORICAL_QUERY',
              subIntent: 'GENEALOGY_RELATION',
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
              subIntent: 'GENEALOGY_RELATION',
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

  // 4d. Single Entity Identity Identification (< 0.5ms) - Only for verified master entities
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

  // Factoid Lookup (Exact Dates, Regnal Eras, Birth/Death, Identity)
  if (/(?:là\s+ai|ai\s+là|năm\s+nào|khi\s+nào|ở\s+đâu|bao\s+nhiêu|ai\s+là\s+người|niên\s+hiệu|tên\s+thật|thọ\s+bao\s+nhiêu|mất\s+năm|sinh\s+năm|tại\s+đâu|vào\s+thời\s+điểm\s+nào)/i.test(norm)) {
    return 'FACTOID_LOOKUP';
  }

  return 'GENERAL_OVERVIEW';
}
