/**
 * Anti-Sycophancy & False Premise Detection Guardrail
 * Detects leading questions with potential false premises (kinship, dynasty mismatch, fake relations)
 * and generates strict refusal & verification guidance for LLM prompts.
 */

export interface PremiseAnalysisResult {
  isLeadingQuestion: boolean;
  questionType?: 'KINSHIP' | 'IDENTITY' | 'DYNASTY' | 'CHRONOLOGY' | 'GENERAL';
  detectedEntities: string[];
  suggestedDirective: string;
}

const KINSHIP_PATTERNS = [
  /(.+)\s+và\s+(.+)\s+(?:là|có\s+phải)\s+(?:2|hai)?\s*(?:anh\s+em|chị\s+em|cha\s+con|mẹ\s+con|vợ\s+chồng|ông\s+cháu)(?:\s+hả|\s+không|\s*\?)?/i,
  /(.+)\s+có\s+phải\s+(?:là\s+)?(?:con|cha|anh|em|vợ|chồng|cháu)\s+của\s+(.+)(?:\s+không|\s+hả|\s*\?)?/i,
  /(.+)\s+là\s+(?:con|cha|anh|em|vợ|chồng|cháu)\s+của\s+(.+)(?:\s+hả|\s+không|\s*\?)?/i,
];

const DYNASTY_PATTERNS = [
  /(.+)\s+(?:có\s+phải\s+là\s+vua|lập\s+ra|thuộc)\s+(?:nhà|triều)\s+(.+)(?:\s+không|\s+hả|\s*\?)?/i,
];

function cleanEntitySpan(span: string): string {
  return span
    .replace(/^(?:cho\s+(?:mình|tôi|em)\s+hỏi|bạn\s+ơi|bot\s+ơi|làm\s+ơn\s+cho\s+biết)\s+/i, '')
    .replace(/[?!.,;:]+$/g, '')
    .trim();
}

/**
 * Analyzes whether a query contains a leading question that might trick the LLM into sycophancy.
 */
export function analyzePremiseAndLeadingIntent(query: string): PremiseAnalysisResult {
  const trimmed = query.trim();

  // 1. Kinship leading question check
  for (const pattern of KINSHIP_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const e1 = cleanEntitySpan(match[1] || '');
      const e2 = cleanEntitySpan(match[2] || '');
      return {
        isLeadingQuestion: true,
        questionType: 'KINSHIP',
        detectedEntities: [e1, e2].filter(Boolean),
        suggestedDirective: `BẮT BUỘC KIỂM TRA TIỀN ĐỀ QUAN HỆ THÂN TỘC: Người dùng đang hỏi dạng mớm về quan hệ họ hàng giữa "${e1}" và "${e2}". Nếu không có bằng chứng chính sử xác thực, BẮT BUỘC phải bác bỏ rõ ràng ngay đầu câu trả lời (ví dụ: "Không, ${e1} và ${e2} không phải là anh em/họ hàng..."). TUYỆT ĐỐI KHÔNG tự bịa đặt danh tính, tên khai sinh, năm sinh, niên hiệu, thứ bậc hoàng đế hoặc triều đại cho nhân vật không có trong chính sử. Nếu một trong các nhân vật không có trong chính sử, hãy nêu rõ "Trong chính sử không có ghi chép về nhân vật mang tên...".`,
      };
    }
  }

  // 2. Dynasty / Monarch leading question check
  for (const pattern of DYNASTY_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const e1 = cleanEntitySpan(match[1] || '');
      const e2 = cleanEntitySpan(match[2] || '');
      return {
        isLeadingQuestion: true,
        questionType: 'DYNASTY',
        detectedEntities: [e1, e2].filter(Boolean),
        suggestedDirective: `BẮT BUỘC KIỂM TRA TIỀN ĐỀ TRIỀU ĐẠI: Người dùng đang hỏi gán ghép nhân vật "${e1}" với triều đại "${e2}". Hãy kiểm tra chính xác triều đại lịch sử thực tế và đính chính ngay nếu tiền đề sai lệch. Tuyệt đối không suy đoán nếu không có trong chính sử.`,
      };
    }
  }

  return {
    isLeadingQuestion: false,
    questionType: 'GENERAL',
    detectedEntities: [],
    suggestedDirective: '',
  };
}
