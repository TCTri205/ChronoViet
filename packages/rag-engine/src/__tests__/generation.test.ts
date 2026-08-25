import { describe, it, expect } from 'vitest';
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
