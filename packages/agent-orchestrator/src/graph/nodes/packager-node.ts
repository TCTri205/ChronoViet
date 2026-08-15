/**
 * JSON Schema v3.2 Packager Agent Node
 * Synthesizes final Remotion-compatible project schema and validates against VideoProjectSchema
 */

import * as fs from 'fs';
import {
  CaptionWord,
  ChronoVideoProps,
  createLogger,
  saveProjectSchema,
  TimelineScene,
  VideoProjectSchema,
} from '@chronoviet/shared-spec';
import { ChronoGraphState } from '../state.js';

const log = createLogger({ service: 'agent-orchestrator' });

export async function packagerNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  log.info('orchestrator.packager_started', `Packaging ${state.scenes.length} scenes into project_schema.json`, {
    projectId: state.projectId,
  });

  const fps = 30;
  const timeline: TimelineScene[] = [];
  const allCaptions: CaptionWord[] = [];
  let currentGlobalFrame = 0;

  for (let i = 0; i < state.scenes.length; i++) {
    const scene = state.scenes[i];
    const durationInFrames = Math.max(90, Math.ceil(scene.targetDurationSeconds * fps));

    const sceneCaptions: CaptionWord[] = [];
    if (scene.wordTimestamps && scene.wordTimestamps.length > 0) {
      for (const wt of scene.wordTimestamps) {
        const startFrame = currentGlobalFrame + Math.round((wt.startMs / 1000) * fps);
        const endFrame = currentGlobalFrame + Math.round((wt.endMs / 1000) * fps);
        const capWord: CaptionWord = {
          word: wt.word,
          startFrame,
          endFrame,
        };
        sceneCaptions.push(capWord);
        allCaptions.push(capWord);
      }
    }

    let sceneAudioUrl = scene.audioPath;
    if (scene.audioPath && !scene.audioPath.startsWith('http') && !scene.audioPath.startsWith('data:')) {
      if (fs.existsSync(scene.audioPath)) {
        try {
          const audioBuf = fs.readFileSync(scene.audioPath);
          const mime = scene.audioPath.endsWith('.mp3') ? 'audio/mp3' : 'audio/wav';
          sceneAudioUrl = `data:${mime};base64,${audioBuf.toString('base64')}`;
        } catch {
          // keep original
        }
      }
    }

    let assetUrl = scene.selectedAsset
      ? scene.selectedAsset.localPath || scene.selectedAsset.imageUrl
      : undefined;
    if (assetUrl && !assetUrl.startsWith('http') && !assetUrl.startsWith('data:')) {
      if (fs.existsSync(assetUrl)) {
        try {
          const imgBuf = fs.readFileSync(assetUrl);
          const mime = assetUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
          assetUrl = `data:${mime};base64,${imgBuf.toString('base64')}`;
        } catch {
          // keep original
        }
      }
    }

    const timelineScene: TimelineScene = {
      id: scene.sceneId,
      durationInFrames,
      layoutMode: scene.layoutMode,
      text: scene.voiceoverText,
      sceneAudioUrl,
      assetUrl,
      attribution: scene.selectedAsset
        ? {
            author: scene.selectedAsset.author || 'Wikimedia Commons Contributor',
            sourceUrl: scene.selectedAsset.sourceUrl || scene.selectedAsset.imageUrl,
            license: scene.selectedAsset.license,
          }
        : undefined,
      captions: sceneCaptions.length > 0 ? sceneCaptions : undefined,
    };

    timeline.push(timelineScene);
    currentGlobalFrame += durationInFrames;
  }

  const rawVideoProps: ChronoVideoProps = {
    title: state.userPrompt,
    aspectRatio: '16:9',
    fps,
    defaultLayoutMode: 'HISTORICAL_FRAME',
    timeline,
    captions: allCaptions.length > 0 ? allCaptions : undefined,
  };

  // Validate with Zod Schema (SSOT)
  const validatedSchema = VideoProjectSchema.parse(rawVideoProps);

  // Save to project workspace disk
  try {
    saveProjectSchema(state.projectId, validatedSchema);
    log.info('orchestrator.schema_saved', `Saved validated project_schema.json to workspace for ${state.projectId}`);
  } catch (err: any) {
    log.warn('orchestrator.save_schema_error', `Could not save to disk workspace: ${err.message}`);
  }

  return {
    status: 'COMPLETED',
    currentStep: 12,
    videoProps: validatedSchema,
  };
}
