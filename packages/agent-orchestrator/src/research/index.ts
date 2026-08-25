/**
 * Image Search Provider Chain Resolver
 * Builds the ordered provider list from IMAGE_SEARCH_PROVIDER_CHAIN env and
 * resolves image candidates for a scene with automatic fallback.
 */

import {
  VisualCandidate,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  getImageSearchProviderChain,
  ImageSearchToolInput,
  ImageSearchToolInputSchema,
  ImageSearchToolResult,
} from '@chronoviet/infra';
import { ImageSearchProvider, searchWithProviderChain } from './providers/image-search-provider.js';
import { SerpApiImageSearchProvider } from './providers/serpapi-search.js';
import { TavilyImageSearchProvider } from './providers/tavily-search.js';
import { BraveImageSearchProvider } from './providers/brave-search.js';
import { CuratedCatalogProvider, WikimediaSearchProvider } from './providers/wikimedia-search.js';

import { GallicaSearchProvider } from './providers/gallica-search.js';

const log = createLogger({ service: 'agent-orchestrator' });

const PROVIDER_FACTORIES: Record<string, () => ImageSearchProvider> = {
  serpapi: () => new SerpApiImageSearchProvider(),
  tavily: () => new TavilyImageSearchProvider(),
  brave: () => new BraveImageSearchProvider(),
  wikimedia: () => new WikimediaSearchProvider(),
  gallica: () => new GallicaSearchProvider(),
  catalog: () => new CuratedCatalogProvider(),
};

/**
 * Build the ordered provider list from the configured chain (env).
 */
export function buildProviderChain(): ImageSearchProvider[] {
  return getImageSearchProviderChain()
    .map((name: string) => PROVIDER_FACTORIES[name]?.())
    .filter((p): p is ImageSearchProvider => Boolean(p));
}

/**
 * Execute structured Agentic Image Search Tool:
 * Accepts structured parameters (sceneId, primaryQuery, englishQuery, frenchQuery, visualType, historicalPeriod, facetQueries, aspectRatio, minResolution, limit)
 * Performs trilingual and multi-facet concurrent search with URL deduplication.
 */
export async function executeImageSearchTool(
  input: ImageSearchToolInput
): Promise<ImageSearchToolResult> {
  const validated = ImageSearchToolInputSchema.parse(input);
  const {
    sceneId,
    primaryQuery,
    englishQuery,
    frenchQuery,
    negativeQuery,
    facetQueries,
    visualType = 'GENERAL_HISTORICAL',
    historicalPeriod,
    aspectRatio,
    minResolution,
    limit = 6,
  } = validated;

  const providers = buildProviderChain();
  const candidates: VisualCandidate[] = [];
  const provenance: Array<{ provider: string; count: number; latencyMs: number }> = [];
  const seenUrls = new Set<string>();

  // Build query candidates list from primary, english, french, and facet queries
  const facetList = facetQueries
    ? Object.values(facetQueries).filter((q): q is string => Boolean(typeof q === 'string' && q.trim().length > 0))
    : [];

  const rawQueries = Array.from(
    new Set([
      englishQuery?.trim(),
      primaryQuery.trim(),
      frenchQuery?.trim(),
      ...facetList,
    ].filter((q): q is string => Boolean(q && q.length > 0)))
  );

  // Group queries to execute in bounded parallel chunks
  const chunkSize = 3;
  for (let i = 0; i < rawQueries.length; i += chunkSize) {
    if (candidates.length >= limit) break;
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 60));
    }
    const chunk = rawQueries.slice(i, i + chunkSize);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (query) => {
        const queryWithNeg = negativeQuery ? `${query} ${negativeQuery}`.trim() : query;
        return searchWithProviderChain(providers, queryWithNeg, limit, {
          aspectRatio,
          minResolution,
        });
      })
    );

    for (const res of chunkResults) {
      if (res.status === 'fulfilled') {
        for (const chainResult of res.value) {
          for (const cand of chainResult.candidates) {
            const normalizedUrl = cand.imageUrl.trim().toLowerCase();
            if (seenUrls.has(normalizedUrl)) continue;
            seenUrls.add(normalizedUrl);

            candidates.push({
              ...cand,
              candidateId: `cand_${sceneId}_${String(candidates.length + 1).padStart(2, '0')}`,
            });
            if (candidates.length >= limit) break;
          }

          provenance.push({
            provider: chainResult.provider,
            count: chainResult.candidates.length,
            latencyMs: chainResult.latencyMs,
          });

          if (candidates.length >= limit) break;
        }
      }
      if (candidates.length >= limit) break;
    }
  }

  log.debug('research.agent_tool_search_completed', `Agent Tool Search completed for ${sceneId}`, {
    sceneId,
    primaryQuery,
    englishQuery,
    frenchQuery,
    visualType,
    historicalPeriod,
    candidateCount: candidates.length,
    provenance,
  });

  return {
    sceneId,
    primaryQuery,
    englishQuery,
    frenchQuery,
    visualType,
    candidates,
    provenance,
    resolvedAt: new Date().toISOString(),
  };
}

/**
 * Resolve visual candidates for a scene by running the provider chain.
 * Supports both string keywords (backwards compatible) and structured ImageSearchToolInput.
 */
export async function resolveImageCandidates(
  keywordsOrInput: string | ImageSearchToolInput,
  sceneId: string,
  limit: number = 6
): Promise<{ candidates: VisualCandidate[]; provenance: Array<{ provider: string; count: number; latencyMs: number }> }> {
  if (typeof keywordsOrInput === 'object' && keywordsOrInput !== null) {
    const result = await executeImageSearchTool({
      ...keywordsOrInput,
      sceneId: keywordsOrInput.sceneId || sceneId,
      limit: keywordsOrInput.limit || limit,
    });
    return { candidates: result.candidates, provenance: result.provenance };
  }

  const result = await executeImageSearchTool({
    sceneId,
    primaryQuery: keywordsOrInput,
    limit,
  });
  return { candidates: result.candidates, provenance: result.provenance };
}

export * from './providers/index.js';
