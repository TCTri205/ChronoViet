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

  const model = options?.model || envConfig.LOCAL_RERANK_MODEL || 'qwen3-reranker-0.6b';
  const rawUrl = options?.url || envConfig.LOCAL_RERANK_URL || 'http://localhost:8096/v1/rerank';
  const timeoutMs = options?.timeoutMs || envConfig.RERANK_TIMEOUT_MS || 15000;
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
      const score =
        typeof item.relevance_score === 'number'
          ? item.relevance_score
          : typeof item.score === 'number'
          ? item.score
          : typeof item.logit === 'number'
          ? 1 / (1 + Math.exp(-item.logit)) // Sigmoid conversion for logits
          : 0;

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
    rerankDurationSeconds.observe({ model, status: 'error' }, durationSec);

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
