/**
 * VLM Inspector Real Evaluation Benchmark Runner
 * Measures Noise Free Rate, Context Match Rate, and License Compliance on 200 Historical Image Cases
 */

import * as fs from 'fs';
import * as path from 'path';
import { scoreImageWithGemini } from '../src/vlm-scorer.js';
import { inspectSceneVisuals } from '../src/inspector-pipeline.js';
import { SceneGeneration, VisualCandidate } from '@chronoviet/shared-spec';
import { assertEvalPreflight } from '../../../eval/utils/preflight.js';

interface BenchmarkItem {
  id: string;
  topic: string;
  eventDescription: string;
  candidate: {
    candidateId: string;
    imageUrl: string;
    title: string;
    author: string;
    license: string;
  };
  expectedLicenseValid: boolean;
  expectedNoiseFree: boolean;
  expectedContextMatch: boolean;
}

function load200BenchmarkCases(): BenchmarkItem[] {
  const datasetFile = path.join(__dirname, 'datasets/vlm_200_images.json');
  if (!fs.existsSync(datasetFile)) {
    throw new Error(`Dataset file not found: ${datasetFile}`);
  }
  const items: BenchmarkItem[] = JSON.parse(fs.readFileSync(datasetFile, 'utf-8'));
  return items;
}

async function runVlmEvaluation() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║               CHRONOVIET VLM INSPECTOR REAL EVALUATION                   ║');
  console.log('║           Target: 200 Historical Image Candidate Test Cases              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  const dataset = load200BenchmarkCases();
  const preflight = await assertEvalPreflight(['vlm']);
  console.log(`[INFO] Loaded ${dataset.length} test cases for evaluation.\n`);

  let totalEvaluated = 0;
  let correctLicenseDecisions = 0;
  let correctNoiseDetections = 0;
  let correctContextMatches = 0;
  let pureCodeFallbacksCount = 0;

  const results: any[] = [];
  const startTime = Date.now();

  for (const item of dataset) {
    totalEvaluated++;

    // 1. License Check
    const isLicenseValid = isWhitelistedLicense(item.candidate.license);
    if (isLicenseValid === item.expectedLicenseValid) {
      correctLicenseDecisions++;
    }

    const realSha256 = crypto
      .createHash('sha256')
      .update(`${item.candidate.imageUrl}:${item.candidate.title}:${item.candidate.author}`)
      .digest('hex');

    // 2. Score with Scorer (Dual Cache / Gemini / Local CLIP)
    const scoreResult = await scoreImageWithGemini(
      item.candidate.imageUrl,
      item.eventDescription,
      {
        sha256: realSha256,
        metadata: {
          title: item.candidate.title,
          author: item.candidate.author,
          license: item.candidate.license,
        },
      }
    );

    // Noise evaluation
    const detectedNoiseFree = scoreResult.visualNoiseScore >= 20;
    if (detectedNoiseFree === item.expectedNoiseFree) {
      correctNoiseDetections++;
    }

    // Context match evaluation
    const detectedContextMatch = scoreResult.historicalContextScore >= 20;
    if (detectedContextMatch === item.expectedContextMatch) {
      correctContextMatches++;
    }

    if (!scoreResult.passed || !isLicenseValid) {
      pureCodeFallbacksCount++;
    }

    results.push({
      id: item.id,
      topic: item.topic,
      license: item.candidate.license,
      isLicenseWhitelisted: isLicenseValid,
      score: scoreResult.totalScore,
      passed: scoreResult.passed && isLicenseValid,
      scorerType: scoreResult.scorerType,
    });
  }

  const durationMs = Date.now() - startTime;

  // Calculate KPIs
  const licenseComplianceRate = (correctLicenseDecisions / totalEvaluated) * 100;
  const noiseFreeRate = (correctNoiseDetections / totalEvaluated) * 100;
  const contextMatchRate = (correctContextMatches / totalEvaluated) * 100;

  const licensePass = licenseComplianceRate >= 100;
  const noisePass = noiseFreeRate >= 95;
  const contextPass = contextMatchRate >= 90;
  const allKpisPassed = licensePass && noisePass && contextPass;

  console.log('┌──────────────────────────────────────────────────────────────────────────┐');
  console.log('│                       VLM EVALUATION METRICS SUMMARY                     │');
  console.log('├─────────────────────────────┬───────────┬────────────┬───────────────────┤');
  console.log('│ Metric Name                 │ Target    │ Actual     │ Verdict           │');
  console.log('├─────────────────────────────┼───────────┼────────────┼───────────────────┤');
  console.log(`│ License Compliance Rate     │ 100.0%    │ ${licenseComplianceRate.toFixed(1).padStart(8)}%  │ ${licensePass ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log(`│ Noise Free Rate             │ >= 95.0%  │ ${noiseFreeRate.toFixed(1).padStart(8)}%  │ ${noisePass ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log(`│ Historical Context Match    │ >= 90.0%  │ ${contextMatchRate.toFixed(1).padStart(8)}%  │ ${contextPass ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log('├─────────────────────────────┴───────────┴────────────┴───────────────────┤');
  console.log(`│ Total Evaluated: ${String(totalEvaluated).padStart(4)} cases | Duration: ${String(durationMs).padStart(5)}ms | Pure Code: ${pureCodeFallbacksCount} cases   │`);
  console.log(`│ Overall Status:  ${allKpisPassed ? '✅ ALL KPIS PASSED (PASS)' : '❌ BENCHMARK FAILED'}                              │`);
  console.log('└──────────────────────────────────────────────────────────────────────────┘\n');

  // Save report
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Aggregate scorer provenance
  const scorerCounts: Record<string, number> = {};
  for (const r of results) {
    const key = r.scorerType || 'UNKNOWN';
    scorerCounts[key] = (scorerCounts[key] || 0) + 1;
  }

  const reportFile = path.join(reportsDir, 'vlm-eval-report.json');
  const reportPayload = {
    benchmark_id: 'VLM_INSPECTOR_BENCHMARK_200',
    timestamp: new Date().toISOString(),
    totalEvaluated,
    durationMs,
    preflight,
    metrics: {
      licenseComplianceRate,
      noiseFreeRate,
      contextMatchRate,
      pureCodeFallbacksCount,
    },
    kpis: {
      licensePass,
      noisePass,
      contextPass,
      allKpisPassed,
    },
    scorerType: scorerCounts,
    results: results.slice(0, 20), // sample 20 for preview
  };

  fs.writeFileSync(reportFile, JSON.stringify(reportPayload, null, 2), 'utf-8');
  console.log(`[REPORT] Evaluation report written to: ${reportFile}\n`);

  if (!allKpisPassed) {
    process.exit(1);
  }
}

runVlmEvaluation().catch((err) => {
  console.error('[ERROR] VLM evaluation runner crashed:', err);
  process.exit(1);
});
