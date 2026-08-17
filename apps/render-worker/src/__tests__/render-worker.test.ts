import { describe, it, expect } from 'vitest';
import { QUEUE_NAMES } from '../queues/queue-manager.js';
import { parseRemotionStdoutLine } from '../lib/remotion-progress-parser.js';

describe('Render Worker App Unit Tests', () => {
  it('should define all required BullMQ queue names', () => {
    expect(QUEUE_NAMES.TTS_GEN).toBe('tts-gen-queue');
    expect(QUEUE_NAMES.VLM_INSPECT).toBe('vlm-inspect-queue');
    expect(QUEUE_NAMES.REMOTION_RENDER).toBe('remotion-render-queue');
  });

  describe('Remotion CLI stdout progress parser', () => {
    it('parses "Rendered 250/1000 frames (25%)"', () => {
      const parsed = parseRemotionStdoutLine('Rendered 250/1000 frames (25%)');
      expect(parsed).not.toBeNull();
      expect(parsed?.currentFrame).toBe(250);
      expect(parsed?.totalFrames).toBe(1000);
      expect(parsed?.progressPercent).toBe(25);
    });

    it('parses bracket format "[500/1000]"', () => {
      const parsed = parseRemotionStdoutLine('[500/1000]');
      expect(parsed).not.toBeNull();
      expect(parsed?.currentFrame).toBe(500);
      expect(parsed?.totalFrames).toBe(1000);
      expect(parsed?.progressPercent).toBe(50);
    });

    it('parses percentage format "75%" with knownTotalFrames', () => {
      const parsed = parseRemotionStdoutLine('Rendering progress: 75%', 600);
      expect(parsed).not.toBeNull();
      expect(parsed?.progressPercent).toBe(75);
      expect(parsed?.currentFrame).toBe(450);
    });

    it('returns null for unrelated log lines', () => {
      expect(parseRemotionStdoutLine('Bundling Remotion project...')).toBeNull();
      expect(parseRemotionStdoutLine('')).toBeNull();
    });
  });
});
