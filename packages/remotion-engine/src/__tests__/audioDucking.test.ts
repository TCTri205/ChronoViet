import { describe, it, expect } from 'vitest';
import { computeDuckedBgmVolume, DUCKING_FACTOR_12DB } from '../utils/audioDucking';

describe('Audio Ducking Envelope Interpolator', () => {
  it('ducks volume to -12dB (~25.1% of base volume) during speech frames', () => {
    const baseVolume = 0.25;
    const intervals = [{ start: 100, end: 200 }];
    const totalFrames = 500;

    // Inside speech (frame 150)
    const insideSpeechVol = computeDuckedBgmVolume(150, baseVolume, intervals, totalFrames);
    expect(insideSpeechVol).toBeCloseTo(baseVolume * DUCKING_FACTOR_12DB, 4);

    // Far outside speech (frame 300)
    const outsideSpeechVol = computeDuckedBgmVolume(300, baseVolume, intervals, totalFrames);
    expect(outsideSpeechVol).toBeCloseTo(baseVolume, 4);

    // Fade transition (frame 210 = 5 frames after padded speech end 205)
    const transitioningVol = computeDuckedBgmVolume(210, baseVolume, intervals, totalFrames);
    expect(transitioningVol).toBeGreaterThan(insideSpeechVol);
    expect(transitioningVol).toBeLessThan(outsideSpeechVol);
  });
});
