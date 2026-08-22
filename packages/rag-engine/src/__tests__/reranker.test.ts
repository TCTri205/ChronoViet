import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rerankCandidates } from '../retrieval/reranker.js';
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
    },
    {
      chunkId: 'chunk_2',
      title: 'Triều đại nhà Đinh',
      textContent: 'Đinh Bộ Lĩnh dẹp loạn 12 sứ quân, thống nhất đất nước, xưng Đế lập nên nhà Đinh.',
      dynasty: 'Nhà Đinh',
      sourceReliability: 'LEVEL_2',
      score: 0.5,
    },
    {
      chunkId: 'chunk_3',
      title: 'Sử thi Đẻ đất đẻ nước',
      textContent: 'Tác phẩm sử thi dân gian truyền miệng của người Mường.',
      sourceReliability: 'LEVEL_3',
      score: 0.5,
    },
  ];

  beforeEach(() => {
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

  it('should apply Multi-Factor Fusion (75% AI + 15% Source Reliability + 10% Co-retrieval)', async () => {
    const query = 'Xác minh sự thật về chiến thắng Ngọc Hồi Đống Đa có đúng hay sai?';
    const res = await rerankCandidates(query, sampleCandidates, 2);

    expect(res[0].chunkId).toBe('chunk_1');
    expect(res.length).toBe(2);
    // Score calculation: 0.75 * 0.95 + 0.15 * 1.0 (LEVEL_1) + 0.10 (score >= 0.35) = 0.9625
    expect(res[0].score).toBeGreaterThan(0.9);
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
});
