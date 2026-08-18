import { describe, it, expect } from 'vitest';
import { VisualQualityGate } from '../visual-quality-gate.js';

describe('VisualQualityGate Unit Tests', () => {
  const gate = new VisualQualityGate('/tmp/test-vlm-assets');

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

  it('enforces 720p minimum resolution and aspect ratio constraints', () => {
    const valid1080p = gate.evaluateQuality(1920, 1080, '16:9');
    expect(valid1080p.passed).toBe(true);

    const validShorts916 = gate.evaluateQuality(1080, 1920, '9:16');
    expect(validShorts916.passed).toBe(true);

    const validSquare11 = gate.evaluateQuality(1080, 1080, '1:1');
    expect(validSquare11.passed).toBe(true);

    const lowRes = gate.evaluateQuality(640, 480, '16:9');
    expect(lowRes.passed).toBe(false);
    expect(lowRes.minResolutionMet).toBe(false);

    const badRatio = gate.evaluateQuality(1920, 400, '16:9');
    expect(badRatio.passed).toBe(false);
    expect(badRatio.aspectRatioValid).toBe(false);
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
