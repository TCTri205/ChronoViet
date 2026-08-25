/**
 * Multi-Agent Orchestrator Real Evaluation Benchmark Runner
 * Measures State Machine Completion (100%), Script Pacing Error (< 5%), and Fact Escalation on 20 Historical Test Cases
 */

import * as fs from 'fs';
import * as path from 'path';
import { runOrchestratorPipeline, ChronoGraphState } from '../src/index.js';
import { VideoProjectSchema } from '@chronoviet/shared-spec';
import { assertEvalPreflight } from '@chronoviet/infra';

interface OrchestratorTestCase {
  id: string;
  topic: string;
  targetDurationMinutes: number;
  videoType: 'BIOGRAPHY' | 'BATTLE' | 'DYNASTY' | 'MYSTERY' | 'ARTIFACT';
  templateId: 'HISTORICAL_DOCUMENTARY' | 'QUICK_SHORTS' | 'MODERN_NEWS';
  expectedAliases: string[];
}

const TEST_CASES_20: OrchestratorTestCase[] = [
  { id: 'eval_proj_01', topic: 'Trận Bạch Đằng năm 938 của Ngô Quyền', targetDurationMinutes: 3, videoType: 'BATTLE', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Ngô Quyền', 'Tiền Ngô Vương'] },
  { id: 'eval_proj_02', topic: 'Quốc Công Tiết Chế Trần Hưng Đạo', targetDurationMinutes: 4, videoType: 'BIOGRAPHY', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Trần Hưng Đạo', 'Trần Quốc Tuấn'] },
  { id: 'eval_proj_03', topic: 'Hoàng đế Quang Trung Nguyễn Huệ', targetDurationMinutes: 5, videoType: 'BIOGRAPHY', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Quang Trung', 'Nguyễn Huệ'] },
  { id: 'eval_proj_04', topic: 'Chiếu Dời Đô và Triều Đại Nhà Lý', targetDurationMinutes: 3, videoType: 'DYNASTY', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Lý Thái Tổ', 'Lý Công Uẩn'] },
  { id: 'eval_proj_05', topic: 'Vụ Án Lệ Chi Viên và Nguyễn Trãi', targetDurationMinutes: 4, videoType: 'MYSTERY', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Nguyễn Trãi', 'Lệ Chi Viên'] },
  { id: 'eval_proj_06', topic: 'Trống Đồng Ngọc Lũ và Văn Hóa Đông Sơn', targetDurationMinutes: 2, videoType: 'ARTIFACT', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Trống Đồng Ngọc Lũ'] },
  { id: 'eval_proj_07', topic: 'Khởi Nghĩa Hai Bà Trưng', targetDurationMinutes: 3, videoType: 'BATTLE', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Trưng Trắc', 'Trưng Nhị'] },
  { id: 'eval_proj_08', topic: 'Đinh Bộ Lĩnh Dẹp Loạn 12 Sứ Quân', targetDurationMinutes: 4, videoType: 'DYNASTY', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Đinh Tiên Hoàng', 'Đinh Bộ Lĩnh'] },
  { id: 'eval_proj_09', topic: 'Lê Lợi và Khởi Nghĩa Lam Sơn', targetDurationMinutes: 5, videoType: 'BATTLE', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Lê Lợi', 'Bình Định Vương'] },
  { id: 'eval_proj_10', topic: 'Thịnh Trị Thời Vua Lê Thánh Tông', targetDurationMinutes: 3, videoType: 'DYNASTY', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Lê Thánh Tông', 'Luật Hồng Đức'] },
  { id: 'eval_proj_11', topic: 'Hồ Quý Ly và Canh Tân Đất Nước', targetDurationMinutes: 3, videoType: 'DYNASTY', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Hồ Quý Ly', 'Thành Nhà Hồ'] },
  { id: 'eval_proj_12', topic: 'Trận Rạch Gầm Xoài Mút 1785', targetDurationMinutes: 4, videoType: 'BATTLE', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Nguyễn Huệ', 'Xiêm La'] },
  { id: 'eval_proj_13', topic: 'Trận Ngọc Hồi Đống Đa 1789', targetDurationMinutes: 4, videoType: 'BATTLE', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Quang Trung', 'Tôn Sĩ Nghị'] },
  { id: 'eval_proj_14', topic: 'Bí Ẩn Cái Chết Của Vua Lê Thái Tông', targetDurationMinutes: 3, videoType: 'MYSTERY', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Lê Thái Tông', 'Nguyễn Thị Lộ'] },
  { id: 'eval_proj_15', topic: 'Bảo Kiếm Thuận Thiên và Hồ Gươm', targetDurationMinutes: 2, videoType: 'ARTIFACT', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Thuận Thiên Kiếm', 'Lê Lợi'] },
  { id: 'eval_proj_16', topic: 'Chiến Thắng Điện Biên Phủ 1954', targetDurationMinutes: 5, videoType: 'BATTLE', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Võ Nguyên Giáp', 'Điện Biên Phủ'] },
  { id: 'eval_proj_17', topic: 'Chiến Dịch Hồ Chí Minh 1975', targetDurationMinutes: 4, videoType: 'BATTLE', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Dinh Độc Lập', 'Thống Nhất'] },
  { id: 'eval_proj_18', topic: 'Bà Triệu Khởi Nghĩa Chống Quân Ngô', targetDurationMinutes: 3, videoType: 'BIOGRAPHY', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Bà Triệu', 'Triệu Thị Trinh'] },
  { id: 'eval_proj_19', topic: 'Lý Thường Kiệt và Bài Thơ Thần Nam Quốc Sơn Hà', targetDurationMinutes: 3, videoType: 'BIOGRAPHY', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['Lý Thường Kiệt', 'Nam Quốc Sơn Hà'] },
  { id: 'eval_proj_20', topic: 'Thành Cổ Loa và Nỏ Thần An Dương Vương', targetDurationMinutes: 3, videoType: 'ARTIFACT', templateId: 'HISTORICAL_DOCUMENTARY', expectedAliases: ['An Dương Vương', 'Cổ Loa'] },
];

async function runOrchestratorEvaluation() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║           CHRONOVIET MULTI-AGENT ORCHESTRATOR REAL BENCHMARK            ║');
  console.log('║           Target: 20 Historical Long-Form Video Projects                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  const preflight = await assertEvalPreflight(['llm', 'embedding']);

  let completedCases = 0;
  let schemaValidatedCases = 0;
  let totalPacingError = 0;
  let totalEscalationsHandled = 0;
  const results: any[] = [];
  const startTime = Date.now();

  for (let i = 0; i < TEST_CASES_20.length; i++) {
    const tc = TEST_CASES_20[i];
    console.log(`[${i + 1}/20] Running pipeline for: "${tc.topic}" (${tc.targetDurationMinutes} min)...`);

    const initialState: any = {
      projectId: tc.id,
      userPrompt: tc.topic,
      targetDurationMinutes: tc.targetDurationMinutes,
      videoType: tc.videoType,
      templateId: tc.templateId,
      status: 'INIT',
      currentStep: 1,
      chapters: [],
      currentChapterIndex: 0,
      runningNarrativeState: {
        previousChapterSummary: '',
        establishedTone: 'Hùng tráng',
        introducedEntities: [],
        transitionHook: '',
      },
      chapterScripts: {},
      factCheckLogs: [],
      scenes: [],
      audioAssets: [],
    };

    try {
      const finalState = await runOrchestratorPipeline(initialState);

      const isCompleted = finalState.status === 'COMPLETED';
      if (isCompleted) {
        completedCases++;
      }

      // Check schema validity
      let isValidSchema = false;
      if (finalState.videoProps) {
        try {
          VideoProjectSchema.parse(finalState.videoProps);
          isValidSchema = true;
          schemaValidatedCases++;
        } catch {
          isValidSchema = false;
        }
      }

      const pacingError = finalState.pacingErrorPercentage ?? 0;
      totalPacingError += pacingError;

      const escalationCount = finalState.factCheckLogs.filter((l) => l.escalationTier > 0).length;
      if (escalationCount > 0) {
        totalEscalationsHandled++;
      }

      results.push({
        id: tc.id,
        topic: tc.topic,
        status: finalState.status,
        scenesCount: finalState.scenes.length,
        pacingErrorPercentage: pacingError,
        schemaValid: isValidSchema,
        factCheckPassed: finalState.factCheckLogs.every((l) => l.passed),
      });
    } catch (err: any) {
      console.error(`[FAIL] Pipeline crashed for ${tc.id}: ${err.message}`);
      results.push({
        id: tc.id,
        topic: tc.topic,
        status: 'FAILED',
        error: err.message,
      });
    }
  }

  const durationMs = Date.now() - startTime;
  const totalCount = TEST_CASES_20.length;

  const stateMachineCompletionRate = (completedCases / totalCount) * 100;
  const schemaPassRate = (schemaValidatedCases / totalCount) * 100;
  const avgPacingError = totalPacingError / totalCount;
  const factEscalationRate = (totalEscalationsHandled / totalCount) * 100;

  const completionPass = stateMachineCompletionRate >= 100;
  const pacingPass = avgPacingError < 3.0;
  const escalationPass = factEscalationRate >= 100;
  const schemaPass = schemaPassRate >= 100;
  const allKpisPassed = completionPass && pacingPass && escalationPass && schemaPass;

  console.log('\n┌──────────────────────────────────────────────────────────────────────────┐');
  console.log('│                   ORCHESTRATOR EVALUATION METRICS SUMMARY                │');
  console.log('├─────────────────────────────┬───────────┬────────────┬───────────────────┤');
  console.log('│ Metric Name                 │ Target    │ Actual     │ Verdict           │');
  console.log('├─────────────────────────────┼───────────┼────────────┼───────────────────┤');
  console.log(`│ State Machine Completion    │ 100.0%    │ ${stateMachineCompletionRate.toFixed(1).padStart(8)}%  │ ${completionPass ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log(`│ Script Pacing Error         │ < 3.0%    │ ${avgPacingError.toFixed(2).padStart(8)}%  │ ${pacingPass ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log(`│ Fact-Check Escalation Flow  │ 100.0%    │ ${factEscalationRate.toFixed(1).padStart(8)}%  │ ${escalationPass ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log(`│ Schema v3.2 Zod Validation  │ 100.0%    │ ${schemaPassRate.toFixed(1).padStart(8)}%  │ ${schemaPass ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log('├─────────────────────────────┴───────────┴────────────┴───────────────────┤');
  console.log(`│ Total Evaluated: ${String(totalCount).padStart(4)} projects | Total Duration: ${String(durationMs).padStart(6)}ms          │`);
  console.log(`│ Overall Status:  ${allKpisPassed ? '✅ ALL KPIS PASSED (PASS)' : '❌ BENCHMARK FAILED'}                              │`);
  console.log('└──────────────────────────────────────────────────────────────────────────┘\n');

  // Save report
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportFile = path.join(reportsDir, 'orchestrator-eval-report.json');
  const reportPayload = {
    benchmark_id: 'AGENT_ORCHESTRATOR_BENCHMARK_20',
    timestamp: new Date().toISOString(),
    totalEvaluated: totalCount,
    durationMs,
    preflight,
    metrics: {
      stateMachineCompletionRate,
      avgPacingError,
      factEscalationRate,
      schemaPassRate,
    },
    kpis: {
      completionPass,
      pacingPass,
      escalationPass,
      schemaPass,
      allKpisPassed,
    },
    results,
  };

  fs.writeFileSync(reportFile, JSON.stringify(reportPayload, null, 2), 'utf-8');
  console.log(`[REPORT] Evaluation report written to: ${reportFile}\n`);

  if (!allKpisPassed) {
    process.exit(1);
  }
}

runOrchestratorEvaluation().catch((err) => {
  console.error('[ERROR] Orchestrator evaluation runner crashed:', err);
  process.exit(1);
});
