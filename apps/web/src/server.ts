import fs from 'fs';
import path from 'path';
import http from 'http';
import next from 'next';
import { createLogger, envConfig, findMonorepoRoot } from '@chronoviet/infra';
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
      const url = req.url || '/';

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        });
        res.end();
        return;
      }

      if (url.startsWith('/media/')) {
        const monorepoRoot = findMonorepoRoot();
        const mediaRoot = path.resolve(monorepoRoot, 'media');
        const cleanPath = decodeURIComponent(url.replace(/\?.*$/, ''));
        const relativePath = cleanPath.slice('/media/'.length);
        const targetFilePath = path.resolve(mediaRoot, relativePath);

        // Path traversal protection
        if (!targetFilePath.startsWith(mediaRoot)) {
          res.statusCode = 403;
          res.end('Access Denied');
          return;
        }

        if (!fs.existsSync(targetFilePath) || !fs.statSync(targetFilePath).isFile()) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        const ext = path.extname(targetFilePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.wav': 'audio/wav',
          '.mp3': 'audio/mpeg',
          '.ogg': 'audio/ogg',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.mp4': 'video/mp4',
          '.json': 'application/json',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const stat = fs.statSync(targetFilePath);

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Cache-Control': 'public, max-age=3600',
        });

        fs.createReadStream(targetFilePath).pipe(res);
        return;
      }

      await handle(req, res);
    } catch (err: any) {
      log.error('server.request_error', `HTTP handler error: ${err.message}`, { error: err });
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Initialize WebSocket Gateway on same HTTP server
  const wsGateway = new WebSocketGateway(server);

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      log.error('server.port_in_use', `Port ${port} is already in use by another process. Please free port ${port} or specify PORT in .env`, { port });
      process.exit(1);
    } else {
      log.error('server.listen_error', `Server listen error: ${err.message}`, { error: err });
      process.exit(1);
    }
  });

  server.listen(port, hostname, () => {
    log.info('server.ready', `Next.js & WebSocket Gateway running on http://${hostname}:${port} (dev=${dev})`);
  });

  // Graceful shutdown handler
  async function gracefulShutdown(signal: string) {
    log.info('server.shutdown', `Received ${signal}, gracefully shutting down server...`);

    try {
      // 1. Close WebSocket Gateway connections and subscriptions
      await wsGateway.close().catch((err: any) => {
        log.warn('server.ws_close_error', `Error closing WebSocket Gateway: ${err.message}`);
      });

      // 2. Close BullMQ queue connections
      await closeQueues().catch((err: any) => {
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

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  log.error('server.bootstrap_failed', `Failed to start server: ${err.message}`, { error: err });
  process.exit(1);
});
