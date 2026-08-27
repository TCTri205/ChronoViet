/**
 * Parallel Worker B: Asset Crawler & VLM Inspector Node
 * Reads the candidate pool produced by the Research Agent (researchResults) and
 * evaluates 3+3 candidates, falling back to PURE_CODE layout when no image passes.
 */

import { SceneGeneration, VisualCandidate, LayoutMode, isPureImageLayout } from '@chronoviet/shared-spec';
import { envConfig, getAdaptiveConcurrency } from '@chronoviet/infra';
import { inspectSceneVisuals } from '@chronoviet/vlm-inspector';
import { ChronoGraphState, getNodeLogger } from '../state.js';

const VLM_SCENE_TIMEOUT_MS = (envConfig as any).VLM_SCENE_TIMEOUT_MS || 60000;

const PURE_CODE_LAYOUT_ROTATION: LayoutMode[] = [
  'TIMELINE_CHRONO',
  'QUOTE_SLIDE',
  'STAT_CARD',
  'BULLET_HIGHLIGHT',
  'VERSUS_CARD',
  'POEM_RECITING',
  'CHAPTER_CARD',
];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutFallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(resolve, timeoutMs, timeoutFallback)),
  ]);
}

export async function vlmInspectionNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'vlm_inspection');
  const vlmBatchSize = getAdaptiveConcurrency('VLM');
  nodeLog.info('orchestrator.vlm_inspection_started', `Inspecting visual assets for ${state.scenes.length} scenes (batchSize=${vlmBatchSize})`, {
    projectId: state.projectId,
    batchSize: vlmBatchSize,
  });

  const updatedScenes: SceneGeneration[] = [];

  for (let i = 0; i < state.scenes.length; i += vlmBatchSize) {
    const batch = state.scenes.slice(i, i + vlmBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (scene, batchIdx) => {
        const sceneIdx = typeof scene.sceneIndex === 'number' ? scene.sceneIndex : (i + batchIdx);
        const safeFallbackLayout: LayoutMode = (!scene.layoutMode || isPureImageLayout(scene.layoutMode))
          ? PURE_CODE_LAYOUT_ROTATION[sceneIdx % PURE_CODE_LAYOUT_ROTATION.length]
          : (scene.layoutMode as LayoutMode);

        const fallbackScene: SceneGeneration = {
          ...scene,
          layoutMode: safeFallbackLayout,
          contentType: 'PURE_CODE',
          usePureCodeFallback: true,
          selectedAsset: undefined,
        };

        try {
          const inspectionTask = (async (): Promise<SceneGeneration> => {
            // Use researchResults produced by the Research Agent (Micro-Step 1C) when available
            const candidatePool: VisualCandidate[] = state.researchResults?.[scene.sceneId]?.candidates || scene.candidates || [];
            const result = await inspectSceneVisuals(state.projectId, scene, candidatePool, {
              customBaseDir: state.customBaseDir,
            });
            return result.updatedScene;
          })();

          return await withTimeout(inspectionTask, VLM_SCENE_TIMEOUT_MS, fallbackScene);
        } catch (err: any) {
          nodeLog.warn('orchestrator.vlm_inspection_error_fallback', `VLM inspection error for scene ${scene.sceneId}: ${err.message}. Falling back to PURE_CODE.`, {
            sceneId: scene.sceneId,
            error: err,
          });
          return fallbackScene;
        }
      })
    );
    updatedScenes.push(...batchResults);
  }

  return {
    status: 'ASSETS_AUDITED',
    currentStep: 10,
    scenes: updatedScenes,
  };
}
