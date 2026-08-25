import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAdaptiveConcurrency,
  setCustomMemoryForTesting,
  setCustomRoutingModeForTesting,
  resetConcurrencyTunerForTesting,
} from '../config/concurrency-tuner.js';

describe('Adaptive Concurrency Tuner Unit Tests', () => {
  beforeEach(() => {
    resetConcurrencyTunerForTesting();
  });

  describe('Cloud Inference Routing Mode', () => {
    it('returns high I/O throughput batch sizes in cloud mode', () => {
      setCustomRoutingModeForTesting('cloud');

      expect(getAdaptiveConcurrency('CRAWL')).toBe(8);
      expect(getAdaptiveConcurrency('TTS')).toBe(6);
      expect(getAdaptiveConcurrency('VLM')).toBe(6);
    });
  });

  describe('Local Inference Mode with Different Memory Capacities', () => {
    it('throttles to 1-2 concurrency on low memory machines (< 16GB RAM)', () => {
      setCustomRoutingModeForTesting('local');
      setCustomMemoryForTesting(8 * 1024 * 1024 * 1024); // 8 GB

      expect(getAdaptiveConcurrency('TTS')).toBe(1);
      expect(getAdaptiveConcurrency('VLM')).toBe(1);
      expect(getAdaptiveConcurrency('CRAWL')).toBe(2);
    });

    it('sets safe moderate concurrency on medium memory machines (16GB - 31GB RAM)', () => {
      setCustomRoutingModeForTesting('local');
      setCustomMemoryForTesting(16 * 1024 * 1024 * 1024); // 16 GB

      expect(getAdaptiveConcurrency('TTS')).toBe(2);
      expect(getAdaptiveConcurrency('VLM')).toBe(2);
      expect(getAdaptiveConcurrency('CRAWL')).toBe(4);
    });

    it('sets high safe concurrency on high memory machines (>= 32GB Unified Memory)', () => {
      setCustomRoutingModeForTesting('local');
      setCustomMemoryForTesting(32 * 1024 * 1024 * 1024); // 32 GB

      expect(getAdaptiveConcurrency('TTS')).toBe(4);
      expect(getAdaptiveConcurrency('VLM')).toBe(4);
      expect(getAdaptiveConcurrency('CRAWL')).toBe(6);
    });

    it('handles 64GB / 128GB high-end workstations cleanly', () => {
      setCustomRoutingModeForTesting('local');
      setCustomMemoryForTesting(64 * 1024 * 1024 * 1024); // 64 GB

      expect(getAdaptiveConcurrency('TTS')).toBe(4);
      expect(getAdaptiveConcurrency('VLM')).toBe(4);
      expect(getAdaptiveConcurrency('CRAWL')).toBe(6);
    });
  });
});
