import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import {
  initProjectWorkspace,
  createLogger,
} from '@chronoviet/shared-spec';
import { enqueueRenderJob } from '../../../../../../lib/queues';

const log = createLogger({ service: 'web-api-render' });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const paths = initProjectWorkspace(projectId);

    if (!fs.existsSync(paths.schemaFile)) {
      return NextResponse.json(
        { error: `Project schema not ready for rendering: ${projectId}. Run orchestrator first.` },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { jobId } = await enqueueRenderJob(projectId, {
      outputFormat: body.outputFormat || 'mp4',
      priority: body.priority,
    });

    log.info('api.render_triggered', `Triggered render job ${jobId} for project ${projectId}`);

    return NextResponse.json({
      projectId,
      jobId,
      status: 'ENQUEUED',
      message: 'Video rendering job enqueued successfully',
    });
  } catch (err: any) {
    log.error('api.render_trigger_failed', `Failed to trigger render: ${err.message}`, { error: err });
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
