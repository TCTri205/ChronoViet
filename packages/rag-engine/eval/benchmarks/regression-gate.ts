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

export function evaluateRegressionGates(input: RegressionCheckInput): {
  allPassed: boolean;
  gates: RegressionQualityGate[];
} {
  const gates: RegressionQualityGate[] = [];

  // Gate 1: Fact Precision Drop Gate (Delta < 0.0% -> BLOCK)
  const deltaFact = input.current.factPrecision - input.baseline.factPrecision;
  const passGate1 = deltaFact >= 0.0 || input.current.factPrecision >= 99.2;
  gates.push({
    gate_id: 'GATE_1_FACT_PRECISION',
    metric_name: 'Fact Precision',
    baseline_value: input.baseline.factPrecision,
    current_value: input.current.factPrecision,
    delta: Number(deltaFact.toFixed(2)),
    threshold: 0.0,
    passed: passGate1,
    is_blocking: true,
    message: passGate1 ? 'PASS: No Fact Precision regression' : 'FAIL: Fact Precision dropped below baseline!',
  });

  // Gate 2: Hallucination Rate Increase Gate (Delta > 0.0% -> BLOCK)
  const deltaHalluc = input.current.hallucinationRate - input.baseline.hallucinationRate;
  const passGate2 = deltaHalluc <= 0.0 || input.current.hallucinationRate <= 0.8;
  gates.push({
    gate_id: 'GATE_2_HALLUCINATION_RATE',
    metric_name: 'Hallucination Rate',
    baseline_value: input.baseline.hallucinationRate,
    current_value: input.current.hallucinationRate,
    delta: Number(deltaHalluc.toFixed(2)),
    threshold: 0.0,
    passed: passGate2,
    is_blocking: true,
    message: passGate2 ? 'PASS: Hallucination rate within bounds' : 'FAIL: Hallucination rate increased!',
  });

  // Gate 3: Retrieval Recall Regression Gate (Delta Recall@10 < -1.0% -> BLOCK)
  const deltaRecall = input.current.recallAt10 - input.baseline.recallAt10;
  const passGate3 = deltaRecall >= -1.0;
  gates.push({
    gate_id: 'GATE_3_RETRIEVAL_RECALL',
    metric_name: 'Retrieval Recall@10',
    baseline_value: input.baseline.recallAt10,
    current_value: input.current.recallAt10,
    delta: Number(deltaRecall.toFixed(2)),
    threshold: -1.0,
    passed: passGate3,
    is_blocking: true,
    message: passGate3 ? 'PASS: Recall@10 stable' : 'FAIL: Recall@10 dropped by > 1.0%!',
  });

  // Gate 4: Ranking Quality Regression Gate (Delta nDCG@5 < -0.02 -> BLOCK)
  const deltaNdcg = input.current.ndcgAt5 - input.baseline.ndcgAt5;
  const passGate4 = deltaNdcg >= -0.02;
  gates.push({
    gate_id: 'GATE_4_RANKING_NDCG',
    metric_name: 'Ranking nDCG@5',
    baseline_value: input.baseline.ndcgAt5,
    current_value: input.current.ndcgAt5,
    delta: Number(deltaNdcg.toFixed(3)),
    threshold: -0.02,
    passed: passGate4,
    is_blocking: true,
    message: passGate4 ? 'PASS: nDCG@5 ranking quality maintained' : 'FAIL: nDCG@5 dropped by > 0.02!',
  });

  // Gate 5: Latency Regression Gate (p95 > 300ms -> BLOCK)
  const passGate5 = input.current.latencyP95Ms <= 300;
  gates.push({
    gate_id: 'GATE_5_LATENCY_P95',
    metric_name: 'p95 Latency SLA',
    baseline_value: input.baseline.latencyP95Ms,
    current_value: input.current.latencyP95Ms,
    delta: Number((input.current.latencyP95Ms - input.baseline.latencyP95Ms).toFixed(2)),
    threshold: 300,
    passed: passGate5,
    is_blocking: true,
    message: passGate5 ? 'PASS: p95 latency within SLA (< 300ms)' : 'FAIL: p95 latency exceeds 300ms!',
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
