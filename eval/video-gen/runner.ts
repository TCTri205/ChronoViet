/**
 * ChronoViet Video Generation Evaluation Suite Runner
 * Executes real pre-render video production pipeline (RAG -> Chaptering -> Scriptwriting ->
 * Fact-checking -> Scene Segmentation -> Keywords -> Image Research -> Real Disk Download -> VLM Inspection),
 * dumps raw execution artifacts to outputs/, and generates evaluation reports to reports/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertEvalPreflight, initProjectWorkspace, getProjectPaths } from '@chronoviet/infra';
import { ChronoRagEngine } from '@chronoviet/rag-engine';
import { isWhitelistedLicense } from '@chronoviet/vlm-inspector';
import {
  ChronoGraphState,
  runOrchestratorPipeline,
} from '@chronoviet/agent-orchestrator';
import {
  saveJsonArtifact,
  generateMarkdownReport,
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
} from './metrics/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunVideoGenEvalOptions {
  limit?: number;
  type?: string;
  strict?: boolean;
  clean?: boolean;
}

export async function runVideoGenerationEvaluation(
  options: RunVideoGenEvalOptions = {}
): Promise<BaseSuiteReport<VideoGenCaseResult>> {
  const startTime = new Date();
  const startTimeMs = Date.now();

  console.log('\n🎬 Starting ChronoViet Video Generation (Script & Visual Assets) Evaluation Suite...');

  // 1. Preflight Health Checks (postgres, embedding, llm, vlm)
  const preflight = await assertEvalPreflight(['postgres', 'embedding', 'llm', 'vlm', 'search']);

  // 2. Load Video Test Topics Dataset
  const datasetPath = path.resolve(__dirname, 'datasets/video-gen-test-cases.json');
  const rawData = fs.readFileSync(datasetPath, 'utf-8');
  let testCases: VideoGenTestCase[] = JSON.parse(rawData);

  if (options.type) {
    const typeUpper = options.type.toUpperCase();
    testCases = testCases.filter((tc) => tc.videoType.toUpperCase() === typeUpper);
    console.log(`Filtered by video type "${typeUpper}": ${testCases.length} topics remaining.`);
  }

  if (options.limit && options.limit > 0) {
    testCases = testCases.slice(0, options.limit);
    console.log(`Applied limit: running ${testCases.length} video generation topics.`);
  }

  const outputsDir = path.resolve(__dirname, 'outputs');
  const reportsDir = path.resolve(__dirname, 'reports');
  ensureDirectory(outputsDir);
  ensureDirectory(reportsDir);

  const ragEngine = new ChronoRagEngine();
  const caseResults: VideoGenCaseResult[] = [];
  const createdProjectIds: string[] = [];

  // 3. Execute Pre-Render Pipeline for Each Test Case
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    // Deterministic project workspace ID per test case
    const projectId = `eval_proj_${tc.id}`;
    createdProjectIds.push(projectId);

    console.log(`\n[${i + 1}/${testCases.length}] Generating Video Pipeline: ${tc.id} — "${tc.topic}" (${tc.videoType}, ${tc.targetDurationMinutes}m)`);
    const caseStart = Date.now();

    try {
      // Step 1: Auto-clean prior project workspace inside outputs/ for this test case on re-run, then initialize fresh
      const existingWorkspace = getProjectPaths(projectId, outputsDir);
      if (fs.existsSync(existingWorkspace.rootDir)) {
        fs.rmSync(existingWorkspace.rootDir, { recursive: true, force: true });
      }
      initProjectWorkspace(projectId, outputsDir);
      const ragSearchResult = await ragEngine.search({
        query: tc.topic,
        maxTokens: 2000,
        rerankTopK: 5,
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
      console.log(`  └─ Executing LangGraph Multi-Agent Orchestrator Pipeline...`);
      state = await runOrchestratorPipeline(state, { resumeFromCheckpoint: false });

      const caseDuration = Date.now() - caseStart;

      // Extract full narration script
      const scriptText = Object.values(state.chapterScripts || {}).join(' ');

      // Audit downloaded assets on disk inside outputs/
      const paths = getProjectPaths(projectId, outputsDir);
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
          layoutMode: scene.layoutMode || 'STAT_CARD',
          durationSec: scene.targetDurationSeconds || 5,
          wordCount: scene.voiceoverText ? scene.voiceoverText.trim().split(/\s+/).length : 0,
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

      const factCheckPassed = !state.needsHumanReview;
      const factCheckFlags = (state.factCheckLogs || []).filter((l) => !l.passed).map((l) => l.details);

      // Evaluate single test case
      const caseResult = evaluateVideoGenCase(
        tc,
        {
          projectId,
          scriptText,
          scenes: state.scenes,
          factCheckPassed,
          factCheckFlags,
          executionDurationMs: caseDuration,
        },
        sceneSummaries
      );

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
        },
        executedAt: new Date().toISOString(),
      });

      // Count VLM Scorer vs Fallback usage
      let localVlmCount = 0;
      let cloudVlmCount = 0;
      let fallbackClipCount = 0;
      for (const scene of state.scenes || []) {
        for (const cand of scene.candidates || []) {
          const sType = (cand.score as any)?.scorerType;
          if (sType === 'LOCAL_VLM' || sType === 'OPENAI_VLM') {
            localVlmCount++;
          } else if (sType === 'GEMINI_CLOUD') {
            cloudVlmCount++;
          } else if (sType === 'CLIP_LOCAL_FALLBACK') {
            fallbackClipCount++;
          }
        }
      }
      const totalEvaluated = localVlmCount + cloudVlmCount + fallbackClipCount;
      const vlmModeInfo = totalEvaluated > 0
        ? `VLM: ${localVlmCount + cloudVlmCount}/${totalEvaluated} (${fallbackClipCount > 0 ? `⚠️ ${fallbackClipCount} fallback to CLIP` : '✅ 100% Primary VLM, 0 fallback'})`
        : 'VLM: 0 images';

      const statusMark = caseResult.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`  └─ Status: ${statusMark} | Entity Recall: ${(caseResult.entityRecallRate * 100).toFixed(0)}% | Pacing WPM: ${caseResult.actualWpm} | Assets: ${caseResult.downloadedAssetsCount}/${caseResult.imageScenes} | ${vlmModeInfo} | Time: ${caseDuration}ms`);
      if (caseResult.errors && caseResult.errors.length > 0) {
        console.log(`     Errors: ${caseResult.errors.join('; ')}`);
      }
    } catch (err: any) {
      const caseDuration = Date.now() - caseStart;
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
        durationMs: caseDuration,
        passed: false,
        scenes: [],
        errors: [err.message || String(err)],
      });
      console.log(`  └─ ❌ FAILED with exception: ${err.message}`);
    }
  }

  // 4. Clean up temporary eval project directories if requested
  if (options.clean) {
    console.log('\n🧹 Cleaning up temporary eval media folders...');
    for (const projId of createdProjectIds) {
      try {
        const pPaths = getProjectPaths(projId, outputsDir);
        if (fs.existsSync(pPaths.rootDir)) {
          fs.rmSync(pPaths.rootDir, { recursive: true, force: true });
        }
      } catch (cleanErr: any) {
        console.warn(`Could not clean ${projId}: ${cleanErr.message}`);
      }
    }
  }

  // 5. Compute Aggregated Metrics
  const aggregated = computeVideoGenAggregatedMetrics(caseResults);
  const endTime = new Date();
  const durationMs = Date.now() - startTimeMs;
  const allPassed = Object.values(aggregated.metricScores).every((m) => m.pass);

  const suiteReport: BaseSuiteReport<VideoGenCaseResult> = {
    title: 'Video Generation Pre-Render Pipeline Benchmark',
    suite: 'VIDEO_GEN',
    timestamp: startTime.toISOString(),
    totalCases: testCases.length,
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
    },
    outputArtifactsDir: outputsDir,
  };

  // 6. Save Report Artifacts to reports/
  const reportJsonPath = path.join(reportsDir, 'video-gen-eval-report.json');
  const reportMdPath = path.join(reportsDir, 'video-gen-eval-report.md');
  suiteReport.reportFilePath = reportJsonPath;

  saveJsonArtifact(reportJsonPath, suiteReport);
  const mdContent = generateMarkdownReport(suiteReport);
  fs.writeFileSync(reportMdPath, mdContent, 'utf-8');

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

  const strict = args.includes('--strict');
  const clean = args.includes('--clean');

  runVideoGenerationEvaluation({ limit, type, strict, clean })
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
