import { Queue, Job } from 'bullmq';
import { RenderJobPayload, createLogger, formatErrorMessage } from '@chronoviet/shared-spec';
import { getRedisClient } from './redis';


const log = createLogger({ service: 'web' });

export const REMOTION_RENDER_QUEUE_NAME = 'remotion-render-queue';

let renderQueue: Queue<RenderJobPayload> | null = null;

export function getRenderQueue(): Queue<RenderJobPayload> {
  if (!renderQueue) {
    const connection = getRedisClient();
    renderQueue = new Queue<RenderJobPayload>(REMOTION_RENDER_QUEUE_NAME, {
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
    renderQueue.on('error', (err) => {
      log.warn('web.render_queue_redis_error', `Render queue Redis connection error: ${formatErrorMessage(err)}`);
    });
  }
  return renderQueue;
}

export async function enqueueRenderJob(
  projectId: string,
  options: { outputFormat?: 'mp4'; priority?: number; correlationId?: string } = {}
): Promise<{ jobId: string }> {
  const queue = getRenderQueue();
  const correlationId = options.correlationId || projectId;
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
      jobId: `render-${projectId}-${Date.now()}`,
    }
  );

  log.info('web.render_enqueued', `Enqueued render job for project ${projectId}`, {
    jobId: job.id,
    projectId,
    correlationId,
  });

  return { jobId: job.id! };
}

export async function getRenderJobStatus(jobId: string): Promise<{
  id: string;
  state: string;
  progress: number;
  failedReason?: string;
  returnvalue?: any;
} | null> {
  const queue = getRenderQueue();
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

export async function cancelRenderJob(jobId: string): Promise<boolean> {
  const queue = getRenderQueue();
  const job = await queue.getJob(jobId);
  if (!job) return false;

  await job.remove();
  log.info('web.render_cancelled', `Cancelled render job ${jobId}`);
  return true;
}

export async function closeQueues(): Promise<void> {
  if (renderQueue) {
    await renderQueue.close();
    renderQueue = null;
  }
}
