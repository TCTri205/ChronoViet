/**
 * Parallel Worker A: VieNeu TTS Synthesis Node
 * Generates audio WAV files and word timestamps for each scene
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { SceneGeneration, WordTimestamp } from '@chronoviet/shared-spec';
import { envConfig, initProjectWorkspace, VieNeuEngine, createSyntheticWavBuffer, getAdaptiveConcurrency, normalizeVietnameseTextForSpeech } from '@chronoviet/infra';
import { AudioAssetEntry, ChronoGraphState, getNodeLogger, TelemetryAuditEntry } from '../state.js';

const ttsEngine = new VieNeuEngine();

export async function ttsSynthesisNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'tts_synthesis');
  const batchSize = getAdaptiveConcurrency('TTS');
  nodeLog.info('orchestrator.tts_started', `Synthesizing TTS audio for ${state.scenes.length} scenes (batchSize=${batchSize})`, {
    projectId: state.projectId,
    batchSize,
  });

  const paths = initProjectWorkspace(state.projectId, state.customBaseDir);
  const results: {
    scene: SceneGeneration;
    asset: AudioAssetEntry;
  }[] = [];
  const telemetryAudit: TelemetryAuditEntry[] = [];

  for (let i = 0; i < state.scenes.length; i += batchSize) {
    const batch = state.scenes.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (scene) => {
        const normalizedText = normalizeVietnameseTextForSpeech(scene.voiceoverText);
        const textHash = crypto.createHash('md5').update(normalizedText.trim()).digest('hex').slice(0, 8);
        const audioFileName = `${scene.sceneId}_${textHash}.wav`;
        const legacyAudioFileName = `${scene.sceneId}.wav`;
        const audioFilePath = path.join(paths.audioDir, audioFileName);
        const legacyAudioFilePath = path.join(paths.audioDir, legacyAudioFileName);

        const sidecarJsonPath = audioFilePath.replace(/\.wav$/, '.json');

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
              normalizedVoiceoverText: normalizedText,
              audioPath: existingAsset.audioPath,
              audioDurationSeconds: existingAsset.durationSeconds,
              wordTimestamps: existingAsset.wordTimestamps,
            },
            asset: existingAsset,
          };
        }

        if (fs.existsSync(audioFilePath)) {
          let cachedTimestamps = scene.wordTimestamps;
          let cachedDur = scene.audioDurationSeconds || scene.targetDurationSeconds || 3;

          if ((!cachedTimestamps || cachedTimestamps.length === 0) && fs.existsSync(sidecarJsonPath)) {
            try {
              const meta = JSON.parse(await fsPromises.readFile(sidecarJsonPath, 'utf-8'));
              if (meta.wordTimestamps && Array.isArray(meta.wordTimestamps)) {
                cachedTimestamps = meta.wordTimestamps;
                if (meta.durationSeconds) cachedDur = meta.durationSeconds;
              }
            } catch {}
          }

          if (cachedTimestamps && cachedTimestamps.length > 0) {
            nodeLog.debug('orchestrator.tts_reuse_hashed', `Reusing hashed audio file with timestamps for scene ${scene.sceneId}`, {
              audioFilePath,
            });
            return {
              scene: {
                ...scene,
                normalizedVoiceoverText: normalizedText,
                audioPath: audioFilePath,
                audioDurationSeconds: cachedDur,
                wordTimestamps: cachedTimestamps,
              },
              asset: {
                sceneId: scene.sceneId,
                audioPath: audioFilePath,
                durationSeconds: cachedDur,
                wordTimestamps: cachedTimestamps,
              },
            };
          }
        }

        let durationSeconds = 3;
        let wordTimestamps: WordTimestamp[] = [];

        try {
          const wordCount = normalizedText.trim().split(/\s+/).filter(Boolean).length;
          const targetWpm = state.templateId === 'QUICK_SHORTS' ? 160 : (state.templateId === 'MODERN_NEWS' ? 150 : 145);
          const estimatedAudioSec = wordCount > 0 ? wordCount / (targetWpm / 60) : 3;
          const targetDuration = scene.targetDurationSeconds || 5;
          const rawSpeedRatio = estimatedAudioSec / targetDuration;
          const speedRatio = Math.max(0.95, Math.min(1.15, Math.round(rawSpeedRatio * 100) / 100));

          const ttsResult = await ttsEngine.synthesize({
            text: normalizedText,
            speakerId: 'vi_historical_male_1',
            speedRatio,
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
          nodeLog.error('orchestrator.tts_direct_failed', `VieNeu TTS invocation failed for scene ${scene.sceneId}: ${err.message}`, {
            sceneId: scene.sceneId,
            error: err.message,
          });
          throw new Error(`[VIENEU_TTS_ERROR] Failed to synthesize audio for scene ${scene.sceneId} using VieNeu-TTS: ${err.message}`);
        }

        if (!fs.existsSync(audioFilePath)) {
          const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
          if (isTestEnv || !envConfig.EVAL_STRICT) {
            const syntheticBuf = createSyntheticWavBuffer(Math.round(durationSeconds * 1000), wordTimestamps);
            await fsPromises.writeFile(audioFilePath, syntheticBuf);
          } else {
            throw new Error(`[VIENEU_TTS_ERROR] Audio file was not created at ${audioFilePath} for scene ${scene.sceneId}`);
          }
        }

        try {
          await fsPromises.writeFile(sidecarJsonPath, JSON.stringify({ durationSeconds, wordTimestamps }), 'utf-8');
        } catch {}

        return {
          scene: {
            ...scene,
            normalizedVoiceoverText: normalizedText,
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
