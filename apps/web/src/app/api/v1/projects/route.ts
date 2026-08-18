import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  initProjectWorkspace,
  getDefaultProjectsBaseDir,
  ProjectSummary,
  createLogger,
  truncateSnippet,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  getStatusClass,
} from '@chronoviet/shared-spec';
import { runOrchestratorPipeline, ChronoGraphState } from '@chronoviet/agent-orchestrator';

const log = createLogger({ service: 'web-api-projects' });

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();
  const reqLog = log.child({ correlationId });

  try {
    const body = await req.json();
    const topic = body.topic || body.prompt;

    if (!topic || typeof topic !== 'string') {
      httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/projects', status_class: '4xx' });
      return NextResponse.json({ error: 'Topic or prompt is required' }, { status: 400 });
    }

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const targetDurationMinutes = Number(body.targetDurationMinutes) || 1;
    const videoType = (body.videoType || 'BIOGRAPHY') as any;
    const templateId = (body.templateId || 'HISTORICAL_DOCUMENTARY') as any;

    const paths = initProjectWorkspace(projectId);

    // Save initial metadata
    const metadata = {
      projectId,
      topic,
      targetDurationMinutes,
      videoType,
      templateId,
      aspectRatio: body.aspectRatio || '16:9',
      tone: body.tone || 'HERITAGE_EPIC',
      status: 'INIT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(paths.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');

    const projectLog = reqLog.child({ fields: { projectId } });
    projectLog.info('api.project_created', `Initialized project ${projectId} for topic "${truncateSnippet(topic)}"`, {
      projectId,
      topicSnippet: truncateSnippet(topic),
    });

    // Launch orchestrator pipeline asynchronously in background with correlationId
    const initialState: Partial<ChronoGraphState> = {
      projectId,
      correlationId,
      userPrompt: topic,
      targetDurationMinutes,
      videoType,
      templateId,
      status: 'INIT',
      currentStep: 0,
    };

    // Launch orchestrator pipeline asynchronously in background only if not requested in streaming mode
    const shouldAutoStart = body.autoStart !== false && body.stream !== true;
    if (shouldAutoStart) {
      runOrchestratorPipeline(initialState as ChronoGraphState).catch((err) => {
        projectLog.error('api.orchestrator_background_failed', `Background pipeline failed for ${projectId}: ${err.message}`, {
          projectId,
          error: err,
        });
      });
    }

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/projects', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/projects', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      {
        projectId,
        status: 'INIT',
        message: 'Project created and pipeline initiated',
        metadata,
      },
      {
        status: 201,
        headers: {
          'x-request-id': correlationId,
        },
      }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/projects', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/projects', status_class: '5xx' }, durationSec);
    reqLog.error('api.project_create_failed', `Failed to create project: ${err.message}`, { error: err });
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();
  const reqLog = log.child({ correlationId });
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const baseDir = getDefaultProjectsBaseDir();
    let summaries: ProjectSummary[] = [];

    if (fs.existsSync(baseDir)) {
      const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
      const dirEntries = entries.filter((e) => e.isDirectory());

      const summaryPromises = dirEntries.map(async (entry) => {
        const projectId = entry.name;
        const projectDir = path.join(baseDir, projectId);
        const metaPath = path.join(projectDir, 'metadata.json');
        const videoPath = path.join(projectDir, 'output', 'video.mp4');

        let meta: Record<string, any> = {};
        try {
          const metaRaw = await fs.promises.readFile(metaPath, 'utf-8');
          meta = JSON.parse(metaRaw);
        } catch {}

        let hasVideo = false;
        try {
          await fs.promises.access(videoPath, fs.constants.F_OK);
          hasVideo = true;
        } catch {}

        const title = meta.topic || meta.title || projectId;
        const status = hasVideo ? 'COMPLETED' : meta.status || 'INIT';
        const currentStep = hasVideo ? 12 : meta.currentStep || (status === 'PACKAGED' ? 12 : 0);

        let birthtimeIso = new Date().toISOString();
        let mtimeIso = new Date().toISOString();
        try {
          const stats = await fs.promises.stat(projectDir);
          birthtimeIso = new Date(stats.birthtimeMs).toISOString();
          mtimeIso = new Date(stats.mtimeMs).toISOString();
        } catch {}

        return {
          id: projectId,
          projectId,
          status,
          currentStep,
          title,
          topic: meta.topic || title,
          createdAt: meta.createdAt || birthtimeIso,
          updatedAt: meta.updatedAt || mtimeIso,
          videoUrl: hasVideo ? `/api/v1/projects/${projectId}/video` : undefined,
          progressPercent: hasVideo ? 100 : status === 'PACKAGED' ? 90 : 20,
        } as ProjectSummary;
      });

      summaries = await Promise.all(summaryPromises);
    }

    // Sort by createdAt descending
    summaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = summaries.length;
    const paginatedItems = summaries.slice(offset, offset + limit);

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      {
        items: paginatedItems,
        total,
        limit,
        offset,
        projects: paginatedItems,
      },
      {
        headers: {
          'x-request-id': correlationId,
        },
      }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects', status_class: '5xx' }, durationSec);
    reqLog.error('api.projects_list_failed', `Failed to list projects: ${err.message}`, { error: err });
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
