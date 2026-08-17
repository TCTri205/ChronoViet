import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import {
  initProjectWorkspace,
  createLogger,
  RedisPubSubManager,
} from '@chronoviet/shared-spec';
import { cancelRenderJob } from '../../../../../../lib/queues';

const log = createLogger({ service: 'web-api-abort' });
const pubsub = new RedisPubSubManager();

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const paths = initProjectWorkspace(projectId);

    log.info('api.project_abort_requested', `Abort requested for project ${projectId}`, { projectId });

    // 1. Update project metadata status to ABORTED
    let metadata: Record<string, any> = { projectId, status: 'ABORTED', updatedAt: new Date().toISOString() };
    if (fs.existsSync(paths.metadataFile)) {
      try {
        metadata = JSON.parse(fs.readFileSync(paths.metadataFile, 'utf-8'));
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

    // 3. Attempt to cancel any active render job matching the projectId
    await cancelRenderJob(`render-${projectId}`).catch(() => {});

    log.info('api.project_aborted', `Project ${projectId} generation successfully aborted`, { projectId });

    return NextResponse.json({
      projectId,
      status: 'ABORTED',
      message: 'Video generation process aborted successfully',
    });
  } catch (err: any) {
    log.error('api.project_abort_failed', `Failed to abort project: ${err.message}`, { error: err });
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
