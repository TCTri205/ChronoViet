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
  executeWithKeyRotation,
  hasAvailableApiKeys,
} from '@chronoviet/shared-spec';
import { ImageSearchProvider } from './image-search-provider.js';

const log = createLogger({ service: 'vlm-inspector' });

export class TavilyImageSearchProvider implements ImageSearchProvider {
  readonly name = 'tavily';

  private explicitApiKey: string | undefined;

  constructor(apiKey?: string) {
    this.explicitApiKey = apiKey;
  }

  async search(keywords: string, limit: number): Promise<VisualCandidate[]> {
    const runSearchWithKey = async (apiKey: string): Promise<VisualCandidate[]> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const startTime = Date.now();

      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
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

        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const err = new Error(`Tavily HTTP ${res.status}: ${res.statusText}`);
          (err as any).status = res.status;
          (err as any).latencyMs = latencyMs;
          log.warn('vlm.tavily_http_error', `HTTP ${res.status} from Tavily for "${keywords}"`, {
            keywords,
            status: res.status,
            statusText: res.statusText,
            latencyMs,
          });
          throw err;
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

        log.debug('vlm.tavily_success', `Tavily returned ${candidates.length} candidates`, {
          keywords,
          candidateCount: candidates.length,
          latencyMs,
        });

        return candidates;
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        if (!err.latencyMs) {
          err.latencyMs = latencyMs;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      if (this.explicitApiKey !== undefined) {
        if (!this.explicitApiKey) {
          log.warn('vlm.tavily_no_key', 'TAVILY_API_KEY is empty; skipping Tavily provider');
          return [];
        }
        return await runSearchWithKey(this.explicitApiKey);
      }

      if (!hasAvailableApiKeys('tavily') && !envConfig.TAVILY_API_KEY) {
        log.warn('vlm.tavily_no_key', 'TAVILY_API_KEY is not configured; skipping Tavily provider');
        return [];
      }

      return await executeWithKeyRotation('tavily', (key: string) => runSearchWithKey(key));
    } catch (err: any) {
      log.warn('vlm.tavily_search_failed', `Tavily search failed for "${keywords}": ${err.message}`, {
        keywords,
        error: err.message,
        status: err.status,
        latencyMs: err.latencyMs,
      });
      return [];
    }
  }
}
