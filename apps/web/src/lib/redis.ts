import Redis from 'ioredis';
import { envConfig, createLogger, formatErrorMessage } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'web' });

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const url = envConfig.REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
    redisClient.on('error', (err) => {
      log.debug('web.redis_error', `Web Redis connection error: ${formatErrorMessage(err)}`);
    });
  }
  return redisClient;
}
