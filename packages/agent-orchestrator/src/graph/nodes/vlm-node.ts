/**
 * Parallel Worker B: Asset Crawler & VLM Inspector Node
 * Reads the candidate pool produced by the Research Agent (researchResults) and
 * evaluates 3+3 candidates, falling back to PURE_CODE layout when no image passes.
 */

import { envConfig, SceneGeneration, VisualCandidate } from '@chronoviet/shared-spec';
import { inspectSceneVisuals, resolveImageCandidates } from '@chronoviet/vlm-inspector';
import { ChronoGraphState, getNodeLogger } from '../state.js';

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
