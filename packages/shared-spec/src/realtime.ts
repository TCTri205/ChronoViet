/**
 * Realtime Event Schemas & Redis PubSub Manager
 * SSOT for Video Render events, Orchestrator SSE streaming, and Project summaries.
 */

import { z } from 'zod';
import Redis from 'ioredis';
import { envConfig } from './config.js';
import { createLogger, formatErrorMessage } from './logger.js';

const log = createLogger({ service: 'shared-spec' });

// ============================================================================
// 1. Render Event Schemas (Redis PubSub channel `project_events:${projectId}`)
// ============================================================================

export const RenderEventTypeSchema = z.enum([
  'RENDER_PROGRESS',
  'RENDER_COMPLETED',
  'RENDER_FAILED',
]);
export type RenderEventType = z.infer<typeof RenderEventTypeSchema>;

export const RenderProgressEventSchema = z.object({
  projectId: z.string(),
  type: z.literal('RENDER_PROGRESS'),
  status: z.literal('RENDERING'),
  progressPercent: z.number().min(0).max(100),
  currentFrame: z.number().int().nonnegative(),
  totalFrames: z.number().int().positive(),
  estimatedRemainingSec: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});
export type RenderProgressEvent = z.infer<typeof RenderProgressEventSchema>;

export const RenderCompletedEventSchema = z.object({
  projectId: z.string(),
  type: z.literal('RENDER_COMPLETED'),
  status: z.literal('COMPLETED'),
  outputPath: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
});
export type RenderCompletedEvent = z.infer<typeof RenderCompletedEventSchema>;

export const RenderFailedEventSchema = z.object({
  projectId: z.string(),
  type: z.literal('RENDER_FAILED'),
  status: z.literal('FAILED'),
  errorMessage: z.string(),
  timestamp: z.string().datetime(),
});
export type RenderFailedEvent = z.infer<typeof RenderFailedEventSchema>;

export const RenderEventSchema = z.discriminatedUnion('type', [
  RenderProgressEventSchema,
  RenderCompletedEventSchema,
  RenderFailedEventSchema,
]);
export type RenderEvent = z.infer<typeof RenderEventSchema>;

// ============================================================================
// 2. SSE Stream Event Schema (Orchestrator pipeline -> Web SSE route)
// ============================================================================

export const SseEventStatusSchema = z.enum([
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'NEEDS_HUMAN_REVIEW',
]);
export type SseEventStatus = z.infer<typeof SseEventStatusSchema>;

export const SseEventSchema = z.object({
  nodeName: z.string(),
  update: z.record(z.string(), z.unknown()),
  state: z.string(),
  status: SseEventStatusSchema,
  projectId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});
export type SseEvent = z.infer<typeof SseEventSchema>;

// ============================================================================
// 3. Project Summary Schema (GET /api/v1/projects)
// ============================================================================

export const ProjectSummarySchema = z.object({
  projectId: z.string(),
  status: z.string(),
  currentStep: z.number().int().nonnegative(),
  title: z.string().optional(),
  topic: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  videoUrl: z.string().optional(),
  progressPercent: z.number().min(0).max(100).optional(),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

// ============================================================================
// 4. Chat Streaming Response Schema (POST /api/v1/chat)
// ============================================================================

export const ChatStreamResponseSchema = z.object({
  type: z.enum(['token', 'citation', 'done', 'error']),
  content: z.string().optional(),
  citations: z.array(z.string()).optional(),
  error: z.string().optional(),
});
export type ChatStreamResponse = z.infer<typeof ChatStreamResponseSchema>;

// ============================================================================
// 5. Redis PubSub Manager
// ============================================================================

export function getProjectEventsChannel(projectId: string): string {
  return `project_events:${projectId}`;
}

export class RedisPubSubManager {
  private publisherClient: Redis | null = null;
  private subscriberClient: Redis | null = null;
  private channelHandlers = new Map<string, Set<(event: RenderEvent) => void>>();
  private redisUrl: string;

  constructor(redisUrl?: string) {
    this.redisUrl = redisUrl || envConfig.REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';
  }

  private createClient(): Redis {
    const client = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
    client.on('error', (err) => {
      log.warn('redis_pubsub.error', `Redis connection error: ${formatErrorMessage(err)}`);
    });
    return client;
  }

  public getPublisher(): Redis {
    if (!this.publisherClient) {
      this.publisherClient = this.createClient();
    }
    return this.publisherClient;
  }

  public getSubscriber(): Redis {
    if (!this.subscriberClient) {
      this.subscriberClient = this.createClient();
      this.subscriberClient.on('message', (channel, message) => {
        const handlers = this.channelHandlers.get(channel);
        if (!handlers || handlers.size === 0) return;

        try {
          const parsed = JSON.parse(message);
          const validated = RenderEventSchema.parse(parsed);
          for (const handler of handlers) {
            try {
              handler(validated);
            } catch (handlerErr: any) {
              log.error('redis_pubsub.handler_error', `Handler failed for channel ${channel}`, {
                error: handlerErr.message,
              });
            }
          }
        } catch (parseErr: any) {
          log.warn('redis_pubsub.invalid_payload', `Invalid payload received on channel ${channel}`, {
            message,
            error: parseErr.message,
          });
        }
      });
    }
    return this.subscriberClient;
  }

  public async publishRenderEvent(event: RenderEvent): Promise<number> {
    const validated = RenderEventSchema.parse(event);
    const channel = getProjectEventsChannel(validated.projectId);
    const publisher = this.getPublisher();
    if (publisher.status !== 'ready' && publisher.status !== 'connecting') {
      await publisher.connect().catch(() => {});
    }
    return await publisher.publish(channel, JSON.stringify(validated));
  }

  public async subscribeToProject(
    projectId: string,
    handler: (event: RenderEvent) => void
  ): Promise<() => Promise<void>> {
    const channel = getProjectEventsChannel(projectId);
    const subscriber = this.getSubscriber();

    if (subscriber.status !== 'ready' && subscriber.status !== 'connecting') {
      await subscriber.connect().catch(() => {});
    }

    if (!this.channelHandlers.has(channel)) {
      this.channelHandlers.set(channel, new Set());
      await subscriber.subscribe(channel);
    }

    const handlers = this.channelHandlers.get(channel)!;
    handlers.add(handler);

    return async () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.channelHandlers.delete(channel);
        try {
          await subscriber.unsubscribe(channel);
        } catch (err: any) {
          log.debug('redis_pubsub.unsubscribe_error', `Unsubscribe error: ${err.message}`);
        }
      }
    };
  }

  public async close(): Promise<void> {
    if (this.subscriberClient) {
      await this.subscriberClient.quit().catch(() => {});
      this.subscriberClient = null;
    }
    if (this.publisherClient) {
      await this.publisherClient.quit().catch(() => {});
      this.publisherClient = null;
    }
    this.channelHandlers.clear();
  }
}
