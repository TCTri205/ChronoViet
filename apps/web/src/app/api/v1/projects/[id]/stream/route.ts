import { NextRequest } from 'next/server';
import * as fs from 'fs';
import {
  initProjectWorkspace,
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

    let metadata: any = {};
    if (fs.existsSync(paths.metadataFile)) {
      try {
        metadata = JSON.parse(fs.readFileSync(paths.metadataFile, 'utf-8'));
      } catch {}
    }

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
          log.error('api.sse_stream_error', `SSE stream failed for ${projectId}: ${streamErr.message}`, {
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

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    log.error('api.sse_init_failed', `Failed to initialize SSE: ${err.message}`, { error: err });
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
