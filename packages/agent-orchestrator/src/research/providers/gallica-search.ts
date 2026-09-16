/**
 * Gallica BnF (Bibliothèque nationale de France) Image Search Provider
 * Searches high-resolution public domain archival imagery, colonial documents, and maps.
 */

import { VisualCandidate } from '@chronoviet/shared-spec';
import { createLogger, ProviderRateLimiter } from '@chronoviet/infra';
import { ImageSearchProvider, ImageSearchProviderOptions } from './image-search-provider.js';

const log = createLogger({ service: 'agent-orchestrator' });

export function sanitizeGallicaQuery(keywords: string): string {
  if (!keywords) return '';
  // Remove negative modifiers like -anime, -cartoon
  let clean = keywords.replace(/-\w+/g, '');
  // Remove punctuation and special characters that break SRU query parsing
  clean = clean.replace(/["'`:;!?(){}\[\]\/\\]/g, ' ');
  // Normalize whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  // Keep first 6 substantive words to avoid overly restrictive queries
  const words = clean.split(' ').filter((w) => w.length > 1);
  return words.slice(0, 6).join(' ');
}

export class GallicaSearchProvider implements ImageSearchProvider {
  readonly name = 'gallica';

  async search(
    keywords: string,
    limit: number = 6,
    _options?: ImageSearchProviderOptions
  ): Promise<VisualCandidate[]> {
    const cleanKeywords = sanitizeGallicaQuery(keywords);
    if (!cleanKeywords) return [];

    const encodedQuery = encodeURIComponent(cleanKeywords);
    const sruUrl = `https://gallica.bnf.fr/SRU?operation=searchRetrieve&version=1.2&query=(gallica%20all%20${encodedQuery})%20and%20(dc.type%20all%20%22image%22)&maximumRecords=${Math.min(limit * 2, 10)}&startRecord=1`;

    // Apply proactive rate limiter (max 2 RPS for Gallica BnF)
    await ProviderRateLimiter.acquireSlot('gallica');

    const controller = new AbortController();
    const timeoutMs = 8000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    try {
      const res = await fetch(sruUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ChronoViet-Bot/1.0 (historical-research@chronoviet.vn)',
          Accept: 'application/xml, text/xml, application/json, */*',
        },
        cache: 'no-store',
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        log.debug('research.gallica_http_error', `HTTP ${res.status} from Gallica BnF for "${cleanKeywords}"`, {
          keywords: cleanKeywords,
          status: res.status,
          latencyMs,
        });
        return [];
      }

      const text = await res.text();
      const candidates: VisualCandidate[] = [];

      // Extract ark identifiers: e.g., ark:/12148/btv1b8449691v or btv1b...
      const recordMatches = text.match(/<srw:record>[\s\S]*?<\/srw:record>/g) || text.match(/<record>[\s\S]*?<\/record>/g) || [];

      for (let i = 0; i < recordMatches.length; i++) {
        const record = recordMatches[i];
        const arkMatch = record.match(/https?:\/\/gallica\.bnf\.fr\/ark:\/12148\/([a-z0-9]+)/i) ||
          record.match(/ark:\/12148\/([a-z0-9]+)/i);

        if (!arkMatch) continue;

        const arkId = arkMatch[1];
        const titleMatch = record.match(/<dc:title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:title>/i);
        const creatorMatch = record.match(/<dc:creator>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/i);

        const title = titleMatch ? titleMatch[1].trim() : `Tư liệu Gallica BnF: ${cleanKeywords}`;
        const author = creatorMatch ? creatorMatch[1].trim() : 'Bibliothèque nationale de France (Gallica)';

        candidates.push({
          candidateId: `cand_gallica_${arkId}`,
          imageUrl: `https://gallica.bnf.fr/ark:/12148/${arkId}/f1.highres`,
          sourceUrl: `https://gallica.bnf.fr/ark:/12148/${arkId}`,
          title: title.slice(0, 150),
          author: author.slice(0, 100),
          license: 'PUBLIC_DOMAIN',
          candidateBatch: 1,
        });

        if (candidates.length >= limit) break;
      }

      log.debug('research.gallica_success', `Gallica BnF returned ${candidates.length} candidates`, {
        keywords: cleanKeywords,
        candidateCount: candidates.length,
        latencyMs,
      });

      return candidates;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      log.debug('research.gallica_search_failed', `Gallica BnF search failed for "${cleanKeywords}": ${err.message}`, {
        keywords: cleanKeywords,
        error: err.message,
        latencyMs,
      });
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
