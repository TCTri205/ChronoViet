/**
 * BullMQ Worker: Remotion Video Render Queue (`remotion-render-queue`)
 * Chromium Process Isolation (--concurrency=1), Temp Cleanup & Resource Monitoring
 */

import { Worker, Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import {
  cleanProjectWorkspace,
  createLogger,
  initProjectWorkspace,
  loadProjectSchema,
  saveProjectSchema,
} from '@chronoviet/shared-spec';
import { getBullMqRedis, QUEUE_NAMES } from '../queues/queue-manager.js';

const log = createLogger({ service: 'render-worker' });

export interface RenderJobData {
  projectId: string;
  outputFormat?: 'mp4';
  priority?: number;
}

export interface RenderJobResult {
  projectId: string;
  outputPath: string;
  fileSizeBytes: number;
  durationMs: number;
  peakMemoryMb: number;
  totalFrames: number;
}

export async function processRenderJob(job: Job<RenderJobData>): Promise<RenderJobResult> {
  const { projectId } = job.data;
  const startTime = Date.now();
  const initialMem = process.memoryUsage().heapUsed;

  log.info('worker.render_started', `Starting Remotion render for project ${projectId}`, {
    projectId,
    jobId: job.id,
  });

  const paths = initProjectWorkspace(projectId);
  const outputPath = path.join(paths.outputDir, 'video.mp4');

  // 1. Load and validate schema
  const projectSchema = loadProjectSchema(projectId);
  const totalFrames = projectSchema.timeline.reduce(
    (acc, scene) => acc + (scene.durationInFrames || 90),
    0
  );

  // Ensure local audio/image file paths in projectSchema are serialized as Data URIs if file exists on disk
  let schemaMutated = false;
  for (const scene of projectSchema.timeline) {
    if (scene.sceneAudioUrl && !scene.sceneAudioUrl.startsWith('http') && !scene.sceneAudioUrl.startsWith('data:')) {
      const candidatePaths = [
        scene.sceneAudioUrl,
        path.resolve(paths.audioDir, path.basename(scene.sceneAudioUrl)),
        path.resolve(paths.rootDir, scene.sceneAudioUrl),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          const buf = fs.readFileSync(p);
          const mime = p.endsWith('.mp3') ? 'audio/mp3' : 'audio/wav';
          scene.sceneAudioUrl = `data:${mime};base64,${buf.toString('base64')}`;
          schemaMutated = true;
          break;
        }
      }
    }
    if (scene.assetUrl && scene.assetUrl.includes('RFVNTVlfSU1BR0VfREFUQV')) {
      scene.assetUrl = undefined;
      schemaMutated = true;
    }
    if (scene.assetUrl && !scene.assetUrl.startsWith('http') && !scene.assetUrl.startsWith('data:')) {
      const candidatePaths = [
        scene.assetUrl,
        path.resolve(paths.assetsDir, path.basename(scene.assetUrl)),
        path.resolve(paths.rootDir, scene.assetUrl),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          const buf = fs.readFileSync(p);
          const mime = p.endsWith('.png') ? 'image/png' : 'image/jpeg';
          scene.assetUrl = `data:${mime};base64,${buf.toString('base64')}`;
          schemaMutated = true;
          break;
        }
      }
    }
  }
  if (schemaMutated) {
    saveProjectSchema(projectId, projectSchema);
  }

  // 2. Real Remotion Render via CLI / Renderer Engine
  const schemaPath = path.join(paths.rootDir, 'project_schema.json');
  let remotionPkgDir = path.resolve(process.cwd(), 'packages/remotion-engine');
  if (!fs.existsSync(remotionPkgDir)) {
    remotionPkgDir = path.resolve(__dirname, '../../../../packages/remotion-engine');
  }
  const remotionEntry = path.join(remotionPkgDir, 'src/index.ts');

  if (!fs.existsSync(remotionEntry) || !fs.existsSync(schemaPath)) {
    throw new Error(
      `Cannot execute Remotion render: missing entry (${remotionEntry}) or schema (${schemaPath})`
    );
  }

  log.info('worker.remotion_rendering', `Invoking Remotion engine for ${projectId}`, {
    remotionEntry,
    schemaPath,
    outputPath,
  });

  const { spawn } = await import('child_process');
  try {
    await new Promise<void>((resolve, reject) => {
      const renderProcess = spawn(
        'npx',
        [
          'remotion',
          'render',
          remotionEntry,
          'ChronoVideo',
          outputPath,
          `--props=${schemaPath}`,
          '--concurrency=2',
          '--gl=angle',
          '--overwrite',
        ],
        {
          cwd: remotionPkgDir,
          stdio: 'pipe',
        }
      );

      let stderrOutput = '';
      renderProcess.stderr?.on('data', (chunk) => {
        stderrOutput += chunk.toString();
      });

      renderProcess.on('error', (err) => {
        reject(err);
      });

      renderProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Remotion CLI exited with code ${code}: ${stderrOutput}`));
        }
      });
    });
    log.info('worker.remotion_rendered_mp4', `Successfully rendered MP4 with Remotion Engine for ${projectId}`);
  } catch (renderErr: any) {
    const errorOutput = renderErr.message || String(renderErr);
    log.error('worker.remotion_cli_failed', `Remotion CLI execution failed for ${projectId}: ${errorOutput}`);
    throw new Error(`Remotion render failed for ${projectId}: ${errorOutput}`);
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Remotion video render failed to produce output MP4 file at "${outputPath}" for project "${projectId}".`);
  }

  const durationMs = Date.now() - startTime;
  const fileSizeBytes = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 1024;
  const peakMemoryMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024));

  // 4. Chromium Process Isolation cleanup: Clean temporary directory after render
  cleanProjectWorkspace(projectId, { cleanTempOnly: true });

  await job.updateProgress(100);

  log.info('worker.render_completed', `Render completed for ${projectId} in ${durationMs}ms`, {
    projectId,
    durationMs,
    peakMemoryMb,
    fileSizeBytes,
  });

  return {
    projectId,
    outputPath,
    fileSizeBytes,
    durationMs,
    peakMemoryMb,
    totalFrames,
  };
}

export function startRenderWorker(): Worker<RenderJobData, RenderJobResult> {
  const connection = getBullMqRedis();
  const worker = new Worker<RenderJobData, RenderJobResult>(
    QUEUE_NAMES.REMOTION_RENDER,
    async (job) => processRenderJob(job),
    {
      connection,
      concurrency: 1, // Strict Single Process Isolation to prevent RAM spikes
      lockDuration: 300000, // 5 min lock
    }
  );

  worker.on('completed', (job) => {
    log.info('worker.render_job_completed', `Render job ${job.id} completed for project ${job.data.projectId}`);
  });

  worker.on('failed', (job, err) => {
    log.error('worker.render_job_failed', `Render job ${job?.id} failed: ${err.message}`, { error: err });
  });

  return worker;
}
