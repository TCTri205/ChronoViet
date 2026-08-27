/**
 * ChronoViet Stage 1: Script & Narrative Quality Evaluation Suite Runner
 * Evaluates RAG retrieval grounding, chapter structuring, scriptwriting narrative flow,
 * planned pacing WPM, historical entity recall, fact-checking safeguards, and scene segmentation bounds (5s–25s).
 * Runs in pure text mode (['postgres', 'embedding', 'llm']) in seconds per topic.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertEvalPreflight, initProjectWorkspace, getProjectPaths } from '@chronoviet/infra';
import { ChronoRagEngine } from '@chronoviet/rag-engine';
import {
  ChronoGraphState,
  chapteringNode,
  scriptwriterNode,
  factCheckerNode,
  segmenterNode,
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
  Stage1ScriptCaseResult,
  evaluateStage1ScriptCase,
  computeStage1ScriptAggregatedMetrics,
} from './metrics/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunStage1ScriptEvalOptions {
  limit?: number;
  type?: string;
  strict?: boolean;
  clean?: boolean;
}

export async function runStage1ScriptEvaluation(
  options: RunStage1ScriptEvalOptions = {}
): Promise<BaseSuiteReport<Stage1ScriptCaseResult>> {
  const startTime = new Date();
  const startTimeMs = Date.now();

  console.log('\n📝 [Stage 1] Starting ChronoViet Script & Narrative Evaluation Suite (Text-Only)...');

  // 1. Preflight Health Checks: strictly Postgres, Embedding, LLM (No Vision/Crawling required)
  const preflight = await assertEvalPreflight(['postgres', 'embedding', 'llm']);

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

  const stage1OutputsDir = path.resolve(__dirname, 'outputs/stage1');
  const reportsDir = path.resolve(__dirname, 'reports');
  ensureDirectory(stage1OutputsDir);
  ensureDirectory(reportsDir);

  const ragEngine = new ChronoRagEngine();
  const caseResults: Stage1ScriptCaseResult[] = [];
  const createdProjectIds: string[] = [];

  // 3. Execute Stage 1 Decoupled Node Chain for Each Test Case
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const projectId = `eval_s1_${tc.id}`;
    createdProjectIds.push(projectId);

    console.log(`\n[${i + 1}/${testCases.length}] Stage 1 Script: ${tc.id} — "${tc.topic}" (${tc.videoType}, ${tc.targetDurationMinutes}m)`);
    const caseStart = Date.now();

    try {
      // Step 1: Workspace init & RAG Search
      const existingWorkspace = getProjectPaths(projectId, stage1OutputsDir);
      if (fs.existsSync(existingWorkspace.rootDir)) {
        fs.rmSync(existingWorkspace.rootDir, { recursive: true, force: true });
      }
      initProjectWorkspace(projectId, stage1OutputsDir);

      const ragSearchResult = await ragEngine.search({
        query: tc.topic,
        maxTokens: 3500,
        rerankTopK: Math.max(6, Math.min(10, (tc.targetDurationMinutes || 2) * 2 + 2)),
      });

      const ragContext = {
        verifiedContext: ragSearchResult.verifiedContext,
        aliasTable: ragSearchResult.aliasTable,
        citations: ragSearchResult.citations.map((c: any) => (typeof c === 'string' ? c : c.sourceTitle)),
      };

      let state: ChronoGraphState = {
        projectId,
        customBaseDir: stage1OutputsDir,
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

      // Step 2: Micro-Step 0 (Chaptering)
      console.log(`  ├─ Micro-Step 0: Chaptering Agent...`);
      const chapteringUpdate = await chapteringNode(state);
      state = { ...state, ...chapteringUpdate };

      // Step 3: Micro-Step 1A (Scriptwriter)
      console.log(`  ├─ Micro-Step 1A: Scriptwriter Agent (${state.chapters.length} chapters)...`);
      const scriptwriterUpdate = await scriptwriterNode(state);
      state = { ...state, ...scriptwriterUpdate };

      // Step 4: Micro-Step 1A-Audit (Fact-Checker)
      console.log(`  ├─ Micro-Step 1A-Audit: Fact-Checker & Guardrails...`);
      const factCheckerUpdate = await factCheckerNode(state);
      state = { ...state, ...factCheckerUpdate };

      let factCheckPassed = !state.needsHumanReview;
      const factCheckFlags = (state.factCheckLogs || []).filter((l) => !l.passed).map((l) => l.details);

      // Step 5: Micro-Step 1B (Scene Segmentation) - If fact-check passed
      if (factCheckPassed) {
        console.log(`  ├─ Micro-Step 1B: Scene Segmenter & Layout Bounds...`);
        const segmenterUpdate = await segmenterNode(state);
        state = { ...state, ...segmenterUpdate };
      } else {
        console.log(`  ├─ ⚠️ Tier 3 Fact-Check Flag Triggered -> Routed to Human Review`);
      }

      const caseDuration = Date.now() - caseStart;
      const scriptText = Object.values(state.chapterScripts || {}).join(' ');

      // Evaluate Case
      const caseResult = evaluateStage1ScriptCase(
        tc,
        {
          projectId,
          scriptText,
          chaptersCount: state.chapters?.length || 0,
          chapters: state.chapters,
          scenes: state.scenes || [],
          factCheckPassed,
          factCheckFlags,
          aliasTable: ragContext.aliasTable,
          executionDurationMs: caseDuration,
        }
      );

      caseResults.push(caseResult);

      // Save Stage 1 Snapshot Artifact to outputs/stage1/<id>.json
      const artifactPath = path.join(stage1OutputsDir, `${tc.id}.json`);
      saveJsonArtifact(artifactPath, {
        testCase: tc,
        result: caseResult,
        stage1State: {
          projectId: state.projectId,
          status: state.status,
          userPrompt: state.userPrompt,
          videoType: state.videoType,
          targetDurationMinutes: state.targetDurationMinutes,
          ragContext: state.ragContext,
          chapters: state.chapters,
          chapterScripts: state.chapterScripts,
          factCheckLogs: state.factCheckLogs,
          scenes: state.scenes,
        },
        executedAt: new Date().toISOString(),
      });

      const statusMark = caseResult.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`  └─ Status: ${statusMark} | Entity Recall: ${(caseResult.entityRecallRate * 100).toFixed(0)}% | Planned WPM: ${caseResult.actualWpm} | Scenes: ${caseResult.totalScenes} | Time: ${caseDuration}ms`);
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
        matchedEntities: [],
        missingEntities: tc.expectedEntities || [],
        totalChapters: 0,
        chapterAlignmentRate: 0,
        matchedChapters: [],
        missingChapters: tc.expectedChapters || [],
        totalScenes: 0,
        sceneBoundsComplianceRate: 0,
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
    console.log('\n🧹 Cleaning up temporary eval media folders in outputs/stage1...');
    for (const projId of createdProjectIds) {
      try {
        const pPaths = getProjectPaths(projId, stage1OutputsDir);
        if (fs.existsSync(pPaths.rootDir)) {
          fs.rmSync(pPaths.rootDir, { recursive: true, force: true });
        }
      } catch (cleanErr: any) {
        console.warn(`Could not clean ${projId}: ${cleanErr.message}`);
      }
    }
  }

  // 5. Compute Aggregated Metrics
  const aggregated = computeStage1ScriptAggregatedMetrics(caseResults);
  const endTime = new Date();
  const durationMs = Date.now() - startTimeMs;
  const allPassed = Object.values(aggregated.metricScores).every((m) => m.pass);

  const suiteReport: BaseSuiteReport<Stage1ScriptCaseResult> = {
    title: 'Stage 1: Script & Narrative Quality Evaluation Benchmark',
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
    passedCases: aggregated.passedCases,
    failedCases: testCases.length - aggregated.passedCases,
    passRate: testCases.length > 0 ? aggregated.passedCases / testCases.length : 0,
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
    outputArtifactsDir: stage1OutputsDir,
  };

  // 6. Save Report Artifacts to reports/
  const reportJsonPath = path.join(reportsDir, 'stage1-script-report.json');
  const reportMdPath = path.join(reportsDir, 'stage1-script-report.md');
  suiteReport.reportFilePath = reportJsonPath;

  saveJsonArtifact(reportJsonPath, suiteReport);
  const mdContent = generateMarkdownReport(suiteReport);
  fs.writeFileSync(reportMdPath, mdContent, 'utf-8');

  printCliSummaryTable(suiteReport);

  if (suiteReport.failedCases > 0) {
    console.log(`\n⚠️  Notice: ${suiteReport.failedCases}/${suiteReport.totalCases} individual cases failed quality thresholds.`);
  }

  return suiteReport;
}

// Standalone CLI execution
if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('stage1-script-runner.ts'))) {
  const args = process.argv.slice(2);
  const limitArgIdx = args.indexOf('--limit');
  const limit = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : undefined;

  const typeArgIdx = args.indexOf('--type');
  const type = typeArgIdx !== -1 ? args[typeArgIdx + 1] : undefined;

  const strict = args.includes('--strict');
  const clean = args.includes('--clean');

  runStage1ScriptEvaluation({ limit, type, strict, clean })
    .then((report) => {
      if (!report.allPassed && strict) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Stage 1 Script evaluation runner failed:', err);
      process.exit(1);
    });
}
