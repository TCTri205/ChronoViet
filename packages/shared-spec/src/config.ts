import { z } from 'zod';
import dotenv from 'dotenv';

import path from 'path';
import fs from 'fs';

if (typeof process !== 'undefined' && process?.versions?.node) {
  try {
    // 1. Attempt to load .env from current working directory
    dotenv.config();

    // 2. Search up directory hierarchy up to 4 levels to locate root monorepo .env
    let dir = process.cwd();
    for (let i = 0; i < 4; i++) {
      const envPath = path.join(dir, '.env');
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // Ignore in non-Node environments
  }
}

const EnvSchema = z.object({
  // ==========================================
  // Deployment & Core Infrastructure
  // ==========================================
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  WORKER_PROBE_PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),

  // ==========================================
  // PostgreSQL Database
  // ==========================================
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().default('chronoviet_db'),
  POSTGRES_USER: z.string().default('chronoviet'),
  POSTGRES_PASSWORD: z.string().default('chronoviet_secret'),
  DB_PASSWORD: z.string().optional(),
  PG_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(1000),
  PG_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  FORCE_OFFLINE: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(false),
  SKIP_PG: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(false),

  // ==========================================
  // Redis
  // ==========================================
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ==========================================
  // AI / External APIs & Local Model Gateway
  // ==========================================
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_KEYS: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  GEMINI_VISION_MODEL: z.string().default('gemini-3.6-flash'),
  EMBEDDING_API_URL: z.string().optional(),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(1024),

  // Local AI Gateway Configuration (llama-server / ONNX)
  USE_LOCAL_LLM: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(true),
  LOCAL_LLM_BACKEND: z.enum(['llama_cpp', 'ollama', 'mlx']).default('llama_cpp'),
  LOCAL_LLM_MAX_CONCURRENCY: z.coerce.number().int().positive().default(1),
  LOCAL_LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  LLM_BASE_URL: z.string().default('http://localhost:8092'),
  LLM_PORT: z.coerce.number().int().positive().default(8092),
  LLM_CTX_SIZE: z.coerce.number().int().positive().default(131072),
  LOCAL_LLM_PARALLEL: z.coerce.number().int().positive().default(4),
  LLM_EXTRA_ARGS: z.string().optional(),
  LOCAL_LLM_EXTRACTION_PORT: z.coerce.number().int().positive().default(8094),
  LOCAL_LLM_EXTRACTION_BASE_URL: z.string().default('http://localhost:8094'),
  LOCAL_LLM_EXTRACTION_MODEL: z.string().default('qwen3.5-4b-instruct-q4_k_m'),
  LOCAL_LLM_EXTRACTION_CTX_SIZE: z.coerce.number().int().positive().default(32768),
  LOCAL_LLM_EXTRACTION_PARALLEL: z.coerce.number().int().positive().default(4),
  LOCAL_LLM_EXTRACTION_THREADS: z.coerce.number().int().positive().default(6),
  LOCAL_LLM_EXTRACTION_EXTRA_ARGS: z.string().optional(),
  EMBEDDING_PORT: z.coerce.number().int().positive().default(8090),
  EMBEDDING_CTX_SIZE: z.coerce.number().int().positive().default(8192),
  EMBEDDING_EXTRA_ARGS: z.string().optional(),
  LOCAL_EMBEDDING_PARALLEL: z.coerce.number().int().positive().default(4),
  LOCAL_EMBEDDING_THREADS: z.coerce.number().int().positive().default(6),
  LOCAL_EMBEDDING_EXTRA_ARGS: z.string().optional(),
  MODEL_DIR: z.string().default('./models'),
  LOCAL_LLM_PRIMARY_MODEL: z.string().default('qwen3.5-9b-instruct-q4_k_m'),
  LOCAL_LLM_BENCHMARK_MODEL: z.string().default('qwen3.5-9b-instruct-q4_k_m'),
  HYBRID_DEV: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(false),

  // Resource Management, Lifecycle & Distributed Lock
  AI_AUTO_EVICT_IDLE_MINUTES: z.coerce.number().int().nonnegative().default(10),
  AI_STANDBY_ON_RENDER: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(true),
  MEMORY_PRESSURE_THRESHOLD_PCT: z.coerce.number().int().positive().default(85),
  DOCKER_HOST_GATEWAY_URL: z.string().default('http://host.docker.internal'),
  RENDER_MUTEX_LOCK_KEY: z.string().default('chronoviet:render_lock'),
  RENDER_MUTEX_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  // ==========================================
  // AI Execution Mode (Master Preset)
  // Options:
  // - 'local_only': 100% Local LLM & VLM. No cloud fallback, zero API cost.
  // - 'fallback': (Default) Local-first. Calls Cloud fallback only when Local fails / crashes / during render mutex.
  // - 'hybrid': Distributes load across Local and Cloud keys via Round-Robin.
  // - 'cloud_only': 100% Cloud LLM. Disables local LLM requirement (useful for lightweight dev).
  // ==========================================
  AI_EXECUTION_MODE: z
    .enum(['local_only', 'fallback', 'hybrid', 'cloud_only'])
    .default('fallback'),

  // Cloud API Fallback Configuration (Agnes 2.5 Flash / OpenAI / OpenRouter / Gemini)
  ENABLE_CLOUD_FALLBACK: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(true),
  // Routing strategy: 'hybrid_round_robin' (rotates across Local + Cloud targets evenly),
  // 'priority_fallback' (Local first, fallback to Cloud on error), or 'local_only'
  INFERENCE_ROUTING_MODE: z
    .enum(['hybrid_round_robin', 'priority_fallback', 'local_only'])
    .default('priority_fallback'),
  // 1-Day (24h) Quota Cooldown for exhausted Cloud API Keys (86,400,000 ms)
  DAILY_KEY_QUARANTINE_MS: z.coerce.number().int().positive().default(86400000),
  REMOTE_FALLBACK_MODEL: z.string().default('agnes-2.5-flash'),
  REMOTE_LLM_BASE_URL: z.string().default('https://apihub.agnes-ai.com/v1'),
  AGNES_BASE_URL: z.string().default('https://apihub.agnes-ai.com/v1'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_KEYS: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_API_KEYS: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('deepseek/deepseek-chat'),
  AGNES_API_KEY: z.string().optional(),
  AGNES_API_KEYS: z.string().optional(),
  REMOTE_FALLBACK_TIMEOUT_MS: z.coerce.number().int().positive().default(35000),

  // Embedding, Rerank & Vision Stack (SSOT 1024-dim Vector Space)
  LOCAL_EMBEDDING_MODEL: z.string().default('bge-m3'),
  LOCAL_EMBEDDING_DEFAULT: z.string().optional(),
  EMBEDDING_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  EMBEDDING_CONCURRENCY: z.coerce.number().int().positive().default(4),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(16),
  EMBEDDING_MAX_CHARS: z.coerce.number().int().positive().default(24000),
  ALLOW_SYNTHETIC_EMBEDDINGS: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(false),
  LOCAL_RERANK_MODEL: z.string().default('qwen3-reranker-0.6b'),
  LOCAL_RERANK_URL: z.string().default('http://localhost:8096/v1/rerank'),
  RERANK_PORT: z.coerce.number().int().positive().default(8096),
  RERANK_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  RAG_SEARCH_TIMEOUT_MS: z.coerce.number().int().positive().default(4500),
  LOCAL_VISION_FILTER: z.string().default('siglip-2-multilingual-onnx'),
  LOCAL_VLM_INSPECTOR: z.string().default('qwen3.5-9b-instruct-q4_k_m'),
  HISTORICAL_OCR_ENGINE: z.string().default('paddleocr_v5_hannom'),

  // Vision Language Model (VLM) Inspector Configuration
  VLM_PROVIDER: z.enum(['auto', 'local', 'openai', 'gemini', 'clip']).default('auto'),
  VLM_BASE_URL: z.string().optional(),
  VLM_MODEL: z.string().optional(),
  VLM_API_KEY: z.string().optional(),
  IMAGE_DOWNLOAD_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  IMAGE_DOWNLOAD_USER_AGENT: z
    .string()
    .default('ChronoViet-VLM-Downloader/1.0 (https://chronoviet.vn; contact@chronoviet.vn)'),

  // ==========================================
  // TTS Service
  // ==========================================
  VIENEU_PYTHON_URL: z.string().default('http://localhost:8080'),
  TTS_SERVICE_PORT: z.coerce.number().int().positive().default(8080),
  TTS_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),

  // ==========================================
  // Remotion Engine & Render Dispatch
  // ==========================================
  AUTO_DISPATCH_RENDER: z
    .union([z.boolean(), z.string().transform((v) => v !== 'false')])
    .default(true),
  REMOTION_PORT: z.coerce.number().int().positive().default(9876),
  REMOTION_NODE_OPTIONS: z.string().default('--max-old-space-size=4096'),

  // ==========================================
  // Render Worker
  // ==========================================
  RENDER_CONCURRENCY: z.coerce.number().int().positive().default(1),

  // ==========================================
  // Media Paths & Storage
  // ==========================================
  MEDIA_DIR: z.string().default('./media'),
  AUDIO_CACHE_DIR: z.string().default('./media/audio-cache'),
  PROJECTS_MEDIA_ROOT: z.string().default('./media/projects'),

  // ==========================================
  // Image Research Agent (Online Search Providers)
  // ==========================================
  SERPAPI_API_KEY: z.string().optional(),
  SERPAPI_API_KEYS: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  TAVILY_API_KEYS: z.string().optional(),
  BRAVE_API_KEY: z.string().optional(),
  BRAVE_API_KEYS: z.string().optional(),
  // Comma-separated priority chain of image search providers.
  // Supported: serpapi, tavily, brave, wikimedia, catalog
  IMAGE_SEARCH_PROVIDER_CHAIN: z.string().default('serpapi,tavily,brave,wikimedia,catalog'),
  IMAGE_DOMAIN_WHITELIST: z
    .string()
    .default(
      'upload.wikimedia.org,commons.wikimedia.org,live.staticflickr.com,flickr.com'
    ),

  // ==========================================
  // Evaluation Gates & Benchmark
  // ==========================================
  EVAL_MAX_RTF: z.coerce.number().positive().default(0.3),
  EVAL_STRICT: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(false),
  EVAL_ALLOW_CLOUD_FALLBACK: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(false),
  EVAL_VLM_MODEL: z.string().default('qwen3.5-9b-instruct-q4_k_m'),
});

const isNode = typeof process !== 'undefined' && !!process?.versions?.node;
const rawProcessEnv: Record<string, string | undefined> = typeof process !== 'undefined' && process?.env ? process.env : {};

// Resolve AI_EXECUTION_MODE and apply presets for subordinate flags
const rawMode = rawProcessEnv.AI_EXECUTION_MODE;
let resolvedMode: 'local_only' | 'fallback' | 'hybrid' | 'cloud_only';

if (rawMode && ['local_only', 'fallback', 'hybrid', 'cloud_only'].includes(rawMode)) {
  resolvedMode = rawMode as any;
} else {
  // Deduce mode from subordinate flags for backward compatibility
  const explicitRouting = rawProcessEnv.INFERENCE_ROUTING_MODE;
  const explicitLocal = rawProcessEnv.USE_LOCAL_LLM;
  const explicitCloud = rawProcessEnv.ENABLE_CLOUD_FALLBACK;

  if (explicitRouting === 'local_only' || explicitCloud === 'false') {
    resolvedMode = 'local_only';
  } else if (explicitLocal === 'false') {
    resolvedMode = 'cloud_only';
  } else if (explicitRouting === 'hybrid_round_robin') {
    resolvedMode = 'hybrid';
  } else {
    // Default safe mode: local-first with cloud fallback
    resolvedMode = 'fallback';
  }
}

// Preset mappings based on resolvedMode
let presetUseLocalLlm: string;
let presetEnableCloudFallback: string;
let presetInferenceRoutingMode: string;
let presetStandbyOnRender: string;
let presetVlmProvider: string | undefined;

switch (resolvedMode) {
  case 'local_only':
    presetUseLocalLlm = 'true';
    presetEnableCloudFallback = 'false';
    presetInferenceRoutingMode = 'local_only';
    presetStandbyOnRender = 'false';
    presetVlmProvider = 'local';
    break;
  case 'fallback':
    presetUseLocalLlm = 'true';
    presetEnableCloudFallback = 'true';
    presetInferenceRoutingMode = 'priority_fallback';
    presetStandbyOnRender = 'true';
    presetVlmProvider = 'auto';
    break;
  case 'hybrid':
    presetUseLocalLlm = 'true';
    presetEnableCloudFallback = 'true';
    presetInferenceRoutingMode = 'hybrid_round_robin';
    presetStandbyOnRender = 'true';
    presetVlmProvider = 'auto';
    break;
  case 'cloud_only':
    presetUseLocalLlm = 'false';
    presetEnableCloudFallback = 'true';
    presetInferenceRoutingMode = 'priority_fallback';
    presetStandbyOnRender = 'false';
    presetVlmProvider = 'auto';
    break;
}

// Normalization & Backward-Compatibility aliases
const processEnv: Record<string, string | undefined> = {
  ...rawProcessEnv,
  AI_EXECUTION_MODE: resolvedMode,
  USE_LOCAL_LLM: rawProcessEnv.USE_LOCAL_LLM ?? presetUseLocalLlm,
  ENABLE_CLOUD_FALLBACK: rawProcessEnv.ENABLE_CLOUD_FALLBACK ?? presetEnableCloudFallback,
  INFERENCE_ROUTING_MODE: rawProcessEnv.INFERENCE_ROUTING_MODE ?? presetInferenceRoutingMode,
  AI_STANDBY_ON_RENDER: rawProcessEnv.AI_STANDBY_ON_RENDER ?? presetStandbyOnRender,
  VLM_PROVIDER: rawProcessEnv.VLM_PROVIDER ?? presetVlmProvider,
  REMOTE_LLM_BASE_URL: rawProcessEnv.REMOTE_LLM_BASE_URL || rawProcessEnv.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1',
  AGNES_BASE_URL: rawProcessEnv.AGNES_BASE_URL || rawProcessEnv.REMOTE_LLM_BASE_URL || 'https://apihub.agnes-ai.com/v1',
  AGNES_API_KEY: rawProcessEnv.AGNES_API_KEY || (rawProcessEnv.AGNES_API_KEYS ? rawProcessEnv.AGNES_API_KEYS.split(/[,;\n]+/)[0]?.trim() : undefined),
  GEMINI_API_KEY: rawProcessEnv.GEMINI_API_KEY || (rawProcessEnv.GEMINI_API_KEYS ? rawProcessEnv.GEMINI_API_KEYS.split(/[,;\n]+/)[0]?.trim() : undefined),
  TAVILY_API_KEY: rawProcessEnv.TAVILY_API_KEY || (rawProcessEnv.TAVILY_API_KEYS ? rawProcessEnv.TAVILY_API_KEYS.split(/[,;\n]+/)[0]?.trim() : undefined),
  SERPAPI_API_KEY: rawProcessEnv.SERPAPI_API_KEY || (rawProcessEnv.SERPAPI_API_KEYS ? rawProcessEnv.SERPAPI_API_KEYS.split(/[,;\n]+/)[0]?.trim() : undefined),
  BRAVE_API_KEY: rawProcessEnv.BRAVE_API_KEY || (rawProcessEnv.BRAVE_API_KEYS ? rawProcessEnv.BRAVE_API_KEYS.split(/[,;\n]+/)[0]?.trim() : undefined),
  OPENAI_API_KEY: rawProcessEnv.OPENAI_API_KEY || (rawProcessEnv.OPENAI_API_KEYS ? rawProcessEnv.OPENAI_API_KEYS.split(/[,;\n]+/)[0]?.trim() : undefined),
  OPENAI_MODEL: rawProcessEnv.OPENAI_MODEL || 'gpt-4o-mini',
  OPENROUTER_API_KEY: rawProcessEnv.OPENROUTER_API_KEY || (rawProcessEnv.OPENROUTER_API_KEYS ? rawProcessEnv.OPENROUTER_API_KEYS.split(/[,;\n]+/)[0]?.trim() : undefined),
  OPENROUTER_BASE_URL: rawProcessEnv.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  OPENROUTER_MODEL: rawProcessEnv.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
};

const parsed = EnvSchema.safeParse(processEnv);
if (!parsed.success) {
  if (isNode && processEnv.NODE_ENV !== 'test') {
    console.error('❌ Invalid environment configuration:', JSON.stringify(parsed.error.format(), null, 2));
  }
  if (processEnv.NODE_ENV === 'production') {
    throw new Error(`[CRITICAL_CONFIG_ERROR] Invalid environment variables in production: ${parsed.error.message}`);
  }
}

export const envConfig = parsed.success
  ? parsed.data
  : (() => {
      // In dev/test, merge defaults with valid parsed keys to avoid dropping entire config
      const defaults = EnvSchema.parse({});
      const sanitized: Record<string, any> = { ...defaults };
      for (const [key, value] of Object.entries(processEnv)) {
        if (value !== undefined && key in EnvSchema.shape) {
          const fieldSchema = (EnvSchema.shape as any)[key];
          if (fieldSchema) {
            const fieldRes = fieldSchema.safeParse(value);
            if (fieldRes.success) {
              sanitized[key] = fieldRes.data;
            }
          }
        }
      }
      return sanitized as z.infer<typeof EnvSchema>;
    })();

export type EnvConfig = z.infer<typeof EnvSchema>;

export interface AiExecutionSummary {
  mode: 'local_only' | 'fallback' | 'hybrid' | 'cloud_only';
  useLocalLlm: boolean;
  enableCloudFallback: boolean;
  routingMode: 'hybrid_round_robin' | 'priority_fallback' | 'local_only';
  vlmProvider: string;
  localEndpoints: {
    llm: string;
    extraction: string;
    embedding: string;
    rerank: string;
  };
  cloudProvidersConfigured: string[];
}

/**
 * Returns a structured snapshot of active AI execution mode and routing parameters.
 */
export function getAiExecutionSummary(): AiExecutionSummary {
  const configuredClouds: string[] = [];
  if (envConfig.AGNES_API_KEY || envConfig.AGNES_API_KEYS) configuredClouds.push('Agnes');
  if (envConfig.GEMINI_API_KEY || envConfig.GEMINI_API_KEYS) configuredClouds.push('Gemini');
  if (envConfig.OPENROUTER_API_KEY || envConfig.OPENROUTER_API_KEYS) configuredClouds.push('OpenRouter');
  if (envConfig.OPENAI_API_KEY || envConfig.OPENAI_API_KEYS) configuredClouds.push('OpenAI');

  return {
    mode: envConfig.AI_EXECUTION_MODE,
    useLocalLlm: envConfig.USE_LOCAL_LLM,
    enableCloudFallback: envConfig.ENABLE_CLOUD_FALLBACK,
    routingMode: envConfig.INFERENCE_ROUTING_MODE,
    vlmProvider: envConfig.VLM_PROVIDER,
    localEndpoints: {
      llm: envConfig.LLM_BASE_URL,
      extraction: envConfig.LOCAL_LLM_EXTRACTION_BASE_URL,
      embedding: `http://localhost:${envConfig.EMBEDDING_PORT}`,
      rerank: envConfig.LOCAL_RERANK_URL,
    },
    cloudProvidersConfigured: configuredClouds,
  };
}

/**
 * Parse a PostgreSQL connection URL into individual components.
 * Used as a higher-priority alternative to individual POSTGRES_* env vars.
 */
export function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

/**
 * Get database connection config, preferring DATABASE_URL over POSTGRES_* vars.
 */
export function getDatabaseConfig() {
  if (envConfig.DATABASE_URL) {
    return parseDatabaseUrl(envConfig.DATABASE_URL);
  }
  return {
    host: envConfig.POSTGRES_HOST,
    port: envConfig.POSTGRES_PORT,
    database: envConfig.POSTGRES_DB,
    user: envConfig.POSTGRES_USER,
    password: envConfig.POSTGRES_PASSWORD || envConfig.DB_PASSWORD || 'chronoviet_secret',
  };
}
