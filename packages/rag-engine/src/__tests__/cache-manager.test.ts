import { describe, it, expect, vi } from 'vitest';
import {
  LRUCacheWithTTL,
  EmbeddingVectorCache,
  ChronoCacheManager,
  globalCacheManager,
} from '../retrieval/cache-manager.js';

describe('LRUCacheWithTTL', () => {
  it('should store and retrieve items', () => {
    const cache = new LRUCacheWithTTL<string, string>(5);
    cache.set('a', 'apple');
    cache.set('b', 'banana');

    expect(cache.get('a')).toBe('apple');
    expect(cache.get('b')).toBe('banana');
    expect(cache.get('c')).toBeUndefined();
    expect(cache.size()).toBe(2);
  });

  it('should evict least recently used entries when capacity is exceeded', () => {
    const cache = new LRUCacheWithTTL<string, number>(3);
    cache.set('k1', 1);
    cache.set('k2', 2);
    cache.set('k3', 3);

    // Access k1 so k2 becomes the least recently used
    cache.get('k1');

    // Add k4 -> should evict k2
    cache.set('k4', 4);

    expect(cache.has('k1')).toBe(true);
    expect(cache.has('k2')).toBe(false);
    expect(cache.has('k3')).toBe(true);
    expect(cache.has('k4')).toBe(true);
    expect(cache.size()).toBe(3);
  });

  it('should respect TTL expiration', async () => {
    const cache = new LRUCacheWithTTL<string, string>(5, 50); // 50ms TTL
    cache.set('temp', 'value');

    expect(cache.get('temp')).toBe('value');
    expect(cache.has('temp')).toBe(true);

    // Wait 60ms for expiration
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(cache.has('temp')).toBe(false);
    expect(cache.get('temp')).toBeUndefined();
  });

  it('should track hit/miss statistics accurately', () => {
    const cache = new LRUCacheWithTTL<string, string>(5);
    cache.set('k1', 'v1');

    cache.get('k1'); // hit
    cache.get('k1'); // hit
    cache.get('k2'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.6667, 2);
  });
});

describe('EmbeddingVectorCache (Float32Array)', () => {
  it('should compress number[] to Float32Array and reconstruct accurately', () => {
    const cache = new EmbeddingVectorCache(10);
    const originalVec = [0.12345, -0.6789, 0.9999, 0.0, -1.0];
    cache.setEmbedding('test query', originalVec);

    const retrieved = cache.getEmbedding('test query');
    expect(retrieved).toBeDefined();
    expect(retrieved?.length).toBe(originalVec.length);

    // Verify Float32 precision
    for (let i = 0; i < originalVec.length; i++) {
      expect(retrieved![i]).toBeCloseTo(originalVec[i], 4);
    }

    const float32 = cache.getFloat32('test query');
    expect(float32).toBeInstanceOf(Float32Array);
    expect(cache.getMemoryEstimateBytes()).toBeGreaterThan(0);
  });

  it('should handle case-insensitive query normalization', () => {
    const cache = new EmbeddingVectorCache(10);
    cache.setEmbedding('  Quang Trung  ', [1.0, 2.0, 3.0]);

    expect(cache.has('quang trung')).toBe(true);
    expect(cache.getEmbedding('QUANG TRUNG')).toBeDefined();
  });
});

describe('ChronoCacheManager Integration', () => {
  it('should clear all cache tiers on clearAll()', () => {
    const manager = new ChronoCacheManager();

    manager.queryNERCache.set('q1', { entityIds: ['e1'], entityNames: ['E1'], keywords: [], extractedYears: [] });
    manager.embeddingVectorCache.setEmbedding('q1', [0.1, 0.2]);
    manager.graphNeighborhoodCache.set('g1', { triples: [], aliasTable: {}, entityIds: ['e1'] });

    expect(manager.queryNERCache.size()).toBe(1);
    expect(manager.embeddingVectorCache.size()).toBe(1);
    expect(manager.graphNeighborhoodCache.size()).toBe(1);

    const diagBefore = manager.getDiagnostics();
    expect(diagBefore.totalMemoryEstimateBytes).toBeGreaterThan(0);

    manager.clearAll();

    expect(manager.queryNERCache.size()).toBe(0);
    expect(manager.embeddingVectorCache.size()).toBe(0);
    expect(manager.graphNeighborhoodCache.size()).toBe(0);
  });
});
