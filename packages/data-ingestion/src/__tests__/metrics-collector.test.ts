import { describe, it, expect } from 'vitest';
import { IngestionMetricsCollector } from '../diagnostics/metrics-collector.js';

describe('IngestionMetricsCollector Unit Tests', () => {
  it('should initialize with custom or generated correlationId', () => {
    const collector1 = new IngestionMetricsCollector('custom-corr-id-999');
    expect(collector1.correlationId).toBe('custom-corr-id-999');

    const collector2 = new IngestionMetricsCollector();
    expect(collector2.correlationId).toMatch(/^ingest-/);
  });

  it('should measure stage durations accurately', async () => {
    const collector = new IngestionMetricsCollector('test-corr-id');

    collector.startStage('chunking');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const duration = collector.endStage('chunking');

    expect(duration).toBeGreaterThanOrEqual(15);

    const report = collector.getTelemetryReport();
    expect(report.durations.chunkingMs).toBeGreaterThanOrEqual(15);
    expect(report.durations.extractionMs).toBe(0);
    expect(report.durations.totalDurationMs).toBeGreaterThan(0);
  });

  it('should calculate throughput, cache ratio and quarantine breakdown', () => {
    const collector = new IngestionMetricsCollector('test-corr-id-2');

    // Chunks & words
    collector.recordChunk(350);
    collector.recordChunk(450);

    // Cache hits & misses
    collector.recordCache(true);
    collector.recordCache(true);
    collector.recordCache(false);

    // Quarantine reasons
    collector.recordQuarantine('LOW_CONFIDENCE');
    collector.recordQuarantine('LOW_CONFIDENCE');
    collector.recordQuarantine('DANGLING_RELATION');

    // Vectors
    collector.recordVectors(64, 200);

    const report = collector.getTelemetryReport(1000); // simulate 1s total

    expect(report.correlationId).toBe('test-corr-id-2');
    expect(report.cacheStats.hits).toBe(2);
    expect(report.cacheStats.misses).toBe(1);
    expect(report.cacheStats.hitRate).toBe(0.6667);

    expect(report.quarantineStats.totalQuarantined).toBe(3);
    expect(report.quarantineStats.reasons['LOW_CONFIDENCE']).toBe(2);
    expect(report.quarantineStats.reasons['DANGLING_RELATION']).toBe(1);

    expect(report.throughput.chunksPerSec).toBe(2);
    expect(report.throughput.wordsPerSec).toBe(800);
    expect(report.throughput.vectorsPerSec).toBe(320);
  });
});
