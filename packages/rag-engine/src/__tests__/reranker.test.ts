import { describe, it, expect } from 'vitest';
import { rerankCandidates } from '../retrieval/reranker.js';
import { VectorSearchResult } from '../retrieval/vector-search.js';

describe('Integrated Context Reranker', () => {
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

  it('should return empty array for empty candidate list', () => {
    const res = rerankCandidates('Quang Trung đại phá quân Thanh', []);
    expect(res).toEqual([]);
  });

  it('should boost candidate matching query keywords and title', () => {
    const query = 'Vua Quang Trung lãnh đạo đại thắng Ngọc Hồi Đống Đa năm nào?';
    const res = rerankCandidates(query, sampleCandidates, 3);

    expect(res.length).toBe(3);
    expect(res[0].chunkId).toBe('chunk_1');
    expect(res[0].score).toBeGreaterThan(res[1].score);
  });

  it('should penalize completely irrelevant distractors', () => {
    const query = 'Vua Quang Trung đại phá quân Thanh';
    const res = rerankCandidates(query, sampleCandidates, 3);

    const distractor = res.find((c) => c.chunkId === 'chunk_3');
    expect(distractor).toBeDefined();
    // Distractor should receive a score discount (< initial 0.5)
    expect(distractor!.score).toBeLessThan(0.5);
  });

  it('should apply source reliability weighting (W_source) on fact-check queries', () => {
    const query = 'Xác minh sự thật về chiến thắng Ngọc Hồi Đống Đa có đúng hay sai?';
    const res = rerankCandidates(query, sampleCandidates, 2);

    expect(res[0].chunkId).toBe('chunk_1'); // LEVEL_1 source + high keyword relevance
    expect(res.length).toBe(2); // rerankTopK = 2
  });

  it('should preserve and match 2-character historical names like Lê, Lý, Hồ', () => {
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
    const res = rerankCandidates(query, candidates, 2);

    expect(res[0].chunkId).toBe('chunk_le');
    expect(res[0].score).toBeGreaterThan(res[1].score);
  });
});
