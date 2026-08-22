import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rerankWithLocalCrossEncoder } from '../reranker-client.js';

describe('reranker-client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns empty array when query or documents are empty', async () => {
    const res1 = await rerankWithLocalCrossEncoder('', ['doc 1']);
    expect(res1).toEqual([]);

    const res2 = await rerankWithLocalCrossEncoder('query', []);
    expect(res2).toEqual([]);
  });

  it('parses TEI / Cohere format results correctly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { index: 1, relevance_score: 0.92 },
          { index: 0, relevance_score: 0.45 },
        ],
      }),
    } as any);

    const results = await rerankWithLocalCrossEncoder('Chiến thắng Bạch Đằng', [
      'Tài liệu 1',
      'Tài liệu 2',
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ index: 1, score: 0.92 });
    expect(results[1]).toEqual({ index: 0, score: 0.45 });
  });

  it('converts logit to sigmoid score if logit format is returned', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ index: 0, logit: 0.0 }],
      }),
    } as any);

    const results = await rerankWithLocalCrossEncoder('Test', ['Doc']);
    expect(results[0].score).toBeCloseTo(0.5, 4);
  });

  it('throws error when response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    } as any);

    await expect(
      rerankWithLocalCrossEncoder('Test', ['Doc'])
    ).rejects.toThrow('[LOCAL_RERANK_ERROR]');
  });
});
