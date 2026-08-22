/**
 * Multi-Tier Intent Classifier & Fast-Path Router (<1ms execution)
 * SSOT for Chatbot query triage: CHITCHAT vs ENTITY_IDENTITY vs VIDEO_INTENT vs HISTORICAL_QUERY
 */

import { resolveCanonicalEntity } from '@chronoviet/shared-spec';

export type ChatIntent = 'CHITCHAT' | 'ENTITY_IDENTITY' | 'VIDEO_INTENT' | 'HISTORICAL_QUERY';

export interface IntentClassificationResult {
  intent: ChatIntent;
  confidence: number;
  fastPathResponse?: string;
  suggestedTopic?: string;
  matchedEntityId?: string;
  matchedCanonicalName?: string;
}

const CHITCHAT_GREETINGS = [
  /^(xin\s+)?chào(\s+.*)?$/i,
  /^(hello|hi|hey|alo|good morning|good evening)(\s+.*)?$/i,
  /^cảm\s+ơn(\s+.*)?$/i,
  /^(thank\s*you|thanks|thx)(\s+.*)?$/i,
  /^(tạm\s+biệt|bye|goodbye|hẹn\s+gặp\s+lại)(\s+.*)?$/i,
  /^(bạn\s+là\s+ai|bot\s+là\s+ai|bạn\s+tên\s+là\s+gì|chronoviet\s+là\s+gì)(\s+.*)?$/i,
  /^(bạn\s+có\s+thể\s+làm\s+gì|hướng\s+dẫn|giúp\s+tôi\s+với|help)(\s+.*)?$/i,
];

const VIDEO_INTENT_PATTERNS = [
  /(?:tạo|làm|sản\s*xuất|dựng|xây\s*dựng|generate|make)\s+(?:video|clip|phim|thước\s*phim)\s+(?:về|về\s+chủ\s+đề|kể\s+về)?\s*(.+)/i,
  /(?:chuyển|tổng\s*hợp)\s+(?:thành|sang)\s+video\s*(.+)?/i,
  /(?:video\s*brief|tạo\s*kịch\s*bản\s*video)\s*(.+)?/i,
];

const ENTITY_IDENTITY_PATTERNS = [
  /^([A-ZÀ-Ỹa-zà-ỹ\s]+)\s+là\s+ai(?:\s*\?)?$/i,
  /^ai\s+là\s+([A-ZÀ-Ỹa-zà-ỹ\s]+)(?:\s*\?)?$/i,
  /^([A-ZÀ-Ỹa-zà-ỹ\s]+)\s+có\s+phải\s+(?:là\s+)?([A-ZÀ-Ỹa-zà-ỹ\s]+)(?:\s*không|\s*\?)?$/i,
  /^tên\s+thật\s+của\s+([A-ZÀ-Ỹa-zà-ỹ\s]+)\s+(?:là\s+gì|\?)/i,
  /^quê\s+quán\s+của\s+([A-ZÀ-Ỹa-zà-ỹ\s]+)\s+(?:ở\s+đâu|\?)/i,
];

export function classifyChatIntent(query: string): IntentClassificationResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      intent: 'CHITCHAT',
      confidence: 1.0,
      fastPathResponse: 'Xin chào! Tôi là ChronoViet AI — Trợ lý nghiên cứu lịch sử Việt Nam và sáng tạo video tự động. Tôi có thể giúp gì cho bạn hôm nay?',
    };
  }

  const cleanQuery = trimmed.replace(/[?!.,;:]+$/g, '').trim();

  // 1. Chitchat Fast-Path (< 0.1ms)
  for (const pattern of CHITCHAT_GREETINGS) {
    if (pattern.test(cleanQuery) || pattern.test(trimmed)) {
      if (/bạn\s+là\s+ai|bot\s+là\s+ai|bạn\s+tên\s+là\s+gì|chronoviet\s+là\s+gì/i.test(cleanQuery)) {
        return {
          intent: 'CHITCHAT',
          confidence: 0.99,
          fastPathResponse:
            'Tôi là ChronoViet — Trợ lý Lịch sử Việt Nam & Sản xuất Video tự động. Tôi kết hợp đồ thị tri thức (GraphRAG), hệ thống trích dẫn chính sử (Đại Việt Sử Ký Toàn Thư, Khâm Định Việt Sử) và AI để giúp bạn tra cứu sử liệu chính xác cũng như tạo dựng video lịch sử chuyên nghiệp chỉ với 1 cú nhấp chuột.',
        };
      }
      if (/cảm\s+ơn|thank/i.test(trimmed)) {
        return {
          intent: 'CHITCHAT',
          confidence: 0.99,
          fastPathResponse: 'Rất vui được hỗ trợ bạn khám phá lịch sử Việt Nam! Bạn có muốn tìm hiểu thêm về nhân vật hay trận đánh nào nữa không?',
        };
      }
      if (/tạm\s+biệt|bye/i.test(trimmed)) {
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

  // 2. Video Production Intent (< 0.2ms)
  for (const pattern of VIDEO_INTENT_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const topic = (match[1] || trimmed).replace(/[?!.]/g, '').trim();
      return {
        intent: 'VIDEO_INTENT',
        confidence: 0.95,
        suggestedTopic: topic || trimmed,
        fastPathResponse: `Tôi đã nhận diện yêu cầu sản xuất video về chủ đề: "${topic || trimmed}". Bạn có thể chuyển trực tiếp sang tab Video Studio để bắt đầu quy trình tạo video tự động.`,
      };
    }
  }

  // 3. Entity Identity Fast-Path (< 0.5ms)
  for (const pattern of ENTITY_IDENTITY_PATTERNS) {
    const match = trimmed.match(pattern);
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

  // 4. Default: Deep Historical Query with GraphRAG
  return {
    intent: 'HISTORICAL_QUERY',
    confidence: 0.9,
  };
}
