import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  initProjectWorkspace,
  getDefaultProjectsBaseDir,
  ProjectSummary,
  createLogger,
} from '@chronoviet/shared-spec';
import { runOrchestratorPipeline, ChronoGraphState } from '@chronoviet/agent-orchestrator';

const log = createLogger({ service: 'web-api-projects' });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const topic = body.topic || body.prompt;

    if (!topic || typeof topic !== 'string') {
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

    log.info('api.project_created', `Initialized project ${projectId} for topic "${topic}"`, {
      projectId,
      topic,
    });

    // Launch orchestrator pipeline asynchronously in background
    const initialState: Partial<ChronoGraphState> = {
      projectId,
      userPrompt: topic,
      targetDurationMinutes,
      videoType,
      templateId,
      status: 'INIT',
      currentStep: 0,
    };

    // Run in background without blocking API response
    runOrchestratorPipeline(initialState as ChronoGraphState).catch((err) => {
      log.error('api.orchestrator_background_failed', `Background pipeline failed for ${projectId}: ${err.message}`, {
        projectId,
        error: err,
      });
    });

    return NextResponse.json(
      {
        projectId,
        status: 'INIT',
        message: 'Project created and pipeline initiated',
        metadata,
      },
      { status: 201 }
    );
  } catch (err: any) {
    log.error('api.project_create_failed', `Failed to create project: ${err.message}`, { error: err });
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
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

    return NextResponse.json({
      items: summaries,
      total: summaries.length,
      projects: summaries,
    });
  } catch (err: any) {
    log.error('api.projects_list_failed', `Failed to list projects: ${err.message}`, { error: err });
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
