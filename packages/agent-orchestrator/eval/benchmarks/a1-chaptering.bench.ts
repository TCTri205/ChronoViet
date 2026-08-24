/**
 * Tier A1 Benchmark: Chaptering & Outline Budgeting
 * Benchmarks: chaptering-node.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ComponentBenchmarkReport } from '@chronoviet/shared-spec';
import { chapteringNode } from '../../src/graph/nodes/chaptering-node.js';
import { ChronoGraphState } from '../../src/graph/state.js';
import {
  calculateBudgetPacingMetrics,
  calculateChronologicalFlowScore,
  HighResolutionLatencyProfiler,
} from '../metrics/index.js';
import { HistoricalTopicItem } from '../datasets/builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runA1Benchmark(options: { sample?: number; fresh?: boolean } = {}): Promise<ComponentBenchmarkReport> {
  const profiler = new HighResolutionLatencyProfiler();
  const datasetPath = path.resolve(__dirname, '../datasets/orchestrator-historical-topics-50.json');
  let rawData: HistoricalTopicItem[] = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

  if (options.sample && options.sample > 0) {
    rawData = rawData.slice(0, options.sample);
  }

  let totalKendallTau = 0;
  let totalBudgetError = 0;
  let validChapterPlansCount = 0;
  const details: any[] = [];

  for (const item of rawData) {
    const mockState: any = {
      projectId: item.id,
      userPrompt: item.topic,
      targetDurationMinutes: item.targetDurationMinutes,
      videoType: item.videoType,
      templateId: item.templateId,
      status: 'INIT',
      currentStep: 1,
      chapters: [],
      currentChapterIndex: 0,
      runningNarrativeState: {
        previousChapterSummary: '',
        establishedTone: 'Hào hùng',
        introducedEntities: [],
        transitionHook: '',
      },
      chapterScripts: {},
      factCheckLogs: [],
      scenes: [],
      audioAssets: [],
    };

    const stopTimer = profiler.startTimer();
    const result = await chapteringNode(mockState);
    stopTimer();

    const producedChapters = result.chapters || [];
    const hasValidChapters = producedChapters.length > 0;
    if (hasValidChapters) validChapterPlansCount++;

    // 1. Evaluate Chronological Flow Score
    const actualChapters = producedChapters.map((c) => ({
      title: c.title,
      summary: c.summary || c.keyEvents?.join(', ') || '',
    }));
    const goldChapters = item.expectedChapters.map((c) => ({
      title: c.title,
      summary: c.keyPoints?.join(', ') || '',
    }));
    const flowRes = calculateChronologicalFlowScore(actualChapters, goldChapters);
    totalKendallTau += flowRes.kendallTau;

    // 2. Evaluate Budgeting Allocation Error
    const budgetRes = calculateBudgetPacingMetrics(
      item.targetDurationMinutes * 60,
      producedChapters.map((c) => ({
        index: c.chapterIndex,
        title: c.title,
        targetSeconds: c.targetDurationSeconds,
        plannedSeconds: c.targetDurationSeconds,
      }))
    );
    totalBudgetError += budgetRes.totalPacingErrorPercentage;

    details.push({
      id: item.id,
      topic: item.topic,
      targetMinutes: item.targetDurationMinutes,
      chaptersCount: producedChapters.length,
      kendallTau: flowRes.kendallTau,
      budgetErrorPercentage: budgetRes.totalPacingErrorPercentage,
      passed: flowRes.isMonotonic && budgetRes.isPassingPacingKpi,
    });
  }

  const avgKendallTau = totalKendallTau / rawData.length;
  const avgBudgetError = totalBudgetError / rawData.length;
  const chronologicalScore = (((avgKendallTau + 1) / 2) * 100);
  const chapterPlanValidityRate = (validChapterPlansCount / rawData.length) * 100;

  const kpis_passed = chronologicalScore >= 90.0 && avgBudgetError < 5.0 && chapterPlanValidityRate >= 95.0;

  const report: ComponentBenchmarkReport = {
    benchmark_id: 'TIER_A1_CHAPTERING_BUDGETING',
    name: 'Tier A1: Chaptering & Outline Budgeting Benchmark',
    timestamp: new Date().toISOString(),
    total_evaluated: rawData.length,
    metrics: {
      chronological_flow_score: Number(chronologicalScore.toFixed(2)),
      avg_kendall_tau: Number(avgKendallTau.toFixed(4)),
      avg_budget_error_percentage: Number(avgBudgetError.toFixed(2)),
      chapter_plan_validity_rate: Number(chapterPlanValidityRate.toFixed(2)),
      kpi_chronological_flow_pass: chronologicalScore >= 90.0,
      kpi_budget_error_pass: avgBudgetError < 5.0,
    },
    kpis_passed,
    latency_summary: profiler.getSummary(),
    details,
  };

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'a1-chaptering-report.json'), JSON.stringify(report, null, 2), 'utf-8');

  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const sampleArg = process.argv.find((a) => a.startsWith('--sample='));
  const sample = sampleArg ? parseInt(sampleArg.split('=')[1], 10) : undefined;
  runA1Benchmark({ sample }).then((r) => {
    console.log(`Tier A1 Finished. KPIs Passed: ${r.kpis_passed ? '✅ YES' : '❌ NO'}`);
  });
}
