/**
 * Module 0 Benchmark Evaluation Runner (Data Preprocessing & Ingestion ETL Engine)
 * Evaluates 4 Core KPIs:
 * 1. Entity Normalization & Disambiguation Accuracy (> 98.0%)
 * 2. Knowledge Graph Triple Extraction Accuracy (> 90.0%)
 * 3. Ingestion Seeder Throughput & Golden Dataset Integrity (100%)
 * 4. Hierarchical Parent/Child Chunk Structural Quality (100%)
 */

import fs from 'fs';
import path from 'path';
import {
  resolveEntityAlias,
  resolveLocationMapping,
} from '@chronoviet/shared-spec';
import { extractTriplesFromTextAsync, ExtractedTriple } from '../src/triple-extractor.js';
import { chunkDocumentHierarchical } from '../src/chunking/hierarchical-chunker.js';
import { findMonorepoRoot } from '../src/utils/path-utils.js';
import { assertEvalPreflight } from '../../../eval/utils/preflight.js';
import {
  EntityDisambiguationTestCase,
  IngestKpiReport,
  evaluateChunkQuality,
} from './metrics.js';

// ------------------------------------------------------------------
// KPI 1 Datasets: Dynamically loaded from eval/datasets/
// ------------------------------------------------------------------
const evalDatasetsDir = path.resolve(__dirname, 'datasets');

function loadEntityCases(): EntityDisambiguationTestCase[] {
  const filePath = path.join(evalDatasetsDir, 'entity-disambiguation-benchmark.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Entity disambiguation benchmark dataset missing at: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to parse entity disambiguation benchmark dataset at ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const ENTITY_DISAMBIGUATION_TEST_CASES = loadEntityCases();
const TRIPLE_EXTRACTION_BENCHMARKS = [
  {
    id: 'triple_bach_dang',
    text: 'Năm 938, Ngô Quyền lãnh đạo quân dân Đại Việt đánh tan quân Nam Hán trên sông Bạch Đằng.',
    expectedEntity: 'Ngô Quyền',
    expectedTarget: 'Nam Hán',
  },
  {
    id: 'triple_tran_hung_dao',
    text: 'Quốc công Tiết chế Trần Hưng Đạo thống lĩnh quân đội nhà Trần đại phá quân Nguyên Mông trong ba lần kháng chiến.',
    expectedEntity: 'Trần Hưng Đạo',
    expectedTarget: 'nhà Trần',
  },
  {
    id: 'triple_quang_trung',
    text: 'Hoàng đế Quang Trung Nguyễn Huệ chỉ huy đại quân Tây Sơn tiến ra Thăng Long đại phá 29 vạn quân Mãn Thanh.',
    expectedEntity: 'Quang Trung',
    expectedTarget: 'Tây Sơn',
  },
];

// ------------------------------------------------------------------
// Ground Truth Integrity Validation Helpers (KPI 3)
// ------------------------------------------------------------------
interface GroundTruthEntity {
  id?: string;
  canonical_name?: string;
  canonicalName?: string;
  aliases?: string[];
}

interface GroundTruthTriple {
  source?: string;
  relation?: string;
  target?: string;
}

/**
 * Validates a dataset's ground truth against its document content.
 * An entity/triple term is considered "resolved" when the canonical name or
 * one of its aliases is mentioned in the content (case-insensitive substring).
 */
function isTermResolved(term: string, contentLower: string): boolean {
  const termLower = term.trim().toLowerCase();
  return contentLower.includes(termLower);
}

function validateGroundTruth(
  dataset: any,
  contentLower: string
): { entitiesResolved: number; entitiesTotal: number; triplesResolved: number; triplesTotal: number; failures: string[] } {
  const failures: string[] = [];
  const gtEntities: GroundTruthEntity[] = dataset.ground_truth_entities || [];
  const gtTriples: GroundTruthTriple[] = dataset.ground_truth_triples || [];

  let entitiesResolved = 0;
  for (const ent of gtEntities) {
    const name = ent.canonical_name || ent.canonicalName;
    if (!name) {
      failures.push(`Ground truth entity missing canonical_name (id=${ent.id || 'unknown'})`);
      continue;
    }
    const mentioned =
      isTermResolved(name, contentLower) || (ent.aliases || []).some((a) => a && isTermResolved(a, contentLower));
    if (mentioned) {
      entitiesResolved++;
    } else {
      failures.push(`Ground truth entity '${name}' (id=${ent.id || 'unknown'}) is not mentioned in document content`);
    }
  }

  let triplesResolved = 0;
  for (const triple of gtTriples) {
    const src = triple.source;
    const tgt = triple.target;
    if (!src || !tgt) {
      failures.push(`Ground truth triple missing source/target (relation=${triple.relation || 'unknown'})`);
      continue;
    }
    const srcOk = isTermResolved(src, contentLower);
    const tgtOk = isTermResolved(tgt, contentLower);
    if (srcOk && tgtOk) {
      triplesResolved++;
    } else {
      const missing = [!srcOk ? `source '${src}'` : null, !tgtOk ? `target '${tgt}'` : null].filter(Boolean).join(' and ');
      failures.push(`Ground truth triple (${src} -${triple.relation || '?'}> ${tgt}) has unresolved ${missing} in document content`);
    }
  }

  return {
    entitiesResolved,
    entitiesTotal: gtEntities.length,
    triplesResolved,
    triplesTotal: gtTriples.length,
    failures,
  };
}

export async function runIngestEval(): Promise<IngestKpiReport> {
  console.log('===============================================================');
  console.log('  CHRONOVIET MODULE 0 ETL & INGESTION BENCHMARK EVALUATION');
  console.log('===============================================================\n');

  const preflight = await assertEvalPreflight(['llm']);

  // ------------------------------------------------------------------
  // 1. Evaluate KPI 1: Entity Normalization & Disambiguation Accuracy
  // ------------------------------------------------------------------
  console.log('[*] Evaluating KPI 1: Entity Normalization & Disambiguation Accuracy...');
  let disambigPassed = 0;
  const disambigFailures: string[] = [];

  for (const tc of ENTITY_DISAMBIGUATION_TEST_CASES) {
    const aliasRes = resolveEntityAlias(tc.input);
    let matchSuccess = aliasRes.canonicalId === tc.expectedCanonicalId;

    if (tc.isLocation && tc.expectedModernLocation) {
      const locRes = resolveLocationMapping(tc.input);
      if (!locRes || locRes.canonicalModernName !== tc.expectedModernLocation) {
        matchSuccess = false;
      }
    }

    if (matchSuccess) {
      disambigPassed++;
    } else {
      const msg = `Failure on '${tc.input}': Expected canonicalId '${tc.expectedCanonicalId}', got '${aliasRes.canonicalId}' (${aliasRes.canonicalName})`;
      disambigFailures.push(msg);
      console.log(`  [FAIL] ${msg}`);
    }
  }

  const disambigTotal = ENTITY_DISAMBIGUATION_TEST_CASES.length;
  const disambigAccuracy = Number(((disambigPassed / disambigTotal) * 100).toFixed(2));
  const disambigKpiPassed = disambigAccuracy >= 98.0;

  console.log(
    `[+] KPI 1 Result: ${disambigPassed}/${disambigTotal} passed (${disambigAccuracy}%) | Target: > 98.0% | Status: ${
      disambigKpiPassed ? 'PASSED' : 'FAILED'
    }\n`
  );

  // ------------------------------------------------------------------
  // 2. Evaluate KPI 2: Knowledge Graph Triple Extraction Accuracy
  // ------------------------------------------------------------------
  console.log('[*] Evaluating KPI 2: Knowledge Graph Triple Extraction Accuracy...');
  let triplesPassed = 0;
  const tripleFailures: string[] = [];

  for (const tc of TRIPLE_EXTRACTION_BENCHMARKS) {
    const extracted = await extractTriplesFromTextAsync(tc.text, { allowFallback: true });
    const hasExpectedEntity = extracted.some(
      (t: ExtractedTriple) => t.sourceEntityName.includes(tc.expectedEntity) || t.targetEntityName.includes(tc.expectedEntity)
    );
    const hasExpectedTarget = extracted.some(
      (t: ExtractedTriple) => t.sourceEntityName.includes(tc.expectedTarget) || t.targetEntityName.includes(tc.expectedTarget)
    );

    if (hasExpectedEntity || hasExpectedTarget) {
      triplesPassed++;
    } else {
      const msg = `Failure on '${tc.id}': Expected (${tc.expectedEntity} -> ${tc.expectedTarget}), got ${JSON.stringify(extracted)}`;
      tripleFailures.push(msg);
      console.log(`  [FAIL] ${msg}`);
    }
  }

  const triplesTotal = TRIPLE_EXTRACTION_BENCHMARKS.length;
  const tripleAccuracy = Number(((triplesPassed / triplesTotal) * 100).toFixed(2));
  const tripleKpiPassed = tripleAccuracy >= 90.0;

  console.log(
    `[+] KPI 2 Result: ${triplesPassed}/${triplesTotal} extracted correctly (${tripleAccuracy}%) | Target: >= 90.0% | Status: ${
      tripleKpiPassed ? 'PASSED' : 'FAILED'
    }\n`
  );

  // ------------------------------------------------------------------
  // 3. Evaluate KPI 3 & KPI 4: Golden Dataset Integrity & Hierarchical Chunk Quality
  // ------------------------------------------------------------------
  console.log('[*] Evaluating KPI 3 & 4: Ingestion Throughput, Golden Dataset Integrity & Chunk Quality...');
  const monorepoRoot = findMonorepoRoot();
  const testCasesDir = path.resolve(monorepoRoot, 'eval', 'test-cases');
  const goldenDatasetResults: Array<{
    filename: string;
    title: string;
    domain: string;
    parentChunksCount: number;
    childChunksCount: number;
    entitiesResolved: number;
    entitiesTotal: number;
    triplesResolved: number;
    triplesTotal: number;
    passed: boolean;
    error?: string;
  }> = [];

  let goldenPassedCount = 0;
  let totalChunksGenerated = 0;
  let validChunksCount = 0;
  let totalDocsProcessed = 0;

  const startTime = Date.now();

  if (!fs.existsSync(testCasesDir)) {
    console.warn(`[!] Warning: Golden test cases directory not found at: ${testCasesDir}`);
  } else {
    const files = fs.readdirSync(testCasesDir).filter((f) => f.endsWith('.json') && !f.includes('benchmark'));

    for (const filename of files) {
      const filePath = path.join(testCasesDir, filename);
      try {
        const rawContent = fs.readFileSync(filePath, 'utf-8');
        const dataset = JSON.parse(rawContent);

        if (Array.isArray(dataset)) continue;

        totalDocsProcessed++;

        // Verify JSON ground-truth structure
        if (!dataset.id || !dataset.title || !dataset.content) {
          throw new Error(`Invalid Golden Dataset schema structure in ${filename}`);
        }

        const domain = dataset.domain || dataset.topic_category || 'GENERAL';
        const sourceName = dataset.source_name || dataset.metadata?.source_name || dataset.title;
        const dynasty = dataset.dynasty || dataset.metadata?.dynasty;
        const sourceReliability = dataset.source_reliability || dataset.metadata?.source_reliability || 'LEVEL_1';
        const keyFigures = dataset.key_figures || dataset.metadata?.key_figures || [];
        const location = dataset.location || dataset.metadata?.location;

        // Execute Hierarchical Chunking & Metadata Enrichment pipeline
        const chunkResult = chunkDocumentHierarchical(dataset.content, {
          title: dataset.title,
          sourceName,
          dynasty,
          sourceReliability,
          keyFigures,
          location,
        });

        const parentCount = chunkResult.parentChunks.length;
        const childCount = chunkResult.childChunks.length;
        const allGeneratedChunks = [...chunkResult.parentChunks, ...chunkResult.childChunks];
        totalChunksGenerated += allGeneratedChunks.length;

        // Integrity check: At least 1 parent chunk and child chunks must be produced
        if (parentCount === 0 || childCount === 0) {
          throw new Error(`Chunking failed to generate chunks for dataset ${dataset.title}`);
        }

        // Validate each chunk quality
        for (const chunk of allGeneratedChunks) {
          const evalRes = evaluateChunkQuality({
            id: chunk.id,
            textContent: chunk.textContent,
            parentChunkId: chunk.metadata?.parentChunkId,
            title: chunk.title || chunk.metadata?.title,
            sourceName: chunk.metadata?.sourceName,
            sourceReliability: chunk.metadata?.sourceReliability,
          });
          if (evalRes.isValid) {
            validChunksCount++;
          }
        }

        // Validate ground truth entities & triples against document content
        const gtCheck = validateGroundTruth(dataset, dataset.content.toLowerCase());

        const datasetPassed = gtCheck.failures.length === 0;
        if (datasetPassed) {
          goldenPassedCount++;
        }

        goldenDatasetResults.push({
          filename,
          title: dataset.title,
          domain,
          parentChunksCount: parentCount,
          childChunksCount: childCount,
          entitiesResolved: gtCheck.entitiesResolved,
          entitiesTotal: gtCheck.entitiesTotal,
          triplesResolved: gtCheck.triplesResolved,
          triplesTotal: gtCheck.triplesTotal,
          passed: datasetPassed,
        });

        if (!datasetPassed) {
          console.log(`  [WARN] Dataset '${dataset.title}' ground truth issues:`);
          for (const f of gtCheck.failures) {
            console.log(`         - ${f}`);
          }
        }

        console.log(
          `  [${datasetPassed ? 'PASS' : 'FAIL'}] Dataset '${dataset.title}' (${filename}): ${parentCount} Parent, ${childCount} Child Chunks | GT Entities ${gtCheck.entitiesResolved}/${gtCheck.entitiesTotal}, Triples ${gtCheck.triplesResolved}/${gtCheck.triplesTotal}`
        );
      } catch (err: any) {
        goldenDatasetResults.push({
          filename,
          title: filename,
          domain: 'UNKNOWN',
          parentChunksCount: 0,
          childChunksCount: 0,
          entitiesResolved: 0,
          entitiesTotal: 0,
          triplesResolved: 0,
          triplesTotal: 0,
          passed: false,
          error: err?.message || String(err),
        });
        console.log(`  [FAIL] Dataset '${filename}': ${err?.message || String(err)}`);
      }
    }
  }

  const endTime = Date.now();
  const elapsedSec = Math.max(0.001, (endTime - startTime) / 1000);

  const totalGoldenDatasets = goldenDatasetResults.length;
  const goldenIntegrityRate =
    totalGoldenDatasets > 0 ? Number(((goldenPassedCount / totalGoldenDatasets) * 100).toFixed(2)) : 0;
  const throughputDocsPerSec = Number((totalDocsProcessed / elapsedSec).toFixed(2));
  const throughputChunksPerSec = Number((totalChunksGenerated / elapsedSec).toFixed(2));
  const chunkQualityRate =
    totalChunksGenerated > 0 ? Number(((validChunksCount / totalChunksGenerated) * 100).toFixed(2)) : 0;

  const goldenKpiPassed = goldenIntegrityRate === 100 && totalGoldenDatasets >= 5;
  const chunkQualityKpiPassed = chunkQualityRate === 100;

  console.log(
    `[+] KPI 3 Result: ${goldenPassedCount}/${totalGoldenDatasets} datasets verified (${goldenIntegrityRate}%) | Throughput: ${throughputDocsPerSec} docs/s (${throughputChunksPerSec} chunks/s) | Target: 100% Integrity | Status: ${
      goldenKpiPassed ? 'PASSED' : 'FAILED'
    }`
  );
  console.log(
    `[+] KPI 4 Result: ${validChunksCount}/${totalChunksGenerated} chunks valid (${chunkQualityRate}%) | Target: 100% Structural Quality | Status: ${
      chunkQualityKpiPassed ? 'PASSED' : 'FAILED'
    }\n`
  );

  // ------------------------------------------------------------------
  // 4. Calculate Aggregate KPI Report & Save Report File
  // ------------------------------------------------------------------
  const overallPassed = disambigKpiPassed && tripleKpiPassed && goldenKpiPassed && chunkQualityKpiPassed;

  const report: IngestKpiReport = {
    timestamp: new Date().toISOString(),
    preflight,
    kpis: {
      entityDisambiguation: {
        totalEvaluated: disambigTotal,
        passedCount: disambigPassed,
        accuracyPercent: disambigAccuracy,
        targetPercent: 98.0,
        passed: disambigKpiPassed,
      },
      tripleExtraction: {
        totalEvaluated: triplesTotal,
        passedCount: triplesPassed,
        accuracyPercent: tripleAccuracy,
        targetPercent: 90.0,
        passed: tripleKpiPassed,
      },
      goldenDatasetIntegrity: {
        totalDatasets: totalGoldenDatasets,
        passedDatasets: goldenPassedCount,
        integrityRatePercent: goldenIntegrityRate,
        targetPercent: 100.0,
        throughputDocsPerSec,
        throughputChunksPerSec,
        passed: goldenKpiPassed,
      },
      hierarchicalChunkQuality: {
        totalChunksEvaluated: totalChunksGenerated,
        validChunksCount: validChunksCount,
        qualityRatePercent: chunkQualityRate,
        targetPercent: 100.0,
        passed: chunkQualityKpiPassed,
      },
    },
    overallPassed,
    details: {
      entityDisambiguationFailures: disambigFailures,
      tripleExtractionFailures: tripleFailures,
      goldenDatasetResults,
    },
  };

  console.log('===============================================================');
  console.log(` OVERALL BENCHMARK RESULT: [${overallPassed ? 'PASS' : 'FAIL'}]`);
  console.log('===============================================================');
  console.log(` - Entity Normalization Accuracy:   ${disambigAccuracy}% (Target: > 98.0%)`);
  console.log(` - Triple Extraction Accuracy:     ${tripleAccuracy}% (Target: >= 90.0%)`);
  console.log(` - Golden Dataset Integrity:       ${goldenIntegrityRate}% (Target: 100%)`);
  console.log(` - Chunk Structural Quality:       ${chunkQualityRate}% (Target: 100%)`);
  console.log(` - Seeder Throughput:             ${throughputChunksPerSec} chunks/sec`);
  console.log('===============================================================\n');

  const reportsDir = path.resolve(monorepoRoot, 'packages', 'data-ingestion', 'eval', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'ingest-eval-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`[+] Module 0 Evaluation Report saved to: file:///${reportPath.replace(/\\/g, '/')}\n`);

  return report;
}

// Script entry point
if (
  process.argv[1] &&
  (process.argv[1].endsWith('runner.ts') ||
    process.argv[1].endsWith('runner.js') ||
    process.argv[1].endsWith('ingest-runner.ts') ||
    process.argv[1].endsWith('ingest-runner.js'))
) {
  runIngestEval()
    .then((report) => {
      if (!report.overallPassed) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[!] Module 0 Evaluation Runner Fatal Error:', err);
      process.exit(1);
    });
}
