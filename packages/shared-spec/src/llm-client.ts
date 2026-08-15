/**
 * Local Model Gateway & Remote Fallback LLM Client Service
 * Connects to llama-server (Qwen3.5-27B-Q4_K_M) with automatic Agnes 2.0 Flash Cloud Fallback
 */

import { envConfig } from './config.js';
import { logFallbackAlert, createLogger } from './logger.js';

const log = createLogger({ service: 'shared-spec' });

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

let warnedLocalLlmFailure = false;

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

  log.debug('llm.request_started', 'LLM completion request started', {
    model: localModel,
    temperature,
    maxTokens,
    timeoutMs,
    messageCount: messages.length,
  });

  // Eval Integrity: strict mode requires the local LLM server (no cloud fallback)
  if (envConfig.EVAL_STRICT && !envConfig.USE_LOCAL_LLM) {
    throw new Error('[EVAL_STRICT] USE_LOCAL_LLM must be true during evaluation');
  }

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

      log.debug('llm.local_success', 'Local LLM completion succeeded', {
        model: data.model || localModel,
        finishReason: choice.finish_reason || 'stop',
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      });

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

      log.warn('llm.local_failed', 'Local LLM request failed; attempting cloud fallback', {
        error: err,
        model: localModel,
      });

      if (!warnedLocalLlmFailure) {
        logFallbackAlert({
          subsystem: 'LLM_GATEWAY',
          primaryTarget: `Local LLM (${envConfig.LLM_BASE_URL}) [${localModel}]`,
          fallbackTarget: `Agnes 2.0 Flash Cloud API [${envConfig.REMOTE_FALLBACK_MODEL}]`,
          reason: errMsg,
          actionRequired: `Check if llama-server is running on ${envConfig.LLM_BASE_URL} with model ${localModel}`,
        });
        warnedLocalLlmFailure = true;
      }

      if (!envConfig.ENABLE_CLOUD_FALLBACK) {
        throw new Error(`Local LLM failed and Cloud Fallback is disabled: ${errMsg}`);
      }

      // Eval Integrity: strict mode forbids silent cloud substitution during evaluation
      if (envConfig.EVAL_STRICT && !envConfig.EVAL_ALLOW_CLOUD_FALLBACK) {
        throw new Error(`[EVAL_STRICT] Local LLM failed during evaluation: ${errMsg}`);
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

      log.debug('llm.cloud_success', 'Agnes cloud fallback completion succeeded', {
        model: envConfig.REMOTE_FALLBACK_MODEL,
        finishReason: choice?.finish_reason || 'stop',
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      });

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
      log.error('llm.all_providers_failed', 'All LLM providers failed', {
        error: fallbackErr,
        localEnabled: envConfig.USE_LOCAL_LLM,
        cloudEnabled: envConfig.ENABLE_CLOUD_FALLBACK,
      });
      throw new Error(`Both Local LLM and Agnes 2.0 Flash Fallback failed. Remote error: ${fallbackMsg}`);
    }
  }

  throw new Error('No LLM Provider available (Local LLM disabled and Cloud Fallback disabled).');
}

/**
 * Pre-flight health check for LLM Service
 */
export async function isLLMServiceHealthy(): Promise<{ healthy: boolean; provider: string; details?: string }> {
  // 1. Check Local LLM if enabled
  if (envConfig.USE_LOCAL_LLM) {
    try {
      const endpoint = `${envConfig.LLM_BASE_URL.replace(/\/$/, '')}/v1/models`;
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        return {
          healthy: true,
          provider: `LOCAL_LLM (${envConfig.LLM_BASE_URL}) [${envConfig.LOCAL_LLM_PRIMARY_MODEL}]`,
        };
      }
    } catch (_err) {
      // Local LLM check failed, test cloud fallback
    }
  }

  // 2. Check Gemini API if key is present
  if (envConfig.GEMINI_API_KEY) {
    return {
      healthy: true,
      provider: 'GEMINI_CLOUD_API',
    };
  }

  // 3. Check Agnes API if enabled
  if (envConfig.ENABLE_CLOUD_FALLBACK && envConfig.AGNES_API_KEY) {
    return {
      healthy: true,
      provider: `AGNES_CLOUD_FALLBACK [${envConfig.REMOTE_FALLBACK_MODEL}]`,
    };
  }

  return {
    healthy: false,
    provider: 'NONE',
    details: `Local LLM at ${envConfig.LLM_BASE_URL} is unreachable and no valid cloud API key is configured`,
  };
}

export async function callLlm(params: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: string;
}): Promise<LLMCompletionResponse> {
  return generateLLMCompletion(params.messages, {
    temperature: params.temperature,
    max_tokens: params.maxTokens,
  });
}


