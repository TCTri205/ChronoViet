/**
 * Multi-Tier Intent Classifier & Fast-Path Router (<1ms execution)
 * SSOT for Chatbot query triage: CHITCHAT vs ENTITY_IDENTITY vs VIDEO_INTENT vs HISTORICAL_QUERY
 */

import { resolveCanonicalEntity, ChatIntent } from '@chronoviet/shared-spec';

export type { ChatIntent };

export interface IntentClassificationResult {
  intent: ChatIntent;
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

// Pure Chitchat & Greeting Patterns (Evaluated on normalized query string)
const PURE_CHITCHAT_PATTERNS = [
  /^(?:xin\s+)?chào(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|mọi\s+người|cả\s+nhà|chronoviet|nhé|nhe|nha|ạ))?$/i,
  /^(?:hello|hi|hey|alo|halo)(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|chronoviet|nhé|nhe|nha|ạ))?$/i,
  /^(?:good\s+(?:morning|evening|afternoon|night))$/i,
  /^(?:rất\s+)?(?:cảm\s+ơn|cam\s+on|thank\s*you|thanks|thx)(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|chronoviet|nhiều|nhe|nhé|nha|ạ|\w+)){0,4}$/i,
  /^(?:tạm\s+biệt|tam\s+biet|bye|goodbye|bye\s+bye|hẹn\s+gặp\s+lại)(?:\s+(?:bạn|bot|ad|admin|em|anh|chị|chronoviet|nhé|nhe|nha|ạ))?$/i,
  /(?:xin\s+)?chào(?:\s+bạn|\s+bot|\s+chronoviet)?[\s,;:!?-]+(?:bạn\s+là\s+ai|có\s+thể\s+giúp\s+gì|giúp\s+gì\s+cho\s+tôi|bạn\s+tên\s+gì)/i,
  /^(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|bot|chronoviet)\s+là\s+ai(?:\s+(?:thế|vậy|hả|\?))?$/i,
  /^(?:(?:xin\s+)?chào|hello|hi|hey|alo|halo)?\s*,?\s*(?:bạn|bot|chronoviet)\s+tên\s+(?:là\s+)?gì(?:\s+(?:thế|vậy|hả|\?))?$/i,
  /^(?:(?:hệ\s*thống\s+)?chronoviet\s+có\s+(?:những\s+)?(?:tính\s*năng|chức\s*năng|khả\s*năng|điểm)\s+gì|tính\s*năng\s+(?:của\s+)?(?:chronoviet|hệ\s*thống)|bạn\s+có\s+thể\s+làm\s+(?:được\s+)?gì)/i,
  /^(?:chronoviet\s+là\s+gì|giới\s+thiệu\s+(?:về\s+)?(?:bản\s+thân|bạn|chronoviet)|hướng\s+dẫn(?:\s+sử\s+dụng)?|giúp\s+tôi\s+với|help)$/i,
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
  /^(.+?)\s+(?:và|với)\s+(.+?)\s+có\s+phải\s+(?:là\s+)?(?:cùng\s+một\s+người|là\s+một|2\s+người\s+khác\s+nhau|hai\s+người\s+khác\s+nhau|2\s+anh\s+em|hai\s+anh\s+em|anh\s+em)(?:\s*không|\s+hả|\s*\?)?$/i,
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

export function classifyChatIntent(query: string): IntentClassificationResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      intent: 'CHITCHAT',
      confidence: 1.0,
      fastPathResponse: 'Xin chào! Tôi là ChronoViet AI — Trợ lý nghiên cứu lịch sử Việt Nam và sáng tạo video tự động. Tôi có thể giúp gì cho bạn hôm nay?',
    };
  }

  const cleanQuery = normalizeQueryText(trimmed);

  // 1. Out of Domain Fast-Path (< 0.1ms)
  for (const pattern of OUT_OF_DOMAIN_PATTERNS) {
    if (pattern.test(cleanQuery) || pattern.test(trimmed)) {
      return {
        intent: 'OUT_OF_DOMAIN',
        confidence: 0.98,
        fastPathResponse:
          'Xin lỗi bạn, tôi là ChronoViet AI — Trợ lý chuyên sâu về Nghiên cứu Lịch sử Việt Nam và Sáng tạo Video Lịch sử. Yêu cầu này nằm ngoài phạm vi tri thức lịch sử của hệ thống (tôi không hỗ trợ tư vấn ẩm thực, tài chính/chứng khoán, hay lập trình chung). Bạn có thể hỏi tôi về các triều đại, nhân vật, sự kiện, chiến dịch và các mốc son hào hùng của lịch sử Việt Nam!',
      };
    }
  }

  // 2. Pure Chitchat & Bot Identity Fast-Path (< 0.1ms)
  for (const pattern of PURE_CHITCHAT_PATTERNS) {
    if (pattern.test(cleanQuery) || pattern.test(trimmed)) {
      if (/bạn\s+là\s+ai|bot\s+là\s+ai|bạn\s+tên\s+(?:là\s+)?gì|chronoviet\s+là\s+gì|giới\s+thiệu/i.test(cleanQuery)) {
        return {
          intent: 'CHITCHAT',
          confidence: 0.99,
          fastPathResponse:
            'Tôi là ChronoViet — Trợ lý Lịch sử Việt Nam & Sản xuất Video tự động. Tôi kết hợp đồ thị tri thức (GraphRAG), hệ thống trích dẫn chính sử (Đại Việt Sử Ký Toàn Thư, Khâm Định Việt Sử) và AI để giúp bạn tra cứu sử liệu chính xác cũng như tạo dựng video lịch sử chuyên nghiệp chỉ với 1 cú nhấp chuột.',
        };
      }
      if (/cảm\s+ơn|cam\s+on|thank/i.test(cleanQuery)) {
        return {
          intent: 'CHITCHAT',
          confidence: 0.99,
          fastPathResponse: 'Rất vui được hỗ trợ bạn khám phá lịch sử Việt Nam! Bạn có muốn tìm hiểu thêm về nhân vật hay trận đánh nào nữa không?',
        };
      }
      if (/tạm\s+biệt|tam\s+biet|bye/i.test(cleanQuery)) {
        return {
          intent: 'CHITCHAT',
          confidence: 0.99,
          fastPathResponse: 'Tạm biệt bạn! Hẹn gặp lại trong các hành trình khám phá dòng chảy lịch sử Việt Nam hào hùng.',
        };
      }
      return {
        intent: 'CHITCHAT',
        confidence: 0.99,
        fastPathResponse:
          'Xin chào! Tôi là ChronoViet AI. Tôi có thể giúp bạn tra cứu nhân vật, chiến dịch, triều đại lịch sử Việt Nam với trích dẫn chính sử, hoặc hỗ trợ bạn tạo video lịch sử từ các cuộc trò chuyện này. Bạn muốn tìm hiểu chủ đề gì hôm nay?',
      };
    }
  }

  // Determine effective query by stripping pleasantry prefixes if present (e.g. "Chào bạn, Quang Trung và Nguyễn Huệ là ai?")
  const { stripped: effectiveQuery } = stripPleasantryPrefix(cleanQuery);

  // 2. Video Production Intent (< 0.2ms)
  for (const pattern of VIDEO_INTENT_PATTERNS) {
    const match = effectiveQuery.match(pattern) || trimmed.match(pattern);
    if (match) {
      const topic = (match[1] || effectiveQuery).replace(/[?!.]/g, '').trim();
      return {
        intent: 'VIDEO_INTENT',
        confidence: 0.95,
        suggestedTopic: topic || effectiveQuery,
        fastPathResponse: `Tôi đã nhận diện yêu cầu sản xuất video về chủ đề: "${topic || effectiveQuery}". Bạn có thể chuyển trực tiếp sang tab Video Studio để bắt đầu quy trình tạo video tự động.`,
      };
    }
  }

  // 3. Conjunction Coordinate Entity & Co-reference Fast-Path (< 0.5ms)
  for (const pattern of CONJUNCTION_ENTITY_PATTERNS) {
    const match = effectiveQuery.match(pattern) || cleanQuery.match(pattern);
    if (match) {
      const rawE1 = match[1]?.replace(/[?!.,;:]+$/g, '').trim();
      const rawE2 = match[2]?.replace(/[?!.,;:]+$/g, '').trim();
      if (rawE1 && rawE2) {
        const canonical1 = resolveCanonicalEntity(rawE1);
        const canonical2 = resolveCanonicalEntity(rawE2);

        if (canonical1.entityId && canonical2.entityId) {
          // Branch 1: Same Canonical Entity (Alias / Honorific / Regnal Title match)
          if (canonical1.entityId === canonical2.entityId) {
            const aliasList = Array.from(new Set([canonical1.canonicalName, ...(canonical1.aliases || [])]));
            return {
              intent: 'ENTITY_IDENTITY',
              confidence: 0.98,
              matchedEntityId: canonical1.entityId,
              matchedCanonicalName: canonical1.canonicalName,
              fastPathResponse: `Chính xác! "${rawE1}" và "${rawE2}" thực chất là CÙNG MỘT NHÂN VẬT LỊCH SỬ trong chính sử Việt Nam (${canonical1.canonicalName}). ${canonical1.canonicalName} là tên/niên hiệu/tôn hiệu chính thức, các danh xưng khác bao gồm: ${aliasList.join(', ')}.`,
            };
          }

          // Branch 2: Distinct Entities asking "có phải cùng một người / là một không"
          if (/cùng\s+một\s+người|là\s+một/i.test(match[0])) {
            return {
              intent: 'ENTITY_IDENTITY',
              confidence: 0.95,
              matchedEntityId: canonical1.entityId,
              matchedCanonicalName: canonical1.canonicalName,
              fastPathResponse: `Không, "${rawE1}" (${canonical1.canonicalName}) và "${rawE2}" (${canonical2.canonicalName}) là HAI NHÂN VẬT LỊCH SỬ KHÁC NHAU trong chính sử Việt Nam.`,
            };
          }
        }
      }
    }
  }

  // 4. Single Entity Identity Fast-Path (< 0.5ms)
  for (const pattern of SINGLE_ENTITY_IDENTITY_PATTERNS) {
    const match = effectiveQuery.match(pattern) || cleanQuery.match(pattern);
    if (match) {
      const entityName = match[1]?.trim();
      if (entityName) {
        const canonical = resolveCanonicalEntity(entityName);
        if (canonical.entityId && canonical.canonicalName) {
          if (match[2]) {
            const entityName2 = match[2].replace(/[?!.,;:]+$/g, '').trim();
            const canonical2 = resolveCanonicalEntity(entityName2);
            if (canonical2.entityId && canonical2.canonicalName) {
              const isSame = canonical.entityId === canonical2.entityId;
              return {
                intent: 'ENTITY_IDENTITY',
                confidence: 0.95,
                matchedEntityId: canonical.entityId,
                matchedCanonicalName: canonical.canonicalName,
                fastPathResponse: isSame
                  ? `Chính xác! ${canonical.canonicalName} và ${canonical2.canonicalName} là cùng một nhân vật lịch sử. ${canonical.canonicalName} là tên/tước hiệu chính thức, còn các tên gọi khác bao gồm: ${(canonical.aliases || []).join(', ')}.`
                  : `${canonical.canonicalName} và ${canonical2.canonicalName} là hai thực thể lịch sử khác nhau trong chính sử Việt Nam.`,
              };
            }
          }

          const aliasText = canonical.aliases && canonical.aliases.length > 0
            ? ` (còn được biết đến với các tên gọi: ${canonical.aliases.join(', ')})`
            : '';
          return {
            intent: 'ENTITY_IDENTITY',
            confidence: 0.92,
            matchedEntityId: canonical.entityId,
            matchedCanonicalName: canonical.canonicalName,
            fastPathResponse: `${canonical.canonicalName}${aliasText} là một thực thể lịch sử quan trọng trong cơ sở dữ liệu tri thức ChronoViet. Dưới đây là thông tin chi tiết được trích xuất từ chính sử.`,
          };
        }
      }
    }
  }

  // 5. Default: Deep Historical Query with GraphRAG
  return {
    intent: 'HISTORICAL_QUERY',
    confidence: 0.9,
  };
}
