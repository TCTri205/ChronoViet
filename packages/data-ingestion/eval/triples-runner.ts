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
import { extractHistoricalCandidateSpans } from '../src/text/vietnamese-ner.js';
import { computeStrictTripleMetrics, StrictTripleMetrics, computeGraphTransitiveClosure } from './metrics.js';
import { findMonorepoRoot } from '../src/utils/path-utils.js';
import { loadGoldenTriplesBenchmark } from './ner-runner.js';

process.env.EVAL_STRICT = 'true';

export async function runTriplesEval() {
  const monorepoRoot = findMonorepoRoot();
  const reportsDir = path.resolve(monorepoRoot, 'packages', 'data-ingestion', 'eval', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const logFilePath = path.join(reportsDir, 'stage2-triples-eval.log');
  const jsonlFilePath = path.join(reportsDir, 'stage2-triples-eval.jsonl');
  const logStream = fs.createWriteStream(logFilePath, { flags: 'w' });
  const jsonlStream = fs.createWriteStream(jsonlFilePath, { flags: 'w' });

  const isVerbose = process.env.VERBOSE === 'true' || process.argv.includes('--verbose') || process.argv.includes('-v');

  function logLine(msg: string = '') {
    console.log(msg);
    logStream.write(msg + '\n');
  }

  function logBlock(block: string) {
    console.log(block);
    logStream.write(block + '\n');
  }

  logLine('===============================================================');
  logLine(' CHRONOVIET STAGE 2 KNOWLEDGE GRAPH TRIPLES EVALUATION RUNNER');
  logLine('===============================================================\n');

  // Pre-flight check: Strict Extraction LLM requirement (100% AI Evaluation, Zero Fallback)
  const llmHealth = await isLLMServiceHealthy({ task: 'extraction' });
  if (!llmHealth.healthy) {
    logLine('================================================================');
    logLine(' [!] FATAL PRE-FLIGHT ERROR: Extraction LLM Server is OFFLINE');
    logLine('================================================================');
    logLine(' Stage 2 Knowledge Graph Triples Evaluation strictly requires active Qwen-4B Extraction LLM.');
    logLine(` Details: ${llmHealth.details || 'Port 8094 unreachable'}`);
    logLine(' Fallback is permanently disabled in evaluation mode to guarantee production rigor.\n');
    logLine(' 👉 Action required: Start local Extraction Server with:');
    logLine('    pnpm ai:extract   (or: pnpm ai:lite)\n');
    logLine('================================================================\n');
    throw new Error(`[STRICT_AI_EVAL] Extraction LLM is offline (${llmHealth.details}). Run \`pnpm ai:extract\` first.`);
  }

  const dataset = loadGoldenTriplesBenchmark();
  logLine(`[*] Loaded ${dataset.length} golden benchmark snippets for Stage 2 Triples Evaluation...`);
  logLine(`[*] Extraction Engine: STRICT AI MODEL (${llmHealth.provider}) [qwen3.5-4b-instruct-q4_k_m]`);
  logLine(`[*] Observability: JSONL stream -> ${jsonlFilePath} | Verbose: ${isVerbose ? 'ON' : 'OFF'}\n`);

  let totalGtTriples = 0;
  let totalExtractedTriples = 0;
  let totalTruePositives = 0;
  let totalDirectionalCorrect = 0;
  let totalDirectionalInverted = 0;
  let totalHallucinated = 0;
  const snippetDiagnostics: Array<{
    id: string;
    correlationId: string;
    metrics: StrictTripleMetrics;
    gtTriples: any[];
    extractedTriples: any[];
    latencyMs: number;
    missingGt: Array<{ s: string; r: string; o: string }>;
    hallucinated: Array<{ s: string; r: string; o: string }>;
    meta?: {
      llmError?: string;
      strategy?: string;
      provider?: string;
      model?: string;
      cached?: boolean;
    };
  }> = [];

  const snippetLatencies: number[] = [];
  let completedCount = 0;
  let runningTp = 0;
  let runningGt = 0;
  let runningExtracted = 0;

  const startTime = performance.now();

  const concurrency = 2;
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < dataset.length) {
      const idx = nextIdx++;
      const snippet = dataset[idx];
      const text = snippet.sourceText;
      const correlationId = `eval_triple_${snippet.id}_${Date.now()}`;
      const t0 = performance.now();
      const extracted = await extractTriplesFromTextAsync(text, {
        strict: true,
        allowFallback: false,
        regexOnly: false,
        chunkId: snippet.id,
        correlationId,
        skipCache: true,
      });
      const snippetLatency = performance.now() - t0;
      snippetLatencies.push(snippetLatency);

      const meta = (extracted as any)?._meta;

      const candidateTriples = extracted.map((t: ExtractedTriple) => ({
        sourceEntityId: t.sourceEntityId,
        relationType: t.relationType,
        targetEntityId: t.targetEntityId,
        confidence: t.confidence,
      }));

      const validEntityIdsInSnippet = new Set<string>();
      for (const e of snippet.groundTruthEntities) {
        validEntityIdsInSnippet.add(e.id.trim().toLowerCase());
        if (e.canonicalId) validEntityIdsInSnippet.add(e.canonicalId.trim().toLowerCase());
      }
      for (const gt of snippet.groundTruthTriples) {
        if (gt.sourceEntityId) validEntityIdsInSnippet.add(gt.sourceEntityId.trim().toLowerCase());
        if (gt.targetEntityId) validEntityIdsInSnippet.add(gt.targetEntityId.trim().toLowerCase());
      }
      const rawCandidateSpans = extractHistoricalCandidateSpans(text);
      for (const cs of rawCandidateSpans) {
        if (cs.suggestedCanonicalId) validEntityIdsInSnippet.add(cs.suggestedCanonicalId.trim().toLowerCase());
      }

      const metrics = computeStrictTripleMetrics(
        candidateTriples,
        snippet.groundTruthTriples,
        validEntityIdsInSnippet
      );

      // Find missing GT and hallucinated triples for inline root-cause diffs
      const normKey = (s: string, r: string, o: string) => `${s.trim().toLowerCase()}::${r.trim().toUpperCase()}::${o.trim().toLowerCase()}`;
      const predClosure = computeGraphTransitiveClosure(candidateTriples);
      const missingGt = snippet.groundTruthTriples
        .filter(gt => !predClosure.has(normKey(gt.sourceEntityId, gt.relationType, gt.targetEntityId)))
        .map(gt => ({ s: gt.sourceEntityId, r: gt.relationType, o: gt.targetEntityId }));

      const hallucinated = candidateTriples
        .filter(ct => {
          const sValid = validEntityIdsInSnippet.has(ct.sourceEntityId.trim().toLowerCase());
          const oValid = validEntityIdsInSnippet.has(ct.targetEntityId.trim().toLowerCase());
          return !sValid || !oValid;
        })
        .map(ct => ({ s: ct.sourceEntityId, r: ct.relationType, o: ct.targetEntityId }));

      const diagnosticItem = {
        id: snippet.id,
        correlationId,
        metrics,
        gtTriples: snippet.groundTruthTriples,
        extractedTriples: candidateTriples,
        latencyMs: Number(snippetLatency.toFixed(1)),
        missingGt,
        hallucinated,
        meta: {
          llmError: meta?.llmError,
          strategy: meta?.strategy,
          provider: meta?.provider,
          model: meta?.model,
          cached: meta?.cached ?? false,
        },
      };

      snippetDiagnostics[idx] = diagnosticItem;

      // Real-time incremental JSONL persist (guarantees zero data loss on unexpected abort)
      jsonlStream.write(JSON.stringify(diagnosticItem) + '\n');

      completedCount++;
      runningTp += metrics.truePositives;
      runningGt += snippet.groundTruthTriples.length;
      runningExtracted += candidateTriples.length;

      const runningPrec = runningExtracted > 0 ? (runningTp / runningExtracted) * 100 : 100;
      const runningRec = runningGt > 0 ? (runningTp / runningGt) * 100 : 100;
      const runningF1 = runningPrec + runningRec > 0 ? (2 * runningPrec * runningRec) / (runningPrec + runningRec) : 0;

      const progressPct = ((completedCount / dataset.length) * 100).toFixed(1).padStart(5, ' ');
      const countStr = `[${String(completedCount).padStart(3, ' ')}/${dataset.length}]`;
      const itemNumStr = `#${String(idx + 1).padStart(3, '0')}`;
      const isPerfect = metrics.f1 === 100 && metrics.falsePositives === 0;
      const statusIcon = isPerfect ? '✅ PASS' : (metrics.truePositives > 0 ? '⚠️ PARTIAL' : '❌ FAIL');
      const latSec = (snippetLatency / 1000).toFixed(2);

      const blockLines: string[] = [
        `${countStr} (${progressPct}%) (Item ${itemNumStr}: [${snippet.id}]) ${statusIcon} (TP: ${metrics.truePositives}/${snippet.groundTruthTriples.length}, FP: ${metrics.falsePositives}) | ${latSec}s | Running F1: ${runningF1.toFixed(1)}%`
      ];

      // Surface underlying LLM errors or unexpected fallback strategy
      if (meta?.llmError) {
        blockLines.push(`   ↳ ⚠️ LLM Error: ${meta.llmError}`);
      }
      if (meta?.strategy && meta.strategy !== 'ensemble_ai') {
        blockLines.push(`   ↳ ℹ️ Strategy: ${meta.strategy}`);
      }

      // Print concise failure root-cause diff (or full diff if verbose)
      if (!isPerfect) {
        const maxDiff = isVerbose ? missingGt.length : 2;
        if (missingGt.length > 0) {
          const missingStr = missingGt.slice(0, maxDiff).map(m => `(${m.s} -> ${m.r} -> ${m.o})`).join(', ');
          const moreStr = missingGt.length > maxDiff ? ` (+${missingGt.length - maxDiff} more)` : '';
          blockLines.push(`   ↳ 🔴 Missing GT (${missingGt.length}): ${missingStr}${moreStr}`);
        }
        if (hallucinated.length > 0) {
          const maxHal = isVerbose ? hallucinated.length : 2;
          const halStr = hallucinated.slice(0, maxHal).map(h => `(${h.s} -> ${h.r} -> ${h.o})`).join(', ');
          const moreHal = hallucinated.length > maxHal ? ` (+${hallucinated.length - maxHal} more)` : '';
          blockLines.push(`   ↳ ⚠️ Hallucinated (${hallucinated.length}): ${halStr}${moreHal}`);
        }
        if (isVerbose && snippet.sourceText) {
          const cleanSnippet = snippet.sourceText.replace(/\s+/g, ' ').trim();
          const truncated = cleanSnippet.length > 120 ? `${cleanSnippet.slice(0, 120)}...` : cleanSnippet;
          blockLines.push(`   ↳ 📝 Text: "${truncated}"`);
        }
      }

      // Atomic log block write prevents interleaved lines across concurrent workers
      logBlock(blockLines.join('\n'));
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

  // Latency quantiles
  snippetLatencies.sort((a, b) => a - b);
  const p50 = snippetLatencies[Math.floor(snippetLatencies.length * 0.50)] || 0;
  const p90 = snippetLatencies[Math.floor(snippetLatencies.length * 0.90)] || 0;
  const p95 = snippetLatencies[Math.floor(snippetLatencies.length * 0.95)] || 0;
  const p99 = snippetLatencies[Math.floor(snippetLatencies.length * 0.99)] || 0;
  const minLatency = snippetLatencies[0] || 0;
  const maxLatency = snippetLatencies[snippetLatencies.length - 1] || 0;

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

  // Error Attribution Analysis
  const epochStats = new Map<string, { total: number; passed: number; tp: number; gt: number }>();
  let totalMissingGtCount = 0;
  const missedRelationCounts = new Map<string, number>();

  for (const item of snippetDiagnostics) {
    if (!item) continue;
    const epoch = item.id.split('_').slice(0, 2).join('_');
    const prev = epochStats.get(epoch) || { total: 0, passed: 0, tp: 0, gt: 0 };
    const passed = item.metrics.f1 === 100 && item.metrics.falsePositives === 0;
    epochStats.set(epoch, {
      total: prev.total + 1,
      passed: prev.passed + (passed ? 1 : 0),
      tp: prev.tp + item.metrics.truePositives,
      gt: prev.gt + item.gtTriples.length,
    });

    totalMissingGtCount += item.missingGt.length;
    for (const m of item.missingGt) {
      missedRelationCounts.set(m.r, (missedRelationCounts.get(m.r) || 0) + 1);
    }
  }

  logLine('\n───────────────────────────────────────────────────────────────');
  logLine(` STAGE 2 TRIPLES EXTRACTION RESULTS: [${overallPassed ? 'PASS ✅' : 'FAIL ❌'}]`);
  logLine('───────────────────────────────────────────────────────────────');
  logLine(` • Strict Triple F1:       ${f1.toFixed(2)}% (Precision: ${precision.toFixed(1)}%, Recall: ${recall.toFixed(1)}%) | Target: >= 90.0% | ${f1Passed ? '✅' : '❌'}`);
  logLine(` • Directional Accuracy:   ${directionalAccuracy.toFixed(2)}% (${totalDirectionalCorrect}/${totalDirectional}) | Target: >= 95.0% | ${directionalPassed ? '✅' : '❌'}`);
  logLine(` • Hallucination Rate:     ${hallucinationRate.toFixed(2)}% (${totalHallucinated}/${totalExtractedTriples}) | Target: < 2.0% | ${hallucinationPassed ? '✅' : '❌'}`);
  logLine(` • Latency Distribution:   p50: ${(p50 / 1000).toFixed(2)}s | p90: ${(p90 / 1000).toFixed(2)}s | p95: ${(p95 / 1000).toFixed(2)}s | p99: ${(p99 / 1000).toFixed(2)}s | Max: ${(maxLatency / 1000).toFixed(2)}s`);
  logLine(` • Average Latency:        ${avgLatencyMs.toFixed(2)} ms/snippet | Throughput: ${(dataset.length / (totalTimeMs / 1000)).toFixed(2)} snippets/s`);
  logLine('───────────────────────────────────────────────────────────────');

  // Print Error Attribution Breakdown
  logLine('\n─────────────────── ERROR ATTRIBUTION SUMMARY ───────────────────');
  logLine(' Top Missed Relation Types:');
  const sortedMissed = Array.from(missedRelationCounts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [rel, count] of sortedMissed.slice(0, 5)) {
    logLine(`   • ${rel.padEnd(20, ' ')} : ${count} missed instances`);
  }

  logLine('\n Epoch Performance Breakdown:');
  for (const [epoch, stat] of Array.from(epochStats.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const epochF1 = stat.gt > 0 ? (stat.tp / stat.gt) * 100 : 100;
    const epochPassRate = ((stat.passed / stat.total) * 100).toFixed(0);
    const passIcon = epochF1 >= 90 ? '✅' : (epochF1 >= 70 ? '⚠️' : '❌');
    logLine(`   • ${epoch.padEnd(14, ' ')}: ${passIcon} ${stat.passed}/${stat.total} pass (${epochPassRate}%) | Recall: ${stat.tp}/${stat.gt} (${epochF1.toFixed(1)}%)`);
  }
  logLine('─────────────────────────────────────────────────────────────────\n');

  // Failure snippets summary for rapid debugging (SSOT)
  const failures = snippetDiagnostics
    .filter(item => item && (item.missingGt.length > 0 || item.hallucinated.length > 0 || item.metrics.f1 < 100 || Boolean(item.meta?.llmError)))
    .map(item => ({
      id: item.id,
      correlationId: item.correlationId,
      text: dataset.find(d => d.id === item.id)?.sourceText || '',
      metrics: item.metrics,
      missingGt: item.missingGt,
      hallucinated: item.hallucinated,
      extractedTriples: item.extractedTriples,
      gtTriples: item.gtTriples,
      meta: item.meta,
    }));

  const report = {
    timestamp: new Date().toISOString(),
    engine: 'Stage 2 Knowledge Graph Triple Extractor',
    overallPassed,
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
      latencyQuantiles: {
        p50: Number(p50.toFixed(1)),
        p90: Number(p90.toFixed(1)),
        p95: Number(p95.toFixed(1)),
        p99: Number(p99.toFixed(1)),
        min: Number(minLatency.toFixed(1)),
        max: Number(maxLatency.toFixed(1)),
      },
    },
    errorAttribution: {
      totalFailuresCount: failures.length,
      missedRelationCounts: Object.fromEntries(missedRelationCounts),
      epochStats: Object.fromEntries(epochStats),
    },
    failures,
    allSnippets: snippetDiagnostics,
  };

  const reportPath = path.join(reportsDir, 'stage2-triples-eval-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  logLine(`[+] Stage 2 Triples Evaluation Report saved to: file:///${reportPath.replace(/\\/g, '/')}`);
  logLine(`[+] Incremental JSONL Stream saved to: file:///${jsonlFilePath.replace(/\\/g, '/')}`);
  logLine(`[+] Full execution log saved to: file:///${logFilePath.replace(/\\/g, '/')}\n`);

  logStream.end();
  jsonlStream.end();
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
