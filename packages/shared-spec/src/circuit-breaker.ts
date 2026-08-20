/**
 * ChronoViet — LLM Gateway Circuit Breaker Module
 * Manages fault tolerance, fast-failing, and recovery probing for Local LLM and Cloud Fallbacks.
 */

import { createLogger } from './logger.js';
import {
  circuitBreakerGauge,
  circuitBreakerFailuresGauge,
} from './telemetry/metrics.js';

const log = createLogger({ service: 'shared-spec' });

export interface CircuitBreakerState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailureTime: number;
  nextProbeTime: number;
}

export const localLlmCircuit: CircuitBreakerState = {
  status: 'CLOSED',
  failures: 0,
  lastFailureTime: 0,
  nextProbeTime: 0,
};

export const cloudFallbackCircuit: CircuitBreakerState = {
  status: 'CLOSED',
  failures: 0,
  lastFailureTime: 0,
  nextProbeTime: 0,
};

export const CIRCUIT_FAILURE_THRESHOLD = 2;
export const CIRCUIT_COOLDOWN_MS = 30000;

/**
 * Checks the current state of the Local LLM circuit breaker.
 */
export function checkCircuitState(): 'ALLOW' | 'PROBE' | 'FAST_FAIL' {
  if (localLlmCircuit.status === 'CLOSED') return 'ALLOW';
  const now = Date.now();
  if (now >= localLlmCircuit.nextProbeTime) {
    localLlmCircuit.status = 'HALF_OPEN';
    return 'PROBE';
  }
  return 'FAST_FAIL';
}

/**
 * Records a successful Local LLM request to close/reset the circuit breaker.
 */
export function recordCircuitSuccess(): void {
  if (localLlmCircuit.status !== 'CLOSED') {
    log.info('llm.circuit_recovered', 'Local LLM Gateway recovered; circuit closed', {
      previousFailures: localLlmCircuit.failures,
    });
  }
  localLlmCircuit.status = 'CLOSED';
  localLlmCircuit.failures = 0;
  circuitBreakerGauge.set({ subsystem: 'llm_local' }, 0);
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_local' }, 0);
}

/**
 * Records a failed Local LLM request, tripping the circuit if threshold exceeded.
 */
export function recordCircuitFailure(err?: unknown): void {
  localLlmCircuit.failures += 1;
  localLlmCircuit.lastFailureTime = Date.now();
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_local' }, localLlmCircuit.failures);
  if (localLlmCircuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    localLlmCircuit.status = 'OPEN';
    localLlmCircuit.nextProbeTime = Date.now() + CIRCUIT_COOLDOWN_MS;
    circuitBreakerGauge.set({ subsystem: 'llm_local' }, 1);
    log.warn('llm.circuit_opened', 'Local LLM Gateway circuit opened (cooldown 30s)', {
      failures: localLlmCircuit.failures,
      cooldownMs: CIRCUIT_COOLDOWN_MS,
      error: err instanceof Error ? err.message : String(err || ''),
    });
  }
}

/**
 * Checks the current state of the Cloud Fallback circuit breaker.
 */
export function checkCloudCircuitState(): 'ALLOW' | 'PROBE' | 'FAST_FAIL' {
  if (cloudFallbackCircuit.status === 'CLOSED') return 'ALLOW';
  const now = Date.now();
  if (now >= cloudFallbackCircuit.nextProbeTime) {
    cloudFallbackCircuit.status = 'HALF_OPEN';
    return 'PROBE';
  }
  return 'FAST_FAIL';
}

/**
 * Records a successful Cloud Fallback request to close/reset the circuit breaker.
 */
export function recordCloudCircuitSuccess(): void {
  cloudFallbackCircuit.status = 'CLOSED';
  cloudFallbackCircuit.failures = 0;
  circuitBreakerGauge.set({ subsystem: 'llm_cloud' }, 0);
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_cloud' }, 0);
}

/**
 * Records a failed Cloud Fallback request, tripping the circuit if threshold exceeded.
 */
export function recordCloudCircuitFailure(err?: unknown): void {
  cloudFallbackCircuit.failures += 1;
  cloudFallbackCircuit.lastFailureTime = Date.now();
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_cloud' }, cloudFallbackCircuit.failures);
  if (cloudFallbackCircuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    cloudFallbackCircuit.status = 'OPEN';
    cloudFallbackCircuit.nextProbeTime = Date.now() + CIRCUIT_COOLDOWN_MS;
    circuitBreakerGauge.set({ subsystem: 'llm_cloud' }, 1);
    log.warn('llm.cloud_circuit_opened', 'Cloud Fallback circuit opened (cooldown 30s)', {
      failures: cloudFallbackCircuit.failures,
      cooldownMs: CIRCUIT_COOLDOWN_MS,
      error: err instanceof Error ? err.message : String(err || ''),
    });
  }
}

/**
 * Reset circuit breakers (primarily for unit testing and admin diagnostics).
 */
export function resetCircuitBreakers(): void {
  localLlmCircuit.status = 'CLOSED';
  localLlmCircuit.failures = 0;
  localLlmCircuit.lastFailureTime = 0;
  localLlmCircuit.nextProbeTime = 0;

  cloudFallbackCircuit.status = 'CLOSED';
  cloudFallbackCircuit.failures = 0;
  cloudFallbackCircuit.lastFailureTime = 0;
  cloudFallbackCircuit.nextProbeTime = 0;

  circuitBreakerGauge.set({ subsystem: 'llm_local' }, 0);
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_local' }, 0);
  circuitBreakerGauge.set({ subsystem: 'llm_cloud' }, 0);
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_cloud' }, 0);
}
