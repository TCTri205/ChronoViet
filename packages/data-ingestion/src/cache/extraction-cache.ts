import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { findMonorepoRoot } from '../utils/path-utils.js';
import { ExtractedTriple } from '../triple-extractor.js';
import { createLogger } from '@chronoviet/infra';

const log = createLogger({ service: 'data-ingestion' });

const CACHE_VERSION = 1;

export interface CachedChunkExtraction {
  chunkHash: string;
  chunkId?: string;
  triples: ExtractedTriple[];
  provider?: string;
  model?: string;
  extractedAt: string;
  version: number;
}

export interface DetailedCacheStats {
  count: number;
  dir: string;
  totalSizeBytes: number;
  providerDistribution: Record<string, number>;
  modelDistribution: Record<string, number>;
}

export class ExtractionCache {
  private cacheDir: string;
  private initialized = false;

  constructor(customDir?: string) {
    if (customDir) {
      this.cacheDir = customDir;
    } else {
      const root = findMonorepoRoot();
      this.cacheDir = path.join(root, '.cache', 'extraction_triples');
    }
  }

  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      this.initialized = true;
    } catch (err) {
      log.warn('cache.mkdir_failed', 'Failed to create cache directory', { dir: this.cacheDir, error: err });
    }
  }

  public computeHash(textContent: string): string {
    return crypto.createHash('sha256').update(textContent.trim()).digest('hex');
  }

  private getFilePath(chunkHash: string): string {
    return path.join(this.cacheDir, `${chunkHash}.json`);
  }

  public async get(textContent: string): Promise<ExtractedTriple[] | null> {
    const hash = this.computeHash(textContent);
    const filePath = this.getFilePath(hash);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed: CachedChunkExtraction = JSON.parse(data);

      if (parsed && Array.isArray(parsed.triples) && parsed.version === CACHE_VERSION) {
        // Attach cache metadata to triples for transparent downstream logging
        const result = [...parsed.triples];
        (result as any)._meta = {
          provider: parsed.provider || 'CACHED',
          model: parsed.model || 'CACHE',
          durationMs: 0,
          cached: true,
        };
        return result;
      }
      return null;
    } catch {
      return null;
    }
  }

  public async set(
    textContent: string,
    chunkId: string,
    triples: ExtractedTriple[],
    meta?: { provider?: string; model?: string }
  ): Promise<void> {
    await this.ensureDir();
    const hash = this.computeHash(textContent);
    const filePath = this.getFilePath(hash);
    const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;

    // Filter out internal metadata property before serializing
    const sanitizedTriples: ExtractedTriple[] = triples.map((t) => ({
      sourceEntityName: t.sourceEntityName,
      relationType: t.relationType,
      targetEntityName: t.targetEntityName,
      sourceEntityId: t.sourceEntityId,
      targetEntityId: t.targetEntityId,
      confidence: t.confidence,
    }));

    const record: CachedChunkExtraction = {
      chunkHash: hash,
      chunkId,
      triples: sanitizedTriples,
      provider: meta?.provider,
      model: meta?.model,
      extractedAt: new Date().toISOString(),
      version: CACHE_VERSION,
    };

    try {
      await fs.writeFile(tmpPath, JSON.stringify(record, null, 2), 'utf-8');
      await fs.rename(tmpPath, filePath);
    } catch (err) {
      log.warn('cache.write_failed', 'Failed to write chunk extraction to cache', {
        filePath,
        chunkId,
        error: err,
      });
      // Clean up tmp file if write failed
      await fs.unlink(tmpPath).catch(() => {});
    }
  }

  public async clear(): Promise<number> {
    try {
      const exists = await fs.stat(this.cacheDir).then(() => true).catch(() => false);
      if (!exists) return 0;

      const files = await fs.readdir(this.cacheDir);
      let count = 0;
      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.tmp')) {
          await fs.unlink(path.join(this.cacheDir, file)).catch(() => {});
          count++;
        }
      }
      log.info('cache.cleared', 'Extraction cache cleared', { count, dir: this.cacheDir });
      return count;
    } catch (err) {
      log.warn('cache.clear_failed', 'Failed to clear cache directory', { error: err });
      return 0;
    }
  }

  public async getStats(): Promise<{ count: number; dir: string }> {
    try {
      const exists = await fs.stat(this.cacheDir).then(() => true).catch(() => false);
      if (!exists) return { count: 0, dir: this.cacheDir };

      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      return { count: jsonFiles.length, dir: this.cacheDir };
    } catch {
      return { count: 0, dir: this.cacheDir };
    }
  }

  public async getDetailedStats(): Promise<DetailedCacheStats> {
    const emptyStats: DetailedCacheStats = {
      count: 0,
      dir: this.cacheDir,
      totalSizeBytes: 0,
      providerDistribution: {},
      modelDistribution: {},
    };

    try {
      const exists = await fs.stat(this.cacheDir).then(() => true).catch(() => false);
      if (!exists) return emptyStats;

      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      let totalSizeBytes = 0;
      const providerDistribution: Record<string, number> = {};
      const modelDistribution: Record<string, number> = {};

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const stat = await fs.stat(filePath);
          totalSizeBytes += stat.size;

          const content = await fs.readFile(filePath, 'utf-8');
          const parsed: CachedChunkExtraction = JSON.parse(content);
          if (parsed) {
            const provider = parsed.provider || 'UNKNOWN';
            const model = parsed.model || 'UNKNOWN';
            providerDistribution[provider] = (providerDistribution[provider] || 0) + 1;
            modelDistribution[model] = (modelDistribution[model] || 0) + 1;
          }
        } catch {
          // Ignore invalid/corrupted individual cache files
        }
      }

      return {
        count: jsonFiles.length,
        dir: this.cacheDir,
        totalSizeBytes,
        providerDistribution,
        modelDistribution,
      };
    } catch {
      return emptyStats;
    }
  }
}

export const extractionCache = new ExtractionCache();
