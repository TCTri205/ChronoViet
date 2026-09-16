/**
 * ChronoViet Stage 3: TTS Gen Audio & Pacing Reconciliation Evaluation Suite Runner
 * Evaluates VieNeu TTS voice synthesis, audio file integrity on disk,
 * Real-Time Factor (RTF) speed, word timestamp monotonic alignment,
 * and duration reconciliation fan-in.
 *
 * Supports chaining mode (from outputs/stage2/ or outputs/stage1/) and standalone golden mode (--golden).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertEvalPreflight, initProjectWorkspace, getProjectPaths, envConfig } from '@chronoviet/infra';
import {
  ChronoGraphState,
  ttsSynthesisNode,
  durationReconciliationNode,
} from '@chronoviet/agent-orchestrator';
import {
  saveJsonArtifact,
  saveSuiteEvaluationReport,
  printCliSummaryTable,
  ensureDirectory,
  BaseSuiteReport,
} from '../shared/index.js';
import {
  Stage3AudioCaseResult,
  Stage3SceneAudioSummary,
  validateWavHeader,
  evaluateStage3AudioCase,
  computeStage3AudioAggregatedMetrics,
} from './metrics/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunStage3AudioEvalOptions {
  limit?: number;
  type?: string;
  strict?: boolean;
  clean?: boolean;
  golden?: boolean;
  sourceDir?: string;
}

interface Stage3InputCase {
  id: string;
  topic: string;
  epoch?: string;
  videoType: string;
  templateId: string;
  targetDurationMinutes: number;
  chapters?: any[];
  chapterScripts?: Record<number | string, string>;
  scenes: any[];
  ragContext?: any;
  source: 'GOLDEN_FIXTURE' | 'STAGE2_OUTPUT' | 'STAGE1_OUTPUT';
}

export async function runStage3AudioEvaluation(
  options: RunStage3AudioEvalOptions = {}
): Promise<BaseSuiteReport<Stage3AudioCaseResult>> {
  const startTime = new Date();
  const startTimeMs = Date.now();

  console.log('\n🎙️ [Stage 3] Starting ChronoViet TTS Gen Audio & Pacing Reconciliation Evaluation Suite...');

  // 1. Preflight Health Checks: TTS service (Must be strictly healthy, no fallback)
  const preflight = await assertEvalPreflight(['tts']);
  const ttsCheck = preflight.checks.find((c) => c.service === 'tts');
  if (!ttsCheck || !ttsCheck.healthy) {
    console.error('\n❌ [FATAL] VieNeu-TTS service is NOT healthy or unreachable on http://localhost:8080.');
    console.error('Fallback is completely disabled. Please ensure VieNeu-TTS container is running:');
    console.error('  pnpm ai:tts\n');
    process.exit(1);
  }

  const stage1OutputsDir = path.resolve(__dirname, 'outputs/stage1');
  const stage2OutputsDir = path.resolve(__dirname, 'outputs/stage2');
  const stage3OutputsDir = path.resolve(__dirname, 'outputs/stage3');
  const reportsDir = path.resolve(__dirname, 'reports');
  ensureDirectory(stage3OutputsDir);
  ensureDirectory(reportsDir);

  // 2. Select Input Data Source (Chaining Stage 2 -> Stage 1 -> Golden Fixtures)
  let inputCases: Stage3InputCase[] = [];
  const preferGolden = options.golden === true;
  let useGolden = preferGolden;

  if (!preferGolden) {
    const candidateDirs = [
      options.sourceDir,
      stage2OutputsDir,
      stage1OutputsDir,
    ].filter(Boolean) as string[];

    for (const searchDir of candidateDirs) {
      if (fs.existsSync(searchDir)) {
        const jsonFiles = fs.readdirSync(searchDir).filter((f) => f.endsWith('.json')).sort();
        if (jsonFiles.length > 0) {
          console.log(`📦 Loaded ${jsonFiles.length} artifacts from ${searchDir}`);
          for (const file of jsonFiles) {
            try {
              const raw = fs.readFileSync(path.join(searchDir, file), 'utf-8');
              const data = JSON.parse(raw);
              const targetState = data.stage2State || data.stage1State || data.finalState;
              if (targetState && targetState.scenes && targetState.scenes.length > 0) {
                inputCases.push({
                  id: data.testCase?.id || data.result?.id || path.basename(file, '.json'),
                  topic: data.testCase?.topic || data.result?.topic || targetState?.userPrompt,
                  epoch: data.testCase?.epoch,
                  videoType: targetState?.videoType || data.testCase?.videoType || 'DYNASTY',
                  templateId: targetState?.templateId || 'HISTORICAL_DOCUMENTARY',
                  targetDurationMinutes: targetState?.targetDurationMinutes || data.testCase?.targetDurationMinutes || 2,
                  chapters: targetState?.chapters || [],
                  chapterScripts: targetState?.chapterScripts || {},
                  scenes: targetState?.scenes || [],
                  ragContext: targetState?.ragContext,
                  source: searchDir === stage2OutputsDir ? 'STAGE2_OUTPUT' : 'STAGE1_OUTPUT',
                });
              }
            } catch (e: any) {
              console.warn(`Could not parse ${file}: ${e.message}`);
            }
          }
          if (inputCases.length > 0) break;
        }
      }
    }

    if (inputCases.length === 0) {
      console.log(`ℹ️ No prior stage outputs found. Auto-falling back to Golden Script Fixtures.`);
      useGolden = true;
    }
  }

  if (useGolden) {
    const goldenPath = path.resolve(__dirname, 'datasets/golden-script-scenes.json');
    console.log(`✨ Using Golden Script Fixtures: ${goldenPath}`);
    const rawGolden = fs.readFileSync(goldenPath, 'utf-8');
    const goldens = JSON.parse(rawGolden);
    inputCases = goldens.map((g: any) => ({
      id: g.id,
      topic: g.topic,
      epoch: g.epoch,
      videoType: g.videoType || 'DYNASTY',
      templateId: g.templateId || 'HISTORICAL_DOCUMENTARY',
      targetDurationMinutes: g.targetDurationMinutes || 2,
      chapters: g.chapters || [],
      chapterScripts: g.chapterScripts || {},
      scenes: g.scenes || [],
      ragContext: undefined,
      source: 'GOLDEN_FIXTURE' as const,
    }));
  }

  const datasetTotalCases = inputCases.length;

  if (options.type) {
    const typeUpper = options.type.toUpperCase();
    inputCases = inputCases.filter((tc) => tc.videoType.toUpperCase() === typeUpper);
    console.log(`Filtered by video type "${typeUpper}": ${inputCases.length} cases remaining.`);
  }

  if (options.limit && options.limit > 0) {
    inputCases = inputCases.slice(0, options.limit);
    console.log(`Applied limit: running ${inputCases.length} audio synthesis cases.`);
  }

  const isSubset = inputCases.length < datasetTotalCases || options.golden === true;
  const caseResults: Stage3AudioCaseResult[] = [];
  const createdProjectIds: string[] = [];

  // 3. Execute Stage 3 TTS Synthesis & Duration Reconciliation Pipeline
  for (let i = 0; i < inputCases.length; i++) {
    const tc = inputCases[i];
    const projectId = `eval_s3_${tc.id}`;
    createdProjectIds.push(projectId);

    console.log(`\n[${i + 1}/${inputCases.length}] Stage 3 Audio: ${tc.id} — "${tc.topic}" (${tc.videoType}, source=${tc.source})`);
    const caseStart = Date.now();

    try {
      // Step 1: Clean and init workspace inside outputs/stage3
      const existingWorkspace = getProjectPaths(projectId, stage3OutputsDir);
      if (fs.existsSync(existingWorkspace.rootDir)) {
        fs.rmSync(existingWorkspace.rootDir, { recursive: true, force: true });
      }
      initProjectWorkspace(projectId, stage3OutputsDir);

      let state: ChronoGraphState = {
        projectId,
        customBaseDir: stage3OutputsDir,
        correlationId: undefined,
        userPrompt: tc.topic,
        videoBriefId: undefined,
        targetDurationMinutes: tc.targetDurationMinutes,
        videoType: tc.videoType as any,
        templateId: (tc.templateId as any) || 'HISTORICAL_DOCUMENTARY',
        status: 'RESEARCH_COMPLETED',
        currentStep: 6,
        ragContext: tc.ragContext,
        chapters: tc.chapters || [],
        currentChapterIndex: 0,
        runningNarrativeState: {
          previousChapterSummary: '',
          establishedTone: 'Hùng tráng',
          introducedEntities: [],
          transitionHook: '',
        },
        chapterScripts: tc.chapterScripts || {},
        factCheckLogs: [],
        scenes: tc.scenes || [],
        researchResults: {},
        audioAssets: [],
        pacingErrorPercentage: 0,
        videoProps: undefined,
        errorLog: undefined,
        telemetryAudit: [],
        needsHumanReview: false,
      };

      // Step 2: Parallel Worker A (TTS Synthesis Node)
      console.log(`  ├─ Parallel Worker A: VieNeu TTS Audio Synthesis...`);
      const ttsStart = Date.now();
      const ttsUpdate = await ttsSynthesisNode(state);
      const ttsDurationMs = Date.now() - ttsStart;
      state = { ...state, ...ttsUpdate };

      // Step 3: Duration Reconciliation Node (Micro-Step 1B-Reconcile)
      console.log(`  ├─ Micro-Step 1B-Reconcile: Duration Reconciliation & Time-Stretch (+-10%)...`);
      const reconcileUpdate = await durationReconciliationNode(state);
      state = { ...state, ...reconcileUpdate };

      const caseDuration = Date.now() - caseStart;

      // Step 4: Audit Audio Files on Disk, Word Timestamps, and WAV Format
      const paths = getProjectPaths(projectId, stage3OutputsDir);
      const sceneSummaries: Stage3SceneAudioSummary[] = [];

      for (const scene of state.scenes || []) {
        let audioFileExists = false;
        let audioFileSizeBytes = 0;
        let wavHeaderValid = false;
        let sampleRate = 0;
        let errorMsg: string | undefined;

        const resolvedAudioPath = scene.audioPath || path.join(paths.audioDir, `${scene.sceneId}.wav`);

        if (fs.existsSync(resolvedAudioPath)) {
          audioFileExists = true;
          const stat = fs.statSync(resolvedAudioPath);
          audioFileSizeBytes = stat.size;

          try {
            const buffer = fs.readFileSync(resolvedAudioPath);
            const headerCheck = validateWavHeader(buffer);
            wavHeaderValid = headerCheck.valid;
            sampleRate = headerCheck.sampleRate;
            if (!headerCheck.valid) {
              errorMsg = headerCheck.reason;
            }
          } catch (readErr: any) {
            wavHeaderValid = false;
            errorMsg = `Failed to read WAV header: ${readErr.message}`;
          }
        } else {
          errorMsg = 'Audio file not found on disk';
        }

        // Check word timestamps
        const wts = scene.wordTimestamps || [];
        let timestampsMonotonic = wts.length > 0;
        for (let j = 0; j < wts.length; j++) {
          const curr = wts[j];
          if (curr.endMs < curr.startMs) {
            timestampsMonotonic = false;
            errorMsg = `Timestamp inverted for word "${curr.word}": ${curr.startMs}ms > ${curr.endMs}ms`;
            break;
          }
          if (j > 0 && curr.startMs < wts[j - 1].startMs) {
            timestampsMonotonic = false;
            errorMsg = `Non-monotonic startMs for word "${curr.word}": ${curr.startMs}ms < ${wts[j - 1].startMs}ms`;
            break;
          }
        }

        // Check if fallback was used
        const isSyntheticFallback = state.telemetryAudit?.some(
          (t) => t.node === 'tts_synthesis' && t.category === 'FALLBACK' && (t.metadata as any)?.sceneId === scene.sceneId
        ) ?? false;

        const wordCount = scene.voiceoverText ? scene.voiceoverText.trim().split(/\s+/).filter(Boolean).length : 0;
        const audioDur = scene.audioDurationSeconds || 0;
        const sceneLatency = ttsDurationMs / Math.max(1, state.scenes.length);
        const rtf = audioDur > 0 ? sceneLatency / (audioDur * 1000) : 0;

        sceneSummaries.push({
          sceneId: scene.sceneId,
          voiceoverText: scene.voiceoverText || '',
          wordCount,
          audioPath: resolvedAudioPath,
          audioFileExists,
          audioFileSizeBytes,
          audioDurationSeconds: audioDur,
          targetDurationSeconds: scene.targetDurationSeconds || 5,
          reconciledDurationSeconds: scene.targetDurationSeconds || 5,
          rtf: Math.round(rtf * 100) / 100,
          synthesisLatencyMs: Math.round(sceneLatency),
          wordTimestampsCount: wts.length,
          timestampsMonotonic,
          wavHeaderValid,
          sampleRate,
          isSyntheticFallback,
          errorMsg,
        });
      }

      const reconciledTotalSec = (state.scenes || []).reduce((sum, s) => sum + (s.targetDurationSeconds || 5), 0);

      // Evaluate Case Result
      const caseResult = evaluateStage3AudioCase(
        {
          id: tc.id,
          topic: tc.topic,
          videoType: tc.videoType,
          targetDurationMinutes: tc.targetDurationMinutes,
          pacingErrorPercentage: state.pacingErrorPercentage,
          executionDurationMs: caseDuration,
        },
        sceneSummaries,
        reconciledTotalSec,
        options.strict ?? false
      );

      caseResults.push(caseResult);

      // Save Stage 3 Snapshot Artifact to outputs/stage3/<id>.json
      const artifactPath = path.join(stage3OutputsDir, `${tc.id}.json`);
      saveJsonArtifact(artifactPath, {
        testCase: tc,
        result: caseResult,
        stage3State: {
          projectId: state.projectId,
          status: state.status,
          chapters: state.chapters,
          chapterScripts: state.chapterScripts,
          scenes: state.scenes,
          audioAssets: state.audioAssets,
          pacingErrorPercentage: state.pacingErrorPercentage,
          telemetryAudit: state.telemetryAudit,
        },
        executedAt: new Date().toISOString(),
      });

      const statusMark = caseResult.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(
        `  └─ Status: ${statusMark} | Audio: ${caseResult.audioGeneratedScenes}/${caseResult.totalScenes} | RTF: ${caseResult.meanRtf}x | Recon Dev: ${caseResult.pacingReconciliationDeviationPct}% | Time: ${caseDuration}ms`
      );
      if (caseResult.errors && caseResult.errors.length > 0) {
        console.log(`     Errors: ${caseResult.errors.join('; ')}`);
      }
      if (caseResult.warnings && caseResult.warnings.length > 0) {
        console.log(`     Warnings: ${caseResult.warnings.join('; ')}`);
      }

      // Clean audio if requested
      if (options.clean) {
        const audioDir = paths.audioDir;
        if (fs.existsSync(audioDir)) {
          fs.rmSync(audioDir, { recursive: true, force: true });
        }
      }
    } catch (err: any) {
      const caseDuration = Date.now() - caseStart;
      console.error(`  └─ ❌ ERROR in Stage 3 Audio Case ${tc.id}:`, err.message);
      caseResults.push({
        id: tc.id,
        title: tc.topic,
        topic: tc.topic,
        videoType: tc.videoType,
        totalScenes: 0,
        audioGeneratedScenes: 0,
        audioGenerationSuccessRate: 0,
        meanRtf: 0,
        timestampsMonotonicRate: 0,
        wavHeaderValidRate: 0,
        pacingReconciliationDeviationPct: 100,
        reconciliationPassed: false,
        syntheticFallbackCount: 0,
        durationMs: caseDuration,
        passed: false,
        scenes: [],
        errors: [`Execution failed: ${err.message}`],
      });
    }
  }

  const totalDurationMs = Date.now() - startTimeMs;
  const aggregatedMetrics = computeStage3AudioAggregatedMetrics(caseResults);
  const allPassed = caseResults.length > 0 && caseResults.every((r) => r.passed);

  const suiteReport: BaseSuiteReport<Stage3AudioCaseResult> = {
    title: 'ChronoViet Stage 3: TTS Gen Audio & Duration Reconciliation Evaluation Report',
    suite: 'VIDEO_GEN',
    timestamp: new Date().toISOString(),
    totalCases: caseResults.length,
    datasetTotalCases,
    isSubset,
    appliedFilters: {
      limit: options.limit,
      type: options.type,
      golden: options.golden,
    },
    passedCases: aggregatedMetrics.passedCases,
    failedCases: aggregatedMetrics.totalCases - aggregatedMetrics.passedCases,
    passRate: aggregatedMetrics.totalCases > 0
      ? aggregatedMetrics.passedCases / aggregatedMetrics.totalCases
      : 0,
    allPassed,
    metrics: aggregatedMetrics.metricScores,
    caseResults,
    metadata: {
      suite: 'VIDEO_GEN',
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
      durationMs: totalDurationMs,
      strict: options.strict ?? false,
      preflight,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
      localTime: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      platform: `${process.platform}-${process.arch}`,
      nodeVersion: process.version,
    },
    outputArtifactsDir: stage3OutputsDir,
  };

  saveSuiteEvaluationReport({
    report: suiteReport,
    reportsDir,
    baseFileName: 'stage3-audio-report',
    archiveHistory: true,
  });

  printCliSummaryTable(suiteReport);

  if (suiteReport.failedCases > 0) {
    console.log(`\n⚠️ Notice: ${suiteReport.failedCases}/${suiteReport.totalCases} individual cases failed quality thresholds.`);
  }

  return suiteReport;
}

if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('stage3-audio-runner.ts'))) {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  const limitArg = args.find((a) => a === '--limit' || a.startsWith('--limit='));
  if (limitArg) {
    if (limitArg.includes('=')) {
      limit = parseInt(limitArg.split('=')[1], 10);
    } else {
      const idx = args.indexOf(limitArg);
      limit = parseInt(args[idx + 1], 10);
    }
  }

  let type: string | undefined;
  const typeArg = args.find((a) => a === '--type' || a.startsWith('--type='));
  if (typeArg) {
    if (typeArg.includes('=')) {
      type = typeArg.split('=')[1];
    } else {
      const idx = args.indexOf(typeArg);
      type = args[idx + 1];
    }
  }

  const strict = args.includes('--strict');
  const clean = args.includes('--clean');
  const golden = args.includes('--golden');

  runStage3AudioEvaluation({ limit, type, strict, clean, golden })
    .then((report) => {
      if (!report.allPassed && strict) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Stage 3 Audio evaluation runner failed:', err);
      process.exit(1);
    });
}
