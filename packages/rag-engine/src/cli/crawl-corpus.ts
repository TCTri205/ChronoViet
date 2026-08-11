/**
 * CLI Command: Crawl Historical Corpus & Quality Gate Sanitization
 * Usage:
 *   pnpm crawl:corpus --topics="Trần Hưng Đạo, Trận Bạch Đằng" [--output=path] [--dynasty="Nhà Trần"]
 *   pnpm crawl:corpus --urls="https://vi.wikisource.org/wiki/Đại_Việt_sử_ký_toàn_thư"
 */

import path from 'path';
import { WikiScraper } from '../ingestion/crawler/wiki-scraper.js';
import { WebScraper } from '../ingestion/crawler/web-scraper.js';
import { findMonorepoRoot } from '../utils/path-utils.js';
import { CorpusCrawlItemResult, CorpusCrawlResult } from '@chronoviet/shared-spec';

function parseArgs(): {
  topics: string[];
  urls: string[];
  outputPath: string;
  dynasty?: string;
  minWordCount: number;
} {
  const args = process.argv.slice(2);
  let topics: string[] = [];
  let urls: string[] = [];
  let outputPath = path.resolve(findMonorepoRoot(), 'data', 'raw_corpus');
  let dynasty: string | undefined = undefined;
  let minWordCount = 150;

  for (const arg of args) {
    if (arg.startsWith('--topics=')) {
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

  return { topics, urls, outputPath, dynasty, minWordCount };
}

async function main() {
  const { topics, urls, outputPath, dynasty, minWordCount } = parseArgs();
  const startTime = Date.now();

  console.log('🌐 Starting ChronoViet Historical Corpus Crawler...');
  console.log(`📁 Target Output Directory: ${outputPath}`);
  if (dynasty) console.log(`🏛️ Dynasty Tag:              ${dynasty}`);
  console.log(`📝 Min Word Count Threshold: ${minWordCount} words`);

  if (topics.length === 0 && urls.length === 0) {
    console.warn('\n⚠️ No topics or URLs provided!');
    console.log('Usage Examples:');
    console.log('  pnpm crawl:corpus --topics="Trần Hưng Đạo, Trận Bạch Đằng, Nhà Trần"');
    console.log('  pnpm crawl:corpus --urls="https://vi.wikisource.org/wiki/Đại_Việt_sử_ký_toàn_thư"');
    process.exit(0);
  }

  const wikiScraper = new WikiScraper(minWordCount);
  const webScraper = new WebScraper(minWordCount);
  const results: CorpusCrawlItemResult[] = [];

  // 1. Crawl Topics via Wikipedia API
  if (topics.length > 0) {
    console.log(`\n📚 Crawling ${topics.length} Wikipedia Topics...`);
    for (const topic of topics) {
      console.log(`  - Crawling topic: "${topic}"...`);
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
    for (const url of urls) {
      console.log(`  - Crawling URL: ${url}...`);
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
  console.log('🎉 Corpus Crawling & Quality Gate Completed!');
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
