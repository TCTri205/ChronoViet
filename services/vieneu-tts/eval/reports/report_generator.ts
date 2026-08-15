import fs from 'fs';
import path from 'path';

export interface SentenceEvalMetric {
  id: string;
  text: string;
  domainCategory: string;
  audioDurationMs: number;
  calculatedFramesAt30fps: number;
  wordCount: number;
  synthesisTimeMs: number;
  rtf: number;
  maxTimestampAlignmentErrorMs: number;
  frameCalculationError: number;
  passed: boolean;
}

export interface SummaryEvalReport {
  timestamp: string;
  preflight?: unknown;
  totalSentences: number;
  passedCount: number;
  failedCount: number;
  passRatePercentage: number;
  avgRtf: number;
  maxRtf: number;
  avgAlignmentErrorMs: number;
  maxAlignmentErrorMs: number;
  maxFrameCalcError: number;
  engineType: 'REAL_NEURAL_ONNX' | 'SYNTHETIC_FALLBACK_TONE';
  overallStatus: 'PASS' | 'FAIL';
  results: SentenceEvalMetric[];
}

export function generateEvalMarkdownReport(report: SummaryEvalReport, targetRtf = 0.3): string {
  const lines: string[] = [];
  lines.push(`# Báo Cáo Đánh Giá Chất Lượng Dịch Vụ VieNeu TTS Service`);
  lines.push(`**Thời gian chạy:** ${report.timestamp}`);
  lines.push(`**Engine Mode:** ${report.engineType === 'REAL_NEURAL_ONNX' ? 'REAL_NEURAL_ONNX (VieNeu ONNX Service)' : 'SYNTHETIC_FALLBACK_TONE (Sine Wave Generator)'}`);
  lines.push(`**Tổng số mẫu câu:** ${report.totalSentences}`);
  lines.push(`**Kết quả chung:** ${report.overallStatus === 'PASS' ? '✅ PASS (ĐẠT CHUẨN KPI)' : '❌ FAIL (KHÔNG ĐẠT)'}`);
  lines.push(``);
  lines.push(`## 📊 Tổng Hợp Chỉ Số KPI Core Metrics`);
  lines.push(`| Chỉ Số KPI | Mục Tiêu Chuẩn | Kết Quả Thực Tế | Trạng Thái |`);
  lines.push(`| :--- | :---: | :---: | :---: |`);
  lines.push(`| **Inference Real-Time Factor (RTF)** | $< ${targetRtf}\\text{x}$ | **${report.avgRtf.toFixed(4)}x** (Max: ${report.maxRtf.toFixed(4)}x) | ${report.maxRtf < targetRtf ? '✅ PASS' : '❌ FAIL'} |`);
  lines.push(`| **Word Timestamp Alignment Error** | $< 50\\text{ms}$ | **${report.avgAlignmentErrorMs.toFixed(2)}ms** (Max: ${report.maxAlignmentErrorMs.toFixed(2)}ms) | ${report.maxAlignmentErrorMs < 50 ? '✅ PASS' : '❌ FAIL'} |`);
  lines.push(`| **Duration Frame Calculation Error** | $< 1\\text{ frame}$ | **${report.maxFrameCalcError.toFixed(2)} frames** | ${report.maxFrameCalcError < 1.0 ? '✅ PASS' : '❌ FAIL'} |`);
  lines.push(``);
  lines.push(`## 📋 Bảng Chi Tiết 50 Mẫu Câu Lịch Sử Tiếng Việt`);
  lines.push(`| ID | Danh Mục | Độ Dài Audio | Frames (30fps) | Số Từ | RTF | Max Alignment Error | Trạng Thái |`);
  lines.push(`| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |`);

  for (const item of report.results) {
    lines.push(`| ${item.id} | ${item.domainCategory} | ${item.audioDurationMs}ms | ${item.calculatedFramesAt30fps}f | ${item.wordCount} | ${item.rtf.toFixed(3)}x | ${item.maxTimestampAlignmentErrorMs.toFixed(1)}ms | ${item.passed ? '✅ PASS' : '❌ FAIL'} |`);
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(`*Báo cáo được sinh tự động bởi ` + "`services/vieneu-tts/eval/runner.ts`*");

  return lines.join('\n');
}

export function saveEvalReport(report: SummaryEvalReport, reportsDir: string, targetRtf = 0.3): void {
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const jsonPath = path.join(reportsDir, 'report.json');
  const mdPath = path.join(reportsDir, 'report.md');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  fs.writeFileSync(mdPath, generateEvalMarkdownReport(report, targetRtf), 'utf-8');

  console.log(`📄 Report saved to: ${jsonPath}`);
  console.log(`📄 Report saved to: ${mdPath}`);
}
