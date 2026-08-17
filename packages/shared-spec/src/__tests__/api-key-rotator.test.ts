import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ApiKeyRotator,
  parseAndSanitizeApiKeys,
  maskApiKey,
  isViableApiKey,
  executeWithKeyRotation,
  getApiKeyRotator,
  hybridInferenceDispatcher,
  HybridInferenceDispatcher,
  InferenceTarget,
} from '../api-key-rotator.js';

describe('ApiKeyRotator & Key Pool Engine', () => {
  describe('isViableApiKey & parseAndSanitizeApiKeys', () => {
    it('should correctly identify viable and invalid dummy keys', () => {
      expect(isViableApiKey('')).toBe(false);
      expect(isViableApiKey('123')).toBe(false);
      expect(isViableApiKey('sk-...')).toBe(false);
      expect(isViableApiKey('tvly...')).toBe(false);
      expect(isViableApiKey('AQ...')).toBe(false);
      expect(isViableApiKey('sk-your_api_key_here')).toBe(false);
      expect(isViableApiKey('example_key_12345')).toBe(false);
      expect(isViableApiKey('sk-real-valid-key-001')).toBe(true);
      expect(isViableApiKey('tvly-abcdef123456')).toBe(true);
      expect(isViableApiKey('AQAI_abcdefgh1234')).toBe(true);
    });

    it('should parse, trim, deduplicate and sanitize comma/semicolon/newline separated keys', () => {
      const raw = 'sk-key1, sk-key2 ; sk-key3\nsk-key1, sk-...,  tvly... , sk-key4 ';
      const parsed = parseAndSanitizeApiKeys(raw);
      expect(parsed).toEqual(['sk-key1', 'sk-key2', 'sk-key3', 'sk-key4']);
    });

    it('should handle array inputs', () => {
      const raw = ['sk-alpha123', 'sk-...', 'sk-beta456', 'sk-alpha123'];
      const parsed = parseAndSanitizeApiKeys(raw);
      expect(parsed).toEqual(['sk-alpha123', 'sk-beta456']);
    });
  });

  describe('maskApiKey', () => {
    it('should safely mask keys without leaking secrets', () => {
      expect(maskApiKey(null)).toBe('<empty>');
      expect(maskApiKey('')).toBe('<empty>');
      expect(maskApiKey('short')).toBe('***');
      expect(maskApiKey('sk-abcdef1234567890')).toBe('sk-***7890');
      expect(maskApiKey('tvly-secretkey9999')).toBe('tvly-***9999');
      expect(maskApiKey('AQAI_geminikey1234')).toBe('AQ***1234');
      expect(maskApiKey('customkey987654321')).toBe('cus***4321');
    });
  });

  describe('Exact Round-Robin Distribution', () => {
    it('should cycle through keys in exact round-robin sequence', () => {
      const rotator = new ApiKeyRotator('test_provider', 'sk-111111, sk-222222, sk-333333');
      expect(rotator.totalKeysCount).toBe(3);

      expect(rotator.getNextKey()).toBe('sk-111111');
      expect(rotator.getNextKey()).toBe('sk-222222');
      expect(rotator.getNextKey()).toBe('sk-333333');
      expect(rotator.getNextKey()).toBe('sk-111111');
      expect(rotator.getNextKey()).toBe('sk-222222');
    });

    it('should return undefined when no keys are available', () => {
      const rotator = new ApiKeyRotator('empty_provider', '');
      expect(rotator.getNextKey()).toBeUndefined();
      expect(rotator.hasAvailableKeys()).toBe(false);
    });
  });

  describe('Health Tracking, 24h Quarantine & Auto-Recovery', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should quarantine key for 24 HOURS (1 day) on 429 rate limit / quota exhaustion', () => {
      const rotator = new ApiKeyRotator('rate_limit_24h_test', ['sk-key111', 'sk-key222', 'sk-key333']);

      // 1. First key fails with 429
      rotator.reportFailure('sk-key111', { status: 429, message: 'Too Many Requests / Daily Quota' });

      // Active keys should now only be key2 and key3
      expect(rotator.getActiveKeys()).toEqual(['sk-key222', 'sk-key333']);

      // Next keys returned should alternate between key2 and key3 only
      expect(rotator.getNextKey()).toBe('sk-key222');
      expect(rotator.getNextKey()).toBe('sk-key333');
      expect(rotator.getNextKey()).toBe('sk-key222');

      // After 1 hour, key1 is still quarantined
      vi.advanceTimersByTime(3600 * 1000);
      expect(rotator.getActiveKeys()).toEqual(['sk-key222', 'sk-key333']);

      // Fast-forward time past 24 hours (86,400,001 ms)
      vi.advanceTimersByTime(86400000 - 3600000 + 1000);

      // key1 should now be fully recovered and restored to active pool
      expect(rotator.getActiveKeys()).toContain('sk-key111');
      expect(rotator.getActiveKeys().length).toBe(3);
    });

    it('should quarantine key for 24 HOURS (1 day) on 401/403 auth error', () => {
      const rotator = new ApiKeyRotator('quota_test', ['sk-key111', 'sk-key222']);

      rotator.reportFailure('sk-key111', { status: 401, message: 'Unauthorized / Quota Exceeded' });

      expect(rotator.getActiveKeys()).toEqual(['sk-key222']);

      // After 12 hours, still quarantined
      vi.advanceTimersByTime(12 * 3600 * 1000);
      expect(rotator.getActiveKeys()).toEqual(['sk-key222']);

      // After 24.1 hours, recovered
      vi.advanceTimersByTime(12.1 * 3600 * 1000);
      expect(rotator.getActiveKeys()).toContain('sk-key111');
    });

    it('should gracefully fallback to earliest recovering key when all keys are in cooldown', () => {
      const rotator = new ApiKeyRotator('all_quarantined_test', ['sk-key111', 'sk-key222']);

      rotator.reportFailure('sk-key111', 429);
      // Wait 1 second before failing key 2
      vi.advanceTimersByTime(1000);
      rotator.reportFailure('sk-key222', 401);

      expect(rotator.getActiveKeys()).toEqual([]);

      // Should return key111 because its cooldown expires first
      const fallbackKey = rotator.getNextKey();
      expect(fallbackKey).toBe('sk-key111');
    });
  });

  describe('executeWithKeyRotation (In-flight Failover)', () => {
    it('should succeed on first try with valid key', async () => {
      const rotator = getApiKeyRotator('exec_test_1');
      rotator.setKeys(['sk-valid-key-01', 'sk-valid-key-02']);

      const res = await executeWithKeyRotation('exec_test_1', async (key) => {
        return `SUCCESS_WITH_${key}`;
      });

      expect(res).toBe('SUCCESS_WITH_sk-valid-key-01');
    });

    it('should auto-retry and failover to next key when the first key throws 429', async () => {
      const rotator = getApiKeyRotator('exec_test_2');
      rotator.setKeys(['sk-failing-key', 'sk-working-key']);

      let callCount = 0;
      const res = await executeWithKeyRotation('exec_test_2', async (key) => {
        callCount++;
        if (key === 'sk-failing-key') {
          const err = new Error('Rate limit 429');
          (err as any).status = 429;
          throw err;
        }
        return `DATA_FROM_${key}`;
      });

      expect(callCount).toBe(2);
      expect(res).toBe('DATA_FROM_sk-working-key');

      // The failing key should now be in 24h cooldown
      expect(rotator.getActiveKeys()).toEqual(['sk-working-key']);
    });

    it('should throw error when all available keys fail', async () => {
      const rotator = getApiKeyRotator('exec_test_3');
      rotator.setKeys(['sk-bad-1', 'sk-bad-2']);

      await expect(
        executeWithKeyRotation('exec_test_3', async (key) => {
          throw new Error(`Failed with ${key}`);
        })
      ).rejects.toThrow('Failed with sk-bad-2');
    });
  });

  describe('HybridInferenceDispatcher (Unified Local + Cloud Rotation)', () => {
    it('should rotate exactly across Local and Cloud targets', async () => {
      const dispatcher = new HybridInferenceDispatcher();
      const mockTargets: InferenceTarget[] = [
        { id: 'local:llama', type: 'local', provider: 'local', model: 'qwen3.8', baseUrl: 'http://localhost:8091' },
        { id: 'cloud:agnes:k1', type: 'cloud', provider: 'agnes', model: 'agnes-2.5', baseUrl: 'https://apihub.agnes-ai.com/v1', apiKey: 'sk-agnes-1' },
        { id: 'cloud:gemini:k1', type: 'cloud', provider: 'gemini', model: 'gemini-2.5', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'AQ-gemini-1' },
      ];

      vi.spyOn(dispatcher, 'getInferenceTargets').mockReturnValue(mockTargets);

      expect(dispatcher.getNextTarget('llm')?.id).toBe('local:llama');
      expect(dispatcher.getNextTarget('llm')?.id).toBe('cloud:agnes:k1');
      expect(dispatcher.getNextTarget('llm')?.id).toBe('cloud:gemini:k1');
      expect(dispatcher.getNextTarget('llm')?.id).toBe('local:llama');
    });

    it('should failover from Local to Cloud when Local model fails', async () => {
      const dispatcher = new HybridInferenceDispatcher();
      const mockTargets: InferenceTarget[] = [
        { id: 'local:llama', type: 'local', provider: 'local', model: 'qwen3.8', baseUrl: 'http://localhost:8091' },
        { id: 'cloud:agnes:k1', type: 'cloud', provider: 'agnes', model: 'agnes-2.5', baseUrl: 'https://apihub.agnes-ai.com/v1', apiKey: 'sk-agnes-1' },
      ];

      vi.spyOn(dispatcher, 'getInferenceTargets').mockReturnValue(mockTargets);

      let attempts = 0;
      const result = await dispatcher.executeWithHybridRotation('llm', async (target) => {
        attempts++;
        if (target.type === 'local') {
          throw new Error('Connection refused (Local llama-server down)');
        }
        return `SUCCESS_FROM_${target.id}`;
      });

      expect(attempts).toBe(2);
      expect(result).toBe('SUCCESS_FROM_cloud:agnes:k1');
    });

    it('should failover from Cloud to Local when Cloud key hits 429 quota and quarantine for 1 day', async () => {
      const dispatcher = new HybridInferenceDispatcher();
      const mockTargets: InferenceTarget[] = [
        { id: 'cloud:agnes:k1', type: 'cloud', provider: 'agnes', model: 'agnes-2.5', baseUrl: 'https://apihub.agnes-ai.com/v1', apiKey: 'sk-agnes-1' },
        { id: 'local:llama', type: 'local', provider: 'local', model: 'qwen3.8', baseUrl: 'http://localhost:8091' },
      ];

      vi.spyOn(dispatcher, 'getInferenceTargets').mockReturnValue(mockTargets);

      const result = await dispatcher.executeWithHybridRotation('llm', async (target) => {
        if (target.id === 'cloud:agnes:k1') {
          const err = new Error('Daily Quota Exceeded 429');
          (err as any).status = 429;
          throw err;
        }
        return `PROCESSED_BY_${target.id}`;
      });

      expect(result).toBe('PROCESSED_BY_local:llama');
    });
  });
});
