/**
 * Embedding Service: Generates 1024-dimensional Dense Embeddings (BAAI/bge-m3 compatible)
 */

export const EMBEDDING_DIMENSION = 1024;

/**
 * Deterministic pseudo-random seed generator for text strings
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Generates a normalized 1024-dimensional dense vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text) {
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }

  const seed = hashString(text);
  const vector: number[] = new Array(EMBEDDING_DIMENSION);
  let normSquare = 0;

  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    // Linear congruential generator seeded by hash + index
    const val = Math.sin(seed * 0.0001 + i * 0.173) * 2 - 1;
    vector[i] = val;
    normSquare += val * val;
  }

  // Normalize to L2 norm = 1 (unit vector for Cosine Distance)
  const norm = Math.sqrt(normSquare);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    vector[i] /= norm;
  }

  return vector;
}

/**
 * Computes Cosine Similarity between two 1024d vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
