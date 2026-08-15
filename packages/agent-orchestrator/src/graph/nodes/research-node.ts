/**
 * Micro-Step 1C: Research Agent Node (Online Image Search)
 * For each IMAGE scene, resolves visual candidates from the configured provider
 * chain (SerpAPI / Tavily / Brave / Wikimedia / curated catalog) and stores the
 * candidate pool + provenance into `researchResults` for the VLM inspector.
 */

import { createLogger, VisualCandidate } from '@chronoviet/shared-spec';
import { resolveImageCandidates } from '@chronoviet/vlm-inspector';
import { ChronoGraphState, ResearchSceneResult } from '../state.js';

const log = createLogger({ service: 'agent-orchestrator' });

const RESEARCH_CANDIDATE_LIMIT = 3;

export async function researchNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  log.info('orchestrator.research_started', `Researching visual candidates for ${state.scenes.length} scenes`, {
    projectId: state.projectId,
  });

  const researchResults: Record<string, ResearchSceneResult> = {};

  for (const scene of state.scenes) {
    // Only IMAGE scenes need visual research; PURE_CODE scenes are skipped
    if (scene.contentType !== 'IMAGE') {
      log.debug('orchestrator.research_skip_pure_code', `Skipping research for PURE_CODE scene ${scene.sceneId}`);
      continue;
    }

    // Reuse already-researched results (idempotency / resume support)
    const existing = state.researchResults?.[scene.sceneId];
    if (existing && existing.candidates.length > 0) {
      researchResults[scene.sceneId] = existing;
      continue;
    }

    const keywords = scene.searchKeywords.length > 0 ? scene.searchKeywords.join(' ') : state.userPrompt;
    const startedAt = Date.now();

    try {
      const { candidates, provenance } = await resolveImageCandidates(keywords, scene.sceneId, RESEARCH_CANDIDATE_LIMIT);
      researchResults[scene.sceneId] = {
        sceneId: scene.sceneId,
        keywords,
        candidates: candidates as VisualCandidate[],
        provenance,
        resolvedAt: new Date().toISOString(),
      };
      log.info('orchestrator.research_scene_done', `Researched ${candidates.length} candidates for scene ${scene.sceneId}`, {
        sceneId: scene.sceneId,
        keywords,
        latencyMs: Date.now() - startedAt,
      });
    } catch (err: any) {
      log.warn('orchestrator.research_scene_failed', `Research failed for scene ${scene.sceneId}: ${err.message}`, {
        sceneId: scene.sceneId,
        error: err.message,
      });
      researchResults[scene.sceneId] = {
        sceneId: scene.sceneId,
        keywords,
        candidates: [],
        provenance: [],
        resolvedAt: new Date().toISOString(),
      };
    }
  }

  return {
    status: 'RESEARCH_COMPLETED',
    currentStep: 7,
    researchResults,
  };
}