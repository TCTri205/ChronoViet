import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inMemoryStore, envConfig } from '@chronoviet/infra';
import { ChronoRagEngine } from '../rag-engine.js';

describe('RAG Multi-Query Decomposition & Temporal Branching (Task 1)', { timeout: 20000 }, () => {
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
            relevance_score: 0.95 - idx * 0.05,
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

  it('guarantees retrieval of all 3 Bạch Đằng battles (938, 981, 1288) in multi-epoch query', async () => {
    // 1. Ingest chunks for each of the 3 historic eras
    await engine.ingestDocument(
      'Năm 938, Ngô Quyền chỉ huy quân dân đánh tan quân Nam Hán trên sông Bạch Đằng bằng bãi cọc gỗ bịt sắt lợi dụng con nước thủy triều, giết chết Lưu Hoằng Tháo.',
      {
        title: 'Chiến thắng Bạch Đằng năm 938 - Ngô Quyền',
        source: 'Đại Việt Sử Ký Toàn Thư',
        dynasty: 'Thời kỳ Tự chủ',
        timeStart: 938,
        timeEnd: 938,
        sourceReliability: 'LEVEL_1',
      }
    );

    await engine.ingestDocument(
      'Năm 981, Thập đạo Tướng quân Lê Hoàn (vua Lê Đại Hành triều Tiền Lê) chỉ huy quân dân đánh bại quân Tống trên sông Bạch Đằng, chém tướng Hầu Nhân Bảo, giữ vững độc lập dân tộc.',
      {
        title: 'Chiến thắng Bạch Đằng năm 981 - Lê Hoàn',
        source: 'Đại Việt Sử Ký Toàn Thư',
        dynasty: 'Nhà Tiền Lê',
        timeStart: 981,
        timeEnd: 981,
        sourceReliability: 'LEVEL_1',
      }
    );

    await engine.ingestDocument(
      'Năm 1288, Hưng Đạo Đại Vương Trần Quốc Tuấn chỉ huy quân dân nhà Trần đại phá thủy quân Ô Mã Nhi trên sông Bạch Đằng với quy mô bãi cọc liên hoàn, kết thúc thắng lợi cuộc kháng chiến chống Nguyên Mông.',
      {
        title: 'Đại thắng Bạch Đằng năm 1288 - Trần Hưng Đạo',
        source: 'Đại Việt Sử Ký Toàn Thư',
        dynasty: 'Nhà Trần',
        timeStart: 1288,
        timeEnd: 1288,
        sourceReliability: 'LEVEL_1',
      }
    );

    // 2. Query mentioning all 3 years
    const response = await engine.search({
      query: 'So sánh nghệ thuật quân sự trận địa cọc ngầm qua các trận Bạch Đằng năm 938, 981 và 1288',
      rerankTopK: 6,
      maxTokens: 1500,
    });

    expect(response.verifiedContext.length).toBeGreaterThanOrEqual(3);

    const summaries = response.verifiedContext.map((c) => `${c.title} ${c.summary}`).join(' ');
    const has938 = summaries.includes('938') || summaries.includes('Ngô Quyền');
    const has981 = summaries.includes('981') || summaries.includes('Lê Hoàn');
    const has1288 = summaries.includes('1288') || summaries.includes('Trần');

    expect(has938).toBe(true);
    expect(has981).toBe(true);
    expect(has1288).toBe(true);
  });

  it('decomposes coordinate multi-subject queries into balanced parallel sub-queries', async () => {
    await engine.ingestDocument(
      'Ngô Quyền mở đầu thời kỳ độc lập tự chủ với chiến thắng Bạch Đằng năm 938.',
      {
        title: 'Tiền Ngô Vương Ngô Quyền',
        source: 'Sử liệu',
        dynasty: 'Thời kỳ Tự chủ',
        timeStart: 938,
        timeEnd: 938,
        sourceReliability: 'LEVEL_1',
      }
    );

    await engine.ingestDocument(
      'Quang Trung Nguyễn Huệ lãnh đạo nghĩa quân Tây Sơn đại phá 29 vạn quân Thanh mùa xuân Kỷ Dậu 1789.',
      {
        title: 'Hoàng đế Quang Trung đại thắng quân Thanh 1789',
        source: 'Sử liệu',
        dynasty: 'Nhà Tây Sơn',
        timeStart: 1789,
        timeEnd: 1789,
        sourceReliability: 'LEVEL_1',
      }
    );

    const response = await engine.search({
      query: 'So sánh nghệ thuật tiến công của Ngô Quyền và Quang Trung',
      rerankTopK: 4,
    });

    expect(response.verifiedContext.length).toBeGreaterThanOrEqual(2);
    const titles = response.verifiedContext.map((c) => c.title || '');
    expect(titles.some((t) => t.includes('Ngô Quyền'))).toBe(true);
    expect(titles.some((t) => t.includes('Quang Trung'))).toBe(true);
  });
});
