import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  initProjectWorkspace,
  createLogger,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/shared-spec';

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
    const paths = initProjectWorkspace(projectId);
    const videoPath = path.join(paths.outputDir, 'video.mp4');

    if (!fs.existsSync(videoPath)) {
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/video', status_class: '4xx' });
      return new Response(JSON.stringify({ error: `Video not found for project: ${projectId}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'x-request-id': correlationId },
      });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
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

      return new Response(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=31536000, immutable',
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

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Length': String(fileSize),
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  } catch (err: any) {
    log.error('api.video_stream_failed', `Failed to stream video: ${err.message}`, { error: err });
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
