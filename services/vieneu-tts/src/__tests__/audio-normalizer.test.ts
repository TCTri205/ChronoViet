import { describe, it, expect } from 'vitest';
import { AudioNormalizer } from '../audio-normalizer.js';

describe('AudioNormalizer Unit Tests', () => {
  const normalizer = new AudioNormalizer('/tmp/test-audio-assets');

  it('calculates -14 LUFS normalization for BGM correctly', () => {
    const norm = normalizer.calculateNormalization('bgm_epic_historical', -20);
    expect(norm.targetLufs).toBe(-14.0);
    expect(norm.gainAdjustmentDb).toBe(6.0);
    expect(norm.normalized).toBe(true);
  });

  it('calculates -6 LUFS Peak normalization for SFX correctly', () => {
    const norm = normalizer.calculateNormalization('sfx_drum_war', -10);
    expect(norm.targetLufs).toBe(-6.0);
    expect(norm.gainAdjustmentDb).toBe(4.0);
    expect(norm.normalized).toBe(true);
  });

  it('ingests and normalizes an audio asset with valid WAV buffer', async () => {
    const result = await normalizer.ingest({
      category: 'bgm_ambient_court',
      durationSeconds: 2,
      sampleRate: 44100,
    });
    expect(result.success).toBe(true);
    expect(result.normalization.targetLufs).toBe(-14.0);
    expect(result.checksum).toBeDefined();
  });
});
