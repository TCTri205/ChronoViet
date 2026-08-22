import { describe, it, expect, vi } from 'vitest';
import { IRagEngine, RagSearchResponse } from '@chronoviet/shared-spec';

vi.mock('@chronoviet/shared-spec', async (importOriginal) => {
  const original = await importOriginal<typeof import('@chronoviet/shared-spec')>();
  return {
    ...original,
    generateLLMCompletionStream: vi.fn().mockImplementation(async function* () {
      yield 'Trận ';
      yield 'Bạch Đằng ';
      yield 'năm 938 ';
      yield 'là một chiến thắng lịch sử.';
    }),
    callLlm: vi.fn().mockResolvedValue({
      content: 'Trận Bạch Đằng năm 938 là một chiến thắng vẻ vang.',
    }),
  };
});

import {
  classifyChatIntent,
  rewriteMultiTurnQuery,
  pruneConversationHistory,
  estimateTokens,
  handleChatQueryStream,
  executeChatQuery,
} from '../index.js';

describe('Intent Classifier', () => {
  it('identifies greetings and bot meta questions as CHITCHAT', () => {
    const r1 = classifyChatIntent('Xin chào bạn');
    expect(r1.intent).toBe('CHITCHAT');
    expect(r1.fastPathResponse).toBeDefined();

    const r2 = classifyChatIntent('ChronoViet là gì?');
    expect(r2.intent).toBe('CHITCHAT');

    const r3 = classifyChatIntent('Cảm ơn bạn nhé');
    expect(r3.intent).toBe('CHITCHAT');
  });

  it('identifies video creation commands as VIDEO_INTENT', () => {
    const r1 = classifyChatIntent('Tạo video về Chiến thắng Bạch Đằng năm 938');
    expect(r1.intent).toBe('VIDEO_INTENT');
    expect(r1.suggestedTopic).toContain('Chiến thắng Bạch Đằng');

    const r2 = classifyChatIntent('Làm video kể về vua Quang Trung đại phá quân Thanh');
    expect(r2.intent).toBe('VIDEO_INTENT');
  });

  it('identifies historical entity queries as ENTITY_IDENTITY', () => {
    const r1 = classifyChatIntent('Ngô Quyền là ai?');
    expect(r1.intent).toBe('ENTITY_IDENTITY');
    expect(r1.matchedCanonicalName).toBe('Ngô Quyền');
  });

  it('defaults to HISTORICAL_QUERY for descriptive history questions', () => {
    const r = classifyChatIntent('Kế sách cắm cọc gỗ trên sông Bạch Đằng được triển khai ra sao?');
    expect(r.intent).toBe('HISTORICAL_QUERY');
  });
});

describe('Multi-turn Query Rewriter', () => {
  it('resolves pronouns using recent entity mentions in conversation history', () => {
    const history = [
      { role: 'user' as const, content: 'Kể cho tôi nghe về Ngô Quyền' },
      {
        role: 'assistant' as const,
        content: 'Ngô Quyền là vị vua đầu tiên của nhà Ngô, lãnh đạo nhân dân đánh tan quân Nam Hán.',
      },
    ];

    const rewritten = rewriteMultiTurnQuery('Ông ấy sinh năm bao nhiêu?', history);
    expect(rewritten).toContain('Ngô Quyền');
  });

  it('keeps standalone queries intact', () => {
    const rewritten = rewriteMultiTurnQuery('Trận Ngọc Hồi Đống Đa diễn ra vào mùa xuân năm nào?', []);
    expect(rewritten).toBe('Trận Ngọc Hồi Đống Đa diễn ra vào mùa xuân năm nào?');
  });
});

describe('Context Pruner', () => {
  it('estimates token count correctly', () => {
    const tokens = estimateTokens('Chiến thắng Bạch Đằng năm 938');
    expect(tokens).toBeGreaterThan(0);
  });

  it('always preserves Turn 1 anchor while pruning older middle turns', () => {
    const history = [
      { role: 'user' as const, content: 'Turn 1: Chủ đề gốc là Trần Hưng Đạo' },
      { role: 'assistant' as const, content: 'Turn 2: Chi tiết ' + 'dài '.repeat(100) },
      { role: 'user' as const, content: 'Turn 3: Hỏi thêm ' + 'dài '.repeat(100) },
      { role: 'assistant' as const, content: 'Turn 4: Chi tiết ' + 'dài '.repeat(100) },
      { role: 'user' as const, content: 'Turn 5: Câu hỏi gần nhất' },
    ];

    const pruned = pruneConversationHistory(history, 150);
    expect(pruned.length).toBeGreaterThanOrEqual(2);
    expect(pruned[0].content).toContain('Turn 1: Chủ đề gốc là Trần Hưng Đạo');
    expect(pruned[pruned.length - 1].content).toContain('Turn 5: Câu hỏi gần nhất');
  });
});

describe('Chat Supervisor Stream', () => {
  const mockRagEngine: IRagEngine = {
    search: async (): Promise<RagSearchResponse> => ({
      verifiedContext: [
        {
          entityId: 'ent_ngo_quyen',
          canonicalName: 'Ngô Quyền',
          aliases: ['Tiền Ngô Vương'],
          summary: 'Ngô Quyền đánh tan quân Nam Hán trên sông Bạch Đằng năm 938.',
          citations: ['Đại Việt Sử Ký Toàn Thư'],
          confidenceScore: 0.98,
        },
      ],
      aliasTable: { 'Ngô Quyền': ['Tiền Ngô Vương'] },
      citations: ['Đại Việt Sử Ký Toàn Thư (Tập 1, Quyển 5)'],
      triples: [
        {
          source: 'Ngô Quyền',
          relation: 'LED_BY',
          target: 'Trận Bạch Đằng (938)',
          confidence: 1.0,
        },
      ],
      retrievalLatencyMs: 12,
    }),
    ingestDocument: async () => {},
  };

  it('streams chitchat query directly without invoking RAG', async () => {
    const searchSpy = vi.spyOn(mockRagEngine, 'search');
    const events = [];

    for await (const chunk of handleChatQueryStream({
      query: 'Xin chào ChronoViet',
      ragEngine: mockRagEngine,
    })) {
      events.push(chunk);
    }

    expect(events.some((e) => e.type === 'intent' && e.intent === 'CHITCHAT')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('handles deep historical query with RAG, triples, citations, and tokens', async () => {
    const result = await executeChatQuery({
      query: 'Trận Bạch Đằng năm 938 diễn ra như thế nào?',
      ragEngine: mockRagEngine,
    });

    expect(result.intent).toBe('HISTORICAL_QUERY');
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.triples.length).toBeGreaterThan(0);
    expect(result.fullText.length).toBeGreaterThan(0);
  });

  it('respects AbortSignal for instant cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    const events = [];
    for await (const chunk of handleChatQueryStream({
      query: 'Trận Bạch Đằng năm 938',
      signal: controller.signal,
      ragEngine: mockRagEngine,
    })) {
      events.push(chunk);
    }

    expect(events.some((e) => e.type === 'error' && e.error?.includes('hủy'))).toBe(true);
  });
});

describe('Video Brief Topic Isolation', () => {
  it('prevents unrelated chat history from polluting new video brief entities and summary', async () => {
    const { compileChatToVideoBrief } = await import('../brief/chat-to-brief-compiler.js');
    const unrelatedHistory = [
      { role: 'user' as const, content: 'Phạm vi kiến thức lịch sử của bạn tới đâu?' },
      {
        role: 'assistant' as const,
        content: 'Tôi bao quát từ thời Hùng Vương, nhà Nguyễn với Trịnh Hoài Đức và Gia Định Thành Thông Chí, đến Quang Trung và Trận Đống Đa.',
      },
    ];

    const brief = await compileChatToVideoBrief(unrelatedHistory, {
      topic: 'Khởi nghĩa Lam Sơn',
      targetDurationSec: 180,
    });

    expect(brief.topic).toBe('Khởi nghĩa Lam Sơn');
    // Should NOT include Trịnh Hoài Đức in entities for Lam Sơn
    expect(brief.keyEntities).not.toContain('Trịnh Hoài Đức');
    // Summary should be clean topical research summary
    expect(brief.summary).not.toContain('Trịnh Hoài Đức');
  });
});

describe('Anti-Sycophancy & False Premise Guardrail', () => {
  it('detects leading kinship questions with potential false premises', async () => {
    const { analyzePremiseAndLeadingIntent } = await import('../guardrails/anti-sycophancy.js');
    const res1 = analyzePremiseAndLeadingIntent('Lê Lợi và Lê Độ là 2 anh em hả?');
    expect(res1.isLeadingQuestion).toBe(true);
    expect(res1.questionType).toBe('KINSHIP');
    expect(res1.detectedEntities).toContain('Lê Lợi');
    expect(res1.suggestedDirective).toContain('TIỀN ĐỀ QUAN HỆ THÂN TỘC');

    const res2 = analyzePremiseAndLeadingIntent('Trần Hưng Đạo có phải là con của Lý Thường Kiệt không?');
    expect(res2.isLeadingQuestion).toBe(true);
    expect(res2.questionType).toBe('KINSHIP');
  });

  it('detects leading dynasty questions', async () => {
    const { analyzePremiseAndLeadingIntent } = await import('../guardrails/anti-sycophancy.js');
    const res = analyzePremiseAndLeadingIntent('Lê Lợi có phải là vua nhà Hồ không?');
    expect(res.isLeadingQuestion).toBe(true);
    expect(res.questionType).toBe('DYNASTY');
  });

  it('passes general historical questions without false premise flags', async () => {
    const { analyzePremiseAndLeadingIntent } = await import('../guardrails/anti-sycophancy.js');
    const res = analyzePremiseAndLeadingIntent('Chiến dịch Điện Biên Phủ diễn ra trong bao nhiêu ngày đêm?');
    expect(res.isLeadingQuestion).toBe(false);
    expect(res.suggestedDirective).toBe('');
  });
});

describe('Stream Repetition & Loop Detector', () => {
  it('detects and terminates stream repetition degeneration', async () => {
    const { createStreamLoopDetector, deduplicateRepetitiveText } = await import('../guardrails/stream-dedup.js');
    const detector = createStreamLoopDetector({ minRepeatLength: 20, maxRepeatsAllowed: 2 });

    const repeatedPara = 'Lê Lợi và Lê Độ là hai anh em trai cùng lãnh đạo phong trào khởi nghĩa chống quân Minh.\n\n';
    
    // Feed paragraph 1
    const c1 = detector.processChunk(repeatedPara);
    expect(c1.shouldEmit).toBe(true);
    expect(c1.shouldTerminate).toBe(false);

    // Feed paragraph 2
    const c2 = detector.processChunk(repeatedPara);
    expect(c2.shouldEmit).toBe(true);
    expect(c2.shouldTerminate).toBe(false);

    // Feed paragraph 3 (exceeds maxRepeatsAllowed = 2)
    const c3 = detector.processChunk(repeatedPara);
    expect(c3.shouldTerminate).toBe(true);
  });

  it('deduplicates repetitive text blocks in post-processing', async () => {
    const { deduplicateRepetitiveText } = await import('../guardrails/stream-dedup.js');
    const duplicatedText = `Lê Lợi là lãnh tụ cuộc khởi nghĩa Lam Sơn đánh đuổi quân Minh lập ra triều Hậu Lê.

Lê Lợi là lãnh tụ cuộc khởi nghĩa Lam Sơn đánh đuổi quân Minh lập ra triều Hậu Lê.

Ông lên ngôi hoàng đế lấy hiệu là Lê Thái Tổ.`;

    const cleaned = deduplicateRepetitiveText(duplicatedText);
    expect(cleaned).toContain('Lê Lợi là lãnh tụ cuộc khởi nghĩa Lam Sơn');
    expect(cleaned).toContain('Ông lên ngôi hoàng đế');
    // Ensure only 2 paragraphs remain
    expect(cleaned.split('\n\n').length).toBe(2);
  });
});

