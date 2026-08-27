/**
 * ChronoViet Stage 2: Visual Research & Curation Evaluation Suite Runner
 * Evaluates trilingual query planning, multi-provider candidate search (Wikimedia, Gallica, SerpAPI, Curated Catalog),
 * disk asset download fidelity, 100% license whitelist auditing, and VLM visual quality scoring.
 * Supports chaining mode (from outputs/stage1/) and standalone golden mode (--golden).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertEvalPreflight, initProjectWorkspace, getProjectPaths } from '@chronoviet/infra';
import { isWhitelistedLicense } from '@chronoviet/vlm-inspector';
import {
  ChronoGraphState,
  keywordNode,
  researchNode,
  vlmInspectionNode,
} from '@chronoviet/agent-orchestrator';
import {
  saveJsonArtifact,
  generateMarkdownReport,
  printCliSummaryTable,
  ensureDirectory,
  BaseSuiteReport,
} from '../shared/index.js';
import {
  Stage2VisualCaseResult,
  Stage2SceneSummary,
  VlmScorerBreakdown,
  evaluateStage2VisualCase,
  computeStage2VisualAggregatedMetrics,
} from './metrics/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunStage2VisualEvalOptions {
  limit?: number;
  type?: string;
  strict?: boolean;
  clean?: boolean;
  golden?: boolean;
  stage1Dir?: string;
}

interface Stage2InputCase {
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
  source: 'GOLDEN_FIXTURE' | 'STAGE1_OUTPUT';
}

export async function runStage2VisualEvaluation(
  options: RunStage2VisualEvalOptions = {}
): Promise<BaseSuiteReport<Stage2VisualCaseResult>> {
  const startTime = new Date();
  const startTimeMs = Date.now();

  console.log('\n🎨 [Stage 2] Starting ChronoViet Visual Research & Curation Evaluation Suite...');

  // 1. Preflight Health Checks (LLM, VLM, Search — Search is non-blocking with offline fallback)
  const preflight = await assertEvalPreflight(['llm', 'vlm', 'search']);

  const stage1OutputsDir = options.stage1Dir || path.resolve(__dirname, 'outputs/stage1');
  const stage2OutputsDir = path.resolve(__dirname, 'outputs/stage2');
  const reportsDir = path.resolve(__dirname, 'reports');
  ensureDirectory(stage2OutputsDir);
  ensureDirectory(reportsDir);

  // 2. Select Input Data Source (Chaining vs Golden Fixtures)
  let inputCases: Stage2InputCase[] = [];

  const preferGolden = options.golden === true;
  let useGolden = preferGolden;

  if (!preferGolden) {
    if (fs.existsSync(stage1OutputsDir)) {
      const jsonFiles = fs.readdirSync(stage1OutputsDir).filter((f) => f.endsWith('.json')).sort();
      if (jsonFiles.length > 0) {
        console.log(`📦 Loaded ${jsonFiles.length} Stage 1 output artifacts from ${stage1OutputsDir}`);
        for (const file of jsonFiles) {
          try {
            const raw = fs.readFileSync(path.join(stage1OutputsDir, file), 'utf-8');
            const data = JSON.parse(raw);
            if (data.stage1State && data.stage1State.scenes && data.stage1State.scenes.length > 0) {
              inputCases.push({
                id: data.testCase?.id || path.basename(file, '.json'),
                topic: data.testCase?.topic || data.stage1State?.userPrompt,
                epoch: data.testCase?.epoch,
                videoType: data.stage1State?.videoType || data.testCase?.videoType || 'DYNASTY',
                templateId: data.stage1State?.templateId || 'HISTORICAL_DOCUMENTARY',
                targetDurationMinutes: data.stage1State?.targetDurationMinutes || data.testCase?.targetDurationMinutes || 2,
                chapters: data.stage1State?.chapters || [],
                chapterScripts: data.stage1State?.chapterScripts || {},
                scenes: data.stage1State?.scenes || [],
                ragContext: data.stage1State?.ragContext,
                source: 'STAGE1_OUTPUT',
              });
            }
          } catch (e: any) {
            console.warn(`Could not parse ${file}: ${e.message}`);
          }
        }
      }
    }

    if (inputCases.length === 0) {
      console.log(`ℹ️ No Stage 1 outputs found in ${stage1OutputsDir}. Auto-falling back to Golden Script Fixtures.`);
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
    console.log(`Applied limit: running ${inputCases.length} visual curation cases.`);
  }

  const isSubset = inputCases.length < datasetTotalCases || options.golden === true;

  const caseResults: Stage2VisualCaseResult[] = [];
  const createdProjectIds: string[] = [];

  // 3. Execute Stage 2 Visual Research & Curation Pipeline
  for (let i = 0; i < inputCases.length; i++) {
    const tc = inputCases[i];
    const projectId = `eval_s2_${tc.id}`;
    createdProjectIds.push(projectId);

    console.log(`\n[${i + 1}/${inputCases.length}] Stage 2 Visual: ${tc.id} — "${tc.topic}" (${tc.videoType}, source=${tc.source})`);
    const caseStart = Date.now();

    try {
      // Step 1: Init project workspace inside outputs/stage2
      const existingWorkspace = getProjectPaths(projectId, stage2OutputsDir);
      if (fs.existsSync(existingWorkspace.rootDir)) {
        fs.rmSync(existingWorkspace.rootDir, { recursive: true, force: true });
      }
      initProjectWorkspace(projectId, stage2OutputsDir);

      let state: ChronoGraphState = {
        projectId,
        customBaseDir: stage2OutputsDir,
        correlationId: undefined,
        userPrompt: tc.topic,
        videoBriefId: undefined,
        targetDurationMinutes: tc.targetDurationMinutes,
        videoType: tc.videoType as any,
        templateId: (tc.templateId as any) || 'HISTORICAL_DOCUMENTARY',
        status: 'SCENES_SEGMENTED',
        currentStep: 5,
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

      // Step 2: Micro-Step 1C (Keyword & Query Planning)
      console.log(`  ├─ Micro-Step 1C: Visual Query Planning & Trilingual Keyword Extraction...`);
      const keywordUpdate = await keywordNode(state);
      state = { ...state, ...keywordUpdate };

      // Step 3: Micro-Step 1C (Research Agent Image Search)
      console.log(`  ├─ Micro-Step 1C: Multi-Provider Image Research (Wikimedia, Gallica, SerpAPI, Catalog)...`);
      const researchUpdate = await researchNode(state);
      state = { ...state, ...researchUpdate };

      // Step 4: Parallel Worker B (Asset Crawl & VLM Inspection: 3+3 Candidates Evaluation)
      console.log(`  ├─ Parallel Worker B: Asset Download & VLM Inspection (3+3 Pool)...`);
      const vlmUpdate = await vlmInspectionNode(state);
      state = { ...state, ...vlmUpdate };

      const caseDuration = Date.now() - caseStart;

      // Step 5: Audit Downloaded Assets on Disk and VLM Scores
      const paths = getProjectPaths(projectId, stage2OutputsDir);

      let localVlmCount = 0;
      let cloudVlmCount = 0;
      let clipFallbackCount = 0;

      const sceneSummaries: Stage2SceneSummary[] = (state.scenes || []).map((scene) => {
        let assetFileExists = false;
        let assetFileSizeBytes = 0;
        let license: string | undefined;
        let licenseWhitelisted = true;

        if (scene.contentType === 'IMAGE' && scene.selectedAsset) {
          license = scene.selectedAsset.license;
          licenseWhitelisted = isWhitelistedLicense(scene.selectedAsset.license);
          const assetPath =
            scene.selectedAsset.localPath ||
            path.join(paths.assetsDir, `${scene.selectedAsset.candidateId}.jpg`);

          if (fs.existsSync(assetPath)) {
            assetFileExists = true;
            assetFileSizeBytes = fs.statSync(assetPath).size;
          }
        }

        const overallScore = scene.selectedAsset?.score?.overallScore;
        const historicalScore = scene.selectedAsset?.score?.historicalContextScore;
        const visualScore = scene.selectedAsset?.score?.artisticFitScore;
        const scorerType = (scene.selectedAsset?.score as any)?.scorerType;

        if (scene.candidates) {
          for (const cand of scene.candidates) {
            const sType = (cand.score as any)?.scorerType;
            if (sType === 'LOCAL_VLM' || sType === 'OPENAI_VLM') {
              localVlmCount++;
            } else if (sType === 'GEMINI_CLOUD') {
              cloudVlmCount++;
            } else if (sType === 'CLIP_LOCAL_FALLBACK') {
              clipFallbackCount++;
            }
          }
        }

        return {
          sceneId: scene.sceneId,
          contentType: scene.contentType,
          layoutMode: scene.layoutMode || 'STAT_CARD',
          visualType: scene.searchParams?.visualType,
          primaryQuery: scene.searchParams?.primaryQuery,
          hasEnglishQuery: !!scene.searchParams?.englishQuery && scene.searchParams.englishQuery.trim().length > 0,
          hasFrenchQuery: !!scene.searchParams?.frenchQuery && scene.searchParams.frenchQuery.trim().length > 0,
          candidatesCount: scene.candidates?.length || state.researchResults?.[scene.sceneId]?.candidates?.length || 0,
          selectedAssetExists: !!scene.selectedAsset,
          assetFileExists,
          assetFileSizeBytes,
          license,
          licenseWhitelisted,
          vlmHistoricalScore: historicalScore,
          vlmVisualScore: visualScore,
          vlmCompositeScore: overallScore ? overallScore / 10 : undefined,
          vlmScorerType: scorerType,
          isPureCodeFallback: scene.contentType === 'PURE_CODE' || scene.usePureCodeFallback === true,
        };
      });

      const scorerBreakdown: VlmScorerBreakdown = {
        primaryVlmCount: localVlmCount,
        cloudVlmCount: cloudVlmCount,
        clipFallbackCount,
        totalEvaluatedCandidates: localVlmCount + cloudVlmCount + clipFallbackCount,
      };

      // Evaluate Single Test Case
      const caseResult = evaluateStage2VisualCase(
        {
          id: tc.id,
          topic: tc.topic,
          videoType: tc.videoType,
          searchKeywordsCheck: (tc as any).searchKeywordsCheck,
          executionDurationMs: caseDuration,
        },
        sceneSummaries,
        scorerBreakdown
      );

      caseResults.push(caseResult);

      // Save Stage 2 Snapshot Artifact to outputs/stage2/<id>.json
      const artifactPath = path.join(stage2OutputsDir, `${tc.id}.json`);
      saveJsonArtifact(artifactPath, {
        testCase: tc,
        result: caseResult,
        stage2State: {
          projectId: state.projectId,
          status: state.status,
          userPrompt: state.userPrompt,
          videoType: state.videoType,
          scenes: state.scenes,
          researchResults: state.researchResults,
        },
        executedAt: new Date().toISOString(),
      });

      const statusMark = caseResult.passed ? '✅ PASSED' : '❌ FAILED';
      const vlmModeInfo = scorerBreakdown.totalEvaluatedCandidates > 0
        ? `VLM: ${localVlmCount + cloudVlmCount}/${scorerBreakdown.totalEvaluatedCandidates} (${clipFallbackCount > 0 ? `⚠️ ${clipFallbackCount} CLIP fallbacks` : '✅ 100% Primary VLM'})`
        : 'VLM: 0 images';

      console.log(`  └─ Status: ${statusMark} | Assets Downloaded: ${caseResult.downloadedAssetsCount}/${caseResult.imageScenes} | Trilingual: ${(caseResult.trilingualQueryCoverageRate * 100).toFixed(0)}% | Mean Score: ${caseResult.meanVlmQualityScore}/10 | ${vlmModeInfo} | Time: ${caseDuration}ms`);
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
        totalScenes: 0,
        imageScenes: 0,
        pureCodeScenes: 0,
        pureCodeFallbackScenes: 0,
        trilingualQueryCoverageRate: 0,
        meanCandidateYield: 0,
        downloadedAssetsCount: 0,
        downloadSuccessRate: 0,
        licenseComplianceRate: 0,
        meanVlmQualityScore: 0,
        vlmScorerBreakdown: {
          primaryVlmCount: 0,
          cloudVlmCount: 0,
          clipFallbackCount: 0,
          totalEvaluatedCandidates: 0,
        },
        durationMs: caseDuration,
        passed: false,
        scenes: [],
        errors: [err.message || String(err)],
      });
      console.log(`  └─ ❌ FAILED with exception: ${err.message}`);
    }
  }

  // 4. Clean up workspaces if requested
  if (options.clean) {
    console.log('\n🧹 Cleaning up temporary eval media folders in outputs/stage2...');
    for (const projId of createdProjectIds) {
      try {
        const pPaths = getProjectPaths(projId, stage2OutputsDir);
        if (fs.existsSync(pPaths.rootDir)) {
          fs.rmSync(pPaths.rootDir, { recursive: true, force: true });
        }
      } catch (cleanErr: any) {
        console.warn(`Could not clean ${projId}: ${cleanErr.message}`);
      }
    }
  }

  // 5. Compute Aggregated Metrics
  const aggregated = computeStage2VisualAggregatedMetrics(caseResults);
  const endTime = new Date();
  const durationMs = Date.now() - startTimeMs;
  const allPassed = Object.values(aggregated.metricScores).every((m) => m.pass);

  const suiteReport: BaseSuiteReport<Stage2VisualCaseResult> = {
    title: 'Stage 2: Visual Research & Curation Evaluation Benchmark',
    suite: 'VIDEO_GEN',
    timestamp: startTime.toISOString(),
    totalCases: inputCases.length,
    datasetTotalCases,
    isSubset,
    appliedFilters: {
      limit: options.limit,
      type: options.type,
      golden: options.golden,
      strict: options.strict,
    },
    passedCases: aggregated.passedCases,
    failedCases: inputCases.length - aggregated.passedCases,
    passRate: inputCases.length > 0 ? aggregated.passedCases / inputCases.length : 0,
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
    outputArtifactsDir: stage2OutputsDir,
  };

  // 6. Save Report Artifacts to reports/
  const reportJsonPath = path.join(reportsDir, 'stage2-visual-report.json');
  const reportMdPath = path.join(reportsDir, 'stage2-visual-report.md');
  suiteReport.reportFilePath = reportJsonPath;

  saveJsonArtifact(reportJsonPath, suiteReport);
  const mdContent = generateMarkdownReport(suiteReport);
  fs.writeFileSync(reportMdPath, mdContent, 'utf-8');

  printCliSummaryTable(suiteReport);

  return suiteReport;
}

// Standalone CLI execution
if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('stage2-visual-runner.ts'))) {
  const args = process.argv.slice(2);
  const limitArgIdx = args.indexOf('--limit');
  const limit = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : undefined;

  const typeArgIdx = args.indexOf('--type');
  const type = typeArgIdx !== -1 ? args[typeArgIdx + 1] : undefined;

  const strict = args.includes('--strict');
  const clean = args.includes('--clean');
  const golden = args.includes('--golden');

  runStage2VisualEvaluation({ limit, type, strict, clean, golden })
    .then((report) => {
      if (!report.allPassed && strict) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Stage 2 Visual evaluation runner failed:', err);
      process.exit(1);
    });
}
