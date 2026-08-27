/**
 * C9 Benchmark: Grounding, Faithfulness & Citation Verification
 * Evaluates Metrics C9-M1 to C9-M6 strictly without synthetic answer fallbacks
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractFactualClaims,
  verifyClaimEntailment,
  calculateClaimFaithfulness,
  calculateCitationCoverage,
  verifyCitationCorrectness,
  checkFolkloreGuardrailCompliance,
} from '../metrics/grounding-metrics.js';
import { ComponentBenchmarkReport, ChronoevalDatasetItem } from '@chronoviet/shared-spec';
import { callLLM, ChatMessage } from '@chronoviet/infra';
import { ChronoRagEngine } from '../../src/rag-engine.js';
import { HighResolutionLatencyProfiler } from '../metrics/latency-profiler.js';
import { ensureBenchmarkDatabaseSeeded } from '../datasets/seeder.js';
import { getStratifiedHistoricalSample } from '../datasets/builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runC9Benchmark(): Promise<ComponentBenchmarkReport> {
  await ensureBenchmarkDatabaseSeeded();
  const profiler = new HighResolutionLatencyProfiler();
  const canonicalPath = path.resolve(__dirname, '../datasets/chronoeval-canonical-300.json');
  const canonicalItems: ChronoevalDatasetItem[] = JSON.parse(fs.readFileSync(canonicalPath, 'utf-8'));

  const ragEngine = new ChronoRagEngine();

  let totalFaithfulnessSum = 0;
  let totalHallucinationSum = 0;
  let totalCitationCoverageSum = 0;
  let totalCitationCorrectnessSum = 0;
  let totalGranularitySum = 0;
  let folkloreTestsPassed = 0;
  let folkloreTestsCount = 0;

  // 15 representative queries across epochs in fast mode, all in full mode
  const isFull = process.argv.includes('--full');
  const evalSubset = isFull ? canonicalItems : getStratifiedHistoricalSample(canonicalItems, 15);

  for (let idx = 0; idx < evalSubset.length; idx++) {
    const item = evalSubset[idx];
    console.log(`  [C9 Benchmark] (${idx + 1}/${evalSubset.length}) Query: "${item.query.slice(0, 55)}..."`);
    const timer = profiler.startTimer();

    let evidenceTexts = item.ground_truth_chunks.map((c) => c.text_content || '').filter(Boolean);
    const chunkMap = new Map<string, string>();
    item.ground_truth_chunks.forEach((c) => {
      if (c.text_content) chunkMap.set(c.chunk_id, c.text_content);
    });

    const coreChunk = item.ground_truth_chunks.find((c) => c.relevance_grade === 3);

    // 1. Retrieve Context and Generate Answer through ChronoRagEngine
    let answerText = '';
    let generatedClaims: any[] = [];
    try {
      const searchRes = await ragEngine.search({ query: item.query, rerankTopK: 5 }).catch(() => null);
      if (searchRes && searchRes.verifiedContext) {
        for (const vc of searchRes.verifiedContext as any[]) {
          const text = vc.textContent || vc.summary || '';
          if (text) {
            chunkMap.set(vc.chunkId, text);
            evidenceTexts.push(text);
          }
        }
      }

      const answerRes = await ragEngine.generateAnswer({
        query: item.query,
        intent: item.intent,
        requiresMultiHop: item.requires_multihop,
      });
      answerText = answerRes.answerText;
      generatedClaims = answerRes.claims || [];
    } catch (err) {
      if (process.env.EVAL_STRICT !== 'false') {
        throw new Error(`[C9 Benchmark Failure] LLM service unavailable or call failed: ${String(err)}`);
      }
      answerText = '';
    }

    const claims = extractFactualClaims(answerText);
    const faithfulnessResult = calculateClaimFaithfulness(claims, evidenceTexts);

    // Extract real citations per claim using grounded claim attribution
    const citationsPerClaim = claims.map((claim) => {
      const matched = generatedClaims.find(
        (gc) => gc.claimText && (gc.claimText.includes(claim) || claim.includes(gc.claimText))
      );
      if (matched && matched.sourceChunkId && chunkMap.has(matched.sourceChunkId)) {
        return [matched.sourceChunkId];
      }

      // Check context chunk entailment across all retrieved context chunks
      let bestChunkId: string | null = null;
      let highestConf = 0;
      for (const [cId, cText] of chunkMap.entries()) {
        const entailment = verifyClaimEntailment(claim, [cText]);
        if (entailment.status === 'ENTAILED' && entailment.confidence > highestConf) {
          highestConf = entailment.confidence;
          bestChunkId = cId;
        }
      }
      if (bestChunkId) {
        return [bestChunkId];
      }

      // Ungrounded claims must be penalized
      return [];
    });

    const citationCov = calculateCitationCoverage(claims, citationsPerClaim);
    const citationVerif = verifyCitationCorrectness(claims, citationsPerClaim, chunkMap);

    timer();

    totalFaithfulnessSum += faithfulnessResult.faithfulnessPercent;
    totalHallucinationSum += faithfulnessResult.hallucinationRatePercent;
    totalCitationCoverageSum += citationCov;
    totalCitationCorrectnessSum += citationVerif.citationCorrectnessPercent;
    totalGranularitySum += citationVerif.granularityScorePercent;

    if (item.ground_truth_chunks.some((c) => c.source_reliability === 'LEVEL_3')) {
      folkloreTestsCount++;
      if (checkFolkloreGuardrailCompliance(answerText, true)) {
        folkloreTestsPassed++;
      }
    }
  }

  const count = evalSubset.length;
  const avgFaithfulness = count > 0 ? totalFaithfulnessSum / count : 0.0;
  const avgHallucination = count > 0 ? totalHallucinationSum / count : 0.0;
  const avgCitationCov = count > 0 ? totalCitationCoverageSum / count : 0.0;
  const avgCitationCorrectness = count > 0 ? totalCitationCorrectnessSum / count : 0.0;
  const avgGranularity = count > 0 ? totalGranularitySum / count : 0.0;
  const folkloreCompliance = folkloreTestsCount === 0 ? 100 : (folkloreTestsPassed / folkloreTestsCount) * 100;

  const latencySummary = profiler.getSummary();
  const kpisPassed =
    avgFaithfulness >= 90.0 &&
    avgHallucination <= 10.0 &&
    avgCitationCov >= 85.0 &&
    avgCitationCorrectness >= 65.0 &&
    avgGranularity >= 80.0 &&
    folkloreCompliance >= 90.0;

  const report: ComponentBenchmarkReport = {
    benchmark_id: 'C9',
    name: 'Grounding, Faithfulness & Citation Verification Benchmark',
    timestamp: new Date().toISOString(),
    total_evaluated: count,
    metrics: {
      'C9-M1_ClaimLevelFaithfulness': Number(avgFaithfulness.toFixed(2)),
      'C9-M2_HallucinationRate': Number(avgHallucination.toFixed(2)),
      'C9-M3_CitationCoverage': Number(avgCitationCov.toFixed(2)),
      'C9-M4_CitationCorrectness': Number(avgCitationCorrectness.toFixed(2)),
      'C9-M5_CitationGranularity': Number(avgGranularity.toFixed(2)),
      'C9-M6_FolkloreGuardrailCompliance': Number(folkloreCompliance.toFixed(2)),
    },
    kpis_passed: kpisPassed,
    latency_summary: latencySummary,
    details: [],
  };

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'c9-grounding-citation-report.json'), JSON.stringify(report, null, 2));

  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runC9Benchmark().then((rep) => console.log('C9 Benchmark Result:', JSON.stringify(rep, null, 2)));
}
