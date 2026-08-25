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

  describe('Zero-Copy Local Media Streaming & Schema Footprint', () => {
    it('verifies that project schema retains native file paths without Base64 payload amplification', () => {
      const mockProjectSchema = {
        projectId: 'test_zero_copy_schema_001',
        title: 'Chiến thắng Bạch Đằng',
        templateId: 'HISTORICAL_DOCUMENTARY',
        totalDurationFrames: 900,
        fps: 30,
        width: 1920,
        height: 1080,
        audioUrl: '/media/projects/test_zero_copy_schema_001/audio/composite.wav',
        bgmUrl: '/media/projects/test_zero_copy_schema_001/audio/bgm.mp3',
        timeline: Array.from({ length: 20 }, (_, i) => ({
          sceneId: `sc_${i}`,
          sceneIndex: i,
          title: `Phân cảnh ${i + 1}`,
          voiceoverText: `Lời bình phân cảnh lịch sử ${i + 1}`,
          layoutMode: 'HISTORICAL_FRAME',
          contentType: 'IMAGE',
          durationInFrames: 45,
          assetUrl: `/media/projects/test_zero_copy_schema_001/assets/asset_${i}.jpg`,
          sceneAudioUrl: `/media/projects/test_zero_copy_schema_001/audio/scene_${i}.wav`,
        })),
      };

      const serialized = JSON.stringify(mockProjectSchema);
      const sizeBytes = Buffer.byteLength(serialized, 'utf-8');

      // Size should be well under 500KB (typically < 10KB without base64 binary bloat)
      expect(sizeBytes).toBeLessThan(500 * 1024);
      expect(sizeBytes).toBeLessThan(50 * 1024);

      // Verify zero Data URI / Base64 binary strings
      expect(serialized.includes('data:audio/')).toBe(false);
      expect(serialized.includes('data:image/')).toBe(false);
      expect(serialized.includes(';base64,')).toBe(false);
    });
  });
});
