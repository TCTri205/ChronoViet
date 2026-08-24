import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  evictOldestCacheEntries,
  embeddingCache,
  MAX_CACHE_SIZE,
  EMBEDDING_DIMENSION,
} from '../embeddings.js';
import {
  resetCircuitBreakers,
  embeddingCircuit,
  recordEmbeddingCircuitFailure,
} from '../circuit-breaker.js';
import {
  metricsRegistry,
} from '../telemetry/metrics.js';

describe('Embedding Service (SSOT 1024-dim Vector Space)', { timeout: 15000 }, () => {
  beforeEach(() => {
    resetCircuitBreakers();
    embeddingCache.clear();
  });

  it('should generate a 1024-dimensional vector for non-empty text', async () => {
    const vec = await generateEmbedding('Trận Bạch Đằng năm 938 Ngô Quyền');
    expect(Array.isArray(vec)).toBe(true);
    expect(vec.length).toBe(EMBEDDING_DIMENSION);
    expect(vec.length).toBe(1024);
  });

  it('should return a zero-vector of 1024 dimensions for empty/blank text', async () => {
    const emptyVec = await generateEmbedding('');
    expect(emptyVec.length).toBe(1024);
    expect(emptyVec.every((val) => val === 0)).toBe(true);

    const whitespaceVec = await generateEmbedding('   ');
    expect(whitespaceVec.length).toBe(1024);
    expect(whitespaceVec.every((val) => val === 0)).toBe(true);
  });

  it('should generate normalized unit vectors (L2 norm ~ 1.0)', async () => {
    const vec = await generateEmbedding('Đại Cồ Việt thời Đinh Tiên Hoàng');
    const normSquare = vec.reduce((sum, v) => sum + v * v, 0);
    expect(Math.abs(Math.sqrt(normSquare) - 1.0)).toBeLessThan(0.01);
  });

  it('should produce deterministic output for identical input strings', async () => {
    const text = 'Chiến dịch Điện Biên Phủ 1954';
    const vec1 = await generateEmbedding(text);
    const vec2 = await generateEmbedding(text);
    expect(vec1).toEqual(vec2);
    expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0, 4);
  });

  it('should calculate cosine similarity correctly', async () => {
    const vecA = await generateEmbedding('Trần Hưng Đạo ba lần đại phá quân Nguyên Mông');
    const vecB = await generateEmbedding('Trần Quốc Tuấn lãnh đạo quân dân nhà Trần đánh Nguyên Mông');
    const vecC = await generateEmbedding('Lập trình web bằng React và Vite frontend');

    const simRelated = cosineSimilarity(vecA, vecB);
    const simUnrelated = cosineSimilarity(vecA, vecC);

    // Related historical topics should have higher similarity than unrelated topics
    expect(simRelated).toBeGreaterThan(simUnrelated);
  });

  it('should batch generate embeddings with consistent dimensions', async () => {
    const inputs = [
      'Quang Trung Nguyễn Huệ',
      'Lê Lợi khởi nghĩa Lam Sơn',
      'Lý Thường Kiệt phạt Tống',
    ];

    const results = await generateEmbeddingsBatch(inputs);
    expect(results.length).toBe(3);
    for (const res of results) {
      expect(res.length).toBe(1024);
    }
  });

  describe('Smooth Partial Cache Eviction (LRU/FIFO)', () => {
    it('should evict oldest entries by specified count without clearing entire cache', () => {
      for (let i = 0; i < 100; i++) {
        embeddingCache.set(`key_${i}`, new Array(1024).fill(i));
      }
      expect(embeddingCache.size).toBe(100);

      // Evict 20 oldest entries
      evictOldestCacheEntries(20);
      expect(embeddingCache.size).toBe(80);

      // Earliest 20 keys should be deleted
      for (let i = 0; i < 20; i++) {
        expect(embeddingCache.has(`key_${i}`)).toBe(false);
      }
      // Remaining 80 keys should still be present
      for (let i = 20; i < 100; i++) {
        expect(embeddingCache.has(`key_${i}`)).toBe(true);
      }
    });

    it('should trigger partial 20% eviction on MAX_CACHE_SIZE overflow', async () => {
      // Pre-fill cache to MAX_CACHE_SIZE
      const dummyVec = new Array(1024).fill(0.1);
      for (let i = 0; i < MAX_CACHE_SIZE; i++) {
        embeddingCache.set(`seed_key_${i}`, dummyVec);
      }
      expect(embeddingCache.size).toBe(MAX_CACHE_SIZE);

      // Generate embedding for a new key to trigger eviction
      await generateEmbedding('new_overflow_key_test');

      const expectedEvictedCount = Math.floor(MAX_CACHE_SIZE * 0.2); // 1000
      const expectedRemaining = MAX_CACHE_SIZE - expectedEvictedCount + 1; // 4001
      expect(embeddingCache.size).toBe(expectedRemaining);
      expect(embeddingCache.has('new_overflow_key_test')).toBe(true);

      // First 1000 seed keys should be gone
      expect(embeddingCache.has('seed_key_0')).toBe(false);
      expect(embeddingCache.has('seed_key_999')).toBe(false);
      // seed_key_1000 should still exist
      expect(embeddingCache.has('seed_key_1000')).toBe(true);
    });
  });

  describe('Circuit Breaker & Telemetry Integration', () => {
    it('should respect circuit breaker FAST_FAIL state when tripped', async () => {
      recordEmbeddingCircuitFailure(new Error('Trip fail 1'));
      recordEmbeddingCircuitFailure(new Error('Trip fail 2'));
      expect(embeddingCircuit.status).toBe('OPEN');

      // generateEmbedding should complete via fallback without throwing in non-strict mode
      const vec = await generateEmbedding('Fallback test during open circuit');
      expect(vec.length).toBe(1024);
    });

    it('should record prometheus metrics on embedding requests', async () => {
      await generateEmbedding('Prometheus metrics observation test');
      const metricsText = await metricsRegistry.metrics();
      expect(metricsText).toContain('chronoviet_embedding_requests_total');
      expect(metricsText).toContain('chronoviet_embedding_duration_seconds');
    });
  });
});
