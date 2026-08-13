/**
 * Wikipedia & Wikisource Historical Corpus Crawler
 * Fetches articles from vi.wikipedia.org using MediaWiki REST API, cleans content via QualityGate, and saves to raw_corpus/
 */

import path from 'path';
import { promises as fs } from 'fs';
import { QualityGateValidator } from './quality-gate.js';
import { CorpusCrawlItemResult } from '@chronoviet/shared-spec';
import { findMonorepoRoot } from '../utils/path-utils.js';

export interface WikiScraperOptions {
  outputPath?: string;
  minWordCount?: number;
  dynasty?: string;
}

export class WikiScraper {
  private qualityGate: QualityGateValidator;

  constructor(defaultMinWordCount = 150) {
    this.qualityGate = new QualityGateValidator(defaultMinWordCount);
  }

  public async fetchTopic(topic: string, options: WikiScraperOptions = {}): Promise<CorpusCrawlItemResult> {
    const targetDir = options.outputPath || path.resolve(findMonorepoRoot(), 'data', 'raw_corpus', 'wiki');

    try {
      const apiUrl = `https://vi.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=true&titles=${encodeURIComponent(
        topic.trim()
      )}&format=json&redirects=1`;

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'ChronoVietBot/1.0 (https://chronoviet.internal; historical-rag-engine)',
        },
      });

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

      return {
        title: sanitized.title,
        sourceUrl: sanitized.sourceUrl,
        savedPath: filePath,
        wordCount: sanitized.wordCount,
        status: 'SUCCESS',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
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
