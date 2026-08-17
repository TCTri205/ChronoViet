import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  initProjectWorkspace,
  getProjectRootDir,
  loadProjectSchema,
  createLogger,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/shared-spec';

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
    const rootDir = getProjectRootDir(projectId);
    const metaFile = path.join(rootDir, 'metadata.json');
    const schemaFile = path.join(rootDir, 'project_schema.json');

    if (!fs.existsSync(rootDir) || (!fs.existsSync(metaFile) && !fs.existsSync(schemaFile))) {
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/projects/:id', status_class: '4xx' });
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404, headers: { 'x-request-id': correlationId } }
      );
    }

    const paths = initProjectWorkspace(projectId);

    let metadata: any = {};
    if (fs.existsSync(paths.metadataFile)) {
      try {
        metadata = JSON.parse(fs.readFileSync(paths.metadataFile, 'utf-8'));
      } catch {}
    }

    let schema: any = null;
    if (fs.existsSync(paths.schemaFile)) {
      try {
        schema = loadProjectSchema(projectId);
      } catch (err: any) {
        reqLog.warn('api.schema_load_warning', `Schema found but failed validation: ${err.message}`);
      }
    }

    const videoPath = path.join(paths.outputDir, 'video.mp4');
    const hasVideo = fs.existsSync(videoPath);
    const status = hasVideo ? 'COMPLETED' : schema ? 'PACKAGED' : metadata.status || 'INIT';
    const currentStep = hasVideo ? 12 : schema ? 12 : metadata.currentStep || 0;
    const createdAt = metadata.createdAt || new Date(fs.statSync(paths.rootDir).birthtimeMs).toISOString();
    const updatedAt = metadata.updatedAt || new Date(fs.statSync(paths.rootDir).mtimeMs).toISOString();

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
