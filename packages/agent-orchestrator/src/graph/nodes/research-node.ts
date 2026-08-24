/**
 * Micro-Step 1C: Research Agent Node (Online Image Search)
 * For each IMAGE scene, resolves visual candidates from the configured provider
 * chain (SerpAPI / Tavily / Brave / Wikimedia / curated catalog) and stores the
 * candidate pool + provenance into `researchResults` for the VLM inspector.
 */

import { VisualCandidate } from '@chronoviet/shared-spec';
import { resolveImageCandidates } from '../../research/index.js';
import { ChronoGraphState, getNodeLogger, ResearchSceneResult } from '../state.js';

const RESEARCH_CANDIDATE_LIMIT = 3;

export async function researchNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'research');
  nodeLog.info('orchestrator.research_started', `Researching visual candidates for ${state.scenes.length} scenes`, {
    projectId: state.projectId,
  });

  const researchResults: Record<string, ResearchSceneResult> = { ...(state.researchResults || {}) };

  const batchSize = 4;
  for (let i = 0; i < state.scenes.length; i += batchSize) {
    const batch = state.scenes.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (scene) => {
        // Only IMAGE scenes need visual research; PURE_CODE scenes are skipped
        if (scene.contentType !== 'IMAGE') {
          nodeLog.debug('orchestrator.research_skip_pure_code', `Skipping research for PURE_CODE scene ${scene.sceneId}`);
          return;
        }

        // Reuse already-researched results (idempotency / resume support)
        const existing = state.researchResults?.[scene.sceneId];
        if (existing && existing.candidates.length > 0) {
          researchResults[scene.sceneId] = existing;
          return;
        }

        const searchInput = scene.searchParams
          ? {
              sceneId: scene.sceneId,
              primaryQuery: scene.searchParams.primaryQuery,
              englishQuery: scene.searchParams.englishQuery,
              visualType: (scene.searchParams.visualType as any) || 'GENERAL_HISTORICAL',
              historicalPeriod: scene.searchParams.historicalPeriod,
              minResolution: 'HD' as const,
              limit: RESEARCH_CANDIDATE_LIMIT,
            }
          : {
              sceneId: scene.sceneId,
              primaryQuery: scene.searchKeywords.length > 0 ? scene.searchKeywords.join(' ') : state.userPrompt,
              minResolution: 'HD' as const,
              limit: RESEARCH_CANDIDATE_LIMIT,
            };

        const keywords = scene.searchParams?.primaryQuery || (scene.searchKeywords.length > 0 ? scene.searchKeywords.join(' ') : state.userPrompt);
        const startedAt = Date.now();

        try {
          const { candidates, provenance } = await resolveImageCandidates(searchInput as any, scene.sceneId, RESEARCH_CANDIDATE_LIMIT);
          researchResults[scene.sceneId] = {
            sceneId: scene.sceneId,
            keywords,
            candidates: candidates as VisualCandidate[],
            provenance,
            resolvedAt: new Date().toISOString(),
          };
          nodeLog.debug('orchestrator.research_scene_done', `Researched ${candidates.length} candidates for scene ${scene.sceneId}`, {
            sceneId: scene.sceneId,
            keywords,
            latencyMs: Date.now() - startedAt,
          });
        } catch (err: any) {
          nodeLog.warn('orchestrator.research_scene_failed', `Research failed for scene ${scene.sceneId}: ${err.message}`, {
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
      })
    );
  }

  return {
    status: 'RESEARCH_COMPLETED',
    currentStep: 7,
    researchResults,
  };
}