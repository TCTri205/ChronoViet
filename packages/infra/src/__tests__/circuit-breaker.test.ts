import { describe, it, expect, beforeEach } from 'vitest';
import {
  localLlmCircuit,
  cloudFallbackCircuit,
  embeddingCircuit,
  checkCircuitState,
  recordCircuitSuccess,
  recordCircuitFailure,
  checkCloudCircuitState,
  recordCloudCircuitSuccess,
  recordCloudCircuitFailure,
  checkEmbeddingCircuitState,
  recordEmbeddingCircuitSuccess,
  recordEmbeddingCircuitFailure,
  resetCircuitBreakers,
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_COOLDOWN_MS,
} from '../circuit-breaker.js';

describe('Circuit Breaker Module', () => {
  beforeEach(() => {
    resetCircuitBreakers();
  });

  describe('Local LLM Circuit Breaker', () => {
    it('should start in CLOSED state and ALLOW requests', () => {
      expect(localLlmCircuit.status).toBe('CLOSED');
      expect(localLlmCircuit.failures).toBe(0);
      expect(checkCircuitState()).toBe('ALLOW');
    });

    it('should transition to OPEN after threshold failures', () => {
      for (let i = 0; i < CIRCUIT_FAILURE_THRESHOLD; i++) {
        recordCircuitFailure(new Error('Connection refused'));
      }
      expect(localLlmCircuit.status).toBe('OPEN');
      expect(localLlmCircuit.failures).toBe(CIRCUIT_FAILURE_THRESHOLD);
      expect(checkCircuitState()).toBe('FAST_FAIL');
    });

    it('should transition to HALF_OPEN (PROBE) after cooldown expires', () => {
      for (let i = 0; i < CIRCUIT_FAILURE_THRESHOLD; i++) {
        recordCircuitFailure(new Error('Connection refused'));
      }
      expect(checkCircuitState()).toBe('FAST_FAIL');

      // Simulate cooldown expiry
      localLlmCircuit.nextProbeTime = Date.now() - 1000;
      expect(checkCircuitState()).toBe('PROBE');
      expect(localLlmCircuit.status).toBe('HALF_OPEN');
    });

    it('should close circuit on successful request', () => {
      recordCircuitFailure(new Error('Fail 1'));
      expect(localLlmCircuit.failures).toBe(1);

      recordCircuitSuccess();
      expect(localLlmCircuit.status).toBe('CLOSED');
      expect(localLlmCircuit.failures).toBe(0);
      expect(checkCircuitState()).toBe('ALLOW');
    });
  });

  describe('Cloud Fallback Circuit Breaker', () => {
    it('should start in CLOSED state and ALLOW requests', () => {
      expect(cloudFallbackCircuit.status).toBe('CLOSED');
      expect(cloudFallbackCircuit.failures).toBe(0);
      expect(checkCloudCircuitState()).toBe('ALLOW');
    });

    it('should transition to OPEN after threshold failures', () => {
      for (let i = 0; i < CIRCUIT_FAILURE_THRESHOLD; i++) {
        recordCloudCircuitFailure(new Error('HTTP 503 Service Unavailable'));
      }
      expect(cloudFallbackCircuit.status).toBe('OPEN');
      expect(cloudFallbackCircuit.failures).toBe(CIRCUIT_FAILURE_THRESHOLD);
      expect(checkCloudCircuitState()).toBe('FAST_FAIL');
    });

    it('should close cloud circuit on success', () => {
      recordCloudCircuitFailure(new Error('Transient Error'));
      expect(cloudFallbackCircuit.failures).toBe(1);

      recordCloudCircuitSuccess();
      expect(cloudFallbackCircuit.status).toBe('CLOSED');
      expect(cloudFallbackCircuit.failures).toBe(0);
      expect(checkCloudCircuitState()).toBe('ALLOW');
    });
  });

  describe('Embedding Service Circuit Breaker', () => {
    it('should start in CLOSED state and ALLOW requests', () => {
      expect(embeddingCircuit.status).toBe('CLOSED');
      expect(embeddingCircuit.failures).toBe(0);
      expect(checkEmbeddingCircuitState()).toBe('ALLOW');
    });

    it('should transition to OPEN after threshold failures', () => {
      for (let i = 0; i < CIRCUIT_FAILURE_THRESHOLD; i++) {
        recordEmbeddingCircuitFailure(new Error('Embedding server unreachable'));
      }
      expect(embeddingCircuit.status).toBe('OPEN');
      expect(embeddingCircuit.failures).toBe(CIRCUIT_FAILURE_THRESHOLD);
      expect(checkEmbeddingCircuitState()).toBe('FAST_FAIL');
    });

    it('should transition to HALF_OPEN (PROBE) after cooldown expires', () => {
      for (let i = 0; i < CIRCUIT_FAILURE_THRESHOLD; i++) {
        recordEmbeddingCircuitFailure(new Error('Embedding server unreachable'));
      }
      expect(checkEmbeddingCircuitState()).toBe('FAST_FAIL');

      // Simulate cooldown expiry
      embeddingCircuit.nextProbeTime = Date.now() - 1000;
      expect(checkEmbeddingCircuitState()).toBe('PROBE');
      expect(embeddingCircuit.status).toBe('HALF_OPEN');
    });

    it('should close embedding circuit on success', () => {
      recordEmbeddingCircuitFailure(new Error('Timeout'));
      expect(embeddingCircuit.failures).toBe(1);

      recordEmbeddingCircuitSuccess();
      expect(embeddingCircuit.status).toBe('CLOSED');
      expect(embeddingCircuit.failures).toBe(0);
      expect(checkEmbeddingCircuitState()).toBe('ALLOW');
    });
  });
});
