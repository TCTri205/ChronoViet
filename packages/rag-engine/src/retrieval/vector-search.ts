export interface VectorSearchResult {
  chunkId: string;
  title: string;
  textContent: string;
  score: number;
}

export async function searchDenseVector(
  _queryEmbedding: number[],
  _topK: number = 5
): Promise<VectorSearchResult[]> {
  // Stub implementation for dense vector search via pgvector
  return [];
}
