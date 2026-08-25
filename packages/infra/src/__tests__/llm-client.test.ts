import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateLLMCompletion, isLLMServiceHealthy } from '../llm-client.js';
import { ResourceSentinel } from '../resource-sentinel.js';

describe('LLM Gateway Client', () => {
  beforeEach(() => {
    vi.spyOn(ResourceSentinel, 'shouldOffloadToCloud').mockResolvedValue({ shouldOffload: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('correctly extracts and parses JSON wrapped in markdown code blocks', async () => {
    const { extractJsonFromText, parseLlmJson } = await import('../llm-client.js');
    
    const markdownWithJson = '```json\n[{"chapterIndex": 0, "title": "Bạch Đằng Giang"}]\n```';
    expect(extractJsonFromText(markdownWithJson)).toBe('[{"chapterIndex": 0, "title": "Bạch Đằng Giang"}]');
    expect(parseLlmJson(markdownWithJson)).toEqual([{ chapterIndex: 0, title: 'Bạch Đằng Giang' }]);

    const markdownWithExtraChatter = 'Dưới đây là kết quả:\n```json\n{"status": "ok", "count": 10}\n```\nChúc bạn thành công!';
    expect(parseLlmJson(markdownWithExtraChatter)).toEqual({ status: 'ok', count: 10 });

    const rawJson = '{"foo": "bar"}';
    expect(parseLlmJson(rawJson)).toEqual({ foo: 'bar' });
  });

  it('streams tokens correctly from local SSE stream', async () => {
    const { generateLLMCompletionStream } = await import('../llm-client.js');

    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Chiến "}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"thắng "}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Bạch Đằng"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
    } as any);

    try {
      const tokens: string[] = [];
      for await (const token of generateLLMCompletionStream([
        { role: 'user', content: 'Chiến thắng năm 938?' },
      ])) {
        tokens.push(token);
      }
      expect(tokens.join('')).toBe('Chiến thắng Bạch Đằng');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('falls back to unary when streaming endpoint throws', async () => {
    const { generateLLMCompletionStream } = await import('../llm-client.js');

    const originalFetch = global.fetch;
    // First call (streaming) fails, second call (unary) succeeds
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 500, statusText: 'Stream Error' };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Fallback Unary Content' } }],
          model: 'qwen3.8-27b',
        }),
      };
    });

    try {
      const tokens: string[] = [];
      for await (const token of generateLLMCompletionStream([
        { role: 'user', content: 'Test stream fallback' },
      ])) {
        tokens.push(token);
      }
      expect(tokens.join('')).toContain('Fallback Unary Content');
    } finally {
      global.fetch = originalFetch;
    }
  });
});


