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
  HISTORICAL_PERSON_DICTIONARY,
  resolveCanonicalEntity,
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
import { rewriteMultiTurnQuery, extractDialogueState, ChatTurnContext } from './query-rewriter.js';
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
  return text.replace(/<\/?(?:historical_context|user_query|premise_directives|verified_rag_evidence|knowledge_graph_triples|verified_master_entities|dialogue_context_banner)[^>]*>/gi, '');
}

export function buildDynamicEntityKnowledgeCards(entityNamesOrIds: string[]): string {
  const cards: string[] = [];
  const seen = new Set<string>();

  for (const item of entityNamesOrIds) {
    if (!item || item.trim().length <= 2) continue;
    const clean = item.trim();
    const resolved = resolveCanonicalEntity(clean);
    const entId = resolved.entityId;
    const person = entId ? HISTORICAL_PERSON_DICTIONARY[entId] : undefined;

    const matchedPerson =
      person ||
      Object.values(HISTORICAL_PERSON_DICTIONARY).find(
        (p) =>
          p.canonicalName.toLowerCase() === clean.toLowerCase() ||
          p.aliases?.some((a) => a.toLowerCase() === clean.toLowerCase())
      );

    const target = matchedPerson || (resolved.entityId && !resolved.entityId.startsWith('ent_') ? resolved : undefined);
    if (!target) continue;

    if (!seen.has(target.entityId)) {
      seen.add(target.entityId);
      const lines: string[] = [];
      const label =
        target.type === 'DOCUMENT_CULTURE'
          ? 'Văn kiện / Tác phẩm'
          : target.type === 'LOCATION'
          ? 'Địa danh lịch sử'
          : target.type === 'EVENT_BATTLE'
          ? 'Sự kiện / Chiến dịch'
          : target.type === 'DYNASTY_ERA'
          ? 'Triều đại / Thời kỳ'
          : 'Nhân vật lịch sử';

      lines.push(`- ${label}: ${target.canonicalName}`);
      if (target.aliases && target.aliases.length > 0) {
        lines.push(`  + Danh xưng / Tên gọi khác: ${target.aliases.slice(0, 6).join(', ')}`);
      }
      if (target.dynasty) {
        lines.push(`  + Triều đại: ${target.dynasty}`);
      }
      if (target.timeRange && target.timeRange.start != null && target.timeRange.end != null) {
        const start = target.timeRange.start;
        const end = target.timeRange.end;
        const startStr = start < 0 ? `${Math.abs(start)} TCN` : `${start} SCN`;
        const endStr = end < 0 ? `${Math.abs(end)} TCN` : `${end} SCN`;
        lines.push(`  + Niên đại chính sử: ${startStr} - ${endStr}`);
        if (start > 0) {
          lines.push(`  + Kỷ nguyên: Sau Công Nguyên (SCN / Dương lịch), TUYỆT ĐỐI KHÔNG ghi nhầm thành TCN.`);
        }
      }
      cards.push(lines.join('\n'));
    }
  }

  if (cards.length === 0) return '';
  return `THẺ TRI THỨC LỊCH SỬ CHÍNH SỬ (GROUND TRUTH ENTITY CARDS):\n${cards.join('\n\n')}`;
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
1. NGUYÊN TẮC TOÀN DIỆN LỊCH SỬ & RÀNG BUỘC SỬ LIỆU TUYỆT ĐỐI (STRICT IN-CONTEXT GROUNDING):
   - Mọi mốc thời gian (niên đại chính xác), địa danh, kinh đô, nhân vật, tác phẩm và diễn biến cốt lõi BẮT BUỘC phải trích xuất và đối chiếu trực tiếp từ phần <verified_master_entities>, <verified_rag_evidence> và <knowledge_graph_triples>.
   - Đối với các triều đại ngoại bang phương Bắc xâm lược: Nêu chính xác triều đại cụ thể (Ví dụ: nhà Đông Hán, nhà Đường, nhà Tống, nhà Nguyên/Mông Cổ, nhà Minh, nhà Thanh), không gọi chung chung là "nhà Hán" nếu ngữ cảnh xác định rõ là Đông Hán.
   - Các năm lịch sử từ năm 1 trở đi thuộc kỷ nguyên Sau Công Nguyên (SCN / năm dương lịch), TUYỆT ĐỐI KHÔNG thêm "TCN" vào các sự kiện sau Công Nguyên (ví dụ: Khởi nghĩa Hai Bà Trưng năm 40 là năm 40 SCN).
   - TUYỆT ĐỐI KHÔNG tự suy đoán, bịa đặt tên tuổi tướng lĩnh hoặc nhân vật không có trong sử liệu được cung cấp. Nếu ngữ cảnh thiếu thông tin chi tiết, BẮT BUỘC phải thông báo khách quan: "Sử liệu hiện có trong hệ thống chưa ghi nhận chi tiết này".
   - Luôn trích dẫn danh xưng chính thức, tên tác phẩm cụ thể, áng văn hoặc văn kiện lịch sử xuất hiện trong ngữ cảnh thay vì dùng từ ngữ khái quát ("ông ấy", "văn bản này").
   - Khi giải thích các áng văn kiện, chiếu cáo, lời thề xuất quân, hoặc bối cảnh địa thế/nguyên nhân sự kiện (như Chiếu dời đô, Lời thề Mê Linh, Hịch tướng sĩ, Bình Ngô đại cáo, v.v.): BẮT BUỘC trích dẫn các câu chữ, hình tượng kinh điển trong nguyên tác xuất hiện ở sử liệu (ví dụ: "rồng cuộn hổ ngồi", "Một xin rửa sạch nước thù...", "việc nhân nghĩa cốt ở yên dân"...) thay vì chỉ tóm tắt thuần túy.
   - Khi trình bày về một vụ án, biến cố hoặc bi kịch lịch sử: Luôn nêu đầy đủ cả nguyên nhân trực tiếp (nạn nhân, người bị liên đới, vị vua trị vì bấy giờ) và hậu quả / việc minh oan sau này dựa trên sử liệu.
   - Khi trình bày về trận đánh, chiến dịch hoặc cuộc kháng chiến: Trình bày mạch lạc bối cảnh, tướng lĩnh chủ chốt hai bên được ghi chép trong sử liệu, diễn biến chính, kế sách quân sự và ý nghĩa bước ngoặt lịch sử.

2. QUY TẮC ĐỒNG NHẤT DANH XƯNG & THÂN TỘC PHONG KIẾN (NOMENCLATURE & ROYALTY INVARIANT):
   - Trong lịch sử phong kiến Việt Nam, một nhân vật thường có nhiều tên gọi (tên húy/tên khai sinh, miếu hiệu, niên hiệu, tôn hiệu, tước vị). 
   - Khi câu hỏi đề cập các danh xưng của CÙNG MỘT NGƯỜI, BẮT BUỘC phải khẳng định ngay ở câu mở đầu rằng đây là cùng một nhân vật lịch sử (Ví dụ: Vua [Miếu hiệu] tên húy là [Tên húy]). Tuyệt đối không tách thành hai người riêng biệt hoặc mô tả như hai nhân vật có quan hệ huyết thống với nhau.
   - CHỈ ĐƯỢC PHÉP ghi tên húy nếu tên đó xuất hiện trực tiếp trong sử liệu xác thực. Nếu không có tên húy trong ngữ cảnh, dùng miếu hiệu/danh xưng chính thức.
   - Khi sử liệu ghi miếu hiệu vắn tắt (như Thái Tông, Thánh Tông, Nhân Tông, Anh Tông...), BẮT BUỘC đối chiếu cẩn trọng với mốc thời gian (năm xảy ra sự kiện) và thứ tự trị vì trong văn bản để xác định đúng vị vua, TUYỆT ĐỐI KHÔNG nhầm lẫn giữa các vị vua kế tiếp nhau trong cùng triều đại (ví dụ: Lê Thái Tổ -> Lê Thái Tông mất năm 1442 tại Lệ Chi Viên -> Lê Nhân Tông -> Lê Nghi Dân -> Lê Thánh Tông lên ngôi năm 1460 và giải oan cho Nguyễn Trãi năm 1464).

3. QUY TẮC PHẢN BIỆN TIỀN ĐỀ SAI (UNIVERSAL ANTI-SYCOPHANCY & HISTORICAL REFUTATION):
   - Nếu câu hỏi chứa tiền đề sai lệch (sai niên đại, gán nhầm sự kiện/địa bàn, gán sai chiến công hoặc đưa công nghệ/vũ khí/khái niệm hiện đại vào thời kỳ phong kiến/cổ đại), bạn BẮT BUỘC phải bác bỏ rõ ràng NGAY Ở CÂU ĐẦU TIÊN (Ví dụ: "Không, vào thời kỳ [X] hoàn toàn chưa có [Y]...", "Không, thông tin này không chính xác..."). Đồng thời đính chính rõ sự thật lịch sử dựa trên sử liệu.
   - TUYỆT ĐỐI KHÔNG xu nịnh hoặc đồng tình ("Đúng rồi", "Đúng vậy") với tiền đề sai của người dùng.
   - Khi một nhân vật hoặc tên gọi KHÔNG CÓ trong chính sử Việt Nam (hoặc hư cấu, không xác định), BẮT BUỘC phải nói rõ: "Trong chính sử không có ghi chép về nhân vật mang tên [X]" thay vì suy đoán.

4. NGUYÊN TẮC BỐI CẢNH LỊCH SỬ & CHỐNG SUY DIỄN PHI THỜI ĐẠI (HISTORIOGRAPHICAL CONTEXT & ANTI-ANACHRONISM):
   - Mọi lý giải về nhân khẩu học, sự phân bố dòng họ, thứ bậc xã hội và phong tục tập quán cổ truyền BẮT BUỘC phải dựa trên hệ quy chiếu chế độ phong kiến Nho giáo (các biến cố đổi họ lánh nạn, kiêng húy, ban quốc tính, hoặc sổ đinh hộ tịch). Tuyệt đối không áp dụng tư duy tự do cá nhân hoặc góc nhìn đạo đức hiện đại.
   - Đối với tư liệu truyền thuyết hoặc dã sử (LEVEL_3): BẮT BUỘC dùng từ ngữ giả định: 'theo truyền thuyết', 'tương truyền', 'dân gian kể rằng'.

5. NGUYÊN TẮC TRÌNH BÀY & CHỐNG LẶP LẠI (PRESENTATION INTEGRITY):
   - Trình bày rõ ràng, mạch lạc với định dạng Markdown (tiêu đề, danh sách, in đậm từ khóa quan trọng).
   - TUYỆT ĐỐI KHÔNG lặp lại nguyên văn các câu, đoạn văn hoặc danh sách đã trình bày trong cùng một câu trả lời.`;

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

  // 5. Entity Identity Fast Path (< 1ms with Primary Citations)
  if (classification.intent === 'ENTITY_IDENTITY') {
    const canonicalName = classification.matchedCanonicalName || query;
    const fastMsg = classification.fastPathResponse;
    if (fastMsg) {
      const citations = [
        `${canonicalName} [Nguồn: LEVEL_1]`,
        'Đại Việt Sử Ký Toàn Thư [Nguồn: LEVEL_1]',
        'Đại Nam Thực Lục [Nguồn: LEVEL_1]',
      ];
      yield { type: 'citation', citations };
      yield { type: 'token', content: fastMsg };
      yield {
        type: 'done',
        content: fastMsg,
        citations,
        conversationId,
      };
      return;
    }
  }

  // 6. Premise Analysis, Dialogue State Tracking & Query Rewriting
  const premiseAnalysis = analyzePremiseAndLeadingIntent(query);
  const dialogueState = extractDialogueState(history, query);
  let searchTopic = query;
  if (history.length > 0) {
    searchTopic = rewriteMultiTurnQuery(query, history, dialogueState);
  }

  const entitiesToFilter = Array.from(new Set([
    ...premiseAnalysis.detectedEntities,
    ...(dialogueState.primaryEntity ? [dialogueState.primaryEntity] : []),
    ...dialogueState.veneratedEntities,
    ...dialogueState.adversaryEntities,
    ...dialogueState.activeDocuments,
    ...dialogueState.activeLocations,
  ]));

  const resolvedFilterIds = entitiesToFilter
    .map((e) => resolveCanonicalEntity(e).entityId)
    .filter((id): id is string => Boolean(id) && !id.startsWith('ent_'));

  // 7. Deep Chrono-RAG Search with Graph Triples
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
        rerankTopK: classification.subIntent === 'FACTOID_LOOKUP' ? 4 : 5,
        maxTokens: 3200,
        entityFilter: resolvedFilterIds.length > 0 ? resolvedFilterIds : undefined,
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
      .map((v: any) => {
        const cleanSummary = (v.summary || '').replace(/^(?:\[[^\]\n]+\]\s*)+/gu, '').trim();
        return `### ${v.canonicalName}\n${cleanSummary}\n(Nguồn: ${v.citations.join(', ')})`;
      })
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
  if (premiseAnalysis.isSameEntityCoReference) {
    subIntentDirective = `\n\nCHỈ DẪN ĐỒNG NHẤT DANH XƯNG & TIỂU SỬ: Trình bày rõ ràng các giai đoạn lịch sử của nhân vật theo thứ tự thời gian từ tên khai sinh/tên húy, tước vị, đến niên hiệu khi lên ngôi. TUYỆT ĐỐI KHÔNG mô tả 2 danh xưng như hai cá nhân riêng biệt có quan hệ huyết thống với nhau.`;
  } else if (classification.subIntent === 'GENEALOGY_RELATION') {
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
  if (dialogueState.contextBanner) {
    contextSections.push(`<dialogue_context_banner>\n${dialogueState.contextBanner}\n</dialogue_context_banner>`);
  }
  const entitiesToLookup = Array.from(new Set([
    ...premiseAnalysis.detectedEntities,
    ...(dialogueState.primaryEntity ? [dialogueState.primaryEntity] : []),
    ...dialogueState.veneratedEntities,
    ...dialogueState.adversaryEntities,
    ...dialogueState.activeDocuments,
    ...dialogueState.activeLocations,
  ]));
  const dynamicEntityCards = buildDynamicEntityKnowledgeCards(entitiesToLookup);
  if (dynamicEntityCards.trim()) {
    contextSections.push(`<verified_master_entities>\n${dynamicEntityCards}\n</verified_master_entities>`);
  }
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
      temperature: 0.2,
      top_p: 0.9,
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
