/**
 * Local Model Gateway & Remote Fallback LLM Client Service
 * Connects to llama-server (Qwen3.5-27B-Q4_K_M) with automatic Agnes 2.0 Flash Cloud Fallback
 */

import { envConfig } from './config.js';
import { logFallbackAlert } from './logger.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: { type: string; json_schema?: unknown };
  timeoutMs?: number;
}

export interface LLMCompletionResponse {
  content: string;
  reasoningContent?: string;
  model: string;
  provider: 'LOCAL_LLM' | 'AGNES_FLASH_FALLBACK';
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Generate LLM completion using Primary Local Model (Qwen3.5-27B-Q4_K_M)
 * Falls back automatically to Agnes 2.0 Flash API if local server is unreachable or fails.
 */
export async function generateLLMCompletion(
  messages: ChatMessage[],
  options: LLMCompletionOptions = {}
): Promise<LLMCompletionResponse> {
  const localModel = options.model || envConfig.LOCAL_LLM_PRIMARY_MODEL;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.max_tokens ?? 2048;
  const timeoutMs = options.timeoutMs ?? 45000;

  // 1. Attempt Primary Local LLM (llama-server)
  if (envConfig.USE_LOCAL_LLM) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const endpoint = `${envConfig.LLM_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: localModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
          ...(options.response_format ? { response_format: options.response_format } : {}),
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Local llama-server HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const choice = data?.choices?.[0];
      if (!choice) {
        throw new Error('Local LLM response missing choices array');
      }

      const content = choice.message?.content || '';
      const reasoningContent = choice.message?.reasoning_content || undefined;

      return {
        content,
        reasoningContent,
        model: data.model || localModel,
        provider: 'LOCAL_LLM',
        finishReason: choice.finish_reason || 'stop',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            }
          : undefined,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      logFallbackAlert({
        subsystem: 'LLM_GATEWAY',
        primaryTarget: `Local LLM (${envConfig.LLM_BASE_URL}) [${localModel}]`,
        fallbackTarget: `Agnes 2.0 Flash Cloud API [${envConfig.REMOTE_FALLBACK_MODEL}]`,
        reason: errMsg,
        actionRequired: `Check if llama-server is running on ${envConfig.LLM_BASE_URL} with model ${localModel}`,
      });

      if (!envConfig.ENABLE_CLOUD_FALLBACK) {
        throw new Error(`Local LLM failed and Cloud Fallback is disabled: ${errMsg}`);
      }
    }
  }

  // 2. Fallback to Remote Agnes 2.0 Flash Cloud API
  if (envConfig.ENABLE_CLOUD_FALLBACK) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), envConfig.REMOTE_FALLBACK_TIMEOUT_MS);

      const remoteEndpoint = 'https://api.agnes.ai/v1/chat/completions';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (envConfig.AGNES_API_KEY) {
        headers['Authorization'] = `Bearer ${envConfig.AGNES_API_KEY}`;
      }

      const response = await fetch(remoteEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: envConfig.REMOTE_FALLBACK_MODEL,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Agnes API HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const choice = data?.choices?.[0];
      const content = choice?.message?.content || '';

      return {
        content,
        reasoningContent: choice?.message?.reasoning_content,
        model: envConfig.REMOTE_FALLBACK_MODEL,
        provider: 'AGNES_FLASH_FALLBACK',
        finishReason: choice?.finish_reason || 'stop',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            }
          : undefined,
      };
    } catch (fallbackErr) {
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(`Both Local LLM and Agnes 2.0 Flash Fallback failed. Remote error: ${fallbackMsg}`);
    }
  }

  throw new Error('No LLM Provider available (Local LLM disabled and Cloud Fallback disabled).');
}
