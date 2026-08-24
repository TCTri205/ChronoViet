/**
 * Brave Search API Image Provider
 * Endpoint: GET https://api.search.brave.com/res/v1/images/search
 * Uses `results[].properties.url` for the original full-resolution image and
 * filters to domain-whitelisted hosts for license compliance.
 */

import { VisualCandidate } from '@chronoviet/shared-spec';
import {
  createLogger,
  envConfig,
  inferLicenseFromDomain,
  isAllowedImageDomain,
  executeWithKeyRotation,
  hasAvailableApiKeys,
} from '@chronoviet/infra';
import { ImageSearchProvider, ImageSearchProviderOptions } from './image-search-provider.js';

const log = createLogger({ service: 'agent-orchestrator' });

const UNSUPPORTED_EXTENSIONS = ['.svg', '.gif', '.ico', '.pdf', '.djvu'];

export class BraveImageSearchProvider implements ImageSearchProvider {
  readonly name = 'brave';

  private explicitApiKey: string | undefined;

  constructor(apiKey?: string) {
    this.explicitApiKey = apiKey;
  }

  async search(keywords: string, limit: number, _options?: ImageSearchProviderOptions): Promise<VisualCandidate[]> {
    const runSearchWithKey = async (apiKey: string): Promise<VisualCandidate[]> => {
      const params = new URLSearchParams({
        q: keywords,
        count: String(Math.min(50, Math.max(1, limit * 3))),
        safesearch: 'strict',
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const startTime = Date.now();

      try {
        const res = await fetch(`https://api.search.brave.com/res/v1/images/search?${params.toString()}`, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': apiKey,
          },
        });

        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          const err = new Error(`Brave HTTP ${res.status}: ${res.statusText} ${errBody}`.trim());
          (err as any).status = res.status;
          (err as any).latencyMs = latencyMs;
          log.warn('research.brave_http_error', `HTTP ${res.status} from Brave for "${keywords}": ${errBody}`, {
            keywords,
            status: res.status,
            statusText: res.statusText,
            errBody,
            latencyMs,
          });
          throw err;
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

          const lowerUrl = imageUrl.toLowerCase().split('?')[0];
          if (UNSUPPORTED_EXTENSIONS.some((ext) => lowerUrl.endsWith(ext))) {
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

        log.debug('research.brave_success', `Brave returned ${candidates.length} candidates`, {
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
          log.warn('research.brave_no_key', 'BRAVE_API_KEY is empty; skipping Brave provider');
          return [];
        }
        return await runSearchWithKey(this.explicitApiKey);
      }

      if (!hasAvailableApiKeys('brave') && !envConfig.BRAVE_API_KEY) {
        log.warn('research.brave_no_key', 'BRAVE_API_KEY is not configured; skipping Brave provider');
        return [];
      }

      return await executeWithKeyRotation('brave', (key: string) => runSearchWithKey(key));
    } catch (err: any) {
      log.warn('research.brave_search_failed', `Brave search failed for "${keywords}": ${err.message}`, {
        keywords,
        error: err.message,
        status: err.status,
        latencyMs: err.latencyMs,
      });
      return [];
    }
  }
}
