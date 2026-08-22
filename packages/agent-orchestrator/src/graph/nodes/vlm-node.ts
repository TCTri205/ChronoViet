/**
 * Parallel Worker B: Asset Crawler & VLM Inspector Node
 * Reads the candidate pool produced by the Research Agent (researchResults) and
 * evaluates 3+3 candidates, falling back to PURE_CODE layout when no image passes.
 */

import { envConfig, SceneGeneration, VisualCandidate } from '@chronoviet/shared-spec';
import { inspectSceneVisuals, resolveImageCandidates } from '@chronoviet/vlm-inspector';
import { ChronoGraphState, getNodeLogger } from '../state.js';

const VLM_SCENE_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutFallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(timeoutFallback), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export async function vlmInspectionNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'vlm_inspection');
  nodeLog.info('orchestrator.vlm_inspection_started', `Inspecting visual assets for ${state.scenes.length} scenes`, {
    projectId: state.projectId,
  });

  const updatedScenes: SceneGeneration[] = [];
  const vlmBatchSize = envConfig.VLM_PROVIDER === 'local' ? 2 : 4;

  for (let i = 0; i < state.scenes.length; i += vlmBatchSize) {
    const batch = state.scenes.slice(i, i + vlmBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (scene) => {
        const fallbackScene: SceneGeneration = {
          ...scene,
          layoutMode: scene.layoutMode || 'STAT_CARD',
          contentType: 'PURE_CODE',
          usePureCodeFallback: true,
          selectedAsset: undefined,
        };

        try {
          const inspectionTask = (async (): Promise<SceneGeneration> => {
            // Use researchResults produced by the Research Agent (Micro-Step 1C) when available
            let candidatePool: VisualCandidate[] = state.researchResults?.[scene.sceneId]?.candidates || scene.candidates;

            // Fallback: if research produced nothing (e.g. resumed old checkpoint), resolve inline
            if (candidatePool.length === 0 && scene.contentType === 'IMAGE') {
              const kw = scene.searchKeywords.length > 0 ? scene.searchKeywords.join(' ') : state.userPrompt;
              const resolved = await resolveImageCandidates(kw, scene.sceneId, 3);
              candidatePool = resolved.candidates;
            }

            const result = await inspectSceneVisuals(state.projectId, scene, candidatePool);
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
