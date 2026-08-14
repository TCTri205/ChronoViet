/**
 * High-Resolution Latency Profiler for ChronoEval v2.0
 * Accurate microsecond-precision latency tracking with p50, p90, p95, p99 percentiles
 */

export interface LatencySummary {
  p50_ms: number;
  p90_ms: number;
  p95_ms: number;
  p99_ms: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  stdDev_ms: number;
  count: number;
}

export class HighResolutionLatencyProfiler {
  private measurements: number[] = [];

  /**
   * Starts a high-resolution timer and returns a stop function returning elapsed milliseconds
   */
  startTimer(): () => number {
    const startTime = performance.now();
    return () => {
      const elapsedMs = performance.now() - startTime;
      this.record(elapsedMs);
      return elapsedMs;
    };
  }

  /**
   * Records a latency measurement in milliseconds
   */
  record(latencyMs: number): void {
    if (Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.measurements.push(latencyMs);
    }
  }

  /**
   * Calculates specific percentile (0..100)
   */
  getPercentile(percentile: number): number {
    if (this.measurements.length === 0) return 0;
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sorted[lower];
    }
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Returns comprehensive latency summary
   */
  getSummary(): LatencySummary {
    if (this.measurements.length === 0) {
      return {
        p50_ms: 0,
        p90_ms: 0,
        p95_ms: 0,
        p99_ms: 0,
        avg_ms: 0,
        min_ms: 0,
        max_ms: 0,
        stdDev_ms: 0,
        count: 0,
      };
    }

    const count = this.measurements.length;
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const min_ms = sorted[0];
    const max_ms = sorted[sorted.length - 1];

    const sum = this.measurements.reduce((acc, v) => acc + v, 0);
    const avg_ms = sum / count;

    const sqDiffSum = this.measurements.reduce(
      (acc, v) => acc + Math.pow(v - avg_ms, 2),
      0
    );
    const stdDev_ms = Math.sqrt(sqDiffSum / count);

    return {
      p50_ms: Number(this.getPercentile(50).toFixed(2)),
      p90_ms: Number(this.getPercentile(90).toFixed(2)),
      p95_ms: Number(this.getPercentile(95).toFixed(2)),
      p99_ms: Number(this.getPercentile(99).toFixed(2)),
      avg_ms: Number(avg_ms.toFixed(2)),
      min_ms: Number(min_ms.toFixed(2)),
      max_ms: Number(max_ms.toFixed(2)),
      stdDev_ms: Number(stdDev_ms.toFixed(2)),
      count,
    };
  }

  /**
   * Resets all recorded measurements
   */
  reset(): void {
    this.measurements = [];
  }
}
