import { createLogger } from './logger.js';
import { envConfig } from './config.js';
import {
  getRotatorRedisClient,
  persistQuarantineToRedis,
  clearQuarantineFromRedis,
  syncQuarantinesFromRedis,
} from './storage/redis-quarantine.js';
import { ProviderRateLimiter } from './provider-rate-limiter.js';
import {
  InferenceProviderInfo,
  InferenceTarget,
  ExecuteHybridOptions,
  HybridInferenceDispatcher,
  hybridInferenceDispatcher,
} from './dispatchers/hybrid-inference-dispatcher.js';

const log = createLogger({ service: 'api-key-rotator' });

// Re-export storage, rate limiter, and dispatcher symbols for full backward compatibility
export {
  getRotatorRedisClient,
  persistQuarantineToRedis,
  clearQuarantineFromRedis,
  syncQuarantinesFromRedis,
} from './storage/redis-quarantine.js';
export { ProviderRateLimiter } from './provider-rate-limiter.js';
export {
  InferenceProviderInfo,
  InferenceTarget,
  ExecuteHybridOptions,
  HybridInferenceDispatcher,
  hybridInferenceDispatcher,
} from './dispatchers/hybrid-inference-dispatcher.js';

export type ApiKeyProvider =
  | 'agnes'
  | 'gemini'
  | 'tavily'
  | 'serpapi'
  | 'brave'
  | 'openai'
  | 'openrouter'
  | (string & {});

export interface KeyHealthInfo {
  maskedKey: string;
  isQuarantined: boolean;
  cooldownRemainingMs: number;
  failureCount: number;
  successCount: number;
}

export interface RotatorSummary {
  provider: string;
  totalKeys: number;
  activeKeys: number;
  quarantinedKeys: number;
  keys: KeyHealthInfo[];
}

export interface ExecuteKeyRotationOptions {
  /** Maximum number of keys to attempt before throwing error (Default: total available keys) */
  maxRetries?: number;
  /** Custom callback before retrying with the next rotated key */
  onRetry?: (error: unknown, nextKey: string, attempt: number) => void;
}

/**
 * Mask an API key for safe logging (e.g. "sk-abc...1234" -> "sk-***1234").
 */
export function maskApiKey(key?: string | null): string {
  if (!key) return '<empty>';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '***';

  const prefix = trimmed.startsWith('sk-')
    ? 'sk-'
    : trimmed.startsWith('tvly-')
      ? 'tvly-'
      : trimmed.startsWith('AQ')
        ? 'AQ'
        : trimmed.slice(0, 3);

  const suffix = trimmed.slice(-4);
  return `${prefix}***${suffix}`;
}

/**
 * Check if a raw API key string is viable (not empty, not dummy placeholder).
 */
export function isViableApiKey(key?: string | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();

  if (trimmed.length < 6) return false;

  // Filter known placeholder patterns
  if (
    trimmed.includes('your_') ||
    trimmed.includes('api_key_here') ||
    trimmed.includes('example') ||
    trimmed.endsWith('...') ||
    trimmed === 'sk-...' ||
    trimmed === 'tvly...' ||
    trimmed === 'AQ...'
  ) {
    return false;
  }

  return true;
}

/**
 * Parse and sanitize a raw key config (comma/semicolon-separated string or array).
 */
export function parseAndSanitizeApiKeys(raw?: string | string[] | null): string[] {
  if (!raw) return [];

  const rawList: string[] = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(/[,;\n]+/)
        .map((k) => k.trim());

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const candidate of rawList) {
    const trimmed = candidate.trim();
    if (isViableApiKey(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed);
      sanitized.push(trimmed);
    }
  }

  return sanitized;
}

export interface ClassifiedCooldown {
  isDailyQuarantine: boolean;
  cooldownMs: number;
  reason: string;
}

/**
 * Clean and sanitize HTTP error responses from LLM endpoints.
 * Extracts title or concise message if HTML error page is received (e.g. Cloudflare 504),
 * extracts inner message if JSON error, and keeps it single-line.
 */
export function sanitizeHttpErrorResponse(
  status: number,
  statusText: string,
  bodyText: string,
  providerOrUrl?: string
): string {
  const providerPrefix = providerOrUrl ? `(${providerOrUrl}) ` : '';
  if (!bodyText || typeof bodyText !== 'string') {
    return `${providerPrefix}HTTP ${status}: ${statusText || 'Unknown Error'}`;
  }

  // 1. Detect HTML error pages (e.g. Cloudflare 504 / 502 / Nginx HTML)
  if (/<(?:!doctype\s+html|html|head|body)/i.test(bodyText)) {
    const titleMatch = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const rawTitle = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';
    const h1Match = bodyText.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const rawH1 = h1Match ? h1Match[1].trim().replace(/\s+/g, ' ') : '';
    const summary = [rawTitle, rawH1].filter(Boolean).join(' - ');
    return `${providerPrefix}HTTP ${status} (${statusText || 'Error'}): ${summary || 'Gateway/Web Error HTML Page'}`;
  }

  // 2. Detect JSON error responses
  const jsonMatch = bodyText.match(/\[?\s*\{[\s\S]*\}\s*\]?/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      const innerMsg = obj?.error?.message || obj?.message || (typeof obj?.error === 'string' ? obj.error : '');
      if (innerMsg && typeof innerMsg === 'string') {
        const cleanInner = innerMsg.trim().replace(/\s+/g, ' ');
        return `${providerPrefix}HTTP ${status}: ${cleanInner.slice(0, 180)}`;
      }
    } catch {}
  }

  // 3. Fallback: single-line plain text
  let clean = bodyText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length > 180) {
    clean = clean.slice(0, 177) + '...';
  }
  return `${providerPrefix}HTTP ${status} ${statusText}: ${clean}`;
}

/**
 * Format any error into a concise, single-line summary (max ~140 chars)
 * without dumping raw multiline JSON bodies, HTML pages, or full stack traces into stdout.
 */
export function formatConciseError(err: unknown): string {
  if (!err) return 'Unknown error';
  let raw = err instanceof Error ? err.message : String(err);

  // If raw message contains HTML, extract title or strip tags
  if (/<(?:!doctype\s+html|html|head|body)/i.test(raw)) {
    const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : 'HTML Gateway Error';
    raw = raw.replace(/<!DOCTYPE html>[\s\S]*<\/html>/i, title).replace(/<html[\s\S]*<\/html>/i, title);
  }

  // Strip remaining HTML tags
  raw = raw.replace(/<[^>]+>/g, ' ');

  // Try extracting error message from JSON substring
  const jsonMatch = raw.match(/\[?\s*\{[\s\S]*\}\s*\]?/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      const innerMsg = obj?.error?.message || obj?.message || (typeof obj?.error === 'string' ? obj.error : '');
      if (innerMsg && typeof innerMsg === 'string') {
        const prefix = raw.slice(0, jsonMatch.index).trim();
        raw = prefix ? `${prefix}: ${innerMsg}` : innerMsg;
      }
    } catch {}
  }

  // Collapse multiple whitespaces and newlines
  let clean = raw.replace(/\s+/g, ' ').trim();
  if (clean.length > 140) {
    clean = clean.slice(0, 137) + '...';
  }
  return clean;
}

/**
 * Classify whether an error is due to daily quota/auth exhaustion (24h)
 * versus a transient rate-limit / retry-after / 5xx / timeout error.
 */
export function classifyErrorCooldown(errorOrStatus?: unknown, failureCount: number = 1): ClassifiedCooldown {
  let statusCode = 0;
  let errMsg = '';

  if (typeof errorOrStatus === 'number') {
    statusCode = errorOrStatus;
  } else if (errorOrStatus && typeof errorOrStatus === 'object') {
    const errObj = errorOrStatus as any;
    statusCode = errObj.status || errObj.statusCode || errObj.response?.status || 0;
    errMsg = errObj.message || String(errObj);
  } else if (typeof errorOrStatus === 'string') {
    errMsg = errorOrStatus;
  }

  const dailyCooldownMs = (envConfig && envConfig.DAILY_KEY_QUARANTINE_MS) || 86400000;

  // 1. Auth Errors (401 Unauthorized, 403 Forbidden) -> 24h Quarantine
  if (statusCode === 401 || statusCode === 403 || /unauthorized|forbidden|invalid[_\s]api[_\s]key/i.test(errMsg)) {
    return {
      isDailyQuarantine: true,
      cooldownMs: dailyCooldownMs,
      reason: `auth_error_${statusCode || 'unauthorized'}`,
    };
  }

  // 2. Model Not Found / Invalid Slug / Deprecated Model (404 Not Found) -> 24h Quarantine
  if (
    statusCode === 404 ||
    /not found|model is unavailable|no such model|does not exist|use this slug instead/i.test(errMsg)
  ) {
    return {
      isDailyQuarantine: true,
      cooldownMs: dailyCooldownMs,
      reason: 'model_not_found_or_deprecated_404',
    };
  }

  // 3. Payment Required / Depleted Credits (402 Payment Required) -> 24h Quarantine
  if (statusCode === 402 || /payment_required|insufficient_credits|requires more credits/i.test(errMsg)) {
    return {
      isDailyQuarantine: true,
      cooldownMs: dailyCooldownMs,
      reason: 'payment_required_credit_exhausted',
    };
  }

  // 4. Rate Limit / Quota Exceeded (429 / RESOURCE_EXHAUSTED)
  const is429 = statusCode === 429 || /429|resource_exhausted|too many requests|rate\s*limit/i.test(errMsg);
  if (is429) {
    // Check if it is an explicit Daily/Monthly quota exhaustion
    const isExplicitDailyLimit = /GenerateRequestsPerDay|PerDay|per_day|daily[_\s]*quota|daily|monthly|insufficient_quota|quota exceeded for metric/i.test(errMsg);
    
    // Check for short retry hints (e.g., "retry in 5.19s", "retry in 39s", "retryDelay: 5s")
    const retryMatch = errMsg.match(/retry(?:ing)?\s+in\s+([0-9.]+)\s*s/i) || errMsg.match(/retryDelay"?\s*:\s*"?([0-9.]+)\s*s?/i);
    if (retryMatch && retryMatch[1]) {
      const retrySec = parseFloat(retryMatch[1]);
      if (Number.isFinite(retrySec) && retrySec > 0 && retrySec <= 120) {
        const cooldownMs = Math.min(120000, Math.max(10000, Math.ceil(retrySec * 1000) + 2000));
        return {
          isDailyQuarantine: false,
          cooldownMs,
          reason: `transient_rate_limit_retry_${Math.round(retrySec)}s`,
        };
      }
    }

    if (isExplicitDailyLimit) {
      return {
        isDailyQuarantine: true,
        cooldownMs: dailyCooldownMs,
        reason: 'daily_quota_exhausted_24h',
      };
    }

    // Standard transient rate-limit (RPM): 15s to 45s adaptive backoff
    const burstCooldownMs = Math.min(60000, 15000 * Math.max(1, failureCount));
    return {
      isDailyQuarantine: false,
      cooldownMs: burstCooldownMs,
      reason: `burst_rate_limit_${burstCooldownMs / 1000}s`,
    };
  }

  // 5. Temporary Server Overload / High Demand (503 Service Unavailable)
  if (statusCode === 503 || /503|high demand|spikes in demand|temporarily unavailable/i.test(errMsg)) {
    return {
      isDailyQuarantine: false,
      cooldownMs: 20000,
      reason: 'upstream_service_503_high_demand',
    };
  }

  // 6. Timeouts (504 / AbortError / TimeoutError)
  if (statusCode === 504 || /timeout|abort|etimedout/i.test(errMsg)) {
    return {
      isDailyQuarantine: false,
      cooldownMs: 15000,
      reason: 'inference_timeout_15s',
    };
  }

  // 7. Generic transient network/5xx error
  const transientCooldownMs = Math.min(60000, 10000 * Math.max(1, failureCount));
  return {
    isDailyQuarantine: false,
    cooldownMs: transientCooldownMs,
    reason: `transient_error_${transientCooldownMs / 1000}s`,
  };
}

/**
 * Helper to classify whether an error is due to quota/rate limit/auth exhaustion (24h)
 * versus a transient network / 5xx error (short cooldown).
 */
export function isQuotaOrAuthExhaustion(errorOrStatus?: unknown): boolean {
  return classifyErrorCooldown(errorOrStatus, 1).isDailyQuarantine;
}

/**
 * Core ApiKeyRotator class managing round-robin pointer and cooldown health states.
 */
export class ApiKeyRotator {
  readonly provider: string;
  private keys: string[] = [];
  private currentIndex = 0;
  private cooldownMap = new Map<string, number>(); // key -> cooldown expiry timestamp (ms)
  private failureCountMap = new Map<string, number>();
  private successCountMap = new Map<string, number>();

  constructor(provider: string, initialKeys?: string | string[]) {
    this.provider = provider;
    if (initialKeys) {
      this.setKeys(initialKeys);
    }
  }

  /**
   * Replace or initialize keys for this rotator.
   */
  setKeys(keys: string | string[]): void {
    this.keys = parseAndSanitizeApiKeys(keys);
    // Reset index if out of bounds
    if (this.keys.length > 0) {
      this.currentIndex = this.currentIndex % this.keys.length;
      syncQuarantinesFromRedis(this.provider, this.keys, this.cooldownMap).catch(() => {});
    } else {
      this.currentIndex = 0;
    }
  }

  /**
   * Append new keys to the existing rotator pool without losing current index or health stats.
   */
  addKeys(keys: string | string[]): void {
    const newKeys = parseAndSanitizeApiKeys(keys);
    const existingSet = new Set(this.keys);
    for (const k of newKeys) {
      if (!existingSet.has(k)) {
        this.keys.push(k);
        existingSet.add(k);
      }
    }
    syncQuarantinesFromRedis(this.provider, this.keys, this.cooldownMap).catch(() => {});
  }

  /**
   * Get all registered valid keys.
   */
  getAllKeys(): string[] {
    return [...this.keys];
  }

  /**
   * Total number of configured valid keys.
   */
  get totalKeysCount(): number {
    return this.keys.length;
  }

  /**
   * Get currently active (non-quarantined) keys.
   */
  getActiveKeys(): string[] {
    const now = Date.now();
    return this.keys.filter((key) => {
      const expiry = this.cooldownMap.get(key);
      return !expiry || expiry <= now;
    });
  }

  /**
   * Number of currently active (non-quarantined) keys.
   */
  get activeKeysCount(): number {
    return this.getActiveKeys().length;
  }

  /**
   * Check if a specific key is currently active (not in cooldown).
   */
  isKeyActive(key: string): boolean {
    const now = Date.now();
    const expiry = this.cooldownMap.get(key);
    return !expiry || expiry <= now;
  }

  /**
   * Check if at least one key is available.
   */
  hasAvailableKeys(): boolean {
    return this.keys.length > 0;
  }

  /**
   * Get the next key using exact Round-Robin order.
   * If all keys are currently in cooldown, gracefully returns the key whose cooldown expires earliest.
   */
  getNextKey(): string | undefined {
    if (this.keys.length === 0) {
      return undefined;
    }

    const activeKeys = this.getActiveKeys();

    if (activeKeys.length > 0) {
      const selectedKey = activeKeys[this.currentIndex % activeKeys.length];
      this.currentIndex = (this.currentIndex + 1) % Number.MAX_SAFE_INTEGER;
      return selectedKey;
    }

    // All keys in cooldown: pick the key that will recover earliest
    log.warn('rotator.all_keys_in_cooldown', `All keys for provider [${this.provider}] are in cooldown; picking earliest recovering key`, {
      provider: this.provider,
      totalKeys: this.keys.length,
    });

    let earliestKey = this.keys[0];
    let earliestExpiry = this.cooldownMap.get(earliestKey) || 0;

    for (const key of this.keys) {
      const expiry = this.cooldownMap.get(key) || 0;
      if (expiry < earliestExpiry) {
        earliestExpiry = expiry;
        earliestKey = key;
      }
    }

    return earliestKey;
  }

  /**
   * Report a successful API call for a key to reset failure counters and clear cooldown.
   */
  reportSuccess(key: string): void {
    if (!key) return;
    this.cooldownMap.delete(key);
    this.failureCountMap.set(key, 0);
    this.successCountMap.set(key, (this.successCountMap.get(key) || 0) + 1);
    clearQuarantineFromRedis(this.provider, key).catch(() => {});
  }

  /**
   * Report a failure for an API key to trigger automatic quarantine/cooldown.
   */
  reportFailure(key: string, errorOrStatus?: unknown): void {
    if (!key) return;

    const currentFailures = (this.failureCountMap.get(key) || 0) + 1;
    this.failureCountMap.set(key, currentFailures);

    let statusCode = 0;
    let errMsg = '';

    if (typeof errorOrStatus === 'number') {
      statusCode = errorOrStatus;
    } else if (errorOrStatus && typeof errorOrStatus === 'object') {
      const errObj = errorOrStatus as any;
      statusCode = errObj.status || errObj.statusCode || errObj.response?.status || 0;
      errMsg = errObj.message || String(errObj);
    } else if (typeof errorOrStatus === 'string') {
      errMsg = errorOrStatus;
    }

    // Determine Cooldown Duration via fine-grained classifier:
    const classification = classifyErrorCooldown(errorOrStatus, currentFailures);
    const cooldownMs = classification.cooldownMs;

    if (classification.isDailyQuarantine) {
      log.warn('rotator.key_quota_auth_1day', `API key for [${this.provider}] marked INACTIVE for 24 HOURS (1 day) due to quota/rate limit/auth error`, {
        provider: this.provider,
        maskedKey: maskApiKey(key),
        cooldownMs,
        quarantinedUntil: new Date(Date.now() + cooldownMs).toISOString(),
        reason: classification.reason,
      });
    } else {
      log.debug('rotator.key_transient_cooldown', `API key for [${this.provider}] transiently cooled down for ${cooldownMs}ms (${classification.reason})`, {
        provider: this.provider,
        maskedKey: maskApiKey(key),
        cooldownMs,
        reason: classification.reason,
      });
    }

    this.cooldownMap.set(key, Date.now() + cooldownMs);
    persistQuarantineToRedis(this.provider, key, cooldownMs, {
      provider: this.provider,
      reason: errMsg || classification.reason || String(statusCode),
    }).catch(() => {});
  }

  /**
   * Inspect current health summary of all keys in this rotator.
   */
  getSummary(): RotatorSummary {
    const now = Date.now();
    const activeKeys = this.getActiveKeys();
    const keySummaries: KeyHealthInfo[] = this.keys.map((key) => {
      const expiry = this.cooldownMap.get(key) || 0;
      const isQuarantined = expiry > now;
      return {
        maskedKey: maskApiKey(key),
        isQuarantined,
        cooldownRemainingMs: isQuarantined ? Math.max(0, expiry - now) : 0,
        failureCount: this.failureCountMap.get(key) || 0,
        successCount: this.successCountMap.get(key) || 0,
      };
    });

    return {
      provider: this.provider,
      totalKeys: this.keys.length,
      activeKeys: activeKeys.length,
      quarantinedKeys: this.keys.length - activeKeys.length,
      keys: keySummaries,
    };
  }
}

/**
 * Global Registry holding rotators for all standard providers.
 */
class ApiKeyRotatorRegistry {
  private rotators = new Map<string, ApiKeyRotator>();

  getRotator(provider: ApiKeyProvider): ApiKeyRotator {
    const key = String(provider).toLowerCase();
    let rotator = this.rotators.get(key);
    if (!rotator) {
      rotator = new ApiKeyRotator(key);
      this.rotators.set(key, rotator);
      this.populateFromEnv(key, rotator);
    }
    return rotator;
  }

  private populateFromEnv(provider: string, rotator: ApiKeyRotator): void {
    const p = provider.toLowerCase();
    if (p === 'agnes') {
      const keys = (envConfig as any).AGNES_API_KEYS || envConfig.AGNES_API_KEY || (process.env.AGNES_API_KEYS || process.env.AGNES_API_KEY);
      rotator.setKeys(keys);
    } else if (p === 'gemini') {
      const keys = (envConfig as any).GEMINI_API_KEYS || envConfig.GEMINI_API_KEY || (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY);
      rotator.setKeys(keys);
    } else if (p === 'tavily') {
      const keys = (envConfig as any).TAVILY_API_KEYS || envConfig.TAVILY_API_KEY || (process.env.TAVILY_API_KEYS || process.env.TAVILY_API_KEY);
      rotator.setKeys(keys);
    } else if (p === 'serpapi') {
      const keys = (envConfig as any).SERPAPI_API_KEYS || envConfig.SERPAPI_API_KEY || (process.env.SERPAPI_API_KEYS || process.env.SERPAPI_API_KEY);
      rotator.setKeys(keys);
    } else if (p === 'brave') {
      const keys = (envConfig as any).BRAVE_API_KEYS || envConfig.BRAVE_API_KEY || (process.env.BRAVE_API_KEYS || process.env.BRAVE_API_KEY);
      rotator.setKeys(keys);
    } else if (p === 'openai') {
      const keys = (envConfig as any).OPENAI_API_KEYS || envConfig.OPENAI_API_KEY || (process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY);
      rotator.setKeys(keys);
    } else if (p === 'openrouter') {
      const keys = (envConfig as any).OPENROUTER_API_KEYS || envConfig.OPENROUTER_API_KEY || (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY);
      rotator.setKeys(keys);
    } else {
      const envKey = `${p.toUpperCase()}_API_KEYS`;
      const envSingleKey = `${p.toUpperCase()}_API_KEY`;
      const keys = (envConfig as any)[envKey] || (envConfig as any)[envSingleKey] || (process.env as any)[envKey] || (process.env as any)[envSingleKey];
      if (keys) {
        rotator.setKeys(keys);
      }
    }
  }

  /**
   * Re-sync all rotators from envConfig / process.env.
   */
  syncFromEnv(): void {
    for (const [provider, rotator] of this.rotators.entries()) {
      this.populateFromEnv(provider, rotator);
    }
  }
}

export const apiKeyRotatorRegistry = new ApiKeyRotatorRegistry();

/**
 * Get the ApiKeyRotator instance for a specific provider.
 */
export function getApiKeyRotator(provider: ApiKeyProvider): ApiKeyRotator {
  return apiKeyRotatorRegistry.getRotator(provider);
}

/**
 * Get the next rotated API key for a provider.
 */
export function getNextApiKey(provider: ApiKeyProvider): string | undefined {
  return getApiKeyRotator(provider).getNextKey();
}

/**
 * Check whether a provider has any valid API keys configured.
 */
export function hasAvailableApiKeys(provider: ApiKeyProvider): boolean {
  return getApiKeyRotator(provider).hasAvailableKeys();
}

/**
 * Report a successful request with a key.
 */
export function reportKeySuccess(provider: ApiKeyProvider, key: string): void {
  getApiKeyRotator(provider).reportSuccess(key);
}

/**
 * Report a failed request with a key.
 */
export function reportKeyFailure(provider: ApiKeyProvider, key: string, errorOrStatus?: unknown): void {
  getApiKeyRotator(provider).reportFailure(key, errorOrStatus);
}

/**
 * High-level helper: Execute an asynchronous action with automatic round-robin rotation,
 * error tracking, proactive rate-limiting, and failover retry on rate-limit (429) or quota errors.
 */
export async function executeWithKeyRotation<T>(
  provider: ApiKeyProvider,
  fn: (apiKey: string) => Promise<T>,
  options: ExecuteKeyRotationOptions = {}
): Promise<T> {
  const rotator = getApiKeyRotator(provider);
  const totalKeys = rotator.totalKeysCount;

  if (totalKeys === 0) {
    throw new Error(`[ApiKeyRotator] No valid API keys configured for provider [${provider}].`);
  }

  const maxAttempts = options.maxRetries ? Math.max(1, options.maxRetries) : Math.max(1, totalKeys);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const key = rotator.getNextKey();
    if (!key) {
      throw new Error(`[ApiKeyRotator] Failed to retrieve next key for provider [${provider}].`);
    }

    try {
      // Apply proactive rate limiting before invoking API
      await ProviderRateLimiter.acquireSlot(provider);

      const result = await fn(key);
      rotator.reportSuccess(key);
      return result;
    } catch (err: any) {
      lastError = err;
      rotator.reportFailure(key, err);

      log.warn('rotator.attempt_failed', `Call for provider [${provider}] failed with key [${maskApiKey(key)}] (attempt ${attempt}/${maxAttempts})`, {
        provider,
        attempt,
        maxAttempts,
        maskedKey: maskApiKey(key),
        error: err instanceof Error ? err.message : String(err),
      });

      // Fast-fail key rotation on client timeouts / abort errors to prevent multiplying latency by total keys
      const isAbortOrTimeout = err?.name === 'AbortError' || /This operation was aborted|timeout|ETIMEDOUT/i.test(err?.message || '');
      if (isAbortOrTimeout) {
        log.warn('rotator.abort_failfast', `Fast-failing key rotation for provider [${provider}] due to timeout/abort error`, {
          provider,
          attempt,
          maskedKey: maskApiKey(key),
        });
        throw err;
      }

      if (options.onRetry && attempt < maxAttempts) {
        try {
          const nextKeyCandidate = rotator.getNextKey() || '';
          options.onRetry(err, nextKeyCandidate, attempt);
        } catch (_cbErr) {
          // Ignore callback errors
        }
      }
    }
  }

  throw lastError || new Error(`[ApiKeyRotator] All ${maxAttempts} attempts failed for provider [${provider}].`);
}

/**
 * Flush all active quarantines in Redis & in-memory cache monorepo-wide.
 */
export async function flushAllQuarantines(): Promise<void> {
  const client = getRotatorRedisClient();
  if (client) {
    try {
      const keys = await client.keys('chronoviet:quarantine:*');
      if (keys.length > 0) {
        await client.del(...keys);
        log.info('rotator.redis_quarantine_flushed', `Deleted ${keys.length} quarantine entries from Redis`);
      }
    } catch (err: any) {
      log.warn('rotator.redis_flush_error', `Failed to flush Redis quarantines: ${err.message}`);
    }
  }
  hybridInferenceDispatcher.resetHealth();
  apiKeyRotatorRegistry.syncFromEnv();
}
