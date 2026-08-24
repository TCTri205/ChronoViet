import path from 'path';
import { promises as fs } from 'fs';
import { QualityGateValidator } from './quality-gate.js';
import { CorpusCrawlItemResult } from '@chronoviet/shared-spec';
import { createLogger } from '@chronoviet/infra';
import { findMonorepoRoot } from '../utils/path-utils.js';

const log = createLogger({ service: 'data-ingestion' });

export interface WikiScraperOptions {
  outputPath?: string;
  minWordCount?: number;
  dynasty?: string;
  correlationId?: string;
}

export class WikiScraper {
  private qualityGate: QualityGateValidator;

  constructor(defaultMinWordCount = 150) {
    this.qualityGate = new QualityGateValidator(defaultMinWordCount);
  }

  public async fetchTopic(topic: string, options: WikiScraperOptions = {}): Promise<CorpusCrawlItemResult> {
    const targetDir = options.outputPath || path.resolve(findMonorepoRoot(), 'data', 'raw_corpus', 'wiki');
    const startTime = Date.now();
    const correlationId = options.correlationId;

    log.info('crawler.wiki_fetch_started', `Starting Wikipedia fetch for topic: ${topic}`, {
      correlationId,
      topic,
    });

    try {
      const apiUrl = `https://vi.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=true&titles=${encodeURIComponent(
        topic.trim()
      )}&format=json&redirects=1`;

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'ChronoVietBot/1.0 (https://chronoviet.internal; historical-rag-engine)',
        },
      });

      const httpDurationMs = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              pageid?: number;
              title?: string;
              extract?: string;
              fullurl?: string;
              missing?: boolean;
            }
          >;
        };
      };

      const pages = data.query?.pages;
      if (!pages) {
        throw new Error(`No data found for topic "${topic}"`);
      }

      const pageId = Object.keys(pages)[0];
      const page = pages[pageId];

      if (!page || page.missing || !page.extract) {
        log.warn('crawler.wiki_page_missing', `Wikipedia article not found: "${topic}"`, {
          correlationId,
          topic,
          durationMs: Date.now() - startTime,
        });
        return {
          title: topic,
          sourceUrl: `https://vi.wikipedia.org/wiki/${encodeURIComponent(topic)}`,
          savedPath: '',
          wordCount: 0,
          status: 'FAILED',
          error: `Page "${topic}" not found on Vietnamese Wikipedia`,
        };
      }

      const pageTitle = page.title || topic;
      const pageUrl = page.fullurl || `https://vi.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
      const rawExtract = page.extract;

      const sanitized = this.qualityGate.sanitize({
        title: pageTitle,
        sourceUrl: pageUrl,
        rawText: rawExtract,
        dynasty: options.dynasty,
        sourceReliability: 'LEVEL_2',
        minWordCount: options.minWordCount,
      });

      if (!sanitized.isValid) {
        log.warn('crawler.wiki_quality_rejected', `Quality gate rejected article: "${pageTitle}"`, {
          correlationId,
          title: pageTitle,
          reason: sanitized.rejectReason,
          wordCount: sanitized.wordCount,
        });
        return {
          title: pageTitle,
          sourceUrl: pageUrl,
          savedPath: '',
          wordCount: sanitized.wordCount,
          status: 'SKIPPED',
          error: sanitized.rejectReason,
        };
      }

      await fs.mkdir(targetDir, { recursive: true });
      const filename = `${sanitized.slug}.md`;
      const filePath = path.join(targetDir, filename);

      await fs.writeFile(filePath, sanitized.markdownContent, 'utf-8');

      const totalDurationMs = Date.now() - startTime;
      log.info('crawler.wiki_fetch_success', `Successfully saved Wikipedia article "${pageTitle}"`, {
        correlationId,
        title: pageTitle,
        savedPath: filePath,
        wordCount: sanitized.wordCount,
        durationMs: totalDurationMs,
      });

      return {
        title: sanitized.title,
        sourceUrl: sanitized.sourceUrl,
        savedPath: filePath,
        wordCount: sanitized.wordCount,
        status: 'SUCCESS',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error('crawler.wiki_fetch_failed', `Failed fetching Wikipedia topic "${topic}"`, {
        correlationId,
        topic,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      });
      return {
        title: topic,
        sourceUrl: `https://vi.wikipedia.org/wiki/${encodeURIComponent(topic)}`,
        savedPath: '',
        wordCount: 0,
        status: 'FAILED',
        error: errorMsg,
      };
    }
  }
}
