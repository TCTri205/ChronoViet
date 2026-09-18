import * as crypto from 'crypto';
import Redis from 'ioredis';
import { createLogger } from '../logger.js';
import { envConfig } from '../config.js';

const log = createLogger({ service: 'redis-quarantine' });

let rotatorRedisClient: Redis | null = null;
let redisInitAttempted = false;

function maskForLog(key?: string | null): string {
  if (!key) return '<empty>';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '***';
  const prefix = trimmed.startsWith('sk-')
    ? 'sk-'
    : trimmed.startsWith('tvly-')
      ? 'tvly-'
      : trimmed.startsWith('AQ')
        ? 'AQ'
        : trimmed.slice(0, 3);
  return `${prefix}***${trimmed.slice(-4)}`;
}

/**
 * Get or initialize a non-blocking Redis client for API Key & Target Quarantine Persistence.
 */
export function getRotatorRedisClient(): Redis | null {
  if (rotatorRedisClient) return rotatorRedisClient;
  if (redisInitAttempted) return null;

  try {
    const redisUrl = (envConfig && envConfig.REDIS_URL) || process.env.REDIS_URL || 'redis://localhost:6379';
    if (!redisUrl) {
      redisInitAttempted = true;
      return null;
    }

    rotatorRedisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: false,
      enableOfflineQueue: true,
      retryStrategy: (times) => (times > 3 ? null : 100),
    });

    rotatorRedisClient.on('error', (err) => {
      log.debug('rotator.redis_error', `Redis rotator client connection notice: ${err.message}`);
    });

    return rotatorRedisClient;
  } catch (err: any) {
    redisInitAttempted = true;
    log.debug('rotator.redis_init_failed', `Redis init skipped: ${err.message}`);
    return null;
  }
}

export function hashKeyForStorage(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Persist a quarantine entry to Redis with millisecond TTL (PX).
 */
export async function persistQuarantineToRedis(
  namespace: string,
  identifier: string,
  cooldownMs: number,
  metadata: { provider: string; reason?: string }
): Promise<void> {
  const client = getRotatorRedisClient();
  if (!client) return;

  const keyHash = hashKeyForStorage(identifier);
  const redisKey = `chronoviet:quarantine:${namespace}:${keyHash}`;
  const payload = JSON.stringify({
    ...metadata,
    maskedIdentifier: maskForLog(identifier),
    quarantinedUntil: Date.now() + cooldownMs,
  });

  try {
    await client.set(redisKey, payload, 'PX', cooldownMs);
    log.debug('rotator.redis_quarantine_saved', `Persisted quarantine to Redis for ${namespace} [${maskForLog(identifier)}] (TTL: ${cooldownMs}ms)`);
  } catch (err: any) {
    log.debug('rotator.redis_set_failed', `Failed to persist quarantine to Redis: ${err.message}`);
  }
}

/**
 * Clear a quarantine entry from Redis.
 */
export async function clearQuarantineFromRedis(
  namespace: string,
  identifier: string
): Promise<void> {
  const client = getRotatorRedisClient();
  if (!client) return;

  const keyHash = hashKeyForStorage(identifier);
  const redisKey = `chronoviet:quarantine:${namespace}:${keyHash}`;

  try {
    await client.del(redisKey);
  } catch (err: any) {
    log.debug('rotator.redis_del_failed', `Failed to clear quarantine from Redis: ${err.message}`);
  }
}

/**
 * Synchronize quarantine states from Redis to local In-Memory cooldown map (L1 cache).
 */
export async function syncQuarantinesFromRedis(
  namespace: string,
  identifiers: string[],
  cooldownMap: Map<string, number>
): Promise<void> {
  const client = getRotatorRedisClient();
  if (!client || identifiers.length === 0) return;

  try {
    const pipeline = client.pipeline();
    const mapKeys: Array<{ identifier: string; redisKey: string }> = [];

    for (const id of identifiers) {
      const redisKey = `chronoviet:quarantine:${namespace}:${hashKeyForStorage(id)}`;
      pipeline.get(redisKey);
      pipeline.pttl(redisKey);
      mapKeys.push({ identifier: id, redisKey });
    }

    const results = await pipeline.exec();
    if (!results) return;

    for (let i = 0; i < mapKeys.length; i++) {
      const getRes = results[i * 2];
      const pttlRes = results[i * 2 + 1];

      const val = getRes?.[1] as string | null;
      const pttl = (pttlRes?.[1] as number) || -2;

      if (val && pttl > 0) {
        cooldownMap.set(mapKeys[i].identifier, Date.now() + pttl);
        log.info('rotator.redis_quarantine_restored', `Restored active quarantine from Redis for [${maskForLog(mapKeys[i].identifier)}] (Remaining TTL: ${Math.round(pttl / 1000)}s)`);
      }
    }
  } catch (err: any) {
    log.debug('rotator.redis_sync_failed', `Redis sync failed (fallback to RAM): ${err.message}`);
  }
}
