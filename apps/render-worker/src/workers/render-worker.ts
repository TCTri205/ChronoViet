/**
 * BullMQ Worker: Remotion Video Render Queue (`remotion-render-queue`)
 * Chromium Process Isolation (configurable concurrency), Temp Cleanup, Redis PubSub Progress & Remote Asset Pre-download
 */

import { Worker, Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  cleanProjectWorkspace,
  createLogger,
  ensureProjectAssetsReady,
  envConfig,
  formatErrorMessage,
  initProjectWorkspace,
  loadProjectSchema,
  RedisPubSubManager,
  saveProjectSchema,
  renderDurationSeconds,
} from '@chronoviet/shared-spec';
import { getBullMqRedis, QUEUE_NAMES } from '../queues/queue-manager.js';
import { parseRemotionStdoutLine } from '../lib/remotion-progress-parser.js';

const log = createLogger({ service: 'render-worker' });
const pubsub = new RedisPubSubManager();

export interface RenderJobData {
  projectId: string;
  correlationId?: string;
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
  const { projectId, correlationId = projectId } = job.data;
  const startTime = Date.now();
  const workerLog = log.child({
    correlationId,
    fields: { projectId, jobId: job.id },
  });

  workerLog.info('worker.render_started', `Starting Remotion render for project ${projectId}`, {
    projectId,
    jobId: job.id,
  });

  const paths = initProjectWorkspace(projectId);
  const outputPath = path.join(paths.outputDir, 'video.mp4');

  // 1. Load schema and pre-download any remote assets
  let projectSchema = loadProjectSchema(projectId);
  projectSchema = await ensureProjectAssetsReady(projectId, projectSchema);

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
    const errorMsg = `Cannot execute Remotion render: missing entry (${remotionEntry}) or schema (${schemaPath})`;
    await pubsub.publishRenderEvent({
      projectId,
      type: 'RENDER_FAILED',
      status: 'FAILED',
      errorMessage: errorMsg,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
    throw new Error(errorMsg);
  }

  const defaultConcurrency = Math.max(1, Math.min(os.cpus().length - 1, 4));
  const renderConcurrency = String(envConfig.RENDER_CONCURRENCY || process.env.RENDER_CONCURRENCY || defaultConcurrency);

  log.info('worker.remotion_rendering', `Invoking Remotion engine for ${projectId} with concurrency=${renderConcurrency}`, {
    remotionEntry,
    schemaPath,
    outputPath,
    renderConcurrency,
  });

  const { spawn } = await import('child_process');
  let lastProgressPublishTime = 0;

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
          `--concurrency=${renderConcurrency}`,
          '--gl=angle',
          '--overwrite',
        ],
        {
          cwd: remotionPkgDir,
          stdio: 'pipe',
        }
      );

      let stderrOutput = '';

      renderProcess.stdout?.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          const parsed = parseRemotionStdoutLine(line, totalFrames);
          if (parsed) {
            const now = Date.now();
            if (now - lastProgressPublishTime >= 800 || parsed.progressPercent >= 100) {
              lastProgressPublishTime = now;
              job.updateProgress(Math.round(parsed.progressPercent)).catch(() => {});
              pubsub.publishRenderEvent({
                projectId,
                type: 'RENDER_PROGRESS',
                status: 'RENDERING',
                progressPercent: parsed.progressPercent,
                currentFrame: parsed.currentFrame ?? Math.round((parsed.progressPercent / 100) * totalFrames),
                totalFrames: totalFrames || 100,
                estimatedRemainingSec: parsed.estimatedRemainingSec ?? 0,
                timestamp: new Date().toISOString(),
              }).catch(() => {});
            }
          }
        }
      });

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
    workerLog.info('worker.remotion_rendered_mp4', `Successfully rendered MP4 with Remotion Engine for ${projectId}`);
  } catch (renderErr: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    renderDurationSeconds.observe({ status: 'failed' }, durationSec);
    const errorOutput = renderErr.message || String(renderErr);
    workerLog.error('worker.remotion_cli_failed', `Remotion CLI execution failed for ${projectId}: ${errorOutput}`);
    await pubsub.publishRenderEvent({
      projectId,
      type: 'RENDER_FAILED',
      status: 'FAILED',
      errorMessage: errorOutput,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
    throw new Error(`Remotion render failed for ${projectId}: ${errorOutput}`);
  }

  if (!fs.existsSync(outputPath)) {
    const durationSec = (Date.now() - startTime) / 1000;
    renderDurationSeconds.observe({ status: 'failed' }, durationSec);
    const errorMsg = `Remotion video render failed to produce output MP4 file at "${outputPath}" for project "${projectId}".`;
    await pubsub.publishRenderEvent({
      projectId,
      type: 'RENDER_FAILED',
      status: 'FAILED',
      errorMessage: errorMsg,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
    throw new Error(errorMsg);
  }

  const durationMs = Date.now() - startTime;
  renderDurationSeconds.observe({ status: 'completed' }, durationMs / 1000);
  const fileSizeBytes = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 1024;
  const peakMemoryMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024));

  // 3. Chromium Process Isolation cleanup: Clean temporary directory after render
  cleanProjectWorkspace(projectId, { cleanTempOnly: true });

  await job.updateProgress(100);

  // 4. Publish RENDER_COMPLETED event via Redis PubSub
  await pubsub.publishRenderEvent({
    projectId,
    type: 'RENDER_COMPLETED',
    status: 'COMPLETED',
    outputPath,
    fileSizeBytes,
    durationMs,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  workerLog.info('worker.render_completed', `Render completed for ${projectId} in ${durationMs}ms`, {
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
  const workerConcurrency = envConfig.RENDER_CONCURRENCY || 1;

  const worker = new Worker<RenderJobData, RenderJobResult>(
    QUEUE_NAMES.REMOTION_RENDER,
    async (job) => processRenderJob(job),
    {
      connection,
      concurrency: workerConcurrency,
      lockDuration: 300000, // 5 min lock
    }
  );

  worker.on('completed', (job) => {
    log.info('worker.render_job_completed', `Render job ${job.id} completed for project ${job.data.projectId}`);
  });

  worker.on('failed', (job, err) => {
    log.error('worker.render_job_failed', `Render job ${job?.id} failed: ${formatErrorMessage(err)}`, { error: err });
  });

  worker.on('error', (err) => {
    log.warn('worker.render_redis_error', `Render worker Redis connection error: ${formatErrorMessage(err)}`, { error: err });
  });

  return worker;
}
