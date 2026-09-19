/**
 * ChronoViet Chat Supervisor & Stream Coordinator
 * Coordinates Multi-tier Intent Routing, Multi-turn Query Rewriting, Graph Triples Injection,
 * Folklore & Citation Guardrails, and SSE Realtime Streaming.
 */

import {
  IRagEngine,
  ChatStreamResponse,
  GroundedClaimItem,
  GraphTripleItem,
  HistoricalCitationItem,
  isKnownMasterEntity,
  resolveCanonicalEntity,
  VisualAnchorSuggestion,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  generateLLMCompletion,
  generateLLMCompletionStream,
  ChatMessage,
  envConfig,
  ragTimeoutsTotal,
  parseLlmJsonCompletion,
  repairJsonUnescapedQuotes,
} from '@chronoviet/infra';
import { ChronoRagEngine, groundClaims, ChunkInfo } from '@chronoviet/rag-engine';
import {
  classifyChatIntent,
  ChatIntent,
  IntentClassificationResult,
  hasHistoricalDomainSignals,
  SUBSTANTIVE_QUESTION_REGEX,
} from './intent-classifier.js';
import {
  rewriteMultiTurnQuery,
  extractDialogueState,
  isContinuationOrCoreferenceQuery,
  isTopicShiftQuery,
  ChatTurnContext,
} from './query-rewriter.js';
import {
  pruneConversationHistory,
  pruneRagContext,
  pruneGraphTriples,
  clampTotalPromptMessages,
} from './context-pruner.js';
import { validateFolkloreHypothesisTone } from '../guardrails/folklore-validator.js';
import { analyzePremiseAndLeadingIntent, verifyCoReferenceInvariant } from '../guardrails/anti-sycophancy.js';
import {
  createStreamLoopDetector,
  deduplicateRepetitiveText,
  sanitizePromptDirectivesLeakage,
  normalizeMarkdownListBreaks,
} from '../guardrails/stream-dedup.js';
import { normalizeResilientText } from './text-normalizer.js';
import { buildChronologyAnchorBox } from './chronology-anchors.js';
import {
  escapePromptXml,
  buildDynamicEntityKnowledgeCards,
  STATIC_SYSTEM_PERSONA_PROMPT,
} from './prompt-builder.js';

// Re-export chronology and prompt builder helpers for complete backward compatibility
export { buildChronologyAnchorBox } from './chronology-anchors.js';
export {
  escapePromptXml,
  buildDynamicEntityKnowledgeCards,
  STATIC_SYSTEM_PERSONA_PROMPT,
} from './prompt-builder.js';

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
  claims?: GroundedClaimItem[];
  visualAnchors?: VisualAnchorSuggestion[];
  faithfulnessScore?: number;
  citationCorrectnessScore?: number;
  isLowConfidence?: boolean;
  conversationId?: string;
}

/**
 * Tier 2 Speculative Semantic Arbiter using the primary local model (Qwen 3.5 9B).
 * Only invoked for ambiguous queries where Tier 1 linguistic heuristic tagged needsSemanticArbitration: true.
 * Evaluates semantic domain, extracts implicit or fake entities, and refines sub-intent.
 * Guaranteed fast execution (< 4.5s timeout) with fail-safe fallback to RAG.
 */
async function arbitrateAmbiguousQueryWithLLM(
  query: string,
  classification: IntentClassificationResult,
  signal?: AbortSignal,
  recentHistoryContext?: string
): Promise<IntentClassificationResult> {
  const arbiterStartTime = Date.now();
  try {
    const historyBlock = recentHistoryContext
      ? `\nNgữ cảnh hội thoại trước đó:\n${recentHistoryContext}\n`
      : '';
    const prompt = `Bạn là bộ phân loại ý định ngữ nghĩa cho hệ thống ChronoViet AI (Trợ lý Lịch sử Việt Nam).
Phân tích câu truy vấn sau của người dùng và trả về DUY NHẤT một JSON hợp lệ:
Câu truy vấn: "${query}"${historyBlock}

Yêu cầu phân loại:
1. is_historical: true nếu câu hỏi liên quan đến lịch sử Việt Nam, nhân vật, sự kiện, triều đại, thân tộc; false nếu là trò chuyện thông thường hoặc ngoài phạm vi.
2. intent: "HISTORICAL_QUERY" | "CHITCHAT" | "OUT_OF_DOMAIN" | "VIDEO_INTENT".
3. sub_intent: "GENEALOGY_RELATION" | "FACTOID_LOOKUP" | "BATTLE_TACTICS" | "GENERAL_OVERVIEW".
4. suspected_fake_or_unverified_entities: danh sách nhân vật hư cấu hoặc chưa xác thực (nếu có).
5. verified_or_implicit_entities: danh sách nhân vật có thật hoặc ngầm định.

Định dạng JSON bắt buộc:
{
  "is_historical": boolean,
  "intent": "HISTORICAL_QUERY" | "CHITCHAT" | "OUT_OF_DOMAIN",
  "sub_intent": "GENEALOGY_RELATION" | "FACTOID_LOOKUP" | "BATTLE_TACTICS" | "GENERAL_OVERVIEW",
  "suspected_fake_or_unverified_entities": string[],
  "verified_or_implicit_entities": string[]
}`;

    const res = await generateLLMCompletion(
      [{ role: 'user', content: prompt }],
      {
        task: 'general', // Routes to Primary LLM (Qwen 3.5 9B, Port 8092)
        temperature: 0.1,
        max_tokens: 200,
        timeoutMs: 6500,
      }
    );

    const raw = res.content.trim();
    const repaired = repairJsonUnescapedQuotes(raw);
    const parsed = parseLlmJsonCompletion<any>(repaired);

    if (parsed && typeof parsed === 'object') {
      log.info('chat.arbiter_success', `Tier 2 Arbiter completed in ${Date.now() - arbiterStartTime}ms`, {
        is_historical: parsed.is_historical,
        intent: parsed.intent,
        suspectedFake: parsed.suspected_fake_or_unverified_entities,
      });

      const updatedIntent: ChatIntent =
        parsed.intent === 'CHITCHAT' || parsed.intent === 'OUT_OF_DOMAIN' || parsed.intent === 'VIDEO_INTENT'
          ? parsed.intent
          : parsed.is_historical === false
          ? 'CHITCHAT'
          : 'HISTORICAL_QUERY';

      return {
        ...classification,
        intent: updatedIntent,
        subIntent: parsed.sub_intent || classification.subIntent,
        needsSemanticArbitration: false,
        arbitratedFakeEntities: Array.isArray(parsed.suspected_fake_or_unverified_entities)
          ? parsed.suspected_fake_or_unverified_entities
          : [],
        arbitratedEntities: Array.isArray(parsed.verified_or_implicit_entities)
          ? parsed.verified_or_implicit_entities
          : [],
      };
    }
  } catch (err: any) {
    log.warn('chat.arbiter_fallback', `Tier 2 Arbiter timed out or failed (${err.message}). Safe fallback to RAG.`, {
      latencyMs: Date.now() - arbiterStartTime,
    });
  }

  // Fail-safe to RAG
  return {
    ...classification,
    needsSemanticArbitration: false,
  };
}

export async function* handleChatQueryStream(
  request: ChatSupervisorRequest
): AsyncGenerator<ChatStreamResponse> {
  const { query, conversationId, history = [], signal, ragEngine } = request;
  const startTime = Date.now();

  const { normalized: normalizedQuery } = normalizeResilientText(query);
  const effectiveQuery = normalizedQuery.trim() || query.trim();

  log.info('chat.supervisor_started', `Chat query received: "${effectiveQuery.slice(0, 50)}..."`, {
    conversationId,
    historyTurns: history.length,
  });

  if (signal?.aborted) {
    yield { type: 'error', error: 'Yêu cầu đã bị hủy bởi người dùng' };
    return;
  }

  const prunedHistory = pruneConversationHistory(history);

  // 1. Intent Classification (< 1ms)
  let classification = classifyChatIntent(effectiveQuery);

  // Multi-turn Continuation Guard: If classified as CHITCHAT but is a follow-up continuation
  // with existing conversation history, elevate it to HISTORICAL_QUERY.
  if (
    classification.intent === 'CHITCHAT' &&
    history.length > 0 &&
    isContinuationOrCoreferenceQuery(effectiveQuery)
  ) {
    classification.intent = 'HISTORICAL_QUERY';
    classification.subIntent = classification.subIntent || 'GENERAL_OVERVIEW';
  }

  // Multi-turn Fast-Path Co-reference: If query is flagged for semantic arbitration
  // but is a clear follow-up continuation with conversation history, fast-path to HISTORICAL_QUERY
  // and resolve anaphora deterministically via Dialogue State Tracking instead of blocking on Tier 2 LLM Arbiter.
  if (
    classification.needsSemanticArbitration &&
    history.length > 0 &&
    isContinuationOrCoreferenceQuery(effectiveQuery)
  ) {
    classification.needsSemanticArbitration = false;
    classification.intent = 'HISTORICAL_QUERY';
    classification.subIntent = classification.subIntent || 'GENERAL_OVERVIEW';
  }

  // Tier 2 Speculative Semantic Arbiter (Single Qwen 3.5 9B instance on Port 8092)
  if (classification.needsSemanticArbitration && !signal?.aborted) {
    const recentHistoryText = history.length > 0
      ? history.slice(-2).map((t) => `${t.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${t.content.slice(0, 150)}`).join('\n')
      : undefined;
    classification = await arbitrateAmbiguousQueryWithLLM(effectiveQuery, classification, signal, recentHistoryText);
  }

  const compositeIntents = classification.compositeResult?.clauses.map((c) => c.intent) || [classification.intent];
  yield {
    type: 'intent',
    intent: classification.intent,
    content: classification.suggestedTopic || classification.matchedCanonicalName,
    compositeIntents,
    videoHandover: classification.videoHandover,
  };

  // 2. Out-of-Domain Route -> LLM Direct Persona Stream
  if (classification.intent === 'OUT_OF_DOMAIN') {
    log.info('chat.out_of_domain_llm', `Handling out-of-domain query via LLM: "${effectiveQuery.slice(0, 50)}"`, {
      conversationId,
    });

    const rawMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `${STATIC_SYSTEM_PERSONA_PROMPT}\n\nLƯU Ý QUAN TRỌNG: Câu hỏi này nằm ngoài phạm vi tri thức Lịch sử Việt Nam (ẩm thực thông thường, đầu tư tài chính/chứng khoán, lập trình công nghệ, v.v.). Hãy lịch sự, từ tốn từ chối trả lời nội dung ngoài phạm vi này theo đúng tư cách Trợ lý ChronoViet, đồng thời gợi ý người dùng các chủ đề lịch sử Việt Nam hấp dẫn có thể khám phá.`,
      },
      ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: effectiveQuery },
    ];
    const messages = clampTotalPromptMessages(rawMessages, 4000);

    let fullResponse = '';
    const loopDetector = createStreamLoopDetector();

    try {
      for await (const chunk of generateLLMCompletionStream(messages, {
        temperature: 0.35,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
        max_tokens: 800,
      })) {
        if (signal?.aborted) {
          yield { type: 'error', error: 'Yêu cầu đã bị hủy trong quá trình sinh phản hồi' };
          return;
        }

        const loopCheck = loopDetector.processChunk(chunk);
        if (loopCheck.shouldTerminate) break;
        if (loopCheck.shouldEmit && loopCheck.cleanChunk) {
          fullResponse += loopCheck.cleanChunk;
          yield { type: 'token', content: loopCheck.cleanChunk };
        }
      }
    } catch (llmErr: any) {
      log.error('chat.ood_llm_error', `LLM Stream error in out-of-domain mode: ${llmErr.message}`);
      const fallback = 'Xin lỗi bạn, tôi là ChronoViet AI — Trợ lý chuyên sâu về Nghiên cứu Lịch sử Việt Nam. Yêu cầu này nằm ngoài phạm vi tri thức lịch sử của hệ thống. Bạn có thể hỏi tôi về các triều đại, nhân vật, sự kiện hoặc trận đánh lịch sử Việt Nam!';
      yield { type: 'token', content: fallback };
      fullResponse = fallback;
    }

    fullResponse = normalizeMarkdownListBreaks(deduplicateRepetitiveText(fullResponse));
    yield { type: 'citation', citations: [] };
    yield {
      type: 'done',
      content: fullResponse,
      citations: [],
      conversationId,
      videoHandover: classification.videoHandover,
    };
    return;
  }

  // 3. Chitchat & Bot Capability Routing -> Direct LLM Stream (Tier 2 - No RAG search cost)
  if (classification.intent === 'CHITCHAT') {
    log.info('chat.persona_direct_llm', `Handling conversational/persona query directly via LLM: "${effectiveQuery.slice(0, 50)}"`, {
      conversationId,
    });

    const rawMessages: ChatMessage[] = [
      { role: 'system', content: STATIC_SYSTEM_PERSONA_PROMPT },
      ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: effectiveQuery },
    ];
    const messages = clampTotalPromptMessages(rawMessages, 4000);

    let fullResponse = '';
    const loopDetector = createStreamLoopDetector();

    try {
      for await (const chunk of generateLLMCompletionStream(messages, {
        temperature: 0.35,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
        max_tokens: 1200,
      })) {
        if (signal?.aborted) {
          yield { type: 'error', error: 'Yêu cầu đã bị hủy trong quá trình sinh phản hồi' };
          return;
        }

        const loopCheck = loopDetector.processChunk(chunk);
        if (loopCheck.shouldTerminate) {
          log.warn('chat.persona_loop_break', 'Repetition loop detected in persona stream, breaking early');
          break;
        }

        if (loopCheck.shouldEmit && loopCheck.cleanChunk) {
          fullResponse += loopCheck.cleanChunk;
          yield { type: 'token', content: loopCheck.cleanChunk };
        }
      }
    } catch (llmErr: any) {
      log.error('chat.persona_llm_error', `LLM Stream error in persona mode: ${llmErr.message}`);
      const fallback = 'Tôi là ChronoViet AI — Trợ lý chuyên sâu về Lịch sử Việt Nam và Sáng tạo Video tự động. Tôi có thể hỗ trợ bạn tra cứu các triều đại, nhân vật, sự kiện lịch sử hoặc tạo video!';
      yield { type: 'token', content: fallback };
      fullResponse = fallback;
    }

    fullResponse = normalizeMarkdownListBreaks(deduplicateRepetitiveText(fullResponse));

    yield { type: 'citation', citations: [] };
    yield {
      type: 'done',
      content: fullResponse,
      citations: [],
      conversationId,
      videoHandover: classification.videoHandover,
    };
    return;
  }

  // 4. Video Creation Intent -> Direct LLM Stream (Only for pure video creation requests)
  const hasSubstantiveHistoricalContent =
    classification.compositeResult?.hasHistoricalInquiry ||
    SUBSTANTIVE_QUESTION_REGEX.test(effectiveQuery) ||
    hasHistoricalDomainSignals(effectiveQuery) ||
    Boolean(classification.matchedEntityId);

  if (classification.intent === 'VIDEO_INTENT' && !hasSubstantiveHistoricalContent) {
    const topic = classification.suggestedTopic || effectiveQuery;
    log.info('chat.video_intent_llm', `Handling video intent query via LLM: "${topic.slice(0, 50)}"`, {
      conversationId,
    });

    const rawMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `${STATIC_SYSTEM_PERSONA_PROMPT}\n\nLƯU Ý QUAN TRỌNG: Người dùng đang muốn sản xuất video lịch sử về chủ đề: "${topic}". Hãy hào hứng xác nhận chủ đề, tóm tắt nhanh 2-3 phân cảnh lịch sử tiêu biểu/kịch tính nhất của chủ đề này, và hướng dẫn người dùng nhấn nút "Tạo Video" hoặc chuyển sang tab Video Studio để bắt đầu tạo kịch bản phân cảnh và render video tự động.`,
      },
      ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: effectiveQuery },
    ];
    const messages = clampTotalPromptMessages(rawMessages, 4000);

    let fullResponse = '';
    const loopDetector = createStreamLoopDetector();

    try {
      for await (const chunk of generateLLMCompletionStream(messages, {
        temperature: 0.35,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
        max_tokens: 1000,
      })) {
        if (signal?.aborted) {
          yield { type: 'error', error: 'Yêu cầu đã bị hủy trong quá trình sinh phản hồi' };
          return;
        }

        const loopCheck = loopDetector.processChunk(chunk);
        if (loopCheck.shouldTerminate) break;
        if (loopCheck.shouldEmit && loopCheck.cleanChunk) {
          fullResponse += loopCheck.cleanChunk;
          yield { type: 'token', content: loopCheck.cleanChunk };
        }
      }
    } catch (llmErr: any) {
      log.error('chat.video_llm_error', `LLM Stream error in video intent mode: ${llmErr.message}`);
      const fallback = `Tôi đã nhận diện yêu cầu sản xuất video về chủ đề: "${topic}". Bạn có thể chuyển trực tiếp sang tab Video Studio để bắt đầu quy trình tạo video tự động.`;
      yield { type: 'token', content: fallback };
      fullResponse = fallback;
    }

    fullResponse = normalizeMarkdownListBreaks(deduplicateRepetitiveText(fullResponse));
    yield { type: 'citation', citations: [] };
    yield {
      type: 'done',
      content: fullResponse,
      citations: [],
      conversationId,
      videoHandover: classification.videoHandover,
    };
    return;
  }

  // 5. Premise Analysis, Dialogue State Tracking & Query Rewriting
  const premiseAnalysis = analyzePremiseAndLeadingIntent(effectiveQuery);

  // Ingest arbitrated fake or unverified entities into premiseAnalysis.detectedEntities
  if (classification.arbitratedFakeEntities && classification.arbitratedFakeEntities.length > 0) {
    for (const fakeEnt of classification.arbitratedFakeEntities) {
      if (!premiseAnalysis.detectedEntities.includes(fakeEnt)) {
        premiseAnalysis.detectedEntities.push(fakeEnt);
      }
    }
  }

  const dialogueState = extractDialogueState(history, effectiveQuery);
  let searchTopic = classification.cleanSearchTopic || effectiveQuery;
  if (history.length > 0) {
    searchTopic = rewriteMultiTurnQuery(searchTopic, history, dialogueState);
    if (dialogueState.primaryEntity && !classification.videoHandover?.canonicalName) {
      const canonical = dialogueState.primaryEntity;
      const resolved = resolveCanonicalEntity(canonical);
      classification.videoHandover = {
        topic: searchTopic,
        canonicalName: canonical,
        primaryEntityId: resolved?.entityId || classification.videoHandover?.primaryEntityId,
      };
    }
  }

  const currentKnownEntities = premiseAnalysis.detectedEntities.filter((e) => isKnownMasterEntity(e));
  if (
    classification.matchedCanonicalName &&
    isKnownMasterEntity(classification.matchedCanonicalName) &&
    !currentKnownEntities.includes(classification.matchedCanonicalName)
  ) {
    currentKnownEntities.push(classification.matchedCanonicalName);
  }
  if (classification.arbitratedEntities && classification.arbitratedEntities.length > 0) {
    for (const ent of classification.arbitratedEntities) {
      if (isKnownMasterEntity(ent) && !currentKnownEntities.includes(ent)) {
        currentKnownEntities.push(ent);
      }
    }
  }

  const isTopicShift = isTopicShiftQuery(effectiveQuery, history, currentKnownEntities);

  const entitiesToFilter = Array.from(new Set([
    ...premiseAnalysis.detectedEntities,
    ...(isTopicShift ? [] : (dialogueState.primaryEntity ? [dialogueState.primaryEntity] : [])),
    ...(isTopicShift ? [] : dialogueState.veneratedEntities),
    ...(isTopicShift ? [] : dialogueState.adversaryEntities),
    ...(isTopicShift ? [] : dialogueState.activeDocuments),
    ...(isTopicShift ? [] : dialogueState.activeLocations),
  ]));

  const resolvedFilterIds = entitiesToFilter
    .filter((e) => isKnownMasterEntity(e))
    .map((e) => resolveCanonicalEntity(e).entityId)
    .filter((id): id is string => Boolean(id) && !id.startsWith('ent_'));

  const hasUnresolvedEntityInMultiEntityQuery =
    premiseAnalysis.detectedEntities.length >= 2 &&
    resolvedFilterIds.length < premiseAnalysis.detectedEntities.length;

  const isBroadAnalyticalQuery =
    /(?:đánh\s+giá|toàn\s+diện|khách\s+quan|công\s+lao|hạn\s+chế|tổng\s+quan|ý\s+nghĩa|tác\s+động|chủ\s+quyền|cương\s+thổ|biển\s+đảo|quốc\s+hiệu|nguyên\s+nhân\s+sâu\s+xa|bối\s+cảnh)/i.test(
      effectiveQuery
    );

  const effectiveEntityFilter =
    hasUnresolvedEntityInMultiEntityQuery || resolvedFilterIds.length === 0 || isBroadAnalyticalQuery
      ? undefined
      : resolvedFilterIds;

  // Adaptive Budgeting for ENTITY_IDENTITY vs standard HISTORICAL_QUERY
  const isEntityIdentity = classification.intent === 'ENTITY_IDENTITY';
  const isLeanIdentity =
    isEntityIdentity &&
    (Boolean(premiseAnalysis.isSameEntityCoReference) || Boolean(classification.signals?.isCoReferenceIdentity));

  const maxRagTokens = isLeanIdentity
    ? 600
    : isEntityIdentity
    ? 1000
    : classification.subIntent === 'FACTOID_LOOKUP'
    ? 800
    : classification.subIntent === 'GENEALOGY_RELATION'
    ? 1200
    : 3000;

  const rerankTopK = isLeanIdentity
    ? 2
    : classification.subIntent === 'FACTOID_LOOKUP' || isEntityIdentity
    ? 3
    : classification.subIntent === 'GENEALOGY_RELATION'
    ? 3
    : 5;

  const maxGenerationTokens = isLeanIdentity
    ? 500
    : classification.subIntent === 'FACTOID_LOOKUP'
    ? 500
    : classification.subIntent === 'GENEALOGY_RELATION' || isEntityIdentity
    ? 750
    : isBroadAnalyticalQuery
    ? 1400
    : classification.subIntent === 'BATTLE_TACTICS'
    ? 1200
    : 1000;

  // 7. Deep Chrono-RAG Search with Graph Triples
  const engine = ragEngine || new ChronoRagEngine();
  let verifiedCitations: string[] = [];
  let graphTriples: GraphTripleItem[] = [];
  let contextSnippets = '';
  let isFolkloreSource = false;
  let isRagSystemError = false;
  let isZeroContextFound = false;
  let ragChunkList: ChunkInfo[] = [];

  const ragTimeoutMs = envConfig.RAG_SEARCH_TIMEOUT_MS || 20000;
  try {
    const ragResponse = await Promise.race([
      engine.search({
        query: searchTopic,
        subIntent: classification.subIntent,
        rerankTopK,
        maxTokens: maxRagTokens,
        entityFilter: effectiveEntityFilter,
        targetYear: dialogueState.activeTemporalYears?.[0],
      }),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('RAG search timeout')), ragTimeoutMs)
      ),
    ]);

    verifiedCitations = ragResponse.citations || [];
    graphTriples = (ragResponse.triples as GraphTripleItem[]) || [];

    ragChunkList = (ragResponse.verifiedContext || []).map((v: any) => ({
      id: v.chunkId || v.entityId || 'chunk_0',
      title: v.title || v.canonicalName || 'Sử liệu',
      content: v.textContent || v.summary || '',
      reliability: v.sourceReliability || 'LEVEL_1',
    }));

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
      isZeroContextFound = true;
      verifiedCitations = [];
    }

    if (graphTriples.length > 0) {
      yield { type: 'triples', triples: graphTriples };
    }
    if (verifiedCitations.length > 0 && !isZeroContextFound) {
      yield { type: 'citation', citations: verifiedCitations };
    } else {
      yield { type: 'citation', citations: [] };
    }
  } catch (ragErr: any) {
    isRagSystemError = true;
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
  const triplesText = pruneGraphTriples(graphTriples, 15, premiseAnalysis.detectedEntities);
  const DIAGNOSTIC_CATEGORY_LABELS = new Set([
    'Công nghệ vũ khí',
    'Gia phả tư nhân',
    'Truyền thuyết thần thoại',
    'Tiền đề hỗn hợp',
  ]);
  const unmappedEntities: string[] = [];
  if (premiseAnalysis.isLeadingQuestion || premiseAnalysis.questionType === 'KINSHIP' || premiseAnalysis.questionType === 'IDENTITY') {
    for (const ent of premiseAnalysis.detectedEntities) {
      if (DIAGNOSTIC_CATEGORY_LABELS.has(ent) || (premiseAnalysis.categoryLabel && ent === premiseAnalysis.categoryLabel)) {
        continue;
      }
      const isMaster = isKnownMasterEntity(ent);
      const foundInContext = contextSnippets.toLowerCase().includes(ent.toLowerCase());
      const foundInTriples = graphTriples.some(
        (t) => t.source.toLowerCase().includes(ent.toLowerCase()) || t.target.toLowerCase().includes(ent.toLowerCase())
      );
      if (!isMaster && !foundInContext && !foundInTriples) {
        unmappedEntities.push(ent);
      }
    }
  }

  const unmappedDirectiveText = unmappedEntities.length > 0
    ? `\n\nCẢNH BÁO THỰC THỂ NGOÀI CƠ SỞ TƯ LIỆU:
Các tên/nhân vật sau xuất hiện trong câu hỏi nhưng chưa có ghi chép trong cơ sở tư liệu tra cứu hiện tại của hệ thống: "${unmappedEntities.join('", "')}".
- Hãy nêu rõ dựa trên cơ sở dữ liệu và nguồn tư liệu tra cứu hiện tại của hệ thống, không có thông tin xác nhận về nhân vật này trong bối cảnh/thời kỳ lịch sử đang được đề cập.
- Nếu câu hỏi ghép đôi với một nhân vật lịch sử đã xác thực, hãy chủ động trình bày các nhân vật thân tộc chính thức đã được ghi chép trong sử sách (như cha mẹ, anh em ruột nếu có) để làm rõ bối cảnh và tránh trả lời cộc lốc.
- TUYỆT ĐỐI KHÔNG tự phỏng đoán nhân vật này là tên gọi khác, biệt danh hay biến thể của bất kỳ ai khác, TUYỆT ĐỐI KHÔNG tự phong vương/vua/tướng hoặc suy đoán tiểu sử hư cấu.
- TUYỆT ĐỐI KHÔNG kết luận phủ định tuyệt đối rằng nhân vật này không tồn tại trong toàn bộ lịch sử Việt Nam (vì có thể họ thuộc một thời kỳ khác như cận - hiện đại mà hệ thống chưa nạp dữ liệu), mà chỉ kết luận không có ghi chép trong bối cảnh lịch sử đang xét.`
    : '';

  const ragFallbackDirective = isRagSystemError
    ? `\n\nCHỈ DẪN KHẨN CẤP KHI KHÔNG CÓ DỮ LIỆU RAG DO SỰ CỐ KỸ THUẬT (ZERO-CONTEXT ANTI-HALLUCINATION GUARDRAILS):
- CẢNH BÁO: Hiện tại hệ thống tra cứu sử liệu Chrono-RAG tạm thời gián đoạn kỹ thuật.
- BẮT BUỘC chỉ trình bày các sự kiện, bối cảnh đại cương được giới sử học công nhận rộng rãi (ví dụ: Hội nghị Diên Hồng là do Vua Trần Nhân Tông và Thượng hoàng Trần Thánh Tông triệu tập các bô lão cả nước để hỏi kế đánh giặc, muôn người đồng thanh hô "ĐÁNH").
- TUYỆT ĐỐI KHÔNG tự suy diễn, không tự bịa đặt tên tướng lĩnh hoặc gán ghép các nhân vật Mông Cổ/ngoại quốc không có căn cứ (như Mông Kha, Mông Kha Thiếp Mộc Nhi...).
- Nếu không có tư liệu chắc chắn về một chi tiết cụ thể nào, BẮT BUỘC nêu rõ: "Cần tra cứu thêm chính sử để có thông tin chi tiết về...".`
    : isZeroContextFound
    ? `\n\nCHỈ DẪN KHI KHÔNG CÓ SỬ LIỆU PHÙ HỢP TRONG CƠ SỞ DỮ LIỆU (ZERO-CONTEXT GROUNDING):
- HỆ THỐNG ĐÃ TRA CỨU: Cơ sở dữ liệu và nguồn tư liệu hiện tại của hệ thống đã được rà soát nhưng chưa tìm thấy tài liệu hay ghi chép nào phù hợp với nhân vật/sự kiện được hỏi.
- BẮT BUỘC NÊU RÕ: Hãy thông báo rõ ràng cho người dùng rằng trong cơ sở tư liệu hiện có chưa ghi nhận thông tin này. Nếu câu hỏi liên quan đến một nhân vật lịch sử lớn, hãy cung cấp thông tin chính thống về nhân vật đó để hỗ trợ người dùng.
- TUYỆT ĐỐI KHÔNG tự suy đoán, không tự phong vương/tướng, không tự bịa đặt tiểu sử hay gán ghép vào bất kỳ triều đại nào.`
    : '';

  let subIntentDirective = '';
  if (premiseAnalysis.isSameEntityCoReference) {
    if (premiseAnalysis.questionType === 'EVENT') {
      subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Đồng nhất danh xưng trong sự kiện lịch sử - Khẳng định rõ hai tên gọi là cùng một người lịch sử, sau đó tập trung làm rõ vai trò, diễn biến và ý nghĩa của sự kiện lịch sử mà người dùng đang hỏi, không chia tách làm hai người.]`;
    } else {
      subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Đồng nhất danh xưng & tiểu sử - Trình bày rõ ràng các giai đoạn lịch sử của nhân vật theo thứ tự thời gian từ tên khai sinh/tên húy, tước vị, đến niên hiệu khi lên ngôi. TUYỆT ĐỐI KHÔNG mô tả 2 danh xưng như hai cá nhân riêng biệt có quan hệ huyết thống với nhau.]`;
    }
  } else if (classification.subIntent === 'GENEALOGY_RELATION') {
    subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Quan hệ phả hệ/thân tộc - Nêu rõ quan hệ huyết thống, cha-con, anh-em, phu-thê, nguồn gốc tông tộc hoặc biến cố đổi họ/ban quốc tính theo chính sử.]`;
  } else if (classification.subIntent === 'BATTLE_TACTICS') {
    subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Chiến thuật & trận đánh - Trình bày mạch lạc diễn biến, bài binh bố trận, kế sách quân sự (mai phục, thủy chiến, cọc ngầm, nghi binh...) và vai trò chỉ huy.]`;
  } else if (classification.subIntent === 'FACTOID_LOOKUP') {
    subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Tra cứu niên đại/sự kiện - Đi thẳng vào câu trả lời, nêu rõ mốc năm, địa danh, niên hiệu hoặc nhân vật cụ thể ngay từ đầu, sau đó tóm lược bối cảnh.]`;
  } else if (classification.subIntent === 'COMPARATIVE_SYNTHESIS') {
    subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: So sánh/đối chiếu - Phân tích rõ ràng các điểm tương đồng, dị biệt, bối cảnh lịch sử và ý nghĩa của từng đối tượng được đối chiếu.]`;
  }

  let countingDirective = '';
  if (/(?:bao\s*nhiêu|tổng\s*(?:cộng|số)|mấy\s*(?:cái|tên|người|vị|trận|lần))/i.test(effectiveQuery)) {
    countingDirective = `\n\n[QUY TẮC NỘI BỘ BẮT BUỘC: Trả lời trực diện số lượng / thống kê - Người dùng đang hỏi câu hỏi định lượng ("bao nhiêu", "tổng cộng", "mấy").
- CÂU ĐẦU TIÊN TRONG PHẢN HỒI BẮT BUỘC PHẢI TRẢ LỜI TRỰC DIỆN con số thống kê, số lượng cụ thể hoặc khoảng ước lượng tổng thể dựa trên sử liệu và thẻ tri thức đã cung cấp.
- TUYỆT ĐỐI KHÔNG bỏ qua câu hỏi số lượng để đi thẳng vào liệt kê ví dụ cụ thể.
- Sau khi khẳng định con số tổng thể, mới tiến hành liệt kê chi tiết các mốc/danh xưng/sự kiện tiêu biểu theo định dạng danh sách Markdown ngắt dòng rõ ràng.]`;
  }

  let multiIntentDirective = '';
  if (classification.signals?.hasChitchatGreeting) {
    multiIntentDirective += `\n\n[QUY TẮC NỘI BỘ: Chào hỏi kết hợp - Nếu người dùng có lời chào ở đầu câu, hãy mở đầu bằng 1 lời chào lịch thiệp ngắn gọn (1 câu), sau đó BẮT BUỘC trả lời đầy đủ câu hỏi lịch sử chính đi kèm (ví dụ: tiểu sử, sự nghiệp của nhân vật được hỏi). TUYỆT ĐỐI KHÔNG chỉ chào hỏi đơn thuần mà bỏ quên nội dung lịch sử.]`;
  }
  if (classification.signals?.hasOutOfDomainTopic && classification.outOfDomainTopic) {
    multiIntentDirective += `\n\n[QUY TẮC NỘI BỘ: Ràng buộc phạm vi - Tập trung trả lời phần lịch sử chính, đồng thời lịch sự nhắc người dùng rằng ChronoViet là hệ thống chuyên biệt về Lịch sử Việt Nam nên không hỗ trợ chi tiết các nội dung ngoài lề ("${classification.outOfDomainTopic}").]`;
  }
  if (classification.signals?.hasVideoGeneration) {
    multiIntentDirective += `\n\n[QUY TẮC NỘI BỘ: Kết hợp sản xuất video - Trình bày sự kiện lịch sử dựa trên tài liệu đã cung cấp, tóm lược mạch lạc các phân cảnh chính (nếu có) bám sát 100% sử liệu xác thực, TUYỆT ĐỐI KHÔNG tự suy đoán hay thêm thắt giai thoại chiến thuật hư cấu ngoài tài liệu, sau đó gợi ý người dùng nhấn nút "Tạo Video" hoặc chuyển sang tab Video Studio để bắt đầu tạo kịch bản phân cảnh.]`;
  }

  const premiseDirectiveText =
    (premiseAnalysis.suggestedDirective
      ? `[QUY TẮC NỘI BỘ KIỂM CHỨNG TIỀN ĐỀ ĐẶC THÙ]:\n${premiseAnalysis.suggestedDirective}\n\n`
      : '') +
    unmappedDirectiveText +
    subIntentDirective +
    countingDirective +
    multiIntentDirective +
    (ragFallbackDirective ? `\n\n${ragFallbackDirective}` : '');

  const contextSections: string[] = [];
  if (!isTopicShift && dialogueState.contextBanner) {
    contextSections.push(`<dialogue_context_banner>\n${dialogueState.contextBanner}\n</dialogue_context_banner>`);
  }
  const entitiesToLookup = Array.from(new Set([
    ...premiseAnalysis.detectedEntities,
    ...(isTopicShift ? [] : (dialogueState.primaryEntity ? [dialogueState.primaryEntity] : [])),
    ...(isTopicShift ? [] : dialogueState.veneratedEntities),
    ...(isTopicShift ? [] : dialogueState.adversaryEntities),
    ...(isTopicShift ? [] : dialogueState.activeDocuments),
    ...(isTopicShift ? [] : dialogueState.activeLocations),
  ]));

  // Chronology & Anti-Conflation Anchor Injection
  const queryYearsMatch = effectiveQuery.match(/\b(\d{3,4})\b/g);
  const activeYears = queryYearsMatch
    ? Array.from(new Set(queryYearsMatch.map((y) => parseInt(y, 10)).filter((y) => y >= 100 && y <= 2100)))
    : [];
  const chronologyAnchors = buildChronologyAnchorBox(entitiesToLookup, activeYears, effectiveQuery);
  if (chronologyAnchors.trim()) {
    contextSections.push(`<verified_chronology_anchors>\n${chronologyAnchors}\n</verified_chronology_anchors>`);
  }

  const dynamicEntityCards = buildDynamicEntityKnowledgeCards(entitiesToLookup, isBroadAnalyticalQuery);
  if (dynamicEntityCards.trim()) {
    contextSections.push(`<verified_master_entities>\n${dynamicEntityCards}\n</verified_master_entities>`);
  }
  contextSections.push(`<verified_rag_evidence>\n<!-- Chú ý: Mỗi đoạn trích bên dưới thuộc về tiêu đề nhân vật cụ thể. TUYỆT ĐỐI KHÔNG hoán đổi hoặc gán nhầm thuộc tính/tiểu sử của nhân vật này cho nhân vật khác. -->\n${pruneRagContext(contextSnippets || 'Không có dữ liệu RAG bổ sung')}\n</verified_rag_evidence>`);
  if (triplesText.trim()) {
    contextSections.push(`<knowledge_graph_triples>\n${triplesText}\n</knowledge_graph_triples>`);
  }

  const safeQuery = escapePromptXml(effectiveQuery);
  let userTurnWithContext = `<historical_context>\n${contextSections.join('\n\n')}\n</historical_context>\n\n<user_query>\n${safeQuery}\n</user_query>`;

  if (premiseDirectiveText.trim()) {
    userTurnWithContext += `\n\n<critical_response_constraint>\n<!-- [CHỈ DẪN NGHIỆP VỤ & CĂN CỨ SỬ LIỆU BẮT BUỘC]: Hãy tiếp thu và vận dụng các dữ kiện, luận điểm đính chính bên dưới để trả lời người dùng một cách tự nhiên, chuẩn xác. CÂU MỞ ĐẦU BẮT BUỘC TRẢ LỜI TRỰC DIỆN (KHẲNG ĐỊNH HOẶC BÁC BỎ RÕ RÀNG TIỀN ĐỀ); TUYỆT ĐỐI KHÔNG NHẠI LẠI CÂU HỎI HOẶC BẮT ĐẦU BẰNG CÂU DẪN DẮT ĐỒNG TÌNH VỚI TIỀN ĐỀ SAI. -->\n${premiseDirectiveText.trim()}\n</critical_response_constraint>`;
  }

  const rawMessages: ChatMessage[] = [
    { role: 'system', content: STATIC_SYSTEM_PERSONA_PROMPT },
    ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userTurnWithContext },
  ];
  const maxPromptBudget = isLeanIdentity ? 2500 : (isBroadAnalyticalQuery ? 5500 : 5000);
  const messages = clampTotalPromptMessages(rawMessages, maxPromptBudget);

  let fullResponse = '';
  const loopDetector = createStreamLoopDetector();

  if (isRagSystemError) {
    const disclaimer = `> ⚠️ **Lưu ý:** *Hệ thống tra cứu sử liệu chuyên sâu (Chrono-RAG) đang phản hồi chậm hoặc tạm gián đoạn. Phản hồi dưới đây dựa trên tri thức đại cương, vui lòng đối chiếu lại với chính sử.*\n\n`;
    yield { type: 'token', content: disclaimer };
    fullResponse += disclaimer;
  }

  let openingBuffer = '';
  let isOpeningFlushed = false;
  const isCoRefQuery = Boolean(premiseAnalysis.isSameEntityCoReference);
  const openingCharThreshold = isCoRefQuery ? 280 : 100;
  const sentenceBoundaryMatch = isCoRefQuery ? /(?:[.!?\n].*?[.!?\n])/ : /[.!?\n]/;

  const flushOpeningBuffer = (): string => {
    let openingText = sanitizePromptDirectivesLeakage(openingBuffer);
    if (premiseAnalysis.isSameEntityCoReference && premiseAnalysis.detectedEntities.length >= 2) {
      const e1 = premiseAnalysis.detectedEntities[0];
      const e2 = premiseAnalysis.detectedEntities[1];
      const canon = resolveCanonicalEntity(e1);
      const invariantCheck = verifyCoReferenceInvariant(openingText, e1, e2, canon.canonicalName);
      if (!invariantCheck.isValid) {
        log.warn('chat.coreference_invariant_opening_repaired', invariantCheck.violation || '');
        openingText = invariantCheck.sanitized;
      }
    }
    isOpeningFlushed = true;
    openingBuffer = '';
    return openingText;
  };

  try {
    for await (const chunk of generateLLMCompletionStream(messages, {
      temperature: 0.28,
      top_p: 0.88,
      frequency_penalty: 0.12,
      presence_penalty: 0.08,
      max_tokens: maxGenerationTokens,
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
        if (!isOpeningFlushed) {
          openingBuffer += loopCheck.cleanChunk;
          if (sentenceBoundaryMatch.test(openingBuffer) || openingBuffer.length >= openingCharThreshold) {
            const cleanOpening = flushOpeningBuffer();
            fullResponse += cleanOpening;
            yield { type: 'token', content: cleanOpening };
          }
        } else {
          fullResponse += loopCheck.cleanChunk;
          yield { type: 'token', content: loopCheck.cleanChunk };
        }
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

  if (!isOpeningFlushed && openingBuffer.length > 0) {
    const cleanOpening = flushOpeningBuffer();
    fullResponse += cleanOpening;
    yield { type: 'token', content: cleanOpening };
  }

  if (!fullResponse.trim()) {
    log.warn('chat.zero_content_stream_detected', 'LLM stream produced zero text tokens. Triggering fallback response.');
    if (contextSnippets.trim()) {
      const fallbackSummary = `🏛️ **Thông tin đối chiếu từ nguồn sử liệu Chrono-RAG:**\n\n${pruneRagContext(contextSnippets, 500)}`;
      fullResponse = fallbackSummary;
      yield { type: 'token', content: fallbackSummary };
    } else {
      const fallbackSummary = 'Hệ thống đã nhận diện yêu cầu nhưng quá trình phản hồi bị gián đoạn. Vui lòng thử lại với câu hỏi chi tiết hơn.';
      fullResponse = fallbackSummary;
      yield { type: 'token', content: fallbackSummary };
    }
  }

  fullResponse = normalizeMarkdownListBreaks(sanitizePromptDirectivesLeakage(deduplicateRepetitiveText(fullResponse)));

  if (premiseAnalysis.isSameEntityCoReference && premiseAnalysis.detectedEntities.length >= 2) {
    const e1 = premiseAnalysis.detectedEntities[0];
    const e2 = premiseAnalysis.detectedEntities[1];
    const canon = resolveCanonicalEntity(e1);
    const invariantCheck = verifyCoReferenceInvariant(fullResponse, e1, e2, canon.canonicalName);
    if (!invariantCheck.isValid) {
      log.warn('chat.coreference_invariant_violation_repaired', invariantCheck.violation || '');
      fullResponse = invariantCheck.sanitized;
    }
  }

  if (isFolkloreSource && fullResponse.trim()) {
    const folkloreCheck = validateFolkloreHypothesisTone(fullResponse, true);
    if (!folkloreCheck.isValid) {
      log.warn('chat.folklore_guardrail_triggered', 'Chat response did not meet folklore tone requirement');
    }
  }

  let groundedClaims: GroundedClaimItem[] = [];
  let visualAnchors: VisualAnchorSuggestion[] = [];
  let faithfulnessScore: number | undefined;
  let citationCorrectnessScore: number | undefined;
  let isLowConfidence = false;

  if (ragChunkList.length > 0 && fullResponse.trim()) {
    try {
      const grounding = groundClaims(fullResponse, ragChunkList);
      groundedClaims = grounding.claims;
      visualAnchors = grounding.visualAnchors;
      faithfulnessScore = grounding.faithfulnessScore;
      citationCorrectnessScore = grounding.citationCorrectnessScore;
      isLowConfidence = grounding.isLowConfidence || false;

      if (grounding.hasContradiction) {
        log.warn('chat.grounding_contradiction_detected', 'Chat response has potential historical contradiction with evidence', {
          conversationId,
          faithfulnessScore,
        });
        const contradictionDisclaimer = `\n\n> ⚠️ **Lưu ý đối chiếu sử liệu:** *Một số nội dung trong phản hồi có dấu hiệu chưa đồng nhất với nguồn chính sử đã đối soát. Vui lòng đối chiếu kỹ với các tập sử liệu được dẫn chứng bên dưới.*`;
        fullResponse += contradictionDisclaimer;
        yield { type: 'token', content: contradictionDisclaimer };
      }
    } catch (groundErr: any) {
      log.warn('chat.grounding_analysis_failed', `Grounding analysis skipped due to error: ${groundErr.message}`);
    }
  }

  const charLength = fullResponse.length;
  const estimatedTokens = Math.ceil(charLength / 3.5);
  log.info('chat.supervisor_completed', `Chat stream finished (${Date.now() - startTime}ms)`, {
    conversationId,
    charLength,
    tokenLength: estimatedTokens,
    faithfulnessScore,
    claimsCount: groundedClaims.length,
  });

  yield {
    type: 'done',
    content: fullResponse,
    citations: verifiedCitations,
    triples: graphTriples,
    claims: groundedClaims.length > 0 ? groundedClaims : undefined,
    visualAnchors: visualAnchors.length > 0 ? visualAnchors : undefined,
    faithfulnessScore,
    citationCorrectnessScore,
    isLowConfidence: isLowConfidence || undefined,
    conversationId,
    videoHandover: classification.videoHandover,
  };
}

export async function executeChatQuery(
  request: ChatSupervisorRequest
): Promise<ChatExecutionResult> {
  let fullText = '';
  let citations: (string | HistoricalCitationItem)[] = [];
  let triples: GraphTripleItem[] = [];
  let intent: ChatIntent = 'HISTORICAL_QUERY';
  let claims: GroundedClaimItem[] | undefined;
  let visualAnchors: VisualAnchorSuggestion[] | undefined;
  let faithfulnessScore: number | undefined;
  let citationCorrectnessScore: number | undefined;
  let isLowConfidence: boolean | undefined;

  for await (const chunk of handleChatQueryStream(request)) {
    if (chunk.type === 'token' && chunk.content) {
      fullText += chunk.content;
    } else if (chunk.type === 'citation' && chunk.citations) {
      citations = chunk.citations;
    } else if (chunk.type === 'triples' && chunk.triples) {
      triples = chunk.triples;
    } else if (chunk.type === 'intent' && chunk.intent) {
      intent = chunk.intent as ChatIntent;
    } else if (chunk.type === 'done') {
      claims = chunk.claims;
      visualAnchors = chunk.visualAnchors;
      faithfulnessScore = chunk.faithfulnessScore;
      citationCorrectnessScore = chunk.citationCorrectnessScore;
      isLowConfidence = chunk.isLowConfidence;
    }
  }

  return {
    fullText,
    intent,
    citations,
    triples,
    claims,
    visualAnchors,
    faithfulnessScore,
    citationCorrectnessScore,
    isLowConfidence,
    conversationId: request.conversationId,
  };
}
