/**
 * Standalone Stage 1 Pure TS Historical NER Evaluator Runner
 * Evaluates Stage 1 Candidate Extractor independently from LLM
 * Target KPIs: Boundary Span F1 >= 95%, Historical OOV Recall >= 90%, Latency < 10ms
 */

import fs from 'fs';
import path from 'path';
import { GoldenTripleBenchmarkItem, HISTORICAL_PERSON_DICTIONARY, HISTORICAL_LOCATION_DICTIONARY } from '@chronoviet/shared-spec';
import { extractHistoricalCandidateSpans } from '../src/text/vietnamese-ner.js';
import {
  computeBoundarySpanMetrics,
  computeTypeConfusionMatrix,
  BoundarySpanMetrics,
  TypeConfusionMatrix,
} from './metrics.js';
import { findMonorepoRoot } from '../src/utils/path-utils.js';

export function loadGoldenTriplesBenchmark(): GoldenTripleBenchmarkItem[] {
  const filePath = path.resolve(__dirname, 'datasets', 'golden-triples-benchmark.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Golden triples benchmark dataset missing at: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export async function runNerEval() {
  console.log('===============================================================');
  console.log(' CHRONOVIET STAGE 1 PURE TS HISTORICAL NER EVALUATION RUNNER');
  console.log('===============================================================\n');

  const dataset = loadGoldenTriplesBenchmark();
  console.log(`[*] Loaded ${dataset.length} golden benchmark snippets for Stage 1 NER Evaluation...`);

  // Build dictionary ID set for OOV evaluation
  const knownDictIds = new Set<string>();
  for (const p of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    knownDictIds.add(p.entityId.toLowerCase());
  }
  for (const l of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    knownDictIds.add(l.entityId.toLowerCase());
  }

  let totalGtEntities = 0;
  let totalExtractedSpans = 0;
  let totalExactMatches = 0;
  let totalPartialMatches = 0;
  let totalOov = 0;
  let totalOovRetrieved = 0;
  const evaluatedTypePairs: Array<{ groundTruthType: string; predictedType: string }> = [];
  const failures: string[] = [];

  const startTime = performance.now();

  for (const snippet of dataset) {
    const text = snippet.sourceText;
    const t0 = performance.now();
    const candidateSpans = extractHistoricalCandidateSpans(text);
    const latency = performance.now() - t0;

    const metrics = computeBoundarySpanMetrics(
      candidateSpans,
      snippet.groundTruthEntities,
      knownDictIds,
      latency
    );

    totalGtEntities += snippet.groundTruthEntities.length;
    totalExtractedSpans += candidateSpans.length;
    totalExactMatches += metrics.exactMatches;
    totalPartialMatches += metrics.partialMatches;
    totalOov += metrics.oovTotal;
    totalOovRetrieved += metrics.oovRetrieved;

    // Type classification matching
    for (const gt of snippet.groundTruthEntities) {
      const match = candidateSpans.find(
        (c) =>
          (gt.startOffset !== undefined && c.startOffset === gt.startOffset) ||
          c.text.toLowerCase() === gt.name.toLowerCase()
      );
      if (match) {
        evaluatedTypePairs.push({
          groundTruthType: gt.type,
          predictedType: match.type,
        });
      } else {
        failures.push(`Snippet ${snippet.id}: Missed entity "${gt.name}" (${gt.type}) in "${text}"`);
      }
    }
  }

  const totalTimeMs = performance.now() - startTime;
  const avgLatencyMs = totalTimeMs / dataset.length;
  const throughputSentencesPerSec = Number(((dataset.length / totalTimeMs) * 1000).toFixed(1));

  const precision = totalExtractedSpans > 0 ? (totalExactMatches / totalExtractedSpans) * 100 : 100;
  const recall = totalGtEntities > 0 ? (totalExactMatches / totalGtEntities) * 100 : 100;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const oovRecall = totalOov > 0 ? (totalOovRetrieved / totalOov) * 100 : 100;

  const confusionMatrix: TypeConfusionMatrix = computeTypeConfusionMatrix(evaluatedTypePairs);

  const spanF1Passed = f1 >= 95.0;
  const oovPassed = oovRecall >= 90.0;
  const latencyPassed = avgLatencyMs < 10.0;
  const overallPassed = spanF1Passed && oovPassed && latencyPassed;

  console.log('───────────────────────────────────────────────────────────────');
  console.log(` STAGE 1 NER KPI RESULTS: [${overallPassed ? 'PASS ✅' : 'FAIL ❌'}]`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(` • Boundary Span F1:       ${f1.toFixed(2)}% (Precision: ${precision.toFixed(1)}%, Recall: ${recall.toFixed(1)}%) | Target: >= 95.0% | ${spanF1Passed ? '✅' : '❌'}`);
  console.log(` • Historical OOV Recall:  ${oovRecall.toFixed(2)}% (${totalOovRetrieved}/${totalOov}) | Target: >= 90.0% | ${oovPassed ? '✅' : '❌'}`);
  console.log(` • Type Accuracy:          ${confusionMatrix.accuracy}% (${confusionMatrix.correctClassified}/${confusionMatrix.totalEvaluated})`);
  console.log(` • Average Latency:        ${avgLatencyMs.toFixed(3)} ms/sentence | Target: < 10.0 ms | ${latencyPassed ? '✅' : '❌'}`);
  console.log(` • Extraction Throughput:  ${throughputSentencesPerSec} sentences/sec`);
  console.log('───────────────────────────────────────────────────────────────\n');

  if (failures.length > 0) {
    console.log(`[!] Missed Entity Spans (${failures.length}):`);
    for (const f of failures.slice(0, 10)) {
      console.log(`    - ${f}`);
    }
    if (failures.length > 10) {
      console.log(`    ... and ${failures.length - 10} more`);
    }
    console.log('');
  }

  // Save report
  const monorepoRoot = findMonorepoRoot();
  const reportsDir = path.resolve(monorepoRoot, 'packages', 'data-ingestion', 'eval', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    engine: 'Pure TypeScript Vietnamese Historical NER',
    totalSnippets: dataset.length,
    totalGroundTruthEntities: totalGtEntities,
    totalExtractedSpans,
    exactMatches: totalExactMatches,
    partialMatches: totalPartialMatches,
    metrics: {
      precision: Number(precision.toFixed(2)),
      recall: Number(recall.toFixed(2)),
      f1: Number(f1.toFixed(2)),
      oovRecall: Number(oovRecall.toFixed(2)),
      avgLatencyMs: Number(avgLatencyMs.toFixed(3)),
      throughputSentencesPerSec,
      typeAccuracy: confusionMatrix.accuracy,
    },
    confusionMatrix: confusionMatrix.matrix,
    failures,
    overallPassed,
  };

  const reportPath = path.join(reportsDir, 'stage1-ner-eval-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`[+] Stage 1 NER Evaluation Report saved to: file:///${reportPath.replace(/\\/g, '/')}\n`);

  return report;
}

// CLI entry point
if (
  process.argv[1] &&
  (process.argv[1].endsWith('ner-runner.ts') || process.argv[1].endsWith('ner-runner.js'))
) {
  runNerEval()
    .then((report) => {
      if (!report.overallPassed) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[!] Stage 1 NER Runner Fatal Error:', err);
      process.exit(1);
    });
}
