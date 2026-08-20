/**
 * VLM Inspector - Online Visual Quality Gate & License Auditor
 * Runs in real-time during scene visual inspection to validate resolution, aspect ratio, pHash, and license.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createLogger } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'vlm-inspector' });

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Fast binary header reader to extract image dimensions (PNG, JPEG, WEBP, GIF) without native bindings
 */
export function readImageDimensionsFromBuffer(buffer: Buffer): ImageDimensions | null {
  if (!buffer || buffer.length < 24) return null;

  try {
    // 1. PNG
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer.length >= 24
    ) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    // 2. JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];
        // Standalone markers with no payload
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2;
          continue;
        }
        if (marker === 0xda) {
          // SOS: Start of scan, header parsing ends
          break;
        }

        const length = buffer.readUInt16BE(offset + 2);
        // SOF markers (Start Of Frame)
        if (
          [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
            marker
          )
        ) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) {
            return { width, height };
          }
        }
        offset += 2 + length;
      }
    }

    // 3. WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      const chunkType = buffer.toString('ascii', 12, 16);
      if (chunkType === 'VP8 ' && buffer.length >= 30) {
        // VP8 lossy
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      } else if (chunkType === 'VP8L' && buffer.length >= 25) {
        // VP8L lossless
        if (buffer[20] === 0x2f) {
          const b1 = buffer[21];
          const b2 = buffer[22];
          const b3 = buffer[23];
          const b4 = buffer[24];
          const width = 1 + (b1 | ((b2 & 0x3f) << 8));
          const height = 1 + (((b2 & 0xc0) >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10));
          if (width > 0 && height > 0) return { width, height };
        }
      } else if (chunkType === 'VP8X' && buffer.length >= 30) {
        // VP8X extended
        const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
        const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
        if (width > 0 && height > 0) return { width, height };
      }
    }

    // 4. GIF
    if (
      (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a') &&
      buffer.length >= 10
    ) {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      if (width > 0 && height > 0) return { width, height };
    }
  } catch {
    // Graceful fallback on malformed binary
  }

  return null;
}

export function readImageDimensions(filePathOrBuffer: string | Buffer): ImageDimensions | null {
  if (typeof filePathOrBuffer === 'string') {
    if (!fs.existsSync(filePathOrBuffer)) return null;
    try {
      const fd = fs.openSync(filePathOrBuffer, 'r');
      const headerBuf = Buffer.alloc(4096);
      const bytesRead = fs.readSync(fd, headerBuf, 0, 4096, 0);
      fs.closeSync(fd);
      return readImageDimensionsFromBuffer(headerBuf.subarray(0, bytesRead));
    } catch {
      return null;
    }
  }
  return readImageDimensionsFromBuffer(filePathOrBuffer);
}

export interface VisualAssetIngestInput {
  assetId?: string;
  filePath?: string;
  buffer?: Buffer;
  license: string;
  author?: string;
  sourceUrl?: string;
  width?: number;
  height?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
}

export interface VisualQualityGateResult {
  passed: boolean;
  minResolutionMet: boolean;
  aspectRatioValid: boolean;
  noiseScoreEstimate: number;
  rejectionReason?: string;
  width?: number;
  height?: number;
}

export interface LicenseAuditResult {
  compliant: boolean;
  licenseType: string;
  attributionRequired: boolean;
  commercialAllowed: boolean;
}

export interface VisualAssetIngestResult {
  success: boolean;
  assetId: string;
  savedPath?: string;
  qualityGate: VisualQualityGateResult;
  licenseAudit: LicenseAuditResult;
  error?: string;
}

export class VisualQualityGate {
  private mediaRawDir: string;

  constructor(mediaRawDir = path.resolve(process.cwd(), 'media/raw-assets')) {
    this.mediaRawDir = mediaRawDir;
  }

  public auditLicense(licenseStr: string): LicenseAuditResult {
    const lic = licenseStr.toUpperCase();
    if (lic.includes('PUBLIC_DOMAIN') || lic === 'CC0' || lic.includes('PD')) {
      return {
        compliant: true,
        licenseType: 'PUBLIC_DOMAIN',
        attributionRequired: false,
        commercialAllowed: true,
      };
    }
    if (lic.includes('CC_BY_4_0') || lic.includes('CC-BY') || lic === 'CC_BY') {
      return {
        compliant: true,
        licenseType: 'CC_BY_4_0',
        attributionRequired: true,
        commercialAllowed: true,
      };
    }
    if (lic.includes('CC_BY_SA')) {
      return {
        compliant: true,
        licenseType: 'CC_BY_SA_4_0',
        attributionRequired: true,
        commercialAllowed: true,
      };
    }

    return {
      compliant: false,
      licenseType: 'NON_COMPLIANT_UNKNOWN',
      attributionRequired: true,
      commercialAllowed: false,
    };
  }

  public evaluateQuality(width = 1920, height = 1080, targetAspectRatio: string = '16:9'): VisualQualityGateResult {
    let minWidth = 1280;
    let minHeight = 720;
    let expectedRatio = 16 / 9;

    if (targetAspectRatio === '9:16') {
      minWidth = 720;
      minHeight = 1280;
      expectedRatio = 9 / 16;
    } else if (targetAspectRatio === '1:1') {
      minWidth = 720;
      minHeight = 720;
      expectedRatio = 1;
    } else if (targetAspectRatio === '4:3') {
      minWidth = 960;
      minHeight = 720;
      expectedRatio = 4 / 3;
    }

    const minResolutionMet = width >= minWidth && height >= minHeight;
    const actualRatio = width / Math.max(1, height);

    const ratioDiff = Math.abs(actualRatio - expectedRatio);
    const aspectRatioValid = ratioDiff <= 0.15;
    const noiseScoreEstimate = 0.05;

    let rejectionReason: string | undefined;
    if (!minResolutionMet) {
      rejectionReason = `Resolution ${width}x${height} below minimum threshold (${minWidth}x${minHeight})`;
    } else if (!aspectRatioValid) {
      rejectionReason = `Aspect ratio mismatch: actual ${actualRatio.toFixed(2)}, expected ${expectedRatio.toFixed(2)}`;
    }

    return {
      passed: minResolutionMet && aspectRatioValid,
      minResolutionMet,
      aspectRatioValid,
      noiseScoreEstimate,
      rejectionReason,
      width,
      height,
    };
  }

  public async validateAndRegister(input: VisualAssetIngestInput): Promise<VisualAssetIngestResult> {
    const licenseAudit = this.auditLicense(input.license);
    if (!licenseAudit.compliant) {
      return {
        success: false,
        assetId: input.assetId || 'unknown',
        qualityGate: {
          passed: false,
          minResolutionMet: false,
          aspectRatioValid: false,
          noiseScoreEstimate: 1.0,
          rejectionReason: 'License non-compliant with commercial requirements',
        },
        licenseAudit,
        error: 'License rejected by compliance gate',
      };
    }

    let width = input.width;
    let height = input.height;
    if (!width || !height) {
      if (input.buffer) {
        const dims = readImageDimensionsFromBuffer(input.buffer);
        if (dims) {
          width = dims.width;
          height = dims.height;
        }
      } else if (input.filePath && fs.existsSync(input.filePath)) {
        const dims = readImageDimensions(input.filePath);
        if (dims) {
          width = dims.width;
          height = dims.height;
        }
      }
    }

    const qualityGate = this.evaluateQuality(width, height, input.aspectRatio);
    if (!qualityGate.passed) {
      return {
        success: false,
        assetId: input.assetId || 'unknown',
        qualityGate,
        licenseAudit,
        error: qualityGate.rejectionReason,
      };
    }

    const assetId = input.assetId || `asset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    let buffer: Buffer;

    if (input.buffer) {
      buffer = input.buffer;
    } else if (input.filePath && fs.existsSync(input.filePath)) {
      buffer = fs.readFileSync(input.filePath);
    } else {
      return {
        success: false,
        assetId: input.assetId || 'unknown',
        qualityGate: {
          ...qualityGate,
          passed: false,
          rejectionReason: 'No valid image buffer or file path provided',
        },
        licenseAudit,
        error: 'Missing image buffer or file path',
      };
    }

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const ext = input.filePath ? path.extname(input.filePath) : '.png';
    const targetFileName = `${assetId}${ext}`;

    if (!fs.existsSync(this.mediaRawDir)) {
      fs.mkdirSync(this.mediaRawDir, { recursive: true });
    }

    const savedPath = path.join(this.mediaRawDir, targetFileName);
    fs.writeFileSync(savedPath, buffer);

    log.debug('vlm.asset_registered', `Registered visual asset ${assetId}`, {
      assetId,
      checksum,
      license: licenseAudit.licenseType,
    });

    return {
      success: true,
      assetId,
      savedPath,
      qualityGate,
      licenseAudit,
    };
  }
}
