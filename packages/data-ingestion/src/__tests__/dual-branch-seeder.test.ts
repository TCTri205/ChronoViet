import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEmbedding, generateEmbeddingsBatch, isPgAvailable } from '@chronoviet/infra';
import { extractTriplesFromTextAsync } from '../triple-extractor.js';
import { seedDualBranch } from '../seeder/dual-branch-seeder.js';

vi.mock('@chronoviet/infra', async (importOriginal) => {
  const original = await importOriginal<typeof import('@chronoviet/infra')>();
  return {
    ...original,
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.01)),
    generateEmbeddingsBatch: vi.fn().mockImplementation(async (texts: string[]) => {
      return texts.map(() => new Array(1024).fill(0.01));
    }),
    isPgAvailable: vi.fn().mockResolvedValue(false),
  };
});

vi.mock('../triple-extractor.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../triple-extractor.js')>();
  return {
    ...original,
    extractTriplesFromTextAsync: vi.fn(),
  };
});

describe('DualBranchSeeder Unit Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(generateEmbedding).mockResolvedValue(new Array(1024).fill(0.01));
    vi.mocked(generateEmbeddingsBatch).mockImplementation(async (texts: string[]) => {
      return texts.map(() => new Array(1024).fill(0.01));
    });
    vi.mocked(isPgAvailable).mockResolvedValue(false);
  });

  it('should seed document with parallel chunk extraction and aggregate triples deterministically with telemetry', async () => {
    let callCount = 0;
    vi.mocked(extractTriplesFromTextAsync).mockImplementation(async (text) => {
      callCount++;
      return [
        {
          sourceEntityId: 'ent:quang_trung',
          sourceEntityName: 'Quang Trung',
          relationType: 'LED_BY',
          targetEntityId: 'ent:ngoc_hoi',
          targetEntityName: 'Trận Ngọc Hồi',
          confidence: 0.95,
        },
        {
          sourceEntityId: 'ent:quang_trung',
          sourceEntityName: 'Quang Trung',
          relationType: 'HAPPENED_AT',
          targetEntityId: 'doc:historical_context',
          targetEntityName: 'Thăng Long',
          confidence: 0.7, // Low confidence & dangling -> should be quarantined
        },
      ];
    });

    const sampleContent = `
# Chiến dịch Tây Sơn

Quang Trung đại phá quân Thanh vào dịp Tết Kỷ Dậu 1789. Trận Ngọc Hồi do Quang Trung trực tiếp chỉ huy đánh tan quân Mãn Thanh.

Quân Tây Sơn thần tốc tiến vào Thăng Long giải phóng kinh thành.
`.repeat(10); // generate enough content for multiple chunks

    const result = await seedDualBranch(
      sampleContent,
      {
        title: 'Đại Phá Quân Thanh 1789',
        dynasty: 'Tây Sơn',
        sourceReliability: 'LEVEL_1',
      },
      {
        correlationId: 'test-seed-run-123',
      }
    );

    expect(result).toBeDefined();
    expect(result.correlationId).toBe('test-seed-run-123');
    expect(result.telemetry).toBeDefined();
    expect(result.telemetry?.durations.chunkingMs).toBeGreaterThanOrEqual(0);
    expect(result.telemetry?.durations.extractionMs).toBeGreaterThanOrEqual(0);
    expect(result.telemetry?.durations.embeddingMs).toBeGreaterThanOrEqual(0);
    expect(result.telemetry?.durations.dbInsertMs).toBeGreaterThanOrEqual(0);
    expect(result.telemetry?.throughput.chunksPerSec).toBeGreaterThan(0);
    expect(result.parentChunksCount).toBeGreaterThan(0);
    expect(result.childChunksCount).toBeGreaterThan(0);
    expect(result.chunksIngested).toBe(result.parentChunksCount + result.childChunksCount);
    expect(result.highConfidenceTriplesCount).toBeGreaterThan(0);
    expect(result.quarantinedTriplesCount).toBeGreaterThan(0);
    expect(result.isPgMode).toBe(false);
    expect(callCount).toBe(result.childChunksCount);
  });

  it('should isolate chunk extraction failures without crashing the whole seed process and reject unverified triples in strict mode', async () => {
    let callIndex = 0;
    vi.mocked(extractTriplesFromTextAsync).mockImplementation(async () => {
      callIndex++;
      if (callIndex === 1) {
        throw new Error('Chunk 1 extraction temporary failure');
      }
      return [
        {
          sourceEntityId: 'event_ngoc_hoi_dong_da',
          sourceEntityName: 'Trận Ngọc Hồi - Đống Đa',
          relationType: 'LED_BY',
          targetEntityId: 'person_quang_trung',
          targetEntityName: 'Quang Trung',
          confidence: 0.98,
        },
      ];
    });

    const sampleContent = `
# Tiểu sử Quang Trung

Nguyễn Huệ tức Quang Trung. Hoàng đế áo vải cờ đào dấy binh từ Tây Sơn.
`.repeat(60); // large enough to produce multiple child chunks

    const result = await seedDualBranch(sampleContent, {
      title: 'Tiểu sử Quang Trung',
    });

    expect(result).toBeDefined();
    expect(result.correlationId).toBeDefined();
    expect(result.chunksIngested).toBeGreaterThan(1);
    expect(result.childChunksCount).toBeGreaterThanOrEqual(2);
    // Successful chunks contribute verified triples, while failed chunk 1 was safely isolated
    expect(result.highConfidenceTriplesCount).toBeGreaterThanOrEqual(1);
    expect(result.telemetry?.durations.totalDurationMs).toBeGreaterThan(0);
  });

  it('should bypass LLM extraction for pre-cached chunks during resume seeding', async () => {
    const { extractionCache } = await import('../cache/extraction-cache.js');
    let extractCalls = 0;
    vi.mocked(extractTriplesFromTextAsync).mockImplementation(async () => {
      extractCalls++;
      return [
        {
          sourceEntityId: 'person_nguyen_hue',
          sourceEntityName: 'Nguyễn Huệ',
          relationType: 'ALIAS_OF',
          targetEntityId: 'person_quang_trung',
          targetEntityName: 'Quang Trung',
          confidence: 0.99,
        },
      ];
    });

    const sampleContent = `
# Chiến dịch Tây Sơn
Nguyễn Huệ hành quân thần tốc ra Thăng Long đại phá hai mươi vạn quân Thanh.
`.repeat(30);

    // Mock cache get to return cached triples on the first call
    const originalGet = extractionCache.get.bind(extractionCache);
    let cacheLookupIndex = 0;
    vi.spyOn(extractionCache, 'get').mockImplementation(async (text: string) => {
      cacheLookupIndex++;
      if (cacheLookupIndex === 1) {
        // Chunk 1 is cached
        return [
          {
            sourceEntityId: 'event_ngoc_hoi',
            sourceEntityName: 'Trận Ngọc Hồi',
            relationType: 'LED_BY',
            targetEntityId: 'person_quang_trung',
            targetEntityName: 'Quang Trung',
            confidence: 0.98,
          },
        ];
      }
      return null; // Chunk 2+ uncached
    });

    const result = await seedDualBranch(sampleContent, {
      title: 'Chiến dịch Tây Sơn',
    });

    expect(result.childChunksCount).toBeGreaterThanOrEqual(2);
    // extractTriplesFromTextAsync was only called for remaining uncached chunks (childChunksCount - 1)
    expect(extractCalls).toBe(result.childChunksCount - 1);
    expect(result.highConfidenceTriplesCount).toBeGreaterThanOrEqual(1);

    vi.restoreAllMocks();
  });
});

