import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import {
  initProjectWorkspace,
  createLogger,
  RedisPubSubManager,
  ResourceSentinel,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  cancelRenderJob,
} from '@chronoviet/shared-spec';

const log = createLogger({ service: 'web-api-abort' });
const pubsub = new RedisPubSubManager();

export const dynamic = 'force-dynamic';

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

    reqLog.info('api.project_abort_requested', `Abort requested for project ${projectId}`, { projectId });

    // 1. Update project metadata status to ABORTED
    let metadata: Record<string, any> = { projectId, status: 'ABORTED', updatedAt: new Date().toISOString() };
    let targetJobId: string | undefined;

    if (fs.existsSync(paths.metadataFile)) {
      try {
        metadata = JSON.parse(fs.readFileSync(paths.metadataFile, 'utf-8'));
        targetJobId = metadata.renderJobId;
        metadata.status = 'ABORTED';
        metadata.abortedAt = new Date().toISOString();
        metadata.updatedAt = new Date().toISOString();
      } catch {}
    }
    fs.writeFileSync(paths.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');

    // 2. Publish RENDER_FAILED / ABORTED event to notify connected UI sockets
    pubsub.publishRenderEvent({
      projectId,
      type: 'RENDER_FAILED',
      status: 'FAILED',
      errorMessage: 'User aborted video generation process.',
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    // 3. Attempt to cancel exact stored renderJobId, with fallback to prefix
    if (targetJobId) {
      await cancelRenderJob(targetJobId).catch(() => {});
      await ResourceSentinel.releaseRenderLock(targetJobId).catch(() => {});
    }
    await cancelRenderJob(`render-${projectId}`).catch(() => {});
    await ResourceSentinel.releaseRenderLock(`render-${projectId}`).catch(() => {});

    reqLog.info('api.project_aborted', `Project ${projectId} generation successfully aborted`, { projectId, targetJobId });

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/projects/:id/abort', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/projects/:id/abort', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      {
        projectId,
        status: 'ABORTED',
        message: 'Video generation process aborted successfully',
      },
      {
        headers: {
          'x-request-id': correlationId,
        },
      }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/projects/:id/abort', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/projects/:id/abort', status_class: '5xx' }, durationSec);
    reqLog.error('api.project_abort_failed', `Failed to abort project: ${err.message}`, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}
