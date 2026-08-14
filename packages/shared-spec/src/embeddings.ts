/**
 * Embedding Service & Math Utilities: Dense Vectors (BAAI/bge-m3 compatible) & Cosine Distance
 */

import { envConfig } from './config.js';
import { logFallbackAlert, createLogger } from './logger.js';

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

const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 2000;
let warnedMissingApiUrl = false;
let warnedFailedApiUrl = false;

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
 * Generates a normalized 1024-dimensional dense vector
 * Connects to real BGE-M3 / TEI / Ollama / OpenAI embedding server if EMBEDDING_API_URL is set.
 * Uses pseudo-random hash generator as fallback when EMBEDDING_API_URL is unconfigured or request fails.
 */
let serverUnreachable = false;

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }

  const trimmed = text.trim();
  if (embeddingCache.has(trimmed)) {
    return embeddingCache.get(trimmed)!;
  }

  const apiUrl = envConfig.EMBEDDING_API_URL;
  if (!apiUrl || serverUnreachable) {
    if (!warnedMissingApiUrl && typeof process !== 'undefined' && process.env.NODE_ENV !== 'test' && !serverUnreachable) {
      log.warn('embedding.api_unconfigured', 'Embedding API URL is not configured; using pseudo-random fallback', {
        fallback: 'Deterministic Pseudo-Random Vector Generator',
        actionRequired: 'Set EMBEDDING_API_URL=http://localhost:8080/v1/embeddings in .env',
      });
      logFallbackAlert({
        subsystem: 'EMBEDDING',
        primaryTarget: `Embedding API Server (${envConfig.LOCAL_EMBEDDING_DEFAULT})`,
        fallbackTarget: 'Deterministic Pseudo-Random Vector Generator',
        reason: 'EMBEDDING_API_URL environment variable is unconfigured',
        actionRequired: 'Set EMBEDDING_API_URL=http://localhost:8080/v1/embeddings in .env',
      });
      warnedMissingApiUrl = true;
    }
    const fallbackVec = generatePseudoRandomEmbedding(trimmed);
    if (embeddingCache.size >= MAX_CACHE_SIZE) embeddingCache.clear();
    embeddingCache.set(trimmed, fallbackVec);
    return fallbackVec;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (envConfig.GEMINI_API_KEY) {
      headers['Authorization'] = `Bearer ${envConfig.GEMINI_API_KEY}`;
    }

    const isOllamaEmbeddingsEndpoint = apiUrl.includes('11434') || apiUrl.includes('/api/embeddings');
    const reqBody = isOllamaEmbeddingsEndpoint
      ? { model: envConfig.LOCAL_EMBEDDING_DEFAULT, prompt: trimmed }
      : { model: envConfig.LOCAL_EMBEDDING_DEFAULT, input: trimmed };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Embedding API HTTP ${res.status}: ${res.statusText}`);
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

    if (embeddingCache.size >= MAX_CACHE_SIZE) embeddingCache.clear();
    embeddingCache.set(trimmed, normalized);
    return normalized;
  } catch (err) {
    serverUnreachable = true;
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('embedding.api_failed', 'Embedding API request failed; using pseudo-random fallback', {
      error: err,
      apiUrl,
    });
    if (!warnedFailedApiUrl) {
      logFallbackAlert({
        subsystem: 'EMBEDDING',
        primaryTarget: `Embedding API Server (${apiUrl}) [${envConfig.LOCAL_EMBEDDING_DEFAULT}]`,
        fallbackTarget: 'Deterministic Pseudo-Random Vector Generator',
        reason: errMsg,
        actionRequired: `Verify embedding server is running on ${apiUrl}`,
      });
      warnedFailedApiUrl = true;
    }
    const fallbackVec = generatePseudoRandomEmbedding(trimmed);
    if (embeddingCache.size >= MAX_CACHE_SIZE) embeddingCache.clear();
    embeddingCache.set(trimmed, fallbackVec);
    return fallbackVec;
  }
}

/**
 * Batch embedding generation helper
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((t) => generateEmbedding(t)));
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
    const isOllama = apiUrl.includes('11434') || apiUrl.includes('/api/embeddings');
    const reqBody = isOllama
      ? { model: envConfig.LOCAL_EMBEDDING_DEFAULT, prompt: 'health_check' }
      : { model: envConfig.LOCAL_EMBEDDING_DEFAULT, input: 'health_check' };

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

