import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  rerankCandidates,
  truncateToSentenceBoundary,
  calculateTemporalMultiplier,
  getLastRerankerStatus,
  resetRerankerStatusForTest,
} from '../retrieval/reranker.js';
import { VectorSearchResult } from '../retrieval/vector-search.js';

describe('Pure Model Context Reranker', () => {
  const sampleCandidates: VectorSearchResult[] = [
    {
      chunkId: 'chunk_1',
      title: 'Chiến thắng Ngọc Hồi Đống Đa',
      textContent: 'Vua Quang Trung lãnh đạo đại quân Tây Sơn tiến công thần tốc đánh tan 29 vạn quân Thanh.',
      dynasty: 'Nhà Tây Sơn',
      sourceReliability: 'LEVEL_1',
      score: 0.5,
      isCoRetrieved: true,
    },
    {
      chunkId: 'chunk_2',
      title: 'Triều đại nhà Đinh',
      textContent: 'Đinh Bộ Lĩnh dẹp loạn 12 sứ quân, thống nhất đất nước, xưng Đế lập nên nhà Đinh.',
      dynasty: 'Nhà Đinh',
      sourceReliability: 'LEVEL_2',
      score: 0.5,
      isCoRetrieved: false,
    },
    {
      chunkId: 'chunk_3',
      title: 'Sử thi Đẻ đất đẻ nước',
      textContent: 'Tác phẩm sử thi dân gian truyền miệng của người Mường.',
      sourceReliability: 'LEVEL_3',
      score: 0.5,
      isCoRetrieved: false,
    },
  ];

  beforeEach(() => {
    resetRerankerStatusForTest();
    // Mock global fetch for deterministic /v1/rerank response
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: any) => {
        if (url.includes('/v1/rerank')) {
          const body = JSON.parse(init?.body || '{}');
          const docs: string[] = body.documents || [];
          const query: string = (body.query || '').toLowerCase();

          // Compute mock semantic relevance score based on query keywords
          const results = docs.map((doc, idx) => {
            const docLower = doc.toLowerCase();
            let score = 0.2;
            if (
              (query.includes('quang trung') || query.includes('ngọc hồi')) &&
              (docLower.includes('quang trung') || docLower.includes('ngọc hồi'))
            ) {
              score = 0.95;
            } else if (query.includes('nhà lê') && docLower.includes('nhà lê')) {
              score = 0.92;
            } else if (query.includes('đinh bộ lĩnh') && docLower.includes('đinh')) {
              score = 0.85;
            } else if (docLower.includes('mường')) {
              score = 0.05;
            }
            return { index: idx, relevance_score: score };
          });

          return {
            ok: true,
            status: 200,
            json: async () => ({ results }),
            text: async () => JSON.stringify({ results }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array for empty candidate list', async () => {
    const res = await rerankCandidates('Quang Trung đại phá quân Thanh', []);
    expect(res).toEqual([]);
  });

  it('should boost candidate matching query with Cross-Encoder and LEVEL_1 source', async () => {
    const query = 'Vua Quang Trung lãnh đạo đại thắng Ngọc Hồi Đống Đa năm nào?';
    const res = await rerankCandidates(query, sampleCandidates, 3);

    expect(res.length).toBe(3);
    expect(res[0].chunkId).toBe('chunk_1');
    expect(res[0].score).toBeGreaterThan(res[1].score);
  });

  it('should penalize completely irrelevant distractors with low AI relevance', async () => {
    const query = 'Vua Quang Trung đại phá quân Thanh';
    const res = await rerankCandidates(query, sampleCandidates, 3);

    const distractor = res.find((c) => c.chunkId === 'chunk_3');
    expect(distractor).toBeDefined();
    // Distractor should have lower score than relevant candidates
    expect(distractor!.score).toBeLessThan(res[0].score);
  });

  it('should apply Multi-Factor Fusion with explicit isCoRetrieved boolean flag', async () => {
    const query = 'Xác minh sự thật về chiến thắng Ngọc Hồi Đống Đa có đúng hay sai?';
    const res = await rerankCandidates(query, sampleCandidates, 2);

    expect(res[0].chunkId).toBe('chunk_1');
    expect(res.length).toBe(2);
    // Score calculation: 0.75 * 0.95 + 0.15 * 1.0 (LEVEL_1) + 0.05 (isCoRetrieved = true) = 0.9125
    expect(res[0].score).toBeGreaterThan(0.9);
  });

  it('should not award co-retrieval bonus when isCoRetrieved is false even if initial score was high', async () => {
    const customCandidates: VectorSearchResult[] = [
      {
        chunkId: 'chunk_a',
        title: 'Chiến thắng Ngọc Hồi Đống Đa',
        textContent: 'Vua Quang Trung lãnh đạo đại quân Tây Sơn tiến công thần tốc.',
        dynasty: 'Nhà Tây Sơn',
        sourceReliability: 'LEVEL_1',
        score: 0.9,
        isCoRetrieved: false,
      },
      {
        chunkId: 'chunk_b',
        title: 'Chiến thắng Ngọc Hồi Đống Đa',
        textContent: 'Vua Quang Trung lãnh đạo đại quân Tây Sơn tiến công thần tốc.',
        dynasty: 'Nhà Tây Sơn',
        sourceReliability: 'LEVEL_1',
        score: 0.1,
        isCoRetrieved: true,
      },
    ];

    const query = 'Quang Trung Ngọc Hồi';
    const res = await rerankCandidates(query, customCandidates, 2);
    // chunk_b has isCoRetrieved = true -> gets +0.05 bonus
    // chunk_a has isCoRetrieved = false -> gets +0.00 bonus
    expect(res[0].chunkId).toBe('chunk_b');
    expect(res[0].score).toBeCloseTo(res[1].score + 0.05, 3);
  });

  it('should safely truncate text at sentence boundary without clipping mid-word', () => {
    const text = 'Lê Lợi dựng cờ khởi nghĩa ở Lam Sơn. Năm 1427, quân Minh phải rút lui về nước. Đất nước thái bình thịnh trị.';
    const truncated = truncateToSentenceBoundary(text, 50);

    expect(truncated.length).toBeLessThanOrEqual(50);
    expect(truncated.endsWith('.')).toBe(true);
    expect(truncated).toBe('Lê Lợi dựng cờ khởi nghĩa ở Lam Sơn.');
  });

  it('should fallback to clause or word boundary if sentence boundary is not available in late window', () => {
    const text = 'Đinh Bộ Lĩnh thống nhất đất nước, dẹp loạn 12 sứ quân rồi xưng đế lập nên triều Đinh';
    const truncated = truncateToSentenceBoundary(text, 40);

    expect(truncated.length).toBeLessThanOrEqual(40);
    // Should end at clause terminator ','
    expect(truncated).toBe('Đinh Bộ Lĩnh thống nhất đất nước,');
  });

  it('should gracefully handle reranker offline and record fallback status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused (8096)')));

    const res = await rerankCandidates('Quang Trung đại phá quân Thanh', sampleCandidates, 3);
    expect(res.length).toBe(3);

    const status = getLastRerankerStatus();
    expect(status.active).toBe(false);
    expect(status.fallbackReason).toContain('Connection refused');
  });

  it('should preserve and rank 2-character historical names via Cross-Encoder', async () => {
    const candidates: VectorSearchResult[] = [
      {
        chunkId: 'chunk_le',
        title: 'Nhà Hậu Lê',
        textContent: 'Triều đại nhà Lê do Lê Lợi sáng lập sau khởi nghĩa Lam Sơn.',
        sourceReliability: 'LEVEL_1',
        score: 0.1,
      },
      {
        chunkId: 'chunk_other',
        title: 'Văn hóa Đông Sơn',
        textContent: 'Trống đồng Đông Sơn thời các vua Hùng dựng nước Văn Lang.',
        sourceReliability: 'LEVEL_1',
        score: 0.1,
      },
    ];

    const query = 'Nhà Lê do ai sáng lập?';
    const res = await rerankCandidates(query, candidates, 2);

    expect(res[0].chunkId).toBe('chunk_le');
    expect(res[0].score).toBeGreaterThan(res[1].score);
  });

  it('should compute correct Bayesian temporal multipliers across different eras and delta ranges', () => {
    // Exact match (<= 2 years) -> 1.10
    expect(calculateTemporalMultiplier([1288], 1288, 1288)).toBe(1.10);
    expect(calculateTemporalMultiplier([1288], 1287, 1288)).toBe(1.10);
    expect(calculateTemporalMultiplier([1789], 1788, 1789)).toBe(1.10);

    // Close range (3-30 years) -> 1.00
    expect(calculateTemporalMultiplier([1288], 1275, 1275)).toBe(1.00);

    // Era mismatch (31-100 years) -> 0.85
    expect(calculateTemporalMultiplier([1288], 1200, 1200)).toBe(0.85);

    // Distant century mismatch (> 100 years) -> 0.70
    expect(calculateTemporalMultiplier([1288], 938, 938)).toBe(0.70);

    // Un-dated chunk -> 1.00
    expect(calculateTemporalMultiplier([1288], undefined, undefined)).toBe(1.00);

    // Query with no temporal constraint -> 1.00
    expect(calculateTemporalMultiplier([], 1288, 1288)).toBe(1.00);

    // BCE/TCN signed distance
    expect(calculateTemporalMultiplier([-257], -257, -257)).toBe(1.10);
    expect(calculateTemporalMultiplier([-257], 40, 43)).toBe(0.70); // delta ~300 years
  });

  it('should disambiguate multi-era events by boosting exact temporal era chunks over older/newer eras', async () => {
    const multiEraCandidates: VectorSearchResult[] = [
      {
        chunkId: 'chunk_bd_938',
        title: 'Trận Bạch Đằng năm 938',
        textContent: 'Ngô Quyền cắm cọc gỗ trên sông Bạch Đằng đánh tan quân Nam Hán.',
        dynasty: 'Thời kỳ Tự chủ',
        timeStart: 938,
        timeEnd: 938,
        sourceReliability: 'LEVEL_1',
        score: 0.8,
      },
      {
        chunkId: 'chunk_bd_1288',
        title: 'Trận Bạch Đằng năm 1288',
        textContent: 'Trần Hưng Đạo và quân dân nhà Trần đại thắng quân Nguyên Mông trên sông Bạch Đằng.',
        dynasty: 'Nhà Trần',
        timeStart: 1288,
        timeEnd: 1288,
        sourceReliability: 'LEVEL_1',
        score: 0.8,
      },
      {
        chunkId: 'chunk_bd_undated',
        title: 'Nghệ thuật quân sự trên sông Bạch Đằng',
        textContent: 'Phân tích tổng hợp nghệ thuật lợi dụng thủy triều và cọc nhọn qua các thời kỳ lịch sử.',
        sourceReliability: 'LEVEL_1',
        score: 0.8,
      },
    ];

    // Query for 1288 battle: chunk_bd_1288 should rank #1 due to exact temporal bonus (1.10) vs penalty on 938 (0.70)
    const res1288 = await rerankCandidates(
      'Trận Bạch Đằng năm 1288 do ai chỉ huy?',
      multiEraCandidates,
      3,
      [1288]
    );
    expect(res1288[0].chunkId).toBe('chunk_bd_1288');

    // Query for 938 battle: chunk_bd_938 should rank #1
    const res938 = await rerankCandidates(
      'Trận Bạch Đằng năm 938 Ngô Quyền đại phá quân Nam Hán',
      multiEraCandidates,
      3,
      [938]
    );
    expect(res938[0].chunkId).toBe('chunk_bd_938');

    // Un-dated chunk remains eligible with 1.0 multiplier
    expect(res1288.find((c) => c.chunkId === 'chunk_bd_undated')?.score).toBeGreaterThan(
      res1288.find((c) => c.chunkId === 'chunk_bd_938')?.score || 0
    );
  });
});
