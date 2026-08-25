/**
 * ChronoViet Master Evaluation Suite Runner
 * Orchestrates Chatbot Dialogue Benchmark and Video Generation Pre-Render Pipeline Benchmark.
 * CLI usage:
 *   pnpm eval:all [--limit <n>] [--chat] [--video] [--strict] [--clean]
 */

import { fileURLToPath } from 'node:url';
import { runChatbotEvaluation } from './chatbot/runner.js';
import { runVideoGenerationEvaluation } from './video-gen/runner.js';
import { assertEvalPreflight } from '@chronoviet/infra';

const __filename = fileURLToPath(import.meta.url);

export interface MasterEvalOptions {
  chat?: boolean;
  video?: boolean;
  limit?: number;
  strict?: boolean;
  clean?: boolean;
}

export async function runMasterEvaluation(options: MasterEvalOptions = {}) {
  const startTime = Date.now();
  console.log('\n================================================================================');
  console.log(' 🇻🇳 CHRONOVIET PRODUCTION BENCHMARK SUITE (REAL RUNTIME EVALUATION)');
  console.log('================================================================================');

  const runChat = options.chat || (!options.chat && !options.video);
  const runVideo = options.video || (!options.chat && !options.video);

  const requiredServices: ('postgres' | 'embedding' | 'llm' | 'vlm' | 'search')[] = ['postgres', 'embedding', 'llm'];
  if (runVideo) {
    requiredServices.push('vlm', 'search');
  }

  // 1. Unified Master Preflight Check
  await assertEvalPreflight(requiredServices);

  let chatReport: any = null;
  let videoReport: any = null;

  // 2. Chatbot Suite Execution
  if (runChat) {
    console.log('\n--------------------------------------------------------------------------------');
    console.log(' [1/2] RUNNING CHATBOT EVALUATION SUITE');
    console.log('--------------------------------------------------------------------------------');
    chatReport = await runChatbotEvaluation({
      limit: options.limit,
      strict: options.strict,
    });
  }

  // 3. Video Generation Suite Execution
  if (runVideo) {
    console.log('\n--------------------------------------------------------------------------------');
    console.log(' [2/2] RUNNING VIDEO GENERATION EVALUATION SUITE');
    console.log('--------------------------------------------------------------------------------');
    videoReport = await runVideoGenerationEvaluation({
      limit: options.limit,
      strict: options.strict,
      clean: options.clean,
    });
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  // 4. Print Master Summary Scorecard
  console.log('\n================================================================================');
  console.log(' 🏆 MASTER EVALUATION SCORECARD');
  console.log('================================================================================');
  console.log(` Total Execution Time: ${durationSec}s`);

  if (chatReport) {
    const chatMark = chatReport.allPassed ? '✅ PASS' : '❌ FAIL';
    console.log(` Chatbot Suite:        ${chatMark} (${chatReport.passedCases}/${chatReport.totalCases} cases passed, pass rate ${(chatReport.passRate * 100).toFixed(1)}%)`);
    console.log(`   - Raw Outputs:      ${chatReport.outputArtifactsDir}`);
    console.log(`   - Report JSON:      ${chatReport.reportFilePath}`);
  }

  if (videoReport) {
    const videoMark = videoReport.allPassed ? '✅ PASS' : '❌ FAIL';
    console.log(` Video Gen Suite:     ${videoMark} (${videoReport.passedCases}/${videoReport.totalCases} topics passed, pass rate ${(videoReport.passRate * 100).toFixed(1)}%)`);
    console.log(`   - Raw Outputs:      ${videoReport.outputArtifactsDir}`);
    console.log(`   - Report JSON:      ${videoReport.reportFilePath}`);
  }

  console.log('================================================================================\n');

  const overallSuccess = (!chatReport || chatReport.allPassed) && (!videoReport || videoReport.allPassed);
  return {
    success: overallSuccess,
    chatReport,
    videoReport,
    durationSec,
  };
}

// Standalone CLI execution
if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('eval/runner.ts'))) {
  const args = process.argv.slice(2);
  const limitArgIdx = args.indexOf('--limit');
  const limit = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : undefined;

  const chat = args.includes('--chat');
  const video = args.includes('--video');
  const strict = args.includes('--strict');
  const clean = args.includes('--clean');

  runMasterEvaluation({ chat, video, limit, strict, clean })
    .then((res) => {
      if (!res.success && strict) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Master evaluation runner failed:', err);
      process.exit(1);
    });
}
