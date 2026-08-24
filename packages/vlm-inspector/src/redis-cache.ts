/**
 * Real Dual-Layer Redis Cache (SHA-256 + pHash) for VLM Scorer
 */

import Redis from 'ioredis';
import { VlmScoringResult } from '@chronoviet/shared-spec';
import { createLogger, envConfig, formatErrorMessage } from '@chronoviet/infra';

const log = createLogger({ service: 'vlm-inspector' });

export type VLMScoreResult = VlmScoringResult & {
  totalScore: number;
  passed: boolean;
  reasons: string[];
};

let redisClient: Redis | null = null;
const MAX_MEMORY_CACHE_ENTRIES = 1000;
const memoryCache = new Map<string, { result: VLMScoreResult; expiresAt: number }>();
const CACHE_TTL_SECONDS = 7 * 24 * 3600; // 7 days

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  try {
    const redisUrl = envConfig.REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: (times) => (times > 2 ? null : 100),
    });

    redisClient.on('error', (err) => {
      log.warn('vlm.redis_error', `Redis connection error: ${formatErrorMessage(err)}`);
    });
  } catch (err: any) {
    log.warn('vlm.redis_init_failed', `Redis init skipped: ${formatErrorMessage(err)}`);
    redisClient = null;
  }

  return redisClient;
}

export interface CacheLookupOptions {
  imageSha256?: string;
  imagePHash?: string;
  contextHash?: string;
}

export async function getCachedVLMScore(
  optionsOrSha?: string | CacheLookupOptions,
  imagePHash?: string,
  contextHash?: string
): Promise<VLMScoreResult | null> {
  let sha: string | undefined;
  let phash: string | undefined;
  let ctx: string | undefined;

  if (typeof optionsOrSha === 'object' && optionsOrSha !== null) {
    sha = optionsOrSha.imageSha256;
    phash = optionsOrSha.imagePHash;
    ctx = optionsOrSha.contextHash;
  } else {
    sha = optionsOrSha;
    phash = imagePHash;
    ctx = contextHash;
  }

  const keys: string[] = [];
  const ctxSuffix = ctx ? `:ctx:${ctx}` : '';
  if (sha) keys.push(`vlm:sha256:${sha}${ctxSuffix}`);
  if (phash) keys.push(`vlm:phash:${phash}${ctxSuffix}`);

  // 1. Check in-memory fallback cache
  for (const key of keys) {
    const mem = memoryCache.get(key);
    if (mem && mem.expiresAt > Date.now()) {
      return { ...mem.result, scorerType: 'REDIS_CACHE' };
    }
  }

  // 2. Check Redis
  const client = getRedisClient();
  if (client) {
    try {
      for (const key of keys) {
        const cached = await client.get(key);
        if (cached) {
          const parsed = JSON.parse(cached) as VLMScoreResult;
          // Sync into memory cache
          memoryCache.set(key, { result: parsed, expiresAt: Date.now() + 60000 });
          return { ...parsed, scorerType: 'REDIS_CACHE' };
        }
      }
    } catch {
      // Redis unavailable, skip
    }
  }

  return null;
}

export async function setCachedVLMScore(
  result: VLMScoreResult,
  optionsOrSha?: string | CacheLookupOptions,
  imagePHash?: string,
  contextHash?: string
): Promise<void> {
  let sha: string | undefined;
  let phash: string | undefined;
  let ctx: string | undefined;

  if (typeof optionsOrSha === 'object' && optionsOrSha !== null) {
    sha = optionsOrSha.imageSha256;
    phash = optionsOrSha.imagePHash;
    ctx = optionsOrSha.contextHash;
  } else {
    sha = optionsOrSha;
    phash = imagePHash;
    ctx = contextHash;
  }

  const keys: string[] = [];
  const ctxSuffix = ctx ? `:ctx:${ctx}` : '';
  if (sha) keys.push(`vlm:sha256:${sha}${ctxSuffix}`);
  if (phash) keys.push(`vlm:phash:${phash}${ctxSuffix}`);

  // 1. Store in memory cache with bounded capacity eviction
  const expiresAt = Date.now() + CACHE_TTL_SECONDS * 1000;
  for (const key of keys) {
    if (memoryCache.size >= MAX_MEMORY_CACHE_ENTRIES) {
      const oldestKey = memoryCache.keys().next().value;
      if (oldestKey) memoryCache.delete(oldestKey);
    }
    memoryCache.set(key, { result, expiresAt });
  }

  // 2. Store in Redis
  const client = getRedisClient();
  if (client) {
    try {
      const payload = JSON.stringify(result);
      for (const key of keys) {
        await client.set(key, payload, 'EX', CACHE_TTL_SECONDS);
      }
    } catch {
      // Redis unavailable, skip
    }
  }
}
