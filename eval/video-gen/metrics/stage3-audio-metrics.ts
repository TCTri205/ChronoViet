/**
 * ChronoViet Stage 3: TTS Gen Audio & Pacing Reconciliation Evaluation Metrics
 * Evaluates VieNeu TTS voice synthesis, audio file integrity on disk,
 * Real-Time Factor (RTF) speed, word timestamp monotonic alignment for karaoke sync,
 * duration reconciliation deviation, and PCM WAV format compliance.
 */

import fs from 'node:fs';
import { BaseTestCaseResult, MetricScore, LatencyProfile, calculateLatencyPercentiles } from '../../shared/index.js';

export interface Stage3SceneAudioSummary {
  sceneId: string;
  voiceoverText: string;
  wordCount: number;
  audioPath?: string;
  audioFileExists: boolean;
  audioFileSizeBytes: number;
  audioDurationSeconds: number;
  targetDurationSeconds: number;
  reconciledDurationSeconds: number;
  rtf: number;
  synthesisLatencyMs: number;
  wordTimestampsCount: number;
  timestampsMonotonic: boolean;
  wavHeaderValid: boolean;
  sampleRate: number;
  isSyntheticFallback: boolean;
  errorMsg?: string;
}

export interface Stage3AudioCaseResult extends BaseTestCaseResult {
  id: string;
  title: string;
  topic: string;
  videoType: string;
  totalScenes: number;
  audioGeneratedScenes: number;
  audioGenerationSuccessRate: number;
  meanRtf: number;
  timestampsMonotonicRate: number;
  wavHeaderValidRate: number;
  pacingReconciliationDeviationPct: number;
  reconciliationPassed: boolean;
  syntheticFallbackCount: number;
  durationMs: number;
  passed: boolean;
  scenes: Stage3SceneAudioSummary[];
  errors?: string[];
  warnings?: string[];
}

export interface Stage3AudioAggregatedMetrics {
  totalCases: number;
  passedCases: number;
  audioGenerationSuccessRate: number;
  meanRtf: number;
  meanPacingReconciliationDeviationPct: number;
  timestampsMonotonicRate: number;
  wavHeaderComplianceRate: number;
  syntheticFallbackRate: number;
  durationProfile: LatencyProfile;
  metricScores: Record<string, MetricScore>;
}

/**
 * Validates PCM WAV RIFF header structure and extracts sample parameters.
 */
export function validateWavHeader(buffer: Buffer): {
  valid: boolean;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  reason?: string;
} {
  if (!buffer || buffer.length < 44) {
    return { valid: false, sampleRate: 0, channels: 0, bitsPerSample: 0, reason: 'File buffer too short (< 44 bytes)' };
  }

  const riff = buffer.toString('ascii', 0, 4);
  if (riff !== 'RIFF') {
    return { valid: false, sampleRate: 0, channels: 0, bitsPerSample: 0, reason: `Invalid RIFF header: found "${riff}"` };
  }

  const wave = buffer.toString('ascii', 8, 12);
  if (wave !== 'WAVE') {
    return { valid: false, sampleRate: 0, channels: 0, bitsPerSample: 0, reason: `Invalid WAVE header: found "${wave}"` };
  }

  const fmt = buffer.toString('ascii', 12, 16);
  if (fmt !== 'fmt ') {
    return { valid: false, sampleRate: 0, channels: 0, bitsPerSample: 0, reason: `Missing "fmt " chunk: found "${fmt}"` };
  }

  const audioFormat = buffer.readUInt16LE(20);
  if (audioFormat !== 1) {
    return { valid: false, sampleRate: 0, channels: 0, bitsPerSample: 0, reason: `Unsupported audio format (${audioFormat}), expected 1 (PCM)` };
  }

  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);

  if (sampleRate < 16000 || sampleRate > 48000) {
    return { valid: false, sampleRate, channels, bitsPerSample, reason: `Sample rate ${sampleRate}Hz outside standard voice band (16-48kHz)` };
  }

  return { valid: true, sampleRate, channels, bitsPerSample };
}

export function evaluateStage3AudioCase(
  caseInfo: {
    id: string;
    topic: string;
    videoType: string;
    targetDurationMinutes: number;
    pacingErrorPercentage?: number;
    executionDurationMs: number;
  },
  sceneSummaries: Stage3SceneAudioSummary[],
  reconciledTotalSec: number,
  isStrict = false
): Stage3AudioCaseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const targetDurationSec = (caseInfo.targetDurationMinutes ?? 0) * 60;
  const totalScenes = sceneSummaries.length;
  if (totalScenes === 0) {
    errors.push('No scenes found to evaluate audio synthesis.');
  }

  // 1. Audio Generation Success Rate
  const validAudioScenes = sceneSummaries.filter((s) => s.audioFileExists && s.audioFileSizeBytes > 0);
  const audioGeneratedScenes = validAudioScenes.length;
  const audioGenerationSuccessRate = totalScenes > 0 ? audioGeneratedScenes / totalScenes : 0;

  if (audioGenerationSuccessRate < 1.0) {
    const missingScenes = sceneSummaries.filter((s) => !s.audioFileExists || s.audioFileSizeBytes === 0).map((s) => s.sceneId);
    errors.push(`Missing or zero-byte audio files for ${missingScenes.length} scenes: [${missingScenes.join(', ')}]`);
  }

  // 2. Real-Time Factor (RTF)
  const scenesWithValidAudio = sceneSummaries.filter((s) => s.audioDurationSeconds > 0 && s.synthesisLatencyMs > 0);
  const meanRtf = scenesWithValidAudio.length > 0
    ? scenesWithValidAudio.reduce((sum, s) => sum + s.rtf, 0) / scenesWithValidAudio.length
    : 0;

  if (meanRtf > 0.60) {
    warnings.push(`Mean RTF is slow: ${meanRtf.toFixed(2)}x (Target < 0.35x, Pass Gate < 0.60x)`);
  }

  // 3. Word Timestamp Alignment & Monotonicity
  const monotonicScenes = sceneSummaries.filter((s) => s.timestampsMonotonic && s.wordTimestampsCount > 0);
  const timestampsMonotonicRate = totalScenes > 0 ? monotonicScenes.length / totalScenes : 0;

  if (timestampsMonotonicRate < 1.0) {
    const nonMonotonic = sceneSummaries.filter((s) => !s.timestampsMonotonic).map((s) => s.sceneId);
    errors.push(`Non-monotonic or missing word timestamps in ${nonMonotonic.length} scenes: [${nonMonotonic.join(', ')}]`);
  }

  // 4. PCM WAV Header Format Compliance
  const validHeaderScenes = sceneSummaries.filter((s) => s.wavHeaderValid);
  const wavHeaderValidRate = totalScenes > 0 ? validHeaderScenes.length / totalScenes : 0;

  if (wavHeaderValidRate < 1.0) {
    const invalidHeaders = sceneSummaries.filter((s) => !s.wavHeaderValid).map((s) => `${s.sceneId} (${s.errorMsg || 'invalid header'})`);
    errors.push(`Invalid PCM WAV headers in ${invalidHeaders.length} scenes: [${invalidHeaders.join(', ')}]`);
  }

  // 5. Synthetic Fallback Audit (No silent suppression of TTS down)
  const syntheticFallbackCount = sceneSummaries.filter((s) => s.isSyntheticFallback).length;
  if (syntheticFallbackCount > 0) {
    const fallbackMsg = `${syntheticFallbackCount}/${totalScenes} scenes fell back to synthetic audio because Primary TTS failed or was offline`;
    if (isStrict) {
      errors.push(`[STRICT] ${fallbackMsg}`);
    } else {
      warnings.push(`[FALLBACK] ${fallbackMsg}`);
    }
  }

  // 6. Duration Reconciliation Pacing Deviation from reconciler node
  const pacingReconciliationDeviationPct = typeof caseInfo.pacingErrorPercentage === 'number'
    ? caseInfo.pacingErrorPercentage
    : (targetDurationSec > 0
        ? Math.round((Math.abs(reconciledTotalSec - targetDurationSec) / targetDurationSec) * 1000) / 10
        : 0);

  const reconciliationPassed = pacingReconciliationDeviationPct <= 10.0;
  if (!reconciliationPassed) {
    warnings.push(
      `Reconciled total duration (${reconciledTotalSec}s) has ${pacingReconciliationDeviationPct}% reconciliation deviation`
    );
  }

  // Pass Gate: 100% audio exists, 100% valid WAV header, timestamps monotonic, deviation <= 10%, no fatal errors
  const passed =
    errors.length === 0 &&
    audioGenerationSuccessRate >= 1.0 &&
    wavHeaderValidRate >= 0.95 &&
    timestampsMonotonicRate >= 0.95 &&
    reconciliationPassed;

  return {
    id: caseInfo.id,
    title: caseInfo.topic,
    topic: caseInfo.topic,
    videoType: caseInfo.videoType,
    totalScenes,
    audioGeneratedScenes,
    audioGenerationSuccessRate,
    meanRtf: Math.round(meanRtf * 100) / 100,
    timestampsMonotonicRate: Math.round(timestampsMonotonicRate * 1000) / 1000,
    wavHeaderValidRate: Math.round(wavHeaderValidRate * 1000) / 1000,
    pacingReconciliationDeviationPct,
    reconciliationPassed,
    syntheticFallbackCount,
    durationMs: caseInfo.executionDurationMs,
    passed,
    scenes: sceneSummaries,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function computeStage3AudioAggregatedMetrics(
  caseResults: Stage3AudioCaseResult[]
): Stage3AudioAggregatedMetrics {
  const totalCases = caseResults.length;
  const passedCases = caseResults.filter((r) => r.passed).length;

  const totalAudioSuccessRate = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.audioGenerationSuccessRate, 0) / totalCases
    : 1.0;

  const meanRtf = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.meanRtf, 0) / totalCases
    : 0.2;

  const meanPacingReconciliationDev = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.pacingReconciliationDeviationPct, 0) / totalCases
    : 0;

  const meanTimestampsMonotonicRate = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.timestampsMonotonicRate, 0) / totalCases
    : 1.0;

  const meanWavHeaderRate = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.wavHeaderValidRate, 0) / totalCases
    : 1.0;

  const totalScenesCount = caseResults.reduce((sum, r) => sum + r.totalScenes, 0);
  const totalSyntheticFallbacks = caseResults.reduce((sum, r) => sum + r.syntheticFallbackCount, 0);
  const syntheticFallbackRate = totalScenesCount > 0 ? totalSyntheticFallbacks / totalScenesCount : 0;

  const allDurations = caseResults.map((r) => r.durationMs);
  const durationProfile = calculateLatencyPercentiles(allDurations);

  const metricScores: Record<string, MetricScore> = {
    audioGenerationSuccessRate: {
      name: 'Audio Generation Success Rate',
      value: Math.round(totalAudioSuccessRate * 1000) / 10,
      target: 100.0,
      pass: totalAudioSuccessRate >= 0.95, // Target 100%, Pass Gate >= 95%
      unit: '%',
      description: 'Percentage of scenes successfully synthesized and written to disk as valid audio',
    },
    meanRtfSpeed: {
      name: 'Real-Time Factor (RTF) Speed',
      value: Math.round(meanRtf * 100) / 100,
      target: 0.35,
      pass: meanRtf <= 0.60, // Target < 0.35x RTF, Fail > 0.60x
      unit: 'x RTF',
      description: 'Ratio of audio synthesis latency relative to total speech audio duration',
    },
    timestampsMonotonicRate: {
      name: 'Word Timestamp Monotonic Alignment',
      value: Math.round(meanTimestampsMonotonicRate * 1000) / 10,
      target: 100.0,
      pass: meanTimestampsMonotonicRate >= 0.95,
      unit: '%',
      description: 'Percentage of scenes with non-decreasing, non-overlapping karaoke word timestamps',
    },
    pacingReconciliationDeviation: {
      name: 'Pacing Reconciliation Deviation',
      value: Math.round(meanPacingReconciliationDev * 10) / 10,
      target: 5.0,
      pass: meanPacingReconciliationDev <= 10.0, // Target <= 5%, Fail > 10%
      unit: '%',
      description: 'Deviation of reconciled speech audio duration against topic target duration',
    },
    wavHeaderComplianceRate: {
      name: 'PCM WAV Format Compliance Rate',
      value: Math.round(meanWavHeaderRate * 1000) / 10,
      target: 100.0,
      pass: meanWavHeaderRate >= 0.95,
      unit: '%',
      description: 'Percentage of synthesized audio files complying with 16-bit PCM WAV standard',
    },
    syntheticFallbackRate: {
      name: 'Synthetic Audio Fallback Rate',
      value: Math.round(syntheticFallbackRate * 1000) / 10,
      target: 0.0,
      pass: syntheticFallbackRate <= 0.05,
      unit: '%',
      description: 'Percentage of scenes that fell back to synthetic audio generator',
    },
  };

  return {
    totalCases,
    passedCases,
    audioGenerationSuccessRate: Math.round(totalAudioSuccessRate * 1000) / 1000,
    meanRtf: Math.round(meanRtf * 100) / 100,
    meanPacingReconciliationDeviationPct: Math.round(meanPacingReconciliationDev * 10) / 10,
    timestampsMonotonicRate: Math.round(meanTimestampsMonotonicRate * 1000) / 1000,
    wavHeaderComplianceRate: Math.round(meanWavHeaderRate * 1000) / 1000,
    syntheticFallbackRate: Math.round(syntheticFallbackRate * 1000) / 1000,
    durationProfile,
    metricScores,
  };
}
