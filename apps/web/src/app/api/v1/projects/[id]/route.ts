import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  getProjectPaths,
  loadProjectSchema,
  createLogger,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/infra';

const log = createLogger({ service: 'web-api-project-detail' });

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const projectId = params.id;
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();
  const reqLog = log.child({ correlationId, fields: { projectId } });

  try {
    let paths;
    try {
      paths = getProjectPaths(projectId);
    } catch {
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id', status_class: '4xx' });
      return NextResponse.json(
        { error: `Invalid project id: ${projectId}` },
        { status: 400, headers: { 'x-request-id': correlationId } }
      );
    }

    let rootStat: fs.Stats | null = null;
    try {
      rootStat = await fs.promises.stat(paths.rootDir);
    } catch {
      rootStat = null;
    }

    let metaRaw: string | null = null;
    try {
      metaRaw = await fs.promises.readFile(paths.metadataFile, 'utf-8');
    } catch {
      metaRaw = null;
    }

    let schemaRaw: string | null = null;
    try {
      schemaRaw = await fs.promises.readFile(paths.schemaFile, 'utf-8');
    } catch {
      schemaRaw = null;
    }

    if (!rootStat || (!metaRaw && !schemaRaw)) {
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id', status_class: '4xx' });
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404, headers: { 'x-request-id': correlationId } }
      );
    }

    let metadata: any = {};
    if (metaRaw) {
      try {
        metadata = JSON.parse(metaRaw);
      } catch {}
    }

    let schema: any = null;
    if (schemaRaw) {
      try {
        schema = loadProjectSchema(projectId);
      } catch (err: any) {
        reqLog.warn('api.schema_load_warning', `Schema found but failed validation: ${err.message}`);
      }
    }

    const videoPath = path.join(paths.outputDir, 'video.mp4');
    let hasVideo = false;
    try {
      await fs.promises.access(videoPath, fs.constants.F_OK);
      hasVideo = true;
    } catch {}

    const status = hasVideo ? 'COMPLETED' : schema ? 'PACKAGED' : metadata.status || 'INIT';
    const currentStep = hasVideo ? 12 : schema ? 12 : metadata.currentStep || 0;
    const createdAt = metadata.createdAt || (rootStat ? new Date(rootStat.birthtimeMs).toISOString() : new Date().toISOString());
    const updatedAt = metadata.updatedAt || (rootStat ? new Date(rootStat.mtimeMs).toISOString() : new Date().toISOString());

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      {
        projectId,
        status,
        currentStep,
        createdAt,
        updatedAt,
        videoUrl: hasVideo ? `/api/v1/projects/${projectId}/video` : undefined,
        metadata,
        schema,
      },
      {
        headers: {
          'x-request-id': correlationId,
        },
      }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/projects/:id', status_class: '5xx' }, durationSec);
    reqLog.error('api.project_detail_failed', `Failed to get project: ${err.message}`, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}
