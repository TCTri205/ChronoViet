import { WordTimestamp, CaptionWord } from '@chronoviet/shared-spec';

/**
 * Quy đổi VieNeu Word Timestamps (ms) sang Remotion Caption Frames dựa trên FPS
 */
export function convertVieNeuTimestampsToCaptions(
  wordTimestamps: WordTimestamp[],
  fps = 30
): CaptionWord[] {
  return wordTimestamps.map((item) => ({
    word: item.word,
    startFrame: Math.floor((item.startMs / 1000) * fps),
    endFrame: Math.ceil((item.endMs / 1000) * fps),
  }));
}

/**
 * Công thức tính durationInFrames dựa trên audioDurationMs thực tế từ VieNeu TTS:
 * durationInFrames = ceil(((audioDurationMs + paddingMs) / 1000) * FPS)
 */
export function calculateSceneDurationInFrames(
  audioDurationMs: number,
  paddingMs = 300,
  fps = 30
): number {
  return Math.ceil(((audioDurationMs + paddingMs) / 1000) * fps);
}
