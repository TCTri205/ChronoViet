/**
 * Tavily Search API Image Provider
 * Endpoint: POST https://api.tavily.com/search
 * Uses include_images to obtain a top-level `images[]` array of source-linked
 * image URLs, then filters to domain-whitelisted hosts for license compliance.
 */

import {
  createLogger,
  envConfig,
  inferLicenseFromDomain,
  isAllowedImageDomain,
  VisualCandidate,
} from '@chronoviet/shared-spec';
import { ImageSearchProvider } from './image-search-provider.js';

const log = createLogger({ service: 'vlm-inspector' });

export class TavilyImageSearchProvider implements ImageSearchProvider {
  readonly name = 'tavily';

  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || envConfig.TAVILY_API_KEY;
  }

  async search(keywords: string, limit: number): Promise<VisualCandidate[]> {
    if (!this.apiKey) {
      log.warn('vlm.tavily_no_key', 'TAVILY_API_KEY is not configured; skipping Tavily provider');
      return [];
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query: keywords,
          search_depth: 'basic',
          max_results: Math.min(10, Math.max(1, limit * 2)),
          include_images: true,
          include_answer: false,
          include_raw_content: false,
          topic: 'general',
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        log.warn('vlm.tavily_http_error', `Tavily HTTP ${res.status}: ${res.statusText}`);
        return [];
      }

      const data: any = await res.json();
      const imageUrls: string[] = Array.isArray(data?.images) ? data.images : [];
      const candidates: VisualCandidate[] = [];

      for (const imageUrl of imageUrls) {
        if (typeof imageUrl !== 'string' || !isAllowedImageDomain(imageUrl)) {
          continue;
        }
        candidates.push({
          candidateId: `cand_tavily_${candidates.length + 1}`,
          imageUrl,
          sourceUrl: imageUrl,
          title: `Tư liệu lịch sử ${keywords}`,
          author: 'Tavily Search',
          license: inferLicenseFromDomain(imageUrl),
          candidateBatch: 1,
        });
        if (candidates.length >= limit) break;
      }

      return candidates;
    } catch (err: any) {
      log.warn('vlm.tavily_search_failed', `Tavily search failed for "${keywords}": ${err.message}`);
      return [];
    }
  }
}
