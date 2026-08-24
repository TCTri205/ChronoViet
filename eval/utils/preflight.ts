/**
 * Eval Preflight Health Checks
 * Fail-fast gate: eval must not run when required services are down.
 * Prevents silent fallbacks (cloud LLM, pseudo-random embeddings, synthetic TTS)
 * from producing a misleading PASS during evaluation.
 */

import { envConfig, isLLMServiceHealthy, isEmbeddingServiceHealthy, createLogger, hasAvailableApiKeys, isPgAvailable, query, getDatabaseConfig } from '@chronoviet/infra';

const log = createLogger({ service: 'eval-preflight' });

export type EvalService = 'llm' | 'embedding' | 'tts' | 'vlm' | 'search' | 'postgres' | 'reranker';

export interface PreflightCheck {
  service: EvalService;
  healthy: boolean;
  provider: string;
  required: boolean;
  details?: string;
}

export interface PreflightResult {
  ok: boolean;
  timestamp: string;
  checks: PreflightCheck[];
}

/**
 * Check TTS Python ONNX service health via GET /health.
 */
async function checkTtsHealth(): Promise<PreflightCheck> {
  const url = envConfig.VIENEU_PYTHON_URL;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url.replace(/\/$/, '')}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    const healthy = res.ok;
    return {
      service: 'tts',
      healthy,
      provider: healthy ? `REAL_NEURAL_ONNX (${url})` : 'SYNTHETIC_FALLBACK_TONE',
      required: true,
      details: healthy ? undefined : `TTS health endpoint HTTP ${res.status}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      service: 'tts',
      healthy: false,
      provider: 'SYNTHETIC_FALLBACK_TONE',
      required: true,
      details: `VieNeu Python ONNX service unreachable at ${url}: ${msg}`,
    };
  }
}

/**
 * Check VLM availability: local VLM via llama-server (preferred), else Gemini key.
 */
async function checkVlmHealth(): Promise<PreflightCheck> {
  // 1. Try local VLM via LLM gateway (llama-server with vision model)
  if (envConfig.USE_LOCAL_LLM) {
    try {
      const endpoint = `${envConfig.LLM_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`;
      const vlmModel = envConfig.EVAL_VLM_MODEL || envConfig.LOCAL_VLM_INSPECTOR || envConfig.LOCAL_LLM_PRIMARY_MODEL || 'qwen3.5-9b-instruct-q4_k_m';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: vlmModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'health_check: respond with a single word.' },
                {
                  type: 'image_url',
                  image_url: {
                    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                  },
                },
              ],
            },
          ],
          max_tokens: 4,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return {
          service: 'vlm',
          healthy: true,
          provider: `LOCAL_VLM (${envConfig.LLM_BASE_URL}) [${vlmModel}]`,
          required: true,
        };
      }
      return {
        service: 'vlm',
        healthy: false,
        provider: 'LOCAL_VLM',
        required: true,
        details: `Local VLM endpoint HTTP ${res.status}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        service: 'vlm',
        healthy: false,
        provider: 'LOCAL_VLM',
        required: true,
        details: `Local VLM unreachable at ${envConfig.LLM_BASE_URL}: ${msg}`,
      };
    }
  }

  // 2. Fallback: Gemini cloud key
  if (hasAvailableApiKeys('gemini') || envConfig.GEMINI_API_KEY) {
    return {
      service: 'vlm',
      healthy: true,
      provider: 'GEMINI_CLOUD',
      required: true,
    };
  }

  return {
    service: 'vlm',
    healthy: false,
    provider: 'NONE',
    required: true,
    details: 'No VLM available: USE_LOCAL_LLM is off and GEMINI_API_KEYS is unset',
  };
}

async function checkLlmHealth(): Promise<PreflightCheck> {
  if (envConfig.USE_LOCAL_LLM) {
    const result = await isLLMServiceHealthy();
    // isLLMServiceHealthy falls through to cloud providers when local is down;
    // in eval strict mode the local server is mandatory, so treat non-LOCAL_LLM as unhealthy.
    const healthy = result.healthy && result.provider.startsWith('LOCAL_LLM');
    return {
      service: 'llm',
      healthy,
      provider: healthy
        ? result.provider
        : `LOCAL_LLM DOWN (${envConfig.LLM_BASE_URL}) [${envConfig.LOCAL_LLM_PRIMARY_MODEL}]`,
      required: true,
      details: healthy ? undefined : `Local LLM server unreachable at ${envConfig.LLM_BASE_URL} (health reported: ${result.provider})`,
    };
  }
  // USE_LOCAL_LLM=false: only allowed in eval when cloud fallback is explicitly enabled
  const cloudReady = envConfig.EVAL_ALLOW_CLOUD_FALLBACK && (hasAvailableApiKeys('agnes') || !!envConfig.AGNES_API_KEY);
  return {
    service: 'llm',
    healthy: cloudReady,
    provider: cloudReady ? `AGNES_CLOUD_FALLBACK [${envConfig.REMOTE_FALLBACK_MODEL}]` : 'NONE',
    required: true,
    details: cloudReady
      ? undefined
      : 'USE_LOCAL_LLM=false: set EVAL_ALLOW_CLOUD_FALLBACK=true and AGNES_API_KEYS to use cloud in eval',
  };
}

async function checkEmbeddingHealth(): Promise<PreflightCheck> {
  const result = await isEmbeddingServiceHealthy();
  const healthy = result.healthy && result.provider.startsWith('REAL_EMBEDDING_SERVER');
  return {
    service: 'embedding',
    healthy,
    provider: result.provider,
    required: true,
    details: healthy ? undefined : result.details,
  };
}

/**
 * Check online image search availability. Missing keys are reported but do NOT
 * fail the gate: the Research Agent falls back to Wikimedia + curated catalog.
 */
async function checkSearchHealth(): Promise<PreflightCheck> {
  const present = [
    hasAvailableApiKeys('serpapi') || envConfig.SERPAPI_API_KEY ? 'serpapi' : null,
    hasAvailableApiKeys('tavily') || envConfig.TAVILY_API_KEY ? 'tavily' : null,
    hasAvailableApiKeys('brave') || envConfig.BRAVE_API_KEY ? 'brave' : null,
  ].filter(Boolean) as string[];

  if (present.length > 0) {
    return {
      service: 'search',
      healthy: true,
      provider: `ONLINE_SEARCH (${present.join(', ')})`,
      required: false,
    };
  }
  return {
    service: 'search',
    healthy: true,
    provider: 'OFFLINE_FALLBACK (Wikimedia + curated catalog)',
    required: false,
    details: 'No SerpAPI/Tavily/Brave key configured — research uses Wikimedia/catalog fallback (non-blocking)',
  };
}

async function checkPostgresHealth(): Promise<PreflightCheck> {
  const dbCfg = getDatabaseConfig();
  try {
    const isConnected = await isPgAvailable(true);
    if (!isConnected) {
      return {
        service: 'postgres',
        healthy: false,
        provider: 'IN_MEMORY_FALLBACK',
        required: true,
        details: `PostgreSQL connection failed at ${dbCfg.host}:${dbCfg.port}/${dbCfg.database}`,
      };
    }

    const rows = await query<{ extname: string }>('SELECT extname FROM pg_extension WHERE extname = $1;', ['vector']);
    if (rows.length === 0) {
      return {
        service: 'postgres',
        healthy: false,
        provider: `POSTGRES_WITHOUT_PGVECTOR (${dbCfg.host}:${dbCfg.port}/${dbCfg.database})`,
        required: true,
        details: `Connected to PostgreSQL, but 'vector' (pgvector) extension is not installed or enabled in ${dbCfg.database}`,
      };
    }

    return {
      service: 'postgres',
      healthy: true,
      provider: `REAL_POSTGRES_PGVECTOR (${dbCfg.host}:${dbCfg.port}/${dbCfg.database})`,
      required: true,
    };
  } catch (err: any) {
    return {
      service: 'postgres',
      healthy: false,
      provider: 'IN_MEMORY_FALLBACK',
      required: true,
      details: `PostgreSQL check error: ${err?.message || String(err)}`,
    };
  }
}

async function checkRerankerHealth(): Promise<PreflightCheck> {
  const url = envConfig.LOCAL_RERANK_URL || 'http://localhost:8096/v1/rerank';
  const model = envConfig.LOCAL_RERANK_MODEL || 'qwen3-reranker-0.6b';
  const endpoint = url.endsWith('/v1/rerank') ? url : `${url.replace(/\/+$/, '')}/v1/rerank`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        query: 'health_check',
        documents: ['ping', 'pong'],
        top_n: 2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return {
        service: 'reranker',
        healthy: true,
        provider: `REAL_CROSS_ENCODER_RERANKER (${endpoint}) [${model}]`,
        required: true,
      };
    }

    return {
      service: 'reranker',
      healthy: false,
      provider: 'HEURISTIC_KEYWORD_FALLBACK',
      required: true,
      details: `Local Reranker endpoint HTTP ${res.status} at ${endpoint}`,
    };
  } catch (err: any) {
    return {
      service: 'reranker',
      healthy: false,
      provider: 'HEURISTIC_KEYWORD_FALLBACK',
      required: true,
      details: `Local Reranker unreachable at ${endpoint}: ${err?.message || String(err)}`,
    };
  }
}

const CHECKERS: Record<EvalService, () => Promise<PreflightCheck>> = {
  llm: checkLlmHealth,
  embedding: checkEmbeddingHealth,
  tts: checkTtsHealth,
  vlm: checkVlmHealth,
  search: checkSearchHealth,
  postgres: checkPostgresHealth,
  reranker: checkRerankerHealth,
};

/**
 * Run preflight health checks for the requested services.
 * When EVAL_STRICT=false, missing services are reported but do not fail the gate.
 */
export async function runEvalPreflight(required: EvalService[]): Promise<PreflightResult> {
  log.debug('eval.preflight_start', 'Running eval preflight checks', { required });

  const checks: PreflightCheck[] = await Promise.all(
    [...new Set(required)].map((svc) => CHECKERS[svc]())
  );

  const strict = envConfig.EVAL_STRICT;
  const failed = checks.filter((c) => !c.healthy);
  const ok = !strict || failed.length === 0;

  const result: PreflightResult = {
    ok,
    timestamp: new Date().toISOString(),
    checks,
  };

  // Pretty-print summary
  console.log('\n──────────────────────────────────────────────');
  console.log(' EVAL PREFLIGHT CHECK');
  console.log('──────────────────────────────────────────────');
  for (const c of checks) {
    const mark = c.healthy ? '✅' : '❌';
    console.log(` ${mark} [${c.service.toUpperCase()}] ${c.provider}${c.details ? ` — ${c.details}` : ''}`);
  }
  if (strict && failed.length > 0) {
    console.log('\n[EVAL_STRICT] Required services are DOWN. Eval will NOT run.');
    console.log('Fix the services above, or set EVAL_STRICT=false (dev mode, results are NOT valid benchmarks).');
    for (const c of failed) {
      console.log(`  - ${c.service.toUpperCase()}: ${c.details || c.provider}`);
    }
  } else {
    console.log(`\n${ok ? '✅ Preflight OK' : '⚠️ Preflight warnings (non-strict mode)'}`);
  }
  console.log('──────────────────────────────────────────────\n');

  return result;
}

/**
 * Run preflight and hard-fail the process when EVAL_STRICT requires services that are down.
 * Returns the result so callers can embed it in their report.
 */
export async function assertEvalPreflight(required: EvalService[]): Promise<PreflightResult> {
  const result = await runEvalPreflight(required);
  if (envConfig.EVAL_STRICT && !result.ok) {
    console.error('[EVAL_STRICT] Preflight failed — aborting evaluation.');
    process.exit(1);
  }
  return result;
}
