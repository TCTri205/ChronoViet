import { describe, it, expect } from 'vitest';
import {
  VisualQualityGate,
  readImageDimensionsFromBuffer,
} from '../visual-quality-gate.js';

describe('VisualQualityGate Unit Tests', () => {
  const gate = new VisualQualityGate('/tmp/test-vlm-assets');

  describe('License Audit', () => {
    it('audits public domain and CC-BY licenses correctly', () => {
      const pd = gate.auditLicense('CC0');
      expect(pd.compliant).toBe(true);
      expect(pd.licenseType).toBe('PUBLIC_DOMAIN');

      const ccBy = gate.auditLicense('CC_BY_4_0');
      expect(ccBy.compliant).toBe(true);
      expect(ccBy.attributionRequired).toBe(true);

      const nonCompliant = gate.auditLicense('ALL_RIGHTS_RESERVED');
      expect(nonCompliant.compliant).toBe(false);
    });
  });

  describe('Technical Quality & Dimension Checks', () => {
    it('accepts images of any aspect ratio (portrait, vertical, square, wide) and enforces sanity threshold', () => {
      const valid1080p = gate.evaluateQuality(1920, 1080, '16:9');
      expect(valid1080p.passed).toBe(true);
      expect(valid1080p.width).toBe(1920);
      expect(valid1080p.height).toBe(1080);

      const validPortrait = gate.evaluateQuality(800, 1200, '16:9');
      expect(validPortrait.passed).toBe(true);
      expect(validPortrait.aspectRatioValid).toBe(true);

      const validSquare = gate.evaluateQuality(800, 800, '16:9');
      expect(validSquare.passed).toBe(true);
      expect(validSquare.aspectRatioValid).toBe(true);

      const validWidePanorama = gate.evaluateQuality(2560, 1080, '16:9');
      expect(validWidePanorama.passed).toBe(true);

      const tinyCorruptedIcon = gate.evaluateQuality(120, 80, '16:9');
      expect(tinyCorruptedIcon.passed).toBe(false);
      expect(tinyCorruptedIcon.minResolutionMet).toBe(false);
    });

    it('rejects asset with non-compliant license in validateAndRegister', async () => {
      const result = await gate.validateAndRegister({
        license: 'COPYRIGHT_STRICT',
        width: 1920,
        height: 1080,
      });
      expect(result.success).toBe(false);
      expect(result.licenseAudit.compliant).toBe(false);
    });

    it('rejects asset with missing buffer and file in validateAndRegister', async () => {
      const result = await gate.validateAndRegister({
        license: 'CC_BY_4_0',
        width: 1920,
        height: 1080,
        aspectRatio: '16:9',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing image buffer or file path');
    });

    it('accepts compliant asset with buffer and writes binary image buffer', async () => {
      const sampleBuffer = Buffer.from('RIFF....WEBPVP8 ...valid_mock_image_binary_data...');
      const result = await gate.validateAndRegister({
        license: 'CC_BY_4_0',
        width: 1920,
        height: 1080,
        aspectRatio: '16:9',
        buffer: sampleBuffer,
      });
      expect(result.success).toBe(true);
      expect(result.qualityGate.passed).toBe(true);
    });
  });

  describe('Binary Image Header Dimension Extraction', () => {
    it('extracts dimensions from PNG buffer correctly', () => {
      const pngHeader = Buffer.alloc(32);
      pngHeader[0] = 0x89;
      pngHeader[1] = 0x50;
      pngHeader[2] = 0x4e;
      pngHeader[3] = 0x47;
      pngHeader[4] = 0x0d;
      pngHeader[5] = 0x0a;
      pngHeader[6] = 0x1a;
      pngHeader[7] = 0x0a;
      pngHeader.writeUInt32BE(1920, 16);
      pngHeader.writeUInt32BE(1080, 20);

      const dims = readImageDimensionsFromBuffer(pngHeader);
      expect(dims).not.toBeNull();
      expect(dims?.width).toBe(1920);
      expect(dims?.height).toBe(1080);
    });

    it('extracts dimensions from JPEG buffer correctly', () => {
      const jpegHeader = Buffer.alloc(32);
      jpegHeader[0] = 0xff;
      jpegHeader[1] = 0xd8; // SOI
      jpegHeader[2] = 0xff;
      jpegHeader[3] = 0xc0; // SOF0
      jpegHeader.writeUInt16BE(17, 4); // length
      jpegHeader[6] = 0x08; // precision
      jpegHeader.writeUInt16BE(720, 7); // height
      jpegHeader.writeUInt16BE(1280, 9); // width

      const dims = readImageDimensionsFromBuffer(jpegHeader);
      expect(dims).not.toBeNull();
      expect(dims?.width).toBe(1280);
      expect(dims?.height).toBe(720);
    });

    it('extracts dimensions from WEBP (VP8) buffer correctly', () => {
      const webpBuf = Buffer.alloc(36);
      webpBuf.write('RIFF', 0, 'ascii');
      webpBuf.writeUInt32LE(28, 4);
      webpBuf.write('WEBP', 8, 'ascii');
      webpBuf.write('VP8 ', 12, 'ascii');
      webpBuf.writeUInt32LE(16, 16);
      webpBuf.writeUInt16LE(1920, 26);
      webpBuf.writeUInt16LE(1080, 28);

      const dims = readImageDimensionsFromBuffer(webpBuf);
      expect(dims).not.toBeNull();
      expect(dims?.width).toBe(1920);
      expect(dims?.height).toBe(1080);
    });

    it('returns null for corrupt or unsupported binary buffers', () => {
      expect(readImageDimensionsFromBuffer(Buffer.alloc(10))).toBeNull();
      expect(readImageDimensionsFromBuffer(Buffer.from('not an image at all'))).toBeNull();
    });
  });

  describe('Pipeline Quality Gate Integration', () => {
    it('inspectSceneVisuals rejects non-compliant license candidates and falls back to pure code', async () => {
      const { inspectSceneVisuals } = await import('../inspector-pipeline.js');
      const scene: any = {
        sceneId: 'scene_test_gate_01',
        sceneIndex: 0,
        layoutMode: 'TITLE_CARD',
        voiceoverText: 'Trận chiến Bạch Đằng lịch sử năm 938.',
      };

      const candidates: any[] = [
        {
          candidateId: 'cand_bad_lic_1',
          imageUrl: 'https://example.com/bad1.jpg',
          title: 'Bad License Image',
          license: 'UNKNOWN',
        },
      ];

      const result = await inspectSceneVisuals('proj_gate_test', scene, candidates, {
        correlationId: 'test-corr-123',
      });

      expect(result.isPureCodeFallback).toBe(true);
      expect(result.inspectedCandidates[0].verdict).toBe('REJECT');
    });

    it('parses VLM anachronism response and extracts focalPoint properly', async () => {
      const { extractAndParseJson } = await import('../vlm-scorer.js');

      const mockVlmJson = JSON.stringify({
        historicalContextScore: 35,
        visualNoiseScore: 25,
        artisticFitScore: 28,
        focalPoint: [0.45, 0.38],
        reasons: ['Trang phục triều Trần chân thực', 'Độ phân giải sắc nét không watermark'],
      });

      const parsed = extractAndParseJson(mockVlmJson, 'LOCAL_VLM');
      expect(parsed.passed).toBe(true);
      expect(parsed.totalScore).toBe(88);
      expect(parsed.focalPoint).toEqual([0.45, 0.38]);
      expect(parsed.reasons.length).toBe(2);
    });

    it('penalizes anachronistic foreign attire or fantasy elements to fail quality threshold', async () => {
      const { extractAndParseJson } = await import('../vlm-scorer.js');

      const mockAnachronismResponse = JSON.stringify({
        historicalContextScore: 5, // Penalized for Qing queue braid in Ly dynasty
        visualNoiseScore: 20,
        artisticFitScore: 15,
        focalPoint: [0.5, 0.5],
        reasons: ['Phát hiện trang phục triều đại Mãn Thanh sai lệch với thời kỳ nhà Lý'],
      });

      const parsed = extractAndParseJson(mockAnachronismResponse, 'LOCAL_VLM');
      expect(parsed.passed).toBe(false);
      expect(parsed.totalScore).toBe(40);
      expect(parsed.historicalContextScore).toBe(5);
    });
  });
});
