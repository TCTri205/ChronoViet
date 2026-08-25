/**
 * ChronoViet Evaluation Suite — Shared Reporter & Artifact Manager
 * Handles formatting, output artifacts persistence (outputs/), and scorecard reporting (reports/).
 */

import fs from 'node:fs';
import path from 'node:path';
import { BaseSuiteReport, LatencyProfile, MetricScore } from './types.js';

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

export function saveJsonArtifact(filePath: string, data: unknown): void {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function generateMarkdownReport(report: BaseSuiteReport): string {
  const dateStr = new Date(report.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const overallBadge = report.allPassed ? '✅ **PASSED**' : '❌ **FAILED**';

  let md = `# 📊 Evaluation Report: ${report.title}\n\n`;
  md += `- **Timestamp:** ${dateStr} (ICT)\n`;
  md += `- **Overall Status:** ${overallBadge}\n`;
  md += `- **Total Test Cases:** ${report.totalCases}\n`;
  md += `- **Passed:** ${report.passedCases} | **Failed:** ${report.failedCases} (${(report.passRate * 100).toFixed(1)}%)\n`;
  md += `- **Execution Duration:** ${(report.metadata.durationMs / 1000).toFixed(2)}s\n`;
  md += `- **Artifacts Location:** \`${report.outputArtifactsDir}\`\n\n`;

  // Key Metrics Table
  md += `## 1. Key Performance Indicators (KPIs)\n\n`;
  md += `| Metric | Achieved Value | Target KPI | Status | Description |\n`;
  md += `|---|---|---|:---:|---|\n`;

  for (const [key, metric] of Object.entries(report.metrics)) {
    const status = metric.pass ? '✅ PASS' : '❌ FAIL';
    const valFormatted = metric.unit ? `${metric.value} ${metric.unit}` : `${metric.value}`;
    const targetFormatted = metric.unit ? `${metric.target} ${metric.unit}` : `${metric.target}`;
    md += `| **${metric.name}** | \`${valFormatted}\` | \`${targetFormatted}\` | ${status} | ${metric.description || key} |\n`;
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
  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log(` 📊 BENCHMARK SCORECARD: ${report.title.toUpperCase()}`);
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log(` Status:        ${report.allPassed ? '✅ ALL CHECKS PASSED' : '❌ BENCHMARK GATE FAILED'}`);
  console.log(` Pass Rate:     ${report.passedCases}/${report.totalCases} (${(report.passRate * 100).toFixed(1)}%)`);
  console.log(` Total Time:    ${(report.metadata.durationMs / 1000).toFixed(2)}s`);
  console.log(` Artifacts:     ${report.outputArtifactsDir}`);
  console.log('────────────────────────────────────────────────────────────────────────────────');
  console.log(' METRICS SUMMARY:');

  for (const [, metric] of Object.entries(report.metrics)) {
    const mark = metric.pass ? '✅' : '❌';
    const valFormatted = metric.unit ? `${metric.value}${metric.unit}` : `${metric.value}`;
    const targetFormatted = metric.unit ? `${metric.target}${metric.unit}` : `${metric.target}`;
    console.log(`  ${mark} ${metric.name.padEnd(30)}: ${valFormatted.padStart(10)}  (Target: ${targetFormatted})`);
  }
  console.log('════════════════════════════════════════════════════════════════════════════════\n');
}
