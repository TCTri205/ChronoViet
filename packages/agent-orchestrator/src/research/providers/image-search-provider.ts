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
 * Async Semaphore to limit simultaneous network search calls across scenes.
 */
class AsyncSemaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly maxConcurrency: number) {}

  async acquire(): Promise<() => void> {
    if (this.current < this.maxConcurrency) {
      this.current++;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export const searchGlobalConcurrencyLimiter = new AsyncSemaphore(2);

export function formatQueryForProvider(providerName: string, keywords: string): string {
  if (!keywords) return '';
  // Archives (wikimedia, gallica, catalog) should only receive clean positive terms
  if (providerName === 'wikimedia' || providerName === 'gallica' || providerName === 'catalog') {
    return keywords.replace(/-\w+/g, '').replace(/\s+/g, ' ').trim();
  }
  return keywords;
}

const searchProviderCache = new Map<string, { candidates: VisualCandidate[]; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

export function clearSearchProviderCache(): void {
  searchProviderCache.clear();
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
    const targetQuery = formatQueryForProvider(provider.name, keywords);
    if (!targetQuery) continue;

    const start = Date.now();
    try {
      const cacheKey = `${provider.name}:${targetQuery.toLowerCase().trim()}:${options?.aspectRatio || ''}:${options?.minResolution || ''}`;
      const cached = searchProviderCache.get(cacheKey);
      let candidates: VisualCandidate[];

      if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        candidates = cached.candidates.slice(0, limit - collected);
      } else {
        const isExternalEngine = ['serpapi', 'tavily', 'brave'].includes(provider.name);
        const fetchLimit = Math.max(limit, 6);
        const fetched = isExternalEngine
          ? await searchGlobalConcurrencyLimiter.run(() => provider.search(targetQuery, fetchLimit, options))
          : await provider.search(targetQuery, fetchLimit, options);
        searchProviderCache.set(cacheKey, { candidates: fetched, timestamp: Date.now() });
        candidates = fetched.slice(0, limit - collected);
      }

      results.push({
        provider: provider.name,
        candidates,
        latencyMs: Date.now() - start,
        failed: false,
      });
      collected += candidates.length;
      if (candidates.length > 0) {
        log.debug('research.search_provider_hit', `Provider ${provider.name} returned ${candidates.length} candidates`, {
          keywords: targetQuery,
        });
      }
    } catch (err: any) {
      log.warn('research.search_provider_failed', `Provider ${provider.name} failed: ${err.message}`, {
        keywords: targetQuery,
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

