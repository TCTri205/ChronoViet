import * as crypto from 'crypto';
import Redis from 'ioredis';
import { createLogger } from './logger.js';
import { envConfig } from './config.js';

const log = createLogger({ service: 'api-key-rotator' });

let rotatorRedisClient: Redis | null = null;
let redisInitAttempted = false;

/**
 * Get or initialize a non-blocking Redis client for API Key & Target Quarantine Persistence.
 */
export function getRotatorRedisClient(): Redis | null {
  if (rotatorRedisClient) return rotatorRedisClient;
  if (redisInitAttempted) return null;

  try {
    const redisUrl = (envConfig && envConfig.REDIS_URL) || process.env.REDIS_URL || 'redis://localhost:6379';
    if (!redisUrl) {
      redisInitAttempted = true;
      return null;
    }

    rotatorRedisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 2 ? null : 100),
    });

    rotatorRedisClient.on('error', (err) => {
      log.debug('rotator.redis_error', `Redis rotator client connection notice: ${err.message}`);
    });

    // Initiate non-blocking connection
    rotatorRedisClient.connect().catch((_err) => {
      // Offline fallback: ignore connection failure, in-memory works 100%
    });

    return rotatorRedisClient;
  } catch (err: any) {
    redisInitAttempted = true;
    log.debug('rotator.redis_init_failed', `Redis init skipped: ${err.message}`);
    return null;
  }
}

function hashKeyForStorage(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Persist a quarantine entry to Redis with millisecond TTL (PX).
 */
export async function persistQuarantineToRedis(
  namespace: string,
  identifier: string,
  cooldownMs: number,
  metadata: { provider: string; reason?: string }
): Promise<void> {
  const client = getRotatorRedisClient();
  if (!client) return;

  const keyHash = hashKeyForStorage(identifier);
  const redisKey = `chronoviet:quarantine:${namespace}:${keyHash}`;
  const payload = JSON.stringify({
    ...metadata,
    maskedIdentifier: maskApiKey(identifier),
    quarantinedUntil: Date.now() + cooldownMs,
  });

  try {
    await client.set(redisKey, payload, 'PX', cooldownMs);
    log.debug('rotator.redis_quarantine_saved', `Persisted quarantine to Redis for ${namespace} [${maskApiKey(identifier)}] (TTL: ${cooldownMs}ms)`);
  } catch (err: any) {
    log.debug('rotator.redis_set_failed', `Failed to persist quarantine to Redis: ${err.message}`);
  }
}

/**
 * Clear a quarantine entry from Redis.
 */
export async function clearQuarantineFromRedis(
  namespace: string,
  identifier: string
): Promise<void> {
  const client = getRotatorRedisClient();
  if (!client) return;

  const keyHash = hashKeyForStorage(identifier);
  const redisKey = `chronoviet:quarantine:${namespace}:${keyHash}`;

  try {
    await client.del(redisKey);
  } catch (err: any) {
    log.debug('rotator.redis_del_failed', `Failed to clear quarantine from Redis: ${err.message}`);
  }
}

/**
 * Synchronize quarantine states from Redis to local In-Memory cooldown map (L1 cache).
 */
export async function syncQuarantinesFromRedis(
  namespace: string,
  identifiers: string[],
  cooldownMap: Map<string, number>
): Promise<void> {
  const client = getRotatorRedisClient();
  if (!client || identifiers.length === 0) return;

  try {
    const pipeline = client.pipeline();
    const mapKeys: Array<{ identifier: string; redisKey: string }> = [];

    for (const id of identifiers) {
      const redisKey = `chronoviet:quarantine:${namespace}:${hashKeyForStorage(id)}`;
      pipeline.get(redisKey);
      pipeline.pttl(redisKey);
      mapKeys.push({ identifier: id, redisKey });
    }

    const results = await pipeline.exec();
    if (!results) return;

    for (let i = 0; i < mapKeys.length; i++) {
      const getRes = results[i * 2];
      const pttlRes = results[i * 2 + 1];

      const val = getRes?.[1] as string | null;
      const pttl = (pttlRes?.[1] as number) || -2;

      if (val && pttl > 0) {
        cooldownMap.set(mapKeys[i].identifier, Date.now() + pttl);
        log.info('rotator.redis_quarantine_restored', `Restored active quarantine from Redis for [${maskApiKey(mapKeys[i].identifier)}] (Remaining TTL: ${Math.round(pttl / 1000)}s)`);
      }
    }
  } catch (err: any) {
    log.debug('rotator.redis_sync_failed', `Redis sync failed (fallback to RAM): ${err.message}`);
  }
}

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

    // Determine Cooldown Duration:
    // HTTP 429 / Quota Exceeded / Auth Error (401/403) -> 1 DAY (24 Hours = 86,400,000 ms)
    // Other errors (Network / Temporary 5xx) -> 15s
    const dailyCooldownMs = (envConfig && envConfig.DAILY_KEY_QUARANTINE_MS) || 86400000;
    let cooldownMs = 15000;
    const lowerMsg = errMsg.toLowerCase();

    if (
      statusCode === 429 ||
      lowerMsg.includes('429') ||
      lowerMsg.includes('rate limit') ||
      lowerMsg.includes('resource_exhausted') ||
      lowerMsg.includes('too many requests') ||
      lowerMsg.includes('quota') ||
      lowerMsg.includes('daily')
    ) {
      cooldownMs = dailyCooldownMs; // 1 DAY (24 Hours)
      log.warn('rotator.key_rate_limited_1day', `API key for [${this.provider}] marked INACTIVE for 24 HOURS (1 day) due to 429 / quota limit`, {
        provider: this.provider,
        maskedKey: maskApiKey(key),
        cooldownMs,
        quarantinedUntil: new Date(Date.now() + cooldownMs).toISOString(),
      });
    } else if (
      statusCode === 401 ||
      statusCode === 403 ||
      lowerMsg.includes('401') ||
      lowerMsg.includes('403') ||
      lowerMsg.includes('unauthorized') ||
      lowerMsg.includes('invalid_api_key')
    ) {
      cooldownMs = dailyCooldownMs; // 1 DAY (24 Hours)
      log.warn('rotator.key_auth_error_1day', `API key for [${this.provider}] marked INACTIVE for 24 HOURS (1 day) due to auth/quota error`, {
        provider: this.provider,
        maskedKey: maskApiKey(key),
        statusCode,
        cooldownMs,
        quarantinedUntil: new Date(Date.now() + cooldownMs).toISOString(),
      });
    } else {
      cooldownMs = Math.min(60000, 10000 * currentFailures);
      log.debug('rotator.key_error', `API key for [${this.provider}] failed (${errMsg || statusCode}); quarantined for ${cooldownMs}ms`, {
        provider: this.provider,
        maskedKey: maskApiKey(key),
      });
    }

    this.cooldownMap.set(key, Date.now() + cooldownMs);
    persistQuarantineToRedis(this.provider, key, cooldownMs, {
      provider: this.provider,
      reason: errMsg || String(statusCode),
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
 * error tracking, and failover retry on rate-limit (429) or quota errors.
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
 * Unified Inference Target representation (Peer node in Hybrid Round-Robin Pool)
 */
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
 * Manages an exact round-robin rotation pool containing BOTH Local Model (llama-server)
 * and Cloud Provider Keys (Agnes, Gemini, OpenAI, OpenRouter) as equal peers.
 * Auto-quarantines failed local instances for 30s and quota-exhausted cloud keys for 24 Hours (1 day).
 */
export class HybridInferenceDispatcher {
  private currentIndex = 0;
  private targetCooldowns = new Map<string, number>();
  private failureCounts = new Map<string, number>();

  /**
   * Builds the current list of available inference targets (Local + configured Cloud keys).
   */
  getInferenceTargets(subsystem: 'llm' | 'vlm' = 'llm'): InferenceTarget[] {
    const targets: InferenceTarget[] = [];

    // 1. Local Model Target
    if (subsystem === 'llm' && envConfig.USE_LOCAL_LLM) {
      targets.push({
        id: `local:llama-server:${envConfig.LOCAL_LLM_PRIMARY_MODEL}`,
        type: 'local',
        provider: 'local',
        model: envConfig.LOCAL_LLM_PRIMARY_MODEL,
        baseUrl: envConfig.LLM_BASE_URL.replace(/\/$/, ''),
      });
    } else if (subsystem === 'vlm' && (envConfig.USE_LOCAL_LLM || envConfig.VLM_PROVIDER === 'local' || envConfig.VLM_PROVIDER === 'auto')) {
      targets.push({
        id: `local:vlm-inspector:${envConfig.LOCAL_VLM_INSPECTOR || envConfig.LOCAL_LLM_PRIMARY_MODEL}`,
        type: 'local',
        provider: 'local',
        model: envConfig.LOCAL_VLM_INSPECTOR || envConfig.LOCAL_LLM_PRIMARY_MODEL,
        baseUrl: (envConfig.VLM_BASE_URL || envConfig.LLM_BASE_URL).replace(/\/$/, ''),
      });
    }

    // 2. Cloud Model Targets (Agnes, Gemini, OpenAI, OpenRouter)
    if (envConfig.ENABLE_CLOUD_FALLBACK && !envConfig.EVAL_STRICT) {
      // Agnes Keys
      const agnesKeys = getApiKeyRotator('agnes').getAllKeys();
      for (const k of agnesKeys) {
        targets.push({
          id: `cloud:agnes:${maskApiKey(k)}`,
          type: 'cloud',
          provider: 'agnes',
          model: envConfig.REMOTE_FALLBACK_MODEL || 'agnes-2.5-flash',
          baseUrl: (envConfig.REMOTE_LLM_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, ''),
          apiKey: k,
          maskedKey: maskApiKey(k),
        });
      }

      // Gemini Keys
      const geminiKeys = getApiKeyRotator('gemini').getAllKeys();
      for (const k of geminiKeys) {
        targets.push({
          id: `cloud:gemini:${maskApiKey(k)}`,
          type: 'cloud',
          provider: 'gemini',
          model: subsystem === 'vlm' ? (envConfig.GEMINI_VISION_MODEL || 'gemini-2.0-flash') : 'gemini-2.5-flash',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          apiKey: k,
          maskedKey: maskApiKey(k),
        });
      }

      // OpenAI Keys
      const openaiKeys = getApiKeyRotator('openai').getAllKeys();
      for (const k of openaiKeys) {
        targets.push({
          id: `cloud:openai:${maskApiKey(k)}`,
          type: 'cloud',
          provider: 'openai',
          model: envConfig.REMOTE_FALLBACK_MODEL || 'gpt-4o-mini',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: k,
          maskedKey: maskApiKey(k),
        });
      }

      // OpenRouter Keys
      const openrouterKeys = getApiKeyRotator('openrouter').getAllKeys();
      for (const k of openrouterKeys) {
        targets.push({
          id: `cloud:openrouter:${maskApiKey(k)}`,
          type: 'cloud',
          provider: 'openrouter',
          model: envConfig.REMOTE_FALLBACK_MODEL || 'anthropic/claude-3.5-haiku',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: k,
          maskedKey: maskApiKey(k),
        });
      }
    }

    return targets;
  }

  /**
   * Get active (non-quarantined) targets.
   */
  getActiveTargets(subsystem: 'llm' | 'vlm' = 'llm'): InferenceTarget[] {
    const all = this.getInferenceTargets(subsystem);
    const now = Date.now();
    return all.filter((t) => {
      const expiry = this.targetCooldowns.get(t.id);
      return !expiry || expiry <= now;
    });
  }

  /**
   * Get the next inference target in exact round-robin order.
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

    // All targets in cooldown: pick the earliest recovering target
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
    if (target.type === 'cloud' && target.apiKey) {
      reportKeySuccess(target.provider as ApiKeyProvider, target.apiKey);
    }
  }

  reportTargetFailure(target: InferenceTarget, errorOrStatus?: unknown): void {
    const currentFailures = (this.failureCounts.get(target.id) || 0) + 1;
    this.failureCounts.set(target.id, currentFailures);

    if (target.type === 'local') {
      // Local model failure (server down/OOM/timeout): Cooldown for 30s to allow Cloud failover
      const cooldownMs = 30000;
      this.targetCooldowns.set(target.id, Date.now() + cooldownMs);
      persistQuarantineToRedis('target', target.id, cooldownMs, {
        provider: 'local',
        reason: 'Local model unreachable/OOM',
      }).catch(() => {});
      log.warn('dispatcher.local_cooldown', `Local model target [${target.id}] unreachable/failed; quarantined for 30s before re-probing`, {
        targetId: target.id,
        cooldownMs,
      });
    } else {
      // Cloud Key failure: 1 Day (24 Hours = 86,400,000 ms) for quota/429/401/403 errors
      const dailyCooldownMs = (envConfig && envConfig.DAILY_KEY_QUARANTINE_MS) || 86400000;
      this.targetCooldowns.set(target.id, Date.now() + dailyCooldownMs);
      persistQuarantineToRedis('target', target.id, dailyCooldownMs, {
        provider: target.provider,
        reason: String(errorOrStatus),
      }).catch(() => {});
      if (target.apiKey) {
        reportKeyFailure(target.provider as ApiKeyProvider, target.apiKey, errorOrStatus);
      }
      log.warn('dispatcher.cloud_key_1day_cooldown', `Cloud Key [${target.maskedKey || target.id}] marked INACTIVE for 24 HOURS (1 day) due to quota/rate limit error`, {
        targetId: target.id,
        provider: target.provider,
        quarantineExpiresAt: new Date(Date.now() + dailyCooldownMs).toISOString(),
        cooldownMs: dailyCooldownMs,
      });
    }
  }

  /**
   * Execute inference with automatic round-robin across Local + Cloud targets,
   * with in-flight failover and 1-day quarantine for exhausted cloud keys.
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

    const maxAttempts = options.maxRetries ? Math.max(1, options.maxRetries) : Math.max(1, targets.length);
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const target = this.getNextTarget(subsystem);
      if (!target) {
        throw new Error(`[HybridInferenceDispatcher] Failed to acquire next target for ${subsystem}.`);
      }

      try {
        const result = await fn(target);
        this.reportTargetSuccess(target);
        return result;
      } catch (err: any) {
        lastError = err;
        this.reportTargetFailure(target, err);

        log.warn('dispatcher.attempt_failed', `Target [${target.id}] failed on attempt ${attempt}/${maxAttempts}; rotating to next peer target...`, {
          targetId: target.id,
          attempt,
          maxAttempts,
          error: err instanceof Error ? err.message : String(err),
        });

        if (options.onRetry && attempt < maxAttempts) {
          try {
            const nextCandidate = this.getNextTarget(subsystem);
            if (nextCandidate) {
              options.onRetry(err, nextCandidate, attempt);
            }
          } catch {}
        }
      }
    }

    throw lastError || new Error(`[HybridInferenceDispatcher] All ${maxAttempts} inference targets failed for ${subsystem}.`);
  }
}

export const hybridInferenceDispatcher = new HybridInferenceDispatcher();

