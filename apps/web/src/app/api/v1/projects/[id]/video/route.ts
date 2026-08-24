import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  getProjectPaths,
  createLogger,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/infra';

const log = createLogger({ service: 'web-api-video' });

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const projectId = params.id;
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();
  const reqLog = log.child({ correlationId, fields: { projectId } });

  try {
    let paths;
    try {
      paths = getProjectPaths(projectId);
    } catch {
      const durationSec = (Date.now() - startTime) / 1000;
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '4xx' });
      httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '4xx' }, durationSec);
      return new Response(JSON.stringify({ error: `Invalid project id: ${projectId}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'x-request-id': correlationId },
      });
    }

    const videoPath = path.join(paths.outputDir, 'video.mp4');

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(videoPath);
    } catch {
      const durationSec = (Date.now() - startTime) / 1000;
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '4xx' });
      httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '4xx' }, durationSec);
      return new Response(JSON.stringify({ error: `Video not found for project: ${projectId}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'x-request-id': correlationId },
      });
    }

    const fileSize = stat.size;
    const range = req.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        const durationSec = (Date.now() - startTime) / 1000;
        httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '4xx' });
        httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '4xx' }, durationSec);
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
            'x-request-id': correlationId,
          },
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(videoPath, { start, end });

      // Convert Node.js readable stream to Web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        },
      });

      const durationSec = (Date.now() - startTime) / 1000;
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '2xx' });
      httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '2xx' }, durationSec);

      return new Response(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-request-id': correlationId,
        },
      });
    } else {
      const fileStream = fs.createReadStream(videoPath);
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        },
      });

      const durationSec = (Date.now() - startTime) / 1000;
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '2xx' });
      httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '2xx' }, durationSec);

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Length': String(fileSize),
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-request-id': correlationId,
        },
      });
    }
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '5xx' }, durationSec);
    reqLog.error('api.video_stream_failed', `Failed to stream video: ${err.message}`, { error: err });
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': correlationId,
      },
    });
  }
}
