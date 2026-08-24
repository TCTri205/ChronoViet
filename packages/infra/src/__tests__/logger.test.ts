import { describe, it, expect, vi } from 'vitest';
import {
  logFallbackAlert,
  resetFallbackAlertThrottle,
  formatErrorMessage,
  serializeError,
  createLogger,
  sanitizePayload,
  truncateSnippet,
} from '../logger.js';

describe('Fallback Alert Observability Logger Test', () => {
  it('correctly emits standardized fallback alert and throttles duplicates', () => {
    resetFallbackAlertThrottle();
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logFallbackAlert({
      subsystem: 'LLM_GATEWAY',
      primaryTarget: 'Local LLM (http://localhost:8080) [qwen3.8-27b-instruct-q4_k_m]',
      fallbackTarget: 'Agnes 2.5 Flash Cloud API [agnes-2.5-flash]',
      reason: 'Connection refused at http://localhost:8080/v1/chat/completions',
      actionRequired: 'Check if llama-server is running on port 8080',
    });

    expect(stderrSpy).toHaveBeenCalledTimes(1);

    // Immediate second call with same subsystem and reason must be throttled
    logFallbackAlert({
      subsystem: 'LLM_GATEWAY',
      primaryTarget: 'Local LLM (http://localhost:8080) [qwen3.8-27b-instruct-q4_k_m]',
      fallbackTarget: 'Agnes 2.5 Flash Cloud API [agnes-2.5-flash]',
      reason: 'Connection refused at http://localhost:8080/v1/chat/completions',
      actionRequired: 'Check if llama-server is running on port 8080',
    });

    expect(stderrSpy).toHaveBeenCalledTimes(1);

    stderrSpy.mockRestore();
  });

  it('redacts secret keys, preserves metric fields, and truncates long snippets', () => {
    const sanitized = sanitizePayload({
      apiKey: 'sk-1234567890',
      password: 'supersecretpassword',
      token: 'jwt-token',
      tokenLength: 1024,
      totalTokens: 50,
      normalField: 'hello',
    }) as any;

    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.tokenLength).toBe(1024);
    expect(sanitized.totalTokens).toBe(50);
    expect(sanitized.normalField).toBe('hello');

    const longStr = 'a'.repeat(100);
    const snippet = truncateSnippet(longStr, 20);
    expect(snippet).toContain('...[truncated 80 chars]');
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

