import { describe, it, expect } from 'vitest';
import { envConfig, getAiExecutionSummary } from '../config.js';

describe('AI_EXECUTION_MODE and Config Presets', () => {
  it('should expose valid AI_EXECUTION_MODE in envConfig', () => {
    expect(['local_only', 'fallback', 'hybrid', 'cloud_only']).toContain(envConfig.AI_EXECUTION_MODE);
  });

  it('should generate a valid structured AiExecutionSummary', () => {
    const summary = getAiExecutionSummary();
    expect(summary).toBeDefined();
    expect(['local_only', 'fallback', 'hybrid', 'cloud_only']).toContain(summary.mode);
    expect(typeof summary.useLocalLlm).toBe('boolean');
    expect(typeof summary.enableCloudFallback).toBe('boolean');
    expect(['hybrid_round_robin', 'priority_fallback', 'local_only']).toContain(summary.routingMode);
    expect(summary.localEndpoints).toBeDefined();
    expect(summary.localEndpoints.llm).toBeDefined();
    expect(summary.localEndpoints.embedding).toBeDefined();
    expect(summary.localEndpoints.extraction).toBeDefined();
    expect(summary.localEndpoints.rerank).toBeDefined();
    expect(Array.isArray(summary.cloudProvidersConfigured)).toBe(true);
  });
});
