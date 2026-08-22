/**
 * Automated Regression Quality Gates for CI/CD
 * Enforces strict non-regression thresholds for Fact Precision, Hallucination, Retrieval, Ranking & Latency
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RegressionQualityGate } from '@chronoviet/shared-spec';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RegressionCheckInput {
  baseline: {
    factPrecision: number;
    hallucinationRate: number;
    recallAt10: number;
    ndcgAt5: number;
    latencyP95Ms: number;
  };
  current: {
    factPrecision: number;
    hallucinationRate: number;
    recallAt10: number;
    ndcgAt5: number;
    latencyP95Ms: number;
  };
}

export interface QualityFloorConfig {
  minFactPrecision: number;
  maxHallucinationRate: number;
  minRecallAt10: number;
  minNdcgAt5: number;
  maxLatencyP95Ms: number;
}

export const DEFAULT_QUALITY_FLOORS: QualityFloorConfig = {
  minFactPrecision: 90.0,
  maxHallucinationRate: 5.0,
  minRecallAt10: 70.0,
  minNdcgAt5: 0.70,
  maxLatencyP95Ms: 300.0,
};

export function evaluateRegressionGates(
  input: RegressionCheckInput,
  floors: QualityFloorConfig = DEFAULT_QUALITY_FLOORS
): {
  allPassed: boolean;
  gates: RegressionQualityGate[];
} {
  const gates: RegressionQualityGate[] = [];

  // Gate 1: Fact Precision Gate (Absolute Floor >= 90.0% AND Relative Delta >= -2.0%)
  const deltaFact = input.current.factPrecision - input.baseline.factPrecision;
  const passGate1 = input.current.factPrecision >= floors.minFactPrecision && deltaFact >= -2.0;
  gates.push({
    gate_id: 'GATE_1_FACT_PRECISION',
    metric_name: 'Fact Precision',
    baseline_value: input.baseline.factPrecision,
    current_value: input.current.factPrecision,
    delta: Number(deltaFact.toFixed(2)),
    threshold: 0.0,
    passed: passGate1,
    is_blocking: true,
    message: passGate1
      ? `PASS: Fact Precision ${input.current.factPrecision}% >= floor ${floors.minFactPrecision}% (delta ${deltaFact.toFixed(2)}%)`
      : `FAIL: Fact Precision failed floor check (${input.current.factPrecision}% < ${floors.minFactPrecision}%) or dropped significantly!`,
  });

  // Gate 2: Hallucination Rate Gate (Absolute Ceiling <= 5.0% AND Relative Delta <= 2.0%)
  const deltaHalluc = input.current.hallucinationRate - input.baseline.hallucinationRate;
  const passGate2 = input.current.hallucinationRate <= floors.maxHallucinationRate && deltaHalluc <= 2.0;
  gates.push({
    gate_id: 'GATE_2_HALLUCINATION_RATE',
    metric_name: 'Hallucination Rate',
    baseline_value: input.baseline.hallucinationRate,
    current_value: input.current.hallucinationRate,
    delta: Number(deltaHalluc.toFixed(2)),
    threshold: 0.0,
    passed: passGate2,
    is_blocking: true,
    message: passGate2
      ? `PASS: Hallucination rate ${input.current.hallucinationRate}% <= ceiling ${floors.maxHallucinationRate}% (delta ${deltaHalluc.toFixed(2)}%)`
      : `FAIL: Hallucination rate exceeded ceiling (${input.current.hallucinationRate}% > ${floors.maxHallucinationRate}%) or spiked!`,
  });

  // Gate 3: Retrieval Recall Regression Gate (Absolute Floor >= 70.0% AND Relative Delta >= -5.0%)
  const deltaRecall = input.current.recallAt10 - input.baseline.recallAt10;
  const passGate3 = input.current.recallAt10 >= floors.minRecallAt10 && deltaRecall >= -5.0;
  gates.push({
    gate_id: 'GATE_3_RETRIEVAL_RECALL',
    metric_name: 'Retrieval Recall@10',
    baseline_value: input.baseline.recallAt10,
    current_value: input.current.recallAt10,
    delta: Number(deltaRecall.toFixed(2)),
    threshold: -1.0,
    passed: passGate3,
    is_blocking: true,
    message: passGate3
      ? `PASS: Recall@10 ${input.current.recallAt10}% >= floor ${floors.minRecallAt10}% (delta ${deltaRecall.toFixed(2)}%)`
      : `FAIL: Recall@10 dropped below floor (${input.current.recallAt10}% < ${floors.minRecallAt10}%)!`,
  });

  // Gate 4: Ranking Quality Regression Gate (Absolute Floor >= 0.70 AND Relative Delta >= -0.05)
  const deltaNdcg = input.current.ndcgAt5 - input.baseline.ndcgAt5;
  const passGate4 = input.current.ndcgAt5 >= floors.minNdcgAt5 && deltaNdcg >= -0.05;
  gates.push({
    gate_id: 'GATE_4_RANKING_NDCG',
    metric_name: 'Ranking nDCG@5',
    baseline_value: input.baseline.ndcgAt5,
    current_value: input.current.ndcgAt5,
    delta: Number(deltaNdcg.toFixed(3)),
    threshold: -0.02,
    passed: passGate4,
    is_blocking: true,
    message: passGate4
      ? `PASS: nDCG@5 ${input.current.ndcgAt5} >= floor ${floors.minNdcgAt5} (delta ${deltaNdcg.toFixed(3)})`
      : `FAIL: nDCG@5 dropped below floor (${input.current.ndcgAt5} < ${floors.minNdcgAt5})!`,
  });

  // Gate 5: Latency Regression Gate (p95 <= maxLatencyP95Ms)
  const passGate5 = input.current.latencyP95Ms <= floors.maxLatencyP95Ms;
  gates.push({
    gate_id: 'GATE_5_LATENCY_P95',
    metric_name: 'p95 Latency SLA',
    baseline_value: input.baseline.latencyP95Ms,
    current_value: input.current.latencyP95Ms,
    delta: Number((input.current.latencyP95Ms - input.baseline.latencyP95Ms).toFixed(2)),
    threshold: floors.maxLatencyP95Ms,
    passed: passGate5,
    is_blocking: true,
    message: passGate5
      ? `PASS: p95 latency ${input.current.latencyP95Ms}ms within SLA (< ${floors.maxLatencyP95Ms}ms)`
      : `FAIL: p95 latency ${input.current.latencyP95Ms}ms exceeds SLA (${floors.maxLatencyP95Ms}ms)!`,
  });

  const allPassed = gates.every((g) => g.passed);

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, 'regression-diff-report.json'),
    JSON.stringify({ allPassed, gates }, null, 2)
  );

  return { allPassed, gates };
}
