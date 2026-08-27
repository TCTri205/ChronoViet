import { describe, it, expect, vi } from 'vitest';
import { ContextSynthesizer } from '../generation/context-synthesizer.js';
import { PromptEngine } from '../generation/prompt-engine.js';
import { ClaimGrounder } from '../generation/claim-grounder.js';

describe('ContextSynthesizer', () => {
  it('should format structured context with graph triples and evidence chunks', () => {
    const result = ContextSynthesizer.assembleContext({
      verifiedContext: [
        {
          entityId: 'person_tran_hung_dao',
          canonicalName: 'Trần Hưng Đạo',
          aliases: ['Trần Quốc Tuấn'],
          summary: 'Quốc công Tiết chế Trần Hưng Đạo chỉ huy quân dân đánh tan quân Nguyên Mông năm 1288.',
          citations: ['Đại Việt Sử Ký Toàn Thư'],
          confidenceScore: 0.95,
          chunkId: 'chunk_tran_hung_dao_01',
          title: 'Chiến công Trần Hưng Đạo',
          sourceReliability: 'LEVEL_1',
        },
      ],
      triples: [
        {
          source: 'Trần Hưng Đạo',
          relation: 'COMMANDED',
          target: 'Trận Bạch Đằng 1288',
          confidence: 1.0,
        },
      ],
      aliasTable: {
        'Trần Hưng Đạo': ['Trần Quốc Tuấn', 'Hưng Đạo Đại Vương'],
      },
    });

    expect(result.formattedContext).toContain('QUAN HỆ THỰC THỂ');
    expect(result.formattedContext).toContain('Trần Hưng Đạo');
    expect(result.formattedContext).toContain('COMMANDED');
    expect(result.formattedContext).toContain('[CHUNK_1]');
    expect(result.chunkMap.has('chunk_tran_hung_dao_01')).toBe(true);
  });

  it('should stitch contiguous sibling child chunks and strip 40-word boundary overlap', () => {
    const chunkA = {
      entityId: 'ent_lam_son_1',
      canonicalName: 'Khởi nghĩa Lam Sơn',
      chunkId: 'chunk_ls_parent_01_child_1',
      title: 'Khởi nghĩa Lam Sơn - Đoạn 1',
      textContent: 'Lê Lợi dựng cờ khởi nghĩa tại vùng núi Lam Sơn Thanh Hóa. Quân sĩ đồng lòng một dạ cùng vượt qua muôn vàn gian nan thiếu thốn lương thực vũ khí.',
      parentChunkId: 'parent_ls_01',
      timeStart: 1418,
      timeEnd: 1420,
      sourceReliability: 'LEVEL_1' as const,
      citations: [],
      aliases: [],
      summary: '',
      confidenceScore: 1.0,
    };

    const chunkB = {
      entityId: 'ent_lam_son_2',
      canonicalName: 'Khởi nghĩa Lam Sơn',
      chunkId: 'chunk_ls_parent_01_child_2',
      title: 'Khởi nghĩa Lam Sơn - Đoạn 2',
      textContent: 'Quân sĩ đồng lòng một dạ cùng vượt qua muôn vàn gian nan thiếu thốn lương thực vũ khí. Nguyễn Trãi dâng Bình Ngô sách vạch ra chiến lược lâu dài.',
      parentChunkId: 'parent_ls_01',
      timeStart: 1420,
      timeEnd: 1427,
      sourceReliability: 'LEVEL_1' as const,
      citations: [],
      aliases: [],
      summary: '',
      confidenceScore: 1.0,
    };

    const stitched = ContextSynthesizer.stitchSiblingChunks([chunkA, chunkB]);
    expect(stitched.length).toBe(1);
    expect(stitched[0].title).toContain('Đoạn hợp nhất (1-2)');
    expect(stitched[0].textContent).toContain('Lê Lợi dựng cờ khởi nghĩa');
    expect(stitched[0].textContent).toContain('Nguyễn Trãi dâng Bình Ngô sách');
    // Ensure duplicate boundary sentence was deduplicated
    const matches = stitched[0].textContent.match(/Quân sĩ đồng lòng một dạ/g);
    expect(matches?.length).toBe(1);
    expect(stitched[0].timeStart).toBe(1418);
    expect(stitched[0].timeEnd).toBe(1427);
  });

  it('should not stitch non-contiguous child chunks', () => {
    const chunk1 = {
      entityId: 'ent_1',
      canonicalName: 'Sử liệu 1',
      chunkId: 'chunk_p1_child_1',
      title: 'Tài liệu 1',
      textContent: 'Nội dung đoạn 1',
      parentChunkId: 'parent_01',
      citations: [],
      aliases: [],
      summary: '',
      confidenceScore: 1.0,
    };
    const chunk3 = {
      entityId: 'ent_3',
      canonicalName: 'Sử liệu 3',
      chunkId: 'chunk_p1_child_3',
      title: 'Tài liệu 3',
      textContent: 'Nội dung đoạn 3',
      parentChunkId: 'parent_01',
      citations: [],
      aliases: [],
      summary: '',
      confidenceScore: 1.0,
    };

    const stitched = ContextSynthesizer.stitchSiblingChunks([chunk1, chunk3]);
    expect(stitched.length).toBe(2);
    expect(stitched[0].chunkId).toBe('chunk_p1_child_1');
    expect(stitched[1].chunkId).toBe('chunk_p1_child_3');
  });
});

describe('PromptEngine', () => {
  it('should detect causal / why reasoning intent', () => {
    const intent = PromptEngine.detectQueryIntent('Tại sao vua tôi nhà Trần lại chọn chiến thuật rút lui ở giai đoạn đầu?');
    expect(intent).toBe('WHY_REASONING');
  });

  it('should detect comparative intent', () => {
    const intent = PromptEngine.detectQueryIntent('So sánh sách lược đánh giặc của nhà Tiền Lê và nhà Trần');
    expect(intent).toBe('COMPARATIVE');
  });

  it('should detect biography intent from expanded patterns', () => {
    expect(PromptEngine.detectQueryIntent('Ai đánh tan quân Nam Hán trên sông Bạch Đằng năm 938?')).toBe('BIOGRAPHY');
    expect(PromptEngine.detectQueryIntent('Vua nào sáng lập ra triều đại nhà Lý?')).toBe('BIOGRAPHY');
    expect(PromptEngine.detectQueryIntent('Tên thật của vua Quang Trung là gì?')).toBe('BIOGRAPHY');
  });

  it('should build messages with dynamic token budget and zero-evidence directive', () => {
    const result = PromptEngine.buildPrompt({
      query: 'Tại sao lại có hội nghị Diên Hồng?',
      contextText: 'Nội dung sử liệu mẫu',
      requiresMultiHop: true,
    });

    expect(result.messages.length).toBe(2);
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[0].content).toContain('ChronoViet AI');
    expect(result.messages[0].content).toContain('CAUSAL REASONING');
    expect(result.messages[0].content).toContain('MULTI-HOP LINKING');
    expect(result.messages[0].content).toContain('ZERO EVIDENCE REFUSAL');
    expect(result.messages[0].content).toContain('CHRONOLOGICAL ORDERING GUARDRAIL');
    expect(result.maxTokens).toBeGreaterThanOrEqual(850);
  });
});

describe('ClaimGrounder', () => {
  it('should extract individual factual claims', () => {
    const text = 'Năm 1288, quân dân nhà Trần đại thắng trên sông Bạch Đằng. Ô Mã Nhi bị bắt sống.';
    const claims = ClaimGrounder.extractClaims(text);
    expect(claims.length).toBe(2);
  });

  it('should calculate high entailment for matching evidence', () => {
    const claim = 'Quân dân nhà Trần đại thắng trên sông Bạch Đằng năm 1288';
    const evidence = 'Trận chiến trên sông Bạch Đằng năm 1288 kết thúc với đại thắng của quân dân nhà Trần.';
    const score = ClaimGrounder.calculateEntailment(claim, evidence);
    expect(score).toBeGreaterThan(0.5);
  });

  it('should ground claims and attribute to correct chunks', () => {
    const answer = 'Năm 1288, Trần Quốc Tuấn chỉ huy chiến thắng Bạch Đằng [CHUNK_1].';
    const chunks = [
      {
        id: 'chunk_1288',
        title: 'Trận Bạch Đằng 1288',
        content: 'Năm 1288, Tiết chế Trần Quốc Tuấn chỉ huy quân dân đánh tan thuỷ quân Ô Mã Nhi trên sông Bạch Đằng.',
        reliability: 'LEVEL_1',
      },
    ];

    const result = ClaimGrounder.groundClaims(answer, chunks);
    expect(result.claims.length).toBe(1);
    expect(result.claims[0].sourceChunkId).toBe('chunk_1288');
    expect(result.faithfulnessScore).toBe(100);
    expect(result.citationCorrectnessScore).toBe(100);
  });
});

describe('AnswerGenerator Streaming & TTFT', () => {
  it('should yield streaming events and measure TTFT metrics', async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Năm "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"1954 "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"chiến dịch toàn thắng."}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const encoder = new TextEncoder();
    const streamBody = new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    const originalFetch = global.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (typeof url === 'string' && url.includes('/chat/completions')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'text/event-stream' }),
            body: streamBody,
          } as any;
        }
        return { ok: false, status: 404 } as any;
      })
    );

    const { AnswerGenerator } = await import('../generation/answer-generator.js');

    const mockRagEngine: any = {
      search: async () => ({
        query: 'Chiến dịch Điện Biên Phủ diễn ra năm nào?',
        chunks: [],
        triples: [{ source: 'Điện Biên Phủ', relation: 'OCCURRED_IN', target: '1954' }],
        citations: ['Sử liệu 1954'],
        verifiedContext: [],
        aliasTable: {},
      }),
    };

    const stream = AnswerGenerator.generateStream(mockRagEngine, {
      query: 'Chiến dịch Điện Biên Phủ diễn ra năm nào?',
    });

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    const tokenEvents = events.filter((e) => e.type === 'token');
    expect(tokenEvents.length).toBe(3);
    expect(tokenEvents[0].metrics).toBeDefined();
    expect(tokenEvents[0].metrics?.ttftMs).toBeGreaterThanOrEqual(0);
    expect(tokenEvents[0].metrics?.llmFirstTokenMs).toBeGreaterThanOrEqual(0);

    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.metrics?.totalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(doneEvent?.metrics?.tokenCount).toBe(3);

    vi.stubGlobal('fetch', originalFetch);
  });
});
