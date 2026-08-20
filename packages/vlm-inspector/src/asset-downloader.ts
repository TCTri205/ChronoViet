/**
 * Visual Asset Downloader
 * Downloads 3+3 Candidates to Local Project Workspace with Hashing and Metadata Extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  createLogger,
  envConfig,
  initProjectWorkspace,
  VisualCandidate,
  VisualCandidateSchema,
} from '@chronoviet/shared-spec';

const log = createLogger({ service: 'vlm-inspector' });

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

  // Save to target path
  fs.writeFileSync(targetFilePath, imageBuffer);

  const sha256 = computeSha256(imageBuffer);
  const pHash = computePHash(imageBuffer);

  const updatedCandidate: VisualCandidate = {
    ...candidate,
    localPath: targetFilePath,
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
        localPath: targetFilePath,
        fileSizeBytes: imageBuffer.length,
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
    localPath: targetFilePath,
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
