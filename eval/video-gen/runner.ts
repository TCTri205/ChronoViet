/**
 * ChronoViet Video Generation Evaluation Suite Runner
 * Orchestrates 4-Stage Decoupled & End-to-End Evaluation Suite:
 * - Stage 1 (Script & Narrative): Fast text-only grounding, narrative flow, planned pacing, fact-checking, scene bounds.
 * - Stage 2 (Visual Research & Curation): Trilingual visual queries, image search, disk download, license whitelist, VLM scoring.
 * - Stage 3 (TTS Gen Audio & Pacing): Real VieNeu voice synthesis, 16-bit PCM WAV on disk, word timestamps, duration reconciliation.
 * - Stage 4 (Remotion Video Composition & Render): Zod schema verification, headless MP4 rendering, timeline audio-video sync.
 * - Stage All (Master Video-Gen Benchmark): End-to-end 4-stage pipeline execution with unified scorecard.
 *
 * CLI usage:
 *   pnpm eval:video [--stage=1|2|3|4|all] [--golden] [--limit <n>] [--type <type>] [--strict] [--clean] [--concurrency <n>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertEvalPreflight,
  initProjectWorkspace,
  getProjectPaths,
  findMonorepoRoot,
  loadProjectSchema,
} from '@chronoviet/infra';
import { ChronoRagEngine } from '@chronoviet/rag-engine';
import { isWhitelistedLicense } from '@chronoviet/vlm-inspector';
import { VideoProjectSchema } from '@chronoviet/shared-spec';
import {
  ChronoGraphState,
  runOrchestratorPipeline,
} from '@chronoviet/agent-orchestrator';
import {
  saveJsonArtifact,
  saveSuiteEvaluationReport,
  printCliSummaryTable,
  ensureDirectory,
  BaseSuiteReport,
} from '../shared/index.js';
import {
  VideoGenTestCase,
  VideoGenSceneSummary,
  VideoGenCaseResult,
  evaluateVideoGenCase,
  computeVideoGenAggregatedMetrics,
  validateWavHeader,
} from './metrics/index.js';
import { runStage1ScriptEvaluation } from './stage1-script-runner.js';
import { runStage2VisualEvaluation } from './stage2-visual-runner.js';
import { runStage3AudioEvaluation } from './stage3-audio-runner.js';
import { runStage4RenderEvaluation, prepareSchemaForRemotionRender } from './stage4-render-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunVideoGenEvalOptions {
  limit?: number;
  type?: string;
  strict?: boolean;
  clean?: boolean;
  stage?: '1' | '2' | '3' | '4' | 'all' | 'script' | 'visual' | 'audio' | 'render';
  golden?: boolean;
  stage1Dir?: string;
  stage2Dir?: string;
  stage3Dir?: string;
  concurrency?: number;
}

export async function runVideoGenerationEvaluation(
  options: RunVideoGenEvalOptions = {}
): Promise<BaseSuiteReport<any>> {
  const stage = options.stage || 'all';

  if (stage === '1' || stage === 'script') {
    return runStage1ScriptEvaluation({
      limit: options.limit,
      type: options.type,
      strict: options.strict,
      clean: options.clean,
    });
  }

  if (stage === '2' || stage === 'visual') {
    return runStage2VisualEvaluation({
      limit: options.limit,
      type: options.type,
      strict: options.strict,
      clean: options.clean,
      golden: options.golden,
      stage1Dir: options.stage1Dir,
    });
  }

  if (stage === '3' || stage === 'audio') {
    return runStage3AudioEvaluation({
      limit: options.limit,
      type: options.type,
      strict: options.strict,
      clean: options.clean,
      golden: options.golden,
      sourceDir: options.stage2Dir,
    });
  }

  if (stage === '4' || stage === 'render') {
    return runStage4RenderEvaluation({
      limit: options.limit,
      type: options.type,
      strict: options.strict,
      clean: options.clean,
      golden: options.golden,
      sourceDir: options.stage3Dir,
      concurrency: options.concurrency,
    });
  }

  // Stage All: Full End-to-End Master 4-Stage Pipeline
  const startTime = new Date();
  const startTimeMs = Date.now();

  console.log('\n🎬 Starting ChronoViet Video Generation (End-to-End Master 4-Stage Pipeline) Evaluation Suite...');

  // 1. Preflight Health Checks across all modules
  const preflight = await assertEvalPreflight(['postgres', 'embedding', 'llm', 'vlm', 'search', 'tts']);

  // Locate Remotion Engine
  const monorepoRoot = findMonorepoRoot();
  const remotionPkgDir = path.resolve(monorepoRoot, 'packages/remotion-engine');
  const remotionEntry = path.join(remotionPkgDir, 'src/index.ts');

  if (!fs.existsSync(remotionEntry)) {
    throw new Error(`Remotion entry not found at: ${remotionEntry}`);
  }

  // 2. Load Video Test Topics Dataset
  const datasetPath = path.resolve(__dirname, 'datasets/video-gen-test-cases.json');
  const rawData = fs.readFileSync(datasetPath, 'utf-8');
  const allDatasetCases: VideoGenTestCase[] = JSON.parse(rawData);
  const datasetTotalCases = allDatasetCases.length;
  let testCases: VideoGenTestCase[] = [...allDatasetCases];

  if (options.type) {
    const typeUpper = options.type.toUpperCase();
    testCases = testCases.filter((tc) => tc.videoType.toUpperCase() === typeUpper);
    console.log(`Filtered by video type "${typeUpper}": ${testCases.length} topics remaining.`);
  }

  if (options.limit && options.limit > 0) {
    testCases = testCases.slice(0, options.limit);
    console.log(`Applied limit: running ${testCases.length} video generation topics.`);
  }

  const isSubset = testCases.length < datasetTotalCases;

  const outputsDir = path.resolve(__dirname, 'outputs');
  const reportsDir = path.resolve(__dirname, 'reports');
  ensureDirectory(outputsDir);
  ensureDirectory(reportsDir);

  const ragEngine = new ChronoRagEngine();
  const caseResults: VideoGenCaseResult[] = [];
  const createdProjectIds: string[] = [];
  const renderConcurrency = String(options.concurrency || 2);

  // 3. Execute End-to-End 4-Stage Pipeline for Each Test Case
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const projectId = `eval_proj_${tc.id}`;
    createdProjectIds.push(projectId);

    console.log(`\n[${i + 1}/${testCases.length}] End-to-End Video: ${tc.id} — "${tc.topic}" (${tc.videoType}, ${tc.targetDurationMinutes}m)`);
    const caseStart = Date.now();

    try {
      // Step 0: Auto-clean prior project workspace inside outputs/ on re-run, then initialize fresh
      const existingWorkspace = getProjectPaths(projectId, outputsDir);
      if (fs.existsSync(existingWorkspace.rootDir)) {
        fs.rmSync(existingWorkspace.rootDir, { recursive: true, force: true });
      }
      const paths = initProjectWorkspace(projectId, outputsDir);

      // Step 1: GraphRAG Knowledge Grounding
      console.log(`  ├─ [Stage 1] GraphRAG Search & Chaptering...`);
      const ragQuery = (tc as any).searchKeywordsCheck && (tc as any).searchKeywordsCheck.length > 0
        ? `${tc.topic} ${(tc as any).searchKeywordsCheck.join(' ')}`
        : tc.topic;

      const ragSearchResult = await ragEngine.search({
        query: ragQuery,
        maxTokens: 4000,
        rerankTopK: Math.max(10, Math.min(16, (tc.targetDurationMinutes || 2) * 2 + 6)),
      });

      const ragContext = {
        verifiedContext: ragSearchResult.verifiedContext,
        aliasTable: ragSearchResult.aliasTable,
        citations: ragSearchResult.citations.map((c: any) => (typeof c === 'string' ? c : c.sourceTitle)),
      };

      let state: ChronoGraphState = {
        projectId,
        customBaseDir: outputsDir,
        correlationId: undefined,
        userPrompt: tc.topic,
        videoBriefId: undefined,
        targetDurationMinutes: tc.targetDurationMinutes,
        videoType: tc.videoType,
        templateId: 'HISTORICAL_DOCUMENTARY',
        status: 'INIT',
        currentStep: 1,
        ragContext,
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
        researchResults: {},
        audioAssets: [],
        pacingErrorPercentage: 0,
        videoProps: undefined,
        errorLog: undefined,
        telemetryAudit: [],
        needsHumanReview: false,
      };

      // Step 2: Execute LangGraph Multi-Agent Orchestrator Pipeline
      // (Stage 1 Scriptwriter & Segmenter + Stage 2 Visual Curation & VLM + Stage 3 TTS & Reconciliation + Packager)
      console.log(`  ├─ [Stage 1-3] LangGraph Orchestrator Execution (Script + Visual + TTS)...`);
      state = await runOrchestratorPipeline(state, { resumeFromCheckpoint: false });

      // Log immediately if human review / severe hallucination triggered
      if (state.needsHumanReview) {
        console.error(`  ├─ ❌ [Stage 1 Guardrail] Severe hallucination flagged by Fact-Checker -> Case marked for review`);
      }

      // Step 3: Audit Stage 3 Audio Assets on Disk
      console.log(`  ├─ [Stage 3 Audit] Verifying Synthesized WAV Audio & Word Timestamps...`);
      let audioGeneratedScenes = 0;
      let validWavHeaders = 0;
      let monotonicTimestampsCount = 0;
      let syntheticFallbackCount = 0;

      for (const scene of state.scenes || []) {
        const audioPath = scene.audioPath || path.join(paths.audioDir, `${scene.sceneId}.wav`);
        if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) {
          audioGeneratedScenes++;
          try {
            const buf = fs.readFileSync(audioPath);
            const check = validateWavHeader(buf);
            if (check.valid) validWavHeaders++;
          } catch {}
        }

        const wts = scene.wordTimestamps || [];
        let isMono = wts.length > 0;
        for (let j = 0; j < wts.length; j++) {
          if (wts[j].endMs < wts[j].startMs || (j > 0 && wts[j].startMs < wts[j - 1].startMs)) {
            isMono = false;
            break;
          }
        }
        if (isMono) monotonicTimestampsCount++;

        const isFallback = state.telemetryAudit?.some(
          (t) => t.node === 'tts_synthesis' && t.category === 'FALLBACK' && (t.metadata as any)?.sceneId === scene.sceneId
        );
        if (isFallback) {
          syntheticFallbackCount++;
          console.warn(`  ├─ ⚠️ [Stage 3 Fallback] Scene ${scene.sceneId} used synthetic fallback audio`);
        }
      }

      const totalScenesCount = (state.scenes || []).length;
      const audioGenSuccessRate = totalScenesCount > 0 ? audioGeneratedScenes / totalScenesCount : 0;
      const wavHeaderRate = totalScenesCount > 0 ? validWavHeaders / totalScenesCount : 0;
      const timestampsMonoRate = totalScenesCount > 0 ? monotonicTimestampsCount / totalScenesCount : 0;

      // Step 4: [Stage 4] Validate VideoProjectSchema & Execute Remotion Render
      console.log(`  ├─ [Stage 4] Validating VideoProjectSchema & Rendering MP4 with Remotion...`);
      const schemaPath = path.join(paths.rootDir, 'project_schema.json');
      let schemaValidated = false;
      const schemaErrors: string[] = [];
      let projectSchema: any;

      try {
        projectSchema = loadProjectSchema(projectId, outputsDir);
        const parsed = VideoProjectSchema.safeParse(projectSchema);
        if (parsed.success) {
          schemaValidated = true;
        } else {
          schemaValidated = false;
          schemaErrors.push(...parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`));
          console.error(`  ├─ ❌ [Stage 4 Schema] Zod validation failed: ${schemaErrors.join('; ')}`);
        }
      } catch (loadErr: any) {
        schemaValidated = false;
        schemaErrors.push(`Failed to load project schema: ${loadErr.message}`);
      }

      // Prepare render props with data URIs for local audio & image files so Remotion headless browser can access them directly
      const renderSchema = prepareSchemaForRemotionRender(projectSchema);
      const renderPropsPath = path.join(paths.rootDir, 'render_props.json');
      fs.writeFileSync(renderPropsPath, JSON.stringify(renderSchema, null, 2), 'utf-8');

      // Execute Real Remotion Render
      const outputPath = path.join(paths.outputDir, 'video.mp4');
      const compId = 'ChronoVideo';
      let renderStdErr = '';
      let renderStdOut = '';
      let videoRenderSuccess = false;
      const renderStart = Date.now();

      try {
        await new Promise<void>((resolve, reject) => {
          const renderProc = spawn(
            'npx',
            [
              'remotion',
              'render',
              remotionEntry,
              compId,
              outputPath,
              `--props=${renderPropsPath}`,
              `--concurrency=${renderConcurrency}`,
              '--gl=angle',
              '--overwrite',
            ],
            {
              cwd: remotionPkgDir,
              stdio: 'pipe',
            }
          );

          renderProc.stdout.on('data', (data) => {
            const line = data.toString();
            renderStdOut += line;
            if (line.includes('Rendered') && (line.includes('time remaining') || line.includes('Rendered 100%'))) {
              const trimmed = line.trim().split('\n').pop() || '';
              process.stdout.write(`\r     ⏳ [Stage 4 Render] ${trimmed.slice(0, 65)}`);
            }
          });

          renderProc.stderr.on('data', (data) => {
            renderStdErr += data.toString();
          });

          renderProc.on('close', (code) => {
            process.stdout.write('\n');
            if (code === 0) {
              videoRenderSuccess = true;
              resolve();
            } else {
              videoRenderSuccess = false;
              reject(new Error(`Remotion render exited with code ${code}: ${renderStdErr || renderStdOut}`));
            }
          });

          renderProc.on('error', (err) => {
            reject(err);
          });
        });
      } catch (renderErr: any) {
        console.error(`  ├─ ❌ [Stage 4 Render Error] Remotion render failed:`, renderErr.message.slice(0, 300));
        renderStdErr = renderErr.message;
      }

      const renderDurationMs = Date.now() - renderStart;
      const caseDuration = Date.now() - caseStart;

      let videoFileExists = false;
      let videoFileSizeBytes = 0;
      if (fs.existsSync(outputPath)) {
        videoFileExists = true;
        videoFileSizeBytes = fs.statSync(outputPath).size;
      }

      // Step 5: Construct Scene Summaries & Evaluate All Metrics
      const scriptText = Object.values(state.chapterScripts || {}).join(' ');
      const factCheckPassed = !state.needsHumanReview;
      const factCheckFlags = (state.factCheckLogs || []).filter((l) => !l.passed).map((l) => l.details);

      const sceneSummaries: VideoGenSceneSummary[] = (state.scenes || []).map((scene) => {
        let assetFileExists = false;
        let assetFileSizeBytes = 0;
        let license: string | undefined;
        let licenseWhitelisted = true;

        if (scene.contentType === 'IMAGE' && scene.selectedAsset) {
          license = scene.selectedAsset.license;
          licenseWhitelisted = isWhitelistedLicense(scene.selectedAsset.license);
          const assetPath = scene.selectedAsset.localPath || path.join(paths.assetsDir, `${scene.selectedAsset.candidateId}.jpg`);
          if (fs.existsSync(assetPath)) {
            assetFileExists = true;
            assetFileSizeBytes = fs.statSync(assetPath).size;
          }
        }

        const overallScore = scene.selectedAsset?.score?.overallScore;
        const historicalScore = scene.selectedAsset?.score?.historicalContextScore;
        const visualScore = scene.selectedAsset?.score?.artisticFitScore;

        return {
          sceneId: scene.sceneId,
          contentType: scene.contentType,
          layoutMode: scene.layoutMode || 'HISTORICAL_FRAME',
          durationSec: scene.targetDurationSeconds || 5,
          wordCount: scene.voiceoverText ? scene.voiceoverText.trim().split(/\s+/).filter(Boolean).length : 0,
          hasVisualAsset: !!scene.selectedAsset,
          assetFileExists,
          assetFileSizeBytes,
          license,
          licenseWhitelisted,
          vlmHistoricalScore: historicalScore,
          vlmVisualScore: visualScore,
          vlmCompositeScore: overallScore ? overallScore / 10 : undefined,
        };
      });

      const caseResult = evaluateVideoGenCase(
        tc,
        {
          projectId,
          scriptText,
          scenes: state.scenes,
          factCheckPassed,
          factCheckFlags,
          aliasTable: ragContext.aliasTable,
          executionDurationMs: caseDuration,
        },
        sceneSummaries
      );

      // Attach Stage 3 & Stage 4 properties
      caseResult.audioGeneratedScenes = audioGeneratedScenes;
      caseResult.audioGenerationSuccessRate = audioGenSuccessRate;
      caseResult.timestampsMonotonicRate = timestampsMonoRate;
      caseResult.wavHeaderValidRate = wavHeaderRate;
      caseResult.syntheticAudioFallbackCount = syntheticFallbackCount;
      caseResult.schemaValidated = schemaValidated;
      caseResult.videoRendered = videoFileExists && videoFileSizeBytes >= 50 * 1024;
      caseResult.videoFileSizeBytes = videoFileSizeBytes;
      caseResult.renderDurationMs = renderDurationMs;

      const totalVideoDurationSec = caseResult.actualDurationSec || tc.targetDurationMinutes * 60;
      caseResult.renderSpeedRatio = totalVideoDurationSec > 0
        ? Math.round((renderDurationMs / (totalVideoDurationSec * 1000)) * 100) / 100
        : 0;

      // Fail case if video render failed or schema invalid
      if (!caseResult.videoRendered) {
        caseResult.passed = false;
        caseResult.errors = caseResult.errors || [];
        caseResult.errors.push(`Stage 4 Video render failed: ${renderStdErr || 'File missing or < 50KB'}`);
      }

      if (!schemaValidated) {
        caseResult.passed = false;
        caseResult.errors = caseResult.errors || [];
        caseResult.errors.push(`Stage 4 Schema invalid: ${schemaErrors.join('; ')}`);
      }

      if (options.strict && syntheticFallbackCount > 0) {
        caseResult.passed = false;
        caseResult.errors = caseResult.errors || [];
        caseResult.errors.push(`[STRICT] ${syntheticFallbackCount} scenes fell back to synthetic audio`);
      }

      caseResults.push(caseResult);

      // Save per-topic raw execution artifact to outputs/
      const artifactPath = path.join(outputsDir, `${tc.id}.json`);
      saveJsonArtifact(artifactPath, {
        testCase: tc,
        result: caseResult,
        finalState: {
          projectId: state.projectId,
          status: state.status,
          chapters: state.chapters,
          chapterScripts: state.chapterScripts,
          scenes: state.scenes,
          researchResults: state.researchResults,
          factCheckLogs: state.factCheckLogs,
          audioAssets: state.audioAssets,
          videoPath: outputPath,
        },
        executedAt: new Date().toISOString(),
      });

      // Count VLM Scorer usage
      let localVlmCount = 0;
      let cloudVlmCount = 0;
      let fallbackClipCount = 0;
      for (const scene of state.scenes || []) {
        for (const cand of scene.candidates || []) {
          const sType = (cand.score as any)?.scorerType;
          if (sType === 'LOCAL_VLM' || sType === 'OPENAI_VLM') localVlmCount++;
          else if (sType === 'GEMINI_CLOUD') cloudVlmCount++;
          else if (sType === 'CLIP_LOCAL_FALLBACK') fallbackClipCount++;
        }
      }
      const totalVlmEvaluated = localVlmCount + cloudVlmCount + fallbackClipCount;
      const vlmModeInfo = totalVlmEvaluated > 0
        ? `VLM: ${localVlmCount + cloudVlmCount}/${totalVlmEvaluated} (${fallbackClipCount > 0 ? `⚠️ ${fallbackClipCount} CLIP fallback` : '100% Primary'})`
        : 'VLM: 0';

      const statusMark = caseResult.passed ? '✅ PASSED' : '❌ FAILED';
      const sizeMb = (videoFileSizeBytes / (1024 * 1024)).toFixed(2);
      console.log(
        `  └─ Status: ${statusMark} | S1 Pacing: ${caseResult.actualWpm} WPM | S2 Assets: ${caseResult.downloadedAssetsCount}/${caseResult.imageScenes} | S3 Audio: ${audioGeneratedScenes}/${totalScenesCount} | S4 Video: ${sizeMb} MB | Time: ${caseDuration}ms`
      );
      if (caseResult.errors && caseResult.errors.length > 0) {
        console.log(`     Errors: ${caseResult.errors.join('; ')}`);
      }
      if (caseResult.warnings && caseResult.warnings.length > 0) {
        console.log(`     Warnings: ${caseResult.warnings.join('; ')}`);
      }

      // Clean video file if requested
      if (options.clean && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    } catch (err: any) {
      const caseDuration = Date.now() - caseStart;
      console.error(`  └─ ❌ FAILED with exception in case ${tc.id}:`, err.message);
      caseResults.push({
        id: tc.id,
        title: tc.topic,
        topic: tc.topic,
        videoType: tc.videoType,
        targetDurationSec: tc.targetDurationMinutes * 60,
        actualDurationSec: 0,
        totalWordCount: 0,
        actualWpm: 0,
        pacingDeviationPct: 100,
        pacingPassed: false,
        factCheckPassed: false,
        factCheckFlags: [],
        entityRecallRate: 0,
        missingEntities: tc.expectedEntities || [],
        totalScenes: 0,
        imageScenes: 0,
        pureCodeScenes: 0,
        downloadedAssetsCount: 0,
        downloadSuccessRate: 0,
        licenseComplianceRate: 0,
        meanVlmQualityScore: 0,
        audioGeneratedScenes: 0,
        audioGenerationSuccessRate: 0,
        schemaValidated: false,
        videoRendered: false,
        videoFileSizeBytes: 0,
        durationMs: caseDuration,
        passed: false,
        scenes: [],
        errors: [`Unhandled pipeline failure: ${err.message}`],
      });
    }
  }

  // 4. Compute Aggregated Metrics
  const aggregated = computeVideoGenAggregatedMetrics(caseResults);
  const endTime = new Date();
  const durationMs = Date.now() - startTimeMs;
  const allPassed = Object.values(aggregated.metricScores).every((m) => m.pass);

  const suiteReport: BaseSuiteReport<VideoGenCaseResult> = {
    title: 'ChronoViet Video Generation End-to-End Master Evaluation Report (4-Stage Pipeline)',
    suite: 'VIDEO_GEN',
    timestamp: startTime.toISOString(),
    totalCases: testCases.length,
    datasetTotalCases,
    isSubset,
    appliedFilters: {
      limit: options.limit,
      type: options.type,
      strict: options.strict,
    },
    passedCases: aggregated.passedProjects,
    failedCases: testCases.length - aggregated.passedProjects,
    passRate: testCases.length > 0 ? aggregated.passedProjects / testCases.length : 0,
    allPassed,
    metrics: aggregated.metricScores,
    caseResults,
    metadata: {
      suite: 'VIDEO_GEN',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs,
      strict: options.strict ?? false,
      preflight,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
      localTime: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      platform: `${process.platform}-${process.arch}`,
      nodeVersion: process.version,
    },
    outputArtifactsDir: outputsDir,
  };

  // 5. Save Report Artifacts to reports/
  saveSuiteEvaluationReport({
    report: suiteReport,
    reportsDir,
    baseFileName: 'video-gen-eval-report',
    archiveHistory: true,
  });

  printCliSummaryTable(suiteReport);

  return suiteReport;
}

// Standalone CLI execution
if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('eval/video-gen/runner.ts'))) {
  const args = process.argv.slice(2);
  const limitArgIdx = args.indexOf('--limit');
  const limit = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : undefined;

  const typeArgIdx = args.indexOf('--type');
  const type = typeArgIdx !== -1 ? args[typeArgIdx + 1] : undefined;

  let stage: '1' | '2' | '3' | '4' | 'all' | 'script' | 'visual' | 'audio' | 'render' | undefined;
  const stageArgIdx = args.findIndex((a) => a.startsWith('--stage'));
  if (stageArgIdx !== -1) {
    const val = args[stageArgIdx].includes('=') ? args[stageArgIdx].split('=')[1] : args[stageArgIdx + 1];
    if (
      val === '1' ||
      val === '2' ||
      val === '3' ||
      val === '4' ||
      val === 'all' ||
      val === 'script' ||
      val === 'visual' ||
      val === 'audio' ||
      val === 'render'
    ) {
      stage = val;
    }
  }

  const concArgIdx = args.indexOf('--concurrency');
  const concurrency = concArgIdx !== -1 ? parseInt(args[concArgIdx + 1], 10) : undefined;

  const strict = args.includes('--strict');
  const clean = args.includes('--clean');
  const golden = args.includes('--golden');

  runVideoGenerationEvaluation({ limit, type, strict, clean, stage, golden, concurrency })
    .then((report) => {
      if (!report.allPassed && strict) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Video generation evaluation runner failed:', err);
      process.exit(1);
    });
}
