/**
 * General Web Page Crawler & Scraper
 * Fetches HTML from target URLs, extracts title and main content, sanitizes via QualityGate, and saves to raw_corpus/
 */

import path from 'path';
import { promises as fs } from 'fs';
import { QualityGateValidator } from './quality-gate.js';
import { CorpusCrawlItemResult } from '@chronoviet/shared-spec';
import { findMonorepoRoot } from '../utils/path-utils.js';
import * as cheerio from 'cheerio';

export interface WebScraperOptions {
  outputPath?: string;
  minWordCount?: number;
  dynasty?: string;
}

export class WebScraper {
  private qualityGate: QualityGateValidator;

  constructor(defaultMinWordCount = 150) {
    this.qualityGate = new QualityGateValidator(defaultMinWordCount);
  }

  public async fetchUrl(targetUrl: string, options: WebScraperOptions = {}): Promise<CorpusCrawlItemResult> {
    const targetDir = options.outputPath || path.resolve(findMonorepoRoot(), 'data', 'raw_corpus', 'web');

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'ChronoVietBot/1.0 (https://chronoviet.internal; historical-rag-engine)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Clean noise elements
      $('script, style, nav, footer, header, iframe, noscript, svg, .ad, .advertisement, .sidebar').remove();

      // Extract title
      let pageTitle = $('title').text().trim() || $('h1').first().text().trim() || 'Crawled Document';
      pageTitle = pageTitle.replace(/\s+/g, ' ').replace(/ - [^-]+$/, '').trim();

      // Extract main body content by semantic containers
      const articleEl = $('article');
      const mainEl = $('main');
      const contentEl = $('#content, .content, #main-content');

      let rawText = '';
      if (articleEl.length > 0) {
        rawText = articleEl.text();
      } else if (mainEl.length > 0) {
        rawText = mainEl.text();
      } else if (contentEl.length > 0) {
        rawText = contentEl.text();
      } else {
        rawText = $('body').text();
      }

      const sanitized = this.qualityGate.sanitize({
        title: pageTitle,
        sourceUrl: targetUrl,
        rawText,
        dynasty: options.dynasty,
        sourceReliability: 'LEVEL_2',
        minWordCount: options.minWordCount,
      });

      if (!sanitized.isValid) {
        return {
          title: pageTitle,
          sourceUrl: targetUrl,
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
        sourceUrl: targetUrl,
        savedPath: filePath,
        wordCount: sanitized.wordCount,
        status: 'SUCCESS',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        title: targetUrl,
        sourceUrl: targetUrl,
        savedPath: '',
        wordCount: 0,
        status: 'FAILED',
        error: errorMsg,
      };
    }
  }
}
