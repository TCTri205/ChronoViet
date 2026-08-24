import { describe, it, expect } from 'vitest';
import {
  calculateDCG,
  calculateIDCG,
  calculateNDCGAtK,
  calculateMRRAtK,
  calculateMAPAtK,
  calculatePairwiseRankingAccuracy,
  calculateRecallAtK,
  calculatePrecisionAtK,
  calculateEvidenceRecallAtK,
  calculateContentAwareGrades,
} from '../ranking-metrics.js';
import {
  extractFactualClaims,
  verifyClaimEntailment,
  calculateClaimFaithfulness,
  calculateCitationCoverage,
  verifyCitationCorrectness,
  checkFolkloreGuardrailCompliance,
  validateSourceReliabilityTiering,
} from '../grounding-metrics.js';
import {
  calculatePairedBootstrapCI,
  calculatePairedTTest,
} from '../statistical-analysis.js';
import { HighResolutionLatencyProfiler } from '../latency-profiler.js';
import { evaluateRegressionGates } from '../../benchmarks/regression-gate.js';

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

  it('handles zero-division and edge cases in ranking metrics', () => {
    // Empty retrieved list
    expect(calculateNDCGAtK([], new Map([['d1', 3]]), 5)).toBe(0.0);
    expect(calculateMRRAtK([], new Map([['d1', 3]]), 5)).toBe(0.0);
    expect(calculateMAPAtK([], new Set(['d1']), 10)).toBe(0.0);
    expect(calculateRecallAtK([], new Set(['d1']), 10)).toBe(0.0);
    expect(calculatePrecisionAtK([], new Set(['d1']), 10)).toBe(0.0);

    // Empty gold list
    expect(calculateNDCGAtK(['d1'], new Map(), 5)).toBe(1.0);
    expect(calculateMAPAtK(['d1'], new Set(), 10)).toBe(1.0);
    expect(calculateRecallAtK(['d1'], new Set(), 10)).toBe(1.0);
    expect(calculatePrecisionAtK(['d1'], new Set(), 10)).toBe(0.0);

    // Non-positive k
    expect(calculateNDCGAtK(['d1'], new Map([['d1', 3]]), 0)).toBe(1.0);
    expect(calculateMRRAtK(['d1'], new Map([['d1', 3]]), 0)).toBe(0.0);
    expect(calculatePrecisionAtK(['d1'], new Set(['d1']), 0)).toBe(0.0);
  });

  it('calculates MRR@5 correctly', () => {
    const goldGrades = new Map<string, number>([
      ['doc_target', 3],
    ]);
    const retrieved = ['noise_1', 'doc_target', 'noise_2'];
    const mrr = calculateMRRAtK(retrieved, goldGrades, 5, 2);
    expect(mrr).toBe(0.5); // Rank 2 -> 1/2
  });

  it('calculates MAP@K and Precision@K correctly', () => {
    const gold = new Set(['d1', 'd3']);
    const retrieved = ['d1', 'd2', 'd3', 'd4'];
    // Rank 1: 1/1, Rank 2: 1/2, Rank 3: 2/3 -> MAP = (1 + 2/3) / 2 = 5/6
    expect(calculateMAPAtK(retrieved, gold, 4)).toBeCloseTo(5 / 6, 3);
    expect(calculatePrecisionAtK(retrieved, gold, 4)).toBe(0.5); // 2 / 4 = 0.5
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

  it('calculates Recall@K and EvidenceRecallAtK', () => {
    const gold = new Set(['d1', 'd2', 'd3']);
    const retrieved = ['d1', 'd3', 'd4', 'd5'];
    expect(calculateRecallAtK(retrieved, gold, 5)).toBeCloseTo(2 / 3, 4);

    const chunks = [
      { textContent: 'Vua Quang Trung đại phá 29 vạn quân Thanh vào mùa xuân Kỷ Dậu 1789 tại Ngọc Hồi Đống Đa.' },
    ];
    const claims = [
      'Quang Trung đại phá 29 vạn quân Thanh năm 1789',
      'Lê Lợi chỉ huy kháng chiến chống Minh',
    ];
    expect(calculateEvidenceRecallAtK(chunks, claims, 5)).toBe(0.5);
  });

  it('calculates ContentAwareGrades with anti-overfitting distractor resistance', () => {
    const goldChunks = [
      {
        chunk_id: 'gold_1',
        relevance_grade: 3,
        key_evidence_claims: [
          'Quang Trung chỉ huy đại phá 29 vạn quân Thanh',
          'Trận đánh diễn ra tại Ngọc Hồi Đống Đa năm 1789',
        ],
      },
    ];

    const matchingChunk = {
      chunkId: 'retrieved_exact',
      textContent: 'Vua Quang Trung đã chỉ huy đại phá 29 vạn quân Thanh tại Ngọc Hồi Đống Đa năm 1789.',
    };
    const distractorChunk = {
      chunkId: 'retrieved_distractor',
      textContent: 'Nguyễn Huệ sinh ra ở Bình Định và sau này có một người cháu tên là Nguyễn Quang Thùy.',
    };

    const grades = calculateContentAwareGrades([matchingChunk, distractorChunk], goldChunks);
    expect(grades.get('retrieved_exact')).toBe(3);
    expect(grades.get('retrieved_distractor')).toBe(0); // Distractor should NOT be elevated to positive relevance
  });

  it('preserves short Vietnamese syllables and historical names properly', () => {
    const goldChunks = [
      {
        chunk_id: 'gold_le_loi',
        relevance_grade: 3,
        key_evidence_claims: ['Vua Lê Lợi lãnh đạo khởi nghĩa Lam Sơn'],
      },
    ];
    const retrieved = [
      {
        chunkId: 'c_le_loi',
        textContent: 'Lê Lợi là người khởi xướng và lãnh đạo cuộc khởi nghĩa Lam Sơn.',
      },
    ];
    const grades = calculateContentAwareGrades(retrieved, goldChunks);
    expect(grades.get('c_le_loi')).toBe(3);
  });
});

describe('Grounding & Entailment Metrics', () => {
  it('extracts factual claims and discards discourse/meta statements and conversational fillers', () => {
    const text = `Dạ xin chào bạn. Theo tôi được biết thì Vua Quang Trung đại phá 29 vạn quân Thanh năm 1789. Trận đánh diễn ra tại Ngọc Hồi - Đống Đa. Như vậy chiến thắng này rất vĩ đại.`;
    const claims = extractFactualClaims(text);
    expect(claims.length).toBe(2);
    expect(claims).toContain('Vua Quang Trung đại phá 29 vạn quân Thanh năm 1789.');
  });

  it('verifies claim entailment accurately against historical context', () => {
    const context = [`Năm 1789, vua Quang Trung chỉ huy quân Tây Sơn đại phá 29 vạn quân Thanh tại Ngọc Hồi Đống Đa.`];
    const trueClaim = `Quang Trung đánh tan 29 vạn quân Thanh năm 1789 tại Ngọc Hồi Đống Đa`;
    const falseClaim = `Lê Lợi chỉ huy trận Ngọc Hồi Đống Đa vào thế kỷ 20`;

    expect(verifyClaimEntailment(trueClaim, context).status).toBe('ENTAILED');
    expect(verifyClaimEntailment(falseClaim, context).status).toBe('NOT_SUPPORTED');
  });

  it('detects polarity and negation contradictions', () => {
    const victoryContext = [`Quân Tây Sơn do vua Quang Trung thống lĩnh đã đại thắng 29 vạn quân Mãn Thanh tại Ngọc Hồi.`];
    const defeatedClaim = `Vua Quang Trung đã thất bại và đầu hàng trước quân Thanh tại Ngọc Hồi`;
    const negatedClaim = `Quang Trung không phải là người chiến thắng quân Thanh`;

    expect(verifyClaimEntailment(defeatedClaim, victoryContext).status).toBe('CONTRADICTED');
    expect(verifyClaimEntailment(negatedClaim, victoryContext).status).toBe('CONTRADICTED');
  });

  it('detects kinship and temporal contradictions', () => {
    const kinshipContext = [`Nguyễn Nhạc là anh của Nguyễn Huệ trong phong trào Tây Sơn.`];
    const invertedKinshipClaim = `Nguyễn Huệ là cha của Nguyễn Nhạc`;
    expect(verifyClaimEntailment(invertedKinshipClaim, kinshipContext).status).toBe('CONTRADICTED');

    const yearContext = [`Chiến thắng Điện Biên Phủ diễn ra vào năm 1954.`];
    const wrongYearClaim = `Chiến dịch Điện Biên Phủ diễn ra vào năm 1427`;
    expect(verifyClaimEntailment(wrongYearClaim, yearContext).status).toBe('NOT_SUPPORTED');
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

  it('verifies citation coverage and citation correctness without fallback shortcuts', () => {
    const claims = [
      'Quang Trung đại phá quân Thanh năm 1789',
      'Lê Lợi chỉ huy khởi nghĩa Lam Sơn',
    ];
    const chunkMap = new Map([
      ['chunk_qt', 'Vua Quang Trung đại phá quân Thanh năm 1789 tại Ngọc Hồi Đống Đa.'],
      ['chunk_other', 'Thời kỳ Hồng Bàng thuộc triều đại Văn Lang.'],
    ]);

    const validCitations = [['chunk_qt'], ['chunk_other']]; // 2nd citation does not prove claim 2
    const coverage = calculateCitationCoverage(claims, validCitations);
    expect(coverage).toBe(100);

    const correctness = verifyCitationCorrectness(claims, validCitations, chunkMap);
    expect(correctness.citationCorrectnessPercent).toBe(50); // 1 out of 2 correct
  });

  it('verifies folklore guardrail and source reliability compliance', () => {
    const validFolklore = `Theo truyền thuyết, Cao Lỗ đã chế tạo nỏ thần bắn một phát ra trăm mũi tên.`;
    const invalidFolklore = `Cao Lỗ chế tạo nỏ thần chắc chắn 100% có thật theo khoa học.`;

    expect(checkFolkloreGuardrailCompliance(validFolklore, true)).toBe(true);
    expect(checkFolkloreGuardrailCompliance(invalidFolklore, true)).toBe(false);

    expect(validateSourceReliabilityTiering([{ reliability: 'LEVEL_1', confidence: 0.95 }])).toBe(true);
    expect(validateSourceReliabilityTiering([{ reliability: 'LEVEL_3', confidence: 0.99 }])).toBe(false);
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

describe('Regression Quality Gates', () => {
  it('passes when metrics meet floors and show no regression', () => {
    const res = evaluateRegressionGates({
      baseline: { factPrecision: 80.0, hallucinationRate: 5.0, recallAt10: 75.0, ndcgAt5: 0.75, latencyP95Ms: 120.0, ttftP95Ms: 700.0 },
      current: { factPrecision: 85.0, hallucinationRate: 4.0, recallAt10: 78.0, ndcgAt5: 0.78, latencyP95Ms: 110.0, ttftP95Ms: 650.0 },
    });
    expect(res.allPassed).toBe(true);
    expect(res.gates.length).toBe(6);
    expect(res.gates.every((g) => g.passed)).toBe(true);
  });

  it('fails and blocks when a metric drops below absolute quality floor', () => {
    const res = evaluateRegressionGates({
      baseline: { factPrecision: 85.0, hallucinationRate: 5.0, recallAt10: 75.0, ndcgAt5: 0.75, latencyP95Ms: 120.0 },
      current: { factPrecision: 65.0, hallucinationRate: 4.0, recallAt10: 78.0, ndcgAt5: 0.78, latencyP95Ms: 110.0 }, // 65% < 80% floor
    });
    expect(res.allPassed).toBe(false);
    const gate1 = res.gates.find((g) => g.gate_id === 'GATE_1_FACT_PRECISION');
    expect(gate1?.passed).toBe(false);
  });

  it('evaluates TTFT SLA streaming gate correctly', () => {
    const resFail = evaluateRegressionGates({
      baseline: { factPrecision: 85.0, hallucinationRate: 4.0, recallAt10: 78.0, ndcgAt5: 0.78, latencyP95Ms: 110.0, ttftP95Ms: 800.0 },
      current: { factPrecision: 85.0, hallucinationRate: 4.0, recallAt10: 78.0, ndcgAt5: 0.78, latencyP95Ms: 110.0, ttftP95Ms: 1800.0 }, // 1800ms > 1500ms floor
    });
    expect(resFail.allPassed).toBe(false);
    const gate6 = resFail.gates.find((g) => g.gate_id === 'GATE_6_TTFT_P95');
    expect(gate6?.passed).toBe(false);
  });
});

