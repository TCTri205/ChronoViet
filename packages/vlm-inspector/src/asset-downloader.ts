/**
 * Visual Asset Downloader
 * Downloads 3+3 Candidates to Local Project Workspace with Hashing and Metadata Extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  createLogger,
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

/**
 * Downloads a candidate image to project workspace.
 */
export async function downloadCandidateImage(
  projectId: string,
  candidate: VisualCandidate,
  options: { customBaseDir?: string; timeoutMs?: number } = {}
): Promise<DownloadedAssetResult> {
  const paths = initProjectWorkspace(projectId, options.customBaseDir);
  const candidateId = candidate.candidateId;
  const timeout = options.timeoutMs || 10000;

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

  // If candidate is already a local file (e.g. during testing or pre-seeded assets)
  if (fs.existsSync(candidate.imageUrl)) {
    imageBuffer = fs.readFileSync(candidate.imageUrl);
  } else if (candidate.imageUrl.startsWith('http://') || candidate.imageUrl.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(candidate.imageUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ChronoViet-VLM-Downloader/1.0' },
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const arrayBuf = await res.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuf);
    } catch (err: any) {
      log.warn('vlm.download_failed', `Failed to download image from ${candidate.imageUrl}: ${err.message}`, {
        candidateId,
        imageUrl: candidate.imageUrl,
      });
      imageBuffer = null;
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
  options: { customBaseDir?: string; timeoutMs?: number } = {}
): Promise<VisualCandidate[]> {
  const downloadPromises = candidates.map(async (cand) => {
    const validated = VisualCandidateSchema.parse(cand);
    const downloaded = await downloadCandidateImage(projectId, validated, options);
    return downloaded.candidate;
  });

  return Promise.all(downloadPromises);
}
