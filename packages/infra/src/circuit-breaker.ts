/**
 * ChronoViet — LLM Gateway Circuit Breaker Module
 * Manages fault tolerance, fast-failing, and recovery probing for Local LLM and Cloud Fallbacks.
 */

import { createLogger } from './logger.js';
import {
  circuitBreakerGauge,
  circuitBreakerFailuresGauge,
} from './telemetry/metrics.js';

const log = createLogger({ service: 'circuit-breaker' });

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

export const embeddingCircuit: CircuitBreakerState = {
  status: 'CLOSED',
  failures: 0,
  lastFailureTime: 0,
  nextProbeTime: 0,
};

export const CIRCUIT_FAILURE_THRESHOLD = 2;
export const LOCAL_LLM_FAILURE_THRESHOLD = 5;
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
 * Checks if an error is a client-side payload or transient timeout error (e.g. 400 Bad Request, context overflow, 413, AbortError)
 * which should NOT trip the infrastructure circuit breaker or quarantine the LLM.
 */
export function isClientSidePayloadError(err?: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /\b(400|413|Bad Request|Payload Too Large|exceeds the available context size|context length|This operation was aborted|AbortError|TimeoutError|ETIMEDOUT)\b/i.test(msg) ||
    (err as any)?.status === 400 ||
    (err as any)?.status === 413
  );
}

/**
 * Records a failed Local LLM request, tripping the circuit if threshold exceeded.
 */
export function recordCircuitFailure(err?: unknown): void {
  if (isClientSidePayloadError(err)) {
    log.debug('llm.circuit_client_error_ignored', 'Client payload error (400/413/context length) bypassed circuit breaker trip');
    return;
  }
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
 * Checks the current state of the Embedding Service circuit breaker.
 */
export function checkEmbeddingCircuitState(): 'ALLOW' | 'PROBE' | 'FAST_FAIL' {
  if (embeddingCircuit.status === 'CLOSED') return 'ALLOW';
  const now = Date.now();
  if (now >= embeddingCircuit.nextProbeTime) {
    embeddingCircuit.status = 'HALF_OPEN';
    return 'PROBE';
  }
  return 'FAST_FAIL';
}

/**
 * Records a successful Embedding Service request to close/reset the circuit breaker.
 */
export function recordEmbeddingCircuitSuccess(): void {
  if (embeddingCircuit.status !== 'CLOSED') {
    log.info('embedding.circuit_recovered', 'Embedding Service recovered; circuit closed', {
      previousFailures: embeddingCircuit.failures,
    });
  }
  embeddingCircuit.status = 'CLOSED';
  embeddingCircuit.failures = 0;
  circuitBreakerGauge.set({ subsystem: 'embedding' }, 0);
  circuitBreakerFailuresGauge.set({ subsystem: 'embedding' }, 0);
}

/**
 * Records a failed Embedding Service request, tripping the circuit if threshold exceeded.
 */
export function recordEmbeddingCircuitFailure(err?: unknown): void {
  embeddingCircuit.failures += 1;
  embeddingCircuit.lastFailureTime = Date.now();
  circuitBreakerFailuresGauge.set({ subsystem: 'embedding' }, embeddingCircuit.failures);
  if (embeddingCircuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    embeddingCircuit.status = 'OPEN';
    embeddingCircuit.nextProbeTime = Date.now() + CIRCUIT_COOLDOWN_MS;
    circuitBreakerGauge.set({ subsystem: 'embedding' }, 1);
    log.warn('embedding.circuit_opened', 'Embedding Service circuit opened (cooldown 30s)', {
      failures: embeddingCircuit.failures,
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

  embeddingCircuit.status = 'CLOSED';
  embeddingCircuit.failures = 0;
  embeddingCircuit.lastFailureTime = 0;
  embeddingCircuit.nextProbeTime = 0;

  circuitBreakerGauge.set({ subsystem: 'llm_local' }, 0);
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_local' }, 0);
  circuitBreakerGauge.set({ subsystem: 'llm_cloud' }, 0);
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_cloud' }, 0);
  circuitBreakerGauge.set({ subsystem: 'embedding' }, 0);
  circuitBreakerFailuresGauge.set({ subsystem: 'embedding' }, 0);
}
