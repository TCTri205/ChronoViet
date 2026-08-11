import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

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
  POSTGRES_DB: z.string().default('chronoviet'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),
  PG_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(1000),
  PG_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

  // ==========================================
  // Redis
  // ==========================================
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ==========================================
  // AI / External APIs
  // ==========================================
  GEMINI_API_KEY: z.string().optional(),
  EMBEDDING_API_URL: z.string().optional(),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(1024),

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
  // Evaluation
  // ==========================================
  EVAL_MAX_RTF: z.coerce.number().positive().default(0.3),

  // ==========================================
  // Logging
  // ==========================================
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const envConfig = parsed.data;
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
