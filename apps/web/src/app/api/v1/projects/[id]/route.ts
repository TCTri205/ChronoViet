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
import { invalidateProjectsCache } from '@/lib/project-cache';

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

export async function DELETE(
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
      httpRequestsTotal.inc({ method: 'DELETE', route: '/api/v1/projects/:id', status_class: '4xx' });
      return NextResponse.json(
        { error: `Invalid project id: ${projectId}` },
        { status: 400, headers: { 'x-request-id': correlationId } }
      );
    }

    try {
      const exists = await fs.promises.access(paths.rootDir, fs.constants.F_OK).then(() => true).catch(() => false);
      if (exists) {
        await fs.promises.rm(paths.rootDir, { recursive: true, force: true });
      }
    } catch (rmErr: any) {
      reqLog.warn('api.project_rm_warning', `Could not delete directory: ${rmErr.message}`);
    }

    invalidateProjectsCache();

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'DELETE', route: '/api/v1/projects/:id', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'DELETE', route: '/api/v1/projects/:id', status_class: '2xx' }, durationSec);
    reqLog.info('api.project_deleted', `Deleted project workspace for ${projectId}`);

    return NextResponse.json(
      { success: true, message: `Project ${projectId} deleted` },
      { headers: { 'x-request-id': correlationId } }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'DELETE', route: '/api/v1/projects/:id', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'DELETE', route: '/api/v1/projects/:id', status_class: '5xx' }, durationSec);
    reqLog.error('api.project_delete_failed', `Failed to delete project: ${err.message}`, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}

export async function PATCH(
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
      httpRequestsTotal.inc({ method: 'PATCH', route: '/api/v1/projects/:id', status_class: '4xx' });
      return NextResponse.json(
        { error: `Invalid project id: ${projectId}` },
        { status: 400, headers: { 'x-request-id': correlationId } }
      );
    }

    const exists = await fs.promises.access(paths.rootDir, fs.constants.F_OK).then(() => true).catch(() => false);
    if (!exists) {
      httpRequestsTotal.inc({ method: 'PATCH', route: '/api/v1/projects/:id', status_class: '4xx' });
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404, headers: { 'x-request-id': correlationId } }
      );
    }

    const body = await req.json().catch(() => ({}));
    let metadata: any = {};
    try {
      const raw = await fs.promises.readFile(paths.metadataFile, 'utf-8');
      metadata = JSON.parse(raw);
    } catch {
      metadata = { projectId, createdAt: new Date().toISOString() };
    }

    if (body.topic !== undefined) metadata.topic = body.topic;
    if (body.title !== undefined) metadata.title = body.title;
    if (body.aspectRatio !== undefined) metadata.aspectRatio = body.aspectRatio;
    if (body.targetDurationMinutes !== undefined) metadata.targetDurationMinutes = Number(body.targetDurationMinutes);
    if (body.tone !== undefined) metadata.tone = body.tone;
    if (body.status !== undefined) metadata.status = body.status;
    metadata.updatedAt = new Date().toISOString();

    await fs.promises.writeFile(paths.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');

    invalidateProjectsCache();

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'PATCH', route: '/api/v1/projects/:id', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'PATCH', route: '/api/v1/projects/:id', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      { success: true, metadata },
      { headers: { 'x-request-id': correlationId } }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'PATCH', route: '/api/v1/projects/:id', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'PATCH', route: '/api/v1/projects/:id', status_class: '5xx' }, durationSec);
    reqLog.error('api.project_patch_failed', `Failed to update project: ${err.message}`, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}
