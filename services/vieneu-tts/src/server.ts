import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  VieNeuTTSRequestSchema,
  envConfig,
  createLogger,
  truncateSnippet,
  getMetricsSnapshot,
  getMetricsContentType,
  ttsRequestsTotal,
  ttsSynthesisDurationSeconds,
} from '@chronoviet/shared-spec';
import { VieNeuEngine } from './engine.js';

const PORT = envConfig.TTS_SERVICE_PORT;
const CACHE_DIR = path.resolve(process.cwd(), envConfig.AUDIO_CACHE_DIR);
const engine = new VieNeuEngine();

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export function createTtsServer() {
  return http.createServer(async (req, res) => {
    // Correlation ID: accept inbound x-request-id or generate one, propagate on response
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('x-request-id', requestId);
    const log = createLogger({ service: 'vieneu-tts', correlationId: requestId });

    const requestStart = Date.now();
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const route = url.pathname;

    const logRequestEnd = (statusCode: number) => {
      log.info('tts.request_completed', 'HTTP request completed', {
        method: req.method,
        route,
        statusCode,
        durationMs: Date.now() - requestStart,
      });
    };

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-request-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      logRequestEnd(204);
      return;
    }

    // GET /health
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/healthz')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'OK', service: 'vieneu-tts-service', timestamp: new Date().toISOString() }));
      logRequestEnd(200);
      return;
    }

    // GET /metrics
    if (req.method === 'GET' && url.pathname === '/metrics') {
      try {
        const metrics = await getMetricsSnapshot();
        res.writeHead(200, { 'Content-Type': getMetricsContentType() });
        res.end(metrics);
        logRequestEnd(200);
        return;
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Metrics error: ${err.message}`);
        logRequestEnd(500);
        return;
      }
    }

    // Static Audio File Server: GET /static/audio/*
    if (req.method === 'GET' && url.pathname.startsWith('/static/audio/')) {
      const fileName = path.basename(url.pathname);
      const filePath = path.join(CACHE_DIR, fileName);

      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'audio/wav' });
        fs.createReadStream(filePath).pipe(res);
        res.on('close', () => logRequestEnd(200));
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Audio file not found' }));
        log.warn('tts.audio_not_found', 'Requested audio file not found', { fileName });
        logRequestEnd(404);
        return;
      }
    }

    // POST /api/v1/synthesize
    if (req.method === 'POST' && url.pathname === '/api/v1/synthesize') {
      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const jsonBody = JSON.parse(bodyStr || '{}');
          const parseResult = VieNeuTTSRequestSchema.safeParse(jsonBody);

          if (!parseResult.success) {
            ttsRequestsTotal.inc({ engine: 'vieneu', status: 'invalid_request' });
            log.warn('tts.request_invalid', 'Invalid TTS request body', {
              details: parseResult.error.format(),
            });
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ERROR', errorMsg: 'Invalid request body', details: parseResult.error.format() }));
            logRequestEnd(400);
            return;
          }

          log.info('tts.synthesize_started', 'TTS synthesis request received', {
            textSnippet: truncateSnippet(parseResult.data.text),
            sampleRate: parseResult.data.sampleRate,
            fps: parseResult.data.fps,
          });

          const synthStart = Date.now();
          const response = await engine.synthesize(parseResult.data);
          const synthDurationSec = (Date.now() - synthStart) / 1000;
          ttsSynthesisDurationSeconds.observe({ engine: response.engineType || 'vieneu' }, synthDurationSec);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));

          if (response.status === 'SUCCESS') {
            ttsRequestsTotal.inc({ engine: response.engineType || 'vieneu', status: 'success' });
            log.info('tts.synthesize_succeeded', 'TTS synthesis succeeded', {
              engineType: response.engineType,
              audioDurationMs: response.audioDurationMs,
              wordCount: response.wordTimestamps.length,
            });
          } else {
            ttsRequestsTotal.inc({ engine: response.engineType || 'vieneu', status: 'error' });
            log.warn('tts.synthesize_error', 'TTS synthesis returned error', {
              engineType: response.engineType,
              errorMsg: response.errorMsg,
            });
          }
          logRequestEnd(200);
        } catch (err: any) {
          ttsRequestsTotal.inc({ engine: 'vieneu', status: 'fatal_error' });
          log.error('tts.synthesize_failed', 'TTS synthesis failed with internal error', {
            error: err,
          });
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ERROR', errorMsg: err.message || 'Internal server error' }));
          logRequestEnd(500);
        }
      });
      return;
    }

    // 404 Fallback
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
    logRequestEnd(404);
  });
}

// Start Server if executed directly
if (
  envConfig.NODE_ENV !== 'test' &&
  (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts'))
) {
  const server = createTtsServer();
  server.listen(PORT, () => {
    const log = createLogger({ service: 'vieneu-tts' });
    log.info('tts.server_started', `VieNeu TTS Microservice running on http://localhost:${PORT}`, {
      port: PORT,
      cacheDir: CACHE_DIR,
    });
  });
}
