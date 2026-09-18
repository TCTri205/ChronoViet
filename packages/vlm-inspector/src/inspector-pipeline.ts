/**
 * VLM Inspector Sub-Agent Pipeline
 * 3+3 Candidate Inspection, License Whitelisting, Dual Scorer, and PURE_CODE Layout Rotation
 */

import {
  DOMAIN_LAYOUT_WHITELIST,
  LayoutMode,
  LicenseTypeSchema,
  SceneGeneration,
  VideoType,
  VisualCandidate,
  isPureCodeLayout,
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
    normalized.includes('UNKNOWN')
  ) {
    return false;
  }

  return (
    normalized.includes('PUBLIC_DOMAIN') ||
    normalized.includes('PUBLIC') ||
    normalized.includes('CC0') ||
    normalized.includes('ZERO') ||
    normalized.includes('PD') ||
    normalized.includes('CC_BY_SA') ||
    normalized.includes('CC_BY')
  );
}

const log = createLogger({ service: 'vlm-inspector' });

export interface InspectSceneOptions {
  customBaseDir?: string;
  correlationId?: string;
  usedAssetHashes?: Set<string>;
  preferSemanticLayout?: boolean;
  videoType?: VideoType;
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

export function inferSemanticPureCodeLayout(
  text: string,
  fallbackIdx: number = 0,
  videoType?: VideoType
): LayoutMode {
  const lower = (text || '').toLowerCase();
  const allowedPool = videoType && DOMAIN_LAYOUT_WHITELIST[videoType]
    ? new Set(DOMAIN_LAYOUT_WHITELIST[videoType])
    : null;

  // 1. Direct speech, proclamation or historical quote
  if (/["“'‘][^"”'’\n]{5,300}["”'’]|hịch tướng sĩ|bình ngô đại cáo|tuyên ngôn|lời thề|lời dặn|khẳng định rằng|lời nói của|chiếu chỉ|dụ rằng|nói với/i.test(text)) {
    if (!allowedPool || allowedPool.has('QUOTE_SLIDE')) {
      return 'QUOTE_SLIDE';
    }
  }

  // 2. Comparison / Versus confrontation (strictly forbidden if not in domain whitelist)
  if (/so với|đối đầu|hai bên|tương quan lực lượng|địch và ta|quân ta.*quân địch|thủy chiến.*bộ chiến|đại phá quân|đánh tan.*quân/i.test(lower)) {
    if (!allowedPool || allowedPool.has('VERSUS_CARD')) {
      return 'VERSUS_CARD';
    }
  }

  // 2b. Character Profile (Exclusive for BIOGRAPHY when introducing identity, birth, titles, roles, or aliases)
  if (videoType === 'BIOGRAPHY' && /sinh ra tại|quê quán|tên khai sinh|tên thật là|thân phụ|thân mẫu|thuở nhỏ|bí danh|danh xưng|chức vụ|tổng bí thư|chủ tịch nước|lãnh tụ/i.test(lower)) {
    if (!allowedPool || allowedPool.has('CHARACTER_PROFILE')) {
      return 'CHARACTER_PROFILE';
    }
  }

  // 3. Explicit quantifiable standalone statistics
  if (/(?:thống kê|con số|tổng kết|thiệt hại|tổn thất|quân số lên tới|tổng cộng|lực lượng gồm có|huy động tổng cộng|quân số gồm|quy mô lực lượng):\s*\d+/i.test(text) ||
      /^\s*(?:quân số|lực lượng|thiệt hại|tổn thất|quy mô)\s*:\s*\d+/i.test(text) ||
      /(?:thiệt hại|tổn thất|quân số)\s*(?:lên tới|ước tính|khoảng)\s*\d+\s*(?:vạn|nghìn|triệu|người|chiến thuyền)/i.test(lower)) {
    if (!allowedPool || allowedPool.has('STAT_CARD')) {
      return 'STAT_CARD';
    }
  }

  // 4. Artifact Tag (Exclusive for ARTIFACT when presenting museum artifact profile or technical specs)
  if (videoType === 'ARTIFACT' && /hiện vật trưng bày|hồ sơ bảo vật|thông số hiện vật|trưng bày tại bảo tàng/i.test(lower)) {
    if (!allowedPool || allowedPool.has('MUSEUM_TAG')) {
      return 'MUSEUM_TAG';
    }
  }

  // 5. Royal Decree (For DYNASTY when presenting official edicts or capital transfer proclamations)
  if (videoType === 'DYNASTY' && /toàn văn chiếu|trích nguyên văn chiếu|ban chiếu dời đô|chiếu truyền ngôi/i.test(lower)) {
    if (!allowedPool || allowedPool.has('ROYAL_DECREE')) {
      return 'ROYAL_DECREE';
    }
  }

  // 6. Split Theory (Exclusive for MYSTERY when presenting contrasting hypotheses or historical debates)
  if (videoType === 'MYSTERY' && /hai luồng giả thuyết|các giả thuyết đối lập|tranh luận sử học về/i.test(lower)) {
    if (!allowedPool || allowedPool.has('SPLIT_THEORY')) {
      return 'SPLIT_THEORY';
    }
  }

  // 7. Tactical Map (For BATTLE when describing tactical map or march deployment diagram)
  if (videoType === 'BATTLE' && /sơ đồ tác chiến|bản đồ tác chiến|bản đồ hành quân|sơ đồ thế trận/i.test(lower)) {
    if (!allowedPool || allowedPool.has('MAP_TACTICAL')) {
      return 'MAP_TACTICAL';
    }
  }

  // 8. Chronological progression / Milestones / Chronological range
  if (/(?:tiến trình lịch sử|giai đoạn then chốt|bước ngoặt thời kỳ|mốc thời gian|từ năm\s+\d+.*đến\s+năm\s+\d+|giai đoạn\s+\d+[\s–—\-]+\d+)/i.test(lower)) {
    if (!allowedPool || allowedPool.has('TIMELINE_CHRONO')) {
      return 'TIMELINE_CHRONO';
    }
  }

  // 5. Default fallback round-robin across domain-whitelisted pure code layouts
  const domainLayouts: LayoutMode[] = videoType && DOMAIN_LAYOUT_WHITELIST[videoType]
    ? DOMAIN_LAYOUT_WHITELIST[videoType].filter((l): l is LayoutMode => isPureCodeLayout(l))
    : ['CHARACTER_PROFILE', 'TIMELINE_CHRONO', 'STAT_CARD'];
  const fallbackList: LayoutMode[] = domainLayouts.length > 0
    ? domainLayouts
    : ['CHARACTER_PROFILE', 'TIMELINE_CHRONO', 'STAT_CARD'];

  return fallbackList[Math.abs(fallbackIdx) % fallbackList.length];
}

export function isCandidateAlreadyUsed(cand: VisualCandidate, usedAssetHashes?: Set<string>): boolean {
  if (!usedAssetHashes || usedAssetHashes.size === 0) return false;
  return Boolean(
    (cand.sha256 && usedAssetHashes.has(cand.sha256)) ||
    (cand.imageUrl && usedAssetHashes.has(cand.imageUrl)) ||
    (cand.localPath && usedAssetHashes.has(cand.localPath))
  );
}

async function evaluateSingleCandidate(
  cand: VisualCandidate,
  voiceoverText: string,
  batchNumber: 1 | 2,
  qualityGate: VisualQualityGate,
  context: { correlationId?: string; sceneId?: string; projectId?: string; targetAspectRatio?: string; isUsed?: boolean } = {}
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
    // Intrinsic quality pass: does the image meet historical and technical quality standards?
    const intrinsicPass = scoreResult.passed && (scoreResult.totalScore >= scoreThreshold);
    // Apply frequency penalty if asset has already been used in an earlier scene
    const usedPenalty = context.isUsed ? 35 : 0;
    const finalScore = Math.max(0, scoreResult.totalScore - usedPenalty);
    const passed = intrinsicPass;

    return {
      evaluated: {
        ...cand,
        candidateBatch: batchNumber,
        focalPoint: scoreResult.focalPoint || cand.focalPoint || [0.5, 0.5],
        score: {
          historicalContextScore: scoreResult.historicalContextScore,
          visualNoiseScore: scoreResult.visualNoiseScore,
          artisticFitScore: scoreResult.artisticFitScore,
          overallScore: finalScore,
          scorerType: scoreResult.scorerType,
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
  const getPureCodeLayout = (): LayoutMode => {
    if (options.preferSemanticLayout) {
      return inferSemanticPureCodeLayout(scene.voiceoverText, scene.sceneIndex ?? 0, options.videoType);
    }
    const rawIndex = scene.sceneIndex ?? 0;
    const domainPureCode: LayoutMode[] = options.videoType && DOMAIN_LAYOUT_WHITELIST[options.videoType]
      ? DOMAIN_LAYOUT_WHITELIST[options.videoType].filter((l): l is LayoutMode => isPureCodeLayout(l))
      : ['TIMELINE_CHRONO', 'QUOTE_SLIDE', 'STAT_CARD'];
    const rotationPool: LayoutMode[] = domainPureCode.length > 0
      ? domainPureCode
      : ['TIMELINE_CHRONO', 'STAT_CARD'];
    const rotationIndex = Math.abs(rawIndex) % rotationPool.length;
    return rotationPool[rotationIndex];
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

  // 2. Sort candidate pool by provenance: catalog > wikimedia > web search,
  // deprioritizing candidates already selected in earlier scenes
  whitelistedCandidates.sort((a, b) => {
    const aUsed = isCandidateAlreadyUsed(a, options.usedAssetHashes);
    const bUsed = isCandidateAlreadyUsed(b, options.usedAssetHashes);

    if (aUsed !== bUsed) {
      return aUsed ? 1 : -1;
    }
    return getProvenanceRank(a) - getProvenanceRank(b);
  });

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

  // 3. Lazy Sequential VLM Curation (Evaluate candidate #1..#8 lazily; stopping when an unused candidate passes)
  const inspected: VisualCandidate[] = [...rejectedByLicense];
  let selectedCandidate: VisualCandidate | undefined = undefined;
  let backupUsedCandidate: VisualCandidate | undefined = undefined;

  // We evaluate all whitelisted candidates (up to 8 candidates) lazily
  const maxCandidatesToTry = Math.min(8, whitelistedCandidates.length);
  const candidatesToTry = whitelistedCandidates.slice(0, maxCandidatesToTry);

  for (let idx = 0; idx < candidatesToTry.length; idx++) {
    const cand = candidatesToTry[idx];
    const batchNum = (idx < 2 ? idx + 1 : 2) as 1 | 2;
    const isAlreadyUsed = isCandidateAlreadyUsed(cand, options.usedAssetHashes);

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
      {
        ...evalContext,
        isUsed: isAlreadyUsed,
      }
    );

    inspected.push(evaluated);

    if (passed) {
      if (!isAlreadyUsed) {
        selectedCandidate = evaluated;
        if (options.usedAssetHashes) {
          if (evaluated.sha256) options.usedAssetHashes.add(evaluated.sha256);
          if (evaluated.imageUrl) options.usedAssetHashes.add(evaluated.imageUrl);
          if (evaluated.localPath) options.usedAssetHashes.add(evaluated.localPath);
        }
        log.debug('vlm.lazy_curation_passed', `Candidate ${evaluated.candidateId} passed (fresh, unused) with score ${evaluated.score?.overallScore}; stopping sequential evaluation`, {
          sceneId: scene.sceneId,
          candidateId: evaluated.candidateId,
          score: evaluated.score?.overallScore,
        });
        break; // Stop immediately on fresh passing candidate!
      } else if (!backupUsedCandidate || (evaluated.score?.overallScore ?? 0) > (backupUsedCandidate.score?.overallScore ?? 0)) {
        backupUsedCandidate = evaluated;
        log.debug('vlm.used_candidate_backup', `Candidate ${evaluated.candidateId} passed with frequency penalty; holding as backup while seeking fresh candidate`, {
          sceneId: scene.sceneId,
          candidateId: evaluated.candidateId,
          score: evaluated.score?.overallScore,
        });
      }
    }
  }

  if (!selectedCandidate && backupUsedCandidate) {
    selectedCandidate = backupUsedCandidate;
    if (options.usedAssetHashes) {
      if (selectedCandidate.sha256) options.usedAssetHashes.add(selectedCandidate.sha256);
      if (selectedCandidate.imageUrl) options.usedAssetHashes.add(selectedCandidate.imageUrl);
      if (selectedCandidate.localPath) options.usedAssetHashes.add(selectedCandidate.localPath);
    }
  }

  // Check if any candidate was successfully selected
  const isPureCodeFallback = !selectedCandidate;
  let finalLayoutMode: LayoutMode;

  if (isPureCodeFallback) {
    finalLayoutMode = getPureCodeLayout();
    log.warn('vlm.pure_code_fallback', `All evaluated candidates failed; falling back to PURE_CODE Layout: ${finalLayoutMode}`, {
      sceneId: scene.sceneId,
      finalLayoutMode,
      correlationId: options.correlationId,
    });
  } else {
    // If candidate succeeded and original layout was pure code or missing, promote to HISTORICAL_FRAME
    finalLayoutMode = (!scene.layoutMode || isPureCodeLayout(scene.layoutMode))
      ? 'HISTORICAL_FRAME'
      : scene.layoutMode;
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
