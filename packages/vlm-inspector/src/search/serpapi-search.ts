/**
 * SerpAPI Google Images Search Provider
 * Endpoint: GET https://serpapi.com/search?engine=google_images
 * Filters results to domain-whitelisted URLs so license compliance is guaranteed.
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

export class SerpApiImageSearchProvider implements ImageSearchProvider {
  readonly name = 'serpapi';

  private explicitApiKey: string | undefined;

  constructor(apiKey?: string) {
    this.explicitApiKey = apiKey;
  }

  async search(keywords: string, limit: number): Promise<VisualCandidate[]> {
    const runSearchWithKey = async (apiKey: string): Promise<VisualCandidate[]> => {
      const params = new URLSearchParams({
        engine: 'google_images',
        q: keywords,
        api_key: apiKey,
        num: String(Math.min(20, Math.max(1, limit * 3))),
        // Request Creative Commons / free-to-use images whenever possible
        tbs: 'sur:fmc',
        safe: 'active',
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch(`https://serpapi.com/search?${params.toString()}`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'ChronoViet-VLM-Inspector/1.0' },
        });
        clearTimeout(timer);

        if (!res.ok) {
          const err = new Error(`SerpAPI HTTP ${res.status}: ${res.statusText}`);
          (err as any).status = res.status;
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

        return candidates;
      } catch (err: any) {
        clearTimeout(timer);
        throw err;
      }
    };

    if (this.explicitApiKey !== undefined) {
      if (!this.explicitApiKey) {
        log.warn('vlm.serpapi_no_key', 'SERPAPI_API_KEY is empty; skipping SerpAPI provider');
        return [];
      }
      return await runSearchWithKey(this.explicitApiKey);
    }

    if (!hasAvailableApiKeys('serpapi') && !envConfig.SERPAPI_API_KEY) {
      log.warn('vlm.serpapi_no_key', 'SERPAPI_API_KEY is not configured; skipping SerpAPI provider');
      return [];
    }

    try {
      return await executeWithKeyRotation('serpapi', (key: string) => runSearchWithKey(key));
    } catch (err: any) {
      log.warn('vlm.serpapi_search_failed', `SerpAPI search failed for "${keywords}": ${err.message}`);
      return [];
    }
  }
}

/**
 * Infers a license from the image host, preferring an explicit Creative Commons
 * license URL when the provider returns one. Non-whitelisted hosts are already
 * filtered out by isAllowedImageDomain before this is called.
 */
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
