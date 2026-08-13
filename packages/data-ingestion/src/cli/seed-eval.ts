/**
 * CLI Command: Seed Golden Datasets into Dual-Branch Store for Evaluation Suite
 * Usage: pnpm eval:seed or pnpm --filter @chronoviet/data-ingestion eval:seed
 */

import path from 'path';
import { promises as fs } from 'fs';
import { seedDualBranch } from '../seeder/dual-branch-seeder.js';
import { findMonorepoRoot } from '../utils/path-utils.js';

const GOLDEN_DATASETS = [
  'biography_tran_hung_dao.json',
  'battle_bach_dang_938.json',
  'dynasty_nha_ly.json',
  'mystery_le_chi_vien.json',
  'artifact_trong_dong_ngoc_lu.json',
];

async function resolveTestCasesDir(): Promise<string> {
  const root = findMonorepoRoot();
  return path.resolve(root, 'eval', 'test-cases');
}

async function main() {
  console.log('🚀 Seeding Golden Ground-Truth Datasets for Evaluation...');

  const testCasesDir = await resolveTestCasesDir();
  console.log(`📁 Resolved Test Cases Directory: ${testCasesDir}`);

  let processedCount = 0;
  let totalChunks = 0;
  let totalEntities = 0;
  let totalTriples = 0;

  for (const filename of GOLDEN_DATASETS) {
    const filePath = path.join(testCasesDir, filename);

    try {
      const exists = await fs.stat(filePath).then(() => true).catch(() => false);
      if (!exists) {
        console.warn(`⚠️ Dataset file missing at ${filePath}. Skipping...`);
        continue;
      }

      const rawJson = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(rawJson);

      const content = data.content || data.full_text || data.text || '';
      const title = data.title || path.basename(filename, '.json');
      const dynasty = data.dynasty;
      const keyFigures = data.key_figures || [];
      const location = data.location;

      const seedResult = await seedDualBranch(content, {
        title,
        sourceName: filename,
        dynasty,
        keyFigures,
        location,
        sourceReliability: 'LEVEL_1',
      });

      processedCount++;
      totalChunks += seedResult.chunksIngested;
      totalEntities += seedResult.entitiesExtracted;
      totalTriples += seedResult.triplesExtracted;

      console.log(`  ✅ Ingested [${data.topic_category || 'DATASET'}] ${title}: ${seedResult.chunksIngested} chunks, ${seedResult.entitiesExtracted} entities, ${seedResult.triplesExtracted} triples.`);
    } catch (err) {
      console.error(`❌ Error seeding ${filename}:`, err);
    }
  }

  console.log('\n======================================================');
  console.log('🎉 Golden Datasets Seeding Completed!');
  console.log(`📄 Golden Files Ingested: ${processedCount}/${GOLDEN_DATASETS.length}`);
  console.log(`🧩 Total Chunks:          ${totalChunks}`);
  console.log(`🏷️ Total Entities:        ${totalEntities}`);
  console.log(`🔗 Total Triples:         ${totalTriples}`);
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('❌ Golden Datasets Seeding Error:', err);
  process.exit(1);
});
