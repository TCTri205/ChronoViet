import { z } from 'zod';

export const EnvSchema = z.object({
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
  LOCAL_LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  LLM_BASE_URL: z.string().default('http://localhost:8092'),
  LLM_PORT: z.coerce.number().int().positive().default(8092),
  LLM_CTX_SIZE: z.coerce.number().int().positive().default(131072),
  LOCAL_LLM_PARALLEL: z.coerce.number().int().positive().default(4),
  LLM_EXTRA_ARGS: z.string().optional(),
  LOCAL_LLM_EXTRACTION_PORT: z.coerce.number().int().positive().default(8094),
  LOCAL_LLM_EXTRACTION_BASE_URL: z.string().default('http://localhost:8094'),
  LOCAL_LLM_EXTRACTION_MODEL: z.string().default('qwen3.5-4b-instruct-q4_k_m'),
  LOCAL_LLM_EXTRACTION_CTX_SIZE: z.coerce.number().int().positive().default(57344),
  LOCAL_LLM_EXTRACTION_PARALLEL: z.coerce.number().int().positive().default(14),
  LOCAL_LLM_EXTRACTION_THREADS: z.coerce.number().int().positive().default(10),
  LOCAL_LLM_EXTRACTION_EXTRA_ARGS: z.string().optional(),
  EMBEDDING_PORT: z.coerce.number().int().positive().default(8090),
  EMBEDDING_CTX_SIZE: z.coerce.number().int().positive().default(4096),
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

  // Multi-Key Load Balancing & Rotation
  LLM_KEY_ROTATION_STRATEGY: z.enum(['round_robin', 'least_errors', 'priority']).default('round_robin'),
  LLM_KEY_COOLDOWN_MS: z.coerce.number().int().positive().default(60000),
  LLM_MAX_RETRIES_PER_CALL: z.coerce.number().int().positive().default(3),

  // Embedding, Rerank & Vision Stack (SSOT 1024-dim Vector Space)
  EMBEDDING_PROVIDER: z.enum(['local', 'gemini', 'openai', 'agnes', 'bge']).default('local'),
  LOCAL_EMBEDDING_MODEL: z.string().default('bge-m3'),
  LOCAL_EMBEDDING_DEFAULT: z.string().optional(),
  EMBEDDING_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  EMBEDDING_CONCURRENCY: z.coerce.number().int().positive().default(4),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(16),
  EMBEDDING_MAX_CHARS: z.coerce.number().int().positive().default(24000),
  ALLOW_SYNTHETIC_EMBEDDINGS: z
    .union([z.boolean(), z.string().transform((v) => v === 'true')])
    .default(false),
  RERANKER_PROVIDER: z.enum(['local', 'jina', 'cohere', 'none']).default('local'),
  LOCAL_RERANK_MODEL: z.string().default('qwen3-reranker-0.6b'),
  LOCAL_RERANK_URL: z.string().default('http://localhost:8096/v1/rerank'),
  RERANK_PORT: z.coerce.number().int().positive().default(8096),
  LOCAL_RERANK_PORT: z.coerce.number().int().positive().default(8096),
  LOCAL_RERANK_PARALLEL: z.coerce.number().int().positive().default(4),
  LOCAL_RERANK_THREADS: z.coerce.number().int().positive().default(6),
  LOCAL_RERANK_EXTRA_ARGS: z.string().optional(),
  RERANKER_API_KEY: z.string().optional(),
  RERANK_TOP_K: z.coerce.number().int().positive().default(10),
  RERANK_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  RAG_SEARCH_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  LOCAL_VISION_FILTER: z.string().default('siglip-2-multilingual-onnx'),
  LOCAL_VLM_INSPECTOR: z.string().default('qwen3.5-9b-instruct-q4_k_m'),
  HISTORICAL_OCR_ENGINE: z.string().default('paddleocr_v5_hannom'),

  // Vision Language Model (VLM) Inspector Configuration
  VLM_PROVIDER: z.enum(['auto', 'local', 'openai', 'gemini', 'clip']).default('auto'),
  LOCAL_VLM_URL: z.string().default('http://localhost:8094/v1'),
  LOCAL_VLM_MODEL: z.string().default('qwen2.5-vl-7b-instruct-q4_k_m'),
  VLM_SCORE_THRESHOLD: z.coerce.number().min(0).max(100).default(60),
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
  TTS_PROVIDER: z.enum(['vieneu', 'piper', 'cloud', 'synthetic']).default('vieneu'),
  VIENEU_PYTHON_URL: z.string().default('http://localhost:8080'),
  VIENEU_VOICE: z.string().default('vi_vietnam'),
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
  REMOTION_CONCURRENCY: z.coerce.number().int().positive().default(2),
  REMOTION_PIXEL_FORMAT: z.enum(['yuv420p', 'yuva420p']).default('yuv420p'),
  REMOTION_CODEC: z.enum(['h264', 'h265', 'vp8', 'vp9', 'prores']).default('h264'),
  REMOTION_CRF: z.coerce.number().int().min(0).max(51).default(18),
  REMOTION_AUDIO_BITRATE: z.string().default('192k'),
  OUTPUT_DIR: z.string().default('./media/rendered-videos'),
  WORKSPACE_ROOT: z.string().default('./media/workspace'),

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
  // Supported: serpapi, tavily, brave, wikimedia, gallica, catalog
  IMAGE_SEARCH_PROVIDER_CHAIN: z.string().default('serpapi,tavily,brave,wikimedia,gallica,catalog'),
  IMAGE_DOMAIN_WHITELIST: z.string().optional(),
  IMAGE_LICENSE_POLICY: z.enum(['STRICT', 'EDITORIAL']).default('STRICT'),
  RESEARCH_CANDIDATE_POOL_SIZE: z.coerce.number().int().positive().default(6),
  RESEARCH_CANDIDATES_PER_SCENE: z.coerce.number().int().positive().default(6),

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

export type EnvConfig = z.infer<typeof EnvSchema>;
