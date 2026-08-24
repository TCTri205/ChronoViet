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

import { EnvSchema, EnvConfig } from '@chronoviet/shared-spec';
export { EnvSchema, EnvConfig };

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
