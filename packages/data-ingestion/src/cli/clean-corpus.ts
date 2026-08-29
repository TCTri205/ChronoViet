/**
 * ChronoViet - Layer 0 Corpus Cleaning CLI
 *
 * Usage:
 *   pnpm corpus:clean
 *
 * Reads:
 *   - data/raw_corpus/wiki/ (126 Markdown files)
 *   - data/raw_corpus/pdf_extracted/ (12 Classical Chronicles Markdown files)
 *
 * Excludes:
 *   - data/raw_corpus/pdf_markdown/ (10 duplicate files)
 *   - data/raw_corpus/pdf/ (12 binary PDFs)
 *
 * Writes:
 *   - data/processed_corpus/wiki/
 *   - data/processed_corpus/chronicles/
 *
 * Mathematical Quality Gate: Cleanliness Score >= 99.5%
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preprocessCorpusDocument } from '../text/corpus-preprocessor.js';
import { createLogger } from '@chronoviet/infra';

const log = createLogger({ service: 'corpus-cleaner' });

// Project root detection
const PROJECT_ROOT = process.cwd();
const RAW_CORPUS_DIR = path.join(PROJECT_ROOT, 'data/raw_corpus');
const PROCESSED_CORPUS_DIR = path.join(PROJECT_ROOT, 'data/processed_corpus');

interface CleaningStats {
  category: string;
  totalFiles: number;
  totalWords: number;
  quarantineStubs: number;
  avgQualityScore: number;
}

async function cleanDirectory(
  sourceDir: string,
  targetDir: string,
  category: 'wiki' | 'chronicles'
): Promise<CleaningStats> {
  if (!fs.existsSync(sourceDir)) {
    log.warn('corpus.dir_missing', `Source directory not found: ${sourceDir}`);
    return { category, totalFiles: 0, totalWords: 0, quarantineStubs: 0, avgQualityScore: 100 };
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.md'));
  let totalWords = 0;
  let quarantineStubs = 0;
  let scoreSum = 0;

  for (const file of files) {
    const srcPath = path.join(sourceDir, file);
    const destPath = path.join(targetDir, file);

    const rawContent = fs.readFileSync(srcPath, 'utf-8');
    const result = preprocessCorpusDocument(rawContent, {
      filename: file,
      isWiki: category === 'wiki',
      isChronicle: category === 'chronicles',
    });

    fs.writeFileSync(destPath, result.cleanedText, 'utf-8');

    totalWords += result.wordCount;
    if (result.isQuarantineStub) {
      quarantineStubs++;
    }
    scoreSum += result.qualityScore;
  }

  const avgQualityScore = files.length > 0 ? scoreSum / files.length : 100;

  return {
    category,
    totalFiles: files.length,
    totalWords,
    quarantineStubs,
    avgQualityScore,
  };
}

async function main() {
  console.log('========================================================================');
  console.log('  CHRONOVIET LAYER 0 CORPUS SANITIZER & MATHEMATICAL QUALITY GATE');
  console.log('========================================================================\n');

  const wikiSrc = path.join(RAW_CORPUS_DIR, 'wiki');
  const wikiDest = path.join(PROCESSED_CORPUS_DIR, 'wiki');

  const chroniclesSrc = path.join(RAW_CORPUS_DIR, 'pdf_extracted');
  const chroniclesDest = path.join(PROCESSED_CORPUS_DIR, 'chronicles');

  log.info('corpus.cleaning_started', 'Sanitizing raw corpus into data/processed_corpus/...');

  const wikiStats = await cleanDirectory(wikiSrc, wikiDest, 'wiki');
  const chroniclesStats = await cleanDirectory(chroniclesSrc, chroniclesDest, 'chronicles');

  const grandTotalFiles = wikiStats.totalFiles + chroniclesStats.totalFiles;
  const grandTotalWords = wikiStats.totalWords + chroniclesStats.totalWords;
  const grandTotalStubs = wikiStats.quarantineStubs + chroniclesStats.quarantineStubs;
  const masterQualityScore = grandTotalFiles > 0
    ? (wikiStats.avgQualityScore * wikiStats.totalFiles + chroniclesStats.avgQualityScore * chroniclesStats.totalFiles) / grandTotalFiles
    : 100;

  console.log('\n--- CORPUS CLEANING RESULTS SUMMARY ---');
  console.table([
    {
      Category: 'Wikipedia Corpus',
      Files: wikiStats.totalFiles,
      Words: wikiStats.totalWords.toLocaleString(),
      Stubs: wikiStats.quarantineStubs,
      QualityScore: `${wikiStats.avgQualityScore.toFixed(2)}%`,
    },
    {
      Category: 'Classical Chronicles',
      Files: chroniclesStats.totalFiles,
      Words: chroniclesStats.totalWords.toLocaleString(),
      Stubs: chroniclesStats.quarantineStubs,
      QualityScore: `${chroniclesStats.avgQualityScore.toFixed(2)}%`,
    },
    {
      Category: 'TOTAL PROCESSED',
      Files: grandTotalFiles,
      Words: grandTotalWords.toLocaleString(),
      Stubs: grandTotalStubs,
      QualityScore: `${masterQualityScore.toFixed(2)}%`,
    }
  ]);

  console.log(`\nOutput directories:`);
  console.log(`  - Wiki:       ${wikiDest} (${wikiStats.totalFiles} files)`);
  console.log(`  - Chronicles: ${chroniclesDest} (${chroniclesStats.totalFiles} files)`);
  console.log(`  - Excluded:   pdf_markdown (duplicate) & pdf (binary)\n`);

  const passedGate = masterQualityScore >= 99.5;
  if (passedGate) {
    console.log(`✅ [QUALITY GATE PASSED] Cleanliness Score: ${masterQualityScore.toFixed(2)}% (Target: >= 99.5%)`);
    process.exit(0);
  } else {
    console.error(`❌ [QUALITY GATE FAILED] Cleanliness Score: ${masterQualityScore.toFixed(2)}% < 99.5%`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in corpus cleaner:', err);
  process.exit(1);
});
