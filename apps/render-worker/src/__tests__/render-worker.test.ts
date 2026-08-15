import { describe, it, expect } from 'vitest';
import { QUEUE_NAMES } from '../queues/queue-manager.js';

describe('Render Worker App Unit Tests', () => {
  it('should define all required BullMQ queue names', () => {
    expect(QUEUE_NAMES.TTS_GEN).toBe('tts-gen-queue');
    expect(QUEUE_NAMES.VLM_INSPECT).toBe('vlm-inspect-queue');
    expect(QUEUE_NAMES.REMOTION_RENDER).toBe('remotion-render-queue');
  });
});
