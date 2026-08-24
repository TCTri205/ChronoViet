/**
 * Tier A2 Benchmark: Historical Scriptwriting, Tone & WPM Density
 * Benchmarks: scriptwriter-node.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ComponentBenchmarkReport } from '@chronoviet/shared-spec';
import { scriptwriterNode } from '../../src/graph/nodes/scriptwriter-node.js';
import { ChronoGraphState } from '../../src/graph/state.js';
import {
  calculateNarrativeWordDensity,
  evaluateHistoricalScriptTone,
  HighResolutionLatencyProfiler,
} from '../metrics/index.js';
import { HistoricalTopicItem } from '../datasets/builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runA2Benchmark(options: { sample?: number; fresh?: boolean } = {}): Promise<ComponentBenchmarkReport> {
  const profiler = new HighResolutionLatencyProfiler();
  const datasetPath = path.resolve(__dirname, '../datasets/orchestrator-historical-topics-50.json');
  let rawData: HistoricalTopicItem[] = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

  if (options.sample && options.sample > 0) {
    rawData = rawData.slice(0, options.sample);
  }

  let totalWpm = 0;
  let optimalPacingCount = 0;
  let toneAdherenceCount = 0;
  let entityContinuityCount = 0;
  const details: any[] = [];

  for (const item of rawData) {
    const chapters = item.expectedChapters.map((ch, idx) => ({
      chapterIndex: idx,
      title: ch.title,
      summary: ch.keyPoints.join('. '),
      targetDurationSeconds: ch.targetDurationSeconds,
      keyEvents: ch.keyPoints,
      introducedEntities: item.expectedEntities,
      transitionHook: 'Mối nối chương...',
      establishedTone: 'Hùng tráng',
    }));

    const mockState: any = {
      projectId: item.id,
      userPrompt: item.topic,
      targetDurationMinutes: item.targetDurationMinutes,
      videoType: item.videoType,
      templateId: item.templateId,
      status: 'OUTLINE_CHAPTERED',
      currentStep: 2,
      chapters: [chapters[0]],
      currentChapterIndex: 0,
      runningNarrativeState: {
        previousChapterSummary: '',
        establishedTone: 'Hùng tráng, trang trọng',
        introducedEntities: item.expectedEntities,
        transitionHook: '',
      },
      chapterScripts: {},
      factCheckLogs: [],
      scenes: [],
      audioAssets: [],
    };

    const stopTimer = profiler.startTimer();
    const result = await scriptwriterNode(mockState);
    stopTimer();

    const script = result.chapterScripts?.[0] || '';
    const densityRes = calculateNarrativeWordDensity(script, chapters[0].targetDurationSeconds, [80, 200]);
    totalWpm += densityRes.wordsPerMinute;
    if (densityRes.isWithinOptimalPacing) {
      optimalPacingCount++;
    }

    // Evaluate historical tone & anti-slang using hardened multi-factor analyzer
    const toneRes = evaluateHistoricalScriptTone(script, item.expectedEntities);
    if (toneRes.isPassingTone) {
      toneAdherenceCount++;
    }

    // Evaluate rigorous entity continuity (no length > 50 shortcuts)
    if (toneRes.isPassingEntityContinuity) {
      entityContinuityCount++;
    }

    details.push({
      id: item.id,
      topic: item.topic,
      wordCount: densityRes.wordCount,
      wpm: densityRes.wordsPerMinute,
      isPaced: densityRes.isWithinOptimalPacing,
      toneScore: toneRes.toneScorePercentage,
      hasModernSlang: toneRes.detectedSlangTerms.length > 0,
      entityCoveragePercentage: toneRes.entityCoveragePercentage,
    });
  }

  const avgWpm = totalWpm / rawData.length;
  const pacingComplianceRate = (optimalPacingCount / rawData.length) * 100;
  const toneAdherenceRate = (toneAdherenceCount / rawData.length) * 100;
  const entityContinuityRate = (entityContinuityCount / rawData.length) * 100;

  const kpis_passed = toneAdherenceRate >= 85.0 && pacingComplianceRate >= 70.0 && entityContinuityRate >= 70.0;

  const report: ComponentBenchmarkReport = {
    benchmark_id: 'TIER_A2_SCRIPTWRITING_TONE',
    name: 'Tier A2: Historical Scriptwriting & Tone Benchmark',
    timestamp: new Date().toISOString(),
    total_evaluated: rawData.length,
    metrics: {
      avg_words_per_minute: Number(avgWpm.toFixed(1)),
      pacing_compliance_rate: Number(pacingComplianceRate.toFixed(2)),
      tone_adherence_rate: Number(toneAdherenceRate.toFixed(2)),
      entity_continuity_rate: Number(entityContinuityRate.toFixed(2)),
      kpi_tone_adherence_pass: toneAdherenceRate >= 90.0,
      kpi_pacing_pass: pacingComplianceRate >= 80.0,
    },
    kpis_passed,
    latency_summary: profiler.getSummary(),
    details,
  };

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'a2-scriptwriting-report.json'), JSON.stringify(report, null, 2), 'utf-8');

  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const sampleArg = process.argv.find((a) => a.startsWith('--sample='));
  const sample = sampleArg ? parseInt(sampleArg.split('=')[1], 10) : undefined;
  runA2Benchmark({ sample }).then((r) => {
    console.log(`Tier A2 Finished. KPIs Passed: ${r.kpis_passed ? '✅ YES' : '❌ NO'}`);
  });
}
