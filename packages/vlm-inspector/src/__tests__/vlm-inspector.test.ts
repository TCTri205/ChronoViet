import { describe, it, expect } from 'vitest';
import { isWhitelistedLicense } from '../inspector-pipeline.js';
import { scoreImageWithLocalCLIP, cosineSimilarity, extractTextVector } from '../clip-scorer.js';
import { computePHash, computeSha256 } from '../asset-downloader.js';

describe('VLM Inspector Unit Tests', () => {
  describe('License Filter', () => {
    it('should whitelist open and public domain licenses', () => {
      expect(isWhitelistedLicense('PUBLIC_DOMAIN')).toBe(true);
      expect(isWhitelistedLicense('CC0')).toBe(true);
      expect(isWhitelistedLicense('CC_BY_4_0')).toBe(true);
      expect(isWhitelistedLicense('CC_BY_SA_4_0')).toBe(true);
    });

    it('should reject non-free licenses', () => {
      expect(isWhitelistedLicense('ALL_RIGHTS_RESERVED')).toBe(false);
      expect(isWhitelistedLicense('UNKNOWN')).toBe(false);
      expect(isWhitelistedLicense('CC_BY_NC')).toBe(false);
    });
  });

  describe('Local CLIP Scorer', () => {
    it('should compute valid cosine similarity for identical and orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [1, 0, 0];
      const vecC = [0, 1, 0];

      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0);
      expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0);
    });

    it('should extract text vectors and score historical images accurately', () => {
      const result = scoreImageWithLocalCLIP(
        'https://example.com/bach_dang.jpg',
        'Trận chiến Bạch Đằng năm 938 của Ngô Quyền',
        { title: 'Tượng đài Ngô Quyền và bãi cọc Bạch Đằng' }
      );

      expect(result.historicalContextScore).toBeGreaterThanOrEqual(20);
      expect(result.totalScore).toBeGreaterThanOrEqual(60);
      expect(result.passed).toBe(true);
    });
  });

  describe('Asset Hashing', () => {
    it('should compute sha256 and pHash for buffer', () => {
      const buf = Buffer.from('test_image_bytes_chronoviet');
      const sha = computeSha256(buf);
      const phash = computePHash(buf);

      expect(sha).toBeDefined();
      expect(sha.length).toBe(64);
      expect(phash).toBeDefined();
      expect(phash.length).toBeGreaterThan(0);
    });
  });
});
