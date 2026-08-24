/**
 * Image Search Provider Abstraction
 * Common interface for online image search engines (SerpAPI, Tavily, Brave)
 * plus Wikimedia Commons and the offline curated catalog. The provider chain
 * tries providers in priority order and falls back to the next one when a
 * provider is unavailable (missing key, rate limit, network failure).
 */

import { VisualCandidate } from '@chronoviet/shared-spec';
import { createLogger } from '@chronoviet/infra';

const log = createLogger({ service: 'agent-orchestrator' });

export interface ImageSearchProviderOptions {
  aspectRatio?: '16:9' | '9:16' | '1:1';
  minResolution?: 'HD' | 'FHD' | '4K' | 'ANY';
}

export interface ImageSearchProvider {
  readonly name: string;
  /**
   * Search for up to `limit` image candidates matching `keywords`.
   * Must return an empty array (never throw) when the provider is unavailable
   * or returns no usable results, so the chain can fall through cleanly.
   */
  search(keywords: string, limit: number, options?: ImageSearchProviderOptions): Promise<VisualCandidate[]>;
}

export interface ProviderSearchResult {
  provider: string;
  candidates: VisualCandidate[];
  latencyMs: number;
  failed: boolean;
  error?: string;
}

/**
 * Runs a list of providers in order, collecting candidates until the target
 * limit is reached or all providers are exhausted. A provider that throws is
 * skipped (its error is recorded) and the chain continues.
 */
export async function searchWithProviderChain(
  providers: ImageSearchProvider[],
  keywords: string,
  limit: number,
  options?: ImageSearchProviderOptions
): Promise<ProviderSearchResult[]> {
  const results: ProviderSearchResult[] = [];
  let collected = 0;

  for (const provider of providers) {
    if (collected >= limit) break;
    const start = Date.now();
    try {
      const candidates = await provider.search(keywords, limit - collected, options);
      results.push({
        provider: provider.name,
        candidates,
        latencyMs: Date.now() - start,
        failed: false,
      });
      collected += candidates.length;
      if (candidates.length > 0) {
        log.debug('research.search_provider_hit', `Provider ${provider.name} returned ${candidates.length} candidates`, {
          keywords,
        });
      }
    } catch (err: any) {
      log.warn('research.search_provider_failed', `Provider ${provider.name} failed: ${err.message}`, {
        keywords,
        error: err.message,
      });
      results.push({
        provider: provider.name,
        candidates: [],
        latencyMs: Date.now() - start,
        failed: true,
        error: err.message,
      });
    }
  }

  return results;
}
