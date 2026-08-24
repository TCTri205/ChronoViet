/**
 * Tier A4 Benchmark: Scene Segmentation & Visual Direction
 * Benchmarks: segmenter-node.ts, keyword-node.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ComponentBenchmarkReport } from '@chronoviet/shared-spec';
import { segmenterNode } from '../../src/graph/nodes/segmenter-node.js';
import { keywordNode, extractSearchKeywordsFromText } from '../../src/graph/nodes/keyword-node.js';
import { ChronoGraphState } from '../../src/graph/state.js';
import {
  evaluateSceneGranularityCompliance,
  HighResolutionLatencyProfiler,
} from '../metrics/index.js';
import { VisualDirectionItem } from '../datasets/builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runA4Benchmark(options: { sample?: number; fresh?: boolean } = {}): Promise<ComponentBenchmarkReport> {
  const profiler = new HighResolutionLatencyProfiler();
  const datasetPath = path.resolve(__dirname, '../datasets/orchestrator-visual-direction-50.json');
  let rawData: VisualDirectionItem[] = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

  if (options.sample && options.sample > 0) {
    rawData = rawData.slice(0, options.sample);
  }

  let totalGranularityCompliance = 0;
  let totalVisualTypeDiversity = 0;
  let keywordRelevanceCount = 0;
  const details: any[] = [];

  for (const item of rawData) {
    const mockState: any = {
      projectId: item.id,
      userPrompt: item.topic,
      targetDurationMinutes: 2,
      videoType: 'BATTLE',
      templateId: 'HISTORICAL_DOCUMENTARY',
      status: 'CHAPTER_FACT_CHECKED',
      currentStep: 4,
      chapters: [
        {
          chapterIndex: 0,
          title: item.topic,
          summary: item.voiceoverText,
          targetDurationSeconds: 120,
          keyEvents: [],
          introducedEntities: [item.topic],
          transitionHook: '',
          establishedTone: 'Hào hùng',
        },
      ],
      currentChapterIndex: 0,
      runningNarrativeState: {
        previousChapterSummary: '',
        establishedTone: 'Hào hùng',
        introducedEntities: [],
        transitionHook: '',
      },
      chapterScripts: {
        '0': item.voiceoverText,
      },
      factCheckLogs: [],
      scenes: [],
      audioAssets: [],
    };

    const stopTimer = profiler.startTimer();
    const segmentResult = await segmenterNode(mockState);
    const mockWithScenes: ChronoGraphState = {
      ...mockState,
      scenes: segmentResult.scenes || [],
    };
    const keywordResult = await keywordNode(mockWithScenes);
    stopTimer();

    const scenes = keywordResult.scenes || segmentResult.scenes || [];

    // 1. Evaluate granularity compliance
    const granularity = evaluateSceneGranularityCompliance(
      scenes.map((s) => ({ id: s.sceneId, durationSeconds: s.targetDurationSeconds })),
      3.0,
      25.0
    );
    totalGranularityCompliance += granularity.complianceRatePercentage;

    // 2. Evaluate visual layout diversity
    const distinctLayouts = new Set(scenes.map((s) => s.layoutMode));
    const diversityRatio = scenes.length > 0 ? (distinctLayouts.size / scenes.length) * 100 : 0;
    totalVisualTypeDiversity += diversityRatio;

    // 3. Keyword extraction relevance
    const kw = extractSearchKeywordsFromText(item.voiceoverText, [item.topic], item.topic);
    if (kw.length >= 2) {
      keywordRelevanceCount++;
    }

    details.push({
      id: item.id,
      topic: item.topic,
      scenesCount: scenes.length,
      granularityCompliance: granularity.complianceRatePercentage,
      layoutsCount: distinctLayouts.size,
    });
  }

  const avgGranularityCompliance = totalGranularityCompliance / rawData.length;
  const avgDiversity = totalVisualTypeDiversity / rawData.length;
  const keywordRelevanceRate = (keywordRelevanceCount / rawData.length) * 100;

  const kpis_passed =
    avgGranularityCompliance >= 90.0 &&
    keywordRelevanceRate >= 90.0;

  const report: ComponentBenchmarkReport = {
    benchmark_id: 'TIER_A4_SCENE_DIRECTION',
    name: 'Tier A4: Scene Segmentation & Visual Direction Benchmark',
    timestamp: new Date().toISOString(),
    total_evaluated: rawData.length,
    metrics: {
      avg_granularity_compliance_rate: Number(avgGranularityCompliance.toFixed(2)),
      avg_layout_diversity_ratio: Number(avgDiversity.toFixed(2)),
      keyword_relevance_rate: Number(keywordRelevanceRate.toFixed(2)),
      kpi_granularity_pass: avgGranularityCompliance >= 90.0,
      kpi_keyword_relevance_pass: keywordRelevanceRate >= 90.0,
    },
    kpis_passed,
    latency_summary: profiler.getSummary(),
    details,
  };

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'a4-scene-direction-report.json'), JSON.stringify(report, null, 2), 'utf-8');

  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const sampleArg = process.argv.find((a) => a.startsWith('--sample='));
  const sample = sampleArg ? parseInt(sampleArg.split('=')[1], 10) : undefined;
  runA4Benchmark({ sample }).then((r) => {
    console.log(`Tier A4 Finished. KPIs Passed: ${r.kpis_passed ? '✅ YES' : '❌ NO'}`);
  });
}
