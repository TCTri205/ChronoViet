/**
 * CLI Command: Setup & Verify Media Assets (Visual Quality Gate, License Registry Audit, Audio LUFS Normalization)
 * Usage: pnpm setup-assets or pnpm --filter @chronoviet/data-ingestion setup-assets
 */

import path from 'path';
import { promises as fs } from 'fs';
import { createLogger } from '@chronoviet/shared-spec';
import { VisualAssetIngestor } from '../media/visual-asset-ingestor.js';
import { AudioAssetIngestor } from '../media/audio-asset-ingestor.js';
import { findMonorepoRoot } from '../utils/path-utils.js';

const log = createLogger({ service: 'data-ingestion' });

async function main() {
  log.info('setup_assets.started', 'Starting ChronoViet Media Assets Setup & Compliance Audit');

  const rootDir = findMonorepoRoot();
  const mediaRawDir = path.resolve(rootDir, 'media', 'raw-assets');
  const registryPath = path.resolve(rootDir, 'media', 'license-snapshots', 'registry.json');
  const mediaAudioDir = path.resolve(rootDir, 'media', 'audio-assets');

  await fs.mkdir(mediaRawDir, { recursive: true });
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.mkdir(mediaAudioDir, { recursive: true });

  const visualIngestor = new VisualAssetIngestor({ mediaRawDir, registryPath });
  const audioIngestor = new AudioAssetIngestor({ mediaAudioDir });

  // 1. Audit Sample Visual Assets
  log.info('setup_assets.visual_started', 'Ingesting & auditing sample whitelisted visual assets');
  const sampleVisualResult = await visualIngestor.ingest({
    assetId: 'sample_tran_hung_dao_portrait',
    license: 'PUBLIC_DOMAIN',
    author: 'Historical Painter',
    width: 1280,
    height: 1024,
    dynasty: 'Nha Tran',
    keyFigures: ['Trần Quốc Tuấn'],
  });

  if (sampleVisualResult.success) {
    log.info('setup_assets.visual_passed', 'Sample visual asset passed quality gate & license audit');
  } else {
    log.error('setup_assets.visual_failed', 'Sample visual asset failed quality gate', {
      error: sampleVisualResult.error,
    });
  }

  // 2. Audit Sample Audio Assets
  log.info('setup_assets.audio_started', 'Ingesting & cataloging sample audio assets (EBU R128 LUFS standard)');
  const sampleAudioResult = await audioIngestor.ingest({
    assetId: 'sfx_drum_war_bach_dang',
    category: 'sfx_drum_war',
    title: 'Tiếng Trống Trận Bạch Đằng',
    durationSeconds: 15,
  });

  if (sampleAudioResult.success) {
    log.info('setup_assets.audio_passed', 'Sample audio asset LUFS normalized & cataloged');
  } else {
    log.error('setup_assets.audio_failed', 'Sample audio asset failed', {
      error: sampleAudioResult.error,
    });
  }

  // 3. Trigger Remotion Engine setup_assets script if available
  const remotionSetupScript = path.resolve(rootDir, 'packages', 'remotion-engine', 'eval', 'scripts', 'setup_assets.js');
  try {
    const scriptExists = await fs.stat(remotionSetupScript).then(() => true).catch(() => false);
    if (scriptExists) {
      log.info('setup_assets.remotion_script', 'Executing Remotion Engine setup_assets.js', {
        scriptPath: remotionSetupScript,
      });
      // Dynamic import or execution
      require(remotionSetupScript);
    }
  } catch (err) {
    log.warn('setup_assets.remotion_script_warning', 'Remotion Engine setup script execution warning', {
      error: err,
    });
  }

  log.info('setup_assets.completed', 'Media Asset Setup & License Snapshot Registry ready', {
    mediaRawDir,
    registryPath,
    mediaAudioDir,
  });
}

main().catch((err) => {
  log.error('setup_assets.fatal_error', 'Media Asset Setup Error', { error: err });
  process.exit(1);
});
