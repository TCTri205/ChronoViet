/**
 * ChronoViet Chat Supervisor & Stream Coordinator
 * Coordinates Multi-tier Intent Routing, Multi-turn Query Rewriting, Graph Triples Injection,
 * Folklore & Citation Guardrails, and SSE Realtime Streaming.
 */

import {
  IRagEngine,
  ChatStreamResponse,
  createLogger,
  generateLLMCompletionStream,
  ChatMessage,
  GraphTripleItem,
  HistoricalCitationItem,
  envConfig,
  ragTimeoutsTotal,
} from '@chronoviet/shared-spec';
import { ChronoRagEngine } from '@chronoviet/rag-engine';
import { classifyChatIntent, ChatIntent } from './intent-classifier.js';
import { rewriteMultiTurnQuery, ChatTurnContext } from './query-rewriter.js';
import { pruneConversationHistory, pruneRagContext } from './context-pruner.js';
import { validateFolkloreHypothesisTone } from '../guardrails/folklore-validator.js';
import { analyzePremiseAndLeadingIntent } from '../guardrails/anti-sycophancy.js';
import { createStreamLoopDetector, deduplicateRepetitiveText } from '../guardrails/stream-dedup.js';

const log = createLogger({ service: 'agent-orchestrator' });

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

  // 2. Chitchat Fast Path
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

  // 3. Video Creation Fast Path
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

  const ragTimeoutMs = envConfig.RAG_SEARCH_TIMEOUT_MS || 10000;
  try {
    const ragResponse = await Promise.race([
      engine.search({
        query: searchTopic,
        rerankTopK: 4,
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
  } catch (ragErr: any) {
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
  const triplesText =
    graphTriples.length > 0
      ? graphTriples.map((t) => `- ${t.source} [${t.relation}] -> ${t.target}`).join('\n')
      : 'Không có quan hệ thực thể đặc thù.';

  const premiseAnalysis = analyzePremiseAndLeadingIntent(query);
  const premiseDirectiveText = premiseAnalysis.suggestedDirective
    ? `\n\nCHỈ DẪN KIỂM CHỨNG TIỀN ĐỀ ĐẶC THÙ:\n${premiseAnalysis.suggestedDirective}`
    : '';

  const systemPrompt = `Bạn là ChronoViet AI — Chuyên gia Nghiên cứu Lịch sử Việt Nam chuẩn mực, thông thái và khách quan.

NGUYÊN TẮC BẮT BUỘC:
1. Trả lời chi tiết, sinh động, chuẩn xác tuyệt đối theo chính sử Việt Nam (Đại Việt Sử Ký Toàn Thư, Khâm Định Việt Sử Thông Giám Cương Mục, Lam Sơn Thực Lục...).
2. KIỂM TRA TIỀN ĐỀ CÂU HỎI (ANTI-SYCOPHANCY):
   - Nếu câu hỏi của người dùng chứa tiền đề sai lệch (ví dụ: gán sai quan hệ anh em/cha con/vợ chồng, gán sai triều đại, đảo lộn niên đại, gán chiến công cho sai nhân vật), bạn BẮT BUỘC phải bác bỏ và đính chính rõ ràng ngay ở câu đầu tiên (ví dụ: "Không, [A] và [B] không phải là anh em...", "Theo chính sử, thông tin này không chính xác...").
   - TUYỆT ĐỐI KHÔNG xu nịnh hoặc đồng tình ("Đúng rồi", "Đúng vậy") với tiền đề sai của người dùng rồi tự bịa đặt câu chuyện để hợp thức hóa tiền đề đó.
3. KHÔNG TỰ BỊA ĐẶT THÂN TỘC & SỰ KIỆN (ZERO KINSHIP HALLUCINATION):
   - Tuyệt đối không tự suy diễn hoặc bịa đặt họ tên thân phụ, anh em, niên hiệu hoặc triều đại không có trong sử liệu.
   - Nếu một nhân vật hoặc mối quan hệ không có ghi chép trong chính sử, hãy nêu rõ "Không có ghi chép chính sử" thay vì suy đoán.
4. Đối với tư liệu truyền thuyết hoặc dã sử (LEVEL_3): BẮT BUỘC dùng từ ngữ giả thuyết: 'theo truyền thuyết', 'tương truyền', 'dân gian kể rằng'.
5. Nêu rõ niên đại, nhân vật, bối cảnh và ý nghĩa lịch sử.
6. Trình bày đẹp mắt với định dạng Markdown (tiêu đề, danh sách, in đậm từ khóa quan trọng).
7. TUYỆT ĐỐI KHÔNG LẶP LẠI: Không lặp lại nguyên văn các câu, đoạn văn hoặc danh sách đã trình bày trong cùng một câu trả lời.${premiseDirectiveText}

DỮ LIỆU SỬ LIỆU XÁC THỰC:
${pruneRagContext(contextSnippets || 'Không có dữ liệu RAG bổ sung')}

QUAN HỆ THỰC THỂ (GRAPH TRIPLES):
${triplesText}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: query },
  ];

  let fullResponse = '';
  const loopDetector = createStreamLoopDetector();

  try {
    for await (const chunk of generateLLMCompletionStream(messages, {
      temperature: 0.2,
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
      const fallbackSummary = `Theo các tư liệu lịch sử được ghi nhận trong cơ sở dữ liệu ChronoViet:\n\n${contextSnippets.slice(0, 500)}`;
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
