/**
 * CLI Tool: Ingestion Quality Diagnostic & Quarantine Analyzer
 * Usage: pnpm --filter @chronoviet/data-ingestion eval:diagnostic [--input=path]
 */

import path from 'path';
import { promises as fs } from 'fs';
import { SourceReliability, resolveCanonicalEntity, isKnownMasterEntity } from '@chronoviet/shared-spec';
import { createLogger } from '@chronoviet/infra';
import { findMonorepoRoot } from '../utils/path-utils.js';
import { normalizeText } from '../text/text-normalizer.js';
import { chunkDocumentHierarchical } from '../chunking/hierarchical-chunker.js';
import { extractTriplesFromTextAsync, isValidEntityName, ExtractedTriple } from '../triple-extractor.js';
import { CONFIDENCE_PRODUCTION_THRESHOLD } from '../seeder/dual-branch-seeder.js';
import { parseFrontmatter } from '../utils/text-utils.js';
import {
  IngestDiagnosticIssue,
  IngestDiagnosticReport,
  DiagnosticIssueType,
} from '../diagnostics/diagnostic-types.js';

const log = createLogger({ service: 'data-ingestion' });

interface DiagnosticCliOptions {
  inputPath: string;
  outputPath?: string;
  limit?: number;
  regexOnly: boolean;
  allowFallback: boolean;
  strict: boolean;
}

function parseArgs(): DiagnosticCliOptions {
  const args = process.argv.slice(2);
  let inputPath = path.resolve(findMonorepoRoot(), 'data', 'raw_corpus');
  let outputPath: string | undefined;
  let limit: number | undefined;
  let regexOnly = false;
  let allowFallback = false;
  let strict = false;

  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      const val = arg.split('=')[1] || '';
      inputPath = path.isAbsolute(val) ? val : path.resolve(findMonorepoRoot(), val);
    } else if (arg.startsWith('--output=') || arg.startsWith('--out=')) {
      outputPath = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--regex-only' || arg === '--regex' || arg === '--fast') {
      regexOnly = true;
    } else if (arg === '--allow-fallback' || arg === '--fallback') {
      allowFallback = true;
    } else if (arg === '--offline') {
      regexOnly = true;
      allowFallback = true;
    } else if (arg === '--strict') {
      strict = true;
    }
  }

  // Fallback to test-cases if raw_corpus is empty
  return { inputPath, outputPath, limit, regexOnly, allowFallback, strict };
}

export async function runIngestionDiagnostic(options: DiagnosticCliOptions): Promise<IngestDiagnosticReport> {
  const monorepoRoot = findMonorepoRoot();
  let targetPath = options.inputPath;

  const exists = await fs.stat(targetPath).then(() => true).catch(() => false);
  if (!exists) {
    // Try test cases directory as fallback
    const testCasesPath = path.resolve(monorepoRoot, 'eval', 'test-cases');
    if (await fs.stat(testCasesPath).then(() => true).catch(() => false)) {
      targetPath = testCasesPath;
    }
  }

  const filesToScan: string[] = [];
  const collectFiles = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'pdf' || entry.name === 'node_modules' || entry.name === '.git') continue;
        await collectFiles(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.txt' || ext === '.md' || ext === '.json') {
          filesToScan.push(fullPath);
        }
      }
    }
  };

  const stat = await fs.stat(targetPath);
  if (stat.isDirectory()) {
    await collectFiles(targetPath);
  } else {
    filesToScan.push(targetPath);
  }

  const files = options.limit ? filesToScan.slice(0, options.limit) : filesToScan;

  let totalChunksCreated = 0;
  let totalTriplesExtracted = 0;
  let highConfidenceTriplesCount = 0;
  let quarantinedTriplesCount = 0;
  const unmappedEntitiesSet = new Set<string>();

  const issues: IngestDiagnosticIssue[] = [];
  const issuesSummary: Record<DiagnosticIssueType, number> = {
    UNMAPPED_ENTITY: 0,
    GENERIC_OR_HALLUCINATED_ENTITY: 0,
    LOW_CONFIDENCE_RELATION: 0,
    TEMPORAL_SPATIAL_MISSING: 0,
    DANGLING_RELATIONSHIP: 0,
  };

  const actionableRecommendationsSet = new Set<string>();

  for (const filePath of files) {
    const docName = path.basename(filePath);
    const rawText = await fs.readFile(filePath, 'utf-8');
    let content = rawText;
    let title = path.basename(filePath, path.extname(filePath));
    let dynasty: string | undefined;
    let sourceReliability: SourceReliability = 'LEVEL_1';

    if (filePath.endsWith('.json')) {
      try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) continue;
        content = parsed.content || parsed.text || rawText;
        title = parsed.title || title;
        dynasty = parsed.dynasty || parsed.metadata?.dynasty;
        sourceReliability = parsed.source_reliability || parsed.metadata?.source_reliability || 'LEVEL_1';
      } catch {
        content = rawText;
      }
    } else {
      const { body, metadata } = parseFrontmatter(rawText);
      content = body;
      if (metadata.title) title = metadata.title;
      if (metadata.dynasty) dynasty = metadata.dynasty;
      if (metadata.source_reliability === 'LEVEL_1' || metadata.source_reliability === 'LEVEL_2' || metadata.source_reliability === 'LEVEL_3') {
        sourceReliability = metadata.source_reliability;
      }
    }

    if (!content || content.trim().length === 0) continue;

    const cleanedText = normalizeText(content);
    const { parentChunks, childChunks } = chunkDocumentHierarchical(cleanedText, {
      title,
      sourceName: docName,
      dynasty,
      sourceReliability,
    });

    const allChunks = [...parentChunks, ...childChunks];
    totalChunksCreated += allChunks.length;

    // Check Chunks for temporal / spatial metadata
    for (const chunk of allChunks) {
      if (!chunk.metadata.dynasty && (!chunk.metadata.timeStart || !chunk.metadata.timeEnd)) {
        issuesSummary.TEMPORAL_SPATIAL_MISSING++;
        issues.push({
          type: 'TEMPORAL_SPATIAL_MISSING',
          severity: 'WARNING',
          document: docName,
          chunkId: chunk.id,
          details: `Chunk '${chunk.id}' lacks historical dynasty and time range metadata`,
          recommendation: `Add dynasty or time_start/time_end to document frontmatter metadata for ${docName}`,
        });
      }

      // Extract triples
      const triples: ExtractedTriple[] = await extractTriplesFromTextAsync(chunk.textContent, {
        regexOnly: options.regexOnly,
        allowFallback: options.allowFallback,
      });
      totalTriplesExtracted += triples.length;

      for (const t of triples) {
        // 1. Check validity of entity names
        const srcValid = isValidEntityName(t.sourceEntityName);
        const tgtValid = isValidEntityName(t.targetEntityName);

        if (!srcValid || !tgtValid) {
          issuesSummary.GENERIC_OR_HALLUCINATED_ENTITY++;
          const invalidTerm = !srcValid ? t.sourceEntityName : t.targetEntityName;
          issues.push({
            type: 'GENERIC_OR_HALLUCINATED_ENTITY',
            severity: 'CRITICAL',
            document: docName,
            chunkId: chunk.id,
            details: `Extracted entity '${invalidTerm}' failed strict proper-noun validation`,
            recommendation: `Add '${invalidTerm}' to GENERIC_EXCLUSION_TERMS or refine triple extraction regex/prompt`,
          });
          actionableRecommendationsSet.add(`Filter generic/noise entity token '${invalidTerm}'`);
          quarantinedTriplesCount++;
          continue;
        }

        // 2. Check canonical master ontology mapping
        const isSrcMaster = isKnownMasterEntity(t.sourceEntityName);
        const isTgtMaster = t.targetEntityId !== 'doc:historical_context' && isKnownMasterEntity(t.targetEntityName);

        if (!isSrcMaster) {
          const srcEntity = resolveCanonicalEntity(t.sourceEntityName);
          unmappedEntitiesSet.add(srcEntity.entityId);
          issuesSummary.UNMAPPED_ENTITY++;
          issues.push({
            type: 'UNMAPPED_ENTITY',
            severity: 'WARNING',
            document: docName,
            chunkId: chunk.id,
            details: `Source entity '${t.sourceEntityName}' (ID: ${srcEntity.entityId}) is not in Master Ontology`,
            recommendation: `Register '${t.sourceEntityName}' as an alias or master entity in packages/shared-spec/src/historical-entities.ts`,
            metadata: { entityId: srcEntity.entityId, rawName: t.sourceEntityName },
          });
          actionableRecommendationsSet.add(`Add master alias mapping for entity: '${t.sourceEntityName}'`);
        }

        if (t.targetEntityId !== 'doc:historical_context' && !isTgtMaster) {
          const tgtEntity = resolveCanonicalEntity(t.targetEntityName);
          unmappedEntitiesSet.add(tgtEntity.entityId);
          issuesSummary.UNMAPPED_ENTITY++;
          issues.push({
            type: 'UNMAPPED_ENTITY',
            severity: 'WARNING',
            document: docName,
            chunkId: chunk.id,
            details: `Target entity '${t.targetEntityName}' (ID: ${tgtEntity.entityId}) is not in Master Ontology`,
            recommendation: `Register '${t.targetEntityName}' as an alias or master entity in packages/shared-spec/src/historical-entities.ts`,
            metadata: { entityId: tgtEntity.entityId, rawName: t.targetEntityName },
          });
          actionableRecommendationsSet.add(`Add master alias mapping for entity: '${t.targetEntityName}'`);
        }

        // 3. Check Dangling relations
        if (t.targetEntityId === 'doc:historical_context') {
          issuesSummary.DANGLING_RELATIONSHIP++;
          issues.push({
            type: 'DANGLING_RELATIONSHIP',
            severity: 'INFO',
            document: docName,
            chunkId: chunk.id,
            details: `Relationship (${t.sourceEntityName} -[${t.relationType}]-> ${t.targetEntityName}) has dangling context target`,
            recommendation: `Inspect chunk sentence structure to extract concrete target entity`,
          });
          quarantinedTriplesCount++;
          continue;
        }

        // 4. Check confidence threshold
        if (t.confidence < CONFIDENCE_PRODUCTION_THRESHOLD) {
          issuesSummary.LOW_CONFIDENCE_RELATION++;
          issues.push({
            type: 'LOW_CONFIDENCE_RELATION',
            severity: 'WARNING',
            document: docName,
            chunkId: chunk.id,
            details: `Low confidence (${t.confidence} < ${CONFIDENCE_PRODUCTION_THRESHOLD}) for (${t.sourceEntityName} -[${t.relationType}]-> ${t.targetEntityName})`,
            recommendation: `Review LLM extraction prompt few-shot examples for relation '${t.relationType}'`,
          });
          quarantinedTriplesCount++;
        } else {
          highConfidenceTriplesCount++;
        }
      }
    }
  }

  const report: IngestDiagnosticReport = {
    timestamp: new Date().toISOString(),
    totalDocumentsScanned: files.length,
    totalChunksCreated,
    totalTriplesExtracted,
    highConfidenceTriplesCount,
    quarantinedTriplesCount,
    unmappedEntitiesCount: unmappedEntitiesSet.size,
    issuesSummary,
    actionableRecommendations: Array.from(actionableRecommendationsSet).slice(0, 20),
    issues: issues.slice(0, 100),
  };

  // Generate Reports
  const reportsDir = path.resolve(findMonorepoRoot(), 'packages', 'data-ingestion', 'eval', 'reports');
  await fs.mkdir(reportsDir, { recursive: true });

  const jsonReportPath = options.outputPath || path.join(reportsDir, 'ingest-diagnostic-report.json');
  await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2), 'utf-8');

  const mdReportPath = path.join(reportsDir, 'ingest-diagnostic-report.md');
  const markdownContent = generateMarkdownReport(report);
  await fs.writeFile(mdReportPath, markdownContent, 'utf-8');

  return report;
}

function generateMarkdownReport(report: IngestDiagnosticReport): string {
  const verifiedRate = report.totalTriplesExtracted > 0
    ? ((report.highConfidenceTriplesCount / report.totalTriplesExtracted) * 100).toFixed(1)
    : '100.0';

  return `# ChronoViet Knowledge Ingestion Quality Diagnostic Report

**Generated At:** ${report.timestamp}

---

## 1. Executive Summary & Quality Health Metrics

| Metric | Measured Value | Health Status |
| :--- | :---: | :---: |
| **Documents Scanned** | \`${report.totalDocumentsScanned}\` | OK |
| **Hierarchical Chunks Created** | \`${report.totalChunksCreated}\` | OK |
| **Total Triples Extracted** | \`${report.totalTriplesExtracted}\` | OK |
| **Verified Production Triples** | \`${report.highConfidenceTriplesCount}\` (${verifiedRate}%) | ${Number(verifiedRate) >= 80 ? '🟢 HEALTHY' : '🟡 NEEDS REVIEW'} |
| **Quarantined Triples** | \`${report.quarantinedTriplesCount}\` | ${report.quarantinedTriplesCount === 0 ? '🟢 CLEAN' : '🟡 ISOLATED'} |
| **Unmapped Entities** | \`${report.unmappedEntitiesCount}\` | ${report.unmappedEntitiesCount === 0 ? '🟢 100% MAPPED' : '🟡 ACTION NEEDED'} |

---

## 2. Issues Breakdown by Quality Axis

| Issue Category | Occurrences | Severity | Action Required |
| :--- | :---: | :---: | :--- |
| **UNMAPPED_ENTITY** | \`${report.issuesSummary.UNMAPPED_ENTITY}\` | WARNING | Add alias/entity to Master Ontology |
| **GENERIC_OR_HALLUCINATED_ENTITY** | \`${report.issuesSummary.GENERIC_OR_HALLUCINATED_ENTITY}\` | CRITICAL | Add to exclusion filter or refine prompt |
| **LOW_CONFIDENCE_RELATION** | \`${report.issuesSummary.LOW_CONFIDENCE_RELATION}\` | WARNING | Refine relation few-shot prompts |
| **TEMPORAL_SPATIAL_MISSING** | \`${report.issuesSummary.TEMPORAL_SPATIAL_MISSING}\` | WARNING | Enrich document frontmatter metadata |
| **DANGLING_RELATIONSHIP** | \`${report.issuesSummary.DANGLING_RELATIONSHIP}\` | INFO | Check sentence context resolution |

---

## 3. Top Actionable Recommendations

${report.actionableRecommendations.map((rec, idx) => `${idx + 1}. **${rec}**`).join('\n')}

---

## 4. Diagnostic Samples (Top ${report.issues.length} Items)

| Type | Severity | Document | Details | Recommendation |
| :--- | :---: | :--- | :--- | :--- |
${report.issues
  .map(
    (i) =>
      `| \`${i.type}\` | ${i.severity === 'CRITICAL' ? '🔴 CRITICAL' : i.severity === 'WARNING' ? '🟡 WARNING' : '🔵 INFO'} | \`${i.document}\` | ${i.details} | ${i.recommendation} |`
  )
  .join('\n')}
`;
}

if (process.argv[1] && (process.argv[1].endsWith('ingest-diagnostic.ts') || process.argv[1].endsWith('ingest-diagnostic.js'))) {
  const options = parseArgs();
  console.log('===============================================================');
  console.log('  CHRONOVIET KNOWLEDGE INGESTION QUALITY DIAGNOSTIC RUNNER');
  console.log('===============================================================\n');
  console.log(`[*] Target Scanning Path: ${options.inputPath}`);

  runIngestionDiagnostic(options)
    .then((report) => {
      console.log('\n[+] Diagnostic Inspection Complete:');
      console.log(`    - Total Documents: ${report.totalDocumentsScanned}`);
      console.log(`    - Total Chunks: ${report.totalChunksCreated}`);
      console.log(`    - Verified Triples: ${report.highConfidenceTriplesCount}`);
      console.log(`    - Quarantined Triples: ${report.quarantinedTriplesCount}`);
      console.log(`    - Unmapped Entities: ${report.unmappedEntitiesCount}`);
      console.log(`    - Total Issues Detected: ${Object.values(report.issuesSummary).reduce((a, b) => a + b, 0)}`);
      console.log(`\n[+] Reports generated:`);
      console.log(`    - JSON: packages/data-ingestion/eval/reports/ingest-diagnostic-report.json`);
      console.log(`    - Markdown: packages/data-ingestion/eval/reports/ingest-diagnostic-report.md\n`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[!] Diagnostic Error:', err);
      process.exit(1);
    });
}
