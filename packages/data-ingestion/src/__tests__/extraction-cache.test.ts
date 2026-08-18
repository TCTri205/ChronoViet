import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { ExtractionCache } from '../cache/extraction-cache.js';
import { ExtractedTriple } from '../triple-extractor.js';

describe('ExtractionCache Unit Tests', () => {
  let tempDir: string;
  let cache: ExtractionCache;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-extraction-cache-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
    await fs.mkdir(tempDir, { recursive: true });
    cache = new ExtractionCache(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should compute deterministic hash for chunk text', () => {
    const hash1 = cache.computeHash('   Quang Trung đại phá quân Thanh  ');
    const hash2 = cache.computeHash('Quang Trung đại phá quân Thanh');
    expect(hash1).toBe(hash2);
  });

  it('should return null for cache miss and cached triples for cache hit', async () => {
    const text = 'Lê Lợi khởi nghĩa Lam Sơn năm 1418.';
    const missed = await cache.get(text);
    expect(missed).toBeNull();

    const sampleTriples: ExtractedTriple[] = [
      {
        sourceEntityId: 'ent:le_loi',
        sourceEntityName: 'Lê Lợi',
        relationType: 'LED_BY',
        targetEntityId: 'ent:khoi_nghia_lam_son',
        targetEntityName: 'Khởi nghĩa Lam Sơn',
        confidence: 0.98,
      },
    ];

    await cache.set(text, 'chunk-1', sampleTriples, {
      provider: 'TEST_LLM',
      model: 'test-model',
    });

    const cached = await cache.get(text);
    expect(cached).toBeDefined();
    expect(cached?.length).toBe(1);
    expect(cached?.[0].sourceEntityName).toBe('Lê Lợi');
    expect(cached?.[0].relationType).toBe('LED_BY');
    expect((cached as any)?._meta?.provider).toBe('TEST_LLM');
    expect((cached as any)?._meta?.cached).toBe(true);
  });

  it('should clear cache properly and report accurate stats', async () => {
    await cache.set('Text 1', 'chunk-1', []);
    await cache.set('Text 2', 'chunk-2', []);

    let stats = await cache.getStats();
    expect(stats.count).toBe(2);

    const clearedCount = await cache.clear();
    expect(clearedCount).toBe(2);

    stats = await cache.getStats();
    expect(stats.count).toBe(0);
  });
});
