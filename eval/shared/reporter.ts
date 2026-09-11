/**
 * ChronoViet Evaluation Suite — Shared Reporter & Artifact Manager
 * Handles formatting, output artifacts persistence (outputs/), and scorecard reporting (reports/).
 */

import fs from 'node:fs';
import path from 'node:path';
import { BaseSuiteReport, BaseTestCaseResult, LatencyProfile, MetricScore } from './types.js';

export function calculateLatencyPercentiles(latenciesMs: number[]): LatencyProfile {
  if (!latenciesMs || latenciesMs.length === 0) {
    return { count: 0, p50: 0, p90: 0, p99: 0, mean: 0, min: 0, max: 0 };
  }

  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  const getPercentile = (p: number) => {
    const idx = Math.min(Math.floor((p / 100) * count), count - 1);
    return sorted[idx];
  };

  return {
    count,
    p50: Math.round(getPercentile(50)),
    p90: Math.round(getPercentile(90)),
    p99: Math.round(getPercentile(99)),
    mean: Math.round(sum / count),
    min: Math.round(sorted[0]),
    max: Math.round(sorted[count - 1]),
  };
}

export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function cleanDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

export function saveJsonArtifact(filePath: string, data: unknown): void {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export interface SaveSuiteReportOptions<T extends BaseTestCaseResult = BaseTestCaseResult> {
  report: BaseSuiteReport<T>;
  reportsDir: string;
  baseFileName: string;
  archiveHistory?: boolean;
}

export interface SavedReportPaths {
  reportJsonPath: string;
  reportMdPath: string;
  historyReportPath?: string;
  isSubset: boolean;
}

/**
 * Persists benchmark evaluation report with subset protection and historical archiving.
 * - Full runs (!isSubset): Saves canonical report to reports/<baseFileName>.json & .md
 * - Subset runs (isSubset): Saves to reports/subsets/<baseFileName>-subset.json & .md, protecting golden baseline.
 * - History: Archives snapshot to reports/history/YYYY-MM-DD_HH-mm-ss_<baseFileName>.json.
 */
export function saveSuiteEvaluationReport<T extends BaseTestCaseResult = BaseTestCaseResult>(
  options: SaveSuiteReportOptions<T>
): SavedReportPaths {
  const { report, reportsDir, baseFileName, archiveHistory = true } = options;
  const isSubset = Boolean(report.isSubset);

  let targetDir = reportsDir;
  let targetFilePrefix = baseFileName;

  if (isSubset) {
    targetDir = path.join(reportsDir, 'subsets');
    targetFilePrefix = `${baseFileName}-subset`;
  }

  ensureDirectory(targetDir);

  const reportJsonPath = path.join(targetDir, `${targetFilePrefix}.json`);
  const reportMdPath = path.join(targetDir, `${targetFilePrefix}.md`);

  let historyReportPath: string | undefined;
  if (archiveHistory) {
    const historyDir = path.join(reportsDir, 'history');
    ensureDirectory(historyDir);
    const date = new Date(report.timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeSlug = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    const historyFileName = `${timeSlug}_${baseFileName}${isSubset ? '-subset' : ''}.json`;
    historyReportPath = path.join(historyDir, historyFileName);
  }

  report.reportFilePath = reportJsonPath;
  report.reportMdPath = reportMdPath;
  report.historyReportPath = historyReportPath;

  saveJsonArtifact(reportJsonPath, report);

  const mdContent = generateMarkdownReport(report);
  fs.writeFileSync(reportMdPath, mdContent, 'utf-8');

  if (historyReportPath) {
    saveJsonArtifact(historyReportPath, report);
    const historyDir = path.dirname(historyReportPath);
    pruneHistorySnapshots(historyDir, 30);
  }

  return {
    reportJsonPath,
    reportMdPath,
    historyReportPath,
    isSubset,
  };
}

export function pruneHistorySnapshots(historyDir: string, maxSnapshots: number = 30): void {
  if (!fs.existsSync(historyDir)) return;
  try {
    const files = fs
      .readdirSync(historyDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const fullPath = path.join(historyDir, f);
        const stat = fs.statSync(fullPath);
        return { name: f, path: fullPath, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (files.length > maxSnapshots) {
      const toDelete = files.slice(maxSnapshots);
      for (const item of toDelete) {
        fs.unlinkSync(item.path);
      }
    }
  } catch {
    // Non-blocking cleanup
  }
}

export function generateMarkdownReport(report: BaseSuiteReport): string {
  const dateStr = new Date(report.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const overallBadge = report.allPassed ? '✅ **PASSED**' : '❌ **FAILED**';

  let md = `# 📊 Evaluation Report: ${report.title}\n\n`;

  if (report.isSubset) {
    const totalDs = report.datasetTotalCases || report.totalCases;
    const filterInfo = report.appliedFilters ? Object.entries(report.appliedFilters).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join(', ') : 'filters active';
    md += `> [!WARNING]\n`;
    md += `> **BENCHMARK SUBSET RUN:** Evaluating ${report.totalCases} / ${totalDs} test cases (${filterInfo}). This run does NOT represent the full dataset benchmark score.\n\n`;
  }

  md += `- **Timestamp:** ${dateStr} (ICT)\n`;
  if (report.metadata.platform) {
    md += `- **Runtime:** Node ${report.metadata.nodeVersion || process.version} (${report.metadata.platform})\n`;
  }
  md += `- **Overall Status:** ${overallBadge}\n`;
  md += `- **Total Test Cases:** ${report.totalCases}${report.isSubset ? ` *(subset of ${report.datasetTotalCases || report.totalCases})*` : ''}\n`;
  md += `- **Passed:** ${report.passedCases} | **Failed:** ${report.failedCases} (${(report.passRate * 100).toFixed(1)}%)\n`;
  md += `- **Execution Duration:** ${(report.metadata.durationMs / 1000).toFixed(2)}s\n`;
  md += `- **Artifacts Location:** \`${report.outputArtifactsDir}\`\n\n`;

  // Key Metrics Table
  md += `## 1. Key Performance Indicators (KPIs)\n\n`;
  md += `| Metric | Category | Achieved Value | Target KPI | Status | Description |\n`;
  md += `|---|:---:|---|---|:---:|---|\n`;

  for (const [key, metric] of Object.entries(report.metrics)) {
    const isPerf = metric.category === 'performance';
    const status = metric.pass ? '✅ PASS' : (isPerf ? '⚠️ WARN' : '❌ FAIL');
    const catLabel = isPerf ? '⚡ Perf' : '🎯 Quality';
    const valFormatted = metric.unit ? `${metric.value} ${metric.unit}` : `${metric.value}`;
    const targetFormatted = metric.unit ? `${metric.target} ${metric.unit}` : `${metric.target}`;
    md += `| **${metric.name}** | ${catLabel} | \`${valFormatted}\` | \`${targetFormatted}\` | ${status} | ${metric.description || key} |\n`;
  }
  md += `\n`;

  // Test Case Breakdown
  md += `## 2. Test Case Breakdown\n\n`;
  md += `| ID | Title | Status | Duration | Errors / Notes |\n`;
  md += `|---|---|:---:|---:|---|\n`;

  for (const c of report.caseResults) {
    const status = c.passed ? '✅ Pass' : '❌ Fail';
    const errs = c.errors && c.errors.length > 0 ? c.errors.join('; ') : '-';
    md += `| \`${c.id}\` | ${c.title} | ${status} | ${c.durationMs}ms | ${errs} |\n`;
  }
  md += `\n`;

  // Preflight Summary
  if (report.metadata.preflight?.checks?.length) {
    md += `## 3. Preflight Health Checks\n\n`;
    md += `| Service | Health | Provider | Details |\n`;
    md += `|---|:---:|---|---|\n`;
    for (const chk of report.metadata.preflight.checks) {
      const chkStatus = chk.healthy ? '✅' : '❌';
      md += `| **${chk.service.toUpperCase()}** | ${chkStatus} | \`${chk.provider}\` | ${chk.details || '-'} |\n`;
    }
    md += `\n`;
  }

  return md;
}

export function printCliSummaryTable(report: BaseSuiteReport): void {
  const qualityMetrics = Object.values(report.metrics).filter((m) => m.category !== 'performance');
  const allQualityPassed = qualityMetrics.length > 0 ? qualityMetrics.every((m) => m.pass) : report.allPassed;

  let statusText = '❌ BENCHMARK QUALITY GATE FAILED';
  if (report.allPassed) {
    statusText = '✅ ALL CHECKS PASSED (Quality & Performance)';
  } else if (allQualityPassed) {
    statusText = '⚠️  QUALITY GATE PASSED (Latency / Hardware Degraded)';
  }

  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log(` 📊 BENCHMARK SCORECARD: ${report.title.toUpperCase()}`);
  if (report.isSubset) {
    const totalDs = report.datasetTotalCases || report.totalCases;
    const filterInfo = report.appliedFilters ? Object.entries(report.appliedFilters).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join(', ') : 'filters active';
    console.log(` ⚠️  WARNING: SUBSET RUN (${report.totalCases}/${totalDs} cases evaluated | ${filterInfo})`);
  }
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log(` Status:        ${statusText}`);
  console.log(` Pass Rate:     ${report.passedCases}/${report.totalCases} (${(report.passRate * 100).toFixed(1)}%)`);
  console.log(` Total Time:    ${(report.metadata.durationMs / 1000).toFixed(2)}s`);
  if (report.metadata.platform) {
    console.log(` Runtime:       Node ${report.metadata.nodeVersion || process.version} (${report.metadata.platform})`);
  }
  console.log(` Artifacts:     ${report.outputArtifactsDir}`);
  if (report.reportFilePath) {
    console.log(` Report JSON:   ${report.reportFilePath}`);
  }
  if (report.reportMdPath) {
    console.log(` Report MD:     ${report.reportMdPath}`);
  }
  if (report.historyReportPath) {
    console.log(` History Run:   ${report.historyReportPath}`);
  }
  console.log('────────────────────────────────────────────────────────────────────────────────');
  console.log(' METRICS SUMMARY:');

  for (const [, metric] of Object.entries(report.metrics)) {
    const isPerf = metric.category === 'performance';
    const mark = metric.pass ? '✅' : (isPerf ? '⚠️ ' : '❌');
    const valFormatted = metric.unit ? `${metric.value}${metric.unit}` : `${metric.value}`;
    const targetFormatted = metric.unit ? `${metric.target}${metric.unit}` : `${metric.target}`;
    const catLabel = isPerf ? ' [Perf]' : '';
    console.log(`  ${mark} ${(metric.name + catLabel).padEnd(36)}: ${valFormatted.padStart(10)}  (Target: ${targetFormatted})`);
  }
  console.log('════════════════════════════════════════════════════════════════════════════════\n');
}
