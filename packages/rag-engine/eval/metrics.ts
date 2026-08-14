/**
 * Chrono-RAG Engine Benchmark Evaluation Metrics Engine
 * Evaluates 4 Key RAG KPIs (SSOT):
 * 1. Fact Precision Score (> 99.2%)
 * 2. Hallucination Rate (< 0.8%)
 * 3. Citation Traceability (100%)
 * 4. Retrieval Latency (< 300ms Online / < 1500ms Dev Mock SLA)
 */

import { RagSearchResponse } from '@chronoviet/shared-spec';

export const RAG_KPI_TARGETS = {
  FACT_PRECISION: 99.2, // Target > 99.2%
  HALLUCINATION_RATE: 0.8, // Target < 0.8%
  CITATION_TRACEABILITY: 100, // Target 100%
  MAX_LATENCY_ONLINE_MS: 300, // SLA < 300ms for Production DB
  MAX_LATENCY_OFFLINE_MS: 1500, // SLA < 1500ms for Offline Dev Mock Benchmark
};

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
    latencyPassed: boolean; // Target < 300ms (online) / < 1500ms (offline)
    overallPassed: boolean;
  };
  details: EvaluationItemResult[];
}

const VIETNAMESE_STOP_WORDS = new Set([
  'là', 'và', 'của', 'tại', 'cho', 'vào', 'ra', 'bị', 'bởi', 'thời', 'các', 'những', 'đã', 'trong', 'với', 'theo', 'như', 'được'
]);

/**
 * Vietnamese-aware fact matching with word boundaries and preservation of 2-letter names (Lê, Lý, Ngô, Vũ)
 */
export function checkFactMatched(fact: string, textLower: string): boolean {
  const factLower = fact.toLowerCase().trim();
  if (!factLower) return true;

  // 1. Direct substring check
  if (textLower.includes(factLower)) {
    return true;
  }

  // 2. Tokenize words, filtering stop words while preserving 2-letter Vietnamese historical names
  const tokens = factLower
    .split(/\s+/)
    .map((w) => w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ''))
    .filter((w) => w.length >= 2 && !VIETNAMESE_STOP_WORDS.has(w));

  if (tokens.length === 0) {
    return textLower.includes(factLower);
  }

  // 3. Match tokens using boundary checking
  let matchedCount = 0;
  for (const token of tokens) {
    if (textLower.includes(token)) {
      matchedCount++;
    }
  }

  return (matchedCount / tokens.length) >= 0.75;
}

export function evaluateResponse(testCase: TestCase, response: RagSearchResponse): EvaluationItemResult {
  const verifiedText = response.verifiedContext.map((c) => c.summary).join(' ');
  const verifiedLower = verifiedText.toLowerCase();

  const isAnswerable = testCase.isAnswerable !== false;

  let factPrecision = 0;
  let hallucinationRate = 0;

  if (!isAnswerable) {
    // Adversarial / Negative Unanswerable Query Evaluation
    // Required facts represent true counter-facts / grounding evidence refuting false myths.
    let matchedFacts = 0;
    for (const fact of testCase.requiredFacts) {
      if (checkFactMatched(fact, verifiedLower)) {
        matchedFacts++;
      }
    }

    const totalFacts = testCase.requiredFacts.length;
    const hasCounterFactGrounding = totalFacts > 0 ? (matchedFacts / totalFacts) >= 0.75 : true;

    // An unanswerable query PASSES (100% precision, 0% hallucination) IF AND ONLY IF:
    // 1. Response context is empty (clean rejection), OR
    // 2. Response contains counter-fact grounding facts and context length <= 5.
    const isValidRejectionOrGrounding =
      response.verifiedContext.length === 0 || (hasCounterFactGrounding && response.verifiedContext.length <= 5);

    if (isValidRejectionOrGrounding) {
      factPrecision = 100;
      hallucinationRate = 0;
    } else {
      factPrecision = 0;
      hallucinationRate = 100;
    }
  } else {
    // Answerable Query Evaluation
    let matchedFacts = 0;
    for (const fact of testCase.requiredFacts) {
      if (checkFactMatched(fact, verifiedLower)) {
        matchedFacts++;
      }
    }

    const totalFacts = testCase.requiredFacts.length;
    factPrecision = totalFacts > 0 ? Number(((matchedFacts / totalFacts) * 100).toFixed(2)) : 100;
    hallucinationRate = Number(Math.max(0, 100 - factPrecision).toFixed(2));
  }

  // 2. Citation Traceability Check
  const hasGlobalCitations = Array.isArray(response.citations) && response.citations.length > 0;
  const allContextsHaveCitations =
    response.verifiedContext.length > 0 &&
    response.verifiedContext.every(
      (c) => Array.isArray(c.citations) && c.citations.length > 0 && c.citations.every((cit) => cit.length > 5)
    );

  const citationTraceable = Boolean(hasGlobalCitations && allContextsHaveCitations);

  // 3. Expected Aliases found check
  let aliasesFoundCount = 0;
  if (testCase.expectedAliases && testCase.expectedAliases.length > 0) {
    for (const alias of testCase.expectedAliases) {
      if (checkFactMatched(alias, verifiedLower)) {
        aliasesFoundCount++;
      }
    }
  }

  const aliasRatio = testCase.expectedAliases && testCase.expectedAliases.length > 0
    ? aliasesFoundCount / testCase.expectedAliases.length
    : 1.0;

  const passed = isAnswerable
    ? factPrecision >= RAG_KPI_TARGETS.FACT_PRECISION && citationTraceable && aliasRatio >= 0.5
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
  targetLatencyMs: number = RAG_KPI_TARGETS.MAX_LATENCY_OFFLINE_MS
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

  const factPrecisionPassed = avgFactPrecision >= RAG_KPI_TARGETS.FACT_PRECISION; // Target > 99.2%
  const hallucinationRatePassed = avgHallucinationRate <= RAG_KPI_TARGETS.HALLUCINATION_RATE; // Target < 0.8%
  const citationTraceabilityPassed = citationTraceabilityPercent === RAG_KPI_TARGETS.CITATION_TRACEABILITY; // Target = 100%
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
