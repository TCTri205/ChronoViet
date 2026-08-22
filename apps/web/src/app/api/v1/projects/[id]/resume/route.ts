import { NextRequest, NextResponse } from 'next/server';
import {
  createLogger,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/shared-spec';
import { resumeOrchestratorPipeline } from '@chronoviet/agent-orchestrator';

const log = createLogger({ service: 'web-api-resume' });

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
    const body = await req.json().catch(() => ({}));
    const { approvedScripts, feedback } = body;

    reqLog.info('api.project_resume_requested', `Resuming project ${projectId} after human review`, {
      projectId,
      hasApprovedScripts: !!approvedScripts,
      feedback,
    });

    const overrides: Record<string, any> = {};
    if (approvedScripts && typeof approvedScripts === 'object') {
      overrides.chapterScripts = approvedScripts;
    }

    // Trigger pipeline resumption in the background or await completion
    const finalState = await resumeOrchestratorPipeline(projectId, overrides);

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/projects/:id/resume', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/projects/:id/resume', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      {
        projectId,
        status: finalState.status,
        message: 'Pipeline resumed successfully after review',
      },
      {
        headers: {
          'x-request-id': correlationId,
        },
      }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/projects/:id/resume', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/projects/:id/resume', status_class: '5xx' }, durationSec);
    reqLog.error('api.project_resume_failed', `Failed to resume project: ${err.message}`, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}
