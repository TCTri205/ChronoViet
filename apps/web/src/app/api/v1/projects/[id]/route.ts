import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  initProjectWorkspace,
  getProjectRootDir,
  loadProjectSchema,
  createLogger,
} from '@chronoviet/shared-spec';

const log = createLogger({ service: 'web-api-project-detail' });

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const rootDir = getProjectRootDir(projectId);
    const metaFile = path.join(rootDir, 'metadata.json');
    const schemaFile = path.join(rootDir, 'project_schema.json');

    if (!fs.existsSync(rootDir) || (!fs.existsSync(metaFile) && !fs.existsSync(schemaFile))) {
      return NextResponse.json({ error: `Project not found: ${projectId}` }, { status: 404 });
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
        log.warn('api.schema_load_warning', `Schema found but failed validation: ${err.message}`);
      }
    }

    const videoPath = path.join(paths.outputDir, 'video.mp4');
    const hasVideo = fs.existsSync(videoPath);
    const status = hasVideo ? 'COMPLETED' : schema ? 'PACKAGED' : metadata.status || 'INIT';
    const currentStep = hasVideo ? 12 : schema ? 12 : metadata.currentStep || 0;
    const createdAt = metadata.createdAt || new Date(fs.statSync(paths.rootDir).birthtimeMs).toISOString();
    const updatedAt = metadata.updatedAt || new Date(fs.statSync(paths.rootDir).mtimeMs).toISOString();

    return NextResponse.json({
      projectId,
      status,
      currentStep,
      createdAt,
      updatedAt,
      videoUrl: hasVideo ? `/api/v1/projects/${projectId}/video` : undefined,
      metadata,
      schema,
    });
  } catch (err: any) {
    log.error('api.project_detail_failed', `Failed to get project: ${err.message}`, { error: err });
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
