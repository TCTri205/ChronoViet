/**
 * Embedding Service & Math Utilities: Dense Vectors (BAAI/bge-m3 compatible) & Cosine Distance
 */

import { envConfig } from './config.js';

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
  if (!text) {
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }

  const seed = hashString(text);
  const vector: number[] = new Array(EMBEDDING_DIMENSION);
  let normSquare = 0;

  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const val = Math.sin(seed * 0.0001 + i * 0.173) * 2 - 1;
    vector[i] = val;
    normSquare += val * val;
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
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }

  const trimmed = text.trim();
  if (embeddingCache.has(trimmed)) {
    return embeddingCache.get(trimmed)!;
  }

  const apiUrl = envConfig.EMBEDDING_API_URL;
  if (!apiUrl) {
    if (!warnedMissingApiUrl && typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      console.warn('[EmbeddingService] EMBEDDING_API_URL not configured — using pseudo-random fallback embeddings');
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
      ? { model: 'bge-m3', prompt: trimmed }
      : { model: 'bge-m3', input: trimmed };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody),
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
    console.error(`[EmbeddingService] Remote embedding request failed (${apiUrl}):`, err instanceof Error ? err.message : err);
    return generatePseudoRandomEmbedding(trimmed);
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
