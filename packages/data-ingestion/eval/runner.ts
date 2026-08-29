/**
 * Master Evaluation Runner on Real Database for Module 0 (Data Ingestion Engine)
 * Directly evaluates real data stored in PostgreSQL across both Vector & Graph branches:
 * 1. Stage 1 (Vector & Chunk Store): document_chunks, embeddings health, word count bounds, metadata.
 * 2. Stage 2 (Knowledge Graph): relationships, verified triples rate, quarantine buffer, directionality matrix, connectivity.
 * 3. End-to-End Ingestion Health Scorecard & Diagnostic Report.
 */

import fs from 'fs';
import path from 'path';
import { isPgAvailable, query, inMemoryStore, isEmbeddingServiceHealthy } from '@chronoviet/infra';
import { runVectorEval, VectorChunkEvalReport } from './vector-eval-runner.js';
import { runGraphEval, GraphEvalReport } from './graph-eval-runner.js';
import { findMonorepoRoot } from '../src/utils/path-utils.js';

process.env.EVAL_STRICT = 'true';

export interface MasterIngestRealDataReport {
  timestamp: string;
  isPgMode: boolean;
  stage1Vector: VectorChunkEvalReport;
  stage2Graph: GraphEvalReport;
  summary: {
    totalChunks: number;
    totalEntities: number;
    totalRelationships: number;
    vectorHealthPercent: number;
    verifiedTriplesRatePercent: number;
    directionalityCompliancePercent: number;
    overallHealthIndex: number;
  };
  overallPassed: boolean;
}

export async function runMasterIngestEval(): Promise<MasterIngestRealDataReport> {
  console.log('================================================================');
  console.log(' CHRONOVIET MODULE 0: MASTER REAL DATABASE EVALUATION RUNNER');
  console.log('================================================================\n');

  // Pre-flight check: Strict real DB requirement
  const pgConnected = await isPgAvailable();
  if (!pgConnected) {
    console.error('================================================================');
    console.error(' [!] FATAL PRE-FLIGHT ERROR: PostgreSQL is OFFLINE');
    console.error('================================================================');
    console.error(' Real database evaluation requires an active PostgreSQL instance with pgvector.');
    console.error(' In-memory fallback is disabled in STRICT evaluation mode.\n');
    console.error(' 👉 Action required: Start database infrastructure with:');
    console.error('    pnpm stack:infra\n');
    console.error('================================================================\n');
    throw new Error('[STRICT_EVAL] PostgreSQL is offline. Run `pnpm stack:infra` first.');
  }

  // Pre-flight check: Strict Embedding Server requirement
  const embHealth = await isEmbeddingServiceHealthy();
  if (!embHealth.healthy) {
    console.error('================================================================');
    console.error(' [!] FATAL PRE-FLIGHT ERROR: Embedding Server is OFFLINE');
    console.error('================================================================');
    console.error(' Real database vector retrieval evaluation requires an active BGE-M3 Embedding Engine.');
    console.error(` Details: ${embHealth.details || 'Port 8090 unreachable'}`);
    console.error(' Pseudo-random vector fallback is disabled in STRICT evaluation mode.\n');
    console.error(' 👉 Action required: Start local Embedding Server with:');
    console.error('    pnpm ai:emb   (or: pnpm ai:lite / pnpm ai:start)\n');
    console.error('================================================================\n');
    throw new Error(`[STRICT_EVAL] Embedding Engine is offline (${embHealth.details}). Run \`pnpm ai:emb\` first.`);
  }

  console.log(`[*] Target Storage: PostgreSQL (Real Live DB - ${embHealth.provider})\n`);

  // 1. Evaluate Stage 1: Vector & Chunk Store
  const vectorReport = await runVectorEval();

  // 2. Evaluate Stage 2: Knowledge Graph
  const graphReport = await runGraphEval();

  // 3. Aggregate Master Health Index
  const vectorWeight = 0.5;
  const graphWeight = 0.5;

  const vectorScore =
    vectorReport.embeddingsHealth.healthPercent * 0.5 +
    vectorReport.wordCountCompliancePercent * 0.3 +
    vectorReport.metadataCompleteness.completenessScorePercent * 0.2;

  const graphScore =
    graphReport.verifiedTriplesRatePercent * 0.5 +
    graphReport.directionalityCompliance.compliancePercent * 0.3 +
    graphReport.graphConnectivity.connectedRatePercent * 0.2;

  const overallHealthIndex = Number(
    (vectorScore * vectorWeight + graphScore * graphWeight).toFixed(1)
  );

  const overallPassed = vectorReport.overallPassed && graphReport.overallPassed && overallHealthIndex >= 98.0;

  console.log('================================================================');
  console.log(` MASTER REAL DATABASE INGESTION EVALUATION: [${overallPassed ? 'PASS ✅' : 'FAIL ❌'}]`);
  console.log('================================================================');
  console.log(` • Master Health Index:            ${overallHealthIndex}/100.0`);
  console.log(` • Stage 1 (Vector & Chunks):       ${vectorReport.overallPassed ? 'PASS ✅' : 'FAIL ❌'} (${vectorReport.totalChunks} chunks, ${vectorReport.embeddingsHealth.healthPercent}% vector health)`);
  console.log(` • Stage 2 (Knowledge Graph):      ${graphReport.overallPassed ? 'PASS ✅' : 'FAIL ❌'} (${graphReport.totalRelationships} triples, ${graphReport.verifiedTriplesRatePercent}% verified)`);
  console.log(` • Directionality Matrix:          ${graphReport.directionalityCompliance.compliancePercent}% compliant`);
  console.log(` • Graph Connectivity:             ${graphReport.graphConnectivity.connectedRatePercent}% nodes linked`);
  console.log('================================================================\n');

  const monorepoRoot = findMonorepoRoot();
  const reportsDir = path.resolve(monorepoRoot, 'packages', 'data-ingestion', 'eval', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const report: MasterIngestRealDataReport = {
    timestamp: new Date().toISOString(),
    isPgMode: pgConnected,
    stage1Vector: vectorReport,
    stage2Graph: graphReport,
    summary: {
      totalChunks: vectorReport.totalChunks,
      totalEntities: graphReport.totalEntities,
      totalRelationships: graphReport.totalRelationships,
      vectorHealthPercent: vectorReport.embeddingsHealth.healthPercent,
      verifiedTriplesRatePercent: graphReport.verifiedTriplesRatePercent,
      directionalityCompliancePercent: graphReport.directionalityCompliance.compliancePercent,
      overallHealthIndex,
    },
    overallPassed,
  };

  const reportJsonPath = path.join(reportsDir, 'ingest-eval-report.json');
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf-8');

  const reportMdPath = path.join(reportsDir, 'ingest-eval-report.md');
  const markdownContent = `# ChronoViet Real Database Ingestion Evaluation Report

- **Timestamp:** ${report.timestamp}
- **Database Mode:** \`${pgConnected ? 'PostgreSQL (pgvector HNSW)' : 'In-Memory Store'}\`
- **Master Overall Status:** **${overallPassed ? 'PASSED ✅' : 'FAILED ❌'}** (Health Index: \`${overallHealthIndex}/100.0\`)

## 1. Executive Summary

| Layer | Evaluated Entities | Key Quality Metric | Health Status |
| :--- | :--- | :--- | :---: |
| **Stage 1 (Vector Store)** | \`${vectorReport.totalChunks}\` Chunks | **${vectorReport.embeddingsHealth.healthPercent}%** Vector Health, **${vectorReport.wordCountCompliancePercent}%** Word Bounds | ${vectorReport.overallPassed ? '🟢 PASS' : '🔴 FAIL'} |
| **Stage 2 (Knowledge Graph)** | \`${graphReport.totalRelationships}\` Triples | **${graphReport.verifiedTriplesRatePercent}%** Verified Triples, **${graphReport.directionalityCompliance.compliancePercent}%** Directionality | ${graphReport.overallPassed ? '🟢 PASS' : '🔴 FAIL'} |

## 2. Stage 1 (Vector & Chunk Store) Breakdown
- **Total Chunks:** ${vectorReport.totalChunks} (Parent: ${vectorReport.parentChunksCount}, Child: ${vectorReport.childChunksCount})
- **Word Count Compliance:** ${vectorReport.wordCountCompliancePercent}%
- **1024d Vector Health:** ${vectorReport.embeddingsHealth.healthPercent}%
- **Metadata Completeness:** ${vectorReport.metadataCompleteness.completenessScorePercent}%

## 3. Stage 2 (Knowledge Graph) Breakdown
- **Total Entities:** ${graphReport.totalEntities}
- **Total Relationships:** ${graphReport.totalRelationships} (Verified: ${graphReport.verifiedTriplesCount})
- **Quarantined Triples:** ${graphReport.quarantineStats.totalQuarantined} (Low Confidence: ${graphReport.quarantineStats.lowConfidenceCount}, Dangling: ${graphReport.quarantineStats.danglingCount})
- **Unmapped Entities:** ${graphReport.unmappedEntitiesCount}
- **Directionality Compliance:** ${graphReport.directionalityCompliance.compliancePercent}%
- **Graph Connectivity:** ${graphReport.graphConnectivity.connectedRatePercent}%
`;

  fs.writeFileSync(reportMdPath, markdownContent, 'utf-8');
  console.log(`[+] Master Real Database Ingestion Report saved:`);
  console.log(`    - JSON: file:///${reportJsonPath.replace(/\\/g, '/')}`);
  console.log(`    - Markdown: file:///${reportMdPath.replace(/\\/g, '/')}\n`);

  return report;
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('runner.ts') || process.argv[1].endsWith('runner.js'))
) {
  runMasterIngestEval()
    .then((report) => {
      process.exit(report.overallPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('[!] Master Ingestion Evaluation Error:', err);
      process.exit(1);
    });
}
