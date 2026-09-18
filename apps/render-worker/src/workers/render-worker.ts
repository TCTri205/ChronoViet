/**
 * BullMQ Worker: Remotion Video Render Queue (`remotion-render-queue`)
 * Chromium Process Isolation (configurable concurrency), Temp Cleanup, Redis PubSub Progress & Remote Asset Pre-download
 */

import { Worker, Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  RenderJobPayload,
  RenderJobResult as BaseRenderJobResult,
} from '@chronoviet/shared-spec';
import {
  cleanProjectWorkspace,
  createLogger,
  ensureProjectAssetsReady,
  envConfig,
  findMonorepoRoot,
  formatErrorMessage,
  initProjectWorkspace,
  loadProjectSchema,
  RedisPubSubManager,
  saveProjectSchema,
  renderDurationSeconds,
  renderWorkerMemoryBytes,
  ResourceSentinel,
} from '@chronoviet/infra';
import { getBullMqRedis, QUEUE_NAMES } from '../queues/queue-manager.js';
import { parseRemotionStdoutLine } from '../lib/remotion-progress-parser.js';

const log = createLogger({ service: 'render-worker' });
const pubsub = new RedisPubSubManager();

export const MAX_JOBS_BEFORE_RECYCLE = 10;
let totalCompletedRenderJobs = 0;

/**
 * Static overlay & texture asset caching in RAM Disk (/dev/shm) with OS temp fallback
 */
export function getRamDiskAssetCacheDir(): string {
  const ramDiskPath = '/dev/shm/chronoviet_assets';
  if (fs.existsSync('/dev/shm')) {
    try {
      if (!fs.existsSync(ramDiskPath)) fs.mkdirSync(ramDiskPath, { recursive: true });
      return ramDiskPath;
    } catch {}
  }
  const fallbackPath = path.join(os.tmpdir(), 'chronoviet_assets');
  if (!fs.existsSync(fallbackPath)) {
    try {
      fs.mkdirSync(fallbackPath, { recursive: true });
    } catch {}
  }
  return fallbackPath;
}

let cachedServeUrl: string | null = null;
let bundlePromise: Promise<string> | null = null;

export async function getOrCreateRemotionBundle(entryPoint: string): Promise<string> {
  if (cachedServeUrl && fs.existsSync(cachedServeUrl)) {
    return cachedServeUrl;
  }
  if (bundlePromise) {
    return bundlePromise;
  }

  bundlePromise = (async () => {
    try {
      const { bundle } = await import('@remotion/bundler');
      log.info('worker.remotion_bundling', `Pre-bundling Remotion composition from ${entryPoint}...`);
      const serveUrl = await bundle({
        entryPoint,
        webpackOverride: (config) => config,
      });
      cachedServeUrl = serveUrl;
      log.info('worker.remotion_bundled', `Remotion composition bundled successfully at ${serveUrl}`);
      return serveUrl;
    } catch (err: any) {
      bundlePromise = null;
      log.warn('worker.remotion_bundle_failed', `Failed to bundle with @remotion/bundler (${err.message}). Fallback to CLI execution.`);
      throw err;
    }
  })();

  return bundlePromise;
}

export type RenderJobData = RenderJobPayload;

export type RenderJobResult = BaseRenderJobResult & {
  outputPath: string;
  fileSizeBytes: number;
  durationMs: number;
  peakMemoryMb: number;
  totalFrames: number;
};

export async function processRenderJob(job: Job<RenderJobData>): Promise<RenderJobResult> {
  const { projectId, correlationId = projectId } = job.data;
  const startTime = Date.now();
  const workerLog = log.child({
    correlationId,
    fields: { projectId, jobId: job.id },
  });

  // 0. Pre-lock workspace schema existence verification to discard orphaned jobs immediately
  let projectSchema;
  try {
    projectSchema = loadProjectSchema(projectId);
  } catch (schemaErr: any) {
    const errorMsg = `Project schema missing or corrupted for "${projectId}": ${schemaErr.message}`;
    workerLog.error('worker.missing_schema_discard', errorMsg);
    await pubsub.publishRenderEvent({
      projectId,
      type: 'RENDER_FAILED',
      status: 'FAILED',
      errorMessage: errorMsg,
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    // Discard orphaned job from BullMQ queue to prevent infinite retry storms
    try {
      await job.discard();
    } catch {}

    const unrecoverableErr = new Error(errorMsg);
    (unrecoverableErr as any).unrecoverable = true;
    throw unrecoverableErr;
  }

  // 1. Acquire Distributed Render Lock to signal system of active video rendering
  const ttlSec = envConfig.RENDER_MUTEX_TTL_SECONDS || 900;
  await ResourceSentinel.acquireRenderLock(ttlSec, projectId);

  // Mutex auto-renew heartbeat during long rendering operations
  const heartbeatIntervalMs = Math.max(5000, Math.floor((ttlSec / 3) * 1000));
  const heartbeatTimer = setInterval(() => {
    ResourceSentinel.renewRenderLock(ttlSec, projectId).catch(() => {});
  }, heartbeatIntervalMs);

  let paths: ReturnType<typeof initProjectWorkspace> | undefined;

  try {
    workerLog.info('worker.render_started', `Starting Remotion render for project ${projectId}`, {
      projectId,
      jobId: job.id,
    });

    paths = initProjectWorkspace(projectId);
    const outputPath = path.join(paths.outputDir, 'video.mp4');

    // 2. Pre-download any remote assets & resolve local paths to media server HTTP URLs
    const probePort = envConfig.WORKER_PROBE_PORT || 3001;
    const mediaServerUrl = `http://127.0.0.1:${probePort}`;
    projectSchema = await ensureProjectAssetsReady(projectId, projectSchema, { mediaServerUrl });

    const totalFrames = projectSchema.timeline.reduce(
      (acc: number, scene: any) => acc + (scene.durationInFrames || 90),
      0
    );

    // 2.1 Zero-Copy Media Streaming: Clean/sanitize timeline scene asset placeholders
    let schemaMutated = false;
    for (const scene of projectSchema.timeline) {
      if (scene.assetUrl && scene.assetUrl.includes('RFVNTVlfSU1BR0VfREFUQV')) {
        scene.assetUrl = undefined;
        schemaMutated = true;
      }
    }
    if (schemaMutated) {
      saveProjectSchema(projectId, projectSchema);
    }

    // 3. Render Execution via Programmatic @remotion/renderer or Fallback to CLI
    const schemaPath = path.join(paths.rootDir, 'project_schema.json');
    const monorepoRoot = findMonorepoRoot();
    const remotionPkgDir = path.resolve(monorepoRoot, 'packages/remotion-engine');
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

    const optimalConcurrency = await ResourceSentinel.getOptimalRenderConcurrency(
      Number(envConfig.REMOTION_CONCURRENCY || envConfig.RENDER_CONCURRENCY || 2)
    );
    const renderConcurrency = String(optimalConcurrency);

    workerLog.info('worker.remotion_rendering', `Rendering Remotion engine for ${projectId} with optimalConcurrency=${optimalConcurrency}`, {
      remotionEntry,
      schemaPath,
      outputPath,
      optimalConcurrency,
    });

    let renderedSuccessfully = false;
    let lastProgressPublishTime = 0;

    // 3.1 Attempt Programmatic @remotion/renderer (Zero CLI process overhead)
    try {
      const serveUrl = await getOrCreateRemotionBundle(remotionEntry);
      const { renderMedia, selectComposition } = await import('@remotion/renderer');

      const composition = await selectComposition({
        serveUrl,
        id: 'ChronoVideo',
        inputProps: projectSchema,
      });

      workerLog.info('worker.remotion_programmatic_start', `Starting programmatic renderMedia with duration=${composition.durationInFrames} frames`);

      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps: projectSchema,
        concurrency: optimalConcurrency,
        chromiumOptions: {
          gl: process.platform === 'darwin' ? 'angle' : undefined,
        },
        overwrite: true,
        onProgress: ({ renderedFrames, progress }: { renderedFrames: number; progress: number }) => {
          const now = Date.now();
          const percent = Math.round(progress * 100);
          if (now - lastProgressPublishTime >= 800 || percent >= 100) {
            lastProgressPublishTime = now;
            job.updateProgress(percent).catch(() => {});
            pubsub.publishRenderEvent({
              projectId,
              type: 'RENDER_PROGRESS',
              status: 'RENDERING',
              progressPercent: percent,
              currentFrame: renderedFrames,
              totalFrames: composition.durationInFrames || totalFrames || 100,
              estimatedRemainingSec: 0,
              timestamp: new Date().toISOString(),
            }).catch(() => {});
          }
        },
      });

      renderedSuccessfully = true;
      workerLog.info('worker.remotion_rendered_mp4_programmatic', `Successfully rendered MP4 with @remotion/renderer for ${projectId}`);
    } catch (progErr: any) {
      workerLog.warn('worker.remotion_programmatic_fallback', `Programmatic renderMedia fallback (${progErr.message}). Invoking CLI spawn render.`, {
        error: progErr.message,
      });
    }

    // 3.2 Robust CLI spawn fallback if programmatic render was unsuccessful
    if (!renderedSuccessfully) {
      const { spawn } = await import('child_process');
      try {
        await new Promise<void>((resolve, reject) => {
          const cliArgs = [
            '--filter',
            '@chronoviet/remotion-engine',
            'exec',
            'remotion',
            'render',
            remotionEntry,
            'ChronoVideo',
            outputPath,
            `--props=${schemaPath}`,
            `--concurrency=${renderConcurrency}`,
            ...(process.platform === 'darwin' ? ['--gl=angle'] : []),
            '--overwrite',
          ];
          const renderProcess = spawn(
            'pnpm',
            cliArgs,
            {
              cwd: monorepoRoot,
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
        renderedSuccessfully = true;
        workerLog.info('worker.remotion_rendered_mp4_cli', `Successfully rendered MP4 with Remotion CLI for ${projectId}`);
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
  const mem = process.memoryUsage();
  const peakMemoryMb = Math.round(mem.heapUsed / (1024 * 1024));
  renderWorkerMemoryBytes.set({ type: 'heap' }, mem.heapUsed);
  renderWorkerMemoryBytes.set({ type: 'rss' }, mem.rss);

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
} finally {
  clearInterval(heartbeatTimer);
  try {
    if (paths) {
      const atomicJobDir = path.join(paths.tempDir, 'jobs', String(job.id || projectId));
      if (fs.existsSync(atomicJobDir)) {
        fs.rmSync(atomicJobDir, { recursive: true, force: true });
      }
    }
  } catch {}
  await ResourceSentinel.releaseRenderLock(projectId);
}
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

  worker.on('completed', async (job) => {
    totalCompletedRenderJobs++;
    log.info('worker.render_job_completed', `Render job ${job.id} completed for project ${job.data.projectId} (batch: ${totalCompletedRenderJobs}/${MAX_JOBS_BEFORE_RECYCLE})`);
    if (totalCompletedRenderJobs >= MAX_JOBS_BEFORE_RECYCLE) {
      log.info('worker.auto_recycle_triggered', `Render worker completed ${totalCompletedRenderJobs} jobs. Triggering graceful resource recycling to prevent Chromium memory leaks.`);
      totalCompletedRenderJobs = 0;
      if (global.gc) {
        try { global.gc(); } catch {}
      }

      // In production daemon mode, trigger graceful process exit to allow process supervisor (Docker/PM2) to respawn a clean process
      const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
      const enableAutoExit = process.env.ENABLE_WORKER_AUTO_EXIT === 'true' || (!isTestEnv && process.env.ENABLE_WORKER_AUTO_EXIT !== 'false');
      if (enableAutoExit && !isTestEnv) {
        log.info('worker.graceful_exit_initiated', 'Closing worker and waiting for all active jobs to finish before restart...');
        try {
          // Close worker cleanly: stops accepting new jobs and waits for active jobs to complete
          await worker.close();
          log.info('worker.graceful_exit_completed', 'Render worker closed cleanly. Exiting process for supervisor restart.');
          process.exit(0);
        } catch (exitErr: any) {
          log.error('worker.graceful_exit_error', `Error during graceful worker close: ${exitErr.message}`);
          process.exit(1);
        }
      }
    }
  });

  worker.on('failed', (job, err) => {
    log.error('worker.render_job_failed', `Render job ${job?.id} failed: ${formatErrorMessage(err)}`, { error: err });
  });

  worker.on('error', (err) => {
    log.warn('worker.render_redis_error', `Render worker Redis connection error: ${formatErrorMessage(err)}`, { error: err });
  });

  return worker;
}
