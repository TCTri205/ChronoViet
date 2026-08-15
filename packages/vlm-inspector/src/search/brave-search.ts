/**
 * Brave Search API Image Provider
 * Endpoint: GET https://api.search.brave.com/res/v1/images/search
 * Uses `results[].properties.url` for the original full-resolution image and
 * filters to domain-whitelisted hosts for license compliance.
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

export class BraveImageSearchProvider implements ImageSearchProvider {
  readonly name = 'brave';

  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || envConfig.BRAVE_API_KEY;
  }

  async search(keywords: string, limit: number): Promise<VisualCandidate[]> {
    if (!this.apiKey) {
      log.warn('vlm.brave_no_key', 'BRAVE_API_KEY is not configured; skipping Brave provider');
      return [];
    }

    const params = new URLSearchParams({
      q: keywords,
      count: String(Math.min(50, Math.max(1, limit * 3))),
      safesearch: 'strict',
      country: 'VN',
      search_lang: 'vi',
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`https://api.search.brave.com/res/v1/images/search?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        log.warn('vlm.brave_http_error', `Brave HTTP ${res.status}: ${res.statusText}`);
        return [];
      }

      const data: any = await res.json();
      const results: any[] = Array.isArray(data?.results) ? data.results : [];
      const candidates: VisualCandidate[] = [];

      for (const item of results) {
        // Original full-resolution image lives in properties.url; thumbnail.src is a Brave proxy
        const imageUrl = item?.properties?.url || item?.thumbnail?.src;
        if (!imageUrl || typeof imageUrl !== 'string' || !isAllowedImageDomain(imageUrl)) {
          continue;
        }

        candidates.push({
          candidateId: `cand_brave_${candidates.length + 1}`,
          imageUrl,
          sourceUrl: item?.url || item?.meta_url?.url || imageUrl,
          title: item?.title || `Tư liệu lịch sử ${keywords}`,
          author: item?.source || item?.meta_url?.hostname || 'Brave Search',
          license: inferLicenseFromDomain(imageUrl),
          candidateBatch: 1,
        });
        if (candidates.length >= limit) break;
      }

      return candidates;
    } catch (err: any) {
      log.warn('vlm.brave_search_failed', `Brave search failed for "${keywords}": ${err.message}`);
      return [];
    }
  }
}
