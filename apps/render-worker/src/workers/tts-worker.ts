/**
 * BullMQ Worker: TTS Generation Queue (`tts-gen-queue`)
 */

import { Worker, Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { WordTimestamp } from '@chronoviet/shared-spec';
import {
  createLogger,
  envConfig,
  formatErrorMessage,
  initProjectWorkspace,
  ttsRequestsTotal,
  ttsSynthesisDurationSeconds,
  VieNeuEngine,
} from '@chronoviet/infra';
import { getBullMqRedis, QUEUE_NAMES } from '../queues/queue-manager.js';

const log = createLogger({ service: 'render-worker' });
const ttsEngine = new VieNeuEngine();

export interface TTSJobData {
  projectId: string;
  correlationId?: string;
  sceneId: string;
  voiceoverText: string;
  speedMultiplier?: number;
}

export interface TTSJobResult {
  sceneId: string;
  audioPath: string;
  durationSeconds: number;
  wordTimestamps: WordTimestamp[];
  engine: 'local_vieneu' | 'synthetic_timing';
}

export async function processTTSJob(job: Job<TTSJobData>): Promise<TTSJobResult> {
  const { projectId, correlationId = projectId, sceneId, voiceoverText } = job.data;
  const startTime = Date.now();
  const workerLog = log.child({
    correlationId,
    fields: { projectId, sceneId, jobId: job.id },
  });

  workerLog.debug('worker.tts_processing', `Processing TTS job ${job.id} for scene ${sceneId}`, {
    projectId,
    sceneId,
  });

  const paths = initProjectWorkspace(projectId);
  const audioFilePath = path.join(paths.audioDir, `${sceneId}.wav`);

  let durationSeconds = 3;
  let wordTimestamps: WordTimestamp[] = [];
  let engine: 'local_vieneu' | 'synthetic_timing' = 'local_vieneu';

  try {
    const ttsResult = await ttsEngine.synthesize({
      text: voiceoverText,
      speakerId: 'vi_historical_male_1',
      speedRatio: job.data.speedMultiplier ?? 1.0,
      sampleRate: 24000,
      paddingMs: 300,
      fps: 30,
    });

    durationSeconds = Math.max(3, Math.round((ttsResult.audioDurationMs / 1000) * 10) / 10);
    wordTimestamps = ttsResult.wordTimestamps;
    engine = 'local_vieneu';

    const ttsDurationSec = (Date.now() - startTime) / 1000;
    ttsRequestsTotal.inc({ engine: 'local_vieneu', status: 'completed' });
    ttsSynthesisDurationSeconds.observe({ engine: 'local_vieneu' }, ttsDurationSec);

    if (ttsResult.audioUrl && ttsResult.audioUrl.startsWith('/static/audio/')) {
      const base = path.basename(ttsResult.audioUrl);
      const candidates = [
        path.resolve(envConfig.AUDIO_CACHE_DIR, base),
        path.resolve(process.cwd(), 'media/audio-cache', base),
        path.resolve('/media/audio-cache', base),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          try {
            await fs.promises.copyFile(cand, audioFilePath);
            break;
          } catch {}
        }
      }
    }
  } catch (err: any) {
    const ttsDurationSec = (Date.now() - startTime) / 1000;
    // Eval Integrity: strict mode must not substitute heuristic word timing
    if (envConfig.EVAL_STRICT) {
      ttsRequestsTotal.inc({ engine: 'local_vieneu', status: 'failed' });
      ttsSynthesisDurationSeconds.observe({ engine: 'local_vieneu' }, ttsDurationSec);
      throw err;
    }
    engine = 'synthetic_timing';
    ttsRequestsTotal.inc({ engine: 'synthetic_timing', status: 'fallback' });
    ttsSynthesisDurationSeconds.observe({ engine: 'synthetic_timing' }, ttsDurationSec);
    workerLog.warn('worker.tts_synthesis_failed', `TTS synthesis failed for ${sceneId}, falling back to synthetic word timing: ${err.message}`, {
      sceneId,
      error: err.message,
      engine,
    });
    const words = voiceoverText.split(/\s+/).filter(Boolean);
    durationSeconds = Math.max(3, Math.round((words.length / 2.5) * 10) / 10);
    const msPerWord = (durationSeconds * 1000) / Math.max(1, words.length);
    let currentMs = 0;
    for (const word of words) {
      const startMs = Math.round(currentMs);
      const endMs = Math.round(currentMs + msPerWord);
      wordTimestamps.push({ word, startMs, endMs });
      currentMs = endMs;
    }
  }



  await job.updateProgress(100);

  workerLog.info('worker.tts_generated', `TTS generated for scene ${sceneId} via ${engine}`, {
    projectId,
    sceneId,
    durationSeconds,
    wordCount: wordTimestamps.length,
    engine,
  });

  return {
    sceneId,
    audioPath: audioFilePath,
    durationSeconds,
    wordTimestamps,
    engine,
  };
}

export function startTTSWorker(): Worker<TTSJobData, TTSJobResult> {
  const connection = getBullMqRedis();
  const worker = new Worker<TTSJobData, TTSJobResult>(
    QUEUE_NAMES.TTS_GEN,
    async (job) => processTTSJob(job),
    {
      connection,
      concurrency: 4,
    }
  );

  worker.on('completed', (job) => {
    log.debug('worker.tts_completed', `TTS job ${job.id} completed for scene ${job.data.sceneId}`);
  });

  worker.on('failed', (job, err) => {
    log.error('worker.tts_failed', `TTS job ${job?.id} failed: ${formatErrorMessage(err)}`, { error: err });
  });

  worker.on('error', (err) => {
    log.warn('worker.tts_redis_error', `TTS worker Redis connection error: ${formatErrorMessage(err)}`, { error: err });
  });

  return worker;
}
