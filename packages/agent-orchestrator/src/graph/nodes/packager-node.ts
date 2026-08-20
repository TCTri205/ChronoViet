/**
 * JSON Schema v3.2 Packager Agent Node
 * Synthesizes final Remotion-compatible project schema and validates against VideoProjectSchema
 */

import {
  CaptionWord,
  ChronoVideoProps,
  saveProjectSchema,
  TimelineScene,
  VideoProjectSchema,
} from '@chronoviet/shared-spec';
import { ChronoGraphState, getNodeLogger } from '../state.js';

export async function packagerNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'packager');
  nodeLog.info('orchestrator.packager_started', `Packaging ${state.scenes.length} scenes into project_schema.json`, {
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

    const sceneAudioUrl = scene.audioPath;
    const assetUrl = scene.selectedAsset
      ? scene.selectedAsset.localPath || scene.selectedAsset.imageUrl
      : undefined;

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

  const templateId = state.templateId || 'HISTORICAL_DOCUMENTARY';
  const aspectRatio = templateId === 'QUICK_SHORTS' ? '9:16' : '16:9';

  const rawVideoProps: ChronoVideoProps = {
    title: state.userPrompt,
    aspectRatio,
    templateId,
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
    nodeLog.info('orchestrator.schema_saved', `Saved validated project_schema.json to workspace for ${state.projectId}`);
  } catch (err: any) {
    nodeLog.warn('orchestrator.save_schema_error', `Could not save to disk workspace: ${err.message}`);
  }

  return {
    status: 'COMPLETED',
    currentStep: 12,
    videoProps: validatedSchema,
  };
}
