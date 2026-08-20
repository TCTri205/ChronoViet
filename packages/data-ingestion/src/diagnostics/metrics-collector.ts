import crypto from 'crypto';
import { IngestionExecutionTelemetry, StageDurationBreakdown } from '@chronoviet/shared-spec';

export type IngestionStage = 'chunking' | 'extraction' | 'embedding' | 'dbInsert';

export class IngestionMetricsCollector {
  public readonly correlationId: string;
  private stageStartTimes: Map<IngestionStage, number> = new Map();
  private stageDurations: Record<IngestionStage, number> = {
    chunking: 0,
    extraction: 0,
    embedding: 0,
    dbInsert: 0,
  };

  private totalChunks = 0;
  private totalWords = 0;
  private totalVectors = 0;
  private totalVectorDurationMs = 0;

  private cacheHits = 0;
  private cacheMisses = 0;

  private quarantinedCount = 0;
  private quarantineReasons: Record<string, number> = {};

  private overallStartTime: number;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || `ingest-${crypto.randomUUID().slice(0, 8)}`;
    this.overallStartTime = Date.now();
  }

  public startStage(stage: IngestionStage): void {
    this.stageStartTimes.set(stage, Date.now());
  }

  public endStage(stage: IngestionStage): number {
    const start = this.stageStartTimes.get(stage);
    if (!start) return 0;
    const duration = Date.now() - start;
    this.stageDurations[stage] = (this.stageDurations[stage] || 0) + duration;
    this.stageStartTimes.delete(stage);
    return duration;
  }

  public recordChunk(wordCount: number): void {
    this.totalChunks += 1;
    this.totalWords += Math.max(0, wordCount);
  }

  public recordVectors(count: number, durationMs: number): void {
    this.totalVectors += count;
    this.totalVectorDurationMs += Math.max(0, durationMs);
  }

  public recordCache(hit: boolean): void {
    if (hit) {
      this.cacheHits += 1;
    } else {
      this.cacheMisses += 1;
    }
  }

  public recordQuarantine(reason: string): void {
    this.quarantinedCount += 1;
    const normalizedReason = reason || 'UNKNOWN';
    this.quarantineReasons[normalizedReason] = (this.quarantineReasons[normalizedReason] || 0) + 1;
  }

  public getTelemetryReport(totalDurationMs?: number): IngestionExecutionTelemetry {
    const elapsedTotal = totalDurationMs ?? Math.max(1, Date.now() - this.overallStartTime);
    const totalSeconds = elapsedTotal / 1000 || 0.001;

    const breakdown: StageDurationBreakdown = {
      chunkingMs: this.stageDurations.chunking,
      extractionMs: this.stageDurations.extraction,
      embeddingMs: this.stageDurations.embedding,
      dbInsertMs: this.stageDurations.dbInsert,
      totalDurationMs: elapsedTotal,
    };

    const totalCacheQueries = this.cacheHits + this.cacheMisses;
    const hitRate = totalCacheQueries > 0 ? Number((this.cacheHits / totalCacheQueries).toFixed(4)) : 0;

    const embeddingSec = (this.stageDurations.embedding || this.totalVectorDurationMs) / 1000 || 0.001;
    const vectorsPerSec = this.totalVectors > 0 ? Number((this.totalVectors / embeddingSec).toFixed(2)) : 0;

    return {
      correlationId: this.correlationId,
      durations: breakdown,
      throughput: {
        chunksPerSec: Number((this.totalChunks / totalSeconds).toFixed(2)),
        wordsPerSec: Number((this.totalWords / totalSeconds).toFixed(2)),
        vectorsPerSec,
      },
      cacheStats: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate,
      },
      quarantineStats: {
        totalQuarantined: this.quarantinedCount,
        reasons: { ...this.quarantineReasons },
      },
    };
  }
}
