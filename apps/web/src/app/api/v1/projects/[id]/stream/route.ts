import { NextRequest } from 'next/server';
import * as fs from 'fs';
import {
  SseEvent,
  classifyVideoDomain,
} from '@chronoviet/shared-spec';
import {
  getProjectPaths,
  createLogger,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/infra';
import {
  streamOrchestratorPipeline,
  ChronoGraphState,
  defaultCheckpointer,
} from '@chronoviet/agent-orchestrator';

import {
  getActivePipelineJob,
  setActivePipelineJob,
  deleteActivePipelineJob,
  ActivePipelineJob,
} from '@/lib/project-stream-coordinator';

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

    // Fast-path: If project is already COMPLETED or FAILED, return terminal event immediately without re-triggering pipeline
    const isTerminal =
      existingCheckpoint?.status === 'COMPLETED' ||
      existingCheckpoint?.status === 'FAILED' ||
      metadata.status === 'COMPLETED' ||
      metadata.status === 'FAILED';

    if (isTerminal) {
      const finalStatus = (existingCheckpoint?.status || metadata.status) as any;
      const sseStatus = finalStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
      const terminalEvent: SseEvent = {
        nodeName: finalStatus === 'COMPLETED' ? 'completed' : 'error',
        update: (existingCheckpoint || {}) as Record<string, unknown>,
        state: String(finalStatus),
        status: sseStatus,
        projectId,
        timestamp: new Date().toISOString(),
      };
      const durationSec = (Date.now() - startTime) / 1000;
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id/stream', status_class: '2xx' });
      httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id/stream', status_class: '2xx' }, durationSec);
      return new Response(`data: ${JSON.stringify(terminalEvent)}\n\n`, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'x-request-id': correlationId,
        },
      });
    }

    const initialState: Partial<ChronoGraphState> = existingCheckpoint || {
      projectId,
      userPrompt: metadata.topic || 'Historical Topic',
      targetDurationMinutes: metadata.targetDurationMinutes || 1,
      videoType: metadata.videoType ? metadata.videoType : classifyVideoDomain(metadata.topic || ''),
      templateId: metadata.templateId || 'HISTORICAL_DOCUMENTARY',
      status: 'INIT',
      currentStep: 0,
    };

    const subscriberId = crypto.randomUUID();
    const encoder = new TextEncoder();

    let job = getActivePipelineJob(projectId);
    if (!job) {
      job = {
        projectId,
        subscribers: new Map(),
        isFinished: false,
      };
      setActivePipelineJob(projectId, job);

      // Launch single orchestrated pipeline asynchronously for all current and future subscribers
      (async () => {
        try {
          for await (const { nodeName, update } of streamOrchestratorPipeline(initialState as ChronoGraphState, { threadId: projectId })) {
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

            job!.lastEvent = event;
            const dataBytes = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
            for (const sub of Array.from(job!.subscribers.values())) {
              try {
                sub.controller.enqueue(dataBytes);
              } catch {}
            }

            if (sseStatus === 'COMPLETED' || sseStatus === 'FAILED') {
              break;
            }
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
          job!.lastEvent = errorEvent;
          const errorBytes = encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`);
          for (const sub of Array.from(job!.subscribers.values())) {
            try {
              sub.controller.enqueue(errorBytes);
            } catch {}
          }
        } finally {
          job!.isFinished = true;
          for (const sub of Array.from(job!.subscribers.values())) {
            try {
              sub.controller.close();
            } catch {}
          }
          job!.subscribers.clear();
          deleteActivePipelineJob(projectId);
        }
      })();
    } else {
      reqLog.info('api.sse_attached_to_existing_stream', `Attached SSE subscriber to already running pipeline for ${projectId}`);
    }

    const currentJob = job;
    const stream = new ReadableStream({
      start(controller) {
        // Catch-up: send latest event if available
        if (currentJob.lastEvent) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(currentJob.lastEvent)}\n\n`));
          } catch {}
        }
        if (currentJob.isFinished) {
          try {
            controller.close();
          } catch {}
          return;
        }
        currentJob.subscribers.set(subscriberId, {
          id: subscriberId,
          controller,
          encoder,
        });
      },
      cancel() {
        currentJob.subscribers.delete(subscriberId);
        reqLog.info('api.sse_subscriber_cancelled', `Client disconnected from SSE stream for ${projectId}`);
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
