/**
 * CLI Command: Crawl Historical Corpus & Quality Gate Sanitization
 * Usage:
 *   pnpm crawl:corpus --all                            # Crawl ALL 15 Epochs automatically
 *   pnpm crawl:corpus --epoch=EPOCH_05                 # Crawl specific Epoch (e.g. Epoch 5 - Nhà Trần)
 *   pnpm crawl:corpus --topics="Trần Hưng Đạo"          # Crawl specific topics
 *   pnpm crawl:corpus --urls="https://vi.wikisource.org/..."
 */

import path from 'path';
import { createLogger } from '@chronoviet/shared-spec';
import { WikiScraper } from '../crawler/wiki-scraper.js';
import { WebScraper } from '../crawler/web-scraper.js';
import {
  getAllMasterTopics,
  getTopicsByEpoch,
} from '../crawler/master-corpus-catalog.js';
import { findMonorepoRoot } from '../utils/path-utils.js';
import { CorpusCrawlItemResult, CorpusCrawlResult } from '@chronoviet/shared-spec';

const log = createLogger({ service: 'data-ingestion' });

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

  log.info('crawl.started', 'Starting ChronoViet Historical Corpus Master Crawler', {
    outputPath,
    dynasty,
    minWordCount,
  });

  let topicsToCrawl: string[] = [...inputTopics];

  if (all) {
    topicsToCrawl = getAllMasterTopics();
    log.info('crawl.loading_all_epochs', 'Loading Master Catalog for ALL 15 historical epochs', {
      totalTopics: topicsToCrawl.length,
    });
  } else if (epoch) {
    const epochEntry = getTopicsByEpoch(epoch);
    if (epochEntry) {
      topicsToCrawl = epochEntry.topics;
      log.info('crawl.loading_epoch', 'Loading catalog for epoch', {
        epochId: epochEntry.epochId,
        epochName: epochEntry.epochName,
        topicCount: epochEntry.topics.length,
      });
    } else {
      log.warn('crawl.unknown_epoch', `Unknown Epoch identifier: "${epoch}". Expected values like "EPOCH_05" or "5"`);
    }
  }

  if (topicsToCrawl.length === 0 && urls.length === 0) {
    log.warn('crawl.no_targets', 'No topics, URLs, --all, or --epoch flags provided');
    log.info('crawl.usage_hint', 'Usage: pnpm crawl:corpus --all | --epoch=EPOCH_05 | --topics="..." | --urls="..."');
    process.exit(0);
  }

  const wikiScraper = new WikiScraper(minWordCount);
  const webScraper = new WebScraper(minWordCount);
  const results: CorpusCrawlItemResult[] = [];

  // 1. Crawl Topics via Wikipedia API
  if (topicsToCrawl.length > 0) {
    log.info('crawl.topics_started', `Crawling ${topicsToCrawl.length} historical topics`);
    let count = 0;
    for (const topic of topicsToCrawl) {
      count++;
      const res = await wikiScraper.fetchTopic(topic, { outputPath, dynasty, minWordCount });
      results.push(res);

      if (res.status === 'SUCCESS') {
        log.info('crawl.item_succeeded', 'Topic crawled and saved', {
          topic,
          index: count,
          total: topicsToCrawl.length,
          wordCount: res.wordCount,
          savedPath: res.savedPath,
        });
      } else if (res.status === 'SKIPPED') {
        log.warn('crawl.item_skipped', 'Topic skipped by quality gate', {
          topic,
          index: count,
          total: topicsToCrawl.length,
          wordCount: res.wordCount,
          reason: res.error,
        });
      } else {
        log.error('crawl.item_failed', 'Topic crawl failed', {
          topic,
          index: count,
          total: topicsToCrawl.length,
          reason: res.error,
        });
      }
    }
  }

  // 2. Crawl URLs via WebScraper
  if (urls.length > 0) {
    log.info('crawl.urls_started', `Crawling ${urls.length} web URLs`);
    let count = 0;
    for (const url of urls) {
      count++;
      const res = await webScraper.fetchUrl(url, { outputPath, dynasty, minWordCount });
      results.push(res);

      if (res.status === 'SUCCESS') {
        log.info('crawl.item_succeeded', 'URL crawled and saved', {
          url,
          index: count,
          total: urls.length,
          wordCount: res.wordCount,
          savedPath: res.savedPath,
        });
      } else if (res.status === 'SKIPPED') {
        log.warn('crawl.item_skipped', 'URL skipped by quality gate', {
          url,
          index: count,
          total: urls.length,
          wordCount: res.wordCount,
          reason: res.error,
        });
      } else {
        log.error('crawl.item_failed', 'URL crawl failed', {
          url,
          index: count,
          total: urls.length,
          reason: res.error,
        });
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

  log.info('crawl.completed', 'Master Corpus Crawling & Quality Gate completed', {
    attempted: summary.totalAttempted,
    saved: summary.totalSaved,
    failedOrSkipped: summary.totalAttempted - summary.totalSaved,
    durationMs: summary.durationMs,
  });

  process.exit(0);
}

main().catch((err) => {
  log.error('crawl.fatal_error', 'Fatal Crawler Error', { error: err });
  process.exit(1);
});
