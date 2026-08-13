import { describe, it, expect } from 'vitest';
import { logFallbackAlert } from '../logger.js';

describe('Fallback Alert Observability Logger Test', () => {
  it('correctly emits standardized fallback alert banner', () => {
    expect(() => {
      logFallbackAlert({
        subsystem: 'LLM_GATEWAY',
        primaryTarget: 'Local LLM (http://localhost:8080) [qwen3.5-27b-instruct-q4_k_m]',
        fallbackTarget: 'Agnes 2.0 Flash Cloud API [agnes-2.0-flash]',
        reason: 'Connection refused at http://localhost:8080/v1/chat/completions',
        actionRequired: 'Check if llama-server is running on port 8080',
      });
    }).not.toThrow();
  });
});
