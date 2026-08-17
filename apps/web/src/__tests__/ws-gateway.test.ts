import { describe, it, expect, afterEach } from 'vitest';
import http from 'http';
import WebSocket from 'ws';
import { WebSocketGateway } from '../server/ws-gateway';
import { RenderProgressEvent, RenderEvent } from '@chronoviet/shared-spec';

// In-Memory PubSub Stub for deterministic unit testing
class MockRedisPubSubManager {
  private handlers = new Map<string, Set<(event: RenderEvent) => void>>();

  public async subscribeToProject(
    projectId: string,
    handler: (event: RenderEvent) => void
  ): Promise<() => Promise<void>> {
    if (!this.handlers.has(projectId)) {
      this.handlers.set(projectId, new Set());
    }
    this.handlers.get(projectId)!.add(handler);
    return async () => {
      this.handlers.get(projectId)?.delete(handler);
    };
  }

  public async publishRenderEvent(event: RenderEvent): Promise<number> {
    const list = this.handlers.get(event.projectId);
    if (list) {
      for (const h of list) {
        h(event);
      }
    }
    return 1;
  }

  public async close(): Promise<void> {
    this.handlers.clear();
  }
}

describe('WebSocket Gateway Realtime Forwarding', () => {
  let server: http.Server;
  let gateway: WebSocketGateway;
  let mockPubSub: MockRedisPubSubManager;
  let port: number;

  afterEach(async () => {
    if (gateway) {
      await gateway.close();
    }
    if (server && server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('connects client and forwards Redis PubSub render events with full fidelity', async () => {
    server = http.createServer();
    mockPubSub = new MockRedisPubSubManager();
    gateway = new WebSocketGateway(server, mockPubSub as any);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });

    const projectId = 'test_proj_ws_e2e_001';
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws/projects/${projectId}`);

    const receivedMessages: any[] = [];

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
    });

    client.on('message', (data) => {
      receivedMessages.push(JSON.parse(data.toString()));
    });

    // Simulate publishing an event through PubSub
    const testEvent: RenderProgressEvent = {
      projectId,
      type: 'RENDER_PROGRESS',
      status: 'RENDERING',
      progressPercent: 65,
      currentFrame: 650,
      totalFrames: 1000,
      estimatedRemainingSec: 15,
      timestamp: new Date().toISOString(),
    };

    await mockPubSub.publishRenderEvent(testEvent);

    // Wait for client to receive event
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (receivedMessages.length > 0) {
          clearInterval(check);
          resolve();
        }
      }, 20);
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 2000);
    });

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].type).toBe('RENDER_PROGRESS');
    expect(receivedMessages[0].progressPercent).toBe(65);
    expect(receivedMessages[0].projectId).toBe(projectId);

    client.terminate();
  });

  it('rejects WebSocket upgrade for invalid route path', async () => {
    server = http.createServer();
    mockPubSub = new MockRedisPubSubManager();
    gateway = new WebSocketGateway(server, mockPubSub as any);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });

    const client = new WebSocket(`ws://127.0.0.1:${port}/invalid/path`);

    const result = await new Promise<string>((resolve) => {
      client.on('error', () => resolve('error'));
      client.on('close', () => resolve('closed'));
    });

    expect(['error', 'closed']).toContain(result);
    client.terminate();
  });
});
