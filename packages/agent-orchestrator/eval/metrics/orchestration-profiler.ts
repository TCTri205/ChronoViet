/**
 * Orchestration Telemetry, Reflection & Checkpoint Profiler
 * Multi-Agent Orchestrator Evaluation Framework (ChronoAgent-Eval v2.0)
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

  startTimer(): () => number {
    const startTime = performance.now();
    return () => {
      const elapsedMs = performance.now() - startTime;
      this.record(elapsedMs);
      return elapsedMs;
    };
  }

  record(latencyMs: number): void {
    if (Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.measurements.push(latencyMs);
    }
  }

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
    const min = Math.min(...this.measurements);
    const max = Math.max(...this.measurements);
    const sum = this.measurements.reduce((acc, v) => acc + v, 0);
    const avg = sum / count;

    const variance =
      this.measurements.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
      p50_ms: Number(this.getPercentile(50).toFixed(2)),
      p90_ms: Number(this.getPercentile(90).toFixed(2)),
      p95_ms: Number(this.getPercentile(95).toFixed(2)),
      p99_ms: Number(this.getPercentile(99).toFixed(2)),
      avg_ms: Number(avg.toFixed(2)),
      min_ms: Number(min.toFixed(2)),
      max_ms: Number(max.toFixed(2)),
      stdDev_ms: Number(stdDev.toFixed(2)),
      count,
    };
  }

  reset(): void {
    this.measurements = [];
  }
}

export interface StateTransitionEvent {
  step: number;
  fromNode: string;
  toNode: string;
  timestamp: number;
  durationMs?: number;
  stateDeltaKeys?: string[];
}

export interface ReflectionCycleLog {
  nodeName: string;
  attemptCount: number;
  maxAllowedAttempts: number;
  reflectionTriggerReason: string;
  converged: boolean;
}

export interface OrchestrationExecutionProfile {
  totalDurationMs: number;
  totalSteps: number;
  transitions: StateTransitionEvent[];
  reflectionCycles: ReflectionCycleLog[];
  hasDeadlockOrExcessLoops: boolean;
  maxRetryObserved: number;
  isReflectionConverged: boolean;
  stepLatency: LatencySummary;
}

export class OrchestrationProfiler {
  private startTime: number = 0;
  private transitions: StateTransitionEvent[] = [];
  private reflectionLogs: ReflectionCycleLog[] = [];
  private latencyProfiler = new HighResolutionLatencyProfiler();

  startRun(): void {
    this.startTime = performance.now();
    this.transitions = [];
    this.reflectionLogs = [];
    this.latencyProfiler.reset();
  }

  recordTransition(event: Omit<StateTransitionEvent, 'timestamp'>): void {
    const timestamp = Date.now();
    this.transitions.push({
      ...event,
      timestamp,
    });
    if (event.durationMs !== undefined) {
      this.latencyProfiler.record(event.durationMs);
    }
  }

  recordReflection(log: ReflectionCycleLog): void {
    this.reflectionLogs.push(log);
  }

  evaluateExecution(): OrchestrationExecutionProfile {
    const totalDurationMs = performance.now() - this.startTime;
    let maxRetryObserved = 0;
    let hasDeadlockOrExcessLoops = false;

    // Count transitions per node pair to detect circular loops (> 3 repeated identical transitions)
    const transitionFreq: Record<string, number> = {};
    for (const t of this.transitions) {
      const key = `${t.fromNode}->${t.toNode}`;
      transitionFreq[key] = (transitionFreq[key] || 0) + 1;
      if (transitionFreq[key] > 4) {
        hasDeadlockOrExcessLoops = true;
      }
    }

    for (const r of this.reflectionLogs) {
      if (r.attemptCount > maxRetryObserved) {
        maxRetryObserved = r.attemptCount;
      }
      if (r.attemptCount > r.maxAllowedAttempts || !r.converged) {
        hasDeadlockOrExcessLoops = true;
      }
    }

    const isReflectionConverged = this.reflectionLogs.every((r) => r.converged && r.attemptCount <= 2);

    return {
      totalDurationMs: Number(totalDurationMs.toFixed(2)),
      totalSteps: this.transitions.length,
      transitions: [...this.transitions],
      reflectionCycles: [...this.reflectionLogs],
      hasDeadlockOrExcessLoops,
      maxRetryObserved,
      isReflectionConverged,
      stepLatency: this.latencyProfiler.getSummary(),
    };
  }
}

/**
 * Validates Checkpoint Resume Fidelity
 */
export function verifyCheckpointResumeFidelity(
  savedState: Record<string, any>,
  resumedState: Record<string, any>,
  criticalKeys: string[] = ['projectId', 'targetDurationMinutes', 'chapters', 'currentChapterIndex', 'scenes']
): {
  isFidelity100: boolean;
  mismatchedKeys: string[];
  preservedKeysCount: number;
  totalKeysChecked: number;
} {
  const mismatchedKeys: string[] = [];
  let preservedCount = 0;

  for (const key of criticalKeys) {
    const savedVal = JSON.stringify(savedState[key]);
    const resumedVal = JSON.stringify(resumedState[key]);

    if (savedVal === resumedVal) {
      preservedCount++;
    } else {
      mismatchedKeys.push(key);
    }
  }

  return {
    isFidelity100: mismatchedKeys.length === 0,
    mismatchedKeys,
    preservedKeysCount: preservedCount,
    totalKeysChecked: criticalKeys.length,
  };
}
