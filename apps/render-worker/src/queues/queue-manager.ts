/**
 * BullMQ Queue & Worker Connection Manager
 * Manages tts-gen-queue, vlm-inspect-queue, and remotion-render-queue
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { createLogger, envConfig } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'render-worker' });

export const QUEUE_NAMES = {
  TTS_GEN: 'tts-gen-queue',
  VLM_INSPECT: 'vlm-inspect-queue',
  REMOTION_RENDER: 'remotion-render-queue',
} as const;

export function createBullMqRedis(): Redis {
  const redisUrl = envConfig.REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';
  const conn = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    lazyConnect: true,
  });

  conn.on('error', (err) => {
    log.debug('bullmq.redis_error', `BullMQ Redis connection error: ${err.message}`);
  });

  return conn;
}

export function getBullMqRedis(): Redis {
  return createBullMqRedis();
}

export function createQueue<T = any>(queueName: string): Queue<T> {
  const connection = createBullMqRedis();
  return new Queue<T>(queueName, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });
}
