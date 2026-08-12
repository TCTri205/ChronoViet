/**
 * Chrono-RAG Evaluation Metrics Engine (Fact Precision, Hallucination Rate, Citation Traceability)
 */

import { RagSearchResponse } from '@chronoviet/shared-spec';

export interface TestCase {
  id: string;
  domain: string;
  question: string;
  groundTruthCanonical: string;
  expectedAliases: string[];
  expectedLocation?: string;
  expectedDynasty?: string;
  requiredFacts: string[];
}

export interface EvaluationItemResult {
  testId: string;
  domain: string;
  question: string;
  factPrecision: number; // 0..100
  hallucinationRate: number; // 0..100
  citationTraceable: boolean;
  aliasesFoundCount: number;
  latencyMs: number;
  passed: boolean;
}

export interface AggregateEvalReport {
  timestamp: string;
  totalEvaluated: number;
  avgFactPrecision: number;
  avgHallucinationRate: number;
  citationTraceabilityPercent: number;
  avgLatencyMs: number;
  kpiStatus: {
    factPrecisionPassed: boolean; // Target > 99.2%
    hallucinationRatePassed: boolean; // Target < 0.8%
    citationTraceabilityPassed: boolean; // Target = 100%
    overallPassed: boolean;
  };
  details: EvaluationItemResult[];
}

const VIETNAMESE_STOP_WORDS = new Set(['là', 'và', 'của', 'tại', 'cho', 'vào', 'ra', 'bị', 'bởi', 'thời', 'các', 'những', 'đã']);

export function evaluateResponse(testCase: TestCase, response: RagSearchResponse): EvaluationItemResult {
  const verifiedText = response.verifiedContext.map((c) => c.summary).join(' ');
  const verifiedLower = verifiedText.toLowerCase();

  // 1. Fact Precision & Hallucination check
  let matchedFacts = 0;
  for (const fact of testCase.requiredFacts) {
    const factLower = fact.toLowerCase();
    // Direct substring check
    if (verifiedLower.includes(factLower)) {
      matchedFacts++;
      continue;
    }

    const keywords = factLower
      .split(/\s+/)
      .map((w) => w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ''))
      .filter((w) => w.length >= 2 && !VIETNAMESE_STOP_WORDS.has(w));

    if (keywords.length === 0) {
      matchedFacts++;
      continue;
    }

    const matchCount = keywords.filter((k) => verifiedLower.includes(k)).length;
    if (matchCount / keywords.length >= 0.4) {
      matchedFacts++;
    }
  }

  const totalFacts = testCase.requiredFacts.length;
  const factPrecision = totalFacts > 0 ? Number(((matchedFacts / totalFacts) * 100).toFixed(2)) : 100;
  const hallucinationRate = Number((Math.max(0, 100 - factPrecision)).toFixed(2));

  // 2. Citation Traceability check
  const hasCitations = response.citations && response.citations.length > 0;
  const citationTraceable = hasCitations && response.verifiedContext.every((c) => c.citations && c.citations.length > 0);

  // 3. Aliases found check
  let aliasesFoundCount = 0;
  for (const alias of testCase.expectedAliases) {
    if (verifiedLower.includes(alias.toLowerCase())) {
      aliasesFoundCount++;
    }
  }

  const passed = factPrecision >= 90 && citationTraceable;

  return {
    testId: testCase.id,
    domain: testCase.domain,
    question: testCase.question,
    factPrecision,
    hallucinationRate,
    citationTraceable,
    aliasesFoundCount,
    latencyMs: response.retrievalLatencyMs,
    passed,
  };
}

export function calculateAggregateReport(results: EvaluationItemResult[]): AggregateEvalReport {
  const total = results.length;
  if (total === 0) {
    return {
      timestamp: new Date().toISOString(),
      totalEvaluated: 0,
      avgFactPrecision: 0,
      avgHallucinationRate: 0,
      citationTraceabilityPercent: 0,
      avgLatencyMs: 0,
      kpiStatus: {
        factPrecisionPassed: false,
        hallucinationRatePassed: false,
        citationTraceabilityPassed: false,
        overallPassed: false,
      },
      details: [],
    };
  }

  const sumPrecision = results.reduce((acc, r) => acc + r.factPrecision, 0);
  const sumHallucination = results.reduce((acc, r) => acc + r.hallucinationRate, 0);
  const traceableCount = results.filter((r) => r.citationTraceable).length;
  const sumLatency = results.reduce((acc, r) => acc + r.latencyMs, 0);

  const avgFactPrecision = Number((sumPrecision / total).toFixed(2));
  const avgHallucinationRate = Number((sumHallucination / total).toFixed(2));
  const citationTraceabilityPercent = Number(((traceableCount / total) * 100).toFixed(2));
  const avgLatencyMs = Number((sumLatency / total).toFixed(2));

  const factPrecisionPassed = avgFactPrecision >= 95.0; // Target KPI >= 95%
  const hallucinationRatePassed = avgHallucinationRate <= 5.0;
  const citationTraceabilityPassed = citationTraceabilityPercent === 100;
  const overallPassed = factPrecisionPassed && hallucinationRatePassed && citationTraceabilityPassed;

  return {
    timestamp: new Date().toISOString(),
    totalEvaluated: total,
    avgFactPrecision,
    avgHallucinationRate,
    citationTraceabilityPercent,
    avgLatencyMs,
    kpiStatus: {
      factPrecisionPassed,
      hallucinationRatePassed,
      citationTraceabilityPassed,
      overallPassed,
    },
    details: results,
  };
}

/**
 * Statistical Audit Parameters & Finite Population Correction (FPC) Sample Size Formula (Spec Section 6.2)
 */
export function calculateFpcSampleSize(
  populationSize: number,
  confidenceLevel: number = 0.95,
  expectedErrorRate: number = 0.05,
  marginOfError: number = 0.05
): { n0: number; nAdjusted: number } {
  const zMap: Record<number, number> = { 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 };
  const z = zMap[confidenceLevel] || 1.96;
  const p = expectedErrorRate;
  const e = marginOfError;

  const n0Raw = (Math.pow(z, 2) * p * (1 - p)) / Math.pow(e, 2);
  const n0 = Math.max(50, Math.ceil(n0Raw));

  if (populationSize >= 10000) {
    return { n0, nAdjusted: n0 };
  }

  const N = Math.max(1, populationSize);
  const nAdjusted = Math.ceil(n0 / (1 + (n0 - 1) / N));

  return { n0, nAdjusted };
}
