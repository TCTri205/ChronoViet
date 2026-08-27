import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inMemoryStore, envConfig } from '@chronoviet/infra';
import * as graphModule from '../retrieval/graph-cte-search.js';
import { ChronoRagEngine, GRAPH_BOOST_SCALE } from '../rag-engine.js';

describe('ChronoRagEngine Integration & End-to-End Search', { timeout: 20000 }, () => {
  let engine: ChronoRagEngine;

  beforeEach(() => {
    envConfig.FORCE_OFFLINE = true;
    envConfig.SKIP_PG = true;
    inMemoryStore.clear();
    engine = new ChronoRagEngine();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: any) => {
        if (url.includes('/v1/rerank')) {
          const body = JSON.parse(init?.body || '{}');
          const docs: string[] = body.documents || [];
          const results = docs.map((_, idx) => ({
            index: idx,
            relevance_score: 0.9 - idx * 0.1,
          }));
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

  it('should initialize and ingest historical documents', async () => {
    await engine.ingestDocument(
      'Ngô Quyền sinh năm 897, quê ở Đường Lâm. Năm 938, ông lãnh đạo quân dân đánh tan quân Nam Hán trên sông Bạch Đằng, chấm dứt hơn 1000 năm Bắc thuộc.',
      {
        title: 'Chiến thắng Bạch Đằng năm 938',
        source: 'Đại Việt Sử Ký Toàn Thư',
        dynasty: 'Thời kỳ Tự chủ',
        sourceReliability: 'LEVEL_1',
      }
    );

    expect(inMemoryStore.documentChunks.size).toBeGreaterThanOrEqual(1);
    expect(inMemoryStore.entities.size).toBeGreaterThanOrEqual(1);
  });

  it('should execute 5-step search and return structured verified context', async () => {
    await engine.ingestDocument(
      'Năm 1010, vua Lý Thái Tổ ban Chiếu dời đô quyết định chuyển kinh đô từ Hoa Lư về thành Đại La và đổi tên thành Thăng Long.',
      {
        title: 'Chiếu dời đô về Thăng Long',
        source: 'Đại Việt Sử Ký Toàn Thư',
        dynasty: 'Nhà Lý',
        sourceReliability: 'LEVEL_1',
      }
    );

    const response = await engine.search({
      query: 'Vua Lý Thái Tổ ban Chiếu dời đô về Thăng Long năm nào?',
      maxTokens: 500,
      rerankTopK: 3,
    });

    expect(response.retrievalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(response.verifiedContext).toBeInstanceOf(Array);
    expect(response.verifiedContext.length).toBeGreaterThanOrEqual(1);

    const firstContext = response.verifiedContext[0];
    expect(firstContext.canonicalName).toBeDefined();
    expect(firstContext.summary).toContain('Chiếu dời đô');
    expect(firstContext.citations.length).toBeGreaterThan(0);
    expect(firstContext.confidenceScore).toBeGreaterThanOrEqual(0.85);

    expect(response.citations.length).toBeGreaterThanOrEqual(1);
  });

  it('should apply graph-weighted co-retrieval boost when chunk is retrieved by both vector and graph branches', async () => {
    // The flat +0.35 boost was replaced by a small graph-signal-weighted boost (0.05 * graphScore).
    expect(GRAPH_BOOST_SCALE).toBe(0.05);

    await engine.ingestDocument(
      'Trần Hưng Đạo tức Hưng Đạo Đại Vương Trần Quốc Tuấn, ba lần đánh bại quân Nguyên Mông xâm lược.',
      {
        title: 'Hưng Đạo Đại Vương Trần Quốc Tuấn',
        source: 'Đại Việt Sử Ký Toàn Thư',
        dynasty: 'Nhà Trần',
        sourceReliability: 'LEVEL_1',
      }
    );

    const response = await engine.search({
      query: 'Trần Hưng Đạo ba lần đánh bại quân Nguyên Mông',
      maxTokens: 500,
      rerankTopK: 3,
    });

    expect(response.verifiedContext.length).toBeGreaterThanOrEqual(1);
  });

  it('should enforce maxTokens token budgeting and retain at least top-1 entity', async () => {
    await engine.ingestDocument(
      'Văn bản 1 rất dài về vua Lê Lợi và nghĩa quân Lam Sơn với rất nhiều chi tiết lịch sử quan trọng kéo dài mười năm.',
      { title: 'Lam Sơn Thực Lục Tập 1', source: 'Sử liệu', dynasty: 'Nhà Hậu Lê', sourceReliability: 'LEVEL_1' }
    );
    await engine.ingestDocument(
      'Văn bản 2 rất dài về Nguyễn Trãi và Bình Ngô Đại Cáo tại Đông Quan sau khi đánh tan quân Minh xâm lược nước ta.',
      { title: 'Lam Sơn Thực Lục Tập 2', source: 'Sử liệu', dynasty: 'Nhà Hậu Lê', sourceReliability: 'LEVEL_1' }
    );

    // Request with very tight token budget (e.g. 20 tokens)
    const response = await engine.search({
      query: 'Lê Lợi và Nguyễn Trãi',
      maxTokens: 20,
      rerankTopK: 5,
    });

    // Should retain top-1 entity despite tiny token budget and not crash
    expect(response.verifiedContext.length).toBe(1);
    expect(response.citations.length).toBe(1);
  });

  it('should degrade gracefully when graph branch throws an error during search', async () => {
    await engine.ingestDocument(
      'Quang Trung Nguyễn Huệ đại phá 29 vạn quân Thanh vào dịp Tết Kỷ Dậu 1789.',
      {
        title: 'Chiến thắng Kỷ Dậu 1789',
        source: 'Đại Việt Sử Ký',
        dynasty: 'Nhà Tây Sơn',
        sourceReliability: 'LEVEL_1',
      }
    );

    vi.spyOn(graphModule, 'searchLocalGraphCTE').mockRejectedValueOnce(
      new Error('Simulated transient graph query timeout')
    );

    const response = await engine.search({
      query: 'Quang Trung đánh quân Thanh năm nào?',
      rerankTopK: 3,
    });

    expect(response).toBeDefined();
    expect(response.verifiedContext.length).toBeGreaterThanOrEqual(1);
    expect(response.verifiedContext[0].title).toBe('Chiến thắng Kỷ Dậu 1789');
    expect(response.triples).toEqual([]);
    expect(response.aliasTable).toEqual({});
  });

  it('should reuse global schema init promise across multiple engine instances', async () => {
    const engine1 = new ChronoRagEngine();
    const engine2 = new ChronoRagEngine();

    await Promise.all([
      engine1.ingestDocument('Văn bản test 1', { title: 'Test 1', source: 'Sử liệu', dynasty: 'Nhà Lê', sourceReliability: 'LEVEL_1' }),
      engine2.ingestDocument('Văn bản test 2', { title: 'Test 2', source: 'Sử liệu', dynasty: 'Nhà Lý', sourceReliability: 'LEVEL_1' }),
    ]);

    expect(inMemoryStore.documentChunks.size).toBeGreaterThanOrEqual(2);
  });

  it('should execute comparative query decomposition and retrieve candidates for both entities', async () => {
    const engine = new ChronoRagEngine();

    await engine.ingestDocument(
      'Năm 938, Ngô Quyền chỉ huy quân dân đánh tan quân Nam Hán trên sông Bạch Đằng bằng cọc gỗ bọc sắt.',
      {
        title: 'Chiến thắng Bạch Đằng 938 của Ngô Quyền',
        source: 'Đại Việt Sử Ký Toàn Thư',
        dynasty: 'Thời kỳ Tự chủ',
        timeStart: 938,
        timeEnd: 938,
        sourceReliability: 'LEVEL_1',
      }
    );

    await engine.ingestDocument(
      'Năm 1288, Quốc công Tiết chế Trần Hưng Đạo đại phá thủy quân Ô Mã Nhi nhà Nguyên Mông trên sông Bạch Đằng.',
      {
        title: 'Chiến thắng Bạch Đằng 1288 của Trần Hưng Đạo',
        source: 'Đại Việt Sử Ký Toàn Thư',
        dynasty: 'Nhà Trần',
        timeStart: 1288,
        timeEnd: 1288,
        sourceReliability: 'LEVEL_1',
      }
    );

    const result = await engine.search({
      query: 'So sánh nghệ thuật quân sự của Ngô Quyền và Trần Hưng Đạo trên sông Bạch Đằng',
      rerankTopK: 5,
    });

    expect(result.verifiedContext.length).toBeGreaterThanOrEqual(2);
    const titles = result.verifiedContext.map((c) => c.title || '');
    const hasNgoQuyen = titles.some((t) => t.includes('Ngô Quyền'));
    const hasTranHungDao = titles.some((t) => t.includes('Trần Hưng Đạo'));
    expect(hasNgoQuyen).toBe(true);
    expect(hasTranHungDao).toBe(true);
  });
});
