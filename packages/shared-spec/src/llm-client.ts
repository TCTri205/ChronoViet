/**
 * Local Model Gateway & Remote Fallback LLM Client Service
 * Connects to llama-server (Qwen3.8-27B-Q4_K_M) with automatic Agnes 2.5 Flash Cloud Fallback
 */

import { envConfig } from './config.js';
import { logFallbackAlert, createLogger } from './logger.js';
import {
  llmRequestsTotal,
  llmRequestDurationSeconds,
  circuitBreakerGauge,
  circuitBreakerFailuresGauge,
} from './telemetry/metrics.js';
import {
  getNextApiKey,
  hasAvailableApiKeys,
  maskApiKey,
  reportKeySuccess,
  reportKeyFailure,
  getApiKeyRotator,
  hybridInferenceDispatcher,
  InferenceTarget,
} from './api-key-rotator.js';

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

interface CircuitBreakerState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailureTime: number;
  nextProbeTime: number;
}

const localLlmCircuit: CircuitBreakerState = {
  status: 'CLOSED',
  failures: 0,
  lastFailureTime: 0,
  nextProbeTime: 0,
};

const cloudFallbackCircuit: CircuitBreakerState = {
  status: 'CLOSED',
  failures: 0,
  lastFailureTime: 0,
  nextProbeTime: 0,
};

let warnedCloudFallback = false;

const CIRCUIT_FAILURE_THRESHOLD = 2;
const CIRCUIT_COOLDOWN_MS = 30000;

function checkCircuitState(): 'ALLOW' | 'PROBE' | 'FAST_FAIL' {
  if (localLlmCircuit.status === 'CLOSED') return 'ALLOW';
  const now = Date.now();
  if (now >= localLlmCircuit.nextProbeTime) {
    localLlmCircuit.status = 'HALF_OPEN';
    return 'PROBE';
  }
  return 'FAST_FAIL';
}

function recordCircuitSuccess() {
  if (localLlmCircuit.status !== 'CLOSED') {
    log.info('llm.circuit_recovered', 'Local LLM Gateway recovered; circuit closed', {
      previousFailures: localLlmCircuit.failures,
    });
  }
  localLlmCircuit.status = 'CLOSED';
  localLlmCircuit.failures = 0;
  circuitBreakerGauge.set({ subsystem: 'llm_local' }, 0);
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_local' }, 0);
}

function recordCircuitFailure(err: unknown) {
  localLlmCircuit.failures += 1;
  localLlmCircuit.lastFailureTime = Date.now();
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_local' }, localLlmCircuit.failures);
  if (localLlmCircuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    localLlmCircuit.status = 'OPEN';
    localLlmCircuit.nextProbeTime = Date.now() + CIRCUIT_COOLDOWN_MS;
    circuitBreakerGauge.set({ subsystem: 'llm_local' }, 1);
    log.warn('llm.circuit_opened', 'Local LLM Gateway circuit opened (cooldown 30s)', {
      failures: localLlmCircuit.failures,
      cooldownMs: CIRCUIT_COOLDOWN_MS,
    });
  }
}

function checkCloudCircuitState(): 'ALLOW' | 'PROBE' | 'FAST_FAIL' {
  if (cloudFallbackCircuit.status === 'CLOSED') return 'ALLOW';
  const now = Date.now();
  if (now >= cloudFallbackCircuit.nextProbeTime) {
    cloudFallbackCircuit.status = 'HALF_OPEN';
    return 'PROBE';
  }
  return 'FAST_FAIL';
}

function recordCloudCircuitSuccess() {
  cloudFallbackCircuit.status = 'CLOSED';
  cloudFallbackCircuit.failures = 0;
  circuitBreakerGauge.set({ subsystem: 'llm_cloud' }, 0);
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_cloud' }, 0);
}

function recordCloudCircuitFailure(err: unknown) {
  cloudFallbackCircuit.failures += 1;
  cloudFallbackCircuit.lastFailureTime = Date.now();
  circuitBreakerFailuresGauge.set({ subsystem: 'llm_cloud' }, cloudFallbackCircuit.failures);
  if (cloudFallbackCircuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    cloudFallbackCircuit.status = 'OPEN';
    cloudFallbackCircuit.nextProbeTime = Date.now() + CIRCUIT_COOLDOWN_MS;
    circuitBreakerGauge.set({ subsystem: 'llm_cloud' }, 1);
    log.warn('llm.cloud_circuit_opened', 'Cloud fallback circuit opened (cooldown 30s)', {
      failures: cloudFallbackCircuit.failures,
      cooldownMs: CIRCUIT_COOLDOWN_MS,
    });
  }
}

export interface ActiveRemoteLLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerName: string;
}

export function getActiveRemoteLLMConfig(): ActiveRemoteLLMConfig {
  let apiKey = '';
  let providerName = 'REMOTE_CLOUD_LLM';
  let baseUrl = (envConfig.REMOTE_LLM_BASE_URL || '').trim();

  if (hasAvailableApiKeys('agnes')) {
    apiKey = getNextApiKey('agnes') || '';
    baseUrl = baseUrl || 'https://apihub.agnes-ai.com/v1';
    providerName = 'AGNES_FLASH_GATEWAY';
  } else if (hasAvailableApiKeys('openrouter') || (envConfig.OPENROUTER_API_KEY && envConfig.OPENROUTER_API_KEY.startsWith('sk-or-'))) {
    apiKey = getNextApiKey('openrouter') || envConfig.OPENROUTER_API_KEY || '';
    baseUrl = baseUrl || 'https://openrouter.ai/api/v1';
    providerName = 'OPENROUTER_CLOUD';
  } else if (hasAvailableApiKeys('openai')) {
    apiKey = getNextApiKey('openai') || envConfig.OPENAI_API_KEY || '';
    baseUrl = baseUrl || 'https://api.openai.com/v1';
    providerName = 'OPENAI_CLOUD';
  } else {
    apiKey = (
      envConfig.AGNES_API_KEY ||
      envConfig.REMOTE_LLM_API_KEY ||
      envConfig.OPENROUTER_API_KEY ||
      envConfig.OPENAI_API_KEY ||
      ''
    ).trim();
    if (baseUrl) {
      providerName = `CUSTOM_REMOTE_LLM (${baseUrl})`;
    } else {
      baseUrl = 'https://apihub.agnes-ai.com/v1';
      providerName = 'AGNES_FLASH_GATEWAY';
    }
  }

  const model = envConfig.REMOTE_FALLBACK_MODEL || 'agnes-2.5-flash';

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ''),
    model,
    providerName,
  };
}

/**
 * Internal executor for an individual inference target (Local or Cloud)
 */
async function executeTargetCompletion(
  target: InferenceTarget,
  messages: ChatMessage[],
  options: LLMCompletionOptions,
  startTime: number
): Promise<LLMCompletionResponse> {
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.max_tokens ?? (target.type === 'local' ? 2048 : 8192);
  const timeoutMs = options.timeoutMs ?? (target.type === 'local' ? 45000 : envConfig.REMOTE_FALLBACK_TIMEOUT_MS);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (target.type === 'local') {
      const endpoint = `${target.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: target.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
          ...(options.response_format ? { response_format: options.response_format } : {}),
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Local llama-server HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const choice = data?.choices?.[0];
      if (!choice) throw new Error('Local LLM response missing choices array');

      recordCircuitSuccess();
      const durationSec = (Date.now() - startTime) / 1000;
      llmRequestsTotal.inc({ provider: 'local_ollama', model: data.model || target.model, status: 'success' });
      llmRequestDurationSeconds.observe({ provider: 'local_ollama', model: data.model || target.model }, durationSec);

      return {
        content: choice.message?.content || '',
        reasoningContent: choice.message?.reasoning_content || undefined,
        model: data.model || target.model,
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
    } else {
      // Cloud Target (Agnes, Gemini, OpenAI, OpenRouter)
      const remoteEndpoint = target.baseUrl.includes('chat/completions')
        ? target.baseUrl
        : `${target.baseUrl.replace(/\/$/, '')}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.apiKey}`,
      };

      const response = await fetch(remoteEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: target.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(options.response_format ? { response_format: options.response_format } : {}),
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const err = new Error(`Remote Cloud LLM HTTP ${response.status} (${target.provider}): ${errText}`);
        (err as any).status = response.status;
        throw err;
      }

      const data = (await response.json()) as any;
      const choice = data?.choices?.[0];
      if (!choice) throw new Error('Remote LLM response missing choices array');

      recordCloudCircuitSuccess();
      const durationSec = (Date.now() - startTime) / 1000;
      llmRequestsTotal.inc({ provider: 'remote_fallback', model: target.model, status: 'success' });
      llmRequestDurationSeconds.observe({ provider: 'remote_fallback', model: target.model }, durationSec);

      return {
        content: choice.message?.content || '',
        reasoningContent: choice.message?.reasoning_content || undefined,
        model: data.model || target.model,
        provider: 'AGNES_FLASH_FALLBACK',
        finishReason: choice.finish_reason || 'stop',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            }
          : undefined,
      };
    }
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Generate LLM completion using Primary Local Model or Remote Cloud Fallback
 */
export async function generateLLMCompletion(
  messages: ChatMessage[],
  options: LLMCompletionOptions = {}
): Promise<LLMCompletionResponse> {
  const startTime = Date.now();
  const localModel = options.model || envConfig.LOCAL_LLM_PRIMARY_MODEL;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.max_tokens ?? (envConfig.USE_LOCAL_LLM ? 2048 : 8192);
  const timeoutMs = options.timeoutMs ?? (envConfig.USE_LOCAL_LLM ? 45000 : envConfig.REMOTE_FALLBACK_TIMEOUT_MS);

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

  // 1. Hybrid Round-Robin Mode (Rotates across Local + Cloud targets evenly with 1-day quarantine on quota limit)
  if (
    envConfig.INFERENCE_ROUTING_MODE === 'hybrid_round_robin' &&
    !envConfig.EVAL_STRICT
  ) {
    const targets = hybridInferenceDispatcher.getInferenceTargets('llm');
    if (targets.length > 0) {
      try {
        return await hybridInferenceDispatcher.executeWithHybridRotation(
          'llm',
          (target) => executeTargetCompletion(target, messages, options, startTime)
        );
      } catch (err: any) {
        log.warn('llm.hybrid_dispatcher_exhausted', `All hybrid inference targets failed: ${err.message}`);
        if (!envConfig.ENABLE_CLOUD_FALLBACK && !envConfig.USE_LOCAL_LLM) {
          throw err;
        }
      }
    }
  }

  let localFailureReason: string | null = null;

  // 2. Attempt Primary Local LLM (llama-server) if enabled and circuit allows
  if (envConfig.USE_LOCAL_LLM) {
    const circuitAction = checkCircuitState();
    if (circuitAction === 'FAST_FAIL') {
      localFailureReason = `Local LLM circuit is OPEN (fast fail, next probe in ${Math.max(0, localLlmCircuit.nextProbeTime - Date.now())}ms)`;
    } else {
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
          cache: 'no-store',
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

        recordCircuitSuccess();
        const durationSec = (Date.now() - startTime) / 1000;
        llmRequestsTotal.inc({ provider: 'local_ollama', model: data.model || localModel, status: 'success' });
        llmRequestDurationSeconds.observe({ provider: 'local_ollama', model: data.model || localModel }, durationSec);

        log.debug('llm.local_success', 'Local LLM completion succeeded', {
          model: data.model || localModel,
          finishReason: choice.finish_reason || 'stop',
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          durationMs: Date.now() - startTime,
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
        recordCircuitFailure(err);
        llmRequestsTotal.inc({ provider: 'local_ollama', model: localModel, status: 'error' });
        const errMsg = err instanceof Error ? err.message : String(err);
        localFailureReason = errMsg;

        log.warn('llm.local_failed', 'Local LLM request failed; attempting cloud fallback', {
          error: errMsg,
          model: localModel,
        });

        if (!warnedLocalLlmFailure) {
          logFallbackAlert({
            subsystem: 'LLM_GATEWAY',
            primaryTarget: `Local LLM (${envConfig.LLM_BASE_URL}) [${localModel}]`,
            fallbackTarget: `Cloud API / Rule-based Fallback`,
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
  }

  // 2. Fallback to Remote Cloud LLM (OpenAI / OpenRouter / Agnes) if key is available
  if (envConfig.ENABLE_CLOUD_FALLBACK) {
    const remoteCfg = getActiveRemoteLLMConfig();
    const providerKey = hasAvailableApiKeys('agnes')
      ? 'agnes'
      : hasAvailableApiKeys('openrouter')
        ? 'openrouter'
        : hasAvailableApiKeys('openai')
          ? 'openai'
          : 'agnes';
    const rotator = getApiKeyRotator(providerKey);
    const keyPoolSize = rotator.totalKeysCount;

    if (isValidApiKey(remoteCfg.apiKey) || keyPoolSize > 0) {
      const cloudAction = checkCloudCircuitState();
      if (cloudAction === 'FAST_FAIL') {
        throw new Error(`Local LLM is offline (${localFailureReason}) and Cloud Fallback circuit is OPEN.`);
      }

      const effectiveTimeout = options.timeoutMs ?? envConfig.REMOTE_FALLBACK_TIMEOUT_MS ?? 120000;
      let lastErr: unknown = null;
      const maxAttempts = Math.max(2, keyPoolSize);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const activeKey = rotator.getNextKey() || remoteCfg.apiKey;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), effectiveTimeout);

          const remoteEndpoint = `${remoteCfg.baseUrl}/chat/completions`;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKey}`,
          };

          const response = await fetch(remoteEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: remoteCfg.model,
              messages,
              temperature,
              max_tokens: maxTokens,
              ...(options.response_format ? { response_format: options.response_format } : {}),
            }),
            signal: controller.signal,
            cache: 'no-store',
          });

          clearTimeout(timer);

          if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            const error = new Error(`Cloud LLM (${remoteCfg.baseUrl}) HTTP ${response.status}: ${response.statusText} ${errBody}`.trim());
            (error as any).status = response.status;
            throw error;
          }

          const data = (await response.json()) as any;
          const choice = data?.choices?.[0];
          const content = choice?.message?.content || '';

          rotator.reportSuccess(activeKey);
          recordCloudCircuitSuccess();
          const durationSec = (Date.now() - startTime) / 1000;
          llmRequestsTotal.inc({ provider: 'cloud_fallback', model: remoteCfg.model, status: 'success' });
          llmRequestDurationSeconds.observe({ provider: 'cloud_fallback', model: remoteCfg.model }, durationSec);

          log.debug('llm.cloud_success', 'Remote cloud fallback completion succeeded', {
            model: remoteCfg.model,
            endpoint: remoteCfg.baseUrl,
            key: maskApiKey(activeKey),
            finishReason: choice?.finish_reason || 'stop',
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
            durationMs: Date.now() - startTime,
          });

          return {
            content,
            reasoningContent: choice?.message?.reasoning_content,
            model: remoteCfg.model,
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
        } catch (attemptErr: any) {
          lastErr = attemptErr;
          rotator.reportFailure(activeKey, attemptErr);

          if (attempt < maxAttempts) {
            log.warn('llm.cloud_retry', `Remote cloud request attempt ${attempt}/${maxAttempts} failed with key [${maskApiKey(activeKey)}]; rotating to next key...`, {
              error: attemptErr instanceof Error ? attemptErr.message : String(attemptErr),
              statusCode: attemptErr?.status,
            });
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      const fallbackErr = lastErr;
      recordCloudCircuitFailure(fallbackErr);
      llmRequestsTotal.inc({ provider: 'cloud_fallback', model: remoteCfg.model, status: 'error' });
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      log.warn('llm.cloud_fallback_failed', 'Cloud fallback request failed across all key attempts', {
        error: fallbackMsg,
        endpoint: remoteCfg.baseUrl,
      });
      warnedCloudFallback = true;
      throw new Error(`Local LLM failed (${localFailureReason}) and Cloud Fallback (${remoteCfg.baseUrl}) failed: ${fallbackMsg}`);
    } else {
      // Cloud fallback is enabled but no remote API key is configured
      throw new Error(`Local LLM is offline (${localFailureReason || 'unreachable'}) and no cloud API key is configured.`);
    }
  }

  throw new Error('No LLM Provider available (Local LLM disabled and Cloud Fallback disabled).');
}

function isValidApiKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return trimmed.length > 5 && !trimmed.includes('your_') && !trimmed.includes('api_key_here') && !trimmed.includes('example');
}

/**
 * Pre-flight health check for LLM Service
 */
export async function isLLMServiceHealthy(): Promise<{ healthy: boolean; provider: string; details?: string }> {
  // 1. Check Local LLM if enabled
  if (envConfig.USE_LOCAL_LLM) {
    try {
      const endpoint = `${envConfig.LLM_BASE_URL.replace(/\/$/, '')}/v1/models`;
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(2000), cache: 'no-store' });
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

  // 2. Check Gemini API if key is present and valid
  const geminiKey = getNextApiKey('gemini') || envConfig.GEMINI_API_KEY;
  if (hasAvailableApiKeys('gemini') || isValidApiKey(geminiKey)) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`, {
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      });
      if (res.ok) {
        return {
          healthy: true,
          provider: 'GEMINI_CLOUD_API',
        };
      }
    } catch {}
  }

  // 3. Check Remote Cloud LLM (OpenRouter / OpenAI / Agnes / Custom Gateway)
  if (envConfig.ENABLE_CLOUD_FALLBACK) {
    const remoteCfg = getActiveRemoteLLMConfig();
    if (isValidApiKey(remoteCfg.apiKey)) {
      try {
        const res = await fetch(`${remoteCfg.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${remoteCfg.apiKey}` },
          signal: AbortSignal.timeout(4000),
          cache: 'no-store',
        });
        if (res.ok || res.status === 400 || res.status === 404 || res.status === 405) {
          return {
            healthy: true,
            provider: `${remoteCfg.providerName} [${remoteCfg.model}]`,
          };
        } else if (res.status === 401) {
          return {
            healthy: false,
            provider: `${remoteCfg.providerName} [${remoteCfg.model}]`,
            details: `Remote endpoint reached at ${remoteCfg.baseUrl} but API Key is unauthorized (HTTP 401)`,
          };
        }
      } catch (_err: any) {
        // Fallback probe to /chat/completions with minimal payload
        try {
          const probeRes = await fetch(`${remoteCfg.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${remoteCfg.apiKey}`,
            },
            body: JSON.stringify({
              model: remoteCfg.model,
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 1,
            }),
            signal: AbortSignal.timeout(5000),
            cache: 'no-store',
          });
          if (probeRes.ok || probeRes.status === 400) {
            return {
              healthy: true,
              provider: `${remoteCfg.providerName} [${remoteCfg.model}]`,
            };
          } else if (probeRes.status === 401) {
            return {
              healthy: false,
              provider: `${remoteCfg.providerName} [${remoteCfg.model}]`,
              details: `Remote endpoint reached at ${remoteCfg.baseUrl} but API Key is unauthorized (HTTP 401)`,
            };
          }
        } catch (_probeErr: any) {
          // Probe also failed
        }
      }
    }
  }

  return {
    healthy: false,
    provider: 'NONE',
    details: `Local LLM at ${envConfig.LLM_BASE_URL} is unreachable and remote cloud providers are offline`,
  };
}

async function* streamSseChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':') || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {}
      }
    }
  }
}

export async function* generateLLMCompletionStream(
  messages: ChatMessage[],
  options: LLMCompletionOptions = {}
): AsyncGenerator<string> {
  const localModel = options.model || envConfig.LOCAL_LLM_PRIMARY_MODEL;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.max_tokens ?? 2048;
  const timeoutMs = options.timeoutMs ?? 45000;

  // 1. Attempt local streaming via llama-server
  if (envConfig.USE_LOCAL_LLM) {
    try {
      const response = await fetch(`${envConfig.LLM_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
          ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });

      if (response.ok && response.body) {
        yield* streamSseChunks(response.body);
        return;
      }
    } catch (err: any) {
      log.warn('llm.stream_local_failed', `Local streaming failed: ${err.message}`);
    }
  }

  // 2. Cloud Fallback (Remote OpenAI-compatible / OpenRouter / Agnes)
  const remoteCfg = getActiveRemoteLLMConfig();
  if (envConfig.ENABLE_CLOUD_FALLBACK && isValidApiKey(remoteCfg.apiKey)) {
    try {
      const response = await fetch(`${remoteCfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${remoteCfg.apiKey}`,
        },
        body: JSON.stringify({
          model: remoteCfg.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });

      if (response.ok && response.body) {
        yield* streamSseChunks(response.body);
        return;
      }
    } catch (err: any) {
      log.warn('llm.stream_cloud_failed', `Cloud streaming (${remoteCfg.baseUrl}) failed: ${err.message}`);
    }
  }

  // 3. Fallback to unary completion if streams fail
  const fallbackRes = await generateLLMCompletion(messages, options);
  yield fallbackRes.content;
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



