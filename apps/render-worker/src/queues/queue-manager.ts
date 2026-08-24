/**
 * BullMQ Queue & Worker Connection Manager
 * Manages tts-gen-queue, vlm-inspect-queue, and remotion-render-queue
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { createLogger, envConfig, formatErrorMessage, bullmqQueueJobsGauge } from '@chronoviet/infra';

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
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

  conn.on('error', (err) => {
    log.warn('bullmq.redis_error', `BullMQ Redis connection error: ${formatErrorMessage(err)}`);
  });

  return conn;
}

let sharedRedisClient: Redis | null = null;

export function getBullMqRedis(): Redis {
  if (!sharedRedisClient || sharedRedisClient.status === 'end') {
    sharedRedisClient = createBullMqRedis();
  }
  return sharedRedisClient;
}

export async function closeSharedRedis(): Promise<void> {
  if (sharedRedisClient) {
    await sharedRedisClient.quit().catch(() => sharedRedisClient?.disconnect());
    sharedRedisClient = null;
  }
}

export function createQueue<T = any>(queueName: string): Queue<T> {
  const connection = createBullMqRedis();
  const queue = new Queue<T>(queueName, {
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

  queue.on('error', (err) => {
    log.warn('bullmq.queue_error', `BullMQ queue error on ${queueName}: ${formatErrorMessage(err)}`);
  });

  return queue;
}

/**
 * Collect and update Prometheus metrics for BullMQ queue depths
 */
export async function collectQueueMetrics(queues: Queue[]): Promise<void> {
  for (const q of queues) {
    try {
      const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
      for (const [state, count] of Object.entries(counts)) {
        bullmqQueueJobsGauge.set({ queue: q.name, state }, count);
      }
    } catch {
      // Ignored to avoid breaking polling cycle
    }
  }
}
