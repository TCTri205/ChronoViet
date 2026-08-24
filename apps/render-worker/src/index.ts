import http from 'http';
import {
  createLogger,
  envConfig,
  getMetricsContentType,
  getMetricsSnapshot,
  formatErrorMessage,
} from '@chronoviet/infra';
import { startTTSWorker } from './workers/tts-worker.js';
import { startVLMWorker } from './workers/vlm-worker.js';
import { startRenderWorker } from './workers/render-worker.js';
import {
  createQueue,
  QUEUE_NAMES,
  collectQueueMetrics,
  getBullMqRedis,
} from './queues/queue-manager.js';

export * from './queues/queue-manager.js';
export * from './workers/tts-worker.js';
export * from './workers/vlm-worker.js';
export * from './workers/render-worker.js';

const log = createLogger({ service: 'render-worker' });

export function initializeAllWorkers() {
  log.info('render_worker.starting', `Initializing BullMQ workers for ChronoViet (TTS, VLM, Remotion Render) [Routing Mode: ${envConfig.INFERENCE_ROUTING_MODE.toUpperCase()}]`);
  const ttsWorker = startTTSWorker();
  const vlmWorker = startVLMWorker();
  const renderWorker = startRenderWorker();

  // Create queue handles for depth metric scraping
  const queues = [
    createQueue(QUEUE_NAMES.TTS_GEN),
    createQueue(QUEUE_NAMES.VLM_INSPECT),
    createQueue(QUEUE_NAMES.REMOTION_RENDER),
  ];

  // Scrape queue metrics every 10 seconds
  const metricsInterval = setInterval(() => {
    collectQueueMetrics(queues).catch(() => {});
  }, 10000);
  metricsInterval.unref();

  // Start lightweight HTTP probe server for HEALTHCHECK & /metrics
  const probePort = envConfig.WORKER_PROBE_PORT || 3001;
  const probeServer = http.createServer(async (req, res) => {
    const url = req.url || '/';

    if (url === '/healthz' || url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'render-worker' }));
      return;
    }

    if (url === '/readyz') {
      try {
        const redis = getBullMqRedis();
        const ping = await redis.ping();
        if (ping === 'PONG') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ready', redis: 'connected' }));
          return;
        }
      } catch (err) {
        log.warn('render_worker.readiness_failed', `Readiness probe failed: ${formatErrorMessage(err)}`);
      }
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'unready', redis: 'disconnected' }));
      return;
    }

    if (url === '/metrics') {
      try {
        await collectQueueMetrics(queues);
        const metrics = await getMetricsSnapshot();
        res.writeHead(200, { 'Content-Type': getMetricsContentType() });
        res.end(metrics);
        return;
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Metrics error: ${err.message}`);
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  probeServer.listen(probePort, () => {
    log.info('render_worker.ready', `Render worker probe server listening on port ${probePort}`);
  });

  const cleanup = async () => {
    log.info('render_worker.shutting_down', 'Gracefully closing render workers, queues and probe server...');
    clearInterval(metricsInterval);
    await Promise.allSettled([
      ttsWorker.close(),
      vlmWorker.close(),
      renderWorker.close(),
      ...queues.map((q) => q.close()),
    ]);
    await new Promise<void>((resolve) => probeServer.close(() => resolve()));
    log.info('render_worker.stopped', 'Render worker gracefully stopped');
  };

  process.once('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });

  process.once('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });

  return { ttsWorker, vlmWorker, renderWorker, probeServer, queues, cleanup };
}

// Auto-start if run directly
if (process.argv[1]?.endsWith('dist/index.js') || process.argv[1]?.endsWith('src/index.ts') || process.argv[1]?.endsWith('index.js')) {
  initializeAllWorkers();
}
