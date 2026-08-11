/**
 * Module 0 Benchmark Evaluation Runner (Data Preprocessing & Ingestion ETL Engine)
 * Evaluates 3 Core KPIs:
 * 1. Entity Normalization & Disambiguation Accuracy (> 98.0%)
 * 2. Copyright License Compliance Audit Rate (100%)
 * 3. Ingestion Seeder Throughput & Golden Dataset Integrity (100%)
 */

import fs from 'fs';
import path from 'path';
import {
  resolveEntityAlias,
  resolveLocationMapping,
} from '../src/ingestion/text/historical-entity-mapper.js';
import { VisualAssetIngestor } from '../src/ingestion/media/visual-asset-ingestor.js';
import { chunkDocumentHierarchical } from '../src/ingestion/chunking/hierarchical-chunker.js';
import { findMonorepoRoot } from '../src/utils/path-utils.js';

export interface IngestKpiReport {
  timestamp: string;
  kpis: {
    entityDisambiguation: {
      totalEvaluated: number;
      passedCount: number;
      accuracyPercent: number;
      targetPercent: number;
      passed: boolean;
    };
    licenseCompliance: {
      totalEvaluated: number;
      passedCount: number;
      complianceRatePercent: number;
      targetPercent: number;
      passed: boolean;
    };
    goldenDatasetIntegrity: {
      totalDatasets: number;
      passedDatasets: number;
      integrityRatePercent: number;
      targetPercent: number;
      throughputDocsPerSec: number;
      throughputChunksPerSec: number;
      passed: boolean;
    };
  };
  overallPassed: boolean;
  details: {
    entityDisambiguationFailures: string[];
    licenseAuditFailures: string[];
    goldenDatasetResults: Array<{
      filename: string;
      title: string;
      domain: string;
      parentChunksCount: number;
      childChunksCount: number;
      passed: boolean;
      error?: string;
    }>;
  };
}

// ------------------------------------------------------------------
// KPI 1 Benchmark Dataset: Entity Normalization & Disambiguation Test Cases
// ------------------------------------------------------------------
const ENTITY_DISAMBIGUATION_TEST_CASES: Array<{
  input: string;
  expectedCanonicalId: string;
  expectedCanonicalName: string;
  isLocation?: boolean;
  expectedModernLocation?: string;
}> = [
  // Character Aliases (ALIAS_OF)
  { input: 'Nguyễn Huệ', expectedCanonicalId: 'person:quang_trung', expectedCanonicalName: 'Quang Trung' },
  { input: 'Quang Trung', expectedCanonicalId: 'person:quang_trung', expectedCanonicalName: 'Quang Trung' },
  { input: 'Hồ Thơm', expectedCanonicalId: 'person:quang_trung', expectedCanonicalName: 'Quang Trung' },
  { input: 'Bắc Bình Vương', expectedCanonicalId: 'person:quang_trung', expectedCanonicalName: 'Quang Trung' },
  { input: 'Tây Sơn Vương', expectedCanonicalId: 'person:quang_trung', expectedCanonicalName: 'Quang Trung' },
  
  { input: 'Trần Quốc Tuấn', expectedCanonicalId: 'person:tran_hung_dao', expectedCanonicalName: 'Trần Hưng Đạo' },
  { input: 'Trần Hưng Đạo', expectedCanonicalId: 'person:tran_hung_dao', expectedCanonicalName: 'Trần Hưng Đạo' },
  { input: 'Hưng Đạo Đại Vương', expectedCanonicalId: 'person:tran_hung_dao', expectedCanonicalName: 'Trần Hưng Đạo' },
  { input: 'Đức Thánh Trần', expectedCanonicalId: 'person:tran_hung_dao', expectedCanonicalName: 'Trần Hưng Đạo' },
  
  { input: 'Lê Lợi', expectedCanonicalId: 'person:le_loi', expectedCanonicalName: 'Lê Lợi' },
  { input: 'Bình Định Vương', expectedCanonicalId: 'person:le_loi', expectedCanonicalName: 'Lê Lợi' },
  { input: 'Lê Thái Tổ', expectedCanonicalId: 'person:le_loi', expectedCanonicalName: 'Lê Lợi' },
  
  { input: 'Ngô Quyền', expectedCanonicalId: 'person:ngo_quyen', expectedCanonicalName: 'Ngô Quyền' },
  { input: 'Tiền Ngô Vương', expectedCanonicalId: 'person:ngo_quyen', expectedCanonicalName: 'Ngô Quyền' },
  
  { input: 'Nguyễn Trãi', expectedCanonicalId: 'person:nguyen_trai', expectedCanonicalName: 'Nguyễn Trãi' },
  { input: 'Ức Trai', expectedCanonicalId: 'person:nguyen_trai', expectedCanonicalName: 'Nguyễn Trãi' },
  
  { input: 'Lý Thái Tổ', expectedCanonicalId: 'person:ly_thai_to', expectedCanonicalName: 'Lý Thái Tổ' },
  { input: 'Lý Công Uẩn', expectedCanonicalId: 'person:ly_thai_to', expectedCanonicalName: 'Lý Thái Tổ' },

  { input: 'Đinh Bộ Lĩnh', expectedCanonicalId: 'person:dinh_tien_hoang', expectedCanonicalName: 'Đinh Tiên Hoàng' },
  { input: 'Đinh Tiên Hoàng', expectedCanonicalId: 'person:dinh_tien_hoang', expectedCanonicalName: 'Đinh Tiên Hoàng' },
  { input: 'Vạn Thắng Vương', expectedCanonicalId: 'person:dinh_tien_hoang', expectedCanonicalName: 'Đinh Tiên Hoàng' },

  { input: 'Võ Nguyên Giáp', expectedCanonicalId: 'person:vo_nguyen_giap', expectedCanonicalName: 'Võ Nguyên Giáp' },
  { input: 'Anh Văn', expectedCanonicalId: 'person:vo_nguyen_giap', expectedCanonicalName: 'Võ Nguyên Giáp' },

  // Location Mappings across Eras (SAME_AS_LOCATION)
  { input: 'Thăng Long', expectedCanonicalId: 'location:ha_noi', expectedCanonicalName: 'Hà Nội', isLocation: true, expectedModernLocation: 'Hà Nội' },
  { input: 'Đông Quan', expectedCanonicalId: 'location:ha_noi', expectedCanonicalName: 'Hà Nội', isLocation: true, expectedModernLocation: 'Hà Nội' },
  { input: 'Đông Kinh', expectedCanonicalId: 'location:ha_noi', expectedCanonicalName: 'Hà Nội', isLocation: true, expectedModernLocation: 'Hà Nội' },
  { input: 'Đại La', expectedCanonicalId: 'location:ha_noi', expectedCanonicalName: 'Hà Nội', isLocation: true, expectedModernLocation: 'Hà Nội' },
  { input: 'Phú Xuân', expectedCanonicalId: 'location:hue', expectedCanonicalName: 'Huế', isLocation: true, expectedModernLocation: 'Huế' },
  { input: 'Thuận Hóa', expectedCanonicalId: 'location:hue', expectedCanonicalName: 'Huế', isLocation: true, expectedModernLocation: 'Huế' },
  { input: 'Sài Gòn', expectedCanonicalId: 'location:ho_chi_minh', expectedCanonicalName: 'Thành phố Hồ Chí Minh', isLocation: true, expectedModernLocation: 'Thành phố Hồ Chí Minh' },
  { input: 'Gia Định', expectedCanonicalId: 'location:ho_chi_minh', expectedCanonicalName: 'Thành phố Hồ Chí Minh', isLocation: true, expectedModernLocation: 'Thành phố Hồ Chí Minh' },
  { input: 'Hoa Lư', expectedCanonicalId: 'location:ninh_binh', expectedCanonicalName: 'Ninh Bình', isLocation: true, expectedModernLocation: 'Ninh Bình' },
];

// ------------------------------------------------------------------
// KPI 2 Benchmark Dataset: Copyright License Compliance Test Cases
// ------------------------------------------------------------------
const LICENSE_AUDIT_TEST_CASES: Array<{
  licenseInput: string;
  shouldAllow: boolean;
}> = [
  // Whitelisted Licenses (Must PASS audit)
  { licenseInput: 'PUBLIC_DOMAIN', shouldAllow: true },
  { licenseInput: 'CC0', shouldAllow: true },
  { licenseInput: 'CC_BY_4_0', shouldAllow: true },
  { licenseInput: 'CC_BY_SA_4_0', shouldAllow: true },

  // Non-Whitelisted Licenses (Must FAIL/REJECT audit)
  { licenseInput: 'ALL_RIGHTS_RESERVED', shouldAllow: false },
  { licenseInput: 'COMMERCIAL_ONLY', shouldAllow: false },
  { licenseInput: 'CC_BY_NC_4_0', shouldAllow: false },
  { licenseInput: 'PROPRIETARY', shouldAllow: false },
  { licenseInput: 'UNKNOWN', shouldAllow: false },
  { licenseInput: '', shouldAllow: false },
];

export async function runIngestEval(): Promise<IngestKpiReport> {
  console.log('===============================================================');
  console.log('  CHRONOVIET MODULE 0 ETL & INGESTION BENCHMARK EVALUATION');
  console.log('===============================================================\n');

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
  // 2. Evaluate KPI 2: Copyright License Compliance Audit Rate
  // ------------------------------------------------------------------
  console.log('[*] Evaluating KPI 2: Copyright License Compliance Audit Rate...');
  const ingestor = new VisualAssetIngestor();
  let licensePassed = 0;
  const licenseFailures: string[] = [];

  for (const tc of LICENSE_AUDIT_TEST_CASES) {
    const auditRes = ingestor.auditLicense(tc.licenseInput);
    if (auditRes.isWhitelisted === tc.shouldAllow) {
      licensePassed++;
    } else {
      const msg = `Failure on license '${tc.licenseInput}': Expected isWhitelisted=${tc.shouldAllow}, got ${auditRes.isWhitelisted}`;
      licenseFailures.push(msg);
      console.log(`  [FAIL] ${msg}`);
    }
  }

  const licenseTotal = LICENSE_AUDIT_TEST_CASES.length;
  const licenseAuditRate = Number(((licensePassed / licenseTotal) * 100).toFixed(2));
  const licenseKpiPassed = licenseAuditRate === 100;

  console.log(
    `[+] KPI 2 Result: ${licensePassed}/${licenseTotal} audited correctly (${licenseAuditRate}%) | Target: 100% | Status: ${
      licenseKpiPassed ? 'PASSED' : 'FAILED'
    }\n`
  );

  // ------------------------------------------------------------------
  // 3. Evaluate KPI 3: Ingestion Seeder Throughput & Golden Dataset Integrity
  // ------------------------------------------------------------------
  console.log('[*] Evaluating KPI 3: Ingestion Throughput & Golden Dataset Integrity...');
  const monorepoRoot = findMonorepoRoot();
  const testCasesDir = path.resolve(monorepoRoot, 'eval', 'test-cases');
  const goldenDatasetResults: Array<{
    filename: string;
    title: string;
    domain: string;
    parentChunksCount: number;
    childChunksCount: number;
    passed: boolean;
    error?: string;
  }> = [];

  let goldenPassedCount = 0;
  let totalChunksGenerated = 0;
  let totalDocsProcessed = 0;

  const startTime = Date.now();

  if (!fs.existsSync(testCasesDir)) {
    console.warn(`[!] Warning: Golden test cases directory not found at: ${testCasesDir}`);
  } else {
    const files = fs.readdirSync(testCasesDir).filter((f) => f.endsWith('.json'));

    for (const filename of files) {
      const filePath = path.join(testCasesDir, filename);
      try {
        const rawContent = fs.readFileSync(filePath, 'utf-8');
        const dataset = JSON.parse(rawContent);

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
        totalChunksGenerated += parentCount + childCount;

        // Integrity check: At least 1 parent chunk and child chunks must be produced
        if (parentCount === 0 || childCount === 0) {
          throw new Error(`Chunking failed to generate chunks for dataset ${dataset.title}`);
        }

        goldenPassedCount++;
        goldenDatasetResults.push({
          filename,
          title: dataset.title,
          domain,
          parentChunksCount: parentCount,
          childChunksCount: childCount,
          passed: true,
        });

        console.log(`  [PASS] Dataset '${dataset.title}' (${filename}): ${parentCount} Parent, ${childCount} Child Chunks`);
      } catch (err: any) {
        goldenDatasetResults.push({
          filename,
          title: filename,
          domain: 'UNKNOWN',
          parentChunksCount: 0,
          childChunksCount: 0,
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
  const goldenKpiPassed = goldenIntegrityRate === 100 && totalGoldenDatasets >= 5;

  console.log(
    `[+] KPI 3 Result: ${goldenPassedCount}/${totalGoldenDatasets} datasets verified (${goldenIntegrityRate}%) | Throughput: ${throughputDocsPerSec} docs/s (${throughputChunksPerSec} chunks/s) | Target: 100% Integrity | Status: ${
      goldenKpiPassed ? 'PASSED' : 'FAILED'
    }\n`
  );

  // ------------------------------------------------------------------
  // 4. Calculate Aggregate KPI Report & Save Report File
  // ------------------------------------------------------------------
  const overallPassed = disambigKpiPassed && licenseKpiPassed && goldenKpiPassed;

  const report: IngestKpiReport = {
    timestamp: new Date().toISOString(),
    kpis: {
      entityDisambiguation: {
        totalEvaluated: disambigTotal,
        passedCount: disambigPassed,
        accuracyPercent: disambigAccuracy,
        targetPercent: 98.0,
        passed: disambigKpiPassed,
      },
      licenseCompliance: {
        totalEvaluated: licenseTotal,
        passedCount: licensePassed,
        complianceRatePercent: licenseAuditRate,
        targetPercent: 100.0,
        passed: licenseKpiPassed,
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
    },
    overallPassed,
    details: {
      entityDisambiguationFailures: disambigFailures,
      licenseAuditFailures: licenseFailures,
      goldenDatasetResults,
    },
  };

  console.log('===============================================================');
  console.log(` OVERALL BENCHMARK RESULT: [${overallPassed ? 'PASS' : 'FAIL'}]`);
  console.log('===============================================================');
  console.log(` - Entity Normalization Accuracy: ${disambigAccuracy}% (Target: > 98.0%)`);
  console.log(` - Copyright License Compliance:  ${licenseAuditRate}% (Target: 100%)`);
  console.log(` - Golden Dataset Integrity:     ${goldenIntegrityRate}% (Target: 100%)`);
  console.log(` - Seeder Throughput:             ${throughputChunksPerSec} chunks/sec`);
  console.log('===============================================================\n');

  // Save report to packages/rag-engine/eval/reports/ingest-eval-report.json
  const reportsDir = path.resolve(monorepoRoot, 'packages', 'rag-engine', 'eval', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'ingest-eval-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`[+] Module 0 Evaluation Report saved to: file:///${reportPath.replace(/\\/g, '/')}\n`);

  return report;
}

// Script entry point
if (process.argv[1] && (process.argv[1].endsWith('ingest-runner.ts') || process.argv[1].endsWith('ingest-runner.js'))) {
  runIngestEval()
    .then((report) => {
      if (!report.overallPassed) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[!] Module 0 Evaluation Runner Fatal Error:', err);
      process.exit(1);
    });
}
