import { describe, it, expect } from 'vitest';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  EMBEDDING_DIMENSION,
} from '../embeddings.js';

describe('Embedding Service (SSOT 1024-dim Vector Space)', { timeout: 15000 }, () => {
  it('should generate a 1024-dimensional vector for non-empty text', async () => {
    const vec = await generateEmbedding('Trận Bạch Đằng năm 938 Ngô Quyền');
    expect(Array.isArray(vec)).toBe(true);
    expect(vec.length).toBe(EMBEDDING_DIMENSION);
    expect(vec.length).toBe(1024);
  });

  it('should return a zero-vector of 1024 dimensions for empty/blank text', async () => {
    const emptyVec = await generateEmbedding('');
    expect(emptyVec.length).toBe(1024);
    expect(emptyVec.every((val) => val === 0)).toBe(true);

    const whitespaceVec = await generateEmbedding('   ');
    expect(whitespaceVec.length).toBe(1024);
    expect(whitespaceVec.every((val) => val === 0)).toBe(true);
  });

  it('should generate normalized unit vectors (L2 norm ~ 1.0)', async () => {
    const vec = await generateEmbedding('Đại Cồ Việt thời Đinh Tiên Hoàng');
    const normSquare = vec.reduce((sum, v) => sum + v * v, 0);
    expect(Math.abs(Math.sqrt(normSquare) - 1.0)).toBeLessThan(0.01);
  });

  it('should produce deterministic output for identical input strings', async () => {
    const text = 'Chiến dịch Điện Biên Phủ 1954';
    const vec1 = await generateEmbedding(text);
    const vec2 = await generateEmbedding(text);
    expect(vec1).toEqual(vec2);
    expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0, 4);
  });

  it('should calculate cosine similarity correctly', async () => {
    const vecA = await generateEmbedding('Trần Hưng Đạo ba lần đại phá quân Nguyên Mông');
    const vecB = await generateEmbedding('Trần Quốc Tuấn lãnh đạo quân dân nhà Trần đánh Nguyên Mông');
    const vecC = await generateEmbedding('Lập trình web bằng React và Vite frontend');

    const simRelated = cosineSimilarity(vecA, vecB);
    const simUnrelated = cosineSimilarity(vecA, vecC);

    // Related historical topics should have higher similarity than unrelated topics
    expect(simRelated).toBeGreaterThan(simUnrelated);
  });

  it('should batch generate embeddings with consistent dimensions', async () => {
    const inputs = [
      'Quang Trung Nguyễn Huệ',
      'Lê Lợi khởi nghĩa Lam Sơn',
      'Lý Thường Kiệt phạt Tống',
    ];

    const results = await generateEmbeddingsBatch(inputs);
    expect(results.length).toBe(3);
    for (const res of results) {
      expect(res.length).toBe(1024);
    }
  });
});
