/**
 * Gallica BnF (Bibliothèque nationale de France) Image Search Provider
 * Searches high-resolution public domain archival imagery, colonial documents, and maps.
 */

import { VisualCandidate } from '@chronoviet/shared-spec';
import { createLogger } from '@chronoviet/infra';
import { ImageSearchProvider, ImageSearchProviderOptions } from './image-search-provider.js';

const log = createLogger({ service: 'agent-orchestrator' });

export class GallicaSearchProvider implements ImageSearchProvider {
  readonly name = 'gallica';

  async search(
    keywords: string,
    limit: number = 6,
    _options?: ImageSearchProviderOptions
  ): Promise<VisualCandidate[]> {
    if (!keywords || !keywords.trim()) return [];

    const encodedQuery = encodeURIComponent(keywords.trim());
    const sruUrl = `https://gallica.bnf.fr/SRU?operation=searchRetrieve&version=1.2&query=(gallica%20all%20%22${encodedQuery}%22)%20and%20(dc.type%20all%20%22image%22)&maximumRecords=${Math.min(limit * 2, 10)}&startRecord=1`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
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
        log.warn('research.gallica_http_error', `HTTP ${res.status} from Gallica BnF for "${keywords}"`, {
          keywords,
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

        const title = titleMatch ? titleMatch[1].trim() : `Tư liệu Gallica BnF: ${keywords}`;
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
        keywords,
        candidateCount: candidates.length,
        latencyMs,
      });

      return candidates;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      log.warn('research.gallica_search_failed', `Gallica BnF search failed for "${keywords}": ${err.message}`, {
        keywords,
        error: err.message,
        latencyMs,
      });
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
