import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectSummary,
} from '@chronoviet/shared-spec';
import {
  initProjectWorkspace,
  getDefaultProjectsBaseDir,
  createLogger,
  truncateSnippet,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  getStatusClass,
} from '@chronoviet/infra';
import { runOrchestratorPipeline, ChronoGraphState } from '@chronoviet/agent-orchestrator';

const log = createLogger({ service: 'web-api-projects' });

export const dynamic = 'force-dynamic';

import {
  getProjectsDirCache,
  setProjectsDirCache,
  invalidateProjectsCache,
  CACHE_TTL_MS,
} from '@/lib/project-cache';

function extractTimestampFromDirName(name: string): number {
  const match = name.match(/^proj_(\d+)/);
  if (match) {
    const ts = parseInt(match[1], 10);
    if (!isNaN(ts)) return ts;
  }
  return 0;
}

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

    const conversationId = body.conversationId;
    let videoBriefId = body.videoBriefId;

    // If conversationId is supplied without a videoBriefId, compile brief from actual conversation history
    if (conversationId && !videoBriefId) {
      try {
        let historyTurns: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];
        const { query: dbQuery, isPgAvailable, inMemoryStore } = await import('@chronoviet/infra');
        const pgUp = await isPgAvailable();
        if (pgUp) {
          const rows = await dbQuery<any>(
            `SELECT role, content FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
            [conversationId]
          );
          historyTurns = rows.map((r: any) => ({
            role: (r.role === 'assistant' || r.role === 'system' ? r.role : 'user') as 'user' | 'assistant' | 'system',
            content: r.content,
          }));
        } else {
          historyTurns = inMemoryStore.conversationMessages
            .filter((m: any) => m.conversationId === conversationId)
            .map((m: any) => ({
              role: (m.role === 'assistant' || m.role === 'system' ? m.role : 'user') as 'user' | 'assistant' | 'system',
              content: m.content,
            }));
        }

        const { compileChatToVideoBrief } = await import('@chronoviet/agent-orchestrator');
        const brief = await compileChatToVideoBrief(historyTurns, {
          conversationId,
          projectId,
          topic,
          targetDurationSec: targetDurationMinutes * 60,
          aspectRatio: body.aspectRatio || '16:9',
          narrativeTone: body.tone || 'epic',
        });
        videoBriefId = brief.id;
      } catch (compileErr: any) {
        reqLog.warn('api.compile_brief_fallback', `Could not compile brief: ${compileErr.message}`);
      }
    }

    const paths = initProjectWorkspace(projectId);

    // Save initial metadata asynchronously
    const metadata = {
      projectId,
      conversationId: conversationId || null,
      videoBriefId: videoBriefId || null,
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

    await fs.promises.writeFile(paths.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');

    // Invalidate project list cache on new project creation
    invalidateProjectsCache();

    const projectLog = reqLog.child({ fields: { projectId } });
    projectLog.info('api.project_created', `Initialized project ${projectId} for topic "${truncateSnippet(topic)}"`, {
      projectId,
      topicSnippet: truncateSnippet(topic),
      videoBriefId,
      conversationId,
    });

    // Launch orchestrator pipeline asynchronously in background with correlationId
    const initialState: Partial<ChronoGraphState> = {
      projectId,
      correlationId,
      userPrompt: topic,
      videoBriefId: videoBriefId || undefined,
      targetDurationMinutes,
      videoType,
      templateId,
      status: 'INIT',
      currentStep: 0,
    };

    // Launch orchestrator pipeline asynchronously in background only if explicitly requested (headless/CLI mode)
    const shouldAutoStart = body.autoStart === true;
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
    let sortedDirNames: string[] = [];

    const now = Date.now();
    const currentCache = getProjectsDirCache();
    if (currentCache && now - currentCache.timestamp < CACHE_TTL_MS) {
      sortedDirNames = currentCache.dirNames;
    } else {
      try {
        const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
        const validDirNames: string[] = [];

        await Promise.all(
          entries
            .filter((e) => e.isDirectory())
            .map(async (e) => {
              const metaPath = path.join(baseDir, e.name, 'metadata.json');
              const schemaPath = path.join(baseDir, e.name, 'project_schema.json');
              try {
                const hasMeta = await fs.promises.access(metaPath, fs.constants.F_OK).then(() => true).catch(() => false);
                const hasSchema = !hasMeta && await fs.promises.access(schemaPath, fs.constants.F_OK).then(() => true).catch(() => false);
                if (hasMeta || hasSchema) {
                  validDirNames.push(e.name);
                }
              } catch {}
            })
        );

        // Sort directory names by extracted timestamp desc or lexicographically desc
        sortedDirNames = validDirNames.sort((a, b) => {
          const tsA = extractTimestampFromDirName(a);
          const tsB = extractTimestampFromDirName(b);
          if (tsA && tsB) return tsB - tsA;
          if (tsA) return -1;
          if (tsB) return 1;
          return b.localeCompare(a);
        });

        setProjectsDirCache({
          timestamp: now,
          dirNames: sortedDirNames,
        });
      } catch {
        sortedDirNames = [];
      }
    }

    const total = sortedDirNames.length;
    const paginatedDirNames = sortedDirNames.slice(offset, offset + limit);

    // Lazy load metadata & video status only for the requested page slice
    const summaryPromises = paginatedDirNames.map(async (projectId) => {
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

      let birthtimeIso = meta.createdAt;
      let mtimeIso = meta.updatedAt;

      if (!birthtimeIso || !mtimeIso) {
        try {
          const stats = await fs.promises.stat(projectDir);
          birthtimeIso = birthtimeIso || new Date(stats.birthtimeMs).toISOString();
          mtimeIso = mtimeIso || new Date(stats.mtimeMs).toISOString();
        } catch {
          const nowIso = new Date().toISOString();
          birthtimeIso = birthtimeIso || nowIso;
          mtimeIso = mtimeIso || nowIso;
        }
      }

      return {
        id: projectId,
        projectId,
        status,
        currentStep,
        title,
        topic: meta.topic || title,
        createdAt: birthtimeIso,
        updatedAt: mtimeIso,
        videoUrl: hasVideo ? `/api/v1/projects/${projectId}/video` : undefined,
        progressPercent: hasVideo ? 100 : status === 'PACKAGED' ? 90 : 20,
      } as ProjectSummary;
    });

    const paginatedItems = await Promise.all(summaryPromises);

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
