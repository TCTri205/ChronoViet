/**
 * BullMQ Render Queue Producer & Job Management
 * SSOT for Video Render job dispatch across Orchestrator, Web API, and Render Worker.
 */

import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { RenderJobPayload } from './interfaces.js';
import { envConfig } from './config.js';
import { createLogger, formatErrorMessage } from './logger.js';

const log = createLogger({ service: 'shared-spec' });

export const REMOTION_RENDER_QUEUE_NAME = 'remotion-render-queue';

let renderQueue: Queue<RenderJobPayload> | null = null;
let queueRedisClient: Redis | null = null;

function getQueueRedisClient(redisUrl?: string): Redis {
  if (!queueRedisClient) {
    const url = redisUrl || envConfig.REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';
    const client = new (Redis as any)(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    client.on('error', (err: any) => {
      log.warn('queues.redis_error', `BullMQ Redis connection error: ${formatErrorMessage(err)}`);
    });
    queueRedisClient = client;
  }
  return queueRedisClient as Redis;
}

export function getRenderQueue(redisUrl?: string): Queue<RenderJobPayload> {
  if (!renderQueue) {
    const connection = getQueueRedisClient(redisUrl);
    renderQueue = new Queue<RenderJobPayload>(REMOTION_RENDER_QUEUE_NAME, {
      connection: connection as any,
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
    renderQueue.on('error', (err: any) => {
      log.warn('queues.render_queue_error', `Render queue error: ${formatErrorMessage(err)}`);
    });
  }
  return renderQueue;
}

export async function enqueueRenderJob(
  projectId: string,
  options: { outputFormat?: 'mp4'; priority?: number; correlationId?: string; redisUrl?: string } = {}
): Promise<{ jobId: string }> {
  const queue = getRenderQueue(options.redisUrl);
  const correlationId = options.correlationId || projectId;
  const targetJobId = `render-${projectId}-${Date.now()}`;

  const job = await queue.add(
    'render-video',
    {
      projectId,
      correlationId,
      outputFormat: options.outputFormat || 'mp4',
      priority: options.priority,
    },
    {
      priority: options.priority,
      jobId: targetJobId,
    }
  );

  log.info('queues.render_enqueued', `Enqueued render job for project ${projectId}`, {
    jobId: job.id,
    projectId,
    correlationId,
  });

  return { jobId: job.id! };
}

export async function getRenderJobStatus(
  jobId: string,
  redisUrl?: string
): Promise<{
  id: string;
  state: string;
  progress: number;
  failedReason?: string;
  returnvalue?: any;
} | null> {
  const queue = getRenderQueue(redisUrl);
  const job: Job<RenderJobPayload> | undefined = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = typeof job.progress === 'number' ? job.progress : 0;

  return {
    id: job.id!,
    state,
    progress,
    failedReason: job.failedReason,
    returnvalue: job.returnvalue,
  };
}

export async function cancelRenderJob(jobId: string, redisUrl?: string): Promise<boolean> {
  const queue = getRenderQueue(redisUrl);
  const job = await queue.getJob(jobId);
  if (!job) return false;

  await job.remove();
  log.info('queues.render_cancelled', `Cancelled render job ${jobId}`);
  return true;
}

export async function closeRenderQueues(): Promise<void> {
  if (renderQueue) {
    await renderQueue.close();
    renderQueue = null;
  }
  if (queueRedisClient) {
    await queueRedisClient.quit().catch(() => {});
    queueRedisClient = null;
  }
}
