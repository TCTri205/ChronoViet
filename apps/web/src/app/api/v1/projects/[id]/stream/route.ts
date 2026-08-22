import { NextRequest } from 'next/server';
import * as fs from 'fs';
import {
  getProjectPaths,
  createLogger,
  SseEvent,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/shared-spec';
import {
  streamOrchestratorPipeline,
  ChronoGraphState,
  defaultCheckpointer,
} from '@chronoviet/agent-orchestrator';

const log = createLogger({ service: 'web-api-sse' });

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
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/stream', status_class: '4xx' });
      httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id/stream', status_class: '4xx' }, durationSec);
      return new Response(JSON.stringify({ error: `Invalid project id: ${projectId}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'x-request-id': correlationId },
      });
    }

    let metadata: any = {};
    try {
      const metaRaw = await fs.promises.readFile(paths.metadataFile, 'utf-8');
      metadata = JSON.parse(metaRaw);
    } catch {}

    reqLog.info('api.sse_connected', `SSE Client connected to stream for project ${projectId}`, { projectId });

    const existingCheckpoint = await defaultCheckpointer.loadLatestProjectState(projectId);

    const initialState: Partial<ChronoGraphState> = existingCheckpoint || {
      projectId,
      userPrompt: metadata.topic || 'Historical Topic',
      targetDurationMinutes: metadata.targetDurationMinutes || 1,
      videoType: metadata.videoType || 'BIOGRAPHY',
      templateId: metadata.templateId || 'HISTORICAL_DOCUMENTARY',
      status: 'INIT',
      currentStep: 0,
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const { nodeName, update } of streamOrchestratorPipeline(initialState as ChronoGraphState, { threadId: projectId })) {
            if (req.signal.aborted) {
              reqLog.info('api.sse_client_disconnected', `Client disconnected from SSE stream for ${projectId}`);
              break;
            }
            const currentStatus = update.status || 'RUNNING';
            const sseStatus =
              currentStatus === 'COMPLETED'
                ? 'COMPLETED'
                : currentStatus === 'FAILED'
                ? 'FAILED'
                : currentStatus === 'NEEDS_HUMAN_REVIEW'
                ? 'NEEDS_HUMAN_REVIEW'
                : 'RUNNING';

            const event: SseEvent = {
              nodeName,
              update: update as Record<string, unknown>,
              state: String(currentStatus),
              status: sseStatus,
              projectId,
              timestamp: new Date().toISOString(),
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        } catch (streamErr: any) {
          httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/stream', status_class: '5xx' });
          reqLog.error('api.sse_stream_error', `SSE stream failed for ${projectId}: ${streamErr.message}`, {
            error: streamErr,
          });
          const errorEvent: SseEvent = {
            nodeName: 'error',
            update: { error: streamErr.message },
            state: 'FAILED',
            status: 'FAILED',
            projectId,
            timestamp: new Date().toISOString(),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/stream', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id/stream', status_class: '2xx' }, durationSec);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'x-request-id': correlationId,
      },
    });
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/stream', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id/stream', status_class: '5xx' }, durationSec);
    reqLog.error('api.sse_init_failed', `Failed to initialize SSE: ${err.message}`, { error: err });
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': correlationId,
      },
    });
  }
}
