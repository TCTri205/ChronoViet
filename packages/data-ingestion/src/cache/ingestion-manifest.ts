import { promises as fs } from 'fs';
import path from 'path';
import { findMonorepoRoot } from '../utils/path-utils.js';
import { createLogger, query } from '@chronoviet/infra';

const log = createLogger({ service: 'data-ingestion' });

const MANIFEST_VERSION = 1;

export interface DocumentCheckpoint {
  sourceName: string;
  title: string;
  filePath: string;
  fileMtimeMs: number;
  chunksCount: number;
  stage: 'vector' | 'graph' | 'all';
  completedAt: string;
}

export interface IngestionManifestData {
  version: number;
  completedDocuments: Record<string, DocumentCheckpoint>;
}

export class IngestionManifest {
  private manifestPath: string;
  private memoryCache: IngestionManifestData | null = null;

  constructor(customPath?: string) {
    if (customPath) {
      this.manifestPath = customPath;
    } else {
      const root = findMonorepoRoot();
      this.manifestPath = path.join(root, '.cache', 'ingestion_manifest.json');
    }
  }

  private async load(): Promise<IngestionManifestData> {
    if (this.memoryCache) return this.memoryCache;

    try {
      const data = await fs.readFile(this.manifestPath, 'utf-8');
      const parsed: IngestionManifestData = JSON.parse(data);
      if (parsed && parsed.version === MANIFEST_VERSION && parsed.completedDocuments) {
        this.memoryCache = parsed;
        return parsed;
      }
    } catch {
      // Manifest file missing or invalid
    }

    this.memoryCache = {
      version: MANIFEST_VERSION,
      completedDocuments: {},
    };
    return this.memoryCache;
  }

  private async save(): Promise<void> {
    if (!this.memoryCache) return;
    try {
      const dir = path.dirname(this.manifestPath);
      await fs.mkdir(dir, { recursive: true });
      const tmpPath = `${this.manifestPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(this.memoryCache, null, 2), 'utf-8');
      await fs.rename(tmpPath, this.manifestPath);
    } catch (err) {
      log.warn('manifest.save_failed', 'Failed to save ingestion manifest to disk', { error: err });
    }
  }

  /**
   * Checks if a document has already been fully ingested for the given stage
   */
  public async isDocumentCompleted(
    sourceName: string,
    filePath: string,
    stage: 'vector' | 'graph' | 'all' = 'all',
    verifyDb = true,
    title?: string
  ): Promise<boolean> {
    const manifest = await this.load();
    const checkpoint = manifest.completedDocuments[sourceName];
    if (!checkpoint) return false;

    // Check if stage requirement is satisfied
    if (stage === 'all' && checkpoint.stage !== 'all') {
      return false;
    }

    // Check if underlying file on disk was modified since completion
    try {
      const stat = await fs.stat(filePath);
      if (Math.floor(stat.mtimeMs) !== Math.floor(checkpoint.fileMtimeMs)) {
        return false;
      }
    } catch {
      return false;
    }

    // If database is connected, verify that chunks actually exist in DB
    if (verifyDb) {
      try {
        const checkTitle = title || checkpoint.title;
        const rows = await query<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM document_chunks 
           WHERE (metadata->>'sourceName' = $1 OR title LIKE $2) 
             AND embedding IS NOT NULL;`,
          [sourceName, `${checkTitle}%`]
        );
        const count = rows[0]?.count || 0;
        if (count === 0 || count < checkpoint.chunksCount) {
          // Chunks are missing from DB
          return false;
        }
      } catch {
        // If DB check fails due to offline DB, do not skip
        return false;
      }
    }

    return true;
  }

  /**
   * Records a document as completed in the manifest
   */
  public async recordDocumentCompleted(checkpoint: DocumentCheckpoint): Promise<void> {
    const manifest = await this.load();
    manifest.completedDocuments[checkpoint.sourceName] = checkpoint;
    await this.save();
  }

  /**
   * Clears the entire manifest file
   */
  public async clear(): Promise<void> {
    this.memoryCache = {
      version: MANIFEST_VERSION,
      completedDocuments: {},
    };
    try {
      await fs.unlink(this.manifestPath);
    } catch {
      // File may not exist
    }
  }

  /**
   * Returns count of completed documents
   */
  public async getCompletedCount(): Promise<number> {
    const manifest = await this.load();
    return Object.keys(manifest.completedDocuments).length;
  }
}

export const ingestionManifest = new IngestionManifest();
