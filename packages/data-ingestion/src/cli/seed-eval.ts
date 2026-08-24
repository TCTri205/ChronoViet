/**
 * CLI Command: Seed Golden Datasets into Dual-Branch Store for Evaluation Suite
 * Usage: pnpm eval:seed or pnpm --filter @chronoviet/data-ingestion eval:seed
 */

import path from 'path';
import { promises as fs } from 'fs';
import { createLogger } from '@chronoviet/infra';
import { seedDualBranch } from '../seeder/dual-branch-seeder.js';
import { findMonorepoRoot } from '../utils/path-utils.js';

const log = createLogger({ service: 'data-ingestion' });

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
  log.info('eval_seed.started', 'Seeding Golden Ground-Truth Datasets for Evaluation');

  const testCasesDir = await resolveTestCasesDir();
  log.info('eval_seed.test_cases_dir', 'Resolved test cases directory', { testCasesDir });

  let processedCount = 0;
  let totalChunks = 0;
  let totalEntities = 0;
  let totalTriples = 0;

  for (const filename of GOLDEN_DATASETS) {
    const filePath = path.join(testCasesDir, filename);

    try {
      const exists = await fs.stat(filePath).then(() => true).catch(() => false);
      if (!exists) {
        log.warn('eval_seed.dataset_missing', `Dataset file missing, skipping`, { filePath });
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

      log.info('eval_seed.dataset_ingested', `Ingested dataset`, {
        filename,
        title,
        category: data.topic_category || 'DATASET',
        chunks: seedResult.chunksIngested,
        entities: seedResult.entitiesExtracted,
        triples: seedResult.triplesExtracted,
      });
    } catch (err) {
      log.error('eval_seed.dataset_failed', `Error seeding dataset`, { filename, error: err });
    }
  }

  log.info('eval_seed.completed', 'Golden Datasets Seeding completed', {
    filesIngested: processedCount,
    totalFiles: GOLDEN_DATASETS.length,
    totalChunks,
    totalEntities,
    totalTriples,
  });
}

main().catch((err) => {
  log.error('eval_seed.fatal_error', 'Golden Datasets Seeding Error', { error: err });
  process.exit(1);
});
