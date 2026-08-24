import { describe, it, expect } from 'vitest';
import {
  HighResolutionLatencyProfiler,
  OrchestrationProfiler,
  verifyCheckpointResumeFidelity,
} from '../orchestration-profiler.js';

describe('Orchestration Profiler Unit Tests', () => {
  describe('HighResolutionLatencyProfiler', () => {
    it('calculates p50, p90, p95, p99 and statistics correctly', () => {
      const profiler = new HighResolutionLatencyProfiler();
      for (let i = 1; i <= 100; i++) {
        profiler.record(i * 10); // 10ms to 1000ms
      }
      const summary = profiler.getSummary();
      expect(summary.count).toBe(100);
      expect(summary.min_ms).toBe(10);
      expect(summary.max_ms).toBe(1000);
      expect(summary.avg_ms).toBe(505);
      expect(summary.p50_ms).toBe(505);
      expect(summary.p90_ms).toBe(901);
      expect(summary.p95_ms).toBe(950.5);
    });

    it('returns zeroes on empty records', () => {
      const profiler = new HighResolutionLatencyProfiler();
      const summary = profiler.getSummary();
      expect(summary.count).toBe(0);
      expect(summary.p50_ms).toBe(0);
    });
  });

  describe('OrchestrationProfiler', () => {
    it('tracks state graph transitions and reflection cycles', () => {
      const profiler = new OrchestrationProfiler();
      profiler.startRun();

      profiler.recordTransition({
        step: 1,
        fromNode: 'START',
        toNode: 'chapteringNode',
        durationMs: 120,
      });
      profiler.recordTransition({
        step: 2,
        fromNode: 'chapteringNode',
        toNode: 'scriptwriterNode',
        durationMs: 340,
      });

      profiler.recordReflection({
        nodeName: 'fact-checker-node',
        attemptCount: 1,
        maxAllowedAttempts: 2,
        reflectionTriggerReason: 'Minor alias inconsistency',
        converged: true,
      });

      const profile = profiler.evaluateExecution();
      expect(profile.totalSteps).toBe(2);
      expect(profile.isReflectionConverged).toBe(true);
      expect(profile.hasDeadlockOrExcessLoops).toBe(false);
      expect(profile.maxRetryObserved).toBe(1);
    });

    it('detects excess retry loops or non-convergent reflections', () => {
      const profiler = new OrchestrationProfiler();
      profiler.startRun();

      profiler.recordReflection({
        nodeName: 'scriptwriter-node',
        attemptCount: 3, // Exceeds 2
        maxAllowedAttempts: 2,
        reflectionTriggerReason: 'Severe hallucination loop',
        converged: false,
      });

      const profile = profiler.evaluateExecution();
      expect(profile.hasDeadlockOrExcessLoops).toBe(true);
      expect(profile.isReflectionConverged).toBe(false);
    });
  });

  describe('verifyCheckpointResumeFidelity', () => {
    it('verifies 100% fidelity on identical restored state', () => {
      const saved = {
        projectId: 'proj_123',
        targetDurationMinutes: 3,
        chapters: [{ title: 'Chapter 1' }],
        currentChapterIndex: 0,
        scenes: [{ id: 's1' }],
      };
      const resumed = { ...saved };

      const res = verifyCheckpointResumeFidelity(saved, resumed);
      expect(res.isFidelity100).toBe(true);
      expect(res.mismatchedKeys).toHaveLength(0);
      expect(res.preservedKeysCount).toBe(5);
    });

    it('identifies corrupted or missing state keys after resume', () => {
      const saved = {
        projectId: 'proj_123',
        targetDurationMinutes: 3,
        chapters: [{ title: 'Chapter 1' }],
        currentChapterIndex: 0,
        scenes: [{ id: 's1' }],
      };
      const corruptedResumed = {
        ...saved,
        scenes: [{ id: 'corrupted' }],
      };

      const res = verifyCheckpointResumeFidelity(saved, corruptedResumed);
      expect(res.isFidelity100).toBe(false);
      expect(res.mismatchedKeys).toEqual(['scenes']);
    });
  });
});
