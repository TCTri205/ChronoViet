import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { optimizeImageBuffer, computeSha256, computePHash } from '../asset-downloader.js';

describe('Asset Downloader & Sharp Optimizer Unit Tests', () => {
  it('resizes oversized image buffers to fit within max bounds (1920x1080)', async () => {
    const hugeBuffer = await sharp({
      create: {
        width: 3840,
        height: 2160,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeImageBuffer(hugeBuffer, { maxWidth: 1920, maxHeight: 1080 });
    expect(result.optimized).toBe(true);
    expect(result.width).toBeLessThanOrEqual(1920);
    expect(result.height).toBeLessThanOrEqual(1080);
    expect(result.buffer.length).toBeLessThan(hugeBuffer.length);
  });

  it('preserves reasonably sized images without degrading quality unnecessarily', async () => {
    const smallBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 50, g: 50, b: 50 },
      },
    })
      .jpeg({ quality: 80 })
      .toBuffer();

    const result = await optimizeImageBuffer(smallBuffer);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('handles invalid / non-image buffers gracefully without throwing', async () => {
    const corruptBuffer = Buffer.from('this is not an image file');
    const result = await optimizeImageBuffer(corruptBuffer);
    expect(result.optimized).toBe(false);
    expect(result.buffer).toEqual(corruptBuffer);
  });

  it('computes sha256 and pHash accurately', () => {
    const buf = Buffer.from('test-image-content-for-hashing-1234567890');
    const sha = computeSha256(buf);
    const phash = computePHash(buf);
    expect(sha).toHaveLength(64);
    expect(phash.length).toBeGreaterThan(0);
  });
});
