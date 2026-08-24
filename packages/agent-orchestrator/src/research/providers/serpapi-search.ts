/**
 * SerpAPI Google Images Search Provider
 * Endpoint: GET https://serpapi.com/search?engine=google_images
 * Filters results to domain-whitelisted URLs so license compliance is guaranteed.
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

export class SerpApiImageSearchProvider implements ImageSearchProvider {
  readonly name = 'serpapi';

  private explicitApiKey: string | undefined;

  constructor(apiKey?: string) {
    this.explicitApiKey = apiKey;
  }

  async search(keywords: string, limit: number, options?: ImageSearchProviderOptions): Promise<VisualCandidate[]> {
    const runSearchWithKey = async (apiKey: string): Promise<VisualCandidate[]> => {
      // Build Google Images tbs parameters: Creative Commons + Large Resolution + Aspect Ratio
      const tbsParts = ['sur:fmc'];
      if (options?.minResolution !== 'ANY') {
        tbsParts.push('isz:l');
      }
      if (options?.aspectRatio === '16:9') {
        tbsParts.push('iar:w');
      } else if (options?.aspectRatio === '9:16') {
        tbsParts.push('iar:t');
      } else if (options?.aspectRatio === '1:1') {
        tbsParts.push('iar:s');
      }

      const params = new URLSearchParams({
        engine: 'google_images',
        q: keywords,
        api_key: apiKey,
        num: String(Math.min(20, Math.max(1, limit * 3))),
        tbs: tbsParts.join(','),
        safe: 'active',
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const startTime = Date.now();

      try {
        const res = await fetch(`https://serpapi.com/search?${params.toString()}`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'ChronoViet-Research-Agent/1.0' },
        });

        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const err = new Error(`SerpAPI HTTP ${res.status}: ${res.statusText}`);
          (err as any).status = res.status;
          (err as any).latencyMs = latencyMs;
          log.warn('research.serpapi_http_error', `HTTP ${res.status} from SerpAPI for "${keywords}"`, {
            keywords,
            status: res.status,
            statusText: res.statusText,
            latencyMs,
          });
          throw err;
        }

        const data: any = await res.json();
        const results: any[] = Array.isArray(data?.images_results) ? data.images_results : [];
        const candidates: VisualCandidate[] = [];

        for (const item of results) {
          const imageUrl = item?.original;
          if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.startsWith('x-raw-image://')) {
            continue;
          }
          // License safety: only accept whitelisted hosts (Wikimedia/Flickr/museums)
          if (!isAllowedImageDomain(imageUrl)) {
            continue;
          }

          candidates.push({
            candidateId: `cand_serpapi_${candidates.length + 1}`,
            imageUrl,
            sourceUrl: item?.link || item?.source || imageUrl,
            title: item?.title || `Tư liệu lịch sử ${keywords}`,
            author: item?.source || 'Wikimedia Commons Contributor',
            license: inferLicenseFromUrl(imageUrl, item?.license_details_url),
            candidateBatch: 1,
          });

          if (candidates.length >= limit) break;
        }

        log.debug('research.serpapi_success', `SerpAPI returned ${candidates.length} candidates`, {
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
          log.warn('research.serpapi_no_key', 'SERPAPI_API_KEY is empty; skipping SerpAPI provider');
          return [];
        }
        return await runSearchWithKey(this.explicitApiKey);
      }

      if (!hasAvailableApiKeys('serpapi') && !envConfig.SERPAPI_API_KEY) {
        log.warn('research.serpapi_no_key', 'SERPAPI_API_KEY is not configured; skipping SerpAPI provider');
        return [];
      }

      return await executeWithKeyRotation('serpapi', (key: string) => runSearchWithKey(key));
    } catch (err: any) {
      log.warn('research.serpapi_search_failed', `SerpAPI search failed for "${keywords}": ${err.message}`, {
        keywords,
        error: err.message,
        status: err.status,
        latencyMs: err.latencyMs,
      });
      return [];
    }
  }
}

function inferLicenseFromUrl(imageUrl: string, licenseDetailsUrl?: string): VisualCandidate['license'] {
  const licenseUrl = licenseDetailsUrl || '';
  if (licenseUrl.includes('publicdomain') || licenseUrl.includes('public_domain') || licenseUrl.includes('/zero/1.0/')) {
    return 'PUBLIC_DOMAIN';
  }
  if (licenseUrl.includes('/by-sa/') || licenseUrl.includes('/by-sa')) {
    return 'CC_BY_SA_4_0';
  }
  if (licenseUrl.includes('/by/') || licenseUrl.includes('licenses/by')) {
    return 'CC_BY_4_0';
  }
  return inferLicenseFromDomain(imageUrl);
}
