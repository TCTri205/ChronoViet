import { z } from 'zod';
import dotenv from 'dotenv';

import path from 'path';
import fs from 'fs';

if (typeof process !== 'undefined' && process?.versions?.node) {
  try {
    dotenv.config();
    if (!process.env.DATABASE_URL) {
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
    }
  } catch {
    // Ignore in non-Node environments
  }
}

const EnvSchema = z.object({
  // ==========================================
  // Deployment
  // ==========================================
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // ==========================================
  // PostgreSQL Database
  // ==========================================
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().default('chronoviet_db'),
  POSTGRES_USER: z.string().default('chronoviet'),
  POSTGRES_PASSWORD: z.string().default('chronoviet_secret'),
  PG_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(1000),
  PG_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

  // ==========================================
  // Redis
  // ==========================================
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ==========================================
  // AI / External APIs & Local Model Gateway
  // ==========================================
  GEMINI_API_KEY: z.string().optional(),
  EMBEDDING_API_URL: z.string().optional(),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(1024),

  // Local AI Gateway Configuration
  USE_LOCAL_LLM: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(true),
  LOCAL_LLM_BACKEND: z.enum(['llama_cpp', 'ollama', 'mlx']).default('llama_cpp'),
  LLM_BASE_URL: z.string().default('http://localhost:8080'),
  LOCAL_LLM_PRIMARY_MODEL: z.string().default('qwen3.5-27b-instruct-q4_k_m'),
  LOCAL_LLM_BENCHMARK_MODEL: z.string().default('qwen3.6-27b-instruct-q4_k_m'),

  // Cloud API Fallback Configuration (Agnes 2.0 Flash)
  ENABLE_CLOUD_FALLBACK: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(true),
  REMOTE_FALLBACK_MODEL: z.string().default('agnes-2.0-flash'),
  AGNES_API_KEY: z.string().optional(),
  REMOTE_FALLBACK_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // Embedding, Rerank & Vision Stack
  LOCAL_EMBEDDING_DEFAULT: z.string().default('qwen3-embedding-0.6b'),
  LOCAL_EMBEDDING_HIGH_QUALITY: z.string().default('qwen3-embedding-4b'),
  LOCAL_RERANK_MODEL: z.string().default('qwen3-reranker-0.6b'),
  LOCAL_VISION_FILTER: z.string().default('siglip-2-multilingual-onnx'),
  LOCAL_VLM_INSPECTOR: z.string().default('qwen3-vl-8b'),
  HISTORICAL_OCR_ENGINE: z.string().default('paddleocr_v5_hannom'),

  // ==========================================
  // TTS Service
  // ==========================================
  VIENEU_PYTHON_URL: z.string().default('http://localhost:8080'),
  TTS_SERVICE_PORT: z.coerce.number().int().positive().default(8080),
  TTS_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),

  // ==========================================
  // Remotion Engine
  // ==========================================
  REMOTION_PORT: z.coerce.number().int().positive().default(9876),
  REMOTION_NODE_OPTIONS: z.string().default('--max-old-space-size=4096'),

  // ==========================================
  // Render Worker
  // ==========================================
  RENDER_CONCURRENCY: z.coerce.number().int().positive().default(1),

  // ==========================================
  // Media Paths
  // ==========================================
  MEDIA_DIR: z.string().default('./media'),
  AUDIO_CACHE_DIR: z.string().default('./media/audio-cache'),

  // ==========================================
  // Image Research Agent (Online Search Providers)
  // ==========================================
  SERPAPI_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  BRAVE_API_KEY: z.string().optional(),
  // Comma-separated priority chain of image search providers.
  // Supported: serpapi, tavily, brave, wikimedia, catalog
  IMAGE_SEARCH_PROVIDER_CHAIN: z.string().default('serpapi,tavily,brave,wikimedia,catalog'),
  IMAGE_DOMAIN_WHITELIST: z
    .string()
    .default(
      'upload.wikimedia.org,commons.wikimedia.org,live.staticflickr.com,flickr.com'
    ),

  // ==========================================
  // Evaluation
  // ==========================================
  EVAL_MAX_RTF: z.coerce.number().positive().default(0.3),
  EVAL_STRICT: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(true),
  EVAL_ALLOW_CLOUD_FALLBACK: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(false),
  EVAL_VLM_MODEL: z.string().default('qwen3-vl-8b'),

  // ==========================================
  // Logging
  // ==========================================
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const isNode = typeof process !== 'undefined' && !!process?.versions?.node;
const processEnv = typeof process !== 'undefined' && process?.env ? process.env : {};

const parsed = EnvSchema.safeParse(processEnv);
if (!parsed.success && isNode && processEnv.NODE_ENV !== 'test') {
  console.error('❌ Invalid environment configuration:', JSON.stringify(parsed.error.format(), null, 2));
}

export const envConfig = parsed.success ? parsed.data : EnvSchema.parse({});

export type EnvConfig = z.infer<typeof EnvSchema>;

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
    password: envConfig.POSTGRES_PASSWORD,
  };
}
