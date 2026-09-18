/**
 * Parallel Fan-Out / Fan-In Node: Asset Generation Fork-Join Node
 * Executes Audio Asset Generation (TTS Synthesis) and Visual Asset Generation
 * (Keyword Extraction -> Online Research -> VLM Inspection) concurrently via Promise.all.
 */

import { SceneGeneration, VisualCandidate, LayoutMode } from '@chronoviet/shared-spec';
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
      const { inspectSceneVisuals, inferSemanticPureCodeLayout } = await import('@chronoviet/vlm-inspector');
      const { matchCuratedCatalog } = await import('../../research/providers/curated-catalog.js');
      const sharedUsedAssetHashes = new Set<string>();
      const usedAssetHistory: Array<{ sceneIndex: number; candidate: VisualCandidate; layoutMode: LayoutMode }> = [];
      const alternateLayouts: LayoutMode[] = ['HISTORICAL_FRAME', 'FULL_COVER', 'CENTER_SCALE', 'BLUR_BG'];

      // Step B1: Pre-resolve candidates concurrently in batches
      for (let i = 0; i < scenesWithKeywords.length; i += vlmBatchSize) {
        const batch = scenesWithKeywords.slice(i, i + vlmBatchSize);
        await Promise.all(
          batch.map(async (scene) => {
            if (scene.contentType !== 'IMAGE') {
              return;
            }

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
          })
        );
      }

      // Step B2: Sequentially inspect candidates per scene to guarantee strict cross-scene deduplication
      for (let sIdx = 0; sIdx < scenesWithKeywords.length; sIdx++) {
        const scene = scenesWithKeywords[sIdx];
        if (scene.contentType !== 'IMAGE') {
          inspectedScenes.push(scene);
          continue;
        }

        const sceneResearch = aggregatedResearchResults[scene.sceneId] || { candidates: [] };

        try {
          let inspectRes = await inspectSceneVisuals(state.projectId, scene, sceneResearch.candidates, {
            customBaseDir: state.customBaseDir,
            usedAssetHashes: sharedUsedAssetHashes,
            preferSemanticLayout: true,
          });

          // Tier 2 Fallback: If primary search candidates all fail or are exhausted,
          // query curated catalog for epoch-aligned historical assets before conceding to PURE_CODE
          if (inspectRes.isPureCodeFallback) {
            try {
              const fallbackKeywords = `${scene.searchParams?.historicalPeriod || ''} ${state.userPrompt}`;
              const catalogCandidates = matchCuratedCatalog(fallbackKeywords, candidateLimit);
              const freshCatalogCandidates = catalogCandidates.filter(
                (c) => !sharedUsedAssetHashes.has(c.imageUrl) && !(c.sha256 && sharedUsedAssetHashes.has(c.sha256))
              );
              if (freshCatalogCandidates.length > 0) {
                const catalogRes = await inspectSceneVisuals(state.projectId, scene, freshCatalogCandidates, {
                  customBaseDir: state.customBaseDir,
                  usedAssetHashes: sharedUsedAssetHashes,
                  preferSemanticLayout: true,
                });
                if (!catalogRes.isPureCodeFallback && catalogRes.selectedCandidate) {
                  inspectRes = catalogRes;
                }
              }
            } catch (catErr: any) {
              nodeLog.debug('orchestrator.catalog_fallback_skip', `Catalog fallback skipped for scene ${scene.sceneId}: ${catErr.message}`);
            }
          }

          // Tier 3: Smart Asset Repurposing with separation distance >= 2 scenes
          if (inspectRes.isPureCodeFallback && usedAssetHistory.length > 0) {
            const eligiblePastAssets = usedAssetHistory.filter((item) => sIdx - item.sceneIndex >= 2);
            if (eligiblePastAssets.length > 0) {
              const chosen = eligiblePastAssets[0];
              const variedLayout = alternateLayouts[sIdx % alternateLayouts.length];
              inspectRes = {
                updatedScene: {
                  ...scene,
                  selectedAsset: chosen.candidate,
                  layoutMode: variedLayout,
                  contentType: 'IMAGE',
                  usePureCodeFallback: false,
                },
                inspectedCandidates: [chosen.candidate],
                selectedCandidate: chosen.candidate,
                isPureCodeFallback: false,
                selectedLayoutMode: variedLayout,
              };
              nodeLog.debug('orchestrator.asset_repurposed', `Repurposed asset for scene ${scene.sceneId} with layout ${variedLayout}`);
            }
          }

          // Register selected candidate into shared used hashes & history
          if (inspectRes.selectedCandidate) {
            if (inspectRes.selectedCandidate.sha256) sharedUsedAssetHashes.add(inspectRes.selectedCandidate.sha256);
            if (inspectRes.selectedCandidate.imageUrl) sharedUsedAssetHashes.add(inspectRes.selectedCandidate.imageUrl);
            if (inspectRes.selectedCandidate.localPath) sharedUsedAssetHashes.add(inspectRes.selectedCandidate.localPath);
            usedAssetHistory.push({
              sceneIndex: sIdx,
              candidate: inspectRes.selectedCandidate,
              layoutMode: inspectRes.selectedLayoutMode || 'HISTORICAL_FRAME',
            });
          }

          inspectedScenes.push(inspectRes.updatedScene);
        } catch (vlmErr: any) {
          nodeLog.warn('orchestrator.vlm_scene_fallback', `VLM inspection fallback for scene ${scene.sceneId}: ${vlmErr.message}`);
          const fallbackLayout = inferSemanticPureCodeLayout(scene.voiceoverText, scene.sceneIndex ?? 0);
          inspectedScenes.push({
            ...scene,
            layoutMode: fallbackLayout,
            contentType: 'PURE_CODE' as const,
            usePureCodeFallback: true,
            selectedAsset: undefined,
          });
        }
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
