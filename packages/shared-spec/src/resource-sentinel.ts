import * as os from 'os';
import Redis from 'ioredis';
import { envConfig } from './config.js';
import { createLogger } from './logger.js';

const log = createLogger({ service: 'shared-spec' });

export interface MemoryStatus {
  totalMemoryMb: number;
  freeMemoryMb: number;
  usedMemoryMb: number;
  usedMemoryPercent: number;
  isUnderPressure: boolean;
  cached: boolean;
  timestamp: number;
}

export interface OffloadDecision {
  shouldOffload: boolean;
  reason?: string;
}

let redisClient: Redis | null = null;
let redisInitialized = false;

function getRedisClient(): Redis | null {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  if (typeof process === 'undefined' || !process?.versions?.node) {
    return null;
  }

  const redisUrl = envConfig.REDIS_URL || 'redis://localhost:6379';
  try {
    const client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      commandTimeout: 1000,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 2) return null;
        return Math.min(times * 100, 500);
      },
    });

    client.on('error', (err) => {
      log.debug('resource_sentinel.redis_notice', `Redis connection notice: ${err.message}`);
    });

    redisClient = client;
    return redisClient;
  } catch (err: any) {
    log.debug('resource_sentinel.redis_init_failed', `Redis init skipped: ${err.message}`);
    return null;
  }
}

export class ResourceSentinel {
  private static memoryCache: MemoryStatus | null = null;
  private static cacheDebounceMs = 3000;
  private static customMemoryProvider: (() => { totalBytes: number; freeBytes: number }) | null = null;

  // In-memory fallback lock state
  private static inMemoryLocked = false;
  private static inMemoryLockHolder: string | null = null;
  private static inMemoryLockExpiresAt = 0;

  /**
   * Reset internal caches and mock states (primarily for testing).
   */
  public static resetForTesting(): void {
    this.memoryCache = null;
    this.customMemoryProvider = null;
    this.inMemoryLocked = false;
    this.inMemoryLockHolder = null;
    this.inMemoryLockExpiresAt = 0;
  }

  /**
   * Set a custom memory provider (e.g. for deterministic unit testing).
   */
  public static setMemoryProvider(provider: (() => { totalBytes: number; freeBytes: number }) | null): void {
    this.customMemoryProvider = provider;
    this.memoryCache = null;
  }

  /**
   * Set custom debounce interval for memory cache (ms).
   */
  public static setCacheDebounceMs(ms: number): void {
    this.cacheDebounceMs = ms;
  }

  /**
   * Query real-time or debounced (3s cache) host RAM metrics.
   */
  public static getMemoryStatus(forceFresh = false): MemoryStatus {
    const now = Date.now();
    if (!forceFresh && this.memoryCache && now - this.memoryCache.timestamp < this.cacheDebounceMs) {
      return {
        ...this.memoryCache,
        cached: true,
      };
    }

    let totalBytes: number;
    let freeBytes: number;

    if (this.customMemoryProvider) {
      const custom = this.customMemoryProvider();
      totalBytes = custom.totalBytes;
      freeBytes = custom.freeBytes;
    } else {
      totalBytes = os.totalmem();
      freeBytes = os.freemem();
    }

    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const totalMemoryMb = Math.round(totalBytes / (1024 * 1024));
    const freeMemoryMb = Math.round(freeBytes / (1024 * 1024));
    const usedMemoryMb = Math.round(usedBytes / (1024 * 1024));
    const usedMemoryPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 10000) / 100 : 0;
    const threshold = envConfig.MEMORY_PRESSURE_THRESHOLD_PCT ?? 85;
    const isUnderPressure = usedMemoryPercent >= threshold;

    const status: MemoryStatus = {
      totalMemoryMb,
      freeMemoryMb,
      usedMemoryMb,
      usedMemoryPercent,
      isUnderPressure,
      cached: false,
      timestamp: now,
    };

    this.memoryCache = status;
    return status;
  }

  /**
   * Acquire a Distributed Render Lock via Redis (or in-memory fallback).
   */
  public static async acquireRenderLock(
    ttlSeconds = envConfig.RENDER_MUTEX_TTL_SECONDS ?? 900,
    holderId = 'default_worker'
  ): Promise<boolean> {
    const client = getRedisClient();
    const lockKey = envConfig.RENDER_MUTEX_LOCK_KEY || 'chronoviet:render_lock';

    if (client) {
      try {
        if (client.status === 'wait') {
          await client.connect().catch(() => {});
        }
        if (client.status === 'ready' || client.status === 'connect') {
          let res: string | null = null;
          if (ttlSeconds < 1) {
            const ttlMs = Math.max(50, Math.round(ttlSeconds * 1000));
            res = await client.set(lockKey, holderId, 'PX', ttlMs, 'NX');
          } else {
            res = await client.set(lockKey, holderId, 'EX', Math.round(ttlSeconds), 'NX');
          }
          if (res === 'OK') {
            log.info('resource_sentinel.render_lock_acquired_redis', `Distributed render lock acquired in Redis for [${holderId}] (TTL: ${ttlSeconds}s)`);
            return true;
          }
          // Already locked in Redis
          return false;
        }
      } catch (err: any) {
        log.debug('resource_sentinel.redis_acquire_error', `Redis lock acquire fallback to in-memory: ${err.message}`);
      }
    }

    // In-memory fallback
    const now = Date.now();
    if (this.inMemoryLocked && now < this.inMemoryLockExpiresAt) {
      return false;
    }

    this.inMemoryLocked = true;
    this.inMemoryLockHolder = holderId;
    this.inMemoryLockExpiresAt = now + ttlSeconds * 1000;
    log.info('resource_sentinel.render_lock_acquired_memory', `Render lock acquired in-memory for [${holderId}] (TTL: ${ttlSeconds}s)`);
    return true;
  }

  /**
   * Release the Distributed Render Lock.
   */
  public static async releaseRenderLock(holderId?: string): Promise<boolean> {
    const client = getRedisClient();
    const lockKey = envConfig.RENDER_MUTEX_LOCK_KEY || 'chronoviet:render_lock';
    let redisAttempted = false;
    let releasedInRedis = false;

    if (client) {
      try {
        if (client.status === 'wait') {
          await client.connect().catch(() => {});
        }
        if (client.status === 'ready' || client.status === 'connect') {
          redisAttempted = true;
          if (holderId) {
            const currentVal = await client.get(lockKey);
            if (currentVal === holderId) {
              await client.del(lockKey);
              releasedInRedis = true;
            }
          } else {
            const deleted = await client.del(lockKey);
            releasedInRedis = deleted > 0;
          }
          if (releasedInRedis) {
            log.info('resource_sentinel.render_lock_released_redis', `Render lock released in Redis for [${holderId || 'any'}]`);
          }
        }
      } catch (err: any) {
        log.debug('resource_sentinel.redis_release_error', `Redis lock release error: ${err.message}`);
      }
    }

    // Check in-memory lock
    if (this.inMemoryLocked) {
      if (!holderId || this.inMemoryLockHolder === holderId) {
        this.inMemoryLocked = false;
        this.inMemoryLockHolder = null;
        this.inMemoryLockExpiresAt = 0;
        log.info('resource_sentinel.render_lock_released_memory', `Render lock released in-memory for [${holderId || 'any'}]`);
        return true;
      }
      // Mismatched holder in-memory
      return false;
    }

    if (redisAttempted) {
      return releasedInRedis;
    }

    return true;
  }

  /**
   * Check whether the Render Mutex lock is currently active.
   */
  public static async isRenderLocked(): Promise<boolean> {
    const client = getRedisClient();
    const lockKey = envConfig.RENDER_MUTEX_LOCK_KEY || 'chronoviet:render_lock';

    if (client) {
      try {
        if (client.status === 'wait') {
          await client.connect().catch(() => {});
        }
        if (client.status === 'ready' || client.status === 'connect') {
          const exists = await client.exists(lockKey);
          return exists === 1;
        }
      } catch (err: any) {
        log.debug('resource_sentinel.redis_check_error', `Redis lock check fallback to in-memory: ${err.message}`);
      }
    }

    // In-memory fallback
    const now = Date.now();
    if (this.inMemoryLocked && now < this.inMemoryLockExpiresAt) {
      return true;
    }
    if (this.inMemoryLocked && now >= this.inMemoryLockExpiresAt) {
      this.inMemoryLocked = false;
      this.inMemoryLockHolder = null;
      this.inMemoryLockExpiresAt = 0;
    }
    return false;
  }

  /**
   * Evaluate whether AI requests should be offloaded directly to Cloud API
   * based on active Render Mutex or Host RAM pressure.
   */
  public static async shouldOffloadToCloud(): Promise<OffloadDecision> {
    if (envConfig.AI_STANDBY_ON_RENDER) {
      const locked = await this.isRenderLocked();
      if (locked) {
        return {
          shouldOffload: true,
          reason: 'Render mutex is active (video rendering in progress; local AI standby enabled)',
        };
      }
    }

    const mem = this.getMemoryStatus();
    if (mem.isUnderPressure) {
      return {
        shouldOffload: true,
        reason: `Host memory under pressure (${mem.usedMemoryPercent}% used >= ${envConfig.MEMORY_PRESSURE_THRESHOLD_PCT}% threshold)`,
      };
    }

    return {
      shouldOffload: false,
    };
  }
}

export const resourceSentinel = ResourceSentinel;
