/**
 * Standalone Stage 2 Knowledge Graph Triples Extraction Evaluator Runner
 * Evaluates Stage 2 Triples Extraction on the Golden Triples Benchmark
 * Target KPIs: Strict Triple F1 >= 90%, Directional Accuracy >= 95%, Hallucination Rate < 2.0%
 */

import fs from 'fs';
import path from 'path';
import { GoldenTripleBenchmarkItem } from '@chronoviet/shared-spec';
import { isLLMServiceHealthy } from '@chronoviet/infra';
import { extractTriplesFromTextAsync, ExtractedTriple } from '../src/triple-extractor.js';
import { computeStrictTripleMetrics, StrictTripleMetrics } from './metrics.js';
import { findMonorepoRoot } from '../src/utils/path-utils.js';
import { loadGoldenTriplesBenchmark } from './ner-runner.js';

process.env.EVAL_STRICT = 'true';

export async function runTriplesEval() {
  console.log('===============================================================');
  console.log(' CHRONOVIET STAGE 2 KNOWLEDGE GRAPH TRIPLES EVALUATION RUNNER');
  console.log('===============================================================\n');

  const args = process.argv.slice(2);
  const allowFallback = args.includes('--allow-fallback') || args.includes('--fallback') || args.includes('--fast') || process.env.ALLOW_FALLBACK === 'true';

  // Pre-flight check: Strict Extraction LLM requirement
  const llmHealth = await isLLMServiceHealthy({ task: 'extraction' });
  if (!llmHealth.healthy) {
    if (!allowFallback) {
      console.error('================================================================');
      console.error(' [!] FATAL PRE-FLIGHT ERROR: Extraction LLM Server is OFFLINE');
      console.error('================================================================');
      console.error(' Stage 2 Knowledge Graph Triples Evaluation requires active Qwen-4B Extraction LLM.');
      console.error(` Details: ${llmHealth.details || 'Port 8094 unreachable'}`);
      console.error(' Heuristic rule-based fallback is disabled in STRICT evaluation mode.\n');
      console.error(' 👉 Action required: Start local Extraction Server with:');
      console.error('    pnpm ai:extract   (or: pnpm ai:lite)');
      console.error('    Or pass --allow-fallback to test with rule-based fallback.\n');
      console.error('================================================================\n');
      throw new Error(`[STRICT_EVAL] Extraction LLM is offline (${llmHealth.details}). Run \`pnpm ai:extract\` first or pass --allow-fallback.`);
    } else {
      console.warn(' [!] WARNING: Extraction LLM is offline; running with rule-based fallback as permitted by --allow-fallback\n');
    }
  }

  const dataset = loadGoldenTriplesBenchmark();
  console.log(`[*] Loaded ${dataset.length} golden benchmark snippets for Stage 2 Triples Evaluation...`);
  console.log(`[*] Extraction Engine: ${llmHealth.healthy ? llmHealth.provider : 'Rule-Based Candidate Extractor (Fallback)'}\n`);

  let totalGtTriples = 0;
  let totalExtractedTriples = 0;
  let totalTruePositives = 0;
  let totalDirectionalCorrect = 0;
  let totalDirectionalInverted = 0;
  let totalHallucinated = 0;
  const snippetDiagnostics: Array<{
    id: string;
    metrics: StrictTripleMetrics;
    gtTriples: any[];
    extractedTriples: any[];
  }> = [];

  const startTime = performance.now();

  const isLlmOffline = !llmHealth.healthy;
  const concurrency = isLlmOffline ? 16 : 6;
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < dataset.length) {
      const idx = nextIdx++;
      const snippet = dataset[idx];
      const text = snippet.sourceText;
      const extracted = await extractTriplesFromTextAsync(text, {
        allowFallback,
        strict: !allowFallback,
        regexOnly: isLlmOffline && allowFallback,
        chunkId: snippet.id,
      });

      const candidateTriples = extracted.map((t: ExtractedTriple) => ({
        sourceEntityId: t.sourceEntityId,
        relationType: t.relationType,
        targetEntityId: t.targetEntityId,
        confidence: t.confidence,
      }));

      const validEntityIdsInSnippet = new Set(
        snippet.groundTruthEntities.map((e) => e.id.toLowerCase())
      );

      const metrics = computeStrictTripleMetrics(
        candidateTriples,
        snippet.groundTruthTriples,
        validEntityIdsInSnippet
      );

      snippetDiagnostics[idx] = {
        id: snippet.id,
        metrics,
        gtTriples: snippet.groundTruthTriples,
        extractedTriples: candidateTriples,
      };
    }
  }

  const workerCount = Math.min(concurrency, dataset.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  for (const item of snippetDiagnostics) {
    if (!item) continue;
    totalGtTriples += item.gtTriples.length;
    totalExtractedTriples += item.extractedTriples.length;
    totalTruePositives += item.metrics.truePositives;
    totalDirectionalCorrect += item.metrics.directionalCorrect;
    totalDirectionalInverted += item.metrics.directionalInverted;
    totalHallucinated += item.metrics.hallucinatedCount;
  }

  const totalTimeMs = performance.now() - startTime;
  const avgLatencyMs = totalTimeMs / dataset.length;

  const precision = totalExtractedTriples > 0 ? (totalTruePositives / totalExtractedTriples) * 100 : 100;
  const recall = totalGtTriples > 0 ? (totalTruePositives / totalGtTriples) * 100 : 100;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const totalDirectional = totalDirectionalCorrect + totalDirectionalInverted;
  const directionalAccuracy = totalDirectional > 0 ? (totalDirectionalCorrect / totalDirectional) * 100 : 100;
  const hallucinationRate = totalExtractedTriples > 0 ? (totalHallucinated / totalExtractedTriples) * 100 : 0;

  const f1Passed = f1 >= 90.0;
  const directionalPassed = directionalAccuracy >= 95.0;
  const hallucinationPassed = hallucinationRate < 2.0;
  const overallPassed = f1Passed && directionalPassed && hallucinationPassed;

  console.log('───────────────────────────────────────────────────────────────');
  console.log(` STAGE 2 TRIPLES EXTRACTION RESULTS: [${overallPassed ? 'PASS ✅' : 'FAIL ❌'}]`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(` • Strict Triple F1:       ${f1.toFixed(2)}% (Precision: ${precision.toFixed(1)}%, Recall: ${recall.toFixed(1)}%) | Target: >= 90.0% | ${f1Passed ? '✅' : '❌'}`);
  console.log(` • Directional Accuracy:   ${directionalAccuracy.toFixed(2)}% (${totalDirectionalCorrect}/${totalDirectional}) | Target: >= 95.0% | ${directionalPassed ? '✅' : '❌'}`);
  console.log(` • Hallucination Rate:     ${hallucinationRate.toFixed(2)}% (${totalHallucinated}/${totalExtractedTriples}) | Target: < 2.0% | ${hallucinationPassed ? '✅' : '❌'}`);
  console.log(` • Average Latency:        ${avgLatencyMs.toFixed(2)} ms/snippet`);
  console.log('───────────────────────────────────────────────────────────────\n');

  // Save report
  const monorepoRoot = findMonorepoRoot();
  const reportsDir = path.resolve(monorepoRoot, 'packages', 'data-ingestion', 'eval', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    engine: 'Stage 2 Knowledge Graph Triple Extractor',
    totalSnippets: dataset.length,
    totalGroundTruthTriples: totalGtTriples,
    totalExtractedTriples,
    truePositives: totalTruePositives,
    metrics: {
      precision: Number(precision.toFixed(2)),
      recall: Number(recall.toFixed(2)),
      f1: Number(f1.toFixed(2)),
      directionalAccuracy: Number(directionalAccuracy.toFixed(2)),
      hallucinationRate: Number(hallucinationRate.toFixed(2)),
      avgLatencyMs: Number(avgLatencyMs.toFixed(2)),
    },
    snippetDiagnostics,
    overallPassed,
  };

  const reportPath = path.join(reportsDir, 'stage2-triples-eval-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`[+] Stage 2 Triples Evaluation Report saved to: file:///${reportPath.replace(/\\/g, '/')}\n`);

  return report;
}

// CLI entry point
if (
  process.argv[1] &&
  (process.argv[1].endsWith('triples-runner.ts') || process.argv[1].endsWith('triples-runner.js'))
) {
  runTriplesEval()
    .then((report) => {
      if (!report.overallPassed) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[!] Stage 2 Triples Runner Fatal Error:', err);
      process.exit(1);
    });
}
