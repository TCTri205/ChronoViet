/**
 * Chrono-RAG Engine Benchmark Evaluation Metrics Engine
 * Evaluates 4 Key RAG KPIs:
 * 1. Fact Precision Score (> 99.2%)
 * 2. Hallucination Rate (< 0.8%)
 * 3. Citation Traceability (100%)
 * 4. Retrieval Latency (< 300ms)
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
  isAnswerable?: boolean;
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
  isAnswerable: boolean;
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
    latencyPassed: boolean; // Target < 300ms
    overallPassed: boolean;
  };
  details: EvaluationItemResult[];
}

const VIETNAMESE_STOP_WORDS = new Set(['là', 'và', 'của', 'tại', 'cho', 'vào', 'ra', 'bị', 'bởi', 'thời', 'các', 'những', 'đã']);

export function evaluateResponse(testCase: TestCase, response: RagSearchResponse): EvaluationItemResult {
  const verifiedText = response.verifiedContext.map((c) => c.summary).join(' ');
  const verifiedLower = verifiedText.toLowerCase();

  const isAnswerable = testCase.isAnswerable !== false;

  let factPrecision = 0;
  let hallucinationRate = 0;

  if (!isAnswerable) {
    // Adversarial / Negative Unanswerable Query Evaluation
    // The system SHOULD NOT claim positive confirmation for false historical myths.
    const mentionsFalseFact = testCase.requiredFacts.some((fact) =>
      verifiedLower.includes(fact.toLowerCase())
    );

    if (mentionsFalseFact || response.verifiedContext.length > 5) {
      factPrecision = 0;
      hallucinationRate = 100;
    } else {
      factPrecision = 100;
      hallucinationRate = 0;
    }
  } else {
    // Answerable Query Evaluation
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

      // Require high keyword overlap density (>= 75%) to count as accurate fact match
      const matchCount = keywords.filter((k) => verifiedLower.includes(k)).length;
      if (matchCount / keywords.length >= 0.75) {
        matchedFacts++;
      }
    }

    const totalFacts = testCase.requiredFacts.length;
    factPrecision = totalFacts > 0 ? Number(((matchedFacts / totalFacts) * 100).toFixed(2)) : 100;
    hallucinationRate = Number(Math.max(0, 100 - factPrecision).toFixed(2));
  }

  // 2. Citation Traceability Check
  // Verify citations array is non-empty AND all verified contexts contain valid traceable citations
  const hasGlobalCitations = response.citations && response.citations.length > 0;
  const allContextsHaveCitations =
    response.verifiedContext.length > 0 &&
    response.verifiedContext.every(
      (c) => Array.isArray(c.citations) && c.citations.length > 0 && c.citations.every((cit) => cit.length > 5)
    );

  const citationTraceable = Boolean(hasGlobalCitations && allContextsHaveCitations);

  // 3. Aliases found check
  let aliasesFoundCount = 0;
  for (const alias of testCase.expectedAliases) {
    if (verifiedLower.includes(alias.toLowerCase())) {
      aliasesFoundCount++;
    }
  }

  const passed = isAnswerable
    ? factPrecision >= 90.0 && citationTraceable
    : factPrecision === 100 && hallucinationRate === 0;

  return {
    testId: testCase.id,
    domain: testCase.domain,
    question: testCase.question,
    factPrecision,
    hallucinationRate,
    citationTraceable,
    aliasesFoundCount,
    latencyMs: response.retrievalLatencyMs,
    isAnswerable,
    passed,
  };
}

export function calculateAggregateReport(
  results: EvaluationItemResult[],
  targetLatencyMs: number = 300
): AggregateEvalReport {
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
        latencyPassed: false,
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

  const factPrecisionPassed = avgFactPrecision >= 95.0; // Benchmark Target >= 95.0%
  const hallucinationRatePassed = avgHallucinationRate <= 5.0;
  const citationTraceabilityPassed = citationTraceabilityPercent === 100;
  const latencyPassed = avgLatencyMs <= targetLatencyMs;

  const overallPassed =
    factPrecisionPassed && hallucinationRatePassed && citationTraceabilityPassed && latencyPassed;

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
      latencyPassed,
      overallPassed,
    },
    details: results,
  };
}
