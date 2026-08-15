/**
 * Parallel Worker B: Asset Crawler & VLM Inspector Node
 * Reads the candidate pool produced by the Research Agent (researchResults) and
 * evaluates 3+3 candidates, falling back to PURE_CODE layout when no image passes.
 */

import { createLogger, SceneGeneration, VisualCandidate } from '@chronoviet/shared-spec';
import { inspectSceneVisuals, resolveImageCandidates } from '@chronoviet/vlm-inspector';
import { ChronoGraphState } from '../state.js';

const log = createLogger({ service: 'agent-orchestrator' });

export async function vlmInspectionNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  log.info('orchestrator.vlm_inspection_started', `Inspecting visual assets for ${state.scenes.length} scenes`, {
    projectId: state.projectId,
  });

  const updatedScenes: SceneGeneration[] = [];

  for (const scene of state.scenes) {
    // Use researchResults produced by the Research Agent (Micro-Step 1C) when available
    let candidatePool: VisualCandidate[] = state.researchResults?.[scene.sceneId]?.candidates || scene.candidates;

    // Fallback: if research produced nothing (e.g. resumed old checkpoint), resolve inline
    if (candidatePool.length === 0 && scene.contentType === 'IMAGE') {
      const kw = scene.searchKeywords.length > 0 ? scene.searchKeywords.join(' ') : state.userPrompt;
      const resolved = await resolveImageCandidates(kw, scene.sceneId, 3);
      candidatePool = resolved.candidates;
    }

    const result = await inspectSceneVisuals(state.projectId, scene, candidatePool);
    updatedScenes.push(result.updatedScene);
  }

  return {
    status: 'ASSETS_AUDITED',
    currentStep: 10,
    scenes: updatedScenes,
  };
}
