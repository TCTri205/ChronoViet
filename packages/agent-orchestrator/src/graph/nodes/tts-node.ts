/**
 * Parallel Worker A: VieNeu TTS Synthesis Node
 * Generates audio WAV files and word timestamps for each scene
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { SceneGeneration, WordTimestamp } from '@chronoviet/shared-spec';
import { envConfig, initProjectWorkspace, VieNeuEngine, createSyntheticWavBuffer } from '@chronoviet/infra';
import { AudioAssetEntry, ChronoGraphState, getNodeLogger, TelemetryAuditEntry } from '../state.js';

const ttsEngine = new VieNeuEngine();

export async function ttsSynthesisNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'tts_synthesis');
  nodeLog.info('orchestrator.tts_started', `Synthesizing TTS audio for ${state.scenes.length} scenes`, {
    projectId: state.projectId,
  });

  const paths = initProjectWorkspace(state.projectId);
  const results: {
    scene: SceneGeneration;
    asset: AudioAssetEntry;
  }[] = [];
  const telemetryAudit: TelemetryAuditEntry[] = [];
  const batchSize = 4;

  for (let i = 0; i < state.scenes.length; i += batchSize) {
    const batch = state.scenes.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (scene) => {
        const audioFileName = `${scene.sceneId}.wav`;
        const audioFilePath = path.join(paths.audioDir, audioFileName);

        // 0. Idempotency / Resume Support: Check if existing asset is valid and exists on disk
        const existingAsset = state.audioAssets?.find((a) => a.sceneId === scene.sceneId);
        if (existingAsset && fs.existsSync(existingAsset.audioPath)) {
          nodeLog.debug('orchestrator.tts_reuse_existing', `Reusing existing TTS audio for scene ${scene.sceneId}`, {
            sceneId: scene.sceneId,
            durationSeconds: existingAsset.durationSeconds,
          });
          return {
            scene: {
              ...scene,
              audioPath: existingAsset.audioPath,
              audioDurationSeconds: existingAsset.durationSeconds,
              wordTimestamps: existingAsset.wordTimestamps,
            },
            asset: existingAsset,
          };
        }

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
              path.resolve(envConfig.AUDIO_CACHE_DIR, base),
              envConfig.MEDIA_DIR ? path.resolve(envConfig.MEDIA_DIR, 'audio-cache', base) : '',
              path.resolve(process.cwd(), 'media/audio-cache', base),
              path.resolve('/media/audio-cache', base),
            ].filter(Boolean);
            for (const cand of candidates) {
              if (fs.existsSync(cand)) {
                await fsPromises.copyFile(cand, audioFilePath);
                break;
              }
            }
          }
        } catch (err: any) {
          // Eval Integrity: strict mode must not substitute heuristic timing / synthetic WAV
          if (envConfig.EVAL_STRICT) {
            throw err;
          }
          nodeLog.warn('orchestrator.tts_direct_failed', `TTS direct invocation failed, calculating timings: ${err.message}`, {
            sceneId: scene.sceneId,
            error: err.message,
          });
          telemetryAudit.push({
            timestamp: new Date().toISOString(),
            node: 'tts_synthesis',
            level: 'WARN',
            category: 'FALLBACK',
            message: `TTS direct invocation failed for scene ${scene.sceneId}: ${err.message}`,
            metadata: { sceneId: scene.sceneId, error: err.message },
          });
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
          await fsPromises.writeFile(audioFilePath, wavBuf);
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
    telemetryAudit,
  };
}
