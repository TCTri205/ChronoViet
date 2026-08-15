/**
 * Orchestrator -> Remotion Integration Chain Evaluation Runner
 * Executes E2E Pipeline: Historical Prompt -> LangGraph 12-Step Orchestrator -> Render Worker -> MP4 Video
 */

import * as fs from 'fs';
import * as path from 'path';
import { runOrchestratorPipeline, ChronoGraphState } from '../../packages/agent-orchestrator/src/index.js';
import { processRenderJob } from '../../apps/render-worker/src/workers/render-worker.js';
import { createLogger, VideoProjectSchema } from '../../packages/shared-spec/src/index.js';
import { assertEvalPreflight } from '../utils/preflight.js';

const log = createLogger({ service: 'eval-runner' });

export interface OrchestratorRemotionChainReport {
  chainName: 'orchestrator-remotion';
  timestamp: string;
  preflight: unknown;
  totalEvaluated: number;
  completedCount: number;
  schemaValidCount: number;
  mp4RenderedCount: number;
  avgPacingErrorPct: number;
  maxRamPeakGb: number;
  qualityStatus: 'PASS' | 'FAIL';
  testCaseResults: Array<{
    id: string;
    topic: string;
    scenesCount: number;
    pacingErrorPct: number;
    mp4Path?: string;
    status: 'PASS' | 'FAIL';
  }>;
}

const GOLDEN_TEST_CASES = [
  { id: 'golden_bach_dang_938', topic: 'Trận Bạch Đằng năm 938 của Ngô Quyền', videoType: 'BATTLE' as const, durationMinutes: 0.72 },
  { id: 'golden_tran_hung_dao', topic: 'Tiểu sử Quốc Công Tiết Chế Trần Hưng Đạo', videoType: 'BIOGRAPHY' as const, durationMinutes: 0.72 },
  { id: 'golden_nha_ly', topic: 'Chiếu Dời Đô và Triều Đại Nhà Lý', videoType: 'DYNASTY' as const, durationMinutes: 0.72 },
  { id: 'golden_le_chi_vien', topic: 'Vụ Án Lệ Chi Viên và Nỗi Oan Nguyễn Trãi', videoType: 'MYSTERY' as const, durationMinutes: 0.72 },
  { id: 'golden_trong_dong', topic: 'Bảo Vật Quốc Gia Trống Đồng Ngọc Lũ', videoType: 'ARTIFACT' as const, durationMinutes: 0.72 },
  { id: 'golden_quang_trung', topic: 'Hoàng đế Quang Trung Đại Phá Quân Thanh 1789', videoType: 'BATTLE' as const, durationMinutes: 0.72 },
];

export async function runOrchestratorRemotionChain(
  options: { verbose?: boolean } = {}
): Promise<OrchestratorRemotionChainReport> {
  console.log('\n================================================================');
  console.log(' CHAIN: ORCHESTRATOR -> REMOTION E2E PIPELINE BENCHMARK');
  console.log(' Target: 6 Golden Historical Test Cases');
  console.log('================================================================\n');

  const preflight = await assertEvalPreflight(['llm', 'embedding', 'tts', 'vlm']);

  let completedCount = 0;
  let schemaValidCount = 0;
  let mp4RenderedCount = 0;
  let totalPacingError = 0;
  let maxRamBytes = process.memoryUsage().rss;

  const testCaseResults: OrchestratorRemotionChainReport['testCaseResults'] = [];

  for (let i = 0; i < GOLDEN_TEST_CASES.length; i++) {
    const tc = GOLDEN_TEST_CASES[i];
    console.log(`[*] [${i + 1}/6] Processing Golden Case: "${tc.topic}" (${tc.durationMinutes} min)...`);

    const initialState: ChronoGraphState = {
      projectId: tc.id,
      userPrompt: tc.topic,
      targetDurationMinutes: tc.durationMinutes,
      videoType: tc.videoType,
      templateId: 'HISTORICAL_DOCUMENTARY',
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
      ragContext: undefined,
      chapterScripts: {},
      factCheckLogs: [],
      scenes: [],
      researchResults: {},
      audioAssets: [],
      pacingErrorPercentage: 0,
      videoProps: undefined,
      errorLog: undefined,
      needsHumanReview: false,
    };

    try {
      // 1. Run 12-step Orchestrator
      const finalState = await runOrchestratorPipeline(initialState);
      if (finalState.status === 'COMPLETED') {
        completedCount++;
      }

      // 2. Validate Schema
      let isSchemaValid = false;
      if (finalState.videoProps) {
        VideoProjectSchema.parse(finalState.videoProps);
        isSchemaValid = true;
        schemaValidCount++;
      }

      // 3. Render Worker Job
      const renderResult = await processRenderJob({
        id: `render_${tc.id}`,
        data: { projectId: tc.id, outputFormat: 'mp4' },
        updateProgress: async () => {},
      } as any);

      const hasMp4 = fs.existsSync(renderResult.outputPath);
      if (hasMp4) {
        mp4RenderedCount++;
      }

      const pacingError = finalState.pacingErrorPercentage ?? 0;
      totalPacingError += pacingError;

      const currentRam = process.memoryUsage().rss;
      if (currentRam > maxRamBytes) {
        maxRamBytes = currentRam;
      }

      const isPass = finalState.status === 'COMPLETED' && isSchemaValid && hasMp4;
      testCaseResults.push({
        id: tc.id,
        topic: tc.topic,
        scenesCount: finalState.scenes.length,
        pacingErrorPct: pacingError,
        mp4Path: renderResult.outputPath,
        status: isPass ? 'PASS' : 'FAIL',
      });

      console.log(`[+] Case ${tc.id}: ${isPass ? '✅ PASS' : '❌ FAIL'} | Scenes: ${finalState.scenes.length} | Pacing Error: ${pacingError}% | MP4: ${renderResult.outputPath}`);
    } catch (err: any) {
      console.error(`[!] Case ${tc.id} FAILED: ${err.message}`);
      testCaseResults.push({
        id: tc.id,
        topic: tc.topic,
        scenesCount: 0,
        pacingErrorPct: 100,
        status: 'FAIL',
      });
    }
  }

  const totalEvaluated = GOLDEN_TEST_CASES.length;
  const avgPacingErrorPct = Math.round((totalPacingError / totalEvaluated) * 100) / 100;
  const maxRamPeakGb = Number((maxRamBytes / (1024 * 1024 * 1024)).toFixed(2));
  const qualityStatus = (completedCount === totalEvaluated && schemaValidCount === totalEvaluated && mp4RenderedCount === totalEvaluated && maxRamPeakGb < 3.8) ? 'PASS' : 'FAIL';

  console.log('\n┌──────────────────────────────────────────────────────────────────────────┐');
  console.log('│             ORCHESTRATOR-REMOTION INTEGRATION CHAIN SUMMARY              │');
  console.log('├─────────────────────────────┬───────────┬────────────┬───────────────────┤');
  console.log('│ Metric Name                 │ Target    │ Actual     │ Verdict           │');
  console.log('├─────────────────────────────┼───────────┼────────────┼───────────────────┤');
  console.log(`│ Golden Cases Completed      │ 6/6 (100) │ ${String(completedCount).padStart(2)}/6 (${Math.round(completedCount/6*100)}%) │ ${completedCount === 6 ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log(`│ Schema v3.2 Validations     │ 6/6 (100) │ ${String(schemaValidCount).padStart(2)}/6 (${Math.round(schemaValidCount/6*100)}%) │ ${schemaValidCount === 6 ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log(`│ MP4 Videos Generated        │ 6/6 (100) │ ${String(mp4RenderedCount).padStart(2)}/6 (${Math.round(mp4RenderedCount/6*100)}%) │ ${mp4RenderedCount === 6 ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log(`│ Average Pacing Error        │ < 5.0%    │ ${avgPacingErrorPct.toFixed(2).padStart(8)}%  │ ${avgPacingErrorPct < 5.0 ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log(`│ Max Peak RAM                │ < 3.80 GB │ ${maxRamPeakGb.toFixed(2).padStart(8)} GB │ ${maxRamPeakGb < 3.8 ? '✅ PASS' : '❌ FAIL'}           │`);
  console.log('├─────────────────────────────┴───────────┴────────────┴───────────────────┤');
  console.log(`│ Chain Status:    ${qualityStatus === 'PASS' ? '✅ PASS (ALL GOLDEN CASES PASSED)' : '❌ FAIL'}                               │`);
  console.log('└──────────────────────────────────────────────────────────────────────────┘\n');

  return {
    chainName: 'orchestrator-remotion',
    timestamp: new Date().toISOString(),
    preflight,
    totalEvaluated,
    completedCount,
    schemaValidCount,
    mp4RenderedCount,
    avgPacingErrorPct,
    maxRamPeakGb,
    qualityStatus,
    testCaseResults,
  };
}
