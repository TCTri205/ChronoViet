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

    // Run in background without blocking API response
    runOrchestratorPipeline(initialState as ChronoGraphState).catch((err) => {
      projectLog.error('api.orchestrator_background_failed', `Background pipeline failed for ${projectId}: ${err.message}`, {
        projectId,
        error: err,
      });
    });

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
    const baseDir = getDefaultProjectsBaseDir();
    const summaries: ProjectSummary[] = [];

    if (fs.existsSync(baseDir)) {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectId = entry.name;
          const projectDir = path.join(baseDir, projectId);
          const metaPath = path.join(projectDir, 'metadata.json');
          const schemaPath = path.join(projectDir, 'project_schema.json');
          const videoPath = path.join(projectDir, 'output', 'video.mp4');

          let meta: any = {};
          if (fs.existsSync(metaPath)) {
            try {
              meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            } catch {}
          }

          let title = meta.topic || projectId;
          let currentStep = 0;
          let status = meta.status || 'INIT';

          if (fs.existsSync(schemaPath)) {
            try {
              const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
              title = schema.title || title;
              currentStep = 12;
              status = 'PACKAGED';
            } catch {}
          }

          const hasVideo = fs.existsSync(videoPath);
          if (hasVideo) {
            status = 'COMPLETED';
          }

          summaries.push({
            projectId,
            status,
            currentStep,
            title,
            topic: meta.topic,
            createdAt: meta.createdAt || new Date(fs.statSync(projectDir).birthtimeMs).toISOString(),
            updatedAt: meta.updatedAt || new Date(fs.statSync(projectDir).mtimeMs).toISOString(),
            videoUrl: hasVideo ? `/api/v1/projects/${projectId}/video` : undefined,
            progressPercent: hasVideo ? 100 : status === 'PACKAGED' ? 90 : 20,
          });
        }
      }
    }

    // Sort by createdAt descending
    summaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      {
        items: summaries,
        total: summaries.length,
        projects: summaries,
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
