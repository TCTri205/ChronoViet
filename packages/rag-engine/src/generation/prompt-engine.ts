/**
 * ChronoViet Intent-Aware Historical Reasoning Prompt Engine
 * Constructs specialized, deep-reasoning prompts for causal analysis, comparative synthesis,
 * multi-hop traversal, and factual Q&A with strict grounding & anti-hallucination guardrails.
 */

import { ChatMessage } from '@chronoviet/infra';

export type HistoricalIntentType =
  | 'WHY_REASONING'
  | 'CAUSAL_ANALYSIS'
  | 'COMPARATIVE'
  | 'EVENT_DETAILS'
  | 'BIOGRAPHY'
  | 'GENERAL';

export interface PromptConstructionOptions {
  query: string;
  contextText: string;
  intent?: HistoricalIntentType | string;
  requiresMultiHop?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ConstructedPromptResult {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
}

/**
 * Detects intent from query if not explicitly provided
 */
export function detectQueryIntent(query: string, explicitIntent?: string): HistoricalIntentType {
    if (explicitIntent) {
      const upper = explicitIntent.toUpperCase();
      if (upper === 'WHY_REASONING' || upper === 'CAUSAL_ANALYSIS') return 'WHY_REASONING';
      if (upper === 'COMPARATIVE') return 'COMPARATIVE';
      if (upper === 'BIOGRAPHY') return 'BIOGRAPHY';
      if (upper === 'EVENT_DETAILS') return 'EVENT_DETAILS';
    }

    const qLower = query.toLowerCase().trim();

    // 1. Comparative Intent
    if (
      qLower.includes('so sánh') ||
      qLower.includes('khác nhau') ||
      qLower.includes('giống nhau') ||
      qLower.includes('đối chiếu') ||
      qLower.includes('điểm chung') ||
      qLower.includes('điểm khác') ||
      (qLower.includes('giữa') && qLower.includes('và'))
    ) {
      return 'COMPARATIVE';
    }

    // 2. Causal / Why Reasoning Intent
    if (
      qLower.startsWith('tại sao') ||
      qLower.startsWith('vì sao') ||
      qLower.includes('nguyên nhân') ||
      qLower.includes('lý do') ||
      qLower.includes('tại sao lại') ||
      qLower.includes('vì cớ gì') ||
      qLower.includes('kết quả và ý nghĩa') ||
      qLower.includes('chiến lược') ||
      qLower.includes('sách lược') ||
      qLower.includes('bối cảnh ra đời') ||
      qLower.includes('dẫn đến việc') ||
      qLower.includes('hệ quả lịch sử')
    ) {
      return 'WHY_REASONING';
    }

    // 3. Biography Intent
    if (
      qLower.includes('tiểu sử') ||
      qLower.includes('thân thế') ||
      qLower.includes('sự nghiệp của') ||
      qLower.includes('cuộc đời của') ||
      qLower.includes('tên thật của') ||
      qLower.includes('quê quán của') ||
      qLower.startsWith('ai là') ||
      qLower.startsWith('ai đã') ||
      qLower.startsWith('ai chỉ huy') ||
      qLower.startsWith('ai đánh tan') ||
      qLower.startsWith('ai lãnh đạo') ||
      qLower.includes('vua nào') ||
      qLower.includes('vị tướng nào') ||
      qLower.includes('nhân vật nào')
    ) {
      return 'BIOGRAPHY';
    }

    return 'EVENT_DETAILS';
  }

/**
 * Builds high-reasoning prompt messages and optimal token budgets
 */
export function buildPrompt(options: PromptConstructionOptions): ConstructedPromptResult {
  const {
    query,
    contextText,
    intent: rawIntent,
    requiresMultiHop = false,
    maxTokens: overrideMaxTokens,
    temperature: overrideTemperature,
  } = options;

  const intent = detectQueryIntent(query, rawIntent);

  let specificDirective = '';
  let suggestedMaxTokens = 600;
  let suggestedTemperature = 0.15;

  switch (intent) {
    case 'WHY_REASONING':
    case 'CAUSAL_ANALYSIS':
      suggestedMaxTokens = 850;
      suggestedTemperature = 0.15;
      specificDirective = `
CHỈ DẪN LẬP LUẬN NHÂN QUẢ & BỐI CẢNH (CAUSAL REASONING):
- Bắt buộc giải thích toàn diện 4 khía cạnh:
  1. Bối cảnh lịch sử & Tiền đề (Nguyên nhân sâu xa).
  2. Ngòi nổ trực tiếp & Mục tiêu chiến lược / Sách lược then chốt của các bên.
  3. Diễn biến then chốt mang tính quyết định.
  4. Kết quả lịch sử & Ý nghĩa / Hệ quả lâu dài.
- Luôn sử dụng các liên từ lập luận nhân quả rõ ràng: "do", "bởi vì", "nguyên nhân chính", "chiến lược", "kết quả", "dẫn đến".`;
      break;

    case 'COMPARATIVE':
      suggestedMaxTokens = 950;
      suggestedTemperature = 0.15;
      specificDirective = `
CHỈ DẪN LẬP LUẬN SO SÁNH LỊCH SỬ (COMPARATIVE ANALYSIS):
- Bắt buộc phân tích đa chiều giữa các đối tượng / triều đại / trận đánh:
  1. Bối cảnh thời đại & Tương quan lực lượng.
  2. Sách lược quân sự / Đường lối trị quốc của từng bên.
  3. Những điểm tương đồng và khác biệt bản chất.
  4. Kết quả và bài học lịch sử rút ra.`;
      break;

    case 'BIOGRAPHY':
      suggestedMaxTokens = 650;
      suggestedTemperature = 0.1;
      specificDirective = `
CHỈ DẪN TIỂU SỬ & HÀNH TRẠNG NHÂN VẬT:
- Nêu rõ: Danh xưng/Tước hiệu/Miếu hiệu, Niên đại/Thời kỳ, Thân phụ/Mối quan hệ chính sử xác thực, Vai trò lịch sử và Công lao/Chiến tích tiêu biểu.
- Cảnh báo: Tuyệt đối không tự suy đoán tên húy nếu không xuất hiện trực tiếp trong tư liệu xác thực.`;
      break;

    default:
      suggestedMaxTokens = 750;
      suggestedTemperature = 0.1;
      specificDirective = `
CHỈ DẪN SỰ KIỆN LỊCH SỬ CHÍNH XÁC & ĐẦY ĐỦ:
- Trình bày đầy đủ và toàn diện các dữ kiện lịch sử: Niên đại cụ thể, Địa danh diễn ra, Nhân vật lãnh đạo/chỉ huy, Diễn biến cốt lõi, Kế sách/Chiến lược và Kết quả/Ý nghĩa lịch sử dựa trên các đoạn tư liệu đã cung cấp.`;
      break;
  }

  if (requiresMultiHop) {
    suggestedMaxTokens = Math.max(suggestedMaxTokens, 850);
    specificDirective += `\n
CHỈ DẪN LIÊN KẾT ĐA CHẶNG (MULTI-HOP LINKING):
- Câu hỏi này liên kết nhiều thực thể/sự kiện qua nhiều chặng. Bắt buộc xâu chuỗi mạch lạc mối quan hệ giữa các nhân vật, sự kiện và triều đại từ phần Graph Triples và Evidence Chunks.`;
  }

  const systemPrompt = `Bạn là ChronoViet AI — Chuyên gia Nghiên cứu & Lập Luận Lịch Sử Việt Nam. Nhiệm vụ của bạn là giải đáp câu hỏi của người dùng một cách chuẩn xác tuyệt đối, sâu sắc và đầy đủ cứ liệu lịch sử dựa trên các tư liệu chính thống được cung cấp.

NGUYÊN TẮC BẮT BUỘC:
1. TÍNH CHÍNH XÁC LỊCH SỬ (ZERO FABRICATION):
   - Cung cấp đầy đủ niên đại (năm cụ thể), địa danh, nhân vật chỉ huy, sách lược và kết quả lịch sử.
   - Tuyệt đối không tự bịa đặt niên hiệu, thân tộc, tên húy hay chiến công không có trong sử liệu.
2. TRÍCH DẪN NGUỒN CHÍNH XÁC (CITATION GROUNDING):
   - Mỗi nhận định hoặc dữ kiện lịch sử bắt buộc ghi kèm mã trích dẫn nguồn ở cuối câu theo định dạng chuẩn: [Nguồn: chunk_id] (hoặc [Nguồn: CHUNK_#]).
3. NGUỒN DÃ SỬ & TRUYỀN THUYẾT (LEVEL_3):
   - Nếu thông tin lấy từ nguồn dã sử hoặc truyền thuyết, bắt buộc dùng từ dè dặt: "theo truyền thuyết", "tương truyền", "dân gian kể rằng".
4. XỬ LÝ KHI THIẾU TƯ LIỆU (ZERO EVIDENCE REFUSAL):
   - Nếu trong "NGỮ CẢNH TƯ LIỆU SỬ LIỆU" không có thông tin để giải đáp câu hỏi, BẮT BUỘC phải nói rõ là "Tư liệu sử liệu hiện có không ghi nhận thông tin này" hoặc "Chưa có đủ cứ liệu chính sử xác thực để khẳng định", TUYỆT ĐỐI KHÔNG tự suy đoán hay chắp vá chi tiết hư cấu.
${specificDirective}

NGỮ CẢNH TƯ LIỆU SỬ LIỆU:
${contextText}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ];

  return {
    messages,
    maxTokens: overrideMaxTokens || suggestedMaxTokens,
    temperature: overrideTemperature ?? suggestedTemperature,
  };
}

export const PromptEngine = {
  detectQueryIntent,
  buildPrompt,
};
