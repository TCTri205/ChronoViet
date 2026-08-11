import http from 'http';
import fs from 'fs';
import path from 'path';
import { VieNeuTTSRequestSchema, envConfig } from '@chronoviet/shared-spec';
import { VieNeuEngine } from './engine.js';

const PORT = envConfig.TTS_SERVICE_PORT;
const CACHE_DIR = path.resolve(process.cwd(), envConfig.AUDIO_CACHE_DIR);
const engine = new VieNeuEngine();

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export function createTtsServer() {
  return http.createServer(async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // GET /health
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'OK', service: 'vieneu-tts-service', timestamp: new Date().toISOString() }));
      return;
    }

    // Static Audio File Server: GET /static/audio/*
    if (req.method === 'GET' && url.pathname.startsWith('/static/audio/')) {
      const fileName = path.basename(url.pathname);
      const filePath = path.join(CACHE_DIR, fileName);

      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'audio/wav' });
        fs.createReadStream(filePath).pipe(res);
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Audio file not found' }));
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
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ERROR', errorMsg: 'Invalid request body', details: parseResult.error.format() }));
            return;
          }

          const response = await engine.synthesize(parseResult.data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ERROR', errorMsg: err.message || 'Internal server error' }));
        }
      });
      return;
    }

    // 404 Fallback
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });
}

// Start Server if executed directly
if (envConfig.NODE_ENV !== 'test' && require.main === module) {
  const server = createTtsServer();
  server.listen(PORT, () => {
    console.log(`🚀 VieNeu TTS Microservice running on http://localhost:${PORT}`);
  });
}
