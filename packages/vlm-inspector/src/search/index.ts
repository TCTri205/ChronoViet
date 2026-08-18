/**
 * Image Search Provider Chain Resolver
 * Builds the ordered provider list from IMAGE_SEARCH_PROVIDER_CHAIN env and
 * resolves image candidates for a scene with automatic fallback.
 */

import { createLogger, getImageSearchProviderChain, VisualCandidate } from '@chronoviet/shared-spec';
import { ImageSearchProvider, searchWithProviderChain } from './image-search-provider.js';
import { SerpApiImageSearchProvider } from './serpapi-search.js';
import { TavilyImageSearchProvider } from './tavily-search.js';
import { BraveImageSearchProvider } from './brave-search.js';
import { CuratedCatalogProvider, WikimediaSearchProvider } from '../wikimedia-search.js';

const log = createLogger({ service: 'vlm-inspector' });

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
    .map((name) => PROVIDER_FACTORIES[name]?.())
    .filter((p): p is ImageSearchProvider => Boolean(p));
}

/**
 * Resolve visual candidates for a scene by running the provider chain.
 * Returns the merged candidate pool (with candidateId prefixed by sceneId)
 * and a provenance log of which provider produced what.
 */
export async function resolveImageCandidates(
  keywords: string,
  sceneId: string,
  limit: number = 3
): Promise<{ candidates: VisualCandidate[]; provenance: Array<{ provider: string; count: number; latencyMs: number }> }> {
  const providers = buildProviderChain();
  const chainResults = await searchWithProviderChain(providers, keywords, limit);

  const candidates: VisualCandidate[] = [];
  const provenance: Array<{ provider: string; count: number; latencyMs: number }> = [];

  let globalIndex = 0;
  for (const result of chainResults) {
    // Relabel candidates with a globally unique sequential index across the
    // whole pool so candidateId (used as download filename) never collides
    // between providers.
    const relabeled = result.candidates.map((cand) => {
      globalIndex += 1;
      return {
        ...cand,
        candidateId: `cand_${sceneId}_${String(globalIndex).padStart(2, '0')}`,
      };
    });
    candidates.push(...relabeled);
    provenance.push({
      provider: result.provider,
      count: result.candidates.length,
      latencyMs: result.latencyMs,
    });
  }

  log.debug('vlm.research_resolved', `Resolved ${candidates.length} candidates for scene ${sceneId}`, {
    sceneId,
    keywords,
    provenance,
  });

  return { candidates, provenance };
}
