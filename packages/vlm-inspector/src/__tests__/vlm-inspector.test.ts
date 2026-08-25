import { describe, it, expect } from 'vitest';
import { isWhitelistedLicense } from '../inspector-pipeline.js';
import { scoreImageWithLocalCLIP, cosineSimilarity, extractTextVector } from '../clip-scorer.js';
import { computePHash, computeSha256 } from '../asset-downloader.js';
import { extractAndParseJson } from '../vlm-scorer.js';

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

  describe('Resilient JSON Extraction & Parsing', () => {
    it('should parse direct clean JSON format', () => {
      const input = JSON.stringify({
        historicalContextScore: 35,
        visualNoiseScore: 25,
        artisticFitScore: 25,
        reasons: ['Ảnh chuẩn bối cảnh'],
      });

      const res = extractAndParseJson(input, 'LOCAL_VLM');
      expect(res.historicalContextScore).toBe(35);
      expect(res.visualNoiseScore).toBe(25);
      expect(res.artisticFitScore).toBe(25);
      expect(res.totalScore).toBe(85);
      expect(res.passed).toBe(true);
      expect(res.scorerType).toBe('LOCAL_VLM');
    });

    it('should extract JSON wrapped in markdown fences', () => {
      const input = `\`\`\`json
{
  "historicalContextScore": 38,
  "visualNoiseScore": 28,
  "artisticFitScore": 24,
  "reasons": ["Rất sắc nét"]
}
\`\`\``;

      const res = extractAndParseJson(input, 'OPENAI_VLM');
      expect(res.historicalContextScore).toBe(38);
      expect(res.totalScore).toBe(90);
      expect(res.passed).toBe(true);
      expect(res.scorerType).toBe('OPENAI_VLM');
    });

    it('should extract JSON surrounded by conversational preamble and postscript', () => {
      const input = `Dưới đây là kết quả thẩm định thị giác từ mô hình AI:
\`\`\`json
{
  "historical_context_score": 30,
  "visual_noise_score": 25,
  "artistic_fit_score": 25,
  "reason": "Phù hợp bối cảnh lịch sử thời Lý"
}
\`\`\`
Hy vọng kết quả này hữu ích cho pipeline ChronoViet!`;

      const res = extractAndParseJson(input, 'GEMINI_CLOUD');
      expect(res.historicalContextScore).toBe(30);
      expect(res.visualNoiseScore).toBe(25);
      expect(res.artisticFitScore).toBe(25);
      expect(res.totalScore).toBe(80);
      expect(res.passed).toBe(true);
      expect(res.reasons).toEqual(['Phù hợp bối cảnh lịch sử thời Lý']);
      expect(res.scorerType).toBe('GEMINI_CLOUD');
    });

    it('should handle un-fenced conversational JSON and heuristic fallback', () => {
      const input = `Thẩm định hoàn tất: {"historicalContextScore": 15, "visualNoiseScore": 10, "artisticFitScore": 10, "reasons": ["Dính watermark"]} Cần loại bỏ.`;
      const res = extractAndParseJson(input, 'LOCAL_VLM');
      expect(res.historicalContextScore).toBe(15);
      expect(res.totalScore).toBe(35);
      expect(res.passed).toBe(false);
    });

    it('should clamp scores exceeding max thresholds', () => {
      const input = JSON.stringify({
        historicalContextScore: 999,
        visualNoiseScore: 999,
        artisticFitScore: 999,
      });
      const res = extractAndParseJson(input, 'LOCAL_VLM');
      expect(res.historicalContextScore).toBe(40);
      expect(res.visualNoiseScore).toBe(30);
      expect(res.artisticFitScore).toBe(30);
      expect(res.totalScore).toBe(100);
    });

    it('should correctly parse normalized float focal points', () => {
      const input = JSON.stringify({
        historicalContextScore: 35,
        visualNoiseScore: 25,
        artisticFitScore: 25,
        focalPoint: [0.65, 0.45],
      });
      const res = extractAndParseJson(input, 'LOCAL_VLM');
      expect(res.focalPoint).toEqual([0.65, 0.45]);
    });

    it('should normalize percentage focal points (0-100) to float (0.0-1.0)', () => {
      const input = JSON.stringify({
        historicalContextScore: 35,
        visualNoiseScore: 25,
        artisticFitScore: 25,
        focalPoint: [50, 40],
      });
      const res = extractAndParseJson(input, 'LOCAL_VLM');
      expect(res.focalPoint).toEqual([0.5, 0.4]);
    });

    it('should parse snake_case focal_point and clamp out-of-bounds values', () => {
      const input = JSON.stringify({
        historicalContextScore: 30,
        visualNoiseScore: 20,
        artisticFitScore: 20,
        focal_point: [150, -10],
      });
      const res = extractAndParseJson(input, 'OPENAI_VLM');
      expect(res.focalPoint).toEqual([1.0, 0.0]);
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
