import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { VieNeuEngine } from '../src/engine';
import { envConfig } from '@chronoviet/shared-spec';
import { SentenceEvalMetric, SummaryEvalReport, saveEvalReport } from './reports/report_generator';
import { cleanEvalArtifacts } from '../../../eval/utils/cleaner';

interface DatasetItem {
  id: string;
  text: string;
  domainCategory: string;
  targetWordsCount: number;
}

async function runVieNeuTtsEvaluation() {
  const args = process.argv.slice(2);
  const cleanOnly = args.includes('--clean');
  const fresh = args.includes('--fresh');

  if (cleanOnly) {
    cleanEvalArtifacts({ verbose: true, killPorts: false });
    process.exit(0);
  }

  if (fresh) {
    cleanEvalArtifacts({ verbose: true, killPorts: false });
  }

  console.log(`┌──────────────────────────────────────────────────────────────────────────┐`);
  console.log(`│   🚀 ChronoViet VieNeu TTS Engine Evaluation Suite (Workstream B)        │`);
  console.log(`└──────────────────────────────────────────────────────────────────────────┘`);

  const remotionDatasetPath = path.join(__dirname, 'datasets', 'remotion_script_sentences.json');
  const fallbackDatasetPath = path.join(__dirname, 'datasets', 'historical_50_sentences.json');
  const reportsDir = path.join(__dirname, 'reports');

  let datasetPath = remotionDatasetPath;
  if (!fs.existsSync(datasetPath)) {
    datasetPath = fallbackDatasetPath;
  }

  if (!fs.existsSync(datasetPath)) {
    console.error(`❌ Dataset file not found at ${datasetPath}`);
    process.exit(1);
  }

  const datasetName = path.basename(datasetPath);
  const rawData = fs.readFileSync(datasetPath, 'utf-8');
  const dataset: DatasetItem[] = JSON.parse(rawData);

  const targetRtf = envConfig.EVAL_MAX_RTF;

  console.log(`📁 Loaded ${dataset.length} scene sentences for scenario script from '${datasetName}'.`);
  console.log(`⚙️ Target KPIs: RTF < ${targetRtf}x | Alignment Error < 50ms | Frame Error < 1 frame`);
  console.log(`────────────────────────────────────────────────────────────────────────────`);

  const engine = new VieNeuEngine();
  const results: SentenceEvalMetric[] = [];

  let totalRtf = 0;
  let maxRtf = 0;
  let totalAlignmentError = 0;
  let maxAlignmentError = 0;
  let maxFrameCalcError = 0;
  let passedCount = 0;

  let detectedEngine = 'SYNTHETIC_FALLBACK_TONE (Sine Wave Generator)';

  for (let idx = 0; idx < dataset.length; idx++) {
    const item = dataset[idx];
    const t0 = performance.now();
    const response = await engine.synthesize({ text: item.text, paddingMs: 300, fps: 30 });
    const t1 = performance.now();

    if (response.engineType === 'REAL_NEURAL_ONNX') {
      detectedEngine = 'REAL_NEURAL_ONNX (VieNeu ONNX Service)';
    } else if (response.engineType === 'SYNTHETIC_FALLBACK_TONE') {
      detectedEngine = 'SYNTHETIC_FALLBACK_TONE (Sine Wave Generator)';
    }

    const synthesisTimeMs = t1 - t0;
    const audioDurationMs = response.audioDurationMs;
    const audioDurationSec = audioDurationMs / 1000;
    const rtf = audioDurationSec > 0 ? (synthesisTimeMs / 1000) / audioDurationSec : 0;

    // Check monotonic timestamps & alignment errors
    let maxAlignErrorForSentence = 0;
    for (let i = 0; i < response.wordTimestamps.length; i++) {
      const wt = response.wordTimestamps[i];
      if (wt.startMs > wt.endMs) {
        maxAlignErrorForSentence = Math.max(maxAlignErrorForSentence, wt.startMs - wt.endMs);
      }
      if (i > 0) {
        const prev = response.wordTimestamps[i - 1];
        if (prev.endMs > wt.startMs) {
          maxAlignErrorForSentence = Math.max(maxAlignErrorForSentence, prev.endMs - wt.startMs);
        }
      }
    }

    // Verify calculatedFramesAt30fps formula
    const expectedFrames = Math.ceil(((audioDurationMs + 300) / 1000) * 30);
    const frameCalcError = Math.abs(response.calculatedFramesAt30fps - expectedFrames);

    const passed = rtf < targetRtf && maxAlignErrorForSentence < 50 && frameCalcError < 1.0;
    if (passed) passedCount++;

    totalRtf += rtf;
    maxRtf = Math.max(maxRtf, rtf);
    totalAlignmentError += maxAlignErrorForSentence;
    maxAlignmentError = Math.max(maxAlignmentError, maxAlignErrorForSentence);
    maxFrameCalcError = Math.max(maxFrameCalcError, frameCalcError);

    results.push({
      id: item.id,
      text: item.text,
      domainCategory: item.domainCategory,
      audioDurationMs,
      calculatedFramesAt30fps: response.calculatedFramesAt30fps,
      wordCount: response.wordTimestamps.length,
      synthesisTimeMs,
      rtf,
      maxTimestampAlignmentErrorMs: maxAlignErrorForSentence,
      frameCalculationError: frameCalcError,
      passed,
    });
  }

  const avgRtf = dataset.length > 0 ? totalRtf / dataset.length : 0;
  const avgAlignmentErrorMs = dataset.length > 0 ? totalAlignmentError / dataset.length : 0;
  const failedCount = dataset.length - passedCount;
  const passRatePercentage = dataset.length > 0 ? (passedCount / dataset.length) * 100 : 0;
  const overallStatus = failedCount === 0 ? 'PASS' : 'FAIL';

  const summaryReport: SummaryEvalReport = {
    timestamp: new Date().toISOString(),
    totalSentences: dataset.length,
    passedCount,
    failedCount,
    passRatePercentage,
    avgRtf,
    maxRtf,
    avgAlignmentErrorMs,
    maxAlignmentErrorMs: maxAlignmentError,
    maxFrameCalcError,
    overallStatus,
    results,
  };

  saveEvalReport(summaryReport, reportsDir, targetRtf);

  console.log(`============================================================================`);
  console.log(`  🎉 VIENEU TTS EVALUATION SUITE COMPLETED! (${overallStatus})`);
  console.log(`  🤖 Active Engine Mode     : ${detectedEngine}`);
  console.log(`  📊 Pass Rate              : ${passedCount}/${dataset.length} (${passRatePercentage.toFixed(1)}%)`);
  console.log(`  ⚡ Avg Real-Time Factor   : ${avgRtf.toFixed(4)}x (Target: < ${targetRtf}x)`);
  console.log(`  ⏱️ Max Alignment Error    : ${maxAlignmentError.toFixed(1)}ms (Target: < 50ms)`);
  console.log(`  🎬 Max Frame Calc Error   : ${maxFrameCalcError.toFixed(2)} frames (Target: < 1 frame)`);
  console.log(`============================================================================`);

  if (overallStatus !== 'PASS') {
    process.exit(1);
  }
}

runVieNeuTtsEvaluation();
