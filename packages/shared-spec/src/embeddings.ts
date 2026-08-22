/**
 * Embedding Service & Math Utilities: Dense Vectors (BAAI/bge-m3 compatible) & Cosine Distance
 */

import { envConfig } from './config.js';
import { logFallbackAlert, createLogger } from './logger.js';
import {
  checkEmbeddingCircuitState,
  recordEmbeddingCircuitSuccess,
  recordEmbeddingCircuitFailure,
} from './circuit-breaker.js';
import {
  embeddingRequestsTotal,
  embeddingDurationSeconds,
} from './telemetry/metrics.js';

const log = createLogger({ service: 'shared-spec' });

export const EMBEDDING_DIMENSION = envConfig.EMBEDDING_DIMENSION;

/**
 * Deterministic pseudo-random seed generator for text strings (fallback mode)
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function generatePseudoRandomEmbedding(text: string): number[] {
  if (!text || !text.trim()) {
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }

  const vector: number[] = new Array(EMBEDDING_DIMENSION).fill(0);
  const clean = text.toLowerCase().trim();
  const words = clean.split(/\s+/).filter(Boolean);

  // 1. Unigram word hashing
  for (const w of words) {
    const wHash = Math.abs(hashString(w));
    const idx = wHash % EMBEDDING_DIMENSION;
    vector[idx] += 1.5;
    // Secondary distributed projection
    const idx2 = (wHash * 31 + 17) % EMBEDDING_DIMENSION;
    vector[idx2] += 0.8;
  }

  // 2. Bigram hashing for phrase capture
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    const bHash = Math.abs(hashString(bigram));
    const idx = bHash % EMBEDDING_DIMENSION;
    vector[idx] += 2.0;
  }

  // 3. Character 3-gram hashing for subword robustness
  for (let i = 0; i < clean.length - 2; i++) {
    const tri = clean.slice(i, i + 3);
    const tHash = Math.abs(hashString(tri));
    const idx = tHash % EMBEDDING_DIMENSION;
    vector[idx] += 0.3;
  }

  // Normalize vector to unit L2 norm
  let normSquare = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    normSquare += vector[i] * vector[i];
  }

  const norm = Math.sqrt(normSquare) || 1;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    vector[i] /= norm;
  }

  return vector;
}

export const embeddingCache = new Map<string, number[]>();
export const MAX_CACHE_SIZE = 5000;
let warnedMissingApiUrl = false;
let warnedFailedApiUrl = false;

/**
 * Evicts oldest cache entries (FIFO/LRU partial eviction) on capacity overflow.
 */
export function evictOldestCacheEntries(count = Math.floor(MAX_CACHE_SIZE * 0.2)): void {
  const iterator = embeddingCache.keys();
  let evicted = 0;
  while (evicted < count) {
    const next = iterator.next();
    if (next.done) break;
    embeddingCache.delete(next.value);
    evicted++;
  }
}

function setEmbeddingCache(key: string, vector: number[]): void {
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    evictOldestCacheEntries();
  }
  embeddingCache.set(key, vector);
}

function normalizeVector(vector: number[]): number[] {
  let normSquare = 0;
  for (const v of vector) normSquare += v * v;
  const norm = Math.sqrt(normSquare) || 1;
  return vector.map((v) => v / norm);
}

function adaptDimension(vector: number[], targetDim: number): number[] {
  if (vector.length === targetDim) return vector;
  if (vector.length > targetDim) return vector.slice(0, targetDim);
  const padded = new Array(targetDim).fill(0);
  for (let i = 0; i < vector.length; i++) padded[i] = vector[i];
  return padded;
}

/**
 * Generate a dense vector embedding for a given text.
 * Strict Single Source of Truth (SSOT): BGE-M3 (1024 dimensions)
 * 1. Primary: Local / OpenAI-compatible Embedding Server (EMBEDDING_API_URL, model: LOCAL_EMBEDDING_MODEL)
 * 2. Fallback: Deterministic Pseudo-Random Vector Generator (Offline / Testing only)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }

  const trimmed = text.trim();
  if (embeddingCache.has(trimmed)) {
    return embeddingCache.get(trimmed)!;
  }

  const startTime = performance.now();
  const apiUrl = envConfig.EMBEDDING_API_URL;
  const circuitState = checkEmbeddingCircuitState();
  const isCircuitOpen = circuitState === 'FAST_FAIL';
  const resolvedEmbeddingModel = envConfig.LOCAL_EMBEDDING_MODEL || envConfig.LOCAL_EMBEDDING_DEFAULT || 'bge-m3';

  if (!apiUrl || isCircuitOpen) {
    if (envConfig.EVAL_STRICT) {
      throw new Error('[EVAL_STRICT] Embedding server unavailable during evaluation; fallback disabled');
    }

    if (!warnedMissingApiUrl && envConfig.NODE_ENV !== 'test' && !isCircuitOpen) {
      log.warn('embedding.api_unconfigured', 'Embedding API URL is not configured; using pseudo-random fallback', {
        fallback: 'Deterministic Pseudo-Random Vector Generator',
        actionRequired: 'Set EMBEDDING_API_URL=http://localhost:8090/v1/embeddings in .env',
      });
      logFallbackAlert({
        subsystem: 'EMBEDDING',
        primaryTarget: `Embedding API Server (${resolvedEmbeddingModel})`,
        fallbackTarget: 'Deterministic Pseudo-Random Vector Generator',
        reason: 'EMBEDDING_API_URL environment variable is unconfigured',
        actionRequired: 'Set EMBEDDING_API_URL=http://localhost:8090/v1/embeddings in .env',
      });
      warnedMissingApiUrl = true;
    }
    const fallbackVec = generatePseudoRandomEmbedding(trimmed);
    setEmbeddingCache(trimmed, fallbackVec);
    embeddingRequestsTotal.inc({ model: 'pseudo-random-fallback', status: 'fallback' });
    embeddingDurationSeconds.observe({ model: 'pseudo-random-fallback' }, (performance.now() - startTime) / 1000);
    return fallbackVec;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const isOllamaEmbeddingsEndpoint = apiUrl.includes('11434') || apiUrl.includes('/api/embeddings');
    // BGE-M3 max context is 8192 tokens (~24,000 chars). Clamp text to prevent physical batch overflow
    const maxChars = Number(process.env.EMBEDDING_MAX_CHARS) || 24000;
    const sanitizedText = trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;

    const reqBody = isOllamaEmbeddingsEndpoint
      ? { model: resolvedEmbeddingModel, prompt: sanitizedText }
      : { model: resolvedEmbeddingModel, input: sanitizedText };

    const timeoutMs = envConfig.NODE_ENV === 'test' ? 1000 : (envConfig.EMBEDDING_TIMEOUT_MS || 60000);
    const maxAttempts = envConfig.NODE_ENV === 'test' ? 1 : 2;

    let res: Response | null = null;
    let lastFetchError: unknown = null;

    // Execute with retry on transient failure
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        res = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.ok) break;
      } catch (fErr) {
        lastFetchError = fErr;
        if (attempt === 0 && maxAttempts > 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    if (!res || !res.ok) {
      const err = lastFetchError instanceof Error ? lastFetchError : new Error(`Embedding API HTTP ${res?.status || 'ERR'}: ${res?.statusText || 'Fetch failed'}`);
      throw err;
    }

    const data = (await res.json()) as any;
    let rawVector: number[] = [];

    if (Array.isArray(data) && typeof data[0] === 'number') {
      rawVector = data;
    } else if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === 'number') {
      rawVector = data[0];
    } else if (data.data && Array.isArray(data.data) && data.data[0]?.embedding) {
      rawVector = data.data[0].embedding;
    } else if (Array.isArray(data.embedding)) {
      rawVector = data.embedding;
    } else if (data.embeddings && Array.isArray(data.embeddings[0])) {
      rawVector = data.embeddings[0];
    } else {
      throw new Error('Unrecognized embedding response format from server');
    }

    if (!rawVector || rawVector.length === 0) {
      throw new Error('Embedding API returned empty vector array []');
    }

    const adapted = adaptDimension(rawVector, EMBEDDING_DIMENSION);
    const normalized = normalizeVector(adapted);

    recordEmbeddingCircuitSuccess();
    embeddingRequestsTotal.inc({ model: resolvedEmbeddingModel, status: 'success' });
    embeddingDurationSeconds.observe({ model: resolvedEmbeddingModel }, (performance.now() - startTime) / 1000);

    setEmbeddingCache(trimmed, normalized);
    return normalized;
  } catch (err) {
    recordEmbeddingCircuitFailure(err);
    embeddingRequestsTotal.inc({ model: resolvedEmbeddingModel, status: 'error' });
    embeddingDurationSeconds.observe({ model: resolvedEmbeddingModel }, (performance.now() - startTime) / 1000);

    const errMsg = err instanceof Error ? err.message : String(err);
    if (envConfig.EVAL_STRICT) {
      throw new Error(`[EVAL_STRICT] Embedding server unavailable during evaluation; pseudo-random fallback disabled: ${errMsg}`);
    }
    if (!warnedFailedApiUrl) {
      log.warn('embedding.api_failed', 'Embedding API server offline/unreachable; using deterministic pseudo-random fallback', {
        error: errMsg,
        apiUrl,
        model: resolvedEmbeddingModel,
      });
      logFallbackAlert({
        subsystem: 'EMBEDDING',
        primaryTarget: `Embedding API Server (${resolvedEmbeddingModel})`,
        fallbackTarget: 'Deterministic Pseudo-Random Vector Generator',
        reason: errMsg,
        actionRequired: 'Ensure local embedding server is running on port 8090 or check EMBEDDING_API_URL',
      });
      warnedFailedApiUrl = true;
    }
    const fallbackVec = generatePseudoRandomEmbedding(trimmed);
    setEmbeddingCache(trimmed, fallbackVec);
    return fallbackVec;
  }
}

/**
 * Batch generate embeddings for multiple texts.
 * Automatically utilizes native OpenAI-compatible batching when available,
 * and falls back gracefully to individual embedding calls when required.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  concurrency = envConfig.EMBEDDING_CONCURRENCY || 4
): Promise<number[][]> {
  if (!texts || texts.length === 0) return [];

  const results: number[][] = new Array(texts.length);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  // 1. Check cache first
  for (let i = 0; i < texts.length; i++) {
    const trimmed = (texts[i] || '').trim();
    if (!trimmed) {
      results[i] = new Array(EMBEDDING_DIMENSION).fill(0);
    } else if (embeddingCache.has(trimmed)) {
      results[i] = embeddingCache.get(trimmed)!;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(trimmed);
    }
  }

  if (uncachedIndices.length === 0) {
    return results;
  }

  const apiUrl = envConfig.EMBEDDING_API_URL;
  const isCircuitOpen = checkEmbeddingCircuitState() === 'FAST_FAIL';
  const resolvedEmbeddingModel = envConfig.LOCAL_EMBEDDING_MODEL || envConfig.LOCAL_EMBEDDING_DEFAULT || 'bge-m3';
  const isOllamaEmbeddingsEndpoint = apiUrl?.includes('11434') || apiUrl?.includes('/api/embeddings');

  // 2. Native Multi-Text Batch Embedding via OpenAI-compatible endpoint (Parallel Multi-Batch Pool)
  if (apiUrl && !isCircuitOpen && !isOllamaEmbeddingsEndpoint) {
    const targetApiUrl = apiUrl;
    const batchSize = envConfig.EMBEDDING_BATCH_SIZE || 16;
    const timeoutMs = envConfig.NODE_ENV === 'test' ? 1000 : (envConfig.EMBEDDING_TIMEOUT_MS || 60000);
    const maxChars = Number(process.env.EMBEDDING_MAX_CHARS) || 24000;
    const concurrencySlots = envConfig.EMBEDDING_CONCURRENCY || 4;

    interface BatchTask {
      sliceTexts: string[];
      indices: number[];
    }

    const tasks: BatchTask[] = [];
    for (let bStart = 0; bStart < uncachedTexts.length; bStart += batchSize) {
      tasks.push({
        sliceTexts: uncachedTexts.slice(bStart, bStart + batchSize),
        indices: uncachedIndices.slice(bStart, bStart + batchSize),
      });
    }

    let nextTaskIdx = 0;
    let nativeBatchSuccess = true;

    const targetUrl = apiUrl;
    async function batchWorker() {
      while (nextTaskIdx < tasks.length && nativeBatchSuccess) {
        const task = tasks[nextTaskIdx++];
        const sanitizedSlice = task.sliceTexts.map((t) => (t.length > maxChars ? t.slice(0, maxChars) : t));

        try {
          const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: resolvedEmbeddingModel, input: sanitizedSlice }),
            signal: AbortSignal.timeout(timeoutMs),
          });

          if (!res.ok) throw new Error(`Batch embedding HTTP ${res.status}: ${res.statusText}`);
          const data = (await res.json()) as any;

          if (data.data && Array.isArray(data.data) && data.data.length === task.sliceTexts.length) {
            for (let k = 0; k < task.sliceTexts.length; k++) {
              const rawVec = data.data[k]?.embedding;
              if (rawVec && Array.isArray(rawVec)) {
                const adapted = adaptDimension(rawVec, EMBEDDING_DIMENSION);
                const normalized = normalizeVector(adapted);
                const origIdx = task.indices[k];
                results[origIdx] = normalized;
                setEmbeddingCache(task.sliceTexts[k], normalized);
              } else {
                throw new Error('Malformed vector in batch response');
              }
            }
            recordEmbeddingCircuitSuccess();
          } else {
            throw new Error('Batch response length mismatch');
          }
        } catch (err) {
          recordEmbeddingCircuitFailure(err);
          nativeBatchSuccess = false;
          break;
        }
      }
    }

    const workerCount = Math.min(concurrencySlots, tasks.length);
    const workers = Array.from({ length: workerCount }, () => batchWorker());
    await Promise.all(workers);

    if (nativeBatchSuccess) {
      return results;
    }
  }

  // 3. Fallback: Concurrency-bounded Individual Generation
  for (let i = 0; i < uncachedIndices.length; i += concurrency) {
    const batchIndices = uncachedIndices.slice(i, i + concurrency);
    const batchTexts = uncachedTexts.slice(i, i + concurrency);
    const batchResults = await Promise.all(batchTexts.map((t) => generateEmbedding(t)));
    for (let j = 0; j < batchResults.length; j++) {
      results[batchIndices[j]] = batchResults[j];
    }
  }

  return results;
}


/**
 * Computes Cosine Similarity between two 1024d vectors
 * Fast-path for unit vectors (L2 norm = 1)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  // If vectors are already normalized (L2 norm ~ 1), return dot product directly
  if (Math.abs(normA - 1.0) < 1e-4 && Math.abs(normB - 1.0) < 1e-4) {
    return dotProduct;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Pre-flight health check for Embedding Service
 */
export async function isEmbeddingServiceHealthy(): Promise<{ healthy: boolean; provider: string; details?: string }> {
  const apiUrl = envConfig.EMBEDDING_API_URL;
  if (!apiUrl) {
    return {
      healthy: false,
      provider: 'FALLBACK_PSEUDO_RANDOM',
      details: 'EMBEDDING_API_URL is unconfigured in .env',
    };
  }

  try {
    const resolvedEmbeddingModel = envConfig.LOCAL_EMBEDDING_MODEL || envConfig.LOCAL_EMBEDDING_DEFAULT || 'bge-m3';
    const isOllama = apiUrl.includes('11434') || apiUrl.includes('/api/embeddings');
    const reqBody = isOllama
      ? { model: resolvedEmbeddingModel, prompt: 'health_check' }
      : { model: resolvedEmbeddingModel, input: 'health_check' };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      return {
        healthy: true,
        provider: `REAL_EMBEDDING_SERVER (${apiUrl})`,
      };
    }
    return {
      healthy: false,
      provider: 'FALLBACK_PSEUDO_RANDOM',
      details: `HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err) {
    return {
      healthy: false,
      provider: 'FALLBACK_PSEUDO_RANDOM',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

