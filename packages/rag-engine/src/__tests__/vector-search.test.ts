import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as infra from '@chronoviet/infra';
import { inMemoryStore, envConfig } from '@chronoviet/infra';
import { removeVietnameseAccents } from '@chronoviet/shared-spec';
import {
  searchDenseVector,
  searchLexicalFTS,
  searchHybridVectorAndBM25,
  SimpleLRUCache,
  sanitizeFtsQuery,
  getCachedQueryEmbedding,
  resetQueryEmbeddingCacheForTest,
} from '../retrieval/vector-search.js';

describe('Vector Search & Lexical FTS Retrieval', () => {
  beforeEach(() => {
    envConfig.FORCE_OFFLINE = true;
    envConfig.SKIP_PG = true;
    inMemoryStore.clear();
    resetQueryEmbeddingCacheForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetQueryEmbeddingCacheForTest();
  });

  it('should return empty results when store is empty', async () => {
    const dense = await searchDenseVector([1, 0, 0], 5);
    expect(dense).toEqual([]);

    const fts = await searchLexicalFTS('Lý Thường Kiệt', 5);
    expect(fts).toEqual([]);

    const hybrid = await searchHybridVectorAndBM25('Lý Thường Kiệt', [1, 0, 0], 5);
    expect(hybrid).toEqual([]);
  });

  it('should score and rank document chunks by cosine similarity in dense search', async () => {
    inMemoryStore.documentChunks.set('chunk_1', {
      id: 'chunk_1',
      title: 'Khởi nghĩa Lam Sơn',
      text_content: 'Lê Lợi dựng cờ khởi nghĩa ở Lam Sơn, Bình Định Vương.',
      source_reliability: 'LEVEL_1',
      embedding: [1, 0, 0],
    });

    inMemoryStore.documentChunks.set('chunk_2', {
      id: 'chunk_2',
      title: 'Chiến dịch Bạch Đằng',
      text_content: 'Ngô Quyền đại phá quân Nam Hán trên sông Bạch Đằng.',
      source_reliability: 'LEVEL_1',
      embedding: [0, 1, 0],
    });

    const results = await searchDenseVector([1, 0, 0], 2);
    expect(results).toHaveLength(2);
    expect(results[0].chunkId).toBe('chunk_1');
    expect(results[0].score).toBeCloseTo(1.0);
    expect(results[0].rankVector).toBe(1);
    expect(results[1].chunkId).toBe('chunk_2');
    expect(results[1].score).toBeCloseTo(0.0);
  });

  it('should rank document chunks by keyword occurrence in lexical FTS search', async () => {
    inMemoryStore.documentChunks.set('chunk_a', {
      id: 'chunk_a',
      title: 'Đại Việt Sử Ký Toàn Thư',
      text_content: 'Triều đại Lý Thái Tổ ban Chiếu dời đô dời đô về Thăng Long.',
      source_reliability: 'LEVEL_1',
    });

    inMemoryStore.documentChunks.set('chunk_b', {
      id: 'chunk_b',
      title: 'Chiếu dời đô Thăng Long',
      text_content: 'Lý Công Uẩn dời kinh đô về Thăng Long thành phố lớn.',
      source_reliability: 'LEVEL_1',
    });

    const results = await searchLexicalFTS('Chiếu dời đô Thăng Long', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunkId).toBe('chunk_b'); // chunk_b matches words in both title and content
  });

  it('should fuse vector and BM25 search ranks using Reciprocal Rank Fusion (RRF)', async () => {
    inMemoryStore.documentChunks.set('chunk_vec_match', {
      id: 'chunk_vec_match',
      title: 'Trận Như Nguyệt',
      text_content: 'Lý Thường Kiệt chặn đứng quân Tống bên bờ sông Như Nguyệt.',
      source_reliability: 'LEVEL_1',
      embedding: [1, 0, 0],
    });

    inMemoryStore.documentChunks.set('chunk_both_match', {
      id: 'chunk_both_match',
      title: 'Lý Thường Kiệt và bài thơ Thần',
      text_content: 'Nam quốc sơn hà Nam đế cư, bài thơ thần trên sông Như Nguyệt.',
      source_reliability: 'LEVEL_1',
      embedding: [0.9, 0.1, 0],
    });

    const results = await searchHybridVectorAndBM25(
      'Lý Thường Kiệt bài thơ Thần Như Nguyệt',
      [1, 0, 0],
      2
    );

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].title).toBeDefined();
  });

  it('should support Promise<number[]> in searchHybridVectorAndBM25 and searchDenseVector seamlessly', async () => {
    inMemoryStore.documentChunks.set('chunk_async_test', {
      id: 'chunk_async_test',
      title: 'Hịch Tướng Sĩ',
      text_content: 'Trần Quốc Tuấn viết Hịch Tướng Sĩ khích lệ quân sĩ đánh giặc Nguyên Mông.',
      source_reliability: 'LEVEL_1',
      embedding: [0.8, 0.6, 0],
    });

    const embeddingPromise = Promise.resolve([0.8, 0.6, 0]);

    const denseResults = await searchDenseVector(embeddingPromise, 1);
    expect(denseResults).toHaveLength(1);
    expect(denseResults[0].chunkId).toBe('chunk_async_test');
    expect(denseResults[0].score).toBeCloseTo(1.0);

    const hybridResults = await searchHybridVectorAndBM25(
      'Trần Quốc Tuấn Hịch Tướng Sĩ',
      Promise.resolve([0.8, 0.6, 0]),
      1
    );
    expect(hybridResults).toHaveLength(1);
    expect(hybridResults[0].chunkId).toBe('chunk_async_test');
  });

  it('should deduplicate concurrent in-flight embedding requests (anti-thundering herd)', async () => {
    let fetchCalls = 0;
    envConfig.EMBEDDING_API_URL = 'http://localhost:8090/v1/embeddings';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/embeddings')) {
          fetchCalls++;
          await new Promise((resolve) => setTimeout(resolve, 25));
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ embedding: new Array(1024).fill(0.5) }] }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      })
    );

    // Launch 10 concurrent requests for the exact same query
    const promises = Array.from({ length: 10 }, () =>
      getCachedQueryEmbedding('Trần Hưng Đạo đại phá quân Nguyên 1288')
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    expect(results[0]).toHaveLength(1024);
    // Only 1 underlying fetch call should have been made
    expect(fetchCalls).toBe(1);
  });

  it('should clean up in-flight map on rejection so subsequent retries can succeed', async () => {
    let fetchCalls = 0;
    envConfig.EMBEDDING_API_URL = 'http://localhost:8090/v1/embeddings';
    envConfig.EVAL_STRICT = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/embeddings')) {
          fetchCalls++;
          if (fetchCalls === 1) {
            return { ok: false, status: 500, statusText: 'Internal Server Error' } as any;
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ embedding: new Array(1024).fill(0.7) }] }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      })
    );

    // First call rejects
    await expect(getCachedQueryEmbedding('Lê Lợi Lam Sơn Hậu Lê')).rejects.toThrow();

    // Second call should NOT return a rejected promise; it should invoke fetch again and succeed
    const res = await getCachedQueryEmbedding('Lê Lợi Lam Sơn Hậu Lê');
    expect(res).toHaveLength(1024);
    expect(fetchCalls).toBe(2);
    envConfig.EVAL_STRICT = false;
  });

  it('should clear cached embeddings and in-flight map when resetQueryEmbeddingCacheForTest is called', async () => {
    let fetchCalls = 0;
    infra.embeddingCache.clear();
    envConfig.EMBEDDING_API_URL = 'http://localhost:8090/v1/embeddings';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/embeddings')) {
          fetchCalls++;
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ embedding: new Array(1024).fill(0.1) }] }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      })
    );

    await getCachedQueryEmbedding('Quang Trung Nguyễn Huệ Đống Đa');
    expect(fetchCalls).toBe(1);

    // Cache hit in rag-engine queryEmbeddingCache
    await getCachedQueryEmbedding('Quang Trung Nguyễn Huệ Đống Đa');
    expect(fetchCalls).toBe(1);

    // Clear both caches
    resetQueryEmbeddingCacheForTest();
    infra.embeddingCache.clear();

    // Cache miss
    await getCachedQueryEmbedding('Quang Trung Nguyễn Huệ Đống Đa');
    expect(fetchCalls).toBe(2);
  });

  it('should sanitize natural language question query by removing Vietnamese stopwords for FTS', async () => {
    const sanitized = sanitizeFtsQuery('Tại sao vua Quang Trung lại tiến quân thần tốc?');
    expect(sanitized).not.toContain('tại');
    expect(sanitized).not.toContain('sao');
    expect(sanitized).not.toContain('lại');
    expect(sanitized).toContain('quang trung');
    expect(sanitized).toContain('thần tốc');

    inMemoryStore.documentChunks.set('chunk_lam_son', {
      id: 'chunk_lam_son',
      title: 'Khởi nghĩa Lam Sơn',
      text_content: 'Lê Lợi là người khởi xướng và lãnh đạo cuộc khởi nghĩa Lam Sơn thắng lợi.',
      source_reliability: 'LEVEL_1',
    });

    const results = await searchLexicalFTS('Ai là người lãnh đạo cuộc khởi nghĩa Lam Sơn?', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunkId).toBe('chunk_lam_son');
  });

  it('should remove Vietnamese accents and tone marks correctly', () => {
    expect(removeVietnameseAccents('Đại Việt Sử Ký Toàn Thư')).toBe('Dai Viet Su Ky Toan Thu');
    expect(removeVietnameseAccents('Nguyễn Huệ Quang Trung Đống Đa')).toBe('Nguyen Hue Quang Trung Dong Da');
  });

  it('should match document chunks with unaccented or mixed diacritic query terms in lexical FTS', async () => {
    inMemoryStore.documentChunks.set('chunk_quang_trung', {
      id: 'chunk_quang_trung',
      title: 'Vua Quang Trung',
      text_content: 'Nguyễn Huệ chỉ huy quân Tây Sơn thần tốc tiến ra Thăng Long đại phá quân Thanh.',
      source_reliability: 'LEVEL_1',
    });

    // Unaccented query "Nguyen Hue Tay Son"
    const results = await searchLexicalFTS('Nguyen Hue Tay Son', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunkId).toBe('chunk_quang_trung');
  });

  it('should cache and evict query embeddings using LRU policy in SimpleLRUCache', () => {
    const cache = new SimpleLRUCache<string, number[]>(3);

    cache.set('q1', [1, 0]);
    cache.set('q2', [0, 1]);
    cache.set('q3', [1, 1]);

    expect(cache.size()).toBe(3);
    expect(cache.get('q1')).toEqual([1, 0]); // accesses q1, making q2 oldest

    cache.set('q4', [0, 0]); // should evict q2
    expect(cache.size()).toBe(3);
    expect(cache.has('q2')).toBe(false);
    expect(cache.has('q1')).toBe(true);
    expect(cache.has('q3')).toBe(true);
    expect(cache.has('q4')).toBe(true);
  });
});
