import { describe, it, expect, vi } from 'vitest';
import { generateLLMCompletion, isLLMServiceHealthy } from '../llm-client.js';

describe('LLM Gateway Client', () => {
  it('checks service health gracefully', async () => {
    const health = await isLLMServiceHealthy();
    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('provider');
  });

  it('handles completion with mock local response', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Chiến thắng Ngọc Hồi - Đống Đa năm 1789.' } }],
      model: 'qwen3.8-27b-instruct-q4_k_m',
      usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    try {
      const res = await generateLLMCompletion([
        { role: 'user', content: 'Năm 1789 gắn liền với sự kiện gì?' },
      ]);
      expect(res.provider).toBe('LOCAL_LLM');
      expect(res.content).toContain('Ngọc Hồi - Đống Đa');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
