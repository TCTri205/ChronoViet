/**
 * CLI Command: Crawl Historical Corpus & Quality Gate Sanitization
 * Usage:
 *   pnpm crawl:corpus --all                            # Crawl ALL 15 Epochs automatically
 *   pnpm crawl:corpus --epoch=EPOCH_05                 # Crawl specific Epoch (e.g. Epoch 5 - Nhà Trần)
 *   pnpm crawl:corpus --topics="Trần Hưng Đạo"          # Crawl specific topics
 *   pnpm crawl:corpus --urls="https://vi.wikisource.org/..."
 */

import path from 'path';
import { WikiScraper } from '../ingestion/crawler/wiki-scraper.js';
import { WebScraper } from '../ingestion/crawler/web-scraper.js';
import {
  getAllMasterTopics,
  getTopicsByEpoch,
  MASTER_HISTORICAL_CATALOG,
} from '../ingestion/crawler/master-corpus-catalog.js';
import { findMonorepoRoot } from '../utils/path-utils.js';
import { CorpusCrawlItemResult, CorpusCrawlResult } from '@chronoviet/shared-spec';

function parseArgs(): {
  topics: string[];
  urls: string[];
  outputPath: string;
  dynasty?: string;
  minWordCount: number;
  all: boolean;
  epoch?: string;
} {
  const args = process.argv.slice(2);
  let topics: string[] = [];
  let urls: string[] = [];
  let outputPath = path.resolve(findMonorepoRoot(), 'data', 'raw_corpus');
  let dynasty: string | undefined = undefined;
  let minWordCount = 150;
  let all = false;
  let epoch: string | undefined = undefined;

  for (const arg of args) {
    if (arg === '--all' || arg === '--full') {
      all = true;
    } else if (arg.startsWith('--epoch=')) {
      epoch = arg.split('=')[1];
    } else if (arg.startsWith('--topics=')) {
      const topicStr = arg.split('=')[1] || '';
      topics = topicStr.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    } else if (arg.startsWith('--urls=')) {
      const urlStr = arg.split('=')[1] || '';
      urls = urlStr.split(',').map((u) => u.trim()).filter((u) => u.length > 0);
    } else if (arg.startsWith('--output=')) {
      outputPath = path.resolve(arg.split('=')[1]);
    } else if (arg.startsWith('--dynasty=')) {
      dynasty = arg.split('=')[1];
    } else if (arg.startsWith('--min-words=')) {
      minWordCount = parseInt(arg.split('=')[1], 10) || 150;
    }
  }

  return { topics, urls, outputPath, dynasty, minWordCount, all, epoch };
}

async function main() {
  const { topics: inputTopics, urls, outputPath, dynasty, minWordCount, all, epoch } = parseArgs();
  const startTime = Date.now();

  console.log('🌐 Starting ChronoViet Historical Corpus Master Crawler...');
  console.log(`📁 Target Output Directory: ${outputPath}`);
  if (dynasty) console.log(`🏛️ Dynasty Tag:              ${dynasty}`);
  console.log(`📝 Min Word Count Threshold: ${minWordCount} words`);

  let topicsToCrawl: string[] = [...inputTopics];

  if (all) {
    console.log('\n👑 [--all FLAG DETECTED] Loading Master Catalog for ALL 15 HISTORICAL EPOCHS...');
    topicsToCrawl = getAllMasterTopics();
    console.log(`📌 Total Master Topics to Crawl: ${topicsToCrawl.length} topics across 15 Epochs`);
  } else if (epoch) {
    const epochEntry = getTopicsByEpoch(epoch);
    if (epochEntry) {
      console.log(`\n🏛️ [--epoch=${epoch} DETECTED] Loading Catalog for "${epochEntry.epochName}" (${epochEntry.epochId})...`);
      topicsToCrawl = epochEntry.topics;
    } else {
      console.warn(`⚠️ Unknown Epoch identifier: "${epoch}". Expected values like "EPOCH_05" or "5".`);
    }
  }

  if (topicsToCrawl.length === 0 && urls.length === 0) {
    console.warn('\n⚠️ No topics, URLs, --all, or --epoch flags provided!');
    console.log('Usage Examples:');
    console.log('  pnpm crawl:corpus --all                            # Automatically crawl ALL 15 Epochs');
    console.log('  pnpm crawl:corpus --epoch=EPOCH_05                 # Crawl Epoch 5 (Nhà Trần)');
    console.log('  pnpm crawl:corpus --topics="Trần Hưng Đạo, Trận Bạch Đằng"');
    console.log('  pnpm crawl:corpus --urls="https://vi.wikisource.org/wiki/Đại_Việt_sử_ký_toàn_thư"');
    process.exit(0);
  }

  const wikiScraper = new WikiScraper(minWordCount);
  const webScraper = new WebScraper(minWordCount);
  const results: CorpusCrawlItemResult[] = [];

  // 1. Crawl Topics via Wikipedia API
  if (topicsToCrawl.length > 0) {
    console.log(`\n📚 Crawling ${topicsToCrawl.length} Historical Topics...`);
    let count = 0;
    for (const topic of topicsToCrawl) {
      count++;
      console.log(`  [${count}/${topicsToCrawl.length}] Crawling: "${topic}"...`);
      const res = await wikiScraper.fetchTopic(topic, { outputPath, dynasty, minWordCount });
      results.push(res);

      if (res.status === 'SUCCESS') {
        console.log(`    ✅ Saved (${res.wordCount} words): ${res.savedPath}`);
      } else if (res.status === 'SKIPPED') {
        console.log(`    ⚠️ Skipped (${res.wordCount} words): ${res.error}`);
      } else {
        console.log(`    ❌ Failed: ${res.error}`);
      }
    }
  }

  // 2. Crawl URLs via WebScraper
  if (urls.length > 0) {
    console.log(`\n🔗 Crawling ${urls.length} Web URLs...`);
    let count = 0;
    for (const url of urls) {
      count++;
      console.log(`  [${count}/${urls.length}] Crawling URL: ${url}...`);
      const res = await webScraper.fetchUrl(url, { outputPath, dynasty, minWordCount });
      results.push(res);

      if (res.status === 'SUCCESS') {
        console.log(`    ✅ Saved (${res.wordCount} words): ${res.savedPath}`);
      } else if (res.status === 'SKIPPED') {
        console.log(`    ⚠️ Skipped: ${res.error}`);
      } else {
        console.log(`    ❌ Failed: ${res.error}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const savedCount = results.filter((r) => r.status === 'SUCCESS').length;

  const summary: CorpusCrawlResult = {
    totalAttempted: results.length,
    totalSaved: savedCount,
    items: results,
    durationMs,
  };

  console.log('\n======================================================');
  console.log('🎉 Master Corpus Crawling & Quality Gate Completed!');
  console.log(`📊 Attempted: ${summary.totalAttempted} | Saved: ${summary.totalSaved} | Failed/Skipped: ${summary.totalAttempted - summary.totalSaved}`);
  console.log(`⏱️ Duration: ${summary.durationMs} ms`);
  console.log('======================================================\n');
  console.log('💡 Next Step: Run knowledge ingestion to process raw files into Database:');
  console.log('  pnpm --filter @chronoviet/rag-engine ingest:knowledge\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Fatal Crawler Error:', err);
  process.exit(1);
});

