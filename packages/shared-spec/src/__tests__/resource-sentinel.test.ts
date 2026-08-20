import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResourceSentinel, MemoryStatus } from '../resource-sentinel.js';
import { envConfig } from '../config.js';
import * as os from 'os';

describe('ResourceSentinel & Memory / Render Coordination Suite', () => {
  beforeEach(async () => {
    ResourceSentinel.resetForTesting();
    ResourceSentinel.setCacheDebounceMs(3000);
    await ResourceSentinel.releaseRenderLock();
  });

  afterEach(async () => {
    await ResourceSentinel.releaseRenderLock();
    ResourceSentinel.resetForTesting();
    vi.restoreAllMocks();
  });

  describe('1. Memory Monitoring & Debounce Cache', () => {
    it('should return valid memory status structure', () => {
      const status = ResourceSentinel.getMemoryStatus();
      expect(status.totalMemoryMb).toBeGreaterThan(0);
      expect(status.freeMemoryMb).toBeGreaterThan(0);
      expect(status.usedMemoryMb).toBeGreaterThanOrEqual(0);
      expect(status.usedMemoryPercent).toBeGreaterThanOrEqual(0);
      expect(status.usedMemoryPercent).toBeLessThanOrEqual(100);
      expect(typeof status.isUnderPressure).toBe('boolean');
      expect(status.cached).toBe(false);
      expect(status.timestamp).toBeGreaterThan(0);
    });

    it('should debounce memory status calls within the debounce window', () => {
      const first = ResourceSentinel.getMemoryStatus();
      expect(first.cached).toBe(false);

      const second = ResourceSentinel.getMemoryStatus();
      expect(second.cached).toBe(true);
      expect(second.timestamp).toBe(first.timestamp);

      const forceFresh = ResourceSentinel.getMemoryStatus(true);
      expect(forceFresh.cached).toBe(false);
    });

    it('should accurately detect memory pressure when exceeding threshold', () => {
      // Simulate 90% memory usage
      ResourceSentinel.setMemoryProvider(() => ({
        totalBytes: 16 * 1024 * 1024 * 1024,
        freeBytes: 1.6 * 1024 * 1024 * 1024,
      }));

      const status = ResourceSentinel.getMemoryStatus(true);
      expect(status.usedMemoryPercent).toBe(90);
      expect(status.isUnderPressure).toBe(true);
    });

    it('should report no memory pressure when under threshold', () => {
      // Simulate 50% memory usage
      ResourceSentinel.setMemoryProvider(() => ({
        totalBytes: 16 * 1024 * 1024 * 1024,
        freeBytes: 8 * 1024 * 1024 * 1024,
      }));

      const status = ResourceSentinel.getMemoryStatus(true);
      expect(status.usedMemoryPercent).toBe(50);
      expect(status.isUnderPressure).toBe(false);
    });
  });

  describe('2. Distributed & In-Memory Render Mutex Lock', () => {
    it('should acquire and release render lock cleanly', async () => {
      const initialLocked = await ResourceSentinel.isRenderLocked();
      expect(initialLocked).toBe(false);

      const acquired = await ResourceSentinel.acquireRenderLock(60, 'test_job_1');
      expect(acquired).toBe(true);

      const lockedAfter = await ResourceSentinel.isRenderLocked();
      expect(lockedAfter).toBe(true);

      // Second acquire attempt should fail while lock is held
      const duplicateAcquire = await ResourceSentinel.acquireRenderLock(60, 'test_job_2');
      expect(duplicateAcquire).toBe(false);

      // Release lock
      const released = await ResourceSentinel.releaseRenderLock('test_job_1');
      expect(released).toBe(true);

      const lockedFinal = await ResourceSentinel.isRenderLocked();
      expect(lockedFinal).toBe(false);
    });

    it('should handle lock TTL expiration in memory fallback', async () => {
      // Acquire lock with 0.1 second TTL (100ms)
      const acquired = await ResourceSentinel.acquireRenderLock(0.1, 'quick_job');
      expect(acquired).toBe(true);
      expect(await ResourceSentinel.isRenderLocked()).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      const isLocked = await ResourceSentinel.isRenderLocked();
      expect(isLocked).toBe(false);

      // Should be able to acquire again
      const reAcquired = await ResourceSentinel.acquireRenderLock(60, 'new_job');
      expect(reAcquired).toBe(true);
      await ResourceSentinel.releaseRenderLock('new_job');
    });

    it('should reject release when mismatched holder ID is provided for non-expired lock', async () => {
      await ResourceSentinel.acquireRenderLock(60, 'owner_a');

      // Attempt release by another holder
      const wrongRelease = await ResourceSentinel.releaseRenderLock('owner_b');
      expect(wrongRelease).toBe(false);
      expect(await ResourceSentinel.isRenderLocked()).toBe(true);

      // Correct holder releases
      const correctRelease = await ResourceSentinel.releaseRenderLock('owner_a');
      expect(correctRelease).toBe(true);
      expect(await ResourceSentinel.isRenderLocked()).toBe(false);
    });
  });

  describe('3. Dynamic Cloud Offload Decision', () => {
    it('should recommend cloud offload when render lock is active and standby is enabled', async () => {
      await ResourceSentinel.acquireRenderLock(60, 'render_pipeline_1');

      const decision = await ResourceSentinel.shouldOffloadToCloud();
      expect(decision.shouldOffload).toBe(true);
      expect(decision.reason).toContain('Render mutex is active');

      await ResourceSentinel.releaseRenderLock('render_pipeline_1');
    });

    it('should recommend cloud offload when host memory is under pressure', async () => {
      ResourceSentinel.setMemoryProvider(() => ({
        totalBytes: 16 * 1024 * 1024 * 1024,
        freeBytes: 1 * 1024 * 1024 * 1024, // ~93.75% used
      }));

      const decision = await ResourceSentinel.shouldOffloadToCloud();
      expect(decision.shouldOffload).toBe(true);
      expect(decision.reason).toContain('Host memory under pressure');
    });

    it('should not recommend offload under healthy conditions without render lock', async () => {
      ResourceSentinel.setMemoryProvider(() => ({
        totalBytes: 16 * 1024 * 1024 * 1024,
        freeBytes: 10 * 1024 * 1024 * 1024, // ~37.5% used
      }));

      const decision = await ResourceSentinel.shouldOffloadToCloud();
      expect(decision.shouldOffload).toBe(false);
      expect(decision.reason).toBeUndefined();
    });
  });
});
