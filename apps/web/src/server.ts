import http from 'http';
import { parse } from 'url';
import next from 'next';
import { createLogger, envConfig } from '@chronoviet/shared-spec';
import { WebSocketGateway } from './server/ws-gateway';

const log = createLogger({ service: 'web-server' });

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

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
  new WebSocketGateway(server);

  server.listen(port, () => {
    log.info('server.ready', `> ChronoViet Web & API Server ready on http://${hostname}:${port}`);
  });

  const shutdown = () => {
    log.info('server.shutdown', 'Gracefully shutting down server...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  log.error('server.bootstrap_failed', `Failed to start server: ${err.message}`, { error: err });
  process.exit(1);
});
