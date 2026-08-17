import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import {
  initProjectWorkspace,
  createLogger,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/shared-spec';
import { enqueueRenderJob } from '../../../../../../lib/queues';

const log = createLogger({ service: 'web-api-render' });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const projectId = params.id;
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();
  const reqLog = log.child({ correlationId, fields: { projectId } });

  try {
    const paths = initProjectWorkspace(projectId);

    if (!fs.existsSync(paths.schemaFile)) {
      httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/projects/:id/render', status_class: '4xx' });
      return NextResponse.json(
        { error: `Project schema not ready for rendering: ${projectId}. Run orchestrator first.` },
        { status: 400, headers: { 'x-request-id': correlationId } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { jobId } = await enqueueRenderJob(projectId, {
      outputFormat: body.outputFormat || 'mp4',
      priority: body.priority,
      correlationId,
    });

    reqLog.info('api.render_triggered', `Triggered render job ${jobId} for project ${projectId}`, {
      jobId,
      projectId,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/projects/:id/render', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/projects/:id/render', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      {
        projectId,
        jobId,
        status: 'ENQUEUED',
        message: 'Video rendering job enqueued successfully',
      },
      {
        headers: {
          'x-request-id': correlationId,
        },
      }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/projects/:id/render', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/projects/:id/render', status_class: '5xx' }, durationSec);
    reqLog.error('api.render_trigger_failed', `Failed to trigger render: ${err.message}`, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}
