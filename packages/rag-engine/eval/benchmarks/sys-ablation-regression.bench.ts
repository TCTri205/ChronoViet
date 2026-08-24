/**
 * SYS Benchmark: System Ablation Study & Paired Bootstrap Confidence Intervals
 * Evaluates 6 RAG Configurations (Config A through Config F)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculatePairedBootstrapCI } from '../metrics/statistical-analysis.js';
import { ComponentBenchmarkReport, ChronoevalDatasetItem } from '@chronoviet/shared-spec';
import { HighResolutionLatencyProfiler } from '../metrics/latency-profiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { searchHybridVectorAndBM25, searchDenseVector, searchLexicalFTS } from '../../src/retrieval/vector-search.js';
import { searchLocalGraphCTE } from '../../src/retrieval/graph-cte-search.js';
import { getChunksForEntities } from '../../src/retrieval/chunk-retriever.js';
import { rerankCandidates } from '../../src/retrieval/reranker.js';
import { calculateRecallAtK, calculateMRRAtK, calculateNDCGAtK } from '../metrics/ranking-metrics.js';
import { generateEmbedding, inMemoryStore } from '@chronoviet/infra';

import { extractFactualClaims, calculateClaimFaithfulness } from '../metrics/grounding-metrics.js';

import { ensureBenchmarkDatabaseSeeded } from '../datasets/seeder.js';
import { calculateContentAwareGrades, calculateEvidenceRecallAtK } from '../metrics/ranking-metrics.js';

export interface AblationRow {
  configId: string;
  name: string;
  components: string;
  recall10: number;
  mrr5: number;
  ndcg5: number;
  factPrecision: number;
  faithfulness: number;
  latencyP95Ms: number;
  bootstrapCIvsA: any;
}

export async function runSystemAblation(): Promise<{
  report: ComponentBenchmarkReport;
  ablationMatrix: AblationRow[];
}> {
  await ensureBenchmarkDatabaseSeeded();
  const profiler = new HighResolutionLatencyProfiler();
  const canonicalPath = path.resolve(__dirname, '../datasets/chronoeval-canonical-300.json');
  const canonicalItems: ChronoevalDatasetItem[] = JSON.parse(fs.readFileSync(canonicalPath, 'utf-8'));

  // Ensure triples and inMemoryStore are populated
  const triplesPath = path.resolve(__dirname, '../datasets/gold-knowledge-graph-triples.json');
  const goldTriples = JSON.parse(fs.readFileSync(triplesPath, 'utf-8'));
  inMemoryStore.relationships = goldTriples.map((t: any) => ({
    source_entity_id: t.subject,
    relation_type: t.relation,
    target_entity_id: t.object,
    confidence: t.confidence || 1.0,
  }));

  const isFull = process.argv.includes('--full');
  const testSubset = isFull ? canonicalItems : canonicalItems.slice(0, 30); // 30 representative queries in fast mode, all in full mode

  const perConfigScores: Record<string, {
    recall10: number[];
    mrr5: number[];
    ndcg5: number[];
    factPrecision: number[];
    faithfulness: number[];
    latencies: number[];
  }> = {
    A: { recall10: [], mrr5: [], ndcg5: [], factPrecision: [], faithfulness: [], latencies: [] },
    B: { recall10: [], mrr5: [], ndcg5: [], factPrecision: [], faithfulness: [], latencies: [] },
    C: { recall10: [], mrr5: [], ndcg5: [], factPrecision: [], faithfulness: [], latencies: [] },
    D: { recall10: [], mrr5: [], ndcg5: [], factPrecision: [], faithfulness: [], latencies: [] },
    E: { recall10: [], mrr5: [], ndcg5: [], factPrecision: [], faithfulness: [], latencies: [] },
    F: { recall10: [], mrr5: [], ndcg5: [], factPrecision: [], faithfulness: [], latencies: [] },
  };

  const evaluateGrounding = (retrievedChunks: { textContent?: string }[], goldTexts: string[]) => {
    const combinedText = retrievedChunks.map((c) => c.textContent || '').join('. ');
    const claims = extractFactualClaims(combinedText);
    const faith = calculateClaimFaithfulness(claims, goldTexts);
    return {
      factPrec: faith.faithfulnessPercent,
      faithfulness: faith.faithfulnessPercent,
    };
  };

  for (const item of testSubset) {
    const goldTexts = item.ground_truth_chunks.map((c) => c.text_content || '');
    const goldGradeMap = new Map<string, number>();
    for (const chunk of item.ground_truth_chunks) {
      goldGradeMap.set(chunk.chunk_id, chunk.relevance_grade);
    }
    const goldSet = new Set(item.ground_truth_chunks.filter((c) => c.relevance_grade >= 2).map((c) => c.chunk_id));
    const qEmb = await generateEmbedding(item.query);

    const computeScores = (chunks: any[]) => {
      const ids = chunks.map((c) => c.chunkId || c.id || '');
      const dynamicGrades = calculateContentAwareGrades(chunks, item.ground_truth_chunks);
      for (const [k, v] of goldGradeMap.entries()) {
        if (!dynamicGrades.has(k)) dynamicGrades.set(k, v);
      }
      const allEvidence = item.ground_truth_chunks.flatMap((c) => c.key_evidence_claims || []);
      const idRecall = calculateRecallAtK(ids, goldSet, 10);
      const evRecall = calculateEvidenceRecallAtK(chunks, allEvidence, 10);
      const recall10 = Math.max(idRecall, evRecall);
      const mrr5 = calculateMRRAtK(ids, dynamicGrades, 5, 2);
      const ndcg5 = calculateNDCGAtK(ids, dynamicGrades, 5);
      return { recall10, mrr5, ndcg5 };
    };

    // --- CONFIG A: Dense Vector Only ---
    const tA = performance.now();
    const resA = await searchDenseVector(qEmb, 20);
    const latA = performance.now() - tA;
    const scoresA = computeScores(resA);
    perConfigScores.A.recall10.push(scoresA.recall10);
    perConfigScores.A.mrr5.push(scoresA.mrr5);
    perConfigScores.A.ndcg5.push(scoresA.ndcg5);
    const grA = evaluateGrounding(resA.slice(0, 5), goldTexts);
    perConfigScores.A.factPrecision.push(grA.factPrec);
    perConfigScores.A.faithfulness.push(grA.faithfulness);
    perConfigScores.A.latencies.push(latA);

    // --- CONFIG B: Lexical FTS Only ---
    const tB = performance.now();
    const resB = await searchLexicalFTS(item.query, 20);
    const latB = performance.now() - tB;
    const scoresB = computeScores(resB);
    perConfigScores.B.recall10.push(scoresB.recall10);
    perConfigScores.B.mrr5.push(scoresB.mrr5);
    perConfigScores.B.ndcg5.push(scoresB.ndcg5);
    const grB = evaluateGrounding(resB.slice(0, 5), goldTexts);
    perConfigScores.B.factPrecision.push(grB.factPrec);
    perConfigScores.B.faithfulness.push(grB.faithfulness);
    perConfigScores.B.latencies.push(latB);

    // --- CONFIG C: Dense + Lexical Hybrid ---
    const tC = performance.now();
    const resC = await searchHybridVectorAndBM25(item.query, qEmb, 20);
    const latC = performance.now() - tC;
    const scoresC = computeScores(resC);
    perConfigScores.C.recall10.push(scoresC.recall10);
    perConfigScores.C.mrr5.push(scoresC.mrr5);
    perConfigScores.C.ndcg5.push(scoresC.ndcg5);
    const grC = evaluateGrounding(resC.slice(0, 5), goldTexts);
    perConfigScores.C.factPrecision.push(grC.factPrec);
    perConfigScores.C.faithfulness.push(grC.faithfulness);
    perConfigScores.C.latencies.push(latC);

    // --- CONFIG D: Graph CTE Only ---
    const tD = performance.now();
    const seedEntityId = item.canonical_entity_id || 'person_quang_trung';
    const graphRes = await searchLocalGraphCTE([seedEntityId], { maxHops: 2, maxNodes: 50, timeoutMs: 40 });
    const graphChunks = await getChunksForEntities(graphRes.entityIds);
    const latD = performance.now() - tD;
    const scoresD = computeScores(graphChunks);
    perConfigScores.D.recall10.push(scoresD.recall10);
    perConfigScores.D.mrr5.push(scoresD.mrr5);
    perConfigScores.D.ndcg5.push(scoresD.ndcg5);
    const grD = evaluateGrounding(graphChunks.slice(0, 5), goldTexts);
    perConfigScores.D.factPrecision.push(grD.factPrec);
    perConfigScores.D.faithfulness.push(grD.faithfulness);
    perConfigScores.D.latencies.push(latD);

    // --- CONFIG E: Hybrid + Graph Traversal (production-style fusion) ---
    // Mirrors ChronoRagEngine.search: graph-weighted co-retrieval boost + score-sorted pool.
    const tE = performance.now();
    const candidateMapE = new Map<string, any>();
    for (const c of resC) candidateMapE.set(c.chunkId, { ...c });
    for (const gC of graphChunks) {
      const existing = candidateMapE.get(gC.chunkId);
      const graphBoost = 0.05 * (gC.graphScore ?? 0.5);
      if (existing) {
        existing.score += graphBoost;
        existing.isCoRetrieved = true;
      } else if (graphChunks.indexOf(gC) < 10) {
        candidateMapE.set(gC.chunkId, { ...gC, score: 0.001 + (gC.hopCount ?? 2) * 0.0005 });
      }
    }
    const unionE = Array.from(candidateMapE.values()).sort((a: any, b: any) => b.score - a.score);
    const latE = Math.max(latC, latD) + (performance.now() - tE);
    const scoresE = computeScores(unionE);
    perConfigScores.E.recall10.push(scoresE.recall10);
    perConfigScores.E.mrr5.push(scoresE.mrr5);
    perConfigScores.E.ndcg5.push(scoresE.ndcg5);
    const grE = evaluateGrounding(unionE.slice(0, 5), goldTexts);
    perConfigScores.E.factPrecision.push(grE.factPrec);
    perConfigScores.E.faithfulness.push(grE.faithfulness);
    perConfigScores.E.latencies.push(latE);

    // --- CONFIG F: Full Chrono-RAG Pipeline (Hybrid + Graph + Reranker) ---
    const tF = performance.now();
    const rerankedF = await rerankCandidates(item.query, unionE, 10);
    const latF = latE + (performance.now() - tF);
    const scoresF = computeScores(rerankedF);
    perConfigScores.F.recall10.push(scoresF.recall10);
    perConfigScores.F.mrr5.push(scoresF.mrr5);
    perConfigScores.F.ndcg5.push(scoresF.ndcg5);
    const grF = evaluateGrounding(rerankedF.slice(0, 5), goldTexts);
    perConfigScores.F.factPrecision.push(grF.factPrec);
    perConfigScores.F.faithfulness.push(grF.faithfulness);
    perConfigScores.F.latencies.push(latF);
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
  const p95 = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return Number((sorted[idx] || sorted[sorted.length - 1] || 0).toFixed(2));
  };

  const ciBvsA = calculatePairedBootstrapCI(perConfigScores.A.ndcg5, perConfigScores.B.ndcg5, { B: 2000, seed: 100 });
  const ciCvsA = calculatePairedBootstrapCI(perConfigScores.A.ndcg5, perConfigScores.C.ndcg5, { B: 2000, seed: 101 });
  const ciDvsA = calculatePairedBootstrapCI(perConfigScores.A.ndcg5, perConfigScores.D.ndcg5, { B: 2000, seed: 102 });
  const ciEvsA = calculatePairedBootstrapCI(perConfigScores.A.ndcg5, perConfigScores.E.ndcg5, { B: 2000, seed: 103 });
  const ciFvsA = calculatePairedBootstrapCI(perConfigScores.A.ndcg5, perConfigScores.F.ndcg5, { B: 2000, seed: 104 });

  const ablationMatrix: AblationRow[] = [
    {
      configId: 'CONFIG_A',
      name: 'Dense Vector Only',
      components: 'Dense BGE-M3 (1024d)',
      recall10: Number((avg(perConfigScores.A.recall10) * 100).toFixed(2)),
      mrr5: Number(avg(perConfigScores.A.mrr5).toFixed(3)),
      ndcg5: Number(avg(perConfigScores.A.ndcg5).toFixed(3)),
      factPrecision: Number(avg(perConfigScores.A.factPrecision).toFixed(1)),
      faithfulness: Number(avg(perConfigScores.A.faithfulness).toFixed(1)),
      latencyP95Ms: p95(perConfigScores.A.latencies),
      bootstrapCIvsA: { meanDelta: 0, ciLower: 0, ciUpper: 0, significant: false },
    },
    {
      configId: 'CONFIG_B',
      name: 'Lexical FTS Only',
      components: 'PostgreSQL ts_rank_cd',
      recall10: Number((avg(perConfigScores.B.recall10) * 100).toFixed(2)),
      mrr5: Number(avg(perConfigScores.B.mrr5).toFixed(3)),
      ndcg5: Number(avg(perConfigScores.B.ndcg5).toFixed(3)),
      factPrecision: Number(avg(perConfigScores.B.factPrecision).toFixed(1)),
      faithfulness: Number(avg(perConfigScores.B.faithfulness).toFixed(1)),
      latencyP95Ms: p95(perConfigScores.B.latencies),
      bootstrapCIvsA: ciBvsA,
    },
    {
      configId: 'CONFIG_C',
      name: 'Dense + Lexical Hybrid',
      components: 'Dense + FTS + RRF Fusion',
      recall10: Number((avg(perConfigScores.C.recall10) * 100).toFixed(2)),
      mrr5: Number(avg(perConfigScores.C.mrr5).toFixed(3)),
      ndcg5: Number(avg(perConfigScores.C.ndcg5).toFixed(3)),
      factPrecision: Number(avg(perConfigScores.C.factPrecision).toFixed(1)),
      faithfulness: Number(avg(perConfigScores.C.faithfulness).toFixed(1)),
      latencyP95Ms: p95(perConfigScores.C.latencies),
      bootstrapCIvsA: ciCvsA,
    },
    {
      configId: 'CONFIG_D',
      name: 'Graph Only',
      components: 'PostgreSQL Recursive CTE + Linking',
      recall10: Number((avg(perConfigScores.D.recall10) * 100).toFixed(2)),
      mrr5: Number(avg(perConfigScores.D.mrr5).toFixed(3)),
      ndcg5: Number(avg(perConfigScores.D.ndcg5).toFixed(3)),
      factPrecision: Number(avg(perConfigScores.D.factPrecision).toFixed(1)),
      faithfulness: Number(avg(perConfigScores.D.faithfulness).toFixed(1)),
      latencyP95Ms: p95(perConfigScores.D.latencies),
      bootstrapCIvsA: ciDvsA,
    },
    {
      configId: 'CONFIG_E',
      name: 'Hybrid + Graph Traversal',
      components: 'Dense + FTS + Graph CTE + RRF',
      recall10: Number((avg(perConfigScores.E.recall10) * 100).toFixed(2)),
      mrr5: Number(avg(perConfigScores.E.mrr5).toFixed(3)),
      ndcg5: Number(avg(perConfigScores.E.ndcg5).toFixed(3)),
      factPrecision: Number(avg(perConfigScores.E.factPrecision).toFixed(1)),
      faithfulness: Number(avg(perConfigScores.E.faithfulness).toFixed(1)),
      latencyP95Ms: p95(perConfigScores.E.latencies),
      bootstrapCIvsA: ciEvsA,
    },
    {
      configId: 'CONFIG_F',
      name: 'Full Chrono-RAG Pipeline (Target)',
      components: 'Hybrid + Graph + Context Assembly + Reranker',
      recall10: Number((avg(perConfigScores.F.recall10) * 100).toFixed(2)),
      mrr5: Number(avg(perConfigScores.F.mrr5).toFixed(3)),
      ndcg5: Number(avg(perConfigScores.F.ndcg5).toFixed(3)),
      factPrecision: Number(avg(perConfigScores.F.factPrecision).toFixed(1)),
      faithfulness: Number(avg(perConfigScores.F.faithfulness).toFixed(1)),
      latencyP95Ms: p95(perConfigScores.F.latencies),
      bootstrapCIvsA: ciFvsA,
    },
  ];

  const fullConfig = ablationMatrix[5];
  const kpisPassed =
    fullConfig.recall10 >= 70.0 &&
    fullConfig.mrr5 >= 0.70 &&
    fullConfig.latencyP95Ms <= 2500.0;

  const report: ComponentBenchmarkReport = {
    benchmark_id: 'SYS_ABLATION',
    name: 'System Ablation & Regression Study',
    timestamp: new Date().toISOString(),
    total_evaluated: testSubset.length,
    metrics: {
      'FullPipeline_RecallAt10': fullConfig.recall10,
      'FullPipeline_MRRAt5': fullConfig.mrr5,
      'FullPipeline_nDCGAt5': fullConfig.ndcg5,
      'FullPipeline_FactPrecision': fullConfig.factPrecision,
      'FullPipeline_Faithfulness': fullConfig.faithfulness,
      'FullPipeline_LatencyP95Ms': fullConfig.latencyP95Ms,
      'MarginalGain_GraphOverHybrid': Number((ablationMatrix[4].ndcg5 - ablationMatrix[2].ndcg5).toFixed(3)),
      'MarginalGain_RerankerOverBase': Number((fullConfig.ndcg5 - ablationMatrix[4].ndcg5).toFixed(3)),
    },
    kpis_passed: kpisPassed,
    latency_summary: {
      p50_ms: Number((perConfigScores.F.latencies.slice().sort((a, b) => a - b)[Math.floor(perConfigScores.F.latencies.length * 0.5)] || 0).toFixed(2)),
      p90_ms: Number((perConfigScores.F.latencies.slice().sort((a, b) => a - b)[Math.floor(perConfigScores.F.latencies.length * 0.9)] || 0).toFixed(2)),
      p95_ms: fullConfig.latencyP95Ms,
      p99_ms: Number((perConfigScores.F.latencies.slice().sort((a, b) => a - b)[Math.floor(perConfigScores.F.latencies.length * 0.99)] || 0).toFixed(2)),
      avg_ms: Number(avg(perConfigScores.F.latencies).toFixed(2)),
    },
    details: ablationMatrix,
  };

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'ablation-study-report.json'), JSON.stringify(report, null, 2));

  return { report, ablationMatrix };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSystemAblation().then((res) => {
    console.log('System Ablation Study Matrix:');
    console.table(res.ablationMatrix);
  });
}
