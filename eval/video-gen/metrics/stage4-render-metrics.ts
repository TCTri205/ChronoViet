/**
 * ChronoViet Stage 4: Remotion Video Rendering & Composition Evaluation Metrics
 * Evaluates VideoProjectSchema Zod validation, Remotion headless rendering to MP4,
 * render latency / speed ratio, audio-video timeline sync, and karaoke caption frame boundaries.
 */

import { BaseTestCaseResult, MetricScore, LatencyProfile, calculateLatencyPercentiles } from '../../shared/index.js';

export interface Stage4SceneRenderSummary {
  sceneId: string;
  durationInFrames: number;
  layoutMode: string;
  hasAudio: boolean;
  audioDurationSeconds: number;
  audioFitsInFrames: boolean;
  hasVisualAsset: boolean;
  captionsCount: number;
  captionsWithinSceneBounds: boolean;
}

export interface Stage4RenderCaseResult extends BaseTestCaseResult {
  id: string;
  title: string;
  topic: string;
  videoType: string;
  templateId: string;
  aspectRatio: string;
  fps: number;
  totalFrames: number;
  totalVideoDurationSec: number;
  schemaValidated: boolean;
  videoRendered: boolean;
  videoFileExists: boolean;
  videoFileSizeBytes: number;
  videoPath?: string;
  renderDurationMs: number;
  renderSpeedRatio: number; // renderDurationMs / (totalVideoDurationSec * 1000)
  audioVideoSyncCompliantRate: number;
  captionBoundsCompliantRate: number;
  durationMs: number;
  passed: boolean;
  scenes: Stage4SceneRenderSummary[];
  errors?: string[];
  warnings?: string[];
}

export interface Stage4RenderAggregatedMetrics {
  totalCases: number;
  passedCases: number;
  schemaValidationPassRate: number;
  videoRenderSuccessRate: number;
  meanRenderSpeedRatio: number;
  meanAudioVideoSyncRate: number;
  meanCaptionBoundsRate: number;
  durationProfile: LatencyProfile;
  metricScores: Record<string, MetricScore>;
}

export function evaluateStage4RenderCase(
  caseInfo: {
    id: string;
    topic: string;
    videoType: string;
    templateId: string;
    aspectRatio: string;
    fps: number;
    totalFrames: number;
    schemaValidated: boolean;
    schemaErrors?: string[];
    videoPath?: string;
    videoFileExists: boolean;
    videoFileSizeBytes: number;
    renderDurationMs: number;
    renderStdErr?: string;
    executionDurationMs: number;
  },
  sceneSummaries: Stage4SceneRenderSummary[]
): Stage4RenderCaseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const fps = caseInfo.fps || 30;
  const totalVideoDurationSec = Math.round((caseInfo.totalFrames / fps) * 10) / 10;

  // 1. Schema Validation Compliance
  if (!caseInfo.schemaValidated) {
    errors.push(`VideoProjectSchema Zod validation failed: ${(caseInfo.schemaErrors || []).join('; ')}`);
  }

  // 2. Video Render Output Verification
  if (!caseInfo.videoFileExists || caseInfo.videoFileSizeBytes < 50 * 1024) {
    const reason = caseInfo.renderStdErr
      ? `Render process error: ${caseInfo.renderStdErr.slice(0, 300)}`
      : `Output video missing or under 50KB (${caseInfo.videoFileSizeBytes} bytes)`;
    errors.push(`Video render failed: ${reason}`);
  }

  // 3. Render Speed Ratio (RTF Render)
  const totalVideoMs = totalVideoDurationSec * 1000;
  const renderSpeedRatio = totalVideoMs > 0
    ? Math.round((caseInfo.renderDurationMs / totalVideoMs) * 100) / 100
    : 0;

  if (renderSpeedRatio > 1.50) {
    warnings.push(`Render speed ratio is high: ${renderSpeedRatio.toFixed(2)}x real-time (Target < 1.0x)`);
  }

  // 4. Audio-Video Timeline Sync (Audio frames must fit inside scene frames)
  const totalScenes = sceneSummaries.length;
  const syncScenes = sceneSummaries.filter((s) => s.audioFitsInFrames);
  const audioVideoSyncCompliantRate = totalScenes > 0 ? syncScenes.length / totalScenes : 1.0;

  if (audioVideoSyncCompliantRate < 1.0) {
    const unsynced = sceneSummaries.filter((s) => !s.audioFitsInFrames).map((s) => s.sceneId);
    errors.push(`Audio duration exceeds visual scene duration in ${unsynced.length} scenes: [${unsynced.join(', ')}]`);
  }

  // 5. Karaoke Caption Frame Boundaries
  const captionCompliantScenes = sceneSummaries.filter((s) => s.captionsWithinSceneBounds);
  const captionBoundsCompliantRate = totalScenes > 0 ? captionCompliantScenes.length / totalScenes : 1.0;

  if (captionBoundsCompliantRate < 1.0) {
    const outOfBounds = sceneSummaries.filter((s) => !s.captionsWithinSceneBounds).map((s) => s.sceneId);
    warnings.push(`Captions exceed scene frame boundaries in ${outOfBounds.length} scenes: [${outOfBounds.join(', ')}]`);
  }

  // Pass Gate: 100% schema valid, video file exists & size >= 50KB, audio sync compliant, no fatal errors
  const passed =
    errors.length === 0 &&
    caseInfo.schemaValidated &&
    caseInfo.videoFileExists &&
    caseInfo.videoFileSizeBytes >= 50 * 1024 &&
    audioVideoSyncCompliantRate >= 1.0;

  return {
    id: caseInfo.id,
    title: caseInfo.topic,
    topic: caseInfo.topic,
    videoType: caseInfo.videoType,
    templateId: caseInfo.templateId,
    aspectRatio: caseInfo.aspectRatio,
    fps,
    totalFrames: caseInfo.totalFrames,
    totalVideoDurationSec,
    schemaValidated: caseInfo.schemaValidated,
    videoRendered: caseInfo.videoFileExists,
    videoFileExists: caseInfo.videoFileExists,
    videoFileSizeBytes: caseInfo.videoFileSizeBytes,
    videoPath: caseInfo.videoPath,
    renderDurationMs: caseInfo.renderDurationMs,
    renderSpeedRatio,
    audioVideoSyncCompliantRate: Math.round(audioVideoSyncCompliantRate * 1000) / 1000,
    captionBoundsCompliantRate: Math.round(captionBoundsCompliantRate * 1000) / 1000,
    durationMs: caseInfo.executionDurationMs,
    passed,
    scenes: sceneSummaries,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function computeStage4RenderAggregatedMetrics(
  caseResults: Stage4RenderCaseResult[]
): Stage4RenderAggregatedMetrics {
  const totalCases = caseResults.length;
  const passedCases = caseResults.filter((r) => r.passed).length;

  const validSchemas = caseResults.filter((r) => r.schemaValidated).length;
  const schemaValidationPassRate = totalCases > 0 ? validSchemas / totalCases : 1.0;

  const renderedVideos = caseResults.filter((r) => r.videoFileExists && r.videoFileSizeBytes >= 50 * 1024).length;
  const videoRenderSuccessRate = totalCases > 0 ? renderedVideos / totalCases : 1.0;

  const meanRenderSpeedRatio = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.renderSpeedRatio, 0) / totalCases
    : 0.8;

  const meanAudioVideoSync = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.audioVideoSyncCompliantRate, 0) / totalCases
    : 1.0;

  const meanCaptionBounds = totalCases > 0
    ? caseResults.reduce((sum, r) => sum + r.captionBoundsCompliantRate, 0) / totalCases
    : 1.0;

  const allDurations = caseResults.map((r) => r.durationMs);
  const durationProfile = calculateLatencyPercentiles(allDurations);

  const metricScores: Record<string, MetricScore> = {
    schemaValidationPassRate: {
      name: 'VideoProjectSchema Validation Pass Rate',
      value: Math.round(schemaValidationPassRate * 1000) / 10,
      target: 100.0,
      pass: schemaValidationPassRate >= 1.0, // 100% strict requirement
      unit: '%',
      description: 'Percentage of generated projects passing Zod VideoProjectSchema validation',
    },
    videoRenderSuccessRate: {
      name: 'Remotion Video Render Success Rate',
      value: Math.round(videoRenderSuccessRate * 1000) / 10,
      target: 100.0,
      pass: videoRenderSuccessRate >= 1.0, // 100% strict requirement
      unit: '%',
      description: 'Percentage of projects rendered to a valid MP4 file on disk (>50KB)',
    },
    meanRenderSpeedRatio: {
      name: 'Remotion Render Speed Ratio',
      value: Math.round(meanRenderSpeedRatio * 100) / 100,
      target: 1.0,
      pass: meanRenderSpeedRatio <= 1.50, // Target < 1.0x, Fail > 1.50x
      unit: 'x real-time',
      description: 'Ratio of total render time relative to target video playback duration',
    },
    audioVideoSyncRate: {
      name: 'Audio-Video Timeline Synchronization Rate',
      value: Math.round(meanAudioVideoSync * 1000) / 10,
      target: 100.0,
      pass: meanAudioVideoSync >= 0.98,
      unit: '%',
      description: 'Percentage of scenes where timeline frames adequately cover speech audio without abrupt cuts',
    },
    captionBoundsComplianceRate: {
      name: 'Karaoke Caption Frame Boundary Compliance',
      value: Math.round(meanCaptionBounds * 1000) / 10,
      target: 100.0,
      pass: meanCaptionBounds >= 0.95,
      unit: '%',
      description: 'Percentage of scenes with karaoke caption words strictly bounded within the scene frame duration',
    },
  };

  return {
    totalCases,
    passedCases,
    schemaValidationPassRate: Math.round(schemaValidationPassRate * 1000) / 1000,
    videoRenderSuccessRate: Math.round(videoRenderSuccessRate * 1000) / 1000,
    meanRenderSpeedRatio: Math.round(meanRenderSpeedRatio * 100) / 100,
    meanAudioVideoSyncRate: Math.round(meanAudioVideoSync * 1000) / 1000,
    meanCaptionBoundsRate: Math.round(meanCaptionBounds * 1000) / 1000,
    durationProfile,
    metricScores,
  };
}
