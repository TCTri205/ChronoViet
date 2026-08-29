/**
 * ChronoViet Chat Supervisor & Stream Coordinator
 * Coordinates Multi-tier Intent Routing, Multi-turn Query Rewriting, Graph Triples Injection,
 * Folklore & Citation Guardrails, and SSE Realtime Streaming.
 */

import {
  IRagEngine,
  ChatStreamResponse,
  GraphTripleItem,
  HistoricalCitationItem,
  isKnownMasterEntity,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  generateLLMCompletionStream,
  ChatMessage,
  envConfig,
  ragTimeoutsTotal,
} from '@chronoviet/infra';
import { ChronoRagEngine } from '@chronoviet/rag-engine';
import { classifyChatIntent, ChatIntent } from './intent-classifier.js';
import { rewriteMultiTurnQuery, ChatTurnContext } from './query-rewriter.js';
import {
  pruneConversationHistory,
  pruneRagContext,
  pruneGraphTriples,
  clampTotalPromptMessages,
} from './context-pruner.js';
import { validateFolkloreHypothesisTone } from '../guardrails/folklore-validator.js';
import { analyzePremiseAndLeadingIntent } from '../guardrails/anti-sycophancy.js';
import { createStreamLoopDetector, deduplicateRepetitiveText } from '../guardrails/stream-dedup.js';

const log = createLogger({ service: 'agent-orchestrator' });

export function escapePromptXml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/<\/?(?:historical_context|user_query|premise_directives|verified_rag_evidence|knowledge_graph_triples)[^>]*>/gi, '');
}

export interface ChatSupervisorRequest {
  query: string;
  conversationId?: string;
  history?: ChatTurnContext[];
  signal?: AbortSignal;
  ragEngine?: IRagEngine;
}

export interface ChatExecutionResult {
  fullText: string;
  intent: ChatIntent;
  citations: (string | HistoricalCitationItem)[];
  triples: GraphTripleItem[];
  conversationId?: string;
}

/**
 * 100% Static System Persona Prompt for KV-Cache Preservation across all conversation turns.
 */
export const STATIC_SYSTEM_PERSONA_PROMPT = `Bạn là ChronoViet AI — Chuyên gia Nghiên cứu Lịch sử Việt Nam chuẩn mực, thông thái và khách quan.

NGUYÊN TẮC BẮT BUỘC:
1. Trả lời chi tiết, sinh động, chuẩn xác tuyệt đối theo chính sử Việt Nam (Đại Việt Sử Ký Toàn Thư, Khâm Định Việt Sử Thông Giám Cương Mục, Lam Sơn Thực Lục...).
2. KIỂM TRA TIỀN ĐỀ CÂU HỎI, ĐỒNG NHẤT DANH XƯNG & CHỐNG BỊA ĐẶT (ANTI-SYCOPHANCY & CO-REFERENCE INTEGRITY):
   - Khi người dùng hỏi về hai hay nhiều tên gọi thực chất là tên húy, niên hiệu, tôn hiệu hoặc tước vị của CÙNG MỘT NGƯỜI (ví dụ: Quang Trung - Nguyễn Huệ, Trần Hưng Đạo - Trần Quốc Tuấn, Lê Lợi - Lê Thái Tổ, Lý Thái Tổ - Lý Công Uẩn, Đinh Tiên Hoàng - Đinh Bộ Lĩnh, Gia Long - Nguyễn Ánh, Mai Thúc Loan - Mai Hắc Đế, An Dương Vương - Thục Phán), BẮT BUỘC phải khẳng định ngay ở câu mở đầu rằng đây là CÙNG MỘT NHÂN VẬT LỊCH SỬ. Tuyệt đối không được tách thành hai nhân vật hoặc mô tả như hai người riêng biệt.
   - Nếu câu hỏi gán ghép quan hệ anh em/họ hàng/thân tộc cho cùng một người (ví dụ: "Quang Trung và Nguyễn Huệ có phải là 2 anh em?"), BẮT BUỘC đính chính ngay rằng đây là cùng một nhân vật lịch sử với các danh xưng khác nhau qua từng giai đoạn, tuyệt đối không thừa nhận là hai anh em.
   - Nếu câu hỏi của người dùng chứa tiền đề sai lệch (ví dụ: gán sai quan hệ anh em/cha con/vợ chồng, gán sai triều đại, đảo lộn niên đại, gán chiến công cho sai nhân vật), bạn BẮT BUỘC phải bác bỏ và đính chính rõ ràng ngay ở câu đầu tiên (ví dụ: "Không, [A] và [B] không phải là anh em...", "Theo chính sử, thông tin này không chính xác...").
   - TUYỆT ĐỐI KHÔNG xu nịnh hoặc đồng tình ("Đúng rồi", "Đúng vậy") với tiền đề sai của người dùng rồi tự bịa đặt câu chuyện để hợp thức hóa tiền đề đó.
   - Khi một nhân vật hoặc tên gọi KHÔNG CÓ trong chính sử Việt Nam (hoặc hư cấu, không xác định), BẮT BUỘC phải nói rõ: "Trong chính sử không có ghi chép về nhân vật mang tên [X]" thay vì suy đoán.
3. TUYỆT ĐỐI KHÔNG TỰ BỊA ĐẶT THÂN TỘC, DANH TÍNH & CHIẾN TÍCH (ZERO HISTORICAL HALLUCINATION):
   - Tuyệt đối không tự suy diễn hoặc bịa đặt tên khai sinh, năm sinh/mất, niên hiệu, thân phụ, anh em, hoặc vị thứ hoàng đế/vua chúa.
   - NGUYÊN TẮC VỀ TÊN HÚY (TÊN KHAI SINH TRONG NGOẶC ĐƠN): CHỈ ĐƯỢC PHÉP ghi tên húy nếu tên đó XUẤT HIỆN TRỰC TIẾP trong "DỮ LIỆU SỬ LIỆU XÁC THỰC". Tuyệt đối không tự ghép họ tên (CẤM TỰ BỊA "Trần Thừa Thải", "Trần Thừa Bình" hay bất kỳ tên húy nào không có trong sử liệu). Nếu không có tên húy trong ngữ cảnh, CHỈ ĐƯỢC DÙNG MIẾU HIỆU/DANH XƯNG (Ví dụ: "Vua Trần Thái Tông", "Vua Trần Nhân Tông").
   - Tuyệt đối không tự bịa đặt tên tướng lĩnh chỉ huy hư cấu hoặc gán sai địa danh/trận đánh (ví dụ: 3 lần chống Mông-Nguyên lần lượt do Vua Trần Thái Tông - Thái sư Trần Thủ Độ [lần 1 - Đông Bộ Đầu 1258], Vua Trần Nhân Tông - Thượng hoàng Trần Thánh Tông - Tiết chế Trần Quốc Tuấn [lần 2 - 1285 & lần 3 - Bạch Đằng 1288]. Trận Bạch Đằng lừng lẫy tiêu diệt Ô Mã Nhi là ở Lần 3 năm 1288, không phải Lần 2).
   - Nếu một nhân vật hoặc mối quan hệ không có ghi chép trong chính sử, hãy nêu rõ "Không có ghi chép chính sử" thay vì tự suy diễn.
4. NGUYÊN TẮC BỐI CẢNH LỊCH SỬ & CHỐNG SUY DIỄN PHI THỜI ĐẠI (ANTI-ANACHRONISM & FEUDAL SOCIETAL PARADIGM):
   - Mọi lý giải về nhân khẩu học, sự phân bố dòng họ (đặc biệt là họ Nguyễn, họ Lê, họ Trần, họ Vũ/Võ...), thứ bậc xã hội và phong tục tập quán cổ truyền BẮT BUỘC phải dựa trên hệ quy chiếu chế độ phong kiến Nho giáo (văn hóa phụ hệ nghiêm ngặt - con mang họ cha theo huyết thống, lệnh cưỡng chế đổi họ khi vương triều sụp đổ, lệ ban quốc tính của hoàng tộc, và việc lập sổ đinh/sổ hộ tịch thời Pháp thuộc).
   - TUYỆT ĐỐI KHÔNG áp dụng tư duy tự do cá nhân, xu hướng truyền thông, phim ảnh hay thói quen hiện đại vào lịch sử (ví dụ: TUYỆT ĐỐI KHÔNG giải thích rằng người dân "tự do chọn họ cho con cái", "chọn họ vì hâm mộ triều đại", hay "do ảnh hưởng từ phim ảnh").
   - Khi giải thích vì sao họ Nguyễn chiếm tỷ lệ áp đảo (~38-40% dân số Việt Nam), BẮT BUỘC phải dựa trên các mốc lịch sử cốt lõi:
     + Thái sư Trần Thủ Độ ép tôn thất nhà Lý đổi sang họ Nguyễn năm 1232 (kiêng húy Trần Lý và dứt lòng vọng Lý của dân chúng).
     + Hậu duệ nhà Hồ (1407), nhà Mạc (1592) và Tây Sơn (1802) đổi sang họ Nguyễn để lánh nạn diệt vong.
     + Tập tục Ban Quốc Tính thời Chúa Nguyễn và Triều Nguyễn cho công thần có công.
     + Việc lập sổ đinh, căn cước hộ tịch thời Pháp thuộc gán họ của triều đại đang trị vì cho tầng lớp bần nông không có họ.
5. Đối với tư liệu truyền thuyết hoặc dã sử (LEVEL_3): BẮT BUỘC dùng từ ngữ giả thuyết: 'theo truyền thuyết', 'tương truyền', 'dân gian kể rằng'.
6. Nêu rõ niên đại, nhân vật, bối cảnh và ý nghĩa lịch sử.
7. Trình bày đẹp mắt với định dạng Markdown (tiêu đề, danh sách, in đậm từ khóa quan trọng).
8. TUYỆT ĐỐI KHÔNG LẶP LẠI: Không lặp lại nguyên văn các câu, đoạn văn hoặc danh sách đã trình bày trong cùng một câu trả lời.`;

export async function* handleChatQueryStream(
  request: ChatSupervisorRequest
): AsyncGenerator<ChatStreamResponse> {
  const { query, conversationId, history = [], signal, ragEngine } = request;
  const startTime = Date.now();

  log.info('chat.supervisor_started', `Chat query received: "${query.slice(0, 50)}..."`, {
    conversationId,
    historyTurns: history.length,
  });

  if (signal?.aborted) {
    yield { type: 'error', error: 'Yêu cầu đã bị hủy bởi người dùng' };
    return;
  }

  // 1. Intent Classification (< 1ms)
  const classification = classifyChatIntent(query);
  yield {
    type: 'intent',
    intent: classification.intent,
    content: classification.suggestedTopic || classification.matchedCanonicalName,
  };

  // 2. Out-of-Domain Fast Path (< 1ms)
  if (classification.intent === 'OUT_OF_DOMAIN') {
    const oodMsg =
      classification.fastPathResponse ||
      'Xin lỗi bạn, tôi là ChronoViet AI — Trợ lý chuyên sâu về Nghiên cứu Lịch sử Việt Nam. Yêu cầu này nằm ngoài phạm vi tri thức lịch sử của hệ thống. Bạn có thể hỏi tôi về các triều đại, nhân vật, sự kiện hoặc trận đánh lịch sử Việt Nam!';
    yield { type: 'token', content: oodMsg };
    yield { type: 'citation', citations: [] };
    yield {
      type: 'done',
      content: oodMsg,
      conversationId,
    };
    return;
  }

  // 3. Chitchat Fast Path
  if (classification.intent === 'CHITCHAT') {
    const fastMsg = classification.fastPathResponse || 'Xin chào! Tôi có thể giúp gì cho bạn?';
    yield { type: 'token', content: fastMsg };
    yield { type: 'citation', citations: [] };
    yield {
      type: 'done',
      content: fastMsg,
      conversationId,
    };
    return;
  }

  // 4. Video Creation Fast Path
  if (classification.intent === 'VIDEO_INTENT') {
    const topic = classification.suggestedTopic || query;
    const msg =
      classification.fastPathResponse ||
      `Đã nhận diện yêu cầu tạo video về chủ đề: "${topic}". Bạn có thể chọn thời lượng và phong cách trong Studio để bắt đầu tạo video.`;
    yield { type: 'token', content: msg };
    yield { type: 'citation', citations: [] };
    yield {
      type: 'done',
      content: msg,
      conversationId,
    };
    return;
  }

  // 4. Entity Identity Fast Path (or deep historical query)
  let searchTopic = query;
  if (history.length > 0) {
    searchTopic = rewriteMultiTurnQuery(query, history);
  }

  // 5. Deep Chrono-RAG Search with Graph Triples
  const engine = ragEngine || new ChronoRagEngine();
  let verifiedCitations: string[] = [];
  let graphTriples: GraphTripleItem[] = [];
  let contextSnippets = '';
  let isFolkloreSource = false;
  let isRagFallback = false;

  const ragTimeoutMs = envConfig.RAG_SEARCH_TIMEOUT_MS || 20000;
  try {
    const ragResponse = await Promise.race([
      engine.search({
        query: searchTopic,
        subIntent: classification.subIntent,
        rerankTopK: classification.subIntent === 'FACTOID_LOOKUP' ? 3 : 4,
      }),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('RAG search timeout')), ragTimeoutMs)
      ),
    ]);

    verifiedCitations = ragResponse.citations || [];
    graphTriples = (ragResponse.triples as GraphTripleItem[]) || [];

    // Emit triples and citations early
    if (graphTriples.length > 0) {
      yield { type: 'triples', triples: graphTriples };
    }
    if (verifiedCitations.length > 0) {
      yield { type: 'citation', citations: verifiedCitations };
    }

    contextSnippets = (ragResponse.verifiedContext || [])
      .map(
        (v: any) =>
          `### ${v.canonicalName}\n${v.summary}\n(Nguồn: ${v.citations.join(', ')})`
      )
      .join('\n\n');

    isFolkloreSource = (ragResponse.verifiedContext || []).some((v: any) =>
      v.citations.some((c: any) => /LEVEL_3|dã sử|truyền thuyết/i.test(c))
    );

    if (!contextSnippets || contextSnippets.trim().length === 0) {
      isRagFallback = true;
    }
  } catch (ragErr: any) {
    isRagFallback = true;
    if (ragErr.message?.includes('RAG search timeout')) {
      ragTimeoutsTotal.inc();
    }
    log.warn('chat.rag_retrieval_fallback', `RAG retrieval warning: ${ragErr.message}`, {
      query: searchTopic,
      timeoutMs: ragTimeoutMs,
    });
    yield { type: 'citation', citations: [] };
  }

  if (signal?.aborted) {
    yield { type: 'error', error: 'Yêu cầu đã bị hủy' };
    return;
  }

  // 6. Build Context & Multi-turn Prompt
  const prunedHistory = pruneConversationHistory(history);
  const premiseAnalysis = analyzePremiseAndLeadingIntent(query);
  const triplesText = pruneGraphTriples(graphTriples, 15, premiseAnalysis.detectedEntities);
  const unmappedEntities: string[] = [];
  for (const ent of premiseAnalysis.detectedEntities) {
    const isMaster = isKnownMasterEntity(ent);
    const foundInContext = contextSnippets.toLowerCase().includes(ent.toLowerCase());
    const foundInTriples = graphTriples.some(
      (t) => t.source.toLowerCase().includes(ent.toLowerCase()) || t.target.toLowerCase().includes(ent.toLowerCase())
    );
    if (!isMaster && !foundInContext && !foundInTriples) {
      unmappedEntities.push(ent);
    }
  }

  const unmappedDirectiveText = unmappedEntities.length > 0
    ? `\n\nCẢNH BÁO THỰC THỂ NGOÀI CHÍNH SỬ:\nCác tên/nhân vật sau xuất hiện trong câu hỏi nhưng KHÔNG TỒN TẠI trong cơ sở dữ liệu chính sử: "${unmappedEntities.join('", "')}". Bạn BẮT BUỘC phải nói rõ là trong chính sử không có ghi chép về nhân vật này, TUYỆT ĐỐI KHÔNG tự phong vương/vua/tướng hoặc suy đoán tiểu sử hư cấu.`
    : '';

  const ragFallbackDirective = isRagFallback
    ? `\n\nCHỈ DẪN KHẨN CẤP KHI KHÔNG CÓ DỮ LIỆU RAG (ZERO-CONTEXT ANTI-HALLUCINATION GUARDRAILS):
- CẢNH BÁO: Hiện tại hệ thống không thể trích xuất sử liệu xác thực (Chrono-RAG).
- BẮT BUỘC chỉ trình bày các sự kiện, bối cảnh đại cương được giới sử học công nhận rộng rãi (ví dụ: Hội nghị Diên Hồng là do Vua Trần Nhân Tông và Thượng hoàng Trần Thánh Tông triệu tập các bô lão cả nước để hỏi kế đánh giặc, muôn người đồng thanh hô "ĐÁNH").
- TUYỆT ĐỐI KHÔNG tự suy diễn, không tự bịa đặt tên tướng lĩnh hoặc gán ghép các nhân vật Mông Cổ/ngoại quốc không có căn cứ (như Mông Kha, Mông Kha Thiếp Mộc Nhi...).
- Nếu không có tư liệu chắc chắn về một chi tiết cụ thể nào, BẮT BUỘC nêu rõ: "Cần tra cứu thêm chính sử để có thông tin chi tiết về...".`
    : '';

  let subIntentDirective = '';
  if (classification.subIntent === 'GENEALOGY_RELATION') {
    subIntentDirective = `\n\nCHỈ DẪN TRẢ LỜI PHẢ HỆ / THÂN TỘC: Nêu rõ quan hệ huyết thống, cha-con, anh-em, phu-thê, nguồn gốc tông tộc hoặc biến cố đổi họ/ban quốc tính theo chính sử.`;
  } else if (classification.subIntent === 'BATTLE_TACTICS') {
    subIntentDirective = `\n\nCHỈ DẪN TRẢ LỜI CHIẾN THUẬT & TRẬN ĐÁNH: Trình bày mạch lạc diễn biến, bài binh bố trận, kế sách quân sự (mai phục, thủy chiến, cọc ngầm, nghi binh...) và vai trò chỉ huy.`;
  } else if (classification.subIntent === 'FACTOID_LOOKUP') {
    subIntentDirective = `\n\nCHỈ DẪN TRẢ LỜI TRA CỨU NIÊN ĐẠI / SỰ KIỆN: Trả lời trực diện, chính xác mốc năm, địa danh, niên hiệu hoặc nhân vật trước khi trình bày tóm lược bối cảnh.`;
  } else if (classification.subIntent === 'COMPARATIVE_SYNTHESIS') {
    subIntentDirective = `\n\nCHỈ DẪN TRẢ LỜI SO SÁNH / ĐỐI CHIẾU: Phân tích rõ ràng các điểm tương đồng, dị biệt, bối cảnh lịch sử và ý nghĩa của từng đối tượng được đối chiếu.`;
  }

  const premiseDirectiveText = (premiseAnalysis.suggestedDirective
    ? `CHỈ DẪN KIỂM CHỨNG TIỀN ĐỀ ĐẶC THÙ:\n${premiseAnalysis.suggestedDirective}\n\n`
    : '') + unmappedDirectiveText + subIntentDirective + (ragFallbackDirective ? `\n\n${ragFallbackDirective}` : '');

  const contextSections: string[] = [];
  if (premiseDirectiveText.trim()) {
    contextSections.push(`<premise_directives>\n${premiseDirectiveText.trim()}\n</premise_directives>`);
  }
  contextSections.push(`<verified_rag_evidence>\n${pruneRagContext(contextSnippets || 'Không có dữ liệu RAG bổ sung')}\n</verified_rag_evidence>`);
  if (triplesText.trim()) {
    contextSections.push(`<knowledge_graph_triples>\n${triplesText}\n</knowledge_graph_triples>`);
  }

  const safeQuery = escapePromptXml(query);
  const userTurnWithContext = `<historical_context>\n${contextSections.join('\n\n')}\n</historical_context>\n\n<user_query>\n${safeQuery}\n</user_query>`;

  const rawMessages: ChatMessage[] = [
    { role: 'system', content: STATIC_SYSTEM_PERSONA_PROMPT },
    ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userTurnWithContext },
  ];
  const messages = clampTotalPromptMessages(rawMessages, 5000);

  let fullResponse = '';
  const loopDetector = createStreamLoopDetector();

  if (isRagFallback) {
    const disclaimer = `> ⚠️ **Lưu ý:** *Hệ thống tra cứu sử liệu chuyên sâu (Chrono-RAG) đang phản hồi chậm hoặc tạm gián đoạn. Phản hồi dưới đây dựa trên tri thức đại cương, vui lòng đối chiếu lại với chính sử.*\n\n`;
    yield { type: 'token', content: disclaimer };
    fullResponse += disclaimer;
  }

  try {
    for await (const chunk of generateLLMCompletionStream(messages, {
      temperature: 0.15,
      top_p: 0.85,
      frequency_penalty: 0.4,
      presence_penalty: 0.2,
      max_tokens: 1500,
    })) {
      if (signal?.aborted) {
        yield { type: 'error', error: 'Yêu cầu đã bị hủy trong quá trình sinh phản hồi' };
        return;
      }

      const loopCheck = loopDetector.processChunk(chunk);
      if (loopCheck.shouldTerminate) {
        log.warn('chat.repetition_loop_detected_break', 'Repetition loop detected in stream, breaking early');
        break;
      }

      if (loopCheck.shouldEmit && loopCheck.cleanChunk) {
        fullResponse += loopCheck.cleanChunk;
        yield { type: 'token', content: loopCheck.cleanChunk };
      }
    }
  } catch (llmErr: any) {
    log.error('chat.llm_streaming_error', `LLM Stream error: ${llmErr.message}`);
    if (contextSnippets) {
      const fallbackSummary = `⚠️ Trợ lý AI đang tải cao hoặc gặp sự cố kết nối. Trích xuất sử liệu nhanh từ Chrono-RAG:\n\n${pruneRagContext(contextSnippets, 350)}`;
      fullResponse = fallbackSummary;
      yield { type: 'token', content: fallbackSummary };
    } else {
      yield { type: 'error', error: 'Không thể kết nối đến mô hình AI: ' + llmErr.message };
      return;
    }
  }

  // Deduplicate any repeated blocks in the accumulated response
  fullResponse = deduplicateRepetitiveText(fullResponse);

  // 7. Guardrails Verification: Folklore Check
  if (isFolkloreSource && fullResponse.trim()) {
    const folkloreCheck = validateFolkloreHypothesisTone(fullResponse, true);
    if (!folkloreCheck.isValid) {
      log.warn('chat.folklore_guardrail_triggered', 'Chat response did not meet folklore tone requirement');
    }
  }

  log.info('chat.supervisor_completed', `Chat stream finished (${Date.now() - startTime}ms)`, {
    conversationId,
    tokenLength: fullResponse.length,
  });

  yield {
    type: 'done',
    content: fullResponse,
    citations: verifiedCitations,
    triples: graphTriples,
    conversationId,
  };
}

export async function executeChatQuery(
  request: ChatSupervisorRequest
): Promise<ChatExecutionResult> {
  let fullText = '';
  let citations: (string | HistoricalCitationItem)[] = [];
  let triples: GraphTripleItem[] = [];
  let intent: ChatIntent = 'HISTORICAL_QUERY';

  for await (const chunk of handleChatQueryStream(request)) {
    if (chunk.type === 'token' && chunk.content) {
      fullText += chunk.content;
    } else if (chunk.type === 'citation' && chunk.citations) {
      citations = chunk.citations;
    } else if (chunk.type === 'triples' && chunk.triples) {
      triples = chunk.triples;
    } else if (chunk.type === 'intent' && chunk.intent) {
      intent = chunk.intent as ChatIntent;
    }
  }

  return {
    fullText,
    intent,
    citations,
    triples,
    conversationId: request.conversationId,
  };
}
