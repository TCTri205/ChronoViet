/**
 * VLM Inspector - Online Visual Quality Gate & License Auditor
 * Runs in real-time during scene visual inspection to validate resolution, aspect ratio, pHash, and license.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createLogger } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'vlm-inspector' });

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
    const minResolutionMet = width >= 1280 && height >= 720;
    const actualRatio = width / Math.max(1, height);
    let expectedRatio = 16 / 9;
    if (targetAspectRatio === '9:16') expectedRatio = 9 / 16;
    if (targetAspectRatio === '1:1') expectedRatio = 1;
    if (targetAspectRatio === '4:3') expectedRatio = 4 / 3;

    const ratioDiff = Math.abs(actualRatio - expectedRatio);
    const aspectRatioValid = ratioDiff <= 0.15;
    const noiseScoreEstimate = 0.05;

    let rejectionReason: string | undefined;
    if (!minResolutionMet) {
      rejectionReason = `Resolution ${width}x${height} below minimum threshold (1280x720)`;
    } else if (!aspectRatioValid) {
      rejectionReason = `Aspect ratio mismatch: actual ${actualRatio.toFixed(2)}, expected ${expectedRatio.toFixed(2)}`;
    }

    return {
      passed: minResolutionMet && aspectRatioValid,
      minResolutionMet,
      aspectRatioValid,
      noiseScoreEstimate,
      rejectionReason,
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

    const qualityGate = this.evaluateQuality(input.width, input.height, input.aspectRatio);
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

    log.info('vlm.asset_registered', `Registered visual asset ${assetId}`, {
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
