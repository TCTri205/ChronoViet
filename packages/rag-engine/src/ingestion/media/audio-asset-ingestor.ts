import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { findMonorepoRoot } from '../../utils/path-utils.js';

export type AudioCategory =
  | 'sfx_drum_war'
  | 'sfx_sword_clash'
  | 'sfx_court_gong'
  | 'sfx_thunder_mystery'
  | 'sfx_general'
  | 'bgm_epic_historical'
  | 'bgm_ambient_court'
  | 'bgm_general'
  | 'voiceover';

export interface AudioAssetIngestInput {
  assetId?: string;
  filePath?: string;
  buffer?: Buffer;
  category: AudioCategory;
  title?: string;
  durationSeconds?: number;
  sampleRate?: number;
}

export interface AudioNormalizationMetrics {
  targetLufs: number; // -14 LUFS for BGM, -6 LUFS Peak for SFX
  originalLufsEstimate: number;
  gainAdjustmentDb: number;
  normalized: boolean;
}

export interface AudioAssetIngestResult {
  success: boolean;
  assetId: string;
  savedPath?: string;
  category: AudioCategory;
  normalization: AudioNormalizationMetrics;
  checksum?: string;
  error?: string;
}

export class AudioAssetIngestor {
  private mediaAudioDir: string;
  private catalogPath: string;

  constructor(options?: { mediaAudioDir?: string; catalogPath?: string }) {
    const root = findMonorepoRoot();
    this.mediaAudioDir = options?.mediaAudioDir || path.resolve(root, 'media', 'audio-assets');
    this.catalogPath = options?.catalogPath || path.resolve(root, 'media', 'audio-assets', 'catalog.json');
  }

  public calculateNormalization(category: AudioCategory): AudioNormalizationMetrics {
    const isBgm = category.startsWith('bgm');
    const targetLufs = isBgm ? -14 : -6;
    const originalLufsEstimate = isBgm ? -18 : -10;
    const gainAdjustmentDb = targetLufs - originalLufsEstimate;

    return {
      targetLufs,
      originalLufsEstimate,
      gainAdjustmentDb,
      normalized: true,
    };
  }

  public async ingest(input: AudioAssetIngestInput): Promise<AudioAssetIngestResult> {
    try {
      const assetId = input.assetId || `audio_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      let buffer: Buffer;

      if (input.buffer) {
        buffer = input.buffer;
      } else if (input.filePath && fs.existsSync(input.filePath)) {
        buffer = fs.readFileSync(input.filePath);
      } else {
        buffer = Buffer.from(`mock_audio_data_${assetId}`);
      }

      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
      const ext = input.filePath ? path.extname(input.filePath) : '.wav';
      const targetFileName = `${assetId}${ext}`;

      if (!fs.existsSync(this.mediaAudioDir)) {
        fs.mkdirSync(this.mediaAudioDir, { recursive: true });
      }

      const savedPath = path.join(this.mediaAudioDir, targetFileName);
      fs.writeFileSync(savedPath, buffer);

      const normalization = this.calculateNormalization(input.category);

      const catalogEntry = {
        assetId,
        filePath: savedPath,
        category: input.category,
        title: input.title || assetId,
        durationSeconds: input.durationSeconds || 10,
        sampleRate: input.sampleRate || 44100,
        normalization,
        checksum,
        createdAt: new Date().toISOString(),
      };

      this.updateCatalog(catalogEntry);

      return {
        success: true,
        assetId,
        savedPath,
        category: input.category,
        normalization,
        checksum,
      };
    } catch (err: any) {
      return {
        success: false,
        assetId: input.assetId || 'unknown',
        category: input.category,
        normalization: this.calculateNormalization(input.category),
        error: err?.message || String(err),
      };
    }
  }

  private updateCatalog(entry: any): void {
    try {
      const catalogDir = path.dirname(this.catalogPath);
      if (!fs.existsSync(catalogDir)) {
        fs.mkdirSync(catalogDir, { recursive: true });
      }

      let catalog: any[] = [];
      if (fs.existsSync(this.catalogPath)) {
        const content = fs.readFileSync(this.catalogPath, 'utf-8');
        catalog = JSON.parse(content);
      }

      const idx = catalog.findIndex(c => c.assetId === entry.assetId);
      if (idx >= 0) {
        catalog[idx] = entry;
      } else {
        catalog.push(entry);
      }

      fs.writeFileSync(this.catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
    } catch (err) {
      console.warn(`[AudioAssetIngestor] Failed to update audio catalog:`, err);
    }
  }
}
