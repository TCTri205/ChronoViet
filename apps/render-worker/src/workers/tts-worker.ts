/**
 * BullMQ Worker: TTS Generation Queue (`tts-gen-queue`)
 */

import { Worker, Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger, envConfig, initProjectWorkspace, WordTimestamp } from '@chronoviet/shared-spec';
import { VieNeuEngine } from '@chronoviet/vieneu-tts';
import { getBullMqRedis, QUEUE_NAMES } from '../queues/queue-manager.js';

const log = createLogger({ service: 'render-worker' });
const ttsEngine = new VieNeuEngine();

export interface TTSJobData {
  projectId: string;
  sceneId: string;
  voiceoverText: string;
  speedMultiplier?: number;
}

export interface TTSJobResult {
  sceneId: string;
  audioPath: string;
  durationSeconds: number;
  wordTimestamps: WordTimestamp[];
}

export async function processTTSJob(job: Job<TTSJobData>): Promise<TTSJobResult> {
  const { projectId, sceneId, voiceoverText } = job.data;
  log.info('worker.tts_processing', `Processing TTS job ${job.id} for scene ${sceneId}`, {
    projectId,
    sceneId,
  });

  const paths = initProjectWorkspace(projectId);
  const audioFilePath = path.join(paths.audioDir, `${sceneId}.wav`);

  let durationSeconds = 3;
  let wordTimestamps: WordTimestamp[] = [];

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

    if (ttsResult.audioUrl && ttsResult.audioUrl.startsWith('/static/audio/')) {
      const cachedFile = path.resolve(process.cwd(), 'services/vieneu-tts/media/audio-cache', path.basename(ttsResult.audioUrl));
      if (fs.existsSync(cachedFile)) {
        fs.copyFileSync(cachedFile, audioFilePath);
      }
    }
  } catch (err: any) {
    // Eval Integrity: strict mode must not substitute heuristic word timing
    if (envConfig.EVAL_STRICT) {
      throw err;
    }
    log.warn('worker.tts_synthesis_failed', `TTS synthesis failed for ${sceneId}, falling back to word timing: ${err.message}`);
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

  if (!fs.existsSync(audioFilePath)) {
    // Eval Integrity: strict mode must not retry silently or return a missing audio file
    if (envConfig.EVAL_STRICT) {
      throw new Error(`[EVAL_STRICT] TTS produced no audio file for scene ${sceneId} (${audioFilePath})`);
    }
    const fallbackResult = await ttsEngine.synthesize({
      text: voiceoverText || 'Thuyết minh',
      speakerId: 'vi_historical_male_1',
      speedRatio: 1.0,
      sampleRate: 24000,
      paddingMs: 300,
      fps: 30,
    });
    const cachedFile = path.resolve(process.cwd(), 'services/vieneu-tts/media/audio-cache', path.basename(fallbackResult.audioUrl));
    if (fs.existsSync(cachedFile)) {
      fs.copyFileSync(cachedFile, audioFilePath);
    }
  }

  await job.updateProgress(100);

  return {
    sceneId,
    audioPath: audioFilePath,
    durationSeconds,
    wordTimestamps,
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
    log.info('worker.tts_completed', `TTS job ${job.id} completed for scene ${job.data.sceneId}`);
  });

  worker.on('failed', (job, err) => {
    log.error('worker.tts_failed', `TTS job ${job?.id} failed: ${err.message}`, { error: err });
  });

  return worker;
}
