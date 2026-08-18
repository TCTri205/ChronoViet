import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEmbedding, isPgAvailable } from '@chronoviet/shared-spec';
import { extractTriplesFromTextAsync } from '../triple-extractor.js';
import { seedDualBranch } from '../seeder/dual-branch-seeder.js';
import { extractionCache } from '../cache/extraction-cache.js';

vi.mock('@chronoviet/shared-spec', async (importOriginal) => {
  const original = await importOriginal<typeof import('@chronoviet/shared-spec')>();
  return {
    ...original,
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.01)),
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
    await extractionCache.clear();
    vi.mocked(generateEmbedding).mockResolvedValue(new Array(1024).fill(0.01));
    vi.mocked(isPgAvailable).mockResolvedValue(false);
  });

  it('should seed document with parallel chunk extraction and aggregate triples deterministically', async () => {
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

    const result = await seedDualBranch(sampleContent, {
      title: 'Đại Phá Quân Thanh 1789',
      dynasty: 'Tây Sơn',
      sourceReliability: 'LEVEL_1',
    });

    expect(result).toBeDefined();
    expect(result.parentChunksCount).toBeGreaterThan(0);
    expect(result.childChunksCount).toBeGreaterThan(0);
    expect(result.chunksIngested).toBe(result.parentChunksCount + result.childChunksCount);
    expect(result.highConfidenceTriplesCount).toBeGreaterThan(0);
    expect(result.quarantinedTriplesCount).toBeGreaterThan(0);
    expect(result.isPgMode).toBe(false);
    expect(callCount).toBe(result.chunksIngested);
  });

  it('should isolate chunk extraction failures without crashing the whole seed process', async () => {
    let callIndex = 0;
    vi.mocked(extractTriplesFromTextAsync).mockImplementation(async () => {
      callIndex++;
      if (callIndex === 1) {
        throw new Error('Chunk 1 extraction temporary failure');
      }
      return [
        {
          sourceEntityId: 'ent:nguyen_hue',
          sourceEntityName: 'Nguyễn Huệ',
          relationType: 'ALIAS_OF',
          targetEntityId: 'ent:quang_trung',
          targetEntityName: 'Quang Trung',
          confidence: 1.0,
        },
      ];
    });

    const sampleContent = `
Nguyễn Huệ tức Quang Trung. Hoàng đế áo vải cờ đào dấy binh từ Tây Sơn.
`.repeat(15);

    const result = await seedDualBranch(sampleContent, {
      title: 'Tiểu sử Quang Trung',
    });

    expect(result).toBeDefined();
    expect(result.chunksIngested).toBeGreaterThan(0);
    expect(result.highConfidenceTriplesCount).toBeGreaterThanOrEqual(1);
  });
});
