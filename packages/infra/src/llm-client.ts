import { envConfig } from './config.js';
import { logFallbackAlert, createLogger } from './logger.js';
import {
  llmRequestsTotal,
  llmRequestDurationSeconds,
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
  sanitizeHttpErrorResponse,
  formatConciseError,
} from './api-key-rotator.js';
import { ResourceSentinel } from './resource-sentinel.js';
import {
  checkCircuitState,
  recordCircuitSuccess,
  recordCircuitFailure,
  checkCloudCircuitState,
  recordCloudCircuitSuccess,
  recordCloudCircuitFailure,
  localLlmCircuit,
  cloudFallbackCircuit,
} from './circuit-breaker.js';

const log = createLogger({ service: 'llm-client' });

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  response_format?: { type: string; json_schema?: unknown };
  timeoutMs?: number;
  task?: 'extraction' | 'general' | string;
}

export interface LLMCompletionResponse {
  content: string;
  reasoningContent?: string;
  model: string;
  provider:
    | 'LOCAL_LLM'
    | 'AGNES_FLASH_FALLBACK'
    | 'OPENROUTER_CLOUD'
    | 'OPENAI_CLOUD'
    | 'GEMINI_CLOUD_API'
    | (string & {});
  targetId?: string;
  targetProvider?: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

let warnedLocalLlmFailure = false;
let warnedCloudFallback = false;

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
  let model = envConfig.REMOTE_FALLBACK_MODEL || 'agnes-2.5-flash';

  if (hasAvailableApiKeys('agnes')) {
    apiKey = getNextApiKey('agnes') || '';
    baseUrl = baseUrl || 'https://apihub.agnes-ai.com/v1';
    providerName = 'AGNES_FLASH_GATEWAY';
    model = envConfig.REMOTE_FALLBACK_MODEL || 'agnes-2.5-flash';
  } else if (hasAvailableApiKeys('openrouter') || (envConfig.OPENROUTER_API_KEY && envConfig.OPENROUTER_API_KEY.startsWith('sk-or-'))) {
    apiKey = getNextApiKey('openrouter') || envConfig.OPENROUTER_API_KEY || '';
    baseUrl = (envConfig.OPENROUTER_BASE_URL || baseUrl || 'https://openrouter.ai/api/v1').trim();
    providerName = 'OPENROUTER_CLOUD';
    model = envConfig.OPENROUTER_MODEL || 'deepseek/deepseek-chat';
  } else if (hasAvailableApiKeys('openai')) {
    apiKey = getNextApiKey('openai') || envConfig.OPENAI_API_KEY || '';
    baseUrl = baseUrl || 'https://api.openai.com/v1';
    providerName = 'OPENAI_CLOUD';
    model = envConfig.OPENAI_MODEL || (envConfig.REMOTE_FALLBACK_MODEL !== 'agnes-2.5-flash' ? envConfig.REMOTE_FALLBACK_MODEL : 'gpt-4o-mini');
  } else {
    apiKey = (
      envConfig.AGNES_API_KEY ||
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
  const maxTokens = options.max_tokens ?? (target.type === 'local' || target.provider === 'openrouter' ? 2048 : 4096);
  const timeoutMs = options.timeoutMs ?? (target.type === 'local' ? (envConfig.LOCAL_LLM_TIMEOUT_MS || 120000) : envConfig.REMOTE_FALLBACK_TIMEOUT_MS);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (target.type === 'local') {
      const isExtraction = options.task === 'extraction';
      const targetBaseUrl = isExtraction
        ? (envConfig.LOCAL_LLM_EXTRACTION_BASE_URL || `http://localhost:${envConfig.LOCAL_LLM_EXTRACTION_PORT || 8094}`)
        : target.baseUrl;
      const targetModel = isExtraction
        ? (envConfig.LOCAL_LLM_EXTRACTION_MODEL || 'qwen3.5-4b-instruct-q4_k_m')
        : target.model;

      let endpoint = `${targetBaseUrl.replace(/\/$/, '')}/v1/chat/completions`;
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: targetModel,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
            ...(options.response_format ? { response_format: options.response_format } : {}),
          }),
          signal: controller.signal,
          cache: 'no-store',
        });
      } catch (fetchErr: any) {
        if (isExtraction && targetBaseUrl !== target.baseUrl) {
          endpoint = `${target.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: targetModel,
              messages,
              temperature,
              max_tokens: maxTokens,
              ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
              ...(options.response_format ? { response_format: options.response_format } : {}),
            }),
            signal: controller.signal,
            cache: 'no-store',
          });
        } else {
          throw fetchErr;
        }
      }
      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const cleanErr = sanitizeHttpErrorResponse(response.status, response.statusText, errText, 'local');
        throw new Error(`Local llama-server ${cleanErr}`);
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
        targetId: target.id,
        targetProvider: target.provider,
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
      if (target.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://chronoviet.vn';
        headers['X-Title'] = 'ChronoViet';
      }

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
        const cleanErr = sanitizeHttpErrorResponse(response.status, response.statusText, errText, target.provider);
        const err = new Error(`Remote Cloud LLM ${cleanErr}`);
        (err as any).status = response.status;
        throw err;
      }

      const data = (await response.json()) as any;
      const choice = data?.choices?.[0];
      if (!choice) throw new Error('Remote LLM response missing choices array');

      recordCloudCircuitSuccess();
      const durationSec = (Date.now() - startTime) / 1000;
      const telemetryProvider = target.provider || 'remote_fallback';
      llmRequestsTotal.inc({ provider: telemetryProvider, model: target.model, status: 'success' });
      llmRequestDurationSeconds.observe({ provider: telemetryProvider, model: target.model }, durationSec);

      const displayProvider =
        target.provider === 'openrouter'
          ? 'OPENROUTER_CLOUD'
          : target.provider === 'openai'
            ? 'OPENAI_CLOUD'
            : target.provider === 'gemini'
              ? 'GEMINI_CLOUD_API'
              : 'AGNES_FLASH_FALLBACK';

      return {
        content: choice.message?.content || '',
        reasoningContent: choice.message?.reasoning_content || undefined,
        model: data.model || target.model,
        provider: displayProvider,
        targetId: target.id,
        targetProvider: target.provider,
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
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      const timeoutErr: any = new Error(`LLM inference timeout after ${timeoutMs}ms (${target.id})`);
      timeoutErr.status = 504;
      timeoutErr.name = 'TimeoutError';
      timeoutErr.code = 'ETIMEDOUT';
      throw timeoutErr;
    }
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
  const isExtraction = options.task === 'extraction';
  const defaultLocalModel = isExtraction
    ? envConfig.LOCAL_LLM_EXTRACTION_MODEL
    : envConfig.LOCAL_LLM_PRIMARY_MODEL;
  const localModel = options.model || defaultLocalModel;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.max_tokens ?? (envConfig.USE_LOCAL_LLM ? 2048 : 4096);
  const timeoutMs = options.timeoutMs ?? (envConfig.USE_LOCAL_LLM ? envConfig.LOCAL_LLM_TIMEOUT_MS : envConfig.REMOTE_FALLBACK_TIMEOUT_MS);

  log.debug('llm.request_started', 'LLM completion request started', {
    model: localModel,
    task: options.task || 'general',
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
  let shortCircuitedToCloud = false;

  // Short-circuit check: Standby during Render Mutex or Memory Pressure
  if (envConfig.USE_LOCAL_LLM && !envConfig.EVAL_STRICT && envConfig.ENABLE_CLOUD_FALLBACK) {
    try {
      const offloadDecision = await ResourceSentinel.shouldOffloadToCloud();
      if (offloadDecision.shouldOffload) {
        shortCircuitedToCloud = true;
        localFailureReason = `Short-circuited to cloud: ${offloadDecision.reason}`;
        log.info('llm.short_circuit_cloud', `Directly routing LLM inference to Cloud Fallback without circuit penalty: ${offloadDecision.reason}`);
      }
    } catch (err: any) {
      log.debug('llm.offload_check_error', `Offload check notice: ${err.message}`);
    }
  }

  // 2. Attempt Primary Local LLM (llama-server) if enabled, not short-circuited, and circuit allows
  if (envConfig.USE_LOCAL_LLM && !shortCircuitedToCloud) {
    const circuitAction = checkCircuitState();
    if (circuitAction === 'FAST_FAIL') {
      localFailureReason = `Local LLM circuit is OPEN (fast fail, next probe in ${Math.max(0, localLlmCircuit.nextProbeTime - Date.now())}ms)`;
    } else {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const primaryLocalBaseUrl = isExtraction
          ? envConfig.LOCAL_LLM_EXTRACTION_BASE_URL || `http://localhost:${envConfig.LOCAL_LLM_EXTRACTION_PORT}`
          : envConfig.LLM_BASE_URL;
        let endpoint = `${primaryLocalBaseUrl.replace(/\/$/, '')}/v1/chat/completions`;
        let response: Response;
        try {
          response = await fetch(endpoint, {
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
        } catch (fetchErr: any) {
          // If extraction server on 8094 is unavailable, retry on default LLM port 8092 before giving up
          if (isExtraction && primaryLocalBaseUrl !== envConfig.LLM_BASE_URL) {
            endpoint = `${envConfig.LLM_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`;
            response = await fetch(endpoint, {
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
          } else {
            throw fetchErr;
          }
        }

        clearTimeout(timer);

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          const cleanErr = sanitizeHttpErrorResponse(response.status, response.statusText, errBody, 'local');
          throw new Error(`Local llama-server ${cleanErr}`);
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

      const effectiveTimeout = options.timeoutMs ?? envConfig.REMOTE_FALLBACK_TIMEOUT_MS ?? 35000;
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
          if (providerKey === 'openrouter') {
            headers['HTTP-Referer'] = 'https://chronoviet.vn';
            headers['X-Title'] = 'ChronoViet';
          }

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
            const cleanErr = sanitizeHttpErrorResponse(response.status, response.statusText, errBody, remoteCfg.baseUrl);
            const error = new Error(`Cloud LLM ${cleanErr}`);
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

          const fallbackDisplayProvider =
            providerKey === 'openrouter'
              ? 'OPENROUTER_CLOUD'
              : providerKey === 'openai'
                ? 'OPENAI_CLOUD'
                : 'AGNES_FLASH_FALLBACK';

          return {
            content,
            reasoningContent: choice?.message?.reasoning_content,
            model: remoteCfg.model,
            provider: fallbackDisplayProvider,
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
            const conciseErr = formatConciseError(attemptErr);
            log.warn('llm.cloud_retry', `Remote cloud request attempt ${attempt}/${maxAttempts} failed with key [${maskApiKey(activeKey)}]; rotating to next key...`, {
              error: conciseErr,
              statusCode: attemptErr?.status,
            });
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      const fallbackErr = lastErr;
      recordCloudCircuitFailure(fallbackErr);
      llmRequestsTotal.inc({ provider: 'cloud_fallback', model: remoteCfg.model, status: 'error' });
      const fallbackMsg = formatConciseError(fallbackErr);
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
export async function isLLMServiceHealthy(options?: {
  task?: 'extraction' | 'general';
}): Promise<{ healthy: boolean; provider: string; details?: string }> {
  // 1. Check Local LLM if enabled
  if (envConfig.USE_LOCAL_LLM) {
    const isExtraction = options?.task === 'extraction';
    const localEndpoints = isExtraction
      ? [
          {
            url: envConfig.LOCAL_LLM_EXTRACTION_BASE_URL || `http://localhost:${envConfig.LOCAL_LLM_EXTRACTION_PORT || 8094}`,
            model: envConfig.LOCAL_LLM_EXTRACTION_MODEL || 'qwen3.5-4b-instruct-q4_k_m',
          },
          {
            url: envConfig.LLM_BASE_URL,
            model: envConfig.LOCAL_LLM_PRIMARY_MODEL,
          },
        ]
      : [
          {
            url: envConfig.LLM_BASE_URL,
            model: envConfig.LOCAL_LLM_PRIMARY_MODEL,
          },
          {
            url: envConfig.LOCAL_LLM_EXTRACTION_BASE_URL || `http://localhost:${envConfig.LOCAL_LLM_EXTRACTION_PORT || 8094}`,
            model: envConfig.LOCAL_LLM_EXTRACTION_MODEL || 'qwen3.5-4b-instruct-q4_k_m',
          },
        ];

    for (const ep of localEndpoints) {
      try {
        const endpoint = `${ep.url.replace(/\/$/, '')}/v1/models`;
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(2000), cache: 'no-store' });
        if (res.ok) {
          return {
            healthy: true,
            provider: `LOCAL_LLM (${ep.url}) [${ep.model}]`,
          };
        }
      } catch (_err) {
        // Continue to next endpoint or cloud fallback
      }
    }
  }

  // 2. Check Cloud LLMs only if ENABLE_CLOUD_FALLBACK is true and not in EVAL_STRICT
  if (envConfig.ENABLE_CLOUD_FALLBACK && !envConfig.EVAL_STRICT) {
    // 2.1 Check Gemini API if key is present and valid
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

    // 2.2 Check Remote Cloud LLM (OpenRouter / OpenAI / Agnes / Custom Gateway)
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

  const isExtraction = options?.task === 'extraction';
  const targetPort = isExtraction ? (envConfig.LOCAL_LLM_EXTRACTION_PORT || 8094) : (envConfig.LLM_PORT || 8092);
  const targetModel = isExtraction ? (envConfig.LOCAL_LLM_EXTRACTION_MODEL || 'qwen3.5-4b-instruct-q4_k_m') : envConfig.LOCAL_LLM_PRIMARY_MODEL;

  return {
    healthy: false,
    provider: 'NONE',
    details: envConfig.USE_LOCAL_LLM
      ? `Local llama-server is offline on port ${targetPort} [${targetModel}] and Cloud Fallback is ${envConfig.ENABLE_CLOUD_FALLBACK ? 'unavailable' : 'disabled (ENABLE_CLOUD_FALLBACK=false)'}`
      : 'No healthy LLM provider available.',
  };
}

async function* streamSseChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
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
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
}

/**
 * Internal helper to stream tokens from an individual inference target.
 */
async function* streamTargetCompletion(
  target: InferenceTarget,
  messages: ChatMessage[],
  options: LLMCompletionOptions
): AsyncGenerator<string> {
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.max_tokens ?? (target.type === 'local' || target.provider === 'openrouter' ? 2048 : 4096);
  const timeoutMs = options.timeoutMs ?? (target.type === 'local' ? (envConfig.LOCAL_LLM_TIMEOUT_MS || 120000) : envConfig.REMOTE_FALLBACK_TIMEOUT_MS);

  if (target.type === 'local') {
    const endpoint = `${target.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: target.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
        ...(options.frequency_penalty !== undefined ? { frequency_penalty: options.frequency_penalty } : {}),
        ...(options.presence_penalty !== undefined ? { presence_penalty: options.presence_penalty } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });

    if (!response.ok || !response.body) {
      throw new Error(`Local llama-server HTTP ${response.status}: ${response.statusText}`);
    }

    recordCircuitSuccess();
    yield* streamSseChunks(response.body);
  } else {
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
        stream: true,
        ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
        ...(options.frequency_penalty !== undefined ? { frequency_penalty: options.frequency_penalty } : {}),
        ...(options.presence_penalty !== undefined ? { presence_penalty: options.presence_penalty } : {}),
        ...(options.response_format ? { response_format: options.response_format } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });

    if (!response.ok || !response.body) {
      const errText = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
      const cleanErr = sanitizeHttpErrorResponse(response.status, response.statusText, errText, target.provider);
      const err = new Error(`Remote Cloud LLM ${cleanErr}`);
      (err as any).status = response.status;
      throw err;
    }

    recordCloudCircuitSuccess();
    yield* streamSseChunks(response.body);
  }
}

export async function* generateLLMCompletionStream(
  messages: ChatMessage[],
  options: LLMCompletionOptions = {}
): AsyncGenerator<string> {
  const localModel = options.model || envConfig.LOCAL_LLM_PRIMARY_MODEL;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.max_tokens ?? 2048;
  const timeoutMs = options.timeoutMs ?? (envConfig.LOCAL_LLM_TIMEOUT_MS || 120000);

  // Eval Integrity: strict mode requires the local LLM server (no cloud fallback)
  if (envConfig.EVAL_STRICT && !envConfig.USE_LOCAL_LLM) {
    throw new Error('[EVAL_STRICT] USE_LOCAL_LLM must be true during evaluation');
  }

  // 1. Hybrid Round-Robin Streaming Mode
  if (
    envConfig.INFERENCE_ROUTING_MODE === 'hybrid_round_robin' &&
    !envConfig.EVAL_STRICT
  ) {
    const targets = hybridInferenceDispatcher.getInferenceTargets('llm');
    if (targets.length > 0) {
      const maxAttempts = Math.min(4, Math.max(1, targets.length));
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const target = hybridInferenceDispatcher.getNextTarget('llm');
        if (!target) break;

        try {
          yield* streamTargetCompletion(target, messages, options);
          hybridInferenceDispatcher.reportTargetSuccess(target);
          return;
        } catch (err: any) {
          hybridInferenceDispatcher.reportTargetFailure(target, err);
          const conciseErr = formatConciseError(err);
          log.warn('llm.stream_hybrid_attempt_failed', `Hybrid stream target [${target.id}] failed on attempt ${attempt}/${maxAttempts}: ${conciseErr}`);
        }
      }
    }
  }

  let shortCircuitedStreamToCloud = false;
  if (envConfig.USE_LOCAL_LLM && !envConfig.EVAL_STRICT && envConfig.ENABLE_CLOUD_FALLBACK) {
    try {
      const offloadDecision = await ResourceSentinel.shouldOffloadToCloud();
      if (offloadDecision.shouldOffload) {
        shortCircuitedStreamToCloud = true;
        log.info('llm.stream_short_circuit_cloud', `Directly routing LLM stream to Cloud Fallback without circuit penalty: ${offloadDecision.reason}`);
      }
    } catch (err: any) {
      log.debug('llm.stream_offload_check_error', `Offload check notice: ${err.message}`);
    }
  }

  // 2. Primary Local Streaming via llama-server with Circuit Breaker
  if (envConfig.USE_LOCAL_LLM && !shortCircuitedStreamToCloud) {
    const circuitAction = checkCircuitState();
    if (circuitAction !== 'FAST_FAIL') {
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
            ...(options.frequency_penalty !== undefined ? { frequency_penalty: options.frequency_penalty } : {}),
            ...(options.presence_penalty !== undefined ? { presence_penalty: options.presence_penalty } : {}),
          }),
          signal: AbortSignal.timeout(timeoutMs),
          cache: 'no-store',
        });

        if (response.ok && response.body) {
          recordCircuitSuccess();
          yield* streamSseChunks(response.body);
          return;
        } else {
          const errBody = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
          const cleanErr = sanitizeHttpErrorResponse(response.status, response.statusText, errBody, 'local');
          throw new Error(`Local llama-server ${cleanErr}`);
        }
      } catch (err: any) {
        recordCircuitFailure(err);
        const conciseErr = formatConciseError(err);
        log.warn('llm.stream_local_failed', `Local streaming failed: ${conciseErr}`);
        if (envConfig.EVAL_STRICT && !envConfig.EVAL_ALLOW_CLOUD_FALLBACK) {
          throw new Error(`[EVAL_STRICT] Local LLM stream failed during evaluation: ${conciseErr}`);
        }
      }
    }
  }

  // 3. Cloud Fallback with Key Rotation & Circuit Breaker
  if (envConfig.ENABLE_CLOUD_FALLBACK && !envConfig.EVAL_STRICT) {
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
      if (cloudAction !== 'FAST_FAIL') {
        const effectiveTimeout = options.timeoutMs ?? envConfig.REMOTE_FALLBACK_TIMEOUT_MS ?? 35000;
        const maxAttempts = Math.min(4, Math.max(2, keyPoolSize));

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const activeKey = rotator.getNextKey() || remoteCfg.apiKey;
          try {
            const remoteEndpoint = `${remoteCfg.baseUrl}/chat/completions`;
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${activeKey}`,
            };
            if (providerKey === 'openrouter') {
              headers['HTTP-Referer'] = 'https://chronoviet.vn';
              headers['X-Title'] = 'ChronoViet';
            }

            const response = await fetch(remoteEndpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: remoteCfg.model,
                messages,
                temperature,
                max_tokens: maxTokens,
                stream: true,
                ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
                ...(options.frequency_penalty !== undefined ? { frequency_penalty: options.frequency_penalty } : {}),
                ...(options.presence_penalty !== undefined ? { presence_penalty: options.presence_penalty } : {}),
                ...(options.response_format ? { response_format: options.response_format } : {}),
              }),
              signal: AbortSignal.timeout(effectiveTimeout),
              cache: 'no-store',
            });

            if (!response.ok || !response.body) {
              const errBody = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
              const cleanErr = sanitizeHttpErrorResponse(response.status, response.statusText, errBody, remoteCfg.baseUrl);
              const error = new Error(`Cloud LLM ${cleanErr}`);
              (error as any).status = response.status;
              throw error;
            }

            rotator.reportSuccess(activeKey);
            recordCloudCircuitSuccess();
            yield* streamSseChunks(response.body);
            return;
          } catch (attemptErr: any) {
            rotator.reportFailure(activeKey, attemptErr);
            const conciseErr = formatConciseError(attemptErr);
            log.warn('llm.stream_cloud_retry', `Cloud stream attempt ${attempt}/${maxAttempts} failed with key [${maskApiKey(activeKey)}]: ${conciseErr}`);
            if (attempt === maxAttempts) {
              recordCloudCircuitFailure(attemptErr);
            }
          }
        }
      }
    }
  }

  // 4. Fallback to unary completion if streams fail
  const fallbackRes = await generateLLMCompletion(messages, options);
  yield fallbackRes.content;
}

export async function callLlm(params: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: string;
  timeoutMs?: number;
}): Promise<LLMCompletionResponse> {
  return generateLLMCompletion(params.messages, {
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    timeoutMs: params.timeoutMs,
    response_format: params.responseFormat ? { type: params.responseFormat } : undefined,
  });
}

export const callLLM = callLlm;

/**
 * Safely extracts and cleans JSON content from raw LLM output strings,
 * handling markdown code fences (```json ... ``` or ``` ... ```) and leading/trailing chatter.
 */
export function extractJsonFromText(rawText: string): string {
  if (!rawText) return '{}';
  let cleaned = rawText.trim();

  // 1. Unwrap markdown code fence if present
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match?.[1]) {
    cleaned = match[1].trim();
  }

  // 2. Slice from first opening { or [ to last closing } or ]
  const first = Math.min(...[cleaned.indexOf('{'), cleaned.indexOf('[')].filter((i) => i >= 0));
  const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (first >= 0 && last > first) {
    cleaned = cleaned.slice(first, last + 1).trim();
  }

  return cleaned;
}

/**
 * Parses raw text from LLM completion into JSON with automatic codeblock stripping and repair.
 */
export function parseLlmJson<T = any>(rawText: string): T {
  const jsonStr = extractJsonFromText(rawText);
  return JSON.parse(jsonStr) as T;
}
