import { createLogger } from '../logger.js';
import { envConfig } from '../config.js';
import { isClientSidePayloadError } from '../circuit-breaker.js';
import {
  ApiKeyProvider,
  getApiKeyRotator,
  reportKeySuccess,
  reportKeyFailure,
  hasAvailableApiKeys,
  maskApiKey,
  classifyErrorCooldown,
  formatConciseError,
} from '../api-key-rotator.js';
import { persistQuarantineToRedis, clearQuarantineFromRedis } from '../storage/redis-quarantine.js';

const log = createLogger({ service: 'hybrid-inference-dispatcher' });

/**
 * Unified Inference Target representation (Peer node in Hybrid Round-Robin Pool)
 */
export interface InferenceProviderInfo {
  provider: ApiKeyProvider | 'local';
  type: 'local' | 'cloud';
  model: string;
  baseUrl: string;
  activeKeyCount: number;
  totalKeyCount: number;
}

export interface InferenceTarget {
  id: string; // e.g. "local:llama-server", "cloud:agnes:sk-***1234", "cloud:gemini:AQ***5678"
  type: 'local' | 'cloud';
  provider: ApiKeyProvider | 'local';
  model: string;
  baseUrl: string;
  apiKey?: string;
  maskedKey?: string;
}

export interface ExecuteHybridOptions {
  maxRetries?: number;
  onRetry?: (error: unknown, nextTarget: InferenceTarget, attempt: number) => void;
}

/**
 * Hybrid Inference Dispatcher
 * Manages a Hierarchical 2-Level Interleaved Rotation pool containing BOTH Local Model (llama-server)
 * and Cloud Provider Keys (Agnes, Gemini, OpenAI, OpenRouter) as equal peers.
 * Level 1: Provider Round-Robin (local -> agnes -> gemini -> openai -> openrouter -> local...)
 * Level 2: Key Rotator per Provider (Key 1 -> Key 2 -> Key 3...)
 * Auto-quarantines failed local instances for 30s and quota-exhausted cloud keys for 24 Hours (1 day).
 */
export class HybridInferenceDispatcher {
  private currentIndex = 0;
  private targetCooldowns = new Map<string, number>();
  private failureCounts = new Map<string, number>();
  private inFlightCounts = new Map<string, number>();

  /**
   * Reset all target cooldowns and in-flight counters.
   */
  resetHealth(): void {
    this.targetCooldowns.clear();
    this.failureCounts.clear();
    this.inFlightCounts.clear();
  }

  /**
   * Returns list of configured inference providers with their health and key stats.
   */
  getInferenceProviders(subsystem: 'llm' | 'vlm' = 'llm'): InferenceProviderInfo[] {
    const providers: InferenceProviderInfo[] = [];

    // 1. Local Provider
    if (subsystem === 'llm' && envConfig.USE_LOCAL_LLM) {
      const localId = `local:llama-server:${envConfig.LOCAL_LLM_PRIMARY_MODEL}`;
      const expiry = this.targetCooldowns.get(localId);
      const isCooldown = !!expiry && expiry > Date.now();
      providers.push({
        provider: 'local',
        type: 'local',
        model: envConfig.LOCAL_LLM_PRIMARY_MODEL,
        baseUrl: envConfig.LLM_BASE_URL.replace(/\/$/, ''),
        totalKeyCount: 1,
        activeKeyCount: isCooldown ? 0 : 1,
      });
    } else if (subsystem === 'vlm' && (envConfig.USE_LOCAL_LLM || envConfig.VLM_PROVIDER === 'local' || envConfig.VLM_PROVIDER === 'auto')) {
      const localId = `local:vlm-inspector:${envConfig.LOCAL_VLM_INSPECTOR || envConfig.LOCAL_LLM_PRIMARY_MODEL}`;
      const expiry = this.targetCooldowns.get(localId);
      const isCooldown = !!expiry && expiry > Date.now();
      providers.push({
        provider: 'local',
        type: 'local',
        model: envConfig.LOCAL_VLM_INSPECTOR || envConfig.LOCAL_LLM_PRIMARY_MODEL,
        baseUrl: (envConfig.VLM_BASE_URL || envConfig.LLM_BASE_URL).replace(/\/$/, ''),
        totalKeyCount: 1,
        activeKeyCount: isCooldown ? 0 : 1,
      });
    }

    // 2. Cloud Providers
    if (envConfig.ENABLE_CLOUD_FALLBACK && !envConfig.EVAL_STRICT) {
      const agnesRotator = getApiKeyRotator('agnes');
      if (agnesRotator.totalKeysCount > 0) {
        providers.push({
          provider: 'agnes',
          type: 'cloud',
          model: envConfig.REMOTE_FALLBACK_MODEL || 'agnes-2.5-flash',
          baseUrl: (envConfig.REMOTE_LLM_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, ''),
          totalKeyCount: agnesRotator.totalKeysCount,
          activeKeyCount: agnesRotator.activeKeysCount,
        });
      }

      const geminiRotator = getApiKeyRotator('gemini');
      if (geminiRotator.totalKeysCount > 0) {
        providers.push({
          provider: 'gemini',
          type: 'cloud',
          model: subsystem === 'vlm' ? (envConfig.GEMINI_VISION_MODEL || 'gemini-3.6-flash') : (envConfig.GEMINI_MODEL || 'gemini-3.6-flash'),
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          totalKeyCount: geminiRotator.totalKeysCount,
          activeKeyCount: geminiRotator.activeKeysCount,
        });
      }

      const openaiRotator = getApiKeyRotator('openai');
      if (openaiRotator.totalKeysCount > 0) {
        providers.push({
          provider: 'openai',
          type: 'cloud',
          model: envConfig.OPENAI_MODEL || envConfig.REMOTE_FALLBACK_MODEL || 'gpt-4o-mini',
          baseUrl: 'https://api.openai.com/v1',
          totalKeyCount: openaiRotator.totalKeysCount,
          activeKeyCount: openaiRotator.activeKeysCount,
        });
      }

      const openrouterRotator = getApiKeyRotator('openrouter');
      if (openrouterRotator.totalKeysCount > 0) {
        providers.push({
          provider: 'openrouter',
          type: 'cloud',
          model: envConfig.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
          baseUrl: (envConfig.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
          totalKeyCount: openrouterRotator.totalKeysCount,
          activeKeyCount: openrouterRotator.activeKeysCount,
        });
      }
    }

    return providers;
  }

  /**
   * Builds the current list of available inference targets (Local + configured Cloud keys)
   * in Hierarchical 2-Level Interleaved order.
   */
  getInferenceTargets(subsystem: 'llm' | 'vlm' = 'llm'): InferenceTarget[] {
    const providerGroups: InferenceTarget[][] = [];

    // 1. Local Model Target
    if (subsystem === 'llm' && envConfig.USE_LOCAL_LLM) {
      providerGroups.push([{
        id: `local:llama-server:${envConfig.LOCAL_LLM_PRIMARY_MODEL}`,
        type: 'local',
        provider: 'local',
        model: envConfig.LOCAL_LLM_PRIMARY_MODEL,
        baseUrl: envConfig.LLM_BASE_URL.replace(/\/$/, ''),
      }]);
    } else if (subsystem === 'vlm' && (envConfig.USE_LOCAL_LLM || envConfig.VLM_PROVIDER === 'local' || envConfig.VLM_PROVIDER === 'auto')) {
      providerGroups.push([{
        id: `local:vlm-inspector:${envConfig.LOCAL_VLM_INSPECTOR || envConfig.LOCAL_LLM_PRIMARY_MODEL}`,
        type: 'local',
        provider: 'local',
        model: envConfig.LOCAL_VLM_INSPECTOR || envConfig.LOCAL_LLM_PRIMARY_MODEL,
        baseUrl: (envConfig.VLM_BASE_URL || envConfig.LLM_BASE_URL).replace(/\/$/, ''),
      }]);
    }

    // 2. Cloud Model Targets (Agnes, Gemini, OpenAI, OpenRouter)
    if (envConfig.ENABLE_CLOUD_FALLBACK && !envConfig.EVAL_STRICT) {
      // Agnes Keys
      const agnesKeys = getApiKeyRotator('agnes').getAllKeys();
      if (agnesKeys.length > 0) {
        providerGroups.push(
          agnesKeys.map((k) => ({
            id: `cloud:agnes:${maskApiKey(k)}`,
            type: 'cloud' as const,
            provider: 'agnes' as const,
            model: envConfig.REMOTE_FALLBACK_MODEL || 'agnes-2.5-flash',
            baseUrl: (envConfig.REMOTE_LLM_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, ''),
            apiKey: k,
            maskedKey: maskApiKey(k),
          }))
        );
      }

      // Gemini Keys
      const geminiKeys = getApiKeyRotator('gemini').getAllKeys();
      if (geminiKeys.length > 0) {
        providerGroups.push(
          geminiKeys.map((k) => ({
            id: `cloud:gemini:${maskApiKey(k)}`,
            type: 'cloud' as const,
            provider: 'gemini' as const,
            model: subsystem === 'vlm' ? (envConfig.GEMINI_VISION_MODEL || 'gemini-3.6-flash') : (envConfig.GEMINI_MODEL || 'gemini-3.6-flash'),
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
            apiKey: k,
            maskedKey: maskApiKey(k),
          }))
        );
      }

      // OpenAI Keys
      const openaiKeys = getApiKeyRotator('openai').getAllKeys();
      if (openaiKeys.length > 0) {
        providerGroups.push(
          openaiKeys.map((k) => ({
            id: `cloud:openai:${maskApiKey(k)}`,
            type: 'cloud' as const,
            provider: 'openai' as const,
            model: envConfig.OPENAI_MODEL || (envConfig.REMOTE_FALLBACK_MODEL !== 'agnes-2.5-flash' ? envConfig.REMOTE_FALLBACK_MODEL : 'gpt-4o-mini'),
            baseUrl: 'https://api.openai.com/v1',
            apiKey: k,
            maskedKey: maskApiKey(k),
          }))
        );
      }

      // OpenRouter Keys
      const openrouterKeys = getApiKeyRotator('openrouter').getAllKeys();
      if (openrouterKeys.length > 0) {
        providerGroups.push(
          openrouterKeys.map((k) => ({
            id: `cloud:openrouter:${maskApiKey(k)}`,
            type: 'cloud' as const,
            provider: 'openrouter' as const,
            model: envConfig.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
            baseUrl: (envConfig.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
            apiKey: k,
            maskedKey: maskApiKey(k),
          }))
        );
      }
    }

    if (providerGroups.length === 0) return [];

    // Interleave across providers:
    const maxKeys = Math.max(...providerGroups.map((g) => g.length));
    const interleavedTargets: InferenceTarget[] = [];
    for (let round = 0; round < maxKeys; round++) {
      for (const group of providerGroups) {
        interleavedTargets.push(group[round % group.length]);
      }
    }

    return interleavedTargets;
  }

  /**
   * Check if a specific target is currently active (not in cooldown and within concurrency limit).
   */
  isTargetActive(target: InferenceTarget): boolean {
    const now = Date.now();
    const expiry = this.targetCooldowns.get(target.id);
    if (expiry && expiry > now) return false;

    // Per-target in-flight load shedding for local instances
    if (target.type === 'local') {
      const maxLocalConcurrency = (envConfig && (envConfig as any).LOCAL_LLM_MAX_CONCURRENCY) || 2;
      const inFlight = this.inFlightCounts.get(target.id) || 0;
      if (inFlight >= maxLocalConcurrency) return false;
    }

    if (target.type === 'cloud' && target.apiKey && target.provider !== 'local') {
      const rotator = getApiKeyRotator(target.provider as ApiKeyProvider);
      return rotator.isKeyActive(target.apiKey);
    }

    return true;
  }

  /**
   * Get active (non-quarantined) targets in interleaved order.
   */
  getActiveTargets(subsystem: 'llm' | 'vlm' = 'llm'): InferenceTarget[] {
    const all = this.getInferenceTargets(subsystem);
    return all.filter((t) => this.isTargetActive(t));
  }

  /**
   * Get the next inference target in Hierarchical 2-Level Interleaved order.
   */
  getNextTarget(subsystem: 'llm' | 'vlm' = 'llm'): InferenceTarget | undefined {
    const all = this.getInferenceTargets(subsystem);
    if (all.length === 0) return undefined;

    const active = this.getActiveTargets(subsystem);
    if (active.length > 0) {
      const selected = active[this.currentIndex % active.length];
      this.currentIndex = (this.currentIndex + 1) % Number.MAX_SAFE_INTEGER;
      return selected;
    }

    // All targets in cooldown or busy: pick the earliest recovering target
    let earliest = all[0];
    let earliestExpiry = this.targetCooldowns.get(earliest.id) || 0;
    for (const t of all) {
      const expiry = this.targetCooldowns.get(t.id) || 0;
      if (expiry < earliestExpiry) {
        earliestExpiry = expiry;
        earliest = t;
      }
    }
    return earliest;
  }

  reportTargetSuccess(target: InferenceTarget): void {
    this.targetCooldowns.delete(target.id);
    this.failureCounts.set(target.id, 0);
    clearQuarantineFromRedis('target', target.id).catch(() => {});
    if (target.type === 'cloud' && target.apiKey && target.provider !== 'local') {
      reportKeySuccess(target.provider as ApiKeyProvider, target.apiKey);
    }
  }

  reportTargetFailure(target: InferenceTarget, errorOrStatus?: unknown): void {
    if (target.type === 'local' && isClientSidePayloadError(errorOrStatus)) {
      log.debug('dispatcher.local_client_error_ignored', `Local model target [${target.id}] encountered client payload error; skipped quarantine`);
      return;
    }

    const currentFailures = (this.failureCounts.get(target.id) || 0) + 1;
    this.failureCounts.set(target.id, currentFailures);

    if (target.type === 'local') {
      const hasCloudTargets =
        hasAvailableApiKeys('gemini') ||
        hasAvailableApiKeys('agnes') ||
        hasAvailableApiKeys('openrouter') ||
        hasAvailableApiKeys('openai');

      // If cloud fallback is available and not in EVAL_STRICT, cooldown for 20s to allow Cloud failover.
      // If pure local or EVAL_STRICT (no cloud fallback), use short 2s cooldown to re-probe without long lockouts.
      const cooldownMs = (hasCloudTargets && !envConfig.EVAL_STRICT) ? 20000 : 2000;
      this.targetCooldowns.set(target.id, Date.now() + cooldownMs);
      persistQuarantineToRedis('target', target.id, cooldownMs, {
        provider: 'local',
        reason: 'Local model unreachable/busy/timeout',
      }).catch(() => {});
      log.warn('dispatcher.local_cooldown', `Local model target [${target.id}] unreachable/failed; quarantined for ${cooldownMs}ms before re-probing`, {
        targetId: target.id,
        cooldownMs,
        hasCloudFallback: hasCloudTargets,
      });
    } else {
      // Cloud Key failure: fine-grained classification
      const classification = classifyErrorCooldown(errorOrStatus, currentFailures);
      const cooldownMs = classification.cooldownMs;

      this.targetCooldowns.set(target.id, Date.now() + cooldownMs);
      persistQuarantineToRedis('target', target.id, cooldownMs, {
        provider: target.provider,
        reason: classification.reason,
      }).catch(() => {});

      if (target.apiKey && target.provider !== 'local') {
        reportKeyFailure(target.provider as ApiKeyProvider, target.apiKey, errorOrStatus);
      }

      if (classification.isDailyQuarantine) {
        log.warn('dispatcher.cloud_key_1day_cooldown', `Cloud Key [${target.maskedKey || target.id}] marked INACTIVE for 24 HOURS (1 day) due to quota/auth error`, {
          targetId: target.id,
          provider: target.provider,
          quarantineExpiresAt: new Date(Date.now() + cooldownMs).toISOString(),
          cooldownMs,
          reason: classification.reason,
        });
      } else {
        log.warn('dispatcher.cloud_target_transient_cooldown', `Cloud target [${target.maskedKey || target.id}] experienced transient error (${classification.reason}); quarantined for ${cooldownMs}ms before re-probing`, {
          targetId: target.id,
          provider: target.provider,
          cooldownMs,
          reason: classification.reason,
        });
      }
    }
  }

  /**
   * Execute inference with automatic interleaved round-robin across Local + Cloud targets,
   * with in-flight failover and concurrency protection for local inference.
   */
  async executeWithHybridRotation<T>(
    subsystem: 'llm' | 'vlm',
    fn: (target: InferenceTarget) => Promise<T>,
    options: ExecuteHybridOptions = {}
  ): Promise<T> {
    const targets = this.getInferenceTargets(subsystem);
    if (targets.length === 0) {
      throw new Error(`[HybridInferenceDispatcher] No active inference targets configured for ${subsystem}.`);
    }

    const maxAttempts = options.maxRetries ? Math.max(1, options.maxRetries) : Math.min(4, Math.max(1, targets.length));
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const target = this.getNextTarget(subsystem);
      if (!target) {
        throw new Error(`[HybridInferenceDispatcher] Failed to acquire next target for ${subsystem}.`);
      }

      this.inFlightCounts.set(target.id, (this.inFlightCounts.get(target.id) || 0) + 1);

      try {
        const result = await fn(target);
        this.reportTargetSuccess(target);
        return result;
      } catch (err: any) {
        lastError = err;
        this.reportTargetFailure(target, err);

        const conciseError = formatConciseError(err);
        log.warn('dispatcher.attempt_failed', `Target [${target.id}] failed (attempt ${attempt}/${maxAttempts}): ${conciseError}`, {
          targetId: target.id,
          attempt,
          maxAttempts,
          reason: conciseError,
        });

        if (options.onRetry && attempt < maxAttempts) {
          try {
            const nextCandidate = this.getNextTarget(subsystem);
            if (nextCandidate) {
              options.onRetry(err, nextCandidate, attempt);
            }
          } catch {}
        }
      } finally {
        const inFlight = this.inFlightCounts.get(target.id) || 0;
        if (inFlight <= 1) {
          this.inFlightCounts.delete(target.id);
        } else {
          this.inFlightCounts.set(target.id, inFlight - 1);
        }
      }
    }

    throw lastError || new Error(`[HybridInferenceDispatcher] All ${maxAttempts} inference targets failed for ${subsystem}.`);
  }
}

export const hybridInferenceDispatcher = new HybridInferenceDispatcher();
