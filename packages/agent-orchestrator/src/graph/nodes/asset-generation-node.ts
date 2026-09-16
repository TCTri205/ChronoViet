/**
 * Parallel Fan-Out / Fan-In Node: Asset Generation Fork-Join Node
 * Executes Audio Asset Generation (TTS Synthesis) and Visual Asset Generation
 * (Keyword Extraction -> Online Research -> VLM Inspection) concurrently via Promise.all.
 */

import { SceneGeneration, VisualCandidate } from '@chronoviet/shared-spec';
import {
  createLogger,
  envConfig,
  getAdaptiveConcurrency,
  orchestratorAssetGenerationDurationSeconds,
} from '@chronoviet/infra';
import {
  ChronoGraphState,
  ChronoGraphUpdate,
  getNodeLogger,
  ResearchSceneResult,
  TelemetryAuditEntry,
} from '../state.js';
import { ttsSynthesisNode } from './tts-node.js';
import { keywordNode } from './keyword-node.js';
import { researchNode } from './research-node.js';
import { vlmInspectionNode } from './vlm-node.js';

const log = createLogger({ service: 'agent-orchestrator' });

export async function assetGenerationForkJoinNode(
  state: ChronoGraphState
): Promise<ChronoGraphUpdate> {
  const nodeLog = getNodeLogger(state, 'asset_generation');
  const startTime = performance.now();

  nodeLog.info(
    'orchestrator.fork_join_started',
    `Starting Fork-Join asset generation for ${state.scenes.length} scenes (Audio || Visual)`,
    { projectId: state.projectId, sceneCount: state.scenes.length }
  );

  // 1. Audio Branch: VieNeu TTS Synthesis
  const audioBranchPromise = (async () => {
    const branchStart = performance.now();
    try {
      const ttsResult = await ttsSynthesisNode(state);
      const latencyMs = Math.round(performance.now() - branchStart);
      nodeLog.info(
        'orchestrator.audio_branch_completed',
        `Audio TTS branch completed in ${latencyMs}ms`,
        { projectId: state.projectId, latencyMs, audioCount: ttsResult.audioAssets?.length || 0 }
      );
      return ttsResult;
    } catch (err: any) {
      nodeLog.error(
        'orchestrator.audio_branch_failed',
        `Audio TTS branch failed: ${err.message}`,
        { projectId: state.projectId, error: err }
      );
      throw err;
    }
  })();

  // 2. Visual Branch: Keyword Extraction -> Pipelined (Online Research -> VLM Inspection)
  const visualBranchPromise = (async () => {
    const branchStart = performance.now();
    try {
      // Step A: Global 1-Pass Keyword Planning & Extraction
      const keywordResult = await keywordNode(state);
      const scenesWithKeywords = keywordResult.scenes || state.scenes;
      const stateAfterKeywords: ChronoGraphState = {
        ...state,
        ...keywordResult,
        scenes: scenesWithKeywords,
      };

      // Step B: Pipelined Research & VLM Inspection (Streaming scenes without barrier block)
      const candidateLimit = envConfig.RESEARCH_CANDIDATES_PER_SCENE || 3;
      const vlmBatchSize = getAdaptiveConcurrency('VLM');
      const aggregatedResearchResults: Record<string, ResearchSceneResult> = { ...(state.researchResults || {}) };
      const inspectedScenes: SceneGeneration[] = [];

      const { resolveImageCandidates } = await import('../../research/index.js');
      const { inspectSceneVisuals } = await import('@chronoviet/vlm-inspector');

      for (let i = 0; i < scenesWithKeywords.length; i += vlmBatchSize) {
        const batch = scenesWithKeywords.slice(i, i + vlmBatchSize);
        const batchResults = await Promise.all(
          batch.map(async (scene) => {
            if (scene.contentType !== 'IMAGE') {
              return scene;
            }

            // 1. Check or resolve candidates for this scene
            let sceneResearch = aggregatedResearchResults[scene.sceneId];
            if (!sceneResearch || sceneResearch.candidates.length === 0) {
              const sceneLimit = scene.searchParams?.limit || candidateLimit;
              const searchInput = scene.searchParams
                ? {
                    sceneId: scene.sceneId,
                    primaryQuery: scene.searchParams.primaryQuery,
                    englishQuery: scene.searchParams.englishQuery,
                    frenchQuery: scene.searchParams.frenchQuery,
                    negativeQuery: scene.searchParams.negativeQuery,
                    facetQueries: scene.searchParams.facetQueries,
                    visualType: (scene.searchParams.visualType as any) || 'GENERAL_HISTORICAL',
                    historicalPeriod: scene.searchParams.historicalPeriod,
                    minResolution: 'HD' as const,
                    limit: sceneLimit,
                  }
                : {
                    sceneId: scene.sceneId,
                    primaryQuery: scene.searchKeywords.length > 0 ? scene.searchKeywords.join(' ') : state.userPrompt,
                    minResolution: 'HD' as const,
                    limit: sceneLimit,
                  };

              const keywords = scene.searchParams?.primaryQuery || (scene.searchKeywords.length > 0 ? scene.searchKeywords.join(' ') : state.userPrompt);
              try {
                const { candidates, provenance } = await resolveImageCandidates(searchInput as any, scene.sceneId, sceneLimit);
                sceneResearch = {
                  sceneId: scene.sceneId,
                  keywords,
                  candidates: candidates as VisualCandidate[],
                  provenance,
                  resolvedAt: new Date().toISOString(),
                };
              } catch (resErr: any) {
                sceneResearch = {
                  sceneId: scene.sceneId,
                  keywords,
                  candidates: [],
                  provenance: [],
                  resolvedAt: new Date().toISOString(),
                };
              }
              aggregatedResearchResults[scene.sceneId] = sceneResearch;
            }

            // 2. Immediately inspect candidates with VLM for this scene without waiting for other scenes
            try {
              const inspectRes = await inspectSceneVisuals(state.projectId, scene, sceneResearch.candidates, {
                customBaseDir: state.customBaseDir,
              });
              return inspectRes.updatedScene;
            } catch (vlmErr: any) {
              nodeLog.warn('orchestrator.vlm_scene_fallback', `VLM inspection fallback for scene ${scene.sceneId}: ${vlmErr.message}`);
              return {
                ...scene,
                contentType: 'PURE_CODE' as const,
                usePureCodeFallback: true,
                selectedAsset: undefined,
              };
            }
          })
        );
        inspectedScenes.push(...batchResults);
      }

      const latencyMs = Math.round(performance.now() - branchStart);
      nodeLog.info(
        'orchestrator.visual_branch_completed',
        `Visual Asset branch completed in ${latencyMs}ms`,
        { projectId: state.projectId, latencyMs, scenesAudited: inspectedScenes.length }
      );
      return {
        keywordResult,
        researchResult: { researchResults: aggregatedResearchResults },
        vlmResult: { scenes: inspectedScenes },
      };
    } catch (err: any) {
      nodeLog.warn(
        'orchestrator.visual_branch_fallback',
        `Visual branch error: ${err.message}. Generating PURE_CODE fallback scenes.`,
        { projectId: state.projectId, error: err }
      );
      // Fallback: convert all scenes to PURE_CODE
      const fallbackScenes: SceneGeneration[] = state.scenes.map((scene) => ({
        ...scene,
        layoutMode: scene.layoutMode || 'STAT_CARD',
        contentType: 'PURE_CODE',
        usePureCodeFallback: true,
        selectedAsset: undefined,
      }));
      return {
        keywordResult: {},
        researchResult: { researchResults: {} },
        vlmResult: { scenes: fallbackScenes },
      };
    }
  })();

  // 3. Concurrent Fan-Out Execution
  const [audioResult, visualBranchData] = await Promise.all([
    audioBranchPromise,
    visualBranchPromise,
  ]);

  const durationSec = (performance.now() - startTime) / 1000;
  if (orchestratorAssetGenerationDurationSeconds) {
    try {
      orchestratorAssetGenerationDurationSeconds.observe(
        { status: 'success' },
        durationSec
      );
    } catch {}
  }

  // 4. Fan-In / Join: Merge Audio & Visual Assets into Unified Scenes
  const audioSceneMap = new Map<string, SceneGeneration>();
  if (audioResult.scenes) {
    for (const sc of audioResult.scenes) {
      audioSceneMap.set(sc.sceneId, sc);
    }
  }

  const visualSceneMap = new Map<string, SceneGeneration>();
  if (visualBranchData.vlmResult.scenes) {
    for (const sc of visualBranchData.vlmResult.scenes) {
      visualSceneMap.set(sc.sceneId, sc);
    }
  }

  const mergedScenes: SceneGeneration[] = state.scenes.map((baseScene) => {
    const audioSc = audioSceneMap.get(baseScene.sceneId);
    const visualSc = visualSceneMap.get(baseScene.sceneId);

    return {
      ...baseScene,
      // Apply Visual enhancements
      ...(visualSc || {}),
      // Apply Audio enhancements (preserving audio paths and timestamps)
      audioPath: audioSc?.audioPath || baseScene.audioPath,
      audioDurationSeconds: audioSc?.audioDurationSeconds || baseScene.audioDurationSeconds,
      wordTimestamps: audioSc?.wordTimestamps || baseScene.wordTimestamps || [],
    };
  });

  const combinedTelemetry: TelemetryAuditEntry[] = [
    ...(state.telemetryAudit || []),
    ...(audioResult.telemetryAudit || []),
  ];

  nodeLog.info(
    'orchestrator.fork_join_completed',
    `Fork-Join asset generation completed in ${Math.round(durationSec * 1000)}ms for ${mergedScenes.length} scenes`,
    {
      projectId: state.projectId,
      totalDurationMs: Math.round(durationSec * 1000),
      totalAudioAssets: audioResult.audioAssets?.length || 0,
      totalScenes: mergedScenes.length,
    }
  );

  return {
    status: 'ASSETS_AUDITED',
    currentStep: 8,
    scenes: mergedScenes,
    audioAssets: audioResult.audioAssets || [],
    researchResults: visualBranchData.researchResult.researchResults || {},
    telemetryAudit: combinedTelemetry,
  };
}
