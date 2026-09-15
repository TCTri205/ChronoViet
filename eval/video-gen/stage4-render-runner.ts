/**
 * ChronoViet Stage 4: Remotion Video Rendering & Composition Evaluation Suite Runner
 * Evaluates VideoProjectSchema Zod validation, Remotion headless rendering to MP4,
 * render latency / speed ratio, audio-video timeline sync, and karaoke caption frame boundaries.
 *
 * Supports chaining mode (from outputs/stage3/) and standalone golden mode (--golden).
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
  saveProjectSchema,
} from '@chronoviet/infra';
import { VideoProjectSchema } from '@chronoviet/shared-spec';
import {
  ChronoGraphState,
  packagerNode,
} from '@chronoviet/agent-orchestrator';
import {
  saveJsonArtifact,
  saveSuiteEvaluationReport,
  printCliSummaryTable,
  ensureDirectory,
  BaseSuiteReport,
} from '../shared/index.js';
import {
  Stage4RenderCaseResult,
  Stage4SceneRenderSummary,
  evaluateStage4RenderCase,
  computeStage4RenderAggregatedMetrics,
} from './metrics/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunStage4RenderEvalOptions {
  limit?: number;
  type?: string;
  strict?: boolean;
  clean?: boolean;
  golden?: boolean;
  sourceDir?: string;
  concurrency?: number;
}

interface Stage4InputCase {
  id: string;
  topic: string;
  epoch?: string;
  videoType: string;
  templateId: string;
  targetDurationMinutes: number;
  chapters?: any[];
  chapterScripts?: Record<number | string, string>;
  scenes: any[];
  audioAssets?: any[];
  ragContext?: any;
  source: 'GOLDEN_FIXTURE' | 'STAGE3_OUTPUT' | 'STAGE2_OUTPUT' | 'STAGE1_OUTPUT';
}

export function prepareSchemaForRemotionRender(schema: any): any {
  if (!schema || !schema.timeline) return schema;
  const cloned = JSON.parse(JSON.stringify(schema));
  for (const scene of cloned.timeline) {
    // 1. Audio resolution
    if (scene.sceneAudioUrl && typeof scene.sceneAudioUrl === 'string') {
      const audioUrl = scene.sceneAudioUrl.trim();
      if (
        !audioUrl.startsWith('http://') &&
        !audioUrl.startsWith('https://') &&
        !audioUrl.startsWith('data:') &&
        fs.existsSync(audioUrl)
      ) {
        try {
          const buf = fs.readFileSync(audioUrl);
          scene.sceneAudioUrl = `data:audio/wav;base64,${buf.toString('base64')}`;
        } catch {}
      }
    }
    // 2. Visual asset resolution
    if (scene.assetUrl && typeof scene.assetUrl === 'string') {
      const assetUrl = scene.assetUrl.trim();
      if (
        !assetUrl.startsWith('http://') &&
        !assetUrl.startsWith('https://') &&
        !assetUrl.startsWith('data:') &&
        fs.existsSync(assetUrl)
      ) {
        try {
          const ext = path.extname(assetUrl).slice(1).toLowerCase() || 'jpeg';
          const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const buf = fs.readFileSync(assetUrl);
          scene.assetUrl = `data:${mime};base64,${buf.toString('base64')}`;
        } catch {}
      }
    }
  }
  return cloned;
}

export async function runStage4RenderEvaluation(
  options: RunStage4RenderEvalOptions = {}
): Promise<BaseSuiteReport<Stage4RenderCaseResult>> {
  const startTime = new Date();
  const startTimeMs = Date.now();

  console.log('\n🎬 [Stage 4] Starting ChronoViet Remotion Video Rendering & Composition Evaluation Suite...');

  // 1. Preflight Health Checks
  const preflight = await assertEvalPreflight([]);

  const stage1OutputsDir = path.resolve(__dirname, 'outputs/stage1');
  const stage2OutputsDir = path.resolve(__dirname, 'outputs/stage2');
  const stage3OutputsDir = path.resolve(__dirname, 'outputs/stage3');
  const stage4OutputsDir = path.resolve(__dirname, 'outputs/stage4');
  const reportsDir = path.resolve(__dirname, 'reports');
  ensureDirectory(stage4OutputsDir);
  ensureDirectory(reportsDir);

  // 2. Locate Remotion Engine Package Root & Entry
  const monorepoRoot = findMonorepoRoot();
  const remotionPkgDir = path.resolve(monorepoRoot, 'packages/remotion-engine');
  const remotionEntry = path.join(remotionPkgDir, 'src/index.ts');

  if (!fs.existsSync(remotionEntry)) {
    throw new Error(`Remotion entry not found at: ${remotionEntry}`);
  }

  // 3. Select Input Data Source (Chaining Stage 3 -> Stage 2 -> Stage 1 -> Golden Fixtures)
  let inputCases: Stage4InputCase[] = [];
  const preferGolden = options.golden === true;
  let useGolden = preferGolden;

  if (!preferGolden) {
    const candidateDirs = [
      options.sourceDir,
      stage3OutputsDir,
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
              const targetState = data.stage3State || data.stage2State || data.stage1State || data.finalState;
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
                  audioAssets: targetState?.audioAssets || [],
                  ragContext: targetState?.ragContext,
                  source: searchDir === stage3OutputsDir ? 'STAGE3_OUTPUT' : 'STAGE2_OUTPUT',
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
      audioAssets: [],
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
    console.log(`Applied limit: running ${inputCases.length} video rendering cases.`);
  }

  const isSubset = inputCases.length < datasetTotalCases || options.golden === true;
  const caseResults: Stage4RenderCaseResult[] = [];
  const renderConcurrency = String(options.concurrency || 2);

  // 4. Execute Stage 4 Packaging & Remotion Render
  for (let i = 0; i < inputCases.length; i++) {
    const tc = inputCases[i];
    const projectId = `eval_s4_${tc.id}`;

    console.log(`\n[${i + 1}/${inputCases.length}] Stage 4 Render: ${tc.id} — "${tc.topic}" (${tc.videoType}, source=${tc.source})`);
    const caseStart = Date.now();

    try {
      // Step 1: Initialize Workspace
      const existingWorkspace = getProjectPaths(projectId, stage4OutputsDir);
      if (fs.existsSync(existingWorkspace.rootDir)) {
        fs.rmSync(existingWorkspace.rootDir, { recursive: true, force: true });
      }
      const paths = initProjectWorkspace(projectId, stage4OutputsDir);

      let state: ChronoGraphState = {
        projectId,
        customBaseDir: stage4OutputsDir,
        correlationId: undefined,
        userPrompt: tc.topic,
        videoBriefId: undefined,
        targetDurationMinutes: tc.targetDurationMinutes,
        videoType: tc.videoType as any,
        templateId: (tc.templateId as any) || 'HISTORICAL_DOCUMENTARY',
        status: 'ASSETS_AUDITED',
        currentStep: 7,
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
        audioAssets: tc.audioAssets || [],
        pacingErrorPercentage: 0,
        videoProps: undefined,
        errorLog: undefined,
        telemetryAudit: [],
        needsHumanReview: false,
      };

      // Step 2: Packager Node (JSON Schema Synthesis)
      console.log(`  ├─ Micro-Step 2: Packager Agent & VideoProjectSchema Synthesis...`);
      const packagerUpdate = await packagerNode(state);
      state = { ...state, ...packagerUpdate };

      // Step 3: Validate VideoProjectSchema with Zod
      const schemaPath = path.join(paths.rootDir, 'project_schema.json');
      let schemaValidated = false;
      const schemaErrors: string[] = [];
      let projectSchema: any;

      try {
        projectSchema = loadProjectSchema(projectId, stage4OutputsDir);
        const parsed = VideoProjectSchema.safeParse(projectSchema);
        if (parsed.success) {
          schemaValidated = true;
        } else {
          schemaValidated = false;
          schemaErrors.push(...parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`));
        }
      } catch (loadErr: any) {
        schemaValidated = false;
        schemaErrors.push(`Failed to load project schema: ${loadErr.message}`);
      }

      // Prepare render props with data URIs for local audio & image files so Remotion headless browser can access them directly
      const renderSchema = prepareSchemaForRemotionRender(projectSchema);
      const renderPropsPath = path.join(paths.rootDir, 'render_props.json');
      fs.writeFileSync(renderPropsPath, JSON.stringify(renderSchema, null, 2), 'utf-8');

      // Step 4: Execute Remotion Headless Render via CLI
      const outputPath = path.join(paths.outputDir, 'video.mp4');
      const compId = 'ChronoVideo';
      let renderStdErr = '';
      let renderStdOut = '';
      let videoRenderSuccess = false;
      const renderStart = Date.now();

      console.log(`  ├─ Remotion Headless Render (Comp: ${compId}, Concurrency: ${renderConcurrency})...`);

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
              process.stdout.write(`\r     ⏳ ${trimmed.slice(0, 70)}`);
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
        console.error(`  └─ ❌ Render Process Error:`, renderErr.message.slice(0, 300));
        renderStdErr = renderErr.message;
      }

      const renderDurationMs = Date.now() - renderStart;
      const caseDuration = Date.now() - caseStart;

      // Step 5: Audit Output Video on Disk & Timeline Synchronization
      let videoFileExists = false;
      let videoFileSizeBytes = 0;

      if (fs.existsSync(outputPath)) {
        videoFileExists = true;
        videoFileSizeBytes = fs.statSync(outputPath).size;
      }

      const fps = projectSchema?.fps || 30;
      const timeline = projectSchema?.timeline || [];
      const totalFrames = timeline.reduce((acc: number, sc: any) => acc + (sc.durationInFrames || 90), 0);

      const sceneSummaries: Stage4SceneRenderSummary[] = timeline.map((sc: any) => {
        const durationInFrames = sc.durationInFrames || 90;
        const targetDurationSeconds = durationInFrames / fps;
        const matchingStateScene = (state.scenes || []).find((s) => s.sceneId === sc.id);
        const audioDurationSeconds = matchingStateScene?.audioDurationSeconds || 0;
        const requiredAudioFrames = Math.ceil((audioDurationSeconds + 0.2) * fps);
        const audioFitsInFrames = audioDurationSeconds === 0 || durationInFrames >= requiredAudioFrames;

        const sceneCaptions = sc.captions || [];
        const captionsWithinSceneBounds = sceneCaptions.every(
          (c: any) => c.endFrame <= durationInFrames + 1
        );

        return {
          sceneId: sc.id,
          durationInFrames,
          layoutMode: sc.layoutMode || 'HISTORICAL_FRAME',
          hasAudio: !!sc.sceneAudioUrl || audioDurationSeconds > 0,
          audioDurationSeconds,
          audioFitsInFrames,
          hasVisualAsset: !!sc.assetUrl,
          captionsCount: sceneCaptions.length,
          captionsWithinSceneBounds,
        };
      });

      // Evaluate Case Result
      const caseResult = evaluateStage4RenderCase(
        {
          id: tc.id,
          topic: tc.topic,
          videoType: tc.videoType,
          templateId: projectSchema?.templateId || tc.templateId,
          aspectRatio: projectSchema?.aspectRatio || '16:9',
          fps,
          totalFrames,
          schemaValidated,
          schemaErrors,
          videoPath: outputPath,
          videoFileExists,
          videoFileSizeBytes,
          renderDurationMs,
          renderStdErr: videoRenderSuccess ? undefined : renderStdErr,
          executionDurationMs: caseDuration,
        },
        sceneSummaries
      );

      caseResults.push(caseResult);

      // Save Stage 4 Snapshot Artifact to outputs/stage4/<id>.json
      const artifactPath = path.join(stage4OutputsDir, `${tc.id}.json`);
      saveJsonArtifact(artifactPath, {
        testCase: tc,
        result: caseResult,
        stage4State: {
          projectId: state.projectId,
          status: state.status,
          totalFrames,
          videoPath: outputPath,
          fileSizeBytes: videoFileSizeBytes,
          renderDurationMs,
        },
        executedAt: new Date().toISOString(),
      });

      const statusMark = caseResult.passed ? '✅ PASSED' : '❌ FAILED';
      const sizeMb = (videoFileSizeBytes / (1024 * 1024)).toFixed(2);
      console.log(
        `  └─ Status: ${statusMark} | Video: ${sizeMb} MB (${totalFrames} frames @ ${fps}fps) | Render Speed: ${caseResult.renderSpeedRatio}x | Time: ${caseDuration}ms`
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
      console.error(`  └─ ❌ ERROR in Stage 4 Render Case ${tc.id}:`, err.message);
      caseResults.push({
        id: tc.id,
        title: tc.topic,
        topic: tc.topic,
        videoType: tc.videoType,
        templateId: 'HISTORICAL_DOCUMENTARY',
        aspectRatio: '16:9',
        fps: 30,
        totalFrames: 0,
        totalVideoDurationSec: 0,
        schemaValidated: false,
        videoRendered: false,
        videoFileExists: false,
        videoFileSizeBytes: 0,
        renderDurationMs: 0,
        renderSpeedRatio: 0,
        audioVideoSyncCompliantRate: 0,
        captionBoundsCompliantRate: 0,
        durationMs: caseDuration,
        passed: false,
        scenes: [],
        errors: [`Execution failed: ${err.message}`],
      });
    }
  }

  const totalDurationMs = Date.now() - startTimeMs;
  const aggregatedMetrics = computeStage4RenderAggregatedMetrics(caseResults);
  const allPassed = caseResults.length > 0 && caseResults.every((r) => r.passed);

  const suiteReport: BaseSuiteReport<Stage4RenderCaseResult> = {
    title: 'ChronoViet Stage 4: Remotion Video Rendering & Composition Evaluation Report',
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
    outputArtifactsDir: stage4OutputsDir,
  };

  saveSuiteEvaluationReport({
    report: suiteReport,
    reportsDir,
    baseFileName: 'stage4-render-report',
    archiveHistory: true,
  });

  printCliSummaryTable(suiteReport);

  if (suiteReport.failedCases > 0) {
    console.log(`\n⚠️ Notice: ${suiteReport.failedCases}/${suiteReport.totalCases} individual cases failed quality thresholds.`);
  }

  return suiteReport;
}

if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('stage4-render-runner.ts'))) {
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

  let concurrency: number | undefined;
  const concArg = args.find((a) => a === '--concurrency' || a.startsWith('--concurrency='));
  if (concArg) {
    if (concArg.includes('=')) {
      concurrency = parseInt(concArg.split('=')[1], 10);
    } else {
      const idx = args.indexOf(concArg);
      concurrency = parseInt(args[idx + 1], 10);
    }
  }

  const strict = args.includes('--strict');
  const clean = args.includes('--clean');
  const golden = args.includes('--golden');

  runStage4RenderEvaluation({ limit, type, strict, clean, golden, concurrency })
    .then((report) => {
      if (!report.allPassed && strict) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Stage 4 Render evaluation runner failed:', err);
      process.exit(1);
    });
}
