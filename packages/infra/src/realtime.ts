/**
 * Realtime Redis PubSub Manager
 * SSOT for Video Render events, Orchestrator SSE streaming, and Project summaries.
 */

import Redis from 'ioredis';
import {
  RenderEvent,
  RenderEventSchema,
  getProjectEventsChannel,
} from '@chronoviet/shared-spec';
import { envConfig } from './config.js';
import { createLogger, formatErrorMessage } from './logger.js';

const log = createLogger({ service: 'infra-pubsub' });

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
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
    client.on('error', (err: Error) => {
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
      this.subscriberClient.on('message', (channel: string, message: string) => {
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
