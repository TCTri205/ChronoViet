/**
 * ChronoViet Stage 1: Script & Narrative Quality Evaluation Metrics
 * Evaluates RAG retrieval grounding, narrative structuring, planned pacing/WPM,
 * historical entity recall, fact-checking safeguards, and scene segmentation bounds (5s-25s).
 *
 * NOTE (ADR-4): In Stage 1 text-only mode, audio synthesis is intentionally skipped.
 * `durationSec` is derived from segmenter heuristics (`targetDurationSeconds = Math.max(5, Math.ceil(wordCount / 2.5))`).
 * Stage 1 measures Planned Script Pacing & Density (WPM), not acoustic spoken timing.
 */

import { SceneGeneration } from '@chronoviet/shared-spec';
import { BaseTestCaseResult, MetricScore, LatencyProfile, calculateLatencyPercentiles } from '../../shared/index.js';
import { VideoGenTestCase, CANONICAL_HISTORICAL_ALIASES } from './video-gen-metrics.js';

export interface Stage1SceneSummary {
  sceneId: string;
  chapterIndex: number;
  layoutMode: string;
  durationSec: number;
  wordCount: number;
  voiceoverText: string;
  durationBoundsPassed: boolean;
  wordCountBoundsPassed: boolean;
}

export interface Stage1ScriptCaseResult extends BaseTestCaseResult {
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
  matchedEntities: string[];
  missingEntities: string[];
  totalChapters: number;
  chapterAlignmentRate: number;
  matchedChapters: string[];
  missingChapters: string[];
  totalScenes: number;
  sceneBoundsComplianceRate: number;
  durationMs: number;
  passed: boolean;
  scenes: Stage1SceneSummary[];
  errors?: string[];
  warnings?: string[];
}

export interface Stage1ScriptAggregatedMetrics {
  totalCases: number;
  passedCases: number;
  meanPacingDeviationPct: number;
  factCheckPassRate: number;
  meanEntityRecallRate: number;
  meanChapterAlignmentRate: number;
  sceneBoundsComplianceRate: number;
  durationProfile: LatencyProfile;
  metricScores: Record<string, MetricScore>;
}

export function evaluateStage1ScriptCase(
  testCase: VideoGenTestCase,
  projectState: {
    projectId: string;
    scriptText: string;
    chaptersCount: number;
    chapters?: Array<{ chapterIndex: number; title: string; summary?: string }>;
    scenes: SceneGeneration[];
    factCheckPassed: boolean;
    factCheckFlags?: string[];
    aliasTable?: Record<string, string[]>;
    executionDurationMs: number;
  }
): Stage1ScriptCaseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const targetDurationSec = testCase.targetDurationMinutes * 60;

  // Scene summaries and bounds audit (5s - 25s duration, 10 - 55 words)
  const sceneSummaries: Stage1SceneSummary[] = (projectState.scenes || []).map((scene) => {
    const wordCount = scene.voiceoverText ? scene.voiceoverText.trim().split(/\s+/).filter(Boolean).length : 0;
    const durationSec = scene.targetDurationSeconds || Math.max(5, Math.ceil(wordCount / 2.5));
    const durationBoundsPassed = durationSec >= 5 && durationSec <= 25;
    const wordCountBoundsPassed = wordCount >= 10 && wordCount <= 55;

    return {
      sceneId: scene.sceneId,
      chapterIndex: (scene as any).chapterIndex ?? 0,
      layoutMode: scene.layoutMode || 'HISTORICAL_FRAME',
      durationSec,
      wordCount,
      voiceoverText: scene.voiceoverText || '',
      durationBoundsPassed,
      wordCountBoundsPassed,
    };
  });

  const actualDurationSec = sceneSummaries.reduce((sum, s) => sum + s.durationSec, 0);

  // Planned Word Count & Pacing (145 WPM baseline, 130 - 160 band)
  const words = projectState.scriptText.trim().split(/\s+/).filter(Boolean);
  const totalWordCount = words.length;
  const durationMin = actualDurationSec > 0 ? actualDurationSec / 60 : testCase.targetDurationMinutes;
  const actualWpm = durationMin > 0 ? Math.round(totalWordCount / durationMin) : 0;

  const targetWpm = 145;
  const pacingDeviationPct = Math.round((Math.abs(actualWpm - targetWpm) / targetWpm) * 1000) / 10;
  const pacingPassed = pacingDeviationPct <= 15.0; // Pass <= 15.0%, Target <= 8.0%

  if (!pacingPassed) {
    warnings.push(`Planned pacing deviation is ${pacingDeviationPct}% (WPM=${actualWpm}, Target=${targetWpm})`);
  }

  // Fact-Check Audit
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

    // Collect variants from RAG aliasTable and static historical dictionary
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

  if (entityRecallRate < 0.65 && missingEntities.length > 0) {
    warnings.push(
      `Historical entity recall is ${(entityRecallRate * 100).toFixed(0)}% (Missing: ${missingEntities.join(', ')})`
    );
  }

  // Expected Chapters & Narrative Structuring Alignment Check
  const expectedChapters = testCase.expectedChapters || [];
  const generatedChapters = projectState.chapters || [];
  const allChapterText = [
    ...generatedChapters.map((c) => `${c.title || ''} ${c.summary || ''}`),
    projectState.scriptText,
  ].join(' ').normalize('NFC').toLowerCase();

  const matchedChapters: string[] = [];
  const missingChapters: string[] = [];

  for (const expChap of expectedChapters) {
    const expChapNorm = expChap.normalize('NFC').trim();
    if (!expChapNorm) continue;
    const chapWords = expChapNorm
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !/^(và|của|trong|cho|với|những|các|đã|thì|sau|khi|là)$/i.test(w));

    const isChapMatched =
      chapWords.length === 0 ||
      chapWords.filter((w) => allChapterText.includes(w)).length / Math.max(1, chapWords.length) >= 0.5 ||
      allChapterText.includes(expChapNorm.toLowerCase());

    if (isChapMatched) {
      matchedChapters.push(expChapNorm);
    } else {
      missingChapters.push(expChapNorm);
    }
  }

  const chapterAlignmentRate = expectedChapters.length > 0
    ? Math.round((matchedChapters.length / expectedChapters.length) * 1000) / 1000
    : 1.0;

  if (chapterAlignmentRate < 0.60 && missingChapters.length > 0) {
    warnings.push(`Chapter narrative alignment is ${(chapterAlignmentRate * 100).toFixed(0)}% (Missing expected themes: ${missingChapters.join(', ')})`);
  }

  // Scene Bounds Compliance Rate
  const totalScenes = sceneSummaries.length;
  const compliantScenes = sceneSummaries.filter((s) => s.durationBoundsPassed).length;
  const sceneBoundsComplianceRate = totalScenes > 0 ? compliantScenes / totalScenes : 1.0;

  if (sceneBoundsComplianceRate < 1.0) {
    warnings.push(`Scene chunk duration compliance is ${(sceneBoundsComplianceRate * 100).toFixed(1)}% (${compliantScenes}/${totalScenes} scenes in 5s-25s band)`);
  }

  // Pass criteria for Stage 1: No fatal errors, fact check passed, entity recall >= 0.65, pacing passed
  const passed = errors.length === 0 && factCheckPassed && entityRecallRate >= 0.65 && pacingPassed;

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
    matchedEntities,
    missingEntities,
    totalChapters: projectState.chaptersCount,
    chapterAlignmentRate,
    matchedChapters,
    missingChapters,
    totalScenes,
    sceneBoundsComplianceRate,
    durationMs: projectState.executionDurationMs,
    passed,
    scenes: sceneSummaries,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function computeStage1ScriptAggregatedMetrics(
  caseResults: Stage1ScriptCaseResult[]
): Stage1ScriptAggregatedMetrics {
  const totalCases = caseResults.length;
  const passedCases = caseResults.filter((r) => r.passed).length;

  const meanPacingDeviation = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.pacingDeviationPct, 0) / totalCases
    : 0;

  const factPasses = caseResults.filter((r) => r.factCheckPassed).length;
  const factCheckPassRate = totalCases > 0 ? factPasses / totalCases : 1.0;

  const meanEntityRecall = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + (r.entityRecallRate || 0), 0) / totalCases
    : 1.0;

  const meanChapterAlignment = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + (r.chapterAlignmentRate || 1.0), 0) / totalCases
    : 1.0;

  const totalScenesAll = caseResults.reduce((sum, r) => sum + r.totalScenes, 0);
  const compliantScenesAll = caseResults.reduce(
    (sum, r) => sum + r.scenes.filter((s) => s.durationBoundsPassed).length,
    0
  );
  const sceneBoundsComplianceRate = totalScenesAll > 0 ? compliantScenesAll / totalScenesAll : 1.0;

  const allDurations = caseResults.map((r) => r.durationMs);
  const durationProfile = calculateLatencyPercentiles(allDurations);

  const metricScores: Record<string, MetricScore> = {
    scriptPacingDeviation: {
      name: 'Planned Script Pacing Deviation',
      value: Math.round(meanPacingDeviation * 10) / 10,
      target: 8.0,
      pass: meanPacingDeviation <= 15.0, // Target <= 8%, fail > 15%
      unit: '%',
      description: 'Deviation of planned narration WPM against target 145 WPM (130-160 WPM band) benchmark',
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
    chapterNarrativeAlignment: {
      name: 'Chapter Narrative Alignment Rate',
      value: Math.round(meanChapterAlignment * 1000) / 10,
      target: 85.0,
      pass: meanChapterAlignment >= 0.65,
      unit: '%',
      description: 'Percentage of expected benchmark chapter themes covered in generated chapter outlines',
    },
    sceneDurationBoundsCompliance: {
      name: 'Scene Chunk Duration Bounds Rate',
      value: Math.round(sceneBoundsComplianceRate * 1000) / 10,
      target: 100.0,
      pass: sceneBoundsComplianceRate >= 0.90,
      unit: '%',
      description: 'Percentage of segmented scene chunks strictly bounded within 5s-25s target duration',
    },
    casePassRate: {
      name: 'Individual Case Pass Rate',
      value: Math.round(((passedCases / (totalCases || 1)) * 100) * 10) / 10,
      target: 90.0,
      pass: totalCases > 0 ? (passedCases / totalCases) >= 0.80 : true,
      unit: '%',
      description: 'Percentage of individual video generation cases passing all Stage 1 quality gates',
    },
  };

  return {
    totalCases,
    passedCases,
    meanPacingDeviationPct: Math.round(meanPacingDeviation * 10) / 10,
    factCheckPassRate,
    meanEntityRecallRate: Math.round(meanEntityRecall * 1000) / 1000,
    meanChapterAlignmentRate: Math.round(meanChapterAlignment * 1000) / 1000,
    sceneBoundsComplianceRate,
    durationProfile,
    metricScores,
  };
}
