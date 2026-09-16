/**
 * Wikimedia Commons Live API Search Provider
 * Queries real-time Wikimedia Commons API for historical images with full metadata,
 * attribution, and copyright license validation (Public Domain, CC0, CC-BY, CC-BY-SA).
 */

import { VisualCandidate } from '@chronoviet/shared-spec';
import { createLogger } from '@chronoviet/infra';
import { ImageSearchProvider, ImageSearchProviderOptions } from './image-search-provider.js';

const log = createLogger({ service: 'agent-orchestrator' });

export type AllowedVisualLicense = 'PUBLIC_DOMAIN' | 'CC0' | 'CC_BY_4_0' | 'CC_BY_SA_4_0' | 'UNKNOWN';

export function normalizeLicenseString(rawLicense: string): AllowedVisualLicense {
  if (!rawLicense) return 'PUBLIC_DOMAIN';
  const clean = rawLicense.toUpperCase().replace(/[\s-]+/g, '_');
  if (clean.includes('CC0') || clean.includes('ZERO')) return 'CC0';
  if (clean.includes('PUBLIC_DOMAIN') || clean.includes('PD')) return 'PUBLIC_DOMAIN';
  if (clean.includes('CC_BY_SA_4') || clean.includes('CC_BY_SA')) return 'CC_BY_SA_4_0';
  if (clean.includes('CC_BY_4') || clean.includes('CC_BY')) return 'CC_BY_4_0';
  return 'PUBLIC_DOMAIN';
}

export function stripNegativeSearchTerms(str: string): string {
  if (!str) return '';
  return str.replace(/-\w+/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Searches Wikimedia Commons API for historical images matching query
 */
export async function searchWikimediaCommons(
  keywords: string,
  limit: number = 6,
  timeoutMs: number = 8000
): Promise<VisualCandidate[]> {
  const cleanKeywords = stripNegativeSearchTerms(keywords);
  if (!cleanKeywords) return [];

  const encoded = encodeURIComponent(cleanKeywords);
  const searchLimit = Math.min(20, Math.max(limit * 2, 10));
  const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encoded}&gsrnamespace=6&gsrlimit=${searchLimit}&prop=imageinfo&iiprop=url|size|extmetadata|mime&format=json&origin=*`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ChronoViet-Bot/1.0 (historical-research@chronoviet.vn)',
        'Referer': 'https://commons.wikimedia.org/',
      },
      cache: 'no-store',
    });

    const latencyMs = Date.now() - startTime;
    if (!res.ok) {
      log.warn('research.wikimedia_search_http_error', `HTTP ${res.status} from Wikimedia API for "${cleanKeywords}"`, {
        keywords: cleanKeywords,
        status: res.status,
        statusText: res.statusText,
        latencyMs,
      });
      return [];
    }

    const data: any = await res.json();
    if (!data.query || !data.query.pages) {
      return [];
    }

    const candidates: VisualCandidate[] = [];
    const pages = Object.values(data.query.pages) as any[];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const imageInfo = page.imageinfo?.[0];
      if (!imageInfo || !imageInfo.url) continue;

      const mime = (imageInfo.mime || '').toLowerCase();
      if (
        !mime.startsWith('image/') ||
        mime.includes('svg') ||
        mime.includes('pdf') ||
        mime.includes('djvu') ||
        mime.includes('gif') ||
        mime.includes('icon')
      ) {
        continue;
      }

      const extMetadata = imageInfo.extmetadata || {};
      const artist = extMetadata.Artist?.value?.replace(/<[^>]*>/g, '') || 'Wikimedia Commons Contributor';
      const licenseShort = extMetadata.LicenseShortName?.value || 'PUBLIC_DOMAIN';
      const license = normalizeLicenseString(licenseShort);

      candidates.push({
        candidateId: `cand_wiki_${page.pageid || i + 1}`,
        imageUrl: imageInfo.url,
        sourceUrl: imageInfo.descriptionurl || imageInfo.url,
        title: page.title ? page.title.replace(/^File:/, '').replace(/\.[^/.]+$/, '') : `Tư liệu lịch sử ${cleanKeywords}`,
        author: artist.substring(0, 100),
        license,
        focalPoint: [0.5, 0.5],
        candidateBatch: 1,
      });

      if (candidates.length >= limit) break;
    }

    log.debug('research.wikimedia_success', `Wikimedia returned ${candidates.length} candidates`, {
      keywords: cleanKeywords,
      candidateCount: candidates.length,
      latencyMs,
    });

    return candidates;
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    log.warn('research.wikimedia_search_failed', `Wikimedia search failed for "${cleanKeywords}": ${err.message}`, {
      keywords: cleanKeywords,
      error: err.message,
      latencyMs,
    });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wikimedia Commons provider implementing the ImageSearchProvider interface.
 */
export class WikimediaSearchProvider implements ImageSearchProvider {
  readonly name = 'wikimedia';

  async search(keywords: string, limit: number, _options?: ImageSearchProviderOptions): Promise<VisualCandidate[]> {
    return searchWikimediaCommons(keywords, limit);
  }
}
