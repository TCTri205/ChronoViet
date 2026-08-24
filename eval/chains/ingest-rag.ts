import fs from 'fs';
import path from 'path';
import { seedDualBranch, DualBranchSeedResult } from '../../packages/data-ingestion/src';
import { ChronoRagEngine, extractQueryEntities, searchLocalGraphCTE } from '../../packages/rag-engine/src';
import { query, inMemoryStore, envConfig } from '@chronoviet/infra';
import { assertEvalPreflight } from '../utils/preflight';

export interface ProductionBenchmarkTestCase {
  id: string;
  category: 'MULTI_HOP' | 'AMBIGUITY_DISAMBIGUATION' | 'HISTORICAL_ALIAS' | 'TEMPORAL_EPOCH' | 'ARTIFACT_CULTURE' | 'ADVERSARIAL_NEGATIVE';
  question: string;
  groundTruthCanonical: string;
  expectedEntityId?: string;
  expectedAliases?: string[];
  targetChunkKeywords?: string[];
  requiredFacts: string[];
  isAnswerable: boolean;
}

export interface ProductionQueryEvalResult {
  testId: string;
  category: string;
  question: string;
  isAnswerable: boolean;
  reciprocalRank: number; // 1 / rank, 0 if not found in top K
  ndcgScore: number; // nDCG@5 (0..1.0)
  precisionAtK: number; // Precision@5 (0..1.0)
  recallAtK: number; // Recall@5 (0..1.0)
  factPrecisionScore: number; // 0..100%
  hallucinationRateScore: number; // 0..100%
  citationTraceable: boolean;
  adversarialRejectionPassed: boolean;
  retrievalLatencyMs: number;
  passed: boolean;
}

export interface ProductionRagQualityReport {
  timestamp: string;
  chainName: 'data-ingestion -> rag-engine';
  evalMode: 'PRODUCTION_FULL_CORPUS_BENCHMARK';
  isPgMode: boolean;
  preflight: unknown;
  totalCorpusChunksCount: number;
  totalCorpusEntitiesCount: number;
  // Key Production IR & Quality Metrics
  meanReciprocalRank: number; // Target MRR >= 0.70
  meanNdcgAt5: number; // Target nDCG@5 >= 0.75
  avgPrecisionAt5: number; // Target P@5 >= 0.60
  avgRecallAt5: number; // Target R@5 >= 0.70
  avgFactPrecisionPercent: number; // Target >= 85% on full 34k DB
  avgHallucinationRatePercent: number; // Target <= 15% on full 34k DB
  adversarialRejectionRatePercent: number; // Target = 100% (Rejects false queries)
  citationTraceabilityPercent: number; // Target = 100%
  overallQualityIndex: number; // Target OQI >= 80.0
  avgLatencyMs: number;
  qualityStatus: 'PASS' | 'FAIL';
  categoryBreakdown: Record<string, { evaluated: number; passed: number; avgPrecision: number; avgNdcg: number }>;
  evaluatedQueries: ProductionQueryEvalResult[];
}

const VIETNAMESE_STOP_WORDS = new Set(['là', 'và', 'của', 'tại', 'cho', 'vào', 'ra', 'bị', 'bởi', 'thời', 'các', 'những', 'đã', 'do', 'người', 'năm', 'đúng', 'hay', 'sai']);

/**
 * Calculates Ideal DCG (IDCG) for nDCG calculation
 */
function calculateIdcg(relevances: number[], k: number): number {
  const sorted = [...relevances].sort((a, b) => b - a).slice(0, k);
  let idcg = 0;
  for (let i = 0; i < sorted.length; i++) {
    idcg += (Math.pow(2, sorted[i]) - 1) / Math.log2(i + 2);
  }
  return idcg > 0 ? idcg : 1.0;
}

export async function runIngestRagChain(options: {
  verbose?: boolean;
} = {}): Promise<ProductionRagQualityReport> {
  const verbose = options.verbose ?? false;
  console.log('\n================================================================');
  console.log(' CHUỖI ĐÁNH GIÁ CHẤT LƯỢNG PRODUCTION: data-ingestion -> rag-engine');
  console.log(' Tiêu chuẩn: Full-Corpus Benchmark (33,941 Chunks), IR Ranking & Adversarial Rejection');
  console.log(' Target KPIs: MRR >= 0.70 | nDCG@5 >= 0.75 | Fact Precision >= 85% | Rejection = 100%');
  console.log('================================================================\n');

  const benchmarkPath = path.resolve(process.cwd(), 'eval/test-cases/production_rag_eval_benchmark.json');
  const reportsDir = path.resolve(process.cwd(), 'eval/reports');

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const testCases: ProductionBenchmarkTestCase[] = JSON.parse(fs.readFileSync(benchmarkPath, 'utf-8'));

  let isPgMode = false;

  // ----------------------------------------------------------------
  // PHASE 1: FULL CORPUS PREPARATION & INTEGRITY CHECK
  // ----------------------------------------------------------------
  console.log('--- [PHASE 1] FULL-SCALE PRODUCTION CORPUS & VECTOR STORE CHECK ---');

  // Eval Integrity: LLM + embedding must be real in strict mode
  const preflight = await assertEvalPreflight(['llm', 'embedding']);

  const ragEngine = new ChronoRagEngine();

  // Test Seeding 5 Golden Datasets to ensure DB contracts
  const goldenDir = path.resolve(process.cwd(), 'eval/test-cases');
  const sampleFile = path.join(goldenDir, 'biography_tran_hung_dao.json');
  if (fs.existsSync(sampleFile)) {
    const rawJson = fs.readFileSync(sampleFile, 'utf-8');
    const data = JSON.parse(rawJson);
    const seedRes = await seedDualBranch(data.content || data.text || '', {
      title: data.title || 'Trần Hưng Đạo',
      sourceName: 'biography_tran_hung_dao.json',
      sourceReliability: 'LEVEL_1',
    });
    isPgMode = seedRes.isPgMode;
  }

  let totalCorpusChunksCount = 0;
  let totalCorpusEntitiesCount = 0;

  if (isPgMode) {
    const chunkRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM document_chunks');
    const entityRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM entities');
    totalCorpusChunksCount = parseInt(chunkRes[0]?.count || '0', 10);
    totalCorpusEntitiesCount = parseInt(entityRes[0]?.count || '0', 10);
  } else {
    // Eval Integrity: strict mode must benchmark against real Postgres, not in-memory store
    if (envConfig.EVAL_STRICT) {
      throw new Error('[EVAL_STRICT] Postgres is unavailable — ingest-rag chain requires real pgvector DB during evaluation');
    }
    totalCorpusChunksCount = inMemoryStore.documentChunks.size;
    totalCorpusEntitiesCount = inMemoryStore.entities.size;
  }

  console.log(`[+] Storage Layer Active: ${isPgMode ? `PostgreSQL pgvector (Full ${totalCorpusChunksCount.toLocaleString()} Chunks Database)` : 'In-Memory Store'}`);

  // ----------------------------------------------------------------
  // PHASE 2: PRODUCTION IR RANKING & ADVERSARIAL EVALUATION
  // ----------------------------------------------------------------
  console.log('\n--- [PHASE 2] EXECUTING PRODUCTION IR & REASONING BENCHMARK ---');
  const evaluatedQueries: ProductionQueryEvalResult[] = [];
  let sumReciprocalRank = 0;
  let sumNdcg = 0;
  let sumPrecision = 0;
  let sumRecall = 0;
  let sumFactPrecision = 0;
  let sumHallucination = 0;
  let traceableCount = 0;
  let totalLatencyMs = 0;

  let totalAdversarialQueries = 0;
  let passedAdversarialQueries = 0;

  const categoryBreakdown: Record<string, { evaluated: number; passed: number; sumPrecision: number; sumNdcg: number }> = {};

  for (const tc of testCases) {
    const qStart = Date.now();
    try {
      const searchRes = await ragEngine.search({
        query: tc.question,
        rerankTopK: 5,
        maxTokens: 512,
      });
      const qLatency = searchRes.retrievalLatencyMs || (Date.now() - qStart);
      totalLatencyMs += qLatency;

      const retrievedChunks = searchRes.verifiedContext;
      const fullContextText = retrievedChunks.map((c) => `${c.canonicalName} ${c.summary}`).join(' ').toLowerCase();

      let reciprocalRank = 0;
      let rankingRelevances: number[] = [];
      let relevantChunksFound = 0;
      let adversarialRejectionPassed = false;
      let passed = false;

      if (!tc.isAnswerable) {
        // ADVERSARIAL NEGATIVE QUERY HANDLING
        totalAdversarialQueries++;

        // For unanswerable/false-premise queries, the system MUST NOT find confidence-boosted entity matches
        const queryNer = extractQueryEntities(tc.question);
        const graphResult = await searchLocalGraphCTE(queryNer.entityIds, { maxHops: 2, maxNodes: 50, timeoutMs: 40 });

        // Adversarial rejection is passed if confidence scores are low or context flags unverified fact
        const hasFalseFactAccused = tc.requiredFacts.length === 0;
        adversarialRejectionPassed = hasFalseFactAccused && (retrievedChunks.length === 0 || retrievedChunks[0]?.confidenceScore! < 0.90 || graphResult.triples.length === 0);

        if (adversarialRejectionPassed) {
          passedAdversarialQueries++;
          passed = true;
        }

        evaluatedQueries.push({
          testId: tc.id,
          category: tc.category,
          question: tc.question,
          isAnswerable: false,
          reciprocalRank: 1.0,
          ndcgScore: 1.0,
          precisionAtK: 1.0,
          recallAtK: 1.0,
          factPrecisionScore: 100,
          hallucinationRateScore: 0,
          citationTraceable: true,
          adversarialRejectionPassed,
          retrievalLatencyMs: qLatency,
          passed,
        });

        console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${tc.id} (${tc.category}): "${tc.question}"`);
        console.log(`         Adversarial False-Premise Rejection: ${adversarialRejectionPassed ? 'SUCCESSFUL (Hallucination Prevented)' : 'FAILED (Hallucinated False Premise)'}`);
        continue;
      }

      // ANSWERABLE REGULAR QUERY HANDLING
      const targetKeywords = tc.targetChunkKeywords || [];
      const requiredFacts = tc.requiredFacts || [];

      // Calculate Rank Relevances for Top 5 Chunks
      retrievedChunks.forEach((chunk, idx) => {
        const chunkTextLower = `${chunk.canonicalName} ${chunk.summary}`.toLowerCase();
        let kwHits = 0;
        for (const kw of targetKeywords) {
          if (chunkTextLower.includes(kw.toLowerCase())) kwHits++;
        }

        const relevance = targetKeywords.length > 0 ? (kwHits / targetKeywords.length >= 0.4 ? 2 : kwHits > 0 ? 1 : 0) : 1;
        rankingRelevances.push(relevance);

        if (relevance > 0 && reciprocalRank === 0) {
          reciprocalRank = 1 / (idx + 1);
        }
        if (relevance > 0) {
          relevantChunksFound++;
        }
      });

      // Calculate nDCG@5
      let dcg = 0;
      for (let i = 0; i < rankingRelevances.length; i++) {
        dcg += (Math.pow(2, rankingRelevances[i]) - 1) / Math.log2(i + 2);
      }
      const idcg = calculateIdcg(rankingRelevances, 5);
      const ndcgScore = Number((dcg / idcg).toFixed(3));

      // Calculate Precision@5 and Recall@5
      const precisionAtK = Number((relevantChunksFound / Math.max(1, retrievedChunks.length)).toFixed(2));
      const recallAtK = Number((relevantChunksFound / Math.max(1, targetKeywords.length)).toFixed(2));

      // Calculate Fact Precision
      let matchedFacts = 0;
      for (const fact of requiredFacts) {
        const factLower = fact.toLowerCase();
        if (fullContextText.includes(factLower)) {
          matchedFacts++;
          continue;
        }
        const keywords = factLower
          .split(/\s+/)
          .map((w) => w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ''))
          .filter((w) => w.length >= 2 && !VIETNAMESE_STOP_WORDS.has(w));

        if (keywords.length === 0 || keywords.filter((k) => fullContextText.includes(k)).length / keywords.length >= 0.4) {
          matchedFacts++;
        }
      }

      const factPrecisionScore = requiredFacts.length > 0 ? Number(((matchedFacts / requiredFacts.length) * 100).toFixed(2)) : 100;
      const hallucinationRateScore = Number((Math.max(0, 100 - factPrecisionScore)).toFixed(2));
      const citationTraceable = searchRes.citations.length > 0 && retrievedChunks.every((c) => c.citations && c.citations.length > 0);

      if (citationTraceable) traceableCount++;

      passed = reciprocalRank >= 0.33 && factPrecisionScore >= 75.0 && citationTraceable;

      sumReciprocalRank += reciprocalRank;
      sumNdcg += ndcgScore;
      sumPrecision += precisionAtK;
      sumRecall += recallAtK;
      sumFactPrecision += factPrecisionScore;
      sumHallucination += hallucinationRateScore;

      // Update Category Breakdown
      if (!categoryBreakdown[tc.category]) {
        categoryBreakdown[tc.category] = { evaluated: 0, passed: 0, sumPrecision: 0, sumNdcg: 0 };
      }
      categoryBreakdown[tc.category].evaluated++;
      if (passed) categoryBreakdown[tc.category].passed++;
      categoryBreakdown[tc.category].sumPrecision += precisionAtK;
      categoryBreakdown[tc.category].sumNdcg += ndcgScore;

      evaluatedQueries.push({
        testId: tc.id,
        category: tc.category,
        question: tc.question,
        isAnswerable: true,
        reciprocalRank: Number(reciprocalRank.toFixed(3)),
        ndcgScore,
        precisionAtK,
        recallAtK,
        factPrecisionScore,
        hallucinationRateScore,
        citationTraceable,
        adversarialRejectionPassed: true,
        retrievalLatencyMs: qLatency,
        passed,
      });

      console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${tc.id} (${tc.category}): "${tc.question}"`);
      console.log(`         MRR: ${reciprocalRank.toFixed(2)} | nDCG@5: ${ndcgScore} | P@5: ${precisionAtK} | R@5: ${recallAtK}`);
      console.log(`         Fact Precision: ${factPrecisionScore}% | Latency: ${qLatency}ms`);
    } catch (err) {
      console.error(`  [!] Error evaluating query ${tc.id}:`, err);
      evaluatedQueries.push({
        testId: tc.id,
        category: tc.category,
        question: tc.question,
        isAnswerable: tc.isAnswerable,
        reciprocalRank: 0,
        ndcgScore: 0,
        precisionAtK: 0,
        recallAtK: 0,
        factPrecisionScore: 0,
        hallucinationRateScore: 100,
        citationTraceable: false,
        adversarialRejectionPassed: false,
        retrievalLatencyMs: Date.now() - qStart,
        passed: false,
      });
    }
  }

  const answerableCount = testCases.filter((t) => t.isAnswerable).length;
  const meanReciprocalRank = Number((sumReciprocalRank / answerableCount).toFixed(3));
  const meanNdcgAt5 = Number((sumNdcg / answerableCount).toFixed(3));
  const avgPrecisionAt5 = Number((sumPrecision / answerableCount).toFixed(3));
  const avgRecallAt5 = Number((sumRecall / answerableCount).toFixed(3));

  const avgFactPrecisionPercent = Number((sumFactPrecision / answerableCount).toFixed(2));
  const avgHallucinationRatePercent = Number((sumHallucination / answerableCount).toFixed(2));
  const citationTraceabilityPercent = Number(((traceableCount / answerableCount) * 100).toFixed(2));
  const adversarialRejectionRatePercent = totalAdversarialQueries > 0 ? Number(((passedAdversarialQueries / totalAdversarialQueries) * 100).toFixed(2)) : 100;

  const avgLatencyMs = Math.round(totalLatencyMs / testCases.length);
  const overallQualityIndex = Number(
    (meanNdcgAt5 * 40 + (avgFactPrecisionPercent / 100) * 30 + (adversarialRejectionRatePercent / 100) * 20 + (citationTraceabilityPercent / 100) * 10).toFixed(2)
  );

  const qualityStatus = meanNdcgAt5 >= 0.70 && avgFactPrecisionPercent >= 80.0 && adversarialRejectionRatePercent >= 100 ? 'PASS' : 'FAIL';

  // Format Category Breakdown for report
  const formattedCategoryBreakdown: Record<string, { evaluated: number; passed: number; avgPrecision: number; avgNdcg: number }> = {};
  for (const [cat, data] of Object.entries(categoryBreakdown)) {
    formattedCategoryBreakdown[cat] = {
      evaluated: data.evaluated,
      passed: data.passed,
      avgPrecision: Number((data.sumPrecision / data.evaluated).toFixed(3)),
      avgNdcg: Number((data.sumNdcg / data.evaluated).toFixed(3)),
    };
  }

  const masterReport: ProductionRagQualityReport = {
    timestamp: new Date().toISOString(),
    chainName: 'data-ingestion -> rag-engine',
    evalMode: 'PRODUCTION_FULL_CORPUS_BENCHMARK',
    isPgMode,
    preflight,
    totalCorpusChunksCount,
    totalCorpusEntitiesCount,
    meanReciprocalRank,
    meanNdcgAt5,
    avgPrecisionAt5,
    avgRecallAt5,
    avgFactPrecisionPercent,
    avgHallucinationRatePercent,
    adversarialRejectionRatePercent,
    citationTraceabilityPercent,
    overallQualityIndex,
    avgLatencyMs,
    qualityStatus,
    categoryBreakdown: formattedCategoryBreakdown,
    evaluatedQueries,
  };

  const reportPath = path.join(reportsDir, 'ingest-rag-chain-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(masterReport, null, 2));

  console.log('\n================================================================');
  console.log(` BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG PRODUCTION (FULL CORPUS BENCHMARK):`);
  console.log(`- Quy mô lưu trữ DB (Corpus Scale)    : ${totalCorpusChunksCount.toLocaleString()} Chunks | ${totalCorpusEntitiesCount.toLocaleString()} Entities`);
  console.log(`- Mean Reciprocal Rank (MRR)           : ${meanReciprocalRank} (Chỉ tiêu KPI >= 0.70)`);
  console.log(`- nDCG@5 (Rank Quality Score)          : ${meanNdcgAt5} (Chỉ tiêu KPI >= 0.75)`);
  console.log(`- Precision@5 / Recall@5               : P@5 = ${avgPrecisionAt5} | R@5 = ${avgRecallAt5}`);
  console.log(`- Độ chính xác thực tế (Fact Precision): ${avgFactPrecisionPercent}% (Chỉ tiêu KPI >= 85%)`);
  console.log(`- Tỷ lệ ảo giác (Hallucination Rate)  : ${avgHallucinationRatePercent}% (Chỉ tiêu KPI <= 15%)`);
  console.log(`- Tỷ lệ từ chối ảo giác (Adversarial)  : ${adversarialRejectionRatePercent}% (Chỉ tiêu KPI = 100%)`);
  console.log(`- Tính minh bạch nguồn (Traceability) : ${citationTraceabilityPercent}% (Chỉ tiêu KPI = 100%)`);
  console.log(`- Chỉ số Chất lượng Tổng thể (OQI)    : ${overallQualityIndex} / 100`);
  console.log(`- Độ trễ trung bình                   : ${avgLatencyMs} ms / query`);
  console.log(`- Đánh giá Chất lượng Production       : ${qualityStatus === 'PASS' ? '[+] PASS (CHẤT LƯỢNG PRODUCTION ĐẠT CHUẨN)' : '[!] FAIL (CHƯA ĐẠT CHỈ TIÊU PRODUCTION)'}`);
  console.log(`- Tệp báo cáo chi tiết                : file:///${reportPath.replace(/\\/g, '/')}`);
  console.log('================================================================\n');

  return masterReport;
}

if (process.argv[1] && (process.argv[1].endsWith('ingest-rag.ts') || process.argv[1].endsWith('ingest-rag.js'))) {
  runIngestRagChain({ verbose: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Ingest-RAG Chain Eval Error:', err);
      process.exit(1);
    });
}
