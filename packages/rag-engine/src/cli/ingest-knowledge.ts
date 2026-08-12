/**
 * CLI Command: Ingest Historical Knowledge Corpus (Dual-Branch Parallel Seeding)
 * Usage: pnpm --filter @chronoviet/rag-engine ingest:knowledge [--input=path] [--force] [--local-llm]
 */

import path from 'path';
import { promises as fs } from 'fs';
import { DualBranchSeeder } from '../ingestion/seeder/dual-branch-seeder.js';

import { findMonorepoRoot } from '../utils/path-utils.js';

function parseArgs(): { inputPath: string; force: boolean; localLlm: boolean } {
  const args = process.argv.slice(2);
  let inputPath = path.resolve(findMonorepoRoot(), 'data', 'raw_corpus');
  let force = false;
  let localLlm = false;

  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      const val = arg.split('=')[1] || '';
      inputPath = path.isAbsolute(val) ? val : path.resolve(findMonorepoRoot(), val);
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--local-llm') {
      localLlm = true;
    }
  }

  return { inputPath, force, localLlm };
}

async function main() {
  const { inputPath, force, localLlm } = parseArgs();

  console.log('🚀 Starting ChronoViet Historical Knowledge Ingestion Pipeline...');
  console.log(`📁 Input Path: ${inputPath}`);
  console.log(`⚡ Force Overwrite: ${force}`);
  console.log(`🤖 LLM Mode: ${localLlm ? 'Local Qwen2.5-72B via Ollama' : 'Gemini 1.5 Flash Cloud API'}`);

  try {
    const exists = await fs.stat(inputPath).then(() => true).catch(() => false);
    if (!exists) {
      console.warn(`⚠️ Input directory or file does not exist at: ${inputPath}. Creating empty raw_corpus directory.`);
      await fs.mkdir(inputPath, { recursive: true });
    }

    const seeder = new DualBranchSeeder();
    const result = await seeder.run(inputPath);

    console.log('\n======================================================');
    console.log('🎉 Knowledge Ingestion Completed Successfully!');
    console.log(`📄 Documents Processed: ${result.documentsProcessed}`);
    console.log(`🧩 Chunks Created:      ${result.chunksCreated}`);
    console.log(`🏷️ Entities Extracted:   ${result.entitiesExtracted}`);
    console.log(`🔗 Triples Extracted:   ${result.relationshipsExtracted}`);
    console.log(`⏱️ Ingestion Duration:  ${result.durationMs} ms`);
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Ingestion Pipeline Error:', error);
    process.exit(1);
  }
}

main();
