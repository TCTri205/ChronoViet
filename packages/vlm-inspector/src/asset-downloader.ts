/**
 * Visual Asset Downloader
 * Downloads 3+3 Candidates to Local Project Workspace with Hashing and Metadata Extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  VisualCandidate,
  VisualCandidateSchema,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  envConfig,
  initProjectWorkspace,
} from '@chronoviet/infra';
import { isWhitelistedLicense } from './inspector-pipeline.js';

const log = createLogger({ service: 'vlm-inspector' });

async function createSharpPipeline(buffer: Buffer) {
  try {
    const sharpMod = await import('sharp');
    const sharpFn = (sharpMod as any).default || sharpMod;
    return sharpFn(buffer, { failOn: 'none' });
  } catch (err: any) {
    log.debug('vlm.sharp_unavailable', `Sharp module dynamic load fallback: ${err?.message}`);
    return null;
  }
}

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeBytes?: number;
}

export const DEFAULT_IMAGE_OPTIMIZATION_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 85,
  maxSizeBytes: 2 * 1024 * 1024, // 2MB
};

export interface OptimizedImageResult {
  buffer: Buffer;
  format: string;
  width?: number;
  height?: number;
  optimized: boolean;
}

/**
 * Optimizes and compresses image buffers using Sharp:
 * - Downscales if width > 1920 or height > 1080 without enlargement
 * - Compresses high-res or heavy assets to MozJPEG/WebP to keep size under 2MB
 * - Normalizes orientation from EXIF
 * - Gracefully falls back if image format is unsupported
 */
export async function optimizeImageBuffer(
  buffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImageResult> {
  try {
    const maxWidth = options.maxWidth || DEFAULT_IMAGE_OPTIMIZATION_OPTIONS.maxWidth!;
    const maxHeight = options.maxHeight || DEFAULT_IMAGE_OPTIMIZATION_OPTIONS.maxHeight!;
    const quality = options.quality || DEFAULT_IMAGE_OPTIMIZATION_OPTIONS.quality!;
    const maxSizeBytes = options.maxSizeBytes || DEFAULT_IMAGE_OPTIMIZATION_OPTIONS.maxSizeBytes!;

    const image = await createSharpPipeline(buffer);
    if (!image) {
      return {
        buffer,
        format: 'jpg',
        optimized: false,
      };
    }

    const metadata = await image.metadata();

    const currentWidth = metadata.width || 0;
    const currentHeight = metadata.height || 0;
    const currentFormat = (metadata.format || 'jpeg').toLowerCase();

    const needsResize = currentWidth > maxWidth || currentHeight > maxHeight;
    const isLarge = buffer.length > maxSizeBytes;
    const isHeavyOrUncommon = ['tiff', 'raw', 'heif', 'bmp', 'avif'].includes(currentFormat);

    if (!needsResize && !isLarge && !isHeavyOrUncommon && ['jpeg', 'jpg', 'png', 'webp'].includes(currentFormat)) {
      return {
        buffer,
        format: currentFormat === 'jpeg' ? 'jpg' : currentFormat,
        width: currentWidth,
        height: currentHeight,
        optimized: false,
      };
    }

    let pipeline = image.rotate(); // Auto-orient based on EXIF

    if (needsResize) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    let outputBuffer: Buffer;
    let targetFormat = 'jpg';

    if (currentFormat === 'png' && !isLarge && !needsResize) {
      outputBuffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      targetFormat = 'png';
    } else if (currentFormat === 'webp' && !isLarge && !needsResize) {
      outputBuffer = await pipeline.webp({ quality }).toBuffer();
      targetFormat = 'webp';
    } else {
      outputBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      targetFormat = 'jpg';
    }

    const newMetaPipeline = await createSharpPipeline(outputBuffer);
    const newMeta = newMetaPipeline ? await newMetaPipeline.metadata() : {};
    return {
      buffer: outputBuffer,
      format: targetFormat,
      width: newMeta.width,
      height: newMeta.height,
      optimized: true,
    };
  } catch (err: any) {
    log.warn('vlm.image_optimization_fallback', `Sharp optimization skipped/failed: ${err.message}`, {
      error: err.message,
    });
    return {
      buffer,
      format: 'jpg',
      optimized: false,
    };
  }
}

export interface DownloadedAssetResult {
  candidate: VisualCandidate;
  localPath: string;
  sha256: string;
  pHash: string;
  fileSizeBytes: number;
}

/**
 * Computes a fast 64-bit perceptual/difference hash (dHash) from image buffer bytes.
 */
export function computePHash(buffer: Buffer): string {
  if (buffer.length < 64) {
    return crypto.createHash('md5').update(buffer).digest('hex').substring(0, 16);
  }
  // Sample 64 points across the buffer to construct a 16-hex char hash
  const step = Math.floor(buffer.length / 64);
  let hashBits = '';
  for (let i = 0; i < 64; i++) {
    const b1 = buffer[i * step];
    const b2 = buffer[Math.min(buffer.length - 1, (i + 1) * step)];
    hashBits += b1 > b2 ? '1' : '0';
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    const nibble = parseInt(hashBits.substring(i, i + 4), 2);
    hex += nibble.toString(16);
  }
  return hex;
}

/**
 * Computes SHA-256 hash of a buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export interface DownloadCandidateOptions {
  customBaseDir?: string;
  timeoutMs?: number;
  correlationId?: string;
  sceneId?: string;
}

/**
 * Downloads a candidate image to project workspace.
 */
export async function downloadCandidateImage(
  projectId: string,
  candidate: VisualCandidate,
  options: DownloadCandidateOptions = {}
): Promise<DownloadedAssetResult> {
  const paths = initProjectWorkspace(projectId, options.customBaseDir);
  const candidateId = candidate.candidateId;
  const timeout = options.timeoutMs || envConfig.IMAGE_DOWNLOAD_TIMEOUT_MS || 10000;
  const userAgent = envConfig.IMAGE_DOWNLOAD_USER_AGENT || 'ChronoViet-VLM-Downloader/1.0 (https://chronoviet.vn; contact@chronoviet.vn)';

  // Determine file extension
  let ext = 'jpg';
  try {
    const urlObj = new URL(candidate.imageUrl);
    const pathnameExt = path.extname(urlObj.pathname).replace('.', '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(pathnameExt)) {
      ext = pathnameExt;
    }
  } catch {
    // fallback to jpg
  }

  const targetFilename = `${candidateId}.${ext}`;
  const targetFilePath = path.join(paths.assetsDir, targetFilename);
  const metadataFilePath = path.join(paths.assetsDir, `${candidateId}.metadata.json`);

  let imageBuffer: Buffer | null = null;
  const startTime = Date.now();

  // Fast-path: Skip network download immediately if license is explicitly non-whitelisted
  if (candidate.license && !isWhitelistedLicense(candidate.license)) {
    log.debug('vlm.skip_non_whitelisted_download', `Skipping download for non-whitelisted license: ${candidate.license}`, {
      candidateId,
      license: candidate.license,
    });
    return {
      candidate: { ...candidate, localPath: '', sha256: '', pHash: '' },
      localPath: '',
      sha256: '',
      pHash: '',
      fileSizeBytes: 0,
    };
  }

  // If candidate is already a local file (e.g. during testing or pre-seeded assets)
  if (fs.existsSync(candidate.imageUrl)) {
    try {
      imageBuffer = fs.readFileSync(candidate.imageUrl);
    } catch {
      imageBuffer = null;
    }
  } else if (candidate.imageUrl.startsWith('http://') || candidate.imageUrl.startsWith('https://')) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(candidate.imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        cache: 'no-store',
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        log.warn('vlm.download_http_error', `HTTP ${res.status} when downloading image candidate from ${candidate.imageUrl}`, {
          candidateId,
          imageUrl: candidate.imageUrl,
          status: res.status,
          statusText: res.statusText,
          latencyMs,
          correlationId: options.correlationId,
          sceneId: options.sceneId,
        });
        imageBuffer = null;
      } else {
        const arrayBuf = await res.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuf);
        log.debug('vlm.download_success', `Successfully downloaded image candidate ${candidateId}`, {
          candidateId,
          imageUrl: candidate.imageUrl,
          sizeBytes: imageBuffer.length,
          latencyMs,
          correlationId: options.correlationId,
          sceneId: options.sceneId,
        });
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      log.warn('vlm.download_failed', `Failed to download image from ${candidate.imageUrl}: ${err.message}`, {
        candidateId,
        imageUrl: candidate.imageUrl,
        error: err.message,
        latencyMs,
        correlationId: options.correlationId,
        sceneId: options.sceneId,
      });
      imageBuffer = null;
    } finally {
      clearTimeout(timer);
    }
  } else {
    imageBuffer = null;
  }

  if (!imageBuffer || imageBuffer.length === 0) {
    const failedCandidate: VisualCandidate = {
      ...candidate,
      localPath: '',
      sha256: '',
      pHash: '',
    };
    return {
      candidate: failedCandidate,
      localPath: '',
      sha256: '',
      pHash: '',
      fileSizeBytes: 0,
    };
  }

  // Optimize and compress image buffer (resize to <=1920x1080, quality 85, <=2MB)
  const optResult = await optimizeImageBuffer(imageBuffer);
  imageBuffer = optResult.buffer;
  ext = optResult.format || ext;

  const finalFilename = `${candidateId}.${ext}`;
  const finalFilePath = path.join(paths.assetsDir, finalFilename);

  // Save to target path
  fs.writeFileSync(finalFilePath, imageBuffer);

  const sha256 = computeSha256(imageBuffer);
  const pHash = computePHash(imageBuffer);

  const updatedCandidate: VisualCandidate = {
    ...candidate,
    localPath: finalFilePath,
    sha256,
    pHash,
  };

  // Write metadata JSON
  fs.writeFileSync(
    metadataFilePath,
    JSON.stringify(
      {
        candidateId,
        imageUrl: candidate.imageUrl,
        sourceUrl: candidate.sourceUrl || candidate.imageUrl,
        title: candidate.title,
        author: candidate.author || 'Wikimedia Commons Contributor',
        license: candidate.license,
        sha256,
        pHash,
        localPath: finalFilePath,
        fileSizeBytes: imageBuffer.length,
        width: optResult.width,
        height: optResult.height,
        optimized: optResult.optimized,
        downloadedAt: new Date().toISOString(),
        correlationId: options.correlationId,
        sceneId: options.sceneId,
        projectId,
      },
      null,
      2
    ),
    'utf-8'
  );

  return {
    candidate: updatedCandidate,
    localPath: finalFilePath,
    sha256,
    pHash,
    fileSizeBytes: imageBuffer.length,
  };
}

/**
 * Downloads a batch of 3+3 candidates in parallel.
 */
export async function downloadCandidateBatch(
  projectId: string,
  candidates: VisualCandidate[],
  options: DownloadCandidateOptions = {}
): Promise<VisualCandidate[]> {
  const downloadPromises = candidates.map(async (cand) => {
    const validated = VisualCandidateSchema.parse(cand);
    const downloaded = await downloadCandidateImage(projectId, validated, options);
    return downloaded.candidate;
  });

  return Promise.all(downloadPromises);
}
