/**
 * Centralized Zero-Overhead Multi-Tier Cache Architecture with TTL & Float32Array Storage
 * Component of Chrono-RAG Runtime
 */

import type { ExtractedQueryInfo, HistoricalPremiseValidationResult } from './question-ner.js';
import type { LocalGraphSearchResult } from './graph-cte-search.js';

export interface CacheEntry<V> {
  value: V;
  expiresAt?: number;
}

export interface CacheStats {
  size: number;
  maxEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * High-performance, bounded LRU Cache with TTL support and hit/miss statistics.
 */
export class LRUCacheWithTTL<K, V> {
  private readonly map = new Map<K, CacheEntry<V>>();
  private hits = 0;
  private misses = 0;

  constructor(
    public readonly maxEntries: number = 1000,
    public readonly defaultTtlMs?: number
  ) {}

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU order (delete & re-insert)
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    this.map.delete(key);

    if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = effectiveTtl !== undefined ? Date.now() + effectiveTtl : undefined;

    this.map.set(key, { value, expiresAt });
  }

  has(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.map.size;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.map.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number((this.hits / total).toFixed(4)) : 0,
    };
  }
}

/**
 * 1024-dim Float32Array Vector Cache for Query Embeddings (saves ~50% RAM compared to JS number arrays).
 */
export class EmbeddingVectorCache {
  private readonly lru: LRUCacheWithTTL<string, Float32Array>;

  constructor(maxEntries: number = 2000) {
    this.lru = new LRUCacheWithTTL<string, Float32Array>(maxEntries);
  }

  getEmbedding(queryKey: string): number[] | undefined {
    const normalizedKey = queryKey.trim().toLowerCase();
    const floatArr = this.lru.get(normalizedKey);
    if (!floatArr) return undefined;
    return Array.from(floatArr);
  }

  getFloat32(queryKey: string): Float32Array | undefined {
    const normalizedKey = queryKey.trim().toLowerCase();
    return this.lru.get(normalizedKey);
  }

  setEmbedding(queryKey: string, vector: number[] | Float32Array): void {
    const normalizedKey = queryKey.trim().toLowerCase();
    const floatArr = vector instanceof Float32Array ? vector : new Float32Array(vector);
    this.lru.set(normalizedKey, floatArr);
  }

  has(queryKey: string): boolean {
    return this.lru.has(queryKey.trim().toLowerCase());
  }

  clear(): void {
    this.lru.clear();
  }

  size(): number {
    return this.lru.size();
  }

  getStats(): CacheStats {
    return this.lru.getStats();
  }

  getMemoryEstimateBytes(): number {
    // 1 Float32Array of 1024 dims = 4096 bytes + string key overhead (~128 bytes)
    return this.lru.size() * (1024 * 4 + 128);
  }
}

export type QueryNERCacheItem = ExtractedQueryInfo & {
  premiseValidation?: HistoricalPremiseValidationResult;
};

/**
 * Centralized Master Cache Manager Singleton
 */
export class ChronoCacheManager {
  public readonly queryNERCache: LRUCacheWithTTL<string, QueryNERCacheItem>;
  public readonly embeddingVectorCache: EmbeddingVectorCache;
  public readonly graphNeighborhoodCache: LRUCacheWithTTL<string, LocalGraphSearchResult>;

  constructor() {
    // 1. Query NER & Premise Cache: 1,000 entries
    this.queryNERCache = new LRUCacheWithTTL<string, QueryNERCacheItem>(1000);

    // 2. 1024-dim Float32Array Vector Cache: 2,000 entries (~8MB)
    this.embeddingVectorCache = new EmbeddingVectorCache(2000);

    // 3. Graph Neighborhood Cache: 500 entries with 30-min TTL
    this.graphNeighborhoodCache = new LRUCacheWithTTL<string, LocalGraphSearchResult>(
      500,
      30 * 60 * 1000 // 30 minutes
    );
  }

  /**
   * Clears all tiers of the cache deterministically (called on DB re-seed)
   */
  clearAll(): void {
    this.queryNERCache.clear();
    this.embeddingVectorCache.clear();
    this.graphNeighborhoodCache.clear();
  }

  /**
   * Diagnostic summary of all cache tiers and estimated memory usage
   */
  getDiagnostics(): {
    queryNER: CacheStats;
    embeddings: CacheStats & { memoryBytes: number };
    graph: CacheStats;
    totalMemoryEstimateBytes: number;
  } {
    const embStats = this.embeddingVectorCache.getStats();
    const embMemory = this.embeddingVectorCache.getMemoryEstimateBytes();
    const nerMemory = this.queryNERCache.size() * 512;
    const graphMemory = this.graphNeighborhoodCache.size() * 2048;

    return {
      queryNER: this.queryNERCache.getStats(),
      embeddings: { ...embStats, memoryBytes: embMemory },
      graph: this.graphNeighborhoodCache.getStats(),
      totalMemoryEstimateBytes: embMemory + nerMemory + graphMemory,
    };
  }
}

export const globalCacheManager = new ChronoCacheManager();
