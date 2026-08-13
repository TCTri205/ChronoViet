import { describe, it, expect } from 'vitest';
import { generateLLMCompletion } from '../llm-client.js';

describe('Local LLM Gateway Client Adaptation Test', () => {
  it('successfully generates response from running Qwen3.5-27B-Q4_K_M server', async () => {
    const res = await generateLLMCompletion(
      [
        { role: 'system', content: 'Bạn là trợ lý AI Lịch sử Việt Nam của ChronoViet.' },
        { role: 'user', content: 'Trả lời ngắn 1 câu: Năm 1789 gắn liền với chiến thắng lịch sử nào?' },
      ],
      { max_tokens: 256, temperature: 0.1 }
    );

    expect(res).toBeDefined();
    expect(res.provider).toBe('LOCAL_LLM');
    expect(res.content || res.reasoningContent).toBeTruthy();
  }, 60000);
});
