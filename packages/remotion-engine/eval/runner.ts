import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ChronoVideoSchema, ChronoVideoProps, TimelineScene, LayoutModeSchema, TransitionTypeSchema } from '../src/types';
import { envConfig } from '@chronoviet/shared-spec';
import { cleanEvalArtifacts, isPortInUseSync, killPortProcessSync } from '../../../eval/utils/cleaner';

const TOTAL_LAYOUT_MODES = LayoutModeSchema.options.length;
const TOTAL_TRANSITIONS = TransitionTypeSchema.options.filter((t) => t !== 'NONE').length;

interface EvalReport {
  timestamp: string;
  testCaseName: string;
  isValidSchema: boolean;
  totalScenes: number;
  layoutModesCovered: string[];
  transitionsCovered: string[];
  calculatedTotalFrames: number;
  durationSeconds: number;
  fps: number;
  aspectRatio: string;
  evalDurationMs: number;
  renderedStillPath?: string;
  renderedStillSizeBytes?: number;
  renderTimeMs?: number;
  schemaErrors?: string[];
}

function parseEvalArgs(args: string[]) {
  let testCasesDir = path.join(__dirname, 'test-cases');
  let reportsDir = path.join(__dirname, 'reports');
  let outDir = path.join(__dirname, 'out');
  let openStudio = true;
  let verbose = false;
  let forceNew = false;
  let port = String(envConfig.REMOTION_PORT);
  let cleanOnly = false;
  let fresh = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '-t' || arg === '--testCasesDir') && i + 1 < args.length) {
      testCasesDir = path.resolve(process.cwd(), args[++i]);
    } else if ((arg === '-o' || arg === '--outDir') && i + 1 < args.length) {
      outDir = path.resolve(process.cwd(), args[++i]);
    } else if ((arg === '-r' || arg === '--reportsDir') && i + 1 < args.length) {
      reportsDir = path.resolve(process.cwd(), args[++i]);
    } else if (arg === '--no-studio' || arg === '--ci') {
      openStudio = false;
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (arg === '-f' || arg === '--force-new') {
      forceNew = true;
    } else if ((arg === '-p' || arg === '--port') && i + 1 < args.length) {
      port = args[++i];
    } else if (arg === '--clean') {
      cleanOnly = true;
    } else if (arg === '--fresh') {
      fresh = true;
    }
  }

  return { testCasesDir, reportsDir, outDir, openStudio, verbose, forceNew, port, cleanOnly, fresh };
}

function formatRow(file: string, status: string, scenes: number, duration: string, aspect: string, layouts: number, transitions: number, timeMs: number) {
  const colFile = file.padEnd(22, ' ');
  const colStatus = status.padEnd(6, ' ');
  const colScenes = String(scenes).padStart(6, ' ');
  const colDuration = duration.padStart(15, ' ');
  const colAspect = aspect.padStart(7, ' ');
  const colLayouts = `${layouts} modes`.padStart(10, ' ');
  const colTrans = `${transitions} types`.padStart(10, ' ');
  const colTime = `${timeMs}ms`.padStart(7, ' ');

  return `│ ${colFile} │ ${colStatus} │ ${colScenes} │ ${colDuration} │ ${colAspect} │ ${colLayouts} │ ${colTrans} │ ${colTime} │`;
}

function findAvailablePortSync(startPort: number): number {
  let port = startPort;
  while (port < startPort + 50) {
    if (!isPortInUseSync(port)) {
      return port;
    }
    port++;
  }
  return startPort;
}

function runEvaluation() {
  const { testCasesDir, reportsDir, outDir, openStudio, verbose, forceNew, port: requestedPortStr, cleanOnly, fresh } = parseEvalArgs(process.argv.slice(2));

  const portNum = parseInt(requestedPortStr, 10) || envConfig.REMOTION_PORT;

  if (cleanOnly) {
    cleanEvalArtifacts({ verbose: true, port: portNum });
    process.exit(0);
  }

  if (fresh) {
    cleanEvalArtifacts({ verbose, port: portNum });
  }

  const startTime = Date.now();
  console.log('\n┌──────────────────────────────────────────────────────────────────────────┐');
  console.log('│   🚀 ChronoViet Remotion Render Engine - Real Evaluation Suite (v3.2)     │');
  console.log('└──────────────────────────────────────────────────────────────────────────┘\n');

  console.log(` 📁 Test Cases Folder : ${testCasesDir}`);
  console.log(` 📁 Output Folder     : ${outDir}`);
  console.log(` 📁 Reports Folder    : ${reportsDir}\n`);

  if (!fs.existsSync(testCasesDir)) {
    console.error(`❌ Error: Test cases directory not found: ${testCasesDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const testFiles = fs.readdirSync(testCasesDir).filter((file) => file.endsWith('.json'));

  if (testFiles.length === 0) {
    console.error(`❌ No JSON test cases found in directory: ${testCasesDir}`);
    process.exit(1);
  }

  let overallPassed = true;
  const reports: EvalReport[] = [];
  const globalLayoutModes = new Set<string>();
  const globalTransitions = new Set<string>();

  console.log('────────────────────────────────────────────────────────────────────────────');
  console.log(' 📌 PHASE 1: PROGRAMMATIC AUTOMATED METRICS EVALUATION');
  console.log('────────────────────────────────────────────────────────────────────────────\n');

  console.log('┌────────────────────────┬────────┬────────┬─────────────────┬─────────┬────────────┬────────────┬─────────┐');
  console.log('│ Test Case File         │ Status │ Scenes │ Duration (Frames)│ Aspect  │ Layouts    │ Transitions│ Time    │');
  console.log('├────────────────────────┼────────┼────────┼─────────────────┼─────────┼────────────┼────────────┼─────────┤');

  testFiles.forEach((file) => {
    const fileStartTime = Date.now();
    const filePath = path.join(testCasesDir, file);

    const rawData = fs.readFileSync(filePath, 'utf-8');
    let jsonContent: unknown;

    try {
      jsonContent = JSON.parse(rawData);
    } catch (e) {
      console.log(formatRow(file, 'FAIL', 0, 'N/A', 'N/A', 0, 0, Date.now() - fileStartTime));
      console.error(`   └─ ❌ Failed to parse JSON in ${file}:`, e);
      overallPassed = false;
      return;
    }

    const parseResult = ChronoVideoSchema.safeParse(jsonContent);

    if (!parseResult.success) {
      console.log(formatRow(file, 'FAIL', 0, 'N/A', 'N/A', 0, 0, Date.now() - fileStartTime));
      console.error(`   └─ ❌ Schema Validation Failed for ${file}:`);
      parseResult.error.issues.forEach((err: any) => {
        console.error(`      • Path [${err.path.join('.')}]: ${err.message}`);
      });
      overallPassed = false;
      return;
    }

    const props = parseResult.data as ChronoVideoProps;
    const fps = props.fps || 30;
    const defaultTransition = props.defaultTransition || 'FADE_TO_BLACK';
    const enableTransitions = props.enableTransitions ?? true;
    const aspectRatio = props.aspectRatio || '16:9';

    const layoutModes = new Set<string>();
    const transitions = new Set<string>();

    let totalFrames = 0;
    props.timeline.forEach((scene: TimelineScene, index: number) => {
      const duration = scene.durationInFrames || Math.round(5 * fps);
      totalFrames += duration;

      if (scene.layoutMode) {
        layoutModes.add(scene.layoutMode);
        globalLayoutModes.add(scene.layoutMode);
      }

      const transition = scene.transition || defaultTransition;
      if (transition) {
        transitions.add(transition);
        globalTransitions.add(transition);
      }

      const hasTransition =
        enableTransitions &&
        transition !== 'NONE' &&
        index < props.timeline.length - 1;

      if (hasTransition) {
        const transitionDuration = scene.transitionDurationFrames || 15;
        totalFrames -= transitionDuration;
      }
    });

    const fileDurationMs = Date.now() - fileStartTime;
    const durationSec = Math.round((totalFrames / fps) * 100) / 100;

    const report: EvalReport = {
      timestamp: new Date().toISOString(),
      testCaseName: file,
      isValidSchema: true,
      totalScenes: props.timeline.length,
      layoutModesCovered: Array.from(layoutModes),
      transitionsCovered: Array.from(transitions),
      calculatedTotalFrames: totalFrames,
      durationSeconds: durationSec,
      fps,
      aspectRatio,
      evalDurationMs: fileDurationMs,
    };

    reports.push(report);

    const durationStr = `~${durationSec}s (${totalFrames}f)`;
    console.log(formatRow(file, 'PASS', props.timeline.length, durationStr, aspectRatio, layoutModes.size, transitions.size, fileDurationMs));

    if (verbose) {
      console.log(`   ├─ Layout Modes: ${Array.from(layoutModes).join(', ')}`);
      console.log(`   └─ Transitions:  ${Array.from(transitions).join(', ')}`);
    }

    const reportPath = path.join(reportsDir, `report-${file.replace('.json', '')}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  });

  console.log('└────────────────────────┴────────┴────────┴─────────────────┴─────────┴────────────┴────────────┴─────────┘\n');

  console.log('────────────────────────────────────────────────────────────────────────────');
  console.log(' 📌 PHASE 2: ARTIFACT INTEGRITY & ZERO IMAGE CAPTURE');
  console.log('────────────────────────────────────────────────────────────────────────────\n');
  console.log(' 🔒 Policy Status : Zero Image Capture Policy Active');
  console.log(` 🔒 Output Folder : ${outDir} (Stateless & clean)\n`);

  // Generate Master Aggregated Markdown Summary Report
  const mdReportPath = path.join(reportsDir, `latest-eval-report.md`);
  const timestamp = new Date().toISOString();

  let summaryTable = `| Test Case File | Status | Scenes | Duration | Aspect Ratio | Layout Modes | Transitions |\n`;
  summaryTable += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  reports.forEach((r) => {
    summaryTable += `| \`${r.testCaseName}\` | ✅ PASS | ${r.totalScenes} | ${r.durationSeconds}s (${r.calculatedTotalFrames}f) | \`${r.aspectRatio}\` | ${r.layoutModesCovered.length} | ${r.transitionsCovered.length} |\n`;
  });

  const mdContent = `# ChronoViet Remotion Engine Evaluation Suite - Master Report

* **Timestamp**: ${timestamp}
* **Total Test Cases Evaluated**: ${reports.length}
* **Overall Automated Eval Status**: ${overallPassed ? '✅ ALL AUTOMATED EVALS PASSED' : '❌ FAILED'}
* **Unique Layout Modes Covered**: ${globalLayoutModes.size} / ${TOTAL_LAYOUT_MODES} Core Modes
* **Unique Transitions Covered**: ${globalTransitions.size} / ${TOTAL_TRANSITIONS} Core Types
* **Evaluation Suite Execution Time**: ${Date.now() - startTime}ms

## 📊 Programmatic Benchmark Test Cases Summary

${summaryTable}

## 🔒 Zero Image Capture Policy
- **Output Directory**: \`${outDir}\` (Không sinh ra file ảnh chụp nào).

## 👁️ Human Evaluation Visual Review
- [ ] **Visual Layout Harmony**: Kiểm tra trực tiếp trên Remotion Studio.
- [ ] **Ken Burns Motion Smoothness**: Kiểm tra trực tiếp trên Remotion Studio.
- [ ] **Audio-Visual Sync & Captions**: Kiểm tra trực tiếp trên Remotion Studio.

## 📐 Global Layout Modes Covered (${globalLayoutModes.size})
${Array.from(globalLayoutModes).sort().map((l) => `- \`${l}\``).join('\n')}

## 🔀 Global Transitions Covered (${globalTransitions.size})
${Array.from(globalTransitions).sort().map((t) => `- \`${t}\``).join('\n')}
`;

  fs.writeFileSync(mdReportPath, mdContent);

  if (!overallPassed) {
    console.error('💥 Evaluation failed for 1 or more test cases.');
    process.exit(1);
  }

  const totalSuiteTime = Date.now() - startTime;
  console.log('============================================================================');
  console.log(` 🎉 ALL AUTOMATED EVALUATION METRICS PASSED SUCCESSFULLY! (${totalSuiteTime}ms)`);
  console.log(` 📄 Master Evaluation Report: ${mdReportPath}`);
  console.log(` 📊 Total Test Cases        : ${reports.length}`);
  console.log(` 📐 Layout Modes Coverage   : ${globalLayoutModes.size} / ${TOTAL_LAYOUT_MODES} Core Layout Modes`);
  console.log(` 🔀 Transitions Coverage    : ${globalTransitions.size} / ${TOTAL_TRANSITIONS} Core Transitions`);
  console.log('============================================================================\n');

  if (openStudio) {
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(' 📌 PHASE 3: LAUNCHING REMOTION STUDIO FOR HUMAN EVALUATION');
    console.log('────────────────────────────────────────────────────────────────────────────\n');

    const requestedPort = parseInt(requestedPortStr, 10) || envConfig.REMOTION_PORT;
    let targetPort = requestedPort;
    if (isPortInUseSync(targetPort)) {
      console.log(`ℹ️ Port ${requestedPort} đang bị chiếm giữ bởi một tiến trình cũ.`);
      console.log(`🧹 Đang tiến hành giải phóng Port ${requestedPort}...`);
      const killed = killPortProcessSync(targetPort);
      if (killed) {
        console.log(`✅ Đã giải phóng thành công Port ${requestedPort}.\n`);
      } else {
        targetPort = findAvailablePortSync(requestedPort);
        console.log(`⚠️ Không thể giải phóng Port ${requestedPort}. Tự động chuyển sang Cổng tự do: ${targetPort}...\n`);
      }
    }

    console.log(`🚀 Đang khởi chạy giao diện Remotion Studio (Port ${targetPort}) để Human đánh giá trực quan...\n`);

    const packageRoot = path.join(__dirname, '..');
    const cmd = `pnpm exec remotion preview src/index.ts --port=${targetPort}`;

    if (verbose) {
      console.log(` 🛠️ Executing Command: ${cmd}`);
      console.log(` 📁 Working Directory : ${packageRoot}\n`);
    }

    // Clean stale webpack cache if it exists to avoid RangeError: Array buffer allocation failed
    const cacheDirsToClean = [
      path.join(packageRoot, 'node_modules/.cache/webpack'),
      path.resolve(process.cwd(), 'node_modules/.cache/webpack'),
    ];
    for (const cacheDir of cacheDirsToClean) {
      if (fs.existsSync(cacheDir)) {
        try {
          fs.rmSync(cacheDir, { recursive: true, force: true });
        } catch {
          // Ignore cache cleanup errors
        }
      }
    }

    try {
      execSync(cmd, {
        cwd: packageRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_OPTIONS: envConfig.REMOTION_NODE_OPTIONS,
        },
      });
    } catch (e: any) {
      if (e.signal === 'SIGINT' || e.signal === 'SIGTERM' || e.status === 130 || e.status === 0) {
        console.log('\n👋 Remotion Studio closed by user.');
      } else {
        console.log('\n👋 Remotion Studio process finished.');
      }
    } finally {
      // Ensure clean exit and release port binding
      killPortProcessSync(targetPort);
    }
  }
}

runEvaluation();
