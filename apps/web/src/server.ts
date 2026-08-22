import http from 'http';
import { parse } from 'url';
import next from 'next';
import { createLogger, envConfig } from '@chronoviet/shared-spec';
import { WebSocketGateway } from './server/ws-gateway';
import { closeQueues } from './lib/queues';

const log = createLogger({ service: 'web-server' });

const dev = envConfig.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = envConfig.PORT || 3000;

async function bootstrap() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err: any) {
      log.error('server.request_error', `HTTP handler error: ${err.message}`, { error: err });
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Initialize WebSocket Gateway on same HTTP server
  const wsGateway = new WebSocketGateway(server);

  server.listen(port, () => {
    log.info('server.ready', `> ChronoViet Web & API Server ready on http://${hostname}:${port}`);
  });

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log.info('server.shutdown', `Received ${signal}, gracefully shutting down server...`);

    try {
      // 1. Close WebSocket Gateway connections and subscriptions
      await wsGateway.close().catch((err) => {
        log.warn('server.ws_close_error', `Error closing WebSocket Gateway: ${err.message}`);
      });

      // 2. Close BullMQ queue connections
      await closeQueues().catch((err) => {
        log.warn('server.queues_close_error', `Error closing queues: ${err.message}`);
      });

      // 3. Close HTTP Server
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });

      log.info('server.shutdown_complete', 'Graceful shutdown completed successfully.');
      process.exit(0);
    } catch (err: any) {
      log.error('server.shutdown_failed', `Shutdown failed: ${err.message}`, { error: err });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  log.error('server.bootstrap_failed', `Failed to start server: ${err.message}`, { error: err });
  process.exit(1);
});
