import { describe, it, expect } from 'vitest';
import { isWhitelistedLicense } from '../../src/license-filter.js';
import {
  cosineSimilarity,
  extractTextVector,
  scoreImageWithLocalCLIP,
} from '../../src/clip-scorer.js';
import { computePHash, computeSha256 } from '../../src/asset-downloader.js';

describe('VLM Inspector Eval Metric Unit Tests', () => {
  it('correctly audits standard licenses against whitelist', () => {
    expect(isWhitelistedLicense('PUBLIC_DOMAIN')).toBe(true);
    expect(isWhitelistedLicense('CC0')).toBe(true);
    expect(isWhitelistedLicense('CC_BY_4_0')).toBe(true);
    expect(isWhitelistedLicense('CC_BY_SA_4_0')).toBe(true);

    expect(isWhitelistedLicense('ALL_RIGHTS_RESERVED')).toBe(false);
    expect(isWhitelistedLicense('CC_NC_4_0')).toBe(false);
    expect(isWhitelistedLicense('COPYRIGHT_STRICT')).toBe(false);
  });

  it('computes mathematical vector cosine similarity correctly', () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const v3 = [0, 1, 0];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
    expect(cosineSimilarity(v1, v3)).toBeCloseTo(0.0);
  });

  it('extracts bounded normalized text vectors', () => {
    const vec = extractTextVector('Thời kỳ Hùng Vương dựng nước Văn Lang', 64);
    expect(vec).toHaveLength(64);
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 3);
  });

  it('evaluates semantic relevance and noise penalty in scoring bounds', () => {
    const cleanResult = scoreImageWithLocalCLIP(
      'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg',
      'Hai Bà Trưng cưỡi voi khởi nghĩa Hát Môn',
      { title: 'Tư liệu lịch sử Tranh Đông Hồ Hai Bà Trưng' }
    );
    expect(cleanResult.historicalContextScore).toBeGreaterThanOrEqual(20);
    expect(cleanResult.visualNoiseScore).toBeGreaterThanOrEqual(20);
    expect(cleanResult.passed).toBe(true);

    const noisyResult = scoreImageWithLocalCLIP(
      'https://example.com/noisy.jpg',
      'Hai Bà Trưng cưỡi voi khởi nghĩa Hát Môn',
      { title: 'Ảnh chụp mờ nhiễu nhiều hạt vỡ nét watermark lớn' }
    );
    expect(noisyResult.visualNoiseScore).toBeLessThan(20);
  });

  it('computes valid SHA-256 and pHash perceptual hashes', () => {
    const buffer = Buffer.from('RIFF....WEBPVP8 ...ChronoViet historical sample buffer...');
    const sha = computeSha256(buffer);
    const phash = computePHash(buffer);

    expect(sha).toMatch(/^[0-9a-f]{64}$/);
    expect(phash).toMatch(/^[0-9a-f]{16}$/);
  });
});
