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

const log = createLogger({ service: 'agent-orchestrator' });

const PROVIDER_FACTORIES: Record<string, () => ImageSearchProvider> = {
  serpapi: () => new SerpApiImageSearchProvider(),
  tavily: () => new TavilyImageSearchProvider(),
  brave: () => new BraveImageSearchProvider(),
  wikimedia: () => new WikimediaSearchProvider(),
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
 * Accepts structured parameters (sceneId, primaryQuery, englishQuery, visualType, historicalPeriod, aspectRatio, minResolution, limit)
 * Performs bilingual multi-query search to maximize discovery of accurate historical assets.
 */
export async function executeImageSearchTool(
  input: ImageSearchToolInput
): Promise<ImageSearchToolResult> {
  const validated = ImageSearchToolInputSchema.parse(input);
  const { sceneId, primaryQuery, englishQuery, visualType, historicalPeriod, aspectRatio, minResolution, limit = 3 } = validated;

  const providers = buildProviderChain();
  const candidates: VisualCandidate[] = [];
  const provenance: Array<{ provider: string; count: number; latencyMs: number }> = [];

  // Build query sequence: prioritize englishQuery for online museum/wiki repositories, fallback to primaryQuery
  const queriesToTry = Array.from(
    new Set([englishQuery?.trim(), primaryQuery.trim()].filter((q): q is string => Boolean(q && q.length > 0)))
  );

  let globalIndex = 0;
  for (const query of queriesToTry) {
    if (candidates.length >= limit) break;
    const needed = limit - candidates.length;
    const chainResults = await searchWithProviderChain(providers, query, needed, {
      aspectRatio,
      minResolution,
    });

    for (const result of chainResults) {
      for (const cand of result.candidates) {
        if (candidates.some((existing) => existing.imageUrl === cand.imageUrl)) continue;

        globalIndex += 1;
        candidates.push({
          ...cand,
          candidateId: `cand_${sceneId}_${String(globalIndex).padStart(2, '0')}`,
        });
        if (candidates.length >= limit) break;
      }
      provenance.push({
        provider: result.provider,
        count: result.candidates.length,
        latencyMs: result.latencyMs,
      });
      if (candidates.length >= limit) break;
    }
  }

  log.debug('research.agent_tool_search_completed', `Agent Tool Search completed for ${sceneId}`, {
    sceneId,
    primaryQuery,
    englishQuery,
    visualType,
    historicalPeriod,
    candidateCount: candidates.length,
    provenance,
  });

  return {
    sceneId,
    primaryQuery,
    englishQuery,
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
  limit: number = 3
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
