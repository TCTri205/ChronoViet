import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  RenderEvent,
} from '@chronoviet/shared-spec';
import {
  RedisPubSubManager,
  createLogger,
  websocketActiveConnectionsGauge,
} from '@chronoviet/infra';

const log = createLogger({ service: 'web-ws' });

export class WebSocketGateway {
  private wss: WebSocketServer;
  private pubsub: RedisPubSubManager;
  private activeSockets = new Set<WebSocket>();

  constructor(server: HttpServer, pubsub?: RedisPubSubManager) {
    this.pubsub = pubsub || new RedisPubSubManager();
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const url = request.url || '';
      const match = url.match(/^\/ws\/projects\/([a-zA-Z0-9_.-]+)$/);

      if (match) {
        const projectId = match[1];
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request, projectId);
        });
      } else {
        socket.destroy();
      }
    });

    this.wss.on('connection', async (ws: WebSocket, request: any, projectId: string) => {
      const correlationId = (request?.headers?.['x-request-id'] as string) || (request?.headers?.['sec-websocket-key'] as string) || projectId;
      const wsLog = log.child({ correlationId, fields: { projectId } });

      this.activeSockets.add(ws);
      websocketActiveConnectionsGauge.set(this.activeSockets.size);

      wsLog.info('ws.client_connected', `WebSocket client connected for project ${projectId}`, { projectId });

      let isAlive = true;
      ws.on('pong', () => {
        isAlive = true;
      });

      const interval = setInterval(() => {
        if (!isAlive) {
          ws.terminate();
          return;
        }
        isAlive = false;
        ws.ping();
      }, 30000);
      interval.unref();

      // Subscribe to Redis PubSub for this project
      const unsubscribe = await this.pubsub.subscribeToProject(projectId, (event: RenderEvent) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(event));
        }
      });

      ws.on('close', async () => {
        clearInterval(interval);
        this.activeSockets.delete(ws);
        websocketActiveConnectionsGauge.set(this.activeSockets.size);
        await unsubscribe().catch(() => {});
        wsLog.info('ws.client_disconnected', `WebSocket client disconnected for project ${projectId}`, { projectId });
      });

      ws.on('error', async (err) => {
        clearInterval(interval);
        this.activeSockets.delete(ws);
        websocketActiveConnectionsGauge.set(this.activeSockets.size);
        await unsubscribe().catch(() => {});
        wsLog.error('ws.client_error', `WebSocket client error for project ${projectId}: ${err.message}`, { error: err });
      });
    });
  }

  public async close(): Promise<void> {
    for (const ws of this.activeSockets) {
      try {
        ws.terminate();
      } catch {}
    }
    this.activeSockets.clear();
    await this.pubsub.close().catch(() => {});
    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
