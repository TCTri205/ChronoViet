/**
 * Master ChronoAgent-Eval v2.0 CLI Benchmark Suite
 * Component-Level Benchmark Suite & Regression Quality Gate Runner
 *
 * Usage:
 *   tsx eval/benchmarks/index.ts --all
 *   tsx eval/benchmarks/index.ts --a0 --sample 10
 *   tsx eval/benchmarks/index.ts --a3 --sample 20
 *   tsx eval/benchmarks/index.ts --sys --sample 5
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Enforce Eval Strict Mode for deterministic benchmarks
process.env.EVAL_STRICT = 'true';

import { ComponentBenchmarkReport } from '@chronoviet/shared-spec';
import { runA0Benchmark } from './a0-chat-brief.bench.js';
import { runA1Benchmark } from './a1-chaptering.bench.js';
import { runA2Benchmark } from './a2-scriptwriting.bench.js';
import { runA3Benchmark } from './a3-guardrails-auditor.bench.js';
import { runA4Benchmark } from './a4-scene-direction.bench.js';
import { runA5Benchmark } from './a5-research-agent.bench.js';
import { runSysBenchmark } from './sys-orchestration-ablation.bench.js';
import { evaluateOrchestratorQualityGates } from './regression-gate.js';
import { assertEvalPreflight } from '@chronoviet/infra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CliOptions {
  runA0: boolean;
  runA1: boolean;
  runA2: boolean;
  runA3: boolean;
  runA4: boolean;
  runA5: boolean;
  runSys: boolean;
  sample?: number;
  fresh: boolean;
  quick: boolean;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  let runA0 = false;
  let runA1 = false;
  let runA2 = false;
  let runA3 = false;
  let runA4 = false;
  let runA5 = false;
  let runSys = false;
  let sample: number | undefined;
  let fresh = false;
  let quick = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--a0') runA0 = true;
    else if (a === '--a1') runA1 = true;
    else if (a === '--a2') runA2 = true;
    else if (a === '--a3') runA3 = true;
    else if (a === '--a4') runA4 = true;
    else if (a === '--a5') runA5 = true;
    else if (a === '--sys') runSys = true;
    else if (a === '--all') {
      runA0 = runA1 = runA2 = runA3 = runA4 = runA5 = runSys = true;
    } else if (a === '--quick') {
      quick = true;
      sample = 5;
    } else if (a === '--fresh') {
      fresh = true;
    } else if (a === '--sample' && args[i + 1]) {
      sample = parseInt(args[++i], 10);
    } else if (a.startsWith('--sample=')) {
      sample = parseInt(a.split('=')[1], 10);
    }
  }

  // Default to all if none explicitly requested
  if (!runA0 && !runA1 && !runA2 && !runA3 && !runA4 && !runA5 && !runSys) {
    runA0 = runA1 = runA2 = runA3 = runA4 = runA5 = runSys = true;
  }

  return { runA0, runA1, runA2, runA3, runA4, runA5, runSys, sample, fresh, quick };
}

export async function main() {
  const opts = parseCliArgs();

  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║       CHRONOAGENT-EVAL v2.0: MULTI-AGENT COMPONENT EVALUATION SUITE      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  await assertEvalPreflight(['llm', 'postgres']);

  if (opts.sample) console.log(`⚡ Sampling active: running with ${opts.sample} items per benchmark\n`);

  const executedReports: Record<string, ComponentBenchmarkReport> = {};

  if (opts.runA0) {
    console.log('▶ [Tier A0] Running Chat Understanding & Brief Compilation Benchmark...');
    executedReports['TIER_A0_CHAT_BRIEF_COMPILATION'] = await runA0Benchmark({ sample: opts.sample, fresh: opts.fresh });
    console.log(`  └─ Verdict: ${executedReports['TIER_A0_CHAT_BRIEF_COMPILATION'].kpis_passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  if (opts.runA1) {
    console.log('▶ [Tier A1] Running Chaptering & Outline Budgeting Benchmark...');
    executedReports['TIER_A1_CHAPTERING_BUDGETING'] = await runA1Benchmark({ sample: opts.sample, fresh: opts.fresh });
    console.log(`  └─ Verdict: ${executedReports['TIER_A1_CHAPTERING_BUDGETING'].kpis_passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  if (opts.runA2) {
    console.log('▶ [Tier A2] Running Historical Scriptwriting & Tone Benchmark...');
    executedReports['TIER_A2_SCRIPTWRITING_TONE'] = await runA2Benchmark({ sample: opts.sample, fresh: opts.fresh });
    console.log(`  └─ Verdict: ${executedReports['TIER_A2_SCRIPTWRITING_TONE'].kpis_passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  if (opts.runA3) {
    console.log('▶ [Tier A3] Running Guardrails, Anti-Sycophancy & Grounding Benchmark...');
    executedReports['TIER_A3_GUARDRAILS_AUDITOR'] = await runA3Benchmark({ sample: opts.sample, fresh: opts.fresh });
    console.log(`  └─ Verdict: ${executedReports['TIER_A3_GUARDRAILS_AUDITOR'].kpis_passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  if (opts.runA4) {
    console.log('▶ [Tier A4] Running Scene Segmentation & Visual Direction Benchmark...');
    executedReports['TIER_A4_SCENE_DIRECTION'] = await runA4Benchmark({ sample: opts.sample, fresh: opts.fresh });
    console.log(`  └─ Verdict: ${executedReports['TIER_A4_SCENE_DIRECTION'].kpis_passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  if (opts.runA5) {
    console.log('▶ [Tier A5] Running Research Agent & Whitelist Licensing Benchmark...');
    executedReports['TIER_A5_RESEARCH_AGENT'] = await runA5Benchmark({ sample: opts.sample, fresh: opts.fresh });
    console.log(`  └─ Verdict: ${executedReports['TIER_A5_RESEARCH_AGENT'].kpis_passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  if (opts.runSys) {
    console.log('▶ [Tier SYS] Running StateGraph Orchestration & Ablation Benchmark...');
    executedReports['TIER_SYS_ORCHESTRATION_ABLATION'] = await runSysBenchmark({ sample: opts.sample, fresh: opts.fresh });
    console.log(`  └─ Verdict: ${executedReports['TIER_SYS_ORCHESTRATION_ABLATION'].kpis_passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  // Evaluate Quality Gates
  console.log('┌──────────────────────────────────────────────────────────────────────────┐');
  console.log('│                      REGRESSION QUALITY GATES AUDIT                      │');
  console.log('├──────────────────────────────┬──────────┬───────────┬────────────────────┤');
  console.log('│ Gate Name                    │ Target   │ Actual    │ Status             │');
  console.log('├──────────────────────────────┼──────────┼───────────┼────────────────────┤');

  const { allPassed, gates } = evaluateOrchestratorQualityGates(executedReports);

  for (const g of gates) {
    console.log(
      `│ ${g.metric_name.padEnd(28)} │ ${(g.threshold + '%').padStart(8)} │ ${(g.current_value + '%').padStart(9)} │ ${g.passed ? '✅ PASS' : '❌ FAIL'}             │`
    );
  }

  console.log('└──────────────────────────────┴──────────┴───────────┴────────────────────┘\n');
  console.log(`Final Evaluation Status: ${allPassed ? '🎉 ALL QUALITY GATES PASSED (PASS)' : '❌ QUALITY GATES FAILED'}\n`);

  process.exit(allPassed ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => {
    console.error('Fatal benchmark crash:', err);
    process.exit(1);
  });
}
