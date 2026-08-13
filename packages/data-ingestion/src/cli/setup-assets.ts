/**
 * CLI Command: Setup & Verify Media Assets (Visual Quality Gate, License Registry Audit, Audio LUFS Normalization)
 * Usage: pnpm setup-assets or pnpm --filter @chronoviet/data-ingestion setup-assets
 */

import path from 'path';
import { promises as fs } from 'fs';
import { VisualAssetIngestor } from '../media/visual-asset-ingestor.js';
import { AudioAssetIngestor } from '../media/audio-asset-ingestor.js';
import { findMonorepoRoot } from '../utils/path-utils.js';

async function main() {
  console.log('🚀 Starting ChronoViet Media Assets Setup & Compliance Audit...');

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
  console.log('📸 Ingesting & Auditing Sample Whitelisted Visual Assets...');
  const sampleVisualResult = await visualIngestor.ingest({
    assetId: 'sample_tran_hung_dao_portrait',
    license: 'PUBLIC_DOMAIN',
    author: 'Historical Painter',
    width: 1280,
    height: 1024,
    dynasty: 'Nha Tran',
    keyFigures: ['Trần Quốc Tuấn'],
  });

  console.log(`  - Sample Visual Asset Result: ${sampleVisualResult.success ? '✅ Passed Quality Gate & License Audit' : '❌ Failed: ' + sampleVisualResult.error}`);

  // 2. Audit Sample Audio Assets
  console.log('🎵 Ingesting & Cataloging Sample Audio Assets (EBU R128 LUFS Standard)...');
  const sampleAudioResult = await audioIngestor.ingest({
    assetId: 'sfx_drum_war_bach_dang',
    category: 'sfx_drum_war',
    title: 'Tiếng Trống Trận Bạch Đằng',
    durationSeconds: 15,
  });

  console.log(`  - Sample Audio Asset Result: ${sampleAudioResult.success ? '✅ LUFS Normalized & Cataloged' : '❌ Failed: ' + sampleAudioResult.error}`);

  // 3. Trigger Remotion Engine setup_assets script if available
  const remotionSetupScript = path.resolve(rootDir, 'packages', 'remotion-engine', 'eval', 'scripts', 'setup_assets.js');
  try {
    const scriptExists = await fs.stat(remotionSetupScript).then(() => true).catch(() => false);
    if (scriptExists) {
      console.log('🎬 Executing Remotion Engine setup_assets.js...');
      // Dynamic import or execution
      require(remotionSetupScript);
    }
  } catch (err) {
    console.warn('⚠️ Remotion Engine setup script execution warning:', err);
  }

  console.log('\n======================================================');
  console.log('✅ Media Asset Setup & License Snapshot Registry Ready!');
  console.log(`📁 Raw Assets Location:        ${mediaRawDir}`);
  console.log(`📄 License Registry Snapshot: ${registryPath}`);
  console.log(`🔊 Normalized Audio Location: ${mediaAudioDir}`);
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('❌ Media Asset Setup Error:', err);
  process.exit(1);
});
