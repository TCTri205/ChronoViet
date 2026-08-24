/**
 * Local Cross-Encoder Reranker Client
 * Integrates directly with llama-server / TEI Metal Engine (/v1/rerank)
 * Strictly executes Qwen3-Reranker-0.6B / bge-reranker-v2-m3 (GGUF Q8_0)
 */

import { envConfig } from './config.js';
import { createLogger } from './logger.js';
import { rerankRequestsTotal, rerankDurationSeconds } from './telemetry/metrics.js';

const log = createLogger({ service: 'reranker-client' });

export interface LocalRerankItemResult {
  index: number;
  score: number;
}

export interface LocalRerankOptions {
  model?: string;
  url?: string;
  timeoutMs?: number;
  topN?: number;
}

let rerankCircuitOpenUntil = 0;
let rerankConsecutiveFailures = 0;
const RERANK_CIRCUIT_COOLDOWN_MS = 30000;
const RERANK_FAILURE_THRESHOLD = 2;

export function resetRerankerCircuitForTest(): void {
  rerankCircuitOpenUntil = 0;
  rerankConsecutiveFailures = 0;
}

/**
 * Executes Cross-Encoder Reranking via Local Model HTTP Endpoint (/v1/rerank)
 */
export async function rerankWithLocalCrossEncoder(
  query: string,
  documents: string[],
  options?: LocalRerankOptions
): Promise<LocalRerankItemResult[]> {
  if (!query || !query.trim() || !documents || documents.length === 0) {
    return [];
  }

  // Fast-path: Circuit breaker active
  if (Date.now() < rerankCircuitOpenUntil) {
    throw new Error(`[LOCAL_RERANK_CIRCUIT_OPEN] Local reranker offline (circuit cooling down until ${new Date(rerankCircuitOpenUntil).toISOString()})`);
  }

  const model = options?.model || envConfig.LOCAL_RERANK_MODEL || 'qwen3-reranker-0.6b';
  const rawUrl = options?.url || envConfig.LOCAL_RERANK_URL || 'http://localhost:8096/v1/rerank';
  const timeoutMs = options?.timeoutMs || envConfig.RERANK_TIMEOUT_MS || 2500;
  const topN = options?.topN || documents.length;
  const startTime = Date.now();

  const endpointUrl = rawUrl.endsWith('/v1/rerank')
    ? rawUrl
    : `${rawUrl.replace(/\/+$/, '')}/v1/rerank`;

  const payload = {
    model,
    query: query.trim(),
    documents,
    top_n: topN,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    rerankConsecutiveFailures = 0;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`[LOCAL_RERANK_ERROR] Server at ${endpointUrl} returned HTTP ${res.status}: ${errText}`);
    }

    const data: any = await res.json();

    // Support standard TEI / llama.cpp / Cohere format: { results: [{ index: 0, relevance_score: 0.95 }, ...] }
    let rawResults: any[] = [];
    if (Array.isArray(data?.results)) {
      rawResults = data.results;
    } else if (Array.isArray(data?.data)) {
      rawResults = data.data;
    } else if (Array.isArray(data)) {
      rawResults = data;
    }

    const parsedResults: LocalRerankItemResult[] = rawResults.map((item: any, fallbackIdx: number) => {
      const index = typeof item.index === 'number' ? item.index : fallbackIdx;
      let score = 0;

      if (typeof item.logit === 'number') {
        score = 1 / (1 + Math.exp(-item.logit));
      } else if (typeof item.relevance_score === 'number') {
        const raw = item.relevance_score;
        score = raw < 0 || raw > 1 ? 1 / (1 + Math.exp(-raw)) : raw;
      } else if (typeof item.score === 'number') {
        const raw = item.score;
        score = raw < 0 || raw > 1 ? 1 / (1 + Math.exp(-raw)) : raw;
      }

      return { index, score };
    });

    if (parsedResults.length === 0 && documents.length > 0) {
      throw new Error(`[LOCAL_RERANK_ERROR] Invalid empty response from ${endpointUrl}`);
    }

    const durationSec = (Date.now() - startTime) / 1000;
    rerankRequestsTotal.inc({ model, status: 'success' });
    rerankDurationSeconds.observe({ model, status: 'success' }, durationSec);

    return parsedResults;
  } catch (err: any) {
    clearTimeout(timeoutId);
    const durationSec = (Date.now() - startTime) / 1000;
    rerankRequestsTotal.inc({ model, status: 'error' });
    rerankConsecutiveFailures++;
    if (rerankConsecutiveFailures >= RERANK_FAILURE_THRESHOLD) {
      rerankCircuitOpenUntil = Date.now() + RERANK_CIRCUIT_COOLDOWN_MS;
      log.warn('reranker.circuit_opened', `Reranker circuit opened for ${RERANK_CIRCUIT_COOLDOWN_MS / 1000}s due to ${rerankConsecutiveFailures} consecutive failures`, {
        cooldownMs: RERANK_CIRCUIT_COOLDOWN_MS,
        failures: rerankConsecutiveFailures,
        error: err?.message || String(err),
      });
    }

    log.warn('reranker.request_failed', 'Local Cross-Encoder request failed; fallback active', {
      endpointUrl,
      model,
      documentCount: documents.length,
      durationMs: Date.now() - startTime,
      error: err?.message || String(err),
    });
    throw err;
  }
}
