/**
 * VLM Inspector Sub-Agent Pipeline
 * 3+3 Candidate Inspection, License Whitelisting, Dual Scorer, and PURE_CODE Layout Rotation
 */

import {
  LayoutMode,
  LicenseTypeSchema,
  SceneGeneration,
  VisualCandidate,
} from '@chronoviet/shared-spec';
import { createLogger } from '@chronoviet/infra';
import { z } from 'zod';
import { downloadCandidateBatch } from './asset-downloader.js';
import { scoreImageWithGemini } from './vlm-scorer.js';
import { readImageDimensions, VisualQualityGate } from './visual-quality-gate.js';

export type LicenseType = z.infer<typeof LicenseTypeSchema>;

export function isWhitelistedLicense(licenseString: string): boolean {
  if (!licenseString) return false;
  const normalized = licenseString.toUpperCase().replace(/[\s-]+/g, '_');

  if (
    normalized.includes('NC') ||
    normalized.includes('NON_COMMERCIAL') ||
    normalized.includes('ND') ||
    normalized.includes('NO_DERIVS') ||
    normalized.includes('ALL_RIGHTS_RESERVED') ||
    normalized.includes('COPYRIGHT_STRICT') ||
    normalized === 'UNKNOWN'
  ) {
    return false;
  }

  return (
    normalized.includes('PUBLIC_DOMAIN') ||
    normalized.includes('CC0') ||
    normalized.includes('ZERO') ||
    normalized.includes('PD') ||
    normalized.includes('CC_BY_SA') ||
    normalized.includes('CC_BY')
  );
}

const log = createLogger({ service: 'vlm-inspector' });

const PURE_CODE_LAYOUT_ROTATION: LayoutMode[] = [
  'TIMELINE_CHRONO',
  'QUOTE_SLIDE',
  'STAT_CARD',
  'VERSUS_CARD',
  'POEM_RECITING',
  'CHAPTER_CARD',
];

export interface InspectSceneOptions {
  customBaseDir?: string;
  correlationId?: string;
}

export interface InspectSceneResult {
  updatedScene: SceneGeneration;
  inspectedCandidates: VisualCandidate[];
  selectedCandidate?: VisualCandidate;
  isPureCodeFallback: boolean;
  selectedLayoutMode: LayoutMode;
}

async function evaluateCandidateBatch(
  candidates: VisualCandidate[],
  voiceoverText: string,
  batchNumber: 1 | 2,
  qualityGate: VisualQualityGate,
  context: { correlationId?: string; sceneId?: string; projectId?: string; targetAspectRatio?: string } = {}
): Promise<VisualCandidate[]> {
  const evaluated: VisualCandidate[] = [];

  for (const cand of candidates) {
    // 1. License Whitelist Filter (Layer 0)
    const licenseAudit = qualityGate.auditLicense(cand.license);
    if (!isWhitelistedLicense(cand.license) || !licenseAudit.compliant) {
      evaluated.push({
        ...cand,
        candidateBatch: batchNumber,
        verdict: 'REJECT',
        score: {
          historicalContextScore: 0,
          visualNoiseScore: 0,
          artisticFitScore: 0,
          overallScore: 0,
        },
      });
      continue;
    }

    // 2. Download / Local path presence check (Layer 1)
    if (!cand.localPath && (cand.imageUrl.startsWith('http://') || cand.imageUrl.startsWith('https://'))) {
      evaluated.push({
        ...cand,
        candidateBatch: batchNumber,
        verdict: 'REJECT',
        score: {
          historicalContextScore: 0,
          visualNoiseScore: 0,
          artisticFitScore: 0,
          overallScore: 0,
        },
      });
      continue;
    }

    // 3. Technical Visual Quality Gate (Resolution & Aspect Ratio Check) (Layer 2)
    if (cand.localPath) {
      const dimensions = readImageDimensions(cand.localPath);
      if (dimensions) {
        const qualityResult = qualityGate.evaluateQuality(
          dimensions.width,
          dimensions.height,
          context.targetAspectRatio || '16:9'
        );
        if (!qualityResult.passed) {
          log.debug('vlm.quality_gate_rejected', `Candidate ${cand.candidateId} rejected by quality gate: ${qualityResult.rejectionReason}`, {
            candidateId: cand.candidateId,
            dimensions,
            rejectionReason: qualityResult.rejectionReason,
            correlationId: context.correlationId,
            sceneId: context.sceneId,
          });
          evaluated.push({
            ...cand,
            candidateBatch: batchNumber,
            verdict: 'REJECT',
            score: {
              historicalContextScore: 0,
              visualNoiseScore: 0,
              artisticFitScore: 0,
              overallScore: 0,
            },
          });
          continue;
        }
      }
    }

    // 4. VLM Semantic & Noise Scoring (Layer 3)
    const scoreResult = await scoreImageWithGemini(
      cand.localPath || cand.imageUrl,
      voiceoverText,
      {
        sha256: cand.sha256,
        pHash: cand.pHash,
        metadata: { title: cand.title, author: cand.author, license: cand.license },
        correlationId: context.correlationId,
        sceneId: context.sceneId,
      }
    );

    evaluated.push({
      ...cand,
      candidateBatch: batchNumber,
      score: {
        historicalContextScore: scoreResult.historicalContextScore,
        visualNoiseScore: scoreResult.visualNoiseScore,
        artisticFitScore: scoreResult.artisticFitScore,
        overallScore: scoreResult.totalScore,
      },
      verdict: scoreResult.passed ? 'PASS' : 'REJECT',
    });
  }

  return evaluated;
}

/**
 * Executes the complete 3+3 candidate inspection workflow for a scene.
 */
export async function inspectSceneVisuals(
  projectId: string,
  scene: SceneGeneration,
  candidatePool: VisualCandidate[],
  options: InspectSceneOptions = {}
): Promise<InspectSceneResult> {
  log.debug('vlm.inspecting_scene', `Inspecting visuals for scene ${scene.sceneId} (${scene.layoutMode})`, {
    sceneId: scene.sceneId,
    candidateCount: candidatePool?.length ?? 0,
    correlationId: options.correlationId,
  });

  if (!candidatePool || candidatePool.length === 0) {
    const rotationIndex = (scene.sceneIndex || 0) % PURE_CODE_LAYOUT_ROTATION.length;
    const finalLayoutMode = PURE_CODE_LAYOUT_ROTATION[rotationIndex];
    log.debug('vlm.empty_candidate_pool', `Empty candidate pool for scene ${scene.sceneId}; immediate PURE_CODE fallback: ${finalLayoutMode}`, {
      sceneId: scene.sceneId,
      finalLayoutMode,
    });
    const updatedScene: SceneGeneration = {
      ...scene,
      candidates: [],
      selectedAsset: undefined,
      layoutMode: finalLayoutMode,
      contentType: 'PURE_CODE',
      usePureCodeFallback: true,
    };
    return {
      updatedScene,
      inspectedCandidates: [],
      selectedCandidate: undefined,
      isPureCodeFallback: true,
      selectedLayoutMode: finalLayoutMode,
    };
  }

  const qualityGate = new VisualQualityGate();
  const batch1 = candidatePool.slice(0, 3);
  const batch2 = candidatePool.slice(3, 6);

  const downloadOpts = {
    customBaseDir: options.customBaseDir,
    correlationId: options.correlationId,
    sceneId: scene.sceneId,
  };

  const evalContext = {
    correlationId: options.correlationId,
    sceneId: scene.sceneId,
    projectId,
    targetAspectRatio: (scene as any).aspectRatio,
  };

  // 1. Process Batch 1 (Parallel Download + Evaluation)
  const downloadedBatch1 = await downloadCandidateBatch(projectId, batch1, downloadOpts);
  const evaluatedBatch1 = await evaluateCandidateBatch(
    downloadedBatch1,
    scene.voiceoverText,
    1,
    qualityGate,
    evalContext
  );

  // Sort Batch 1 by score descending
  evaluatedBatch1.sort((a, b) => (b.score?.overallScore || 0) - (a.score?.overallScore || 0));
  let topCandidate = evaluatedBatch1[0];

  const allEvaluated: VisualCandidate[] = [...evaluatedBatch1];

  // 2. If Batch 1 top score < 60 and Batch 2 exists, process Batch 2
  if ((!topCandidate || (topCandidate.score?.overallScore || 0) < 60) && batch2.length > 0) {
    log.debug('vlm.batch_2_triggered', `Batch 1 top score below 60; triggering 3 supplementary candidates (Batch 2)`, {
      sceneId: scene.sceneId,
      correlationId: options.correlationId,
    });

    const downloadedBatch2 = await downloadCandidateBatch(projectId, batch2, downloadOpts);
    const evaluatedBatch2 = await evaluateCandidateBatch(
      downloadedBatch2,
      scene.voiceoverText,
      2,
      qualityGate,
      evalContext
    );

    allEvaluated.push(...evaluatedBatch2);
    allEvaluated.sort((a, b) => (b.score?.overallScore || 0) - (a.score?.overallScore || 0));
    topCandidate = allEvaluated[0];
  }

  // 3. Check if we have an acceptable candidate
  const isPureCodeFallback = !topCandidate || (topCandidate.score?.overallScore || 0) < 60;

  let finalLayoutMode = scene.layoutMode;
  if (isPureCodeFallback) {
    const rotationIndex = scene.sceneIndex % PURE_CODE_LAYOUT_ROTATION.length;
    finalLayoutMode = PURE_CODE_LAYOUT_ROTATION[rotationIndex];
    log.warn('vlm.pure_code_fallback', `All candidates failed (<60); falling back to PURE_CODE Layout: ${finalLayoutMode}`, {
      sceneId: scene.sceneId,
      finalLayoutMode,
      correlationId: options.correlationId,
    });
  }

  const updatedScene: SceneGeneration = {
    ...scene,
    candidates: allEvaluated,
    selectedAsset: isPureCodeFallback ? undefined : topCandidate,
    layoutMode: finalLayoutMode,
    contentType: isPureCodeFallback ? 'PURE_CODE' : 'IMAGE',
    usePureCodeFallback: isPureCodeFallback,
  };

  return {
    updatedScene,
    inspectedCandidates: allEvaluated,
    selectedCandidate: isPureCodeFallback ? undefined : topCandidate,
    isPureCodeFallback,
    selectedLayoutMode: finalLayoutMode,
  };
}
