/**
 * JSON Schema v3.2 Packager Agent Node
 * Synthesizes final Remotion-compatible project schema and validates against VideoProjectSchema
 */

import {
  CaptionWord,
  ChronoVideoProps,
  TimelineScene,
  VideoProjectSchema,
} from '@chronoviet/shared-spec';
import {
  envConfig,
  saveProjectSchema,
} from '@chronoviet/infra';
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
    const effectiveAudioDuration = scene.audioDurationSeconds || scene.targetDurationSeconds || 3;
    const durationInFrames = Math.max(90, Math.ceil(effectiveAudioDuration * fps));

    const sceneCaptions: CaptionWord[] = [];
    if (scene.wordTimestamps && scene.wordTimestamps.length > 0) {
      for (const wt of scene.wordTimestamps) {
        const localStartFrame = Math.round((wt.startMs / 1000) * fps);
        const localEndFrame = Math.round((wt.endMs / 1000) * fps);
        const sceneCapWord: CaptionWord = {
          word: wt.word,
          startFrame: localStartFrame,
          endFrame: localEndFrame,
        };
        sceneCaptions.push(sceneCapWord);

        const globalCapWord: CaptionWord = {
          word: wt.word,
          startFrame: currentGlobalFrame + localStartFrame,
          endFrame: currentGlobalFrame + localEndFrame,
        };
        allCaptions.push(globalCapWord);
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
    saveProjectSchema(state.projectId, validatedSchema, state.customBaseDir);
    nodeLog.info('orchestrator.schema_saved', `Saved validated project_schema.json to workspace for ${state.projectId}`);
  } catch (err: any) {
    nodeLog.warn('orchestrator.save_schema_error', `Could not save to disk workspace: ${err.message}`);
  }

  let finalStatus: 'PACKAGED' | 'RENDERING' | 'COMPLETED' = 'PACKAGED';

  // Auto-enqueue to BullMQ remotion-render-queue
  const autoDispatch = envConfig.AUTO_DISPATCH_RENDER !== false && process.env.AUTO_DISPATCH_RENDER !== 'false';
  const isTestEnv = process.env.NODE_ENV === 'test' || envConfig.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  if (autoDispatch && !isTestEnv) {
    try {
      const { enqueueRenderJob, getProjectPaths } = await import('@chronoviet/infra');
      const { jobId } = await enqueueRenderJob(state.projectId, {
        correlationId: state.correlationId || state.projectId,
        outputFormat: 'mp4',
      });
      finalStatus = 'RENDERING';

      // Persist active jobId in metadata.json for accurate abort and progress tracking
      try {
        const paths = getProjectPaths(state.projectId, state.customBaseDir);
        let metadata: Record<string, any> = { projectId: state.projectId };
        const fs = await import('fs');
        if (fs.existsSync(paths.metadataFile)) {
          try {
            metadata = JSON.parse(fs.readFileSync(paths.metadataFile, 'utf-8'));
          } catch {}
        }
        metadata.status = 'RENDERING';
        metadata.renderJobId = jobId;
        metadata.enqueuedAt = new Date().toISOString();
        metadata.updatedAt = new Date().toISOString();
        fs.writeFileSync(paths.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
      } catch (metaErr: any) {
        nodeLog.warn('orchestrator.metadata_job_id_warning', `Could not persist renderJobId to metadata: ${metaErr.message}`);
      }

      nodeLog.info('orchestrator.auto_render_dispatched', `Auto-dispatched project ${state.projectId} to render queue (jobId: ${jobId})`, {
        jobId,
        projectId: state.projectId,
      });
    } catch (enqueueErr: any) {
      nodeLog.warn('orchestrator.auto_render_enqueue_failed', `Failed to auto-dispatch render: ${enqueueErr.message}`);
      finalStatus = 'PACKAGED';
    }
  } else {
    finalStatus = 'COMPLETED';
  }

  return {
    status: finalStatus,
    currentStep: 12,
    videoProps: validatedSchema,
  };
}
