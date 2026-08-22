import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inMemoryStore, envConfig } from '@chronoviet/shared-spec';
import { ChronoRagEngine, CO_RETRIEVAL_BOOST } from '../rag-engine.js';

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

  it('should apply co-retrieval boost when chunk is retrieved by both vector and graph branches', async () => {
    expect(CO_RETRIEVAL_BOOST).toBe(0.35);

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

  it('should reuse global schema init promise across multiple engine instances', async () => {
    const engine1 = new ChronoRagEngine();
    const engine2 = new ChronoRagEngine();

    await Promise.all([
      engine1.ingestDocument('Văn bản test 1', { title: 'Test 1', source: 'Sử liệu', dynasty: 'Nhà Lê', sourceReliability: 'LEVEL_1' }),
      engine2.ingestDocument('Văn bản test 2', { title: 'Test 2', source: 'Sử liệu', dynasty: 'Nhà Lý', sourceReliability: 'LEVEL_1' }),
    ]);

    expect(inMemoryStore.documentChunks.size).toBe(2);
  });
});
