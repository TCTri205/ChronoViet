import { describe, it, expect } from 'vitest';
import { convertVieNeuTimestampsToCaptions, calculateSceneDurationInFrames } from '../engine.js';
import { WordTimestamp } from '@chronoviet/shared-spec';

describe('timestamp-converter', () => {
  it('calculates scene duration in frames correctly', () => {
    // 7400ms audio + 300ms padding = 7700ms => 7.7s * 30fps = 231 frames
    const durationInFrames = calculateSceneDurationInFrames(7400, 300, 30);
    expect(durationInFrames).toBe(231);
  });

  it('converts VieNeu timestamps to captions with correct frame alignment', () => {
    const mockTimestamps: WordTimestamp[] = [
      { word: 'Đêm', startMs: 0, endMs: 350 },
      { word: 'mùng', startMs: 360, endMs: 620 },
      { word: '4', startMs: 630, endMs: 950 },
      { word: 'Tết', startMs: 960, endMs: 1250 },
    ];

    const captions = convertVieNeuTimestampsToCaptions(mockTimestamps, 30);
    expect(captions.length).toBe(4);
    expect(captions[0].startFrame).toBe(0);
    expect(captions[0].endFrame).toBe(11);
  });
});
