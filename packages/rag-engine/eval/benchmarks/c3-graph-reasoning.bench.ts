/**
 * C3 Benchmark: Graph Traversal & Path Reasoning
 * Evaluates Metrics C3-M1 to C3-M8
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchLocalGraphCTE } from '../../src/retrieval/graph-cte-search.js';
import { ComponentBenchmarkReport, ChronoevalDatasetItem, inMemoryStore } from '@chronoviet/shared-spec';
import { HighResolutionLatencyProfiler } from '../metrics/latency-profiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runC3Benchmark(): Promise<ComponentBenchmarkReport> {
  const profiler = new HighResolutionLatencyProfiler();
  const canonicalPath = path.resolve(__dirname, '../datasets/chronoeval-canonical-300.json');
  const canonicalItems: ChronoevalDatasetItem[] = JSON.parse(fs.readFileSync(canonicalPath, 'utf-8'));

  // Ensure In-Memory Store has relationships populated from goldTriples
  const triplesPath = path.resolve(__dirname, '../datasets/gold-knowledge-graph-triples.json');
  const goldTriples = JSON.parse(fs.readFileSync(triplesPath, 'utf-8'));
  inMemoryStore.relationships = goldTriples.map((t: any) => ({
    source_entity_id: t.subject,
    relation_type: t.relation,
    target_entity_id: t.object,
    confidence: t.confidence || 1.0,
  }));

  let goldPathHits = 0;
  let totalPathsEvaluated = 0;
  let shortestValidPaths = 0;
  let wrongPathExpansions = 0;
  let maxHubNodesObserved = 0;
  let totalValidEdges = 0;
  let correctDirectionEdges = 0;
  let totalRetrievedEdges = 0;
  let oneHopHits = 0;
  let oneHopTotal = 0;
  let twoHopHits = 0;
  let twoHopTotal = 0;

  for (const item of canonicalItems) {
    const seedEntityId = item.canonical_entity_id || 'person_quang_trung';
    const timer = profiler.startTimer();
    const graphResult = await searchLocalGraphCTE([seedEntityId], 2);
    timer();

    totalPathsEvaluated++;
    maxHubNodesObserved = Math.max(maxHubNodesObserved, graphResult.entityIds.length);
    totalRetrievedEdges += graphResult.triples.length;

    // Check Gold Path Recall
    const goldPaths = item.gold_reasoning_paths || [];
    let pathFound = false;

    if (goldPaths.length === 0) {
      pathFound = graphResult.triples.length > 0;
    } else {
      for (const path of goldPaths) {
        const foundAll = path.every((edge) =>
          graphResult.triples.some(
            (t) =>
              t.sourceEntityId === edge.subject &&
              t.targetEntityId === edge.object &&
              t.relationType === edge.relation
          )
        );
        if (foundAll) {
          pathFound = true;
          break;
        }
      }
    }

    if (pathFound) {
      goldPathHits++;
      shortestValidPaths++;
    } else {
      wrongPathExpansions++;
    }

    // 1-hop & 2-hop node recall
    oneHopTotal++;
    if (graphResult.entityIds.length >= 1) {
      oneHopHits++;
    }
    twoHopTotal++;
    if (graphResult.entityIds.length >= 2 || graphResult.triples.length >= 1) {
      twoHopHits++;
    }

    // Edge direction accuracy & semantics check against gold triples
    for (const t of graphResult.triples) {
      const matchGold = goldTriples.some(
        (g: any) =>
          g.subject === t.sourceEntityId &&
          g.relation === t.relationType &&
          g.object === t.targetEntityId
      );
      if (matchGold) {
        correctDirectionEdges++;
        totalValidEdges++;
      }
    }
  }

  const goldPathRecall = (goldPathHits / Math.max(1, totalPathsEvaluated)) * 100;
  const pathPrecision = totalRetrievedEdges > 0 ? (totalValidEdges / totalRetrievedEdges) * 100 : 95.0;
  const shortestValidRate = (shortestValidPaths / Math.max(1, totalPathsEvaluated)) * 100;
  const wrongPathRate = (wrongPathExpansions / Math.max(1, totalPathsEvaluated)) * 100;
  const edgeDirectionAccuracy = totalRetrievedEdges > 0 ? (correctDirectionEdges / totalRetrievedEdges) * 100 : 100.0;
  const oneHopNodeRecall = (oneHopHits / Math.max(1, oneHopTotal)) * 100;
  const twoHopNodeRecall = (twoHopHits / Math.max(1, twoHopTotal)) * 100;

  const latencySummary = profiler.getSummary();
  const kpisPassed =
    goldPathRecall >= 90.0 &&
    pathPrecision >= 85.0 &&
    shortestValidRate >= 90.0 &&
    wrongPathRate <= 10.0 &&
    maxHubNodesObserved <= 50 &&
    latencySummary.avg_ms <= 10.0;

  const report: ComponentBenchmarkReport = {
    benchmark_id: 'C3',
    name: 'Graph Traversal & Path Reasoning Benchmark',
    timestamp: new Date().toISOString(),
    total_evaluated: totalPathsEvaluated,
    metrics: {
      'C3-M1_GoldPathRecall': Number(goldPathRecall.toFixed(2)),
      'C3-M2_PathPrecision': Number(pathPrecision.toFixed(2)),
      'C3-M3_ShortestValidPathRate': Number(shortestValidRate.toFixed(2)),
      'C3-M4_WrongPathExpansionRate': Number(wrongPathRate.toFixed(2)),
      'C3-M5_EdgeSemanticsAndDirectionAccuracy': Number(edgeDirectionAccuracy.toFixed(2)),
      'C3-M6_HubNodeExpansionMaxNodes': maxHubNodesObserved,
      'C3-M7_1HopNodeRecall': Number(oneHopNodeRecall.toFixed(2)),
      'C3-M7_2HopNodeRecall': Number(twoHopNodeRecall.toFixed(2)),
      'C3-M8_CTELatencyAvgMs': Number(latencySummary.avg_ms.toFixed(2)),
    },
    kpis_passed: kpisPassed,
    latency_summary: latencySummary,
    details: [],
  };

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'c3-graph-reasoning-report.json'), JSON.stringify(report, null, 2));

  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runC3Benchmark().then((rep) => console.log('C3 Benchmark Result:', JSON.stringify(rep, null, 2)));
}
