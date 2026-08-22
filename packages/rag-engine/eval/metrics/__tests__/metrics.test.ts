import { describe, it, expect } from 'vitest';
import {
  calculateDCG,
  calculateIDCG,
  calculateNDCGAtK,
  calculateMRRAtK,
  calculatePairwiseRankingAccuracy,
  calculateRecallAtK,
} from '../ranking-metrics.js';
import {
  extractFactualClaims,
  verifyClaimEntailment,
  calculateClaimFaithfulness,
  calculateCitationCoverage,
  checkFolkloreGuardrailCompliance,
} from '../grounding-metrics.js';
import {
  calculatePairedBootstrapCI,
  calculatePairedTTest,
} from '../statistical-analysis.js';
import { HighResolutionLatencyProfiler } from '../latency-profiler.js';

describe('Ranking Metrics Engine', () => {
  it('calculates perfect nDCG@5 correctly', () => {
    const goldGrades = new Map<string, number>([
      ['doc_1', 3],
      ['doc_2', 2],
      ['doc_3', 1],
    ]);

    const retrieved = ['doc_1', 'doc_2', 'doc_3', 'doc_4'];
    const ndcg = calculateNDCGAtK(retrieved, goldGrades, 5);
    expect(ndcg).toBeCloseTo(1.0, 4);
  });

  it('calculates degraded nDCG@5 when order is reversed', () => {
    const goldGrades = new Map<string, number>([
      ['doc_1', 3],
      ['doc_2', 2],
      ['doc_3', 1],
    ]);

    const retrievedReversed = ['doc_3', 'doc_2', 'doc_1'];
    const ndcg = calculateNDCGAtK(retrievedReversed, goldGrades, 5);
    expect(ndcg).toBeLessThan(1.0);
    expect(ndcg).toBeGreaterThan(0.5);
  });

  it('calculates MRR@5 correctly', () => {
    const goldGrades = new Map<string, number>([
      ['doc_target', 3],
    ]);
    const retrieved = ['noise_1', 'doc_target', 'noise_2'];
    const mrr = calculateMRRAtK(retrieved, goldGrades, 5, 2);
    expect(mrr).toBe(0.5); // Rank 2 -> 1/2
  });

  it('calculates Pairwise Ranking Accuracy', () => {
    const goldGrades = new Map<string, number>([
      ['doc_a', 3],
      ['doc_b', 2],
      ['doc_c', 0],
    ]);

    const perfectOrder = ['doc_a', 'doc_b', 'doc_c'];
    expect(calculatePairwiseRankingAccuracy(perfectOrder, goldGrades)).toBe(1.0);

    const invertedOrder = ['doc_c', 'doc_b', 'doc_a'];
    expect(calculatePairwiseRankingAccuracy(invertedOrder, goldGrades)).toBe(0.0);
  });

  it('calculates Recall@K', () => {
    const gold = new Set(['d1', 'd2', 'd3']);
    const retrieved = ['d1', 'd3', 'd4', 'd5'];
    expect(calculateRecallAtK(retrieved, gold, 5)).toBeCloseTo(2 / 3, 4);
  });
});

describe('Grounding & Entailment Metrics', () => {
  it('extracts historical claims from text', () => {
    const text = `Vua Quang Trung đại phá 29 vạn quân Thanh năm 1789. Trận đánh diễn ra tại Ngọc Hồi - Đống Đa.`;
    const claims = extractFactualClaims(text);
    expect(claims.length).toBe(2);
  });

  it('verifies claim entailment accurately against historical context', () => {
    const context = [`Năm 1789, vua Quang Trung chỉ huy quân Tây Sơn đại phá 29 vạn quân Thanh tại Ngọc Hồi Đống Đa.`];
    const trueClaim = `Quang Trung đánh tan quân Thanh năm 1789`;
    const falseClaim = `Lê Lợi chỉ huy trận Ngọc Hồi Đống Đa vào thế kỷ 20`;

    expect(verifyClaimEntailment(trueClaim, context).status).toBe('ENTAILED');
    expect(verifyClaimEntailment(falseClaim, context).status).toBe('NOT_SUPPORTED');
  });

  it('computes claim faithfulness and hallucination rate', () => {
    const context = [`Ngô Quyền dùng cọc gỗ bọc sắt đánh tan quân Nam Hán trên sông Bạch Đằng năm 938.`];
    const claims = [
      `Ngô Quyền chiến thắng năm 938 trên sông Bạch Đằng`,
      `Ngô Quyền sử dụng máy bay chiến đấu`, // Hallucination
    ];

    const result = calculateClaimFaithfulness(claims, context);
    expect(result.faithfulnessPercent).toBe(50);
    expect(result.hallucinationRatePercent).toBe(50);
  });

  it('verifies folklore guardrail compliance', () => {
    const validFolklore = `Theo truyền thuyết, Cao Lỗ đã chế tạo nỏ thần bắn một phát ra trăm mũi tên.`;
    const invalidFolklore = `Cao Lỗ chế tạo nỏ thần chắc chắn 100% có thật theo khoa học.`;

    expect(checkFolkloreGuardrailCompliance(validFolklore, true)).toBe(true);
    expect(checkFolkloreGuardrailCompliance(invalidFolklore, true)).toBe(false);
  });
});

describe('Statistical Testing & Bootstrap CI', () => {
  it('computes paired bootstrap CI with 95% interval', () => {
    const baseline = [0.7, 0.8, 0.75, 0.82, 0.78];
    const candidate = [0.85, 0.92, 0.89, 0.95, 0.90]; // strictly higher

    const ci = calculatePairedBootstrapCI(baseline, candidate, { B: 1000, seed: 42 });
    expect(ci.meanDelta).toBeGreaterThan(0.1);
    expect(ci.ciLower).toBeGreaterThan(0.05);
    expect(ci.isSignificant).toBe(true);
  });

  it('computes paired t-test p-value', () => {
    const sample1 = [1, 2, 3, 4, 5];
    const sample2 = [2, 3, 4, 5, 6];
    const tTest = calculatePairedTTest(sample1, sample2);
    expect(tTest.statistic).toBeGreaterThan(0);
  });
});

describe('High-Resolution Latency Profiler', () => {
  it('tracks percentiles and summary statistics', () => {
    const profiler = new HighResolutionLatencyProfiler();
    for (let i = 1; i <= 100; i++) {
      profiler.record(i);
    }
    const summary = profiler.getSummary();
    expect(summary.count).toBe(100);
    expect(summary.p50_ms).toBe(50.5);
    expect(summary.p95_ms).toBeCloseTo(95.05, 0);
    expect(summary.p99_ms).toBeCloseTo(99.01, 0);
  });
});

import { evaluateRegressionGates } from '../../benchmarks/regression-gate.js';

describe('Regression Quality Gates', () => {
  it('passes when metrics meet floors and show no regression', () => {
    const res = evaluateRegressionGates({
      baseline: { factPrecision: 95.0, hallucinationRate: 2.0, recallAt10: 75.0, ndcgAt5: 0.80, latencyP95Ms: 120.0 },
      current: { factPrecision: 96.0, hallucinationRate: 1.5, recallAt10: 78.0, ndcgAt5: 0.82, latencyP95Ms: 110.0 },
    });
    expect(res.allPassed).toBe(true);
    expect(res.gates.length).toBe(5);
    expect(res.gates.every((g) => g.passed)).toBe(true);
  });

  it('fails and blocks when a metric drops below absolute quality floor', () => {
    const res = evaluateRegressionGates({
      baseline: { factPrecision: 95.0, hallucinationRate: 2.0, recallAt10: 75.0, ndcgAt5: 0.80, latencyP95Ms: 120.0 },
      current: { factPrecision: 80.0, hallucinationRate: 1.5, recallAt10: 78.0, ndcgAt5: 0.82, latencyP95Ms: 110.0 }, // 80% < 90% floor
    });
    expect(res.allPassed).toBe(false);
    const gate1 = res.gates.find((g) => g.gate_id === 'GATE_1_FACT_PRECISION');
    expect(gate1?.passed).toBe(false);
  });
});
