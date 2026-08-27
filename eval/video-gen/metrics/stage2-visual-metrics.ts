/**
 * ChronoViet Stage 2: Visual Research & Curation Evaluation Metrics
 * Evaluates trilingual query planning, multi-provider candidate yield, disk download fidelity,
 * 100% license whitelist compliance, and VLM visual/historical quality scoring.
 */

import { BaseTestCaseResult, MetricScore, LatencyProfile, calculateLatencyPercentiles } from '../../shared/index.js';
import { isWhitelistedLicense } from '@chronoviet/vlm-inspector';

export interface Stage2SceneSummary {
  sceneId: string;
  contentType: 'IMAGE' | 'PURE_CODE';
  layoutMode: string;
  visualType?: string;
  primaryQuery?: string;
  hasEnglishQuery: boolean;
  hasFrenchQuery: boolean;
  candidatesCount: number;
  selectedAssetExists: boolean;
  assetFileExists: boolean;
  assetFileSizeBytes: number;
  license?: string;
  licenseWhitelisted: boolean;
  vlmHistoricalScore?: number;
  vlmVisualScore?: number;
  vlmCompositeScore?: number; // 0-10 normalized scale
  vlmScorerType?: string;
  isPureCodeFallback: boolean;
}

export interface VlmScorerBreakdown {
  primaryVlmCount: number; // LOCAL_VLM / OPENAI_VLM
  cloudVlmCount: number;   // GEMINI_CLOUD
  clipFallbackCount: number; // CLIP_LOCAL_FALLBACK
  totalEvaluatedCandidates: number;
}

export interface Stage2VisualCaseResult extends BaseTestCaseResult {
  id: string;
  title: string;
  topic: string;
  videoType: string;
  totalScenes: number;
  imageScenes: number;
  pureCodeScenes: number;
  pureCodeFallbackScenes: number;
  trilingualQueryCoverageRate: number;
  meanCandidateYield: number;
  downloadedAssetsCount: number;
  downloadSuccessRate: number;
  licenseComplianceRate: number;
  meanVlmQualityScore?: number;
  keywordCoverageRate?: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  vlmScorerBreakdown: VlmScorerBreakdown;
  durationMs: number;
  passed: boolean;
  scenes: Stage2SceneSummary[];
  errors?: string[];
  warnings?: string[];
}

export interface Stage2VisualAggregatedMetrics {
  totalCases: number;
  passedCases: number;
  meanTrilingualQueryCoverageRate: number;
  meanCandidateYield: number;
  assetDownloadSuccessRate: number;
  licenseComplianceRate: number;
  meanVlmQualityScore: number;
  pureCodeFallbackRate: number;
  vlmScorerBreakdown: VlmScorerBreakdown;
  durationProfile: LatencyProfile;
  metricScores: Record<string, MetricScore>;
}

export function evaluateStage2VisualCase(
  caseInfo: {
    id: string;
    topic: string;
    videoType: string;
    searchKeywordsCheck?: string[];
    executionDurationMs: number;
  },
  sceneSummaries: Stage2SceneSummary[],
  scorerBreakdown?: VlmScorerBreakdown
): Stage2VisualCaseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const totalScenes = sceneSummaries.length;
  const imageScenes = sceneSummaries.filter((s) => s.contentType === 'IMAGE').length;
  const pureCodeScenes = sceneSummaries.filter((s) => s.contentType === 'PURE_CODE').length;
  const pureCodeFallbackScenes = sceneSummaries.filter((s) => s.isPureCodeFallback).length;

  // Search Keyword Research Assertions
  const expectedKeywords = caseInfo.searchKeywordsCheck || [];
  const allPlannedQueries = sceneSummaries
    .map((s) => `${s.primaryQuery || ''} ${s.visualType || ''}`)
    .join(' ')
    .normalize('NFC')
    .toLowerCase();

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of expectedKeywords) {
    const normKw = kw.normalize('NFC').trim().toLowerCase();
    if (!normKw) continue;
    if (allPlannedQueries.includes(normKw)) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const keywordCoverageRate = expectedKeywords.length > 0
    ? Math.round((matchedKeywords.length / expectedKeywords.length) * 1000) / 1000
    : 1.0;

  if (keywordCoverageRate < 0.50 && missingKeywords.length > 0) {
    warnings.push(`Search keyword coverage is ${(keywordCoverageRate * 100).toFixed(0)}% (Uncovered queries: ${missingKeywords.join(', ')})`);
  }

  // Trilingual Query Coverage: Scenes with primaryQuery, englishQuery, and frenchQuery
  const plannedScenes = sceneSummaries.filter((s) => s.primaryQuery && s.primaryQuery.trim().length > 0);
  const trilingualScenes = plannedScenes.filter((s) => s.hasEnglishQuery && s.hasFrenchQuery).length;
  const trilingualQueryCoverageRate = plannedScenes.length > 0 ? trilingualScenes / plannedScenes.length : 1.0;

  if (trilingualQueryCoverageRate < 0.70 && plannedScenes.length > 0) {
    warnings.push(
      `Trilingual query coverage is ${(trilingualQueryCoverageRate * 100).toFixed(1)}% (${trilingualScenes}/${plannedScenes.length} scenes)`
    );
  }

  // Candidate Yield
  const totalCandidates = sceneSummaries.reduce((sum, s) => sum + s.candidatesCount, 0);
  const meanCandidateYield = imageScenes > 0 ? Math.round((totalCandidates / imageScenes) * 10) / 10 : 0;

  if (imageScenes > 0 && meanCandidateYield < 2.0) {
    warnings.push(`Low candidate yield: ${meanCandidateYield} candidates/scene (target >= 3.0)`);
  }

  // Asset Download Success Rate
  const validDownloads = sceneSummaries.filter(
    (s) => s.contentType === 'IMAGE' && s.assetFileExists && s.assetFileSizeBytes > 0
  ).length;
  const downloadSuccessRate = imageScenes > 0 ? validDownloads / imageScenes : 1.0;

  if (imageScenes > 0 && downloadSuccessRate < 0.65) {
    errors.push(
      `Asset download success rate ${(downloadSuccessRate * 100).toFixed(1)}% is below failure threshold (65%)`
    );
  } else if (imageScenes > 0 && downloadSuccessRate < 0.80) {
    warnings.push(
      `Asset download success rate is ${(downloadSuccessRate * 100).toFixed(1)}% (target >= 80%)`
    );
  }

  // License Whitelist Compliance (100% strict requirement)
  const nonWhitelistedScenes = sceneSummaries.filter(
    (s) => s.contentType === 'IMAGE' && s.selectedAssetExists && !s.licenseWhitelisted
  );
  const licenseComplianceRate = (imageScenes === 0 || nonWhitelistedScenes.length === 0) ? 1.0 : (imageScenes - nonWhitelistedScenes.length) / imageScenes;

  if (nonWhitelistedScenes.length > 0) {
    errors.push(`License compliance violation detected in ${nonWhitelistedScenes.length} scenes: Non-whitelisted license`);
  }

  // VLM Visual Quality Score (Normalized 0 - 10 scale)
  const vlmScores = sceneSummaries
    .map((s) => s.vlmCompositeScore)
    .filter((score): score is number => typeof score === 'number' && score > 0);

  let meanVlmQualityScore: number | undefined;
  if (vlmScores.length > 0) {
    meanVlmQualityScore = Math.round((vlmScores.reduce((a, b) => a + b, 0) / vlmScores.length) * 10) / 10;
  } else if (imageScenes > 0) {
    meanVlmQualityScore = 0.0;
    errors.push(`Visual scenes present (${imageScenes}) but 0 candidates evaluated or scored by VLM`);
  } else {
    // imageScenes === 0: Pure code composition, VLM scoring is N/A
    meanVlmQualityScore = undefined;
  }

  if (typeof meanVlmQualityScore === 'number' && meanVlmQualityScore > 0) {
    if (meanVlmQualityScore < 6.5) {
      errors.push(`Mean VLM quality score ${meanVlmQualityScore}/10 is below failure threshold (6.5/10)`);
    } else if (meanVlmQualityScore < 7.5) {
      warnings.push(`Mean VLM quality score is ${meanVlmQualityScore}/10 (target >= 7.5/10)`);
    }
  }

  const defaultScorerBreakdown: VlmScorerBreakdown = scorerBreakdown || {
    primaryVlmCount: 0,
    cloudVlmCount: 0,
    clipFallbackCount: 0,
    totalEvaluatedCandidates: 0,
  };

  const passed = errors.length === 0 && licenseComplianceRate === 1.0;

  return {
    id: caseInfo.id,
    title: caseInfo.topic,
    topic: caseInfo.topic,
    videoType: caseInfo.videoType,
    totalScenes,
    imageScenes,
    pureCodeScenes,
    pureCodeFallbackScenes,
    trilingualQueryCoverageRate,
    meanCandidateYield,
    downloadedAssetsCount: validDownloads,
    downloadSuccessRate,
    licenseComplianceRate,
    meanVlmQualityScore,
    keywordCoverageRate,
    matchedKeywords,
    missingKeywords,
    vlmScorerBreakdown: defaultScorerBreakdown,
    durationMs: caseInfo.executionDurationMs,
    passed,
    scenes: sceneSummaries,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function computeStage2VisualAggregatedMetrics(
  caseResults: Stage2VisualCaseResult[]
): Stage2VisualAggregatedMetrics {
  const totalCases = caseResults.length;
  const passedCases = caseResults.filter((r) => r.passed).length;

  const meanTrilingual = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.trilingualQueryCoverageRate, 0) / totalCases
    : 1.0;

  const totalImageScenes = caseResults.reduce((sum, r) => sum + r.imageScenes, 0);
  const totalCandidatesAll = caseResults.reduce(
    (sum, r) => sum + r.scenes.reduce((sSum, s) => sSum + s.candidatesCount, 0),
    0
  );
  const meanCandidateYield = totalImageScenes > 0
    ? Math.round((totalCandidatesAll / totalImageScenes) * 10) / 10
    : 0;

  const totalDownloads = caseResults.reduce((sum, r) => sum + r.downloadedAssetsCount, 0);
  const assetDownloadSuccessRate = totalImageScenes > 0 ? totalDownloads / totalImageScenes : 1.0;

  const meanLicenseCompliance = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.licenseComplianceRate, 0) / totalCases
    : 1.0;

  const casesWithImageScenes = caseResults.filter((r) => r.imageScenes > 0);
  const casesWithVlm = caseResults.filter(
    (r) => r.imageScenes > 0 && typeof r.meanVlmQualityScore === 'number' && r.meanVlmQualityScore > 0
  );
  const meanVlmScore = casesWithVlm.length > 0
    ? casesWithVlm.reduce((sum, r) => sum + (r.meanVlmQualityScore || 0), 0) / casesWithVlm.length
    : 0;

  const totalScenesAll = caseResults.reduce((sum, r) => sum + r.totalScenes, 0);
  const totalPureCodeFallback = caseResults.reduce((sum, r) => sum + r.pureCodeFallbackScenes, 0);
  const pureCodeFallbackRate = totalScenesAll > 0 ? totalPureCodeFallback / totalScenesAll : 0;

  const consolidatedScorerBreakdown: VlmScorerBreakdown = {
    primaryVlmCount: caseResults.reduce((sum, r) => sum + r.vlmScorerBreakdown.primaryVlmCount, 0),
    cloudVlmCount: caseResults.reduce((sum, r) => sum + r.vlmScorerBreakdown.cloudVlmCount, 0),
    clipFallbackCount: caseResults.reduce((sum, r) => sum + r.vlmScorerBreakdown.clipFallbackCount, 0),
    totalEvaluatedCandidates: caseResults.reduce(
      (sum, r) => sum + r.vlmScorerBreakdown.totalEvaluatedCandidates,
      0
    ),
  };

  const allDurations = caseResults.map((r) => r.durationMs);
  const durationProfile = calculateLatencyPercentiles(allDurations);

  const metricScores: Record<string, MetricScore> = {
    trilingualQueryCoverage: {
      name: 'Trilingual Query Coverage Rate',
      value: Math.round(meanTrilingual * 1000) / 10,
      target: 80.0,
      pass: meanTrilingual >= 0.65,
      unit: '%',
      description: 'Percentage of visual scenes equipped with Vietnamese, English, and French archive queries',
    },
    imageCandidateYield: {
      name: 'Image Candidate Yield',
      value: meanCandidateYield,
      target: 3.0,
      pass: meanCandidateYield >= 2.0,
      unit: 'cand/scene',
      description: 'Mean candidate images resolved across multi-provider research sources per image scene',
    },
    assetDownloadSuccessRate: {
      name: 'Image Asset Download Success Rate',
      value: Math.round(assetDownloadSuccessRate * 1000) / 10,
      target: 80.0,
      pass: assetDownloadSuccessRate >= 0.65, // Target >= 80%, fail < 65%
      unit: '%',
      description: 'Percentage of visual candidates successfully downloaded, decoded, and validated on disk',
    },
    licenseComplianceRate: {
      name: 'License Whitelist Compliance Rate',
      value: Math.round(meanLicenseCompliance * 1000) / 10,
      target: 100.0,
      pass: meanLicenseCompliance >= 1.0, // Target 100%, strict gate
      unit: '%',
      description: 'Percentage of curated image assets conforming to Public Domain / CC-BY / CC0 licenses',
    },
    vlmQualityScore: {
      name: 'VLM Visual Quality Score',
      value: Math.round(meanVlmScore * 10) / 10,
      target: 7.5,
      pass: casesWithImageScenes.length > 0 ? meanVlmScore >= 6.5 : true, // Target >= 7.5 / 10, fail < 6.5
      unit: '/10',
      description: 'Mean historical relevance and visual aesthetic score rated by VLM inspector',
    },
  };

  return {
    totalCases,
    passedCases,
    meanTrilingualQueryCoverageRate: Math.round(meanTrilingual * 1000) / 1000,
    meanCandidateYield,
    assetDownloadSuccessRate,
    licenseComplianceRate: meanLicenseCompliance,
    meanVlmQualityScore: Math.round(meanVlmScore * 10) / 10,
    pureCodeFallbackRate,
    vlmScorerBreakdown: consolidatedScorerBreakdown,
    durationProfile,
    metricScores,
  };
}
