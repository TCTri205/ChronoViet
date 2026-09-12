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
import { createLogger, envConfig } from '@chronoviet/infra';
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

export function getProvenanceRank(c: VisualCandidate): number {
  const provider = (c as any).provider || '';
  const meta = `${c.imageUrl} ${c.sourceUrl || ''} ${c.candidateId || ''}`.toLowerCase();
  if (provider === 'catalog' || meta.includes('catalog')) return 1;
  if (provider === 'wikimedia' || meta.includes('wikimedia')) return 2;
  return 3;
}

async function evaluateSingleCandidate(
  cand: VisualCandidate,
  voiceoverText: string,
  batchNumber: 1 | 2,
  qualityGate: VisualQualityGate,
  context: { correlationId?: string; sceneId?: string; projectId?: string; targetAspectRatio?: string } = {}
): Promise<{ evaluated: VisualCandidate; passed: boolean }> {
  // 1. Technical Visual Quality Gate (Resolution & Aspect Ratio Check) (Layer 2)
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
        return {
          evaluated: {
            ...cand,
            candidateBatch: batchNumber,
            verdict: 'REJECT',
            score: {
              historicalContextScore: 0,
              visualNoiseScore: 0,
              artisticFitScore: 0,
              overallScore: 0,
            },
          },
          passed: false,
        };
      }
    }
  }

  // 2. VLM Semantic & Noise Scoring (Layer 3)
  try {
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

    const scoreThreshold = envConfig.VLM_SCORE_THRESHOLD ?? 60;
    const passed = scoreResult.passed && (scoreResult.totalScore >= scoreThreshold);

    return {
      evaluated: {
        ...cand,
        candidateBatch: batchNumber,
        focalPoint: scoreResult.focalPoint || cand.focalPoint || [0.5, 0.5],
        score: {
          historicalContextScore: scoreResult.historicalContextScore,
          visualNoiseScore: scoreResult.visualNoiseScore,
          artisticFitScore: scoreResult.artisticFitScore,
          overallScore: scoreResult.totalScore,
        },
        verdict: passed ? 'PASS' : 'REJECT',
      },
      passed,
    };
  } catch (err: any) {
    log.warn('vlm.scoring_error', `Error scoring candidate ${cand.candidateId}: ${err.message}`, {
      candidateId: cand.candidateId,
      error: err.message,
      correlationId: context.correlationId,
      sceneId: context.sceneId,
    });
    return {
      evaluated: {
        ...cand,
        candidateBatch: batchNumber,
        verdict: 'REJECT',
        score: {
          historicalContextScore: 0,
          visualNoiseScore: 0,
          artisticFitScore: 0,
          overallScore: 0,
        },
      },
      passed: false,
    };
  }
}

/**
 * Executes the lazy sequential candidate inspection workflow for a scene:
 * - Pre-filters candidate pool by license in metadata before download
 * - Sorts candidates by provenance (catalog > wikimedia > web search)
 * - Evaluates candidate #1; if it fails technical checks or score gate, evaluates candidate #2 before falling back to PURE_CODE
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

  const qualityGate = new VisualQualityGate();
  const getPureCodeLayout = () => {
    const rawIndex = scene.sceneIndex ?? 0;
    const rotationIndex = Math.abs(rawIndex) % PURE_CODE_LAYOUT_ROTATION.length;
    return PURE_CODE_LAYOUT_ROTATION[rotationIndex];
  };

  if (!candidatePool || candidatePool.length === 0) {
    const finalLayoutMode = getPureCodeLayout();
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

  // 1. License Pre-Filter (Layer 0): Pre-filter metadata before downloading
  const whitelistedCandidates: VisualCandidate[] = [];
  const rejectedByLicense: VisualCandidate[] = [];

  for (const cand of candidatePool) {
    const licenseAudit = qualityGate.auditLicense(cand.license);
    if (isWhitelistedLicense(cand.license) && licenseAudit.compliant) {
      whitelistedCandidates.push(cand);
    } else {
      rejectedByLicense.push({
        ...cand,
        candidateBatch: 1,
        verdict: 'REJECT',
        score: {
          historicalContextScore: 0,
          visualNoiseScore: 0,
          artisticFitScore: 0,
          overallScore: 0,
        },
      });
    }
  }

  if (whitelistedCandidates.length === 0) {
    const finalLayoutMode = getPureCodeLayout();
    log.warn('vlm.license_filter_all_failed', `All candidates failed license filter for scene ${scene.sceneId}; immediate PURE_CODE fallback: ${finalLayoutMode}`, {
      sceneId: scene.sceneId,
      finalLayoutMode,
      correlationId: options.correlationId,
    });
    const updatedScene: SceneGeneration = {
      ...scene,
      candidates: rejectedByLicense,
      selectedAsset: undefined,
      layoutMode: finalLayoutMode,
      contentType: 'PURE_CODE',
      usePureCodeFallback: true,
    };
    return {
      updatedScene,
      inspectedCandidates: rejectedByLicense,
      selectedCandidate: undefined,
      isPureCodeFallback: true,
      selectedLayoutMode: finalLayoutMode,
    };
  }

  // 2. Sort candidate pool by provenance: catalog > wikimedia > web search
  whitelistedCandidates.sort((a, b) => getProvenanceRank(a) - getProvenanceRank(b));

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

  // 3. Lazy Sequential VLM Curation (Evaluate candidate #1; if it fails technical checks or score gate, evaluate candidate #2 before falling back to PURE_CODE)
  const inspected: VisualCandidate[] = [...rejectedByLicense];
  let selectedCandidate: VisualCandidate | undefined = undefined;

  // We evaluate at most 2 candidates lazily
  const candidatesToTry = whitelistedCandidates.slice(0, 2);

  for (let idx = 0; idx < candidatesToTry.length; idx++) {
    const cand = candidatesToTry[idx];
    const batchNum = (idx === 0 ? 1 : 2) as 1 | 2;

    // Download active candidate only
    let downloadedCand = cand;
    if (!cand.localPath) {
      const [dl] = await downloadCandidateBatch(projectId, [cand], downloadOpts);
      downloadedCand = dl || cand;
    }

    // Check if download succeeded (if remote URL)
    if (!downloadedCand.localPath && (downloadedCand.imageUrl.startsWith('http://') || downloadedCand.imageUrl.startsWith('https://'))) {
      inspected.push({
        ...downloadedCand,
        candidateBatch: batchNum,
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

    // Evaluate single candidate (Technical Quality Gate + VLM Scoring)
    const { evaluated, passed } = await evaluateSingleCandidate(
      downloadedCand,
      scene.voiceoverText,
      batchNum,
      qualityGate,
      evalContext
    );

    inspected.push(evaluated);

    if (passed) {
      selectedCandidate = evaluated;
      log.debug('vlm.lazy_curation_passed', `Candidate ${evaluated.candidateId} passed with score ${evaluated.score?.overallScore}; stopping sequential evaluation`, {
        sceneId: scene.sceneId,
        candidateId: evaluated.candidateId,
        score: evaluated.score?.overallScore,
      });
      break; // Lazy stop! Candidate #1 succeeded, no need to download or evaluate candidate #2.
    }
  }

  // Check if any candidate was successfully selected
  const isPureCodeFallback = !selectedCandidate;
  const finalLayoutMode = isPureCodeFallback ? getPureCodeLayout() : scene.layoutMode;

  if (isPureCodeFallback) {
    log.warn('vlm.pure_code_fallback', `All evaluated candidates failed; falling back to PURE_CODE Layout: ${finalLayoutMode}`, {
      sceneId: scene.sceneId,
      finalLayoutMode,
      correlationId: options.correlationId,
    });
  }

  const updatedScene: SceneGeneration = {
    ...scene,
    candidates: inspected,
    selectedAsset: isPureCodeFallback ? undefined : selectedCandidate,
    layoutMode: finalLayoutMode,
    contentType: isPureCodeFallback ? 'PURE_CODE' : 'IMAGE',
    usePureCodeFallback: isPureCodeFallback,
  };

  return {
    updatedScene,
    inspectedCandidates: inspected,
    selectedCandidate: isPureCodeFallback ? undefined : selectedCandidate,
    isPureCodeFallback,
    selectedLayoutMode: finalLayoutMode,
  };
}
