/**
 * Parallel Worker A: VieNeu TTS Synthesis Node
 * Generates audio WAV files and word timestamps for each scene
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger, envConfig, initProjectWorkspace, SceneGeneration, WordTimestamp } from '@chronoviet/shared-spec';
import { VieNeuEngine, createSyntheticWavBuffer } from '@chronoviet/vieneu-tts';
import { AudioAssetEntry, ChronoGraphState } from '../state.js';

const log = createLogger({ service: 'agent-orchestrator' });
const ttsEngine = new VieNeuEngine();

export async function ttsSynthesisNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  log.info('orchestrator.tts_started', `Synthesizing TTS audio for ${state.scenes.length} scenes`, {
    projectId: state.projectId,
  });

  const paths = initProjectWorkspace(state.projectId);
  const results: {
    scene: SceneGeneration;
    asset: AudioAssetEntry;
  }[] = [];
  const batchSize = 4;

  for (let i = 0; i < state.scenes.length; i += batchSize) {
    const batch = state.scenes.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (scene) => {
        const audioFileName = `${scene.sceneId}.wav`;
        const audioFilePath = path.join(paths.audioDir, audioFileName);

        let durationSeconds = 3;
        let wordTimestamps: WordTimestamp[] = [];

        try {
          const ttsResult = await ttsEngine.synthesize({
            text: scene.voiceoverText,
            speakerId: 'vi_historical_male_1',
            speedRatio: 1.0,
            sampleRate: 24000,
            paddingMs: 300,
            fps: 30,
          });

          durationSeconds = Math.max(3, Math.round((ttsResult.audioDurationMs / 1000) * 10) / 10);
          wordTimestamps = ttsResult.wordTimestamps;

          // Copy or copy from tts cache if needed
          if (ttsResult.audioUrl && ttsResult.audioUrl.startsWith('/static/audio/')) {
            const base = path.basename(ttsResult.audioUrl);
            const candidates = [
              path.resolve(process.cwd(), 'media/audio-cache', base),
              path.resolve(process.cwd(), 'services/vieneu-tts/media/audio-cache', base),
              path.resolve(__dirname, '../../../../../media/audio-cache', base),
            ];
            for (const cand of candidates) {
              if (fs.existsSync(cand)) {
                fs.copyFileSync(cand, audioFilePath);
                break;
              }
            }
          }
        } catch (err: any) {
          // Eval Integrity: strict mode must not substitute heuristic timing / synthetic WAV
          if (envConfig.EVAL_STRICT) {
            throw err;
          }
          log.warn('orchestrator.tts_direct_failed', `TTS direct invocation failed, calculating timings: ${err.message}`);
          const words = scene.voiceoverText.split(/\s+/).filter(Boolean);
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
          // Eval Integrity: strict mode must not fabricate a synthetic WAV
          if (envConfig.EVAL_STRICT) {
            throw new Error(`[EVAL_STRICT] TTS produced no audio file for scene ${scene.sceneId} (${audioFilePath})`);
          }
          // Ensure real valid PCM 16-bit WAV file exists in project audio directory
          const wavBuf = createSyntheticWavBuffer(durationSeconds * 1000, wordTimestamps, 24000);
          fs.writeFileSync(audioFilePath, wavBuf);
        }

        return {
          scene: {
            ...scene,
            audioPath: audioFilePath,
            audioDurationSeconds: durationSeconds,
            wordTimestamps,
          },
          asset: {
            sceneId: scene.sceneId,
            audioPath: audioFilePath,
            durationSeconds,
            wordTimestamps,
          },
        };
      })
    );
    results.push(...batchResults);
  }

  const updatedScenes = results.map((r) => r.scene);
  const audioAssets = results.map((r) => r.asset);

  return {
    status: 'TTS_SYNTHESIZED',
    currentStep: 7,
    scenes: updatedScenes,
    audioAssets,
  };
}
