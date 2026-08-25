/**
 * ChronoViet Video Generation Evaluation Metrics
 * Evaluates script pacing, historical fact-checking, scene duration alignment,
 * asset download fidelity, license whitelist compliance, and VLM visual quality.
 */

import { SceneGeneration } from '@chronoviet/shared-spec';
import { MetricScore, LatencyProfile, calculateLatencyPercentiles } from '../../shared/index.js';

export interface VideoGenTestCase {
  id: string;
  topic: string;
  epoch: string;
  targetDurationMinutes: number;
  videoType: 'BIOGRAPHY' | 'BATTLE' | 'DYNASTY' | 'MYSTERY' | 'ARTIFACT';
  templateId: string;
  expectedEntities: string[];
  expectedChapters: string[];
  searchKeywordsCheck: string[];
}

export interface VideoGenSceneSummary {
  sceneId: string;
  contentType: 'IMAGE' | 'PURE_CODE';
  layoutMode: string;
  durationSec: number;
  wordCount: number;
  hasVisualAsset: boolean;
  assetFileExists?: boolean;
  assetFileSizeBytes?: number;
  license?: string;
  licenseWhitelisted?: boolean;
  vlmHistoricalScore?: number;
  vlmVisualScore?: number;
  vlmCompositeScore?: number;
}

export interface VideoGenCaseResult {
  id: string;
  title: string;
  topic: string;
  videoType: string;
  targetDurationSec: number;
  actualDurationSec: number;
  totalWordCount: number;
  actualWpm: number;
  pacingDeviationPct: number;
  pacingPassed: boolean;
  factCheckPassed: boolean;
  factCheckFlags: string[];
  entityRecallRate: number;
  missingEntities: string[];
  totalScenes: number;
  imageScenes: number;
  pureCodeScenes: number;
  downloadedAssetsCount: number;
  downloadSuccessRate: number;
  licenseComplianceRate: number;
  meanVlmQualityScore: number;
  durationMs: number;
  passed: boolean;
  scenes: VideoGenSceneSummary[];
  errors?: string[];
  warnings?: string[];
}

export interface VideoGenAggregatedMetrics {
  totalProjects: number;
  passedProjects: number;
  meanPacingDeviationPct: number;
  factCheckPassRate: number;
  meanEntityRecallRate: number;
  assetDownloadSuccessRate: number;
  licenseComplianceRate: number;
  meanVlmQualityScore: number;
  pureCodeFallbackRate: number;
  durationProfile: LatencyProfile;
  metricScores: Record<string, MetricScore>;
}

export const CANONICAL_HISTORICAL_ALIASES: Record<string, string[]> = {
  'Hùng Vương': ['Vua Hùng', 'Hùng Vương', 'Hùng Quốc Vương', 'Lạc Long Quân', 'Thời đại Hùng Vương'],
  'Vua Hùng': ['Hùng Vương', 'Vua Hùng', 'Hùng Quốc Vương', 'Lạc Long Quân'],
  'Lý Bí': ['Lý Nam Đế', 'Lý Bí', 'Lý Bôn', 'Tiền Lý'],
  'Lý Nam Đế': ['Lý Bí', 'Lý Nam Đế', 'Lý Bôn', 'Tiền Lý'],
  'Triệu Thị Trinh': ['Bà Triệu', 'Triệu Thị Trinh', 'Triệu Ẩu', 'Triệu Trinh Nương', 'Nhụy Kiều Tướng quân'],
  'Bà Triệu': ['Triệu Thị Trinh', 'Bà Triệu', 'Triệu Ẩu', 'Triệu Trinh Nương'],
  'Nguyễn Huệ': ['Quang Trung', 'Nguyễn Huệ', 'Vua Quang Trung', 'Bắc Bình Vương'],
  'Quang Trung': ['Nguyễn Huệ', 'Quang Trung', 'Vua Quang Trung', 'Bắc Bình Vương'],
  'Ngô Quyền': ['Tiền Ngô Vương', 'Ngô Quyền', 'Ngô Chúa'],
  'Đinh Bộ Lĩnh': ['Đinh Tiên Hoàng', 'Đinh Bộ Lĩnh', 'Vạn Thắng Vương', 'Đinh Hoàng Đế'],
  'Đinh Tiên Hoàng': ['Đinh Bộ Lĩnh', 'Đinh Tiên Hoàng', 'Vạn Thắng Vương'],
  'Lê Hoàn': ['Lê Đại Hành', 'Lê Hoàn', 'Vua Lê Đại Hành'],
  'Lê Đại Hành': ['Lê Hoàn', 'Lê Đại Hành', 'Vua Lê Đại Hành'],
  'Lý Công Uẩn': ['Lý Thái Tổ', 'Lý Công Uẩn', 'Vua Lý Thái Tổ'],
  'Lý Thái Tổ': ['Lý Công Uẩn', 'Lý Thái Tổ', 'Vua Lý Thái Tổ'],
  'Lê Lợi': ['Lê Thái Tổ', 'Lê Lợi', 'Bình Định Vương', 'Vua Lê Thái Tổ'],
  'Lê Thái Tổ': ['Lê Lợi', 'Lê Thái Tổ', 'Bình Định Vương', 'Vua Lê Thái Tổ'],
  'Trần Quốc Tuấn': ['Trần Hưng Đạo', 'Hưng Đạo Đại Vương', 'Trần Quốc Tuấn', 'Đức Thánh Trần', 'Hưng Đạo Vương'],
  'Trần Hưng Đạo': ['Trần Quốc Tuấn', 'Hưng Đạo Đại Vương', 'Trần Hưng Đạo', 'Đức Thánh Trần', 'Hưng Đạo Vương'],
  'Võ Nguyên Giáp': ['Đại tướng Võ Nguyên Giáp', 'Võ Nguyên Giáp', 'Tướng Giáp'],
  'Hai Bà Trưng': ['Hai Bà Trưng', 'Trưng Vương', 'Trưng Nữ Vương'],
  'Trưng Trắc': ['Trưng Trắc', 'Trưng Nữ Vương'],
  'Trưng Nhị': ['Trưng Nhị'],
  'Nguyễn Trãi': ['Ức Trai', 'Nguyễn Trãi', 'Quan phục hầu'],
  'Hồ Chí Minh': ['Nguyễn Ái Quốc', 'Bác Hồ', 'Hồ Chí Minh', 'Nguyễn Sinh Cung', 'Nguyễn Tất Thành'],
  'Gia Long': ['Nguyễn Ánh', 'Vua Gia Long', 'Gia Long', 'Thế Tổ Cao Hoàng Đế'],
  'Nguyễn Ánh': ['Gia Long', 'Vua Gia Long', 'Nguyễn Ánh'],
  'Minh Mạng': ['Minh Mệnh', 'Vua Minh Mạng', 'Minh Mạng', 'Thánh Tổ'],
  'Tự Đức': ['Vua Tự Đức', 'Tự Đức', 'Dực Tông'],
  'Hàm Nghi': ['Vua Hàm Nghi', 'Hàm Nghi'],
  'Bảo Đại': ['Vua Bảo Đại', 'Bảo Đại', 'Nguyễn Phúc Vĩnh Thụy'],
};

export function evaluateVideoGenCase(
  testCase: VideoGenTestCase,
  projectState: {
    projectId: string;
    scriptText: string;
    scenes: SceneGeneration[];
    factCheckPassed: boolean;
    factCheckFlags?: string[];
    aliasTable?: Record<string, string[]>;
    executionDurationMs: number;
  },
  sceneSummaries: VideoGenSceneSummary[]
): VideoGenCaseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const targetDurationSec = testCase.targetDurationMinutes * 60;
  const actualDurationSec = sceneSummaries.reduce((sum, s) => sum + s.durationSec, 0);

  // Word count & Pacing
  const words = projectState.scriptText.trim().split(/\s+/).filter(Boolean);
  const totalWordCount = words.length;
  const durationMin = actualDurationSec > 0 ? actualDurationSec / 60 : testCase.targetDurationMinutes;
  const actualWpm = durationMin > 0 ? Math.round(totalWordCount / durationMin) : 0;

  // Target WPM is 145 (range 130 - 160)
  const targetWpm = 145;
  const pacingDeviationPct = Math.round((Math.abs(actualWpm - targetWpm) / targetWpm) * 1000) / 10;
  // Pacing pass if within 15% deviation
  const pacingPassed = pacingDeviationPct <= 15.0;
  if (!pacingPassed) {
    warnings.push(`Pacing deviation is ${pacingDeviationPct}% (WPM=${actualWpm}, Target=${targetWpm})`);
  }

  // Fact check
  const factCheckPassed = projectState.factCheckPassed;
  if (!factCheckPassed) {
    errors.push(`Historical fact-check flag raised: ${(projectState.factCheckFlags || []).join(', ')}`);
  }

  // Canonical & Alias-Aware Entity Recall Check
  const expectedEntities = testCase.expectedEntities || [];
  const scriptLower = projectState.scriptText.toLowerCase();

  const matchedEntities: string[] = [];
  const missingEntities: string[] = [];

  for (const ent of expectedEntities) {
    const entTrimmed = ent.trim();
    if (!entTrimmed) continue;
    const entLower = entTrimmed.toLowerCase();

    // Collect all valid variants from RAG aliasTable and static historical dictionary
    const ragAliases = (projectState.aliasTable?.[entTrimmed] || []).map((a) => a.trim());
    const staticAliases = (CANONICAL_HISTORICAL_ALIASES[entTrimmed] || []).map((a) => a.trim());

    // Single-level reverse alias lookup for canonical mapping
    const reverseAliases: string[] = [];
    for (const [canonicalKey, aliases] of Object.entries(CANONICAL_HISTORICAL_ALIASES)) {
      if (aliases.some((a) => a.toLowerCase() === entLower) && canonicalKey.toLowerCase() !== entLower) {
        reverseAliases.push(canonicalKey);
      }
    }

    const allVariants = Array.from(
      new Set([entTrimmed, ...ragAliases, ...staticAliases, ...reverseAliases])
    );

    const isMatched = allVariants.some((variant) => {
      const vTrimmed = variant.trim();
      if (!vTrimmed || vTrimmed.length < 2) return false;
      return scriptLower.includes(vTrimmed.toLowerCase());
    });

    if (isMatched) {
      matchedEntities.push(entTrimmed);
    } else {
      missingEntities.push(entTrimmed);
    }
  }

  const entityRecallRate = expectedEntities.length > 0 ? matchedEntities.length / expectedEntities.length : 1.0;

  if (entityRecallRate < 0.60 && missingEntities.length > 0) {
    warnings.push(
      `Historical entity recall is ${(entityRecallRate * 100).toFixed(0)}% (Missing: ${missingEntities.join(', ')})`
    );
  }

  // Scenes & Assets
  const totalScenes = sceneSummaries.length;
  const imageScenes = sceneSummaries.filter((s) => s.contentType === 'IMAGE').length;
  const pureCodeScenes = sceneSummaries.filter((s) => s.contentType === 'PURE_CODE').length;

  const validDownloads = sceneSummaries.filter((s) => s.contentType === 'IMAGE' && s.assetFileExists && (s.assetFileSizeBytes || 0) > 0).length;
  const downloadSuccessRate = imageScenes > 0 ? validDownloads / imageScenes : 1.0;

  const whitelistedCount = sceneSummaries.filter((s) => {
    if (s.contentType !== 'IMAGE') return true;
    return s.licenseWhitelisted === true;
  }).length;
  const licenseComplianceRate = totalScenes > 0 ? whitelistedCount / totalScenes : 1.0;

  if (licenseComplianceRate < 1.0) {
    errors.push(`License compliance violation detected (${(licenseComplianceRate * 100).toFixed(1)}%)`);
  }

  const vlmScores = sceneSummaries
    .map((s) => s.vlmCompositeScore)
    .filter((score): score is number => typeof score === 'number' && score > 0);
  const meanVlmQualityScore = vlmScores.length > 0
    ? Math.round((vlmScores.reduce((a, b) => a + b, 0) / vlmScores.length) * 10) / 10
    : (imageScenes === 0 ? 0 : 0);

  const passed = errors.length === 0;

  return {
    id: testCase.id,
    title: testCase.topic,
    topic: testCase.topic,
    videoType: testCase.videoType,
    targetDurationSec,
    actualDurationSec,
    totalWordCount,
    actualWpm,
    pacingDeviationPct,
    pacingPassed,
    factCheckPassed,
    factCheckFlags: projectState.factCheckFlags || [],
    entityRecallRate,
    missingEntities,
    totalScenes,
    imageScenes,
    pureCodeScenes,
    downloadedAssetsCount: validDownloads,
    downloadSuccessRate,
    licenseComplianceRate,
    meanVlmQualityScore,
    durationMs: projectState.executionDurationMs,
    passed,
    scenes: sceneSummaries,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function computeVideoGenAggregatedMetrics(
  caseResults: VideoGenCaseResult[]
): VideoGenAggregatedMetrics {
  const totalProjects = caseResults.length;
  const passedProjects = caseResults.filter((r) => r.passed).length;

  const meanPacingDeviation = totalProjects > 0
    ? caseResults.reduce((sum, r) => sum + r.pacingDeviationPct, 0) / totalProjects
    : 0;

  const factPasses = caseResults.filter((r) => r.factCheckPassed).length;
  const factCheckPassRate = totalProjects > 0 ? factPasses / totalProjects : 1.0;

  const meanEntityRecall = totalProjects > 0
    ? caseResults.reduce((sum, r) => sum + (r.entityRecallRate || 0), 0) / totalProjects
    : 1.0;

  const totalImageScenes = caseResults.reduce((sum, r) => sum + r.imageScenes, 0);
  const totalDownloads = caseResults.reduce((sum, r) => sum + r.downloadedAssetsCount, 0);
  const assetDownloadSuccessRate = totalImageScenes > 0 ? totalDownloads / totalImageScenes : 1.0;

  const totalScenesAll = caseResults.reduce((sum, r) => sum + r.totalScenes, 0);
  const totalPureCode = caseResults.reduce((sum, r) => sum + r.pureCodeScenes, 0);
  const pureCodeFallbackRate = totalScenesAll > 0 ? totalPureCode / totalScenesAll : 0;

  const meanLicenseCompliance = totalProjects > 0
    ? caseResults.reduce((sum, r) => sum + r.licenseComplianceRate, 0) / totalProjects
    : 1.0;

  const casesWithVlm = caseResults.filter((r) => r.imageScenes > 0 && r.meanVlmQualityScore > 0);
  const meanVlmScore = casesWithVlm.length > 0
    ? casesWithVlm.reduce((sum, r) => sum + r.meanVlmQualityScore, 0) / casesWithVlm.length
    : 8.0;

  const allDurations = caseResults.map((r) => r.durationMs);
  const durationProfile = calculateLatencyPercentiles(allDurations);

  const metricScores: Record<string, MetricScore> = {
    scriptPacingDeviation: {
      name: 'Script Pacing Deviation',
      value: Math.round(meanPacingDeviation * 10) / 10,
      target: 8.0,
      pass: meanPacingDeviation <= 15.0, // Target <= 8%, fail > 15%
      unit: '%',
      description: 'Deviation of spoken narration WPM against target 130-160 WPM benchmark',
    },
    factCheckPassRate: {
      name: 'Historical Fact-Check Pass Rate',
      value: Math.round(factCheckPassRate * 1000) / 10,
      target: 95.0,
      pass: factCheckPassRate >= 0.90, // Target >= 95%, fail < 90%
      unit: '%',
      description: 'Percentage of video scripts passing multi-tier historical fact-check and guardrails',
    },
    historicalEntityRecall: {
      name: 'Historical Entity Recall Rate',
      value: Math.round(meanEntityRecall * 1000) / 10,
      target: 80.0,
      pass: meanEntityRecall >= 0.65, // Target >= 80%, soft pass >= 65%
      unit: '%',
      description: 'Percentage of expected canonical historical entities covered in the generated voiceover script',
    },
    assetDownloadSuccessRate: {
      name: 'Image Asset Download Success Rate',
      value: Math.round(assetDownloadSuccessRate * 1000) / 10,
      target: 80.0,
      pass: assetDownloadSuccessRate >= 0.65, // Target >= 80%, fail < 65%
      unit: '%',
      description: 'Percentage of visual candidates successfully downloaded, decoded and saved to disk',
    },
    licenseComplianceRate: {
      name: 'License Whitelist Compliance Rate',
      value: Math.round(meanLicenseCompliance * 1000) / 10,
      target: 100.0,
      pass: meanLicenseCompliance >= 1.0, // Target 100%, strict gate
      unit: '%',
      description: 'Percentage of selected image assets matching CC0 / CC-BY / Public Domain licenses',
    },
    vlmQualityScore: {
      name: 'VLM Visual Quality Score',
      value: Math.round(meanVlmScore * 10) / 10,
      target: 7.5,
      pass: meanVlmScore >= 6.5, // Target >= 7.5 / 10, fail < 6.5
      unit: '/10',
      description: 'Mean historical relevance and visual aesthetic score rated by VLM inspector',
    },
  };

  return {
    totalProjects,
    passedProjects,
    meanPacingDeviationPct: Math.round(meanPacingDeviation * 10) / 10,
    factCheckPassRate,
    meanEntityRecallRate: Math.round(meanEntityRecall * 1000) / 1000,
    assetDownloadSuccessRate,
    licenseComplianceRate: meanLicenseCompliance,
    meanVlmQualityScore: Math.round(meanVlmScore * 10) / 10,
    pureCodeFallbackRate,
    durationProfile,
    metricScores,
  };
}
