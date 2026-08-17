import { describe, it, expect } from 'vitest';
import { logFallbackAlert, formatErrorMessage, serializeError } from '../logger.js';

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

describe('formatErrorMessage and serializeError', () => {
  it('formats AggregateError without empty messages', () => {
    const err1 = new Error('connect ECONNREFUSED ::1:6379');
    (err1 as any).code = 'ECONNREFUSED';
    const err2 = new Error('connect ECONNREFUSED 127.0.0.1:6379');
    (err2 as any).code = 'ECONNREFUSED';
    const aggErr = new AggregateError([err1, err2], '');
    (aggErr as any).code = 'ECONNREFUSED';

    const formatted = formatErrorMessage(aggErr);
    expect(formatted).toContain('ECONNREFUSED');
    expect(formatted).toContain('connect ECONNREFUSED');

    const serialized = serializeError(aggErr) as Record<string, unknown>;
    expect(serialized.name).toBe('AggregateError');
    expect(serialized.message).toBeTruthy();
    expect(serialized.code).toBe('ECONNREFUSED');
    expect(Array.isArray(serialized.errors)).toBe(true);
  });

  it('formats standard error and error with code', () => {
    const stdErr = new Error('Simple error');
    expect(formatErrorMessage(stdErr)).toBe('Simple error');

    const codeErr = new Error();
    (codeErr as any).code = 'ECONNREFUSED';
    expect(formatErrorMessage(codeErr)).toBe('Error [ECONNREFUSED]');
  });
});

