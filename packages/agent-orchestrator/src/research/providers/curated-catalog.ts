/**
 * Curated Historical Assets Catalog & Offline Fallback Provider
 * Verified 10-Epoch Master Historical Assets Catalog from Wikimedia Commons & National Archives.
 * Organized strictly by chronological era to prevent anachronistic media pairing (10 items per era, 100 total).
 * Acts as an air-gapped zero-downtime safety net (ADR-5) when live online providers are unavailable.
 */

import { VisualCandidate } from "@chronoviet/shared-spec";
import { ImageSearchProvider, ImageSearchProviderOptions } from "./image-search-provider.js";
import { stripNegativeSearchTerms } from "./wikimedia-search.js";
import {
  HISTORICAL_FALLBACK_CATALOG,
  HistoricalEpochKey,
  CuratedHistoricalAsset,
} from "./curated-catalog.data.js";

export {
  HISTORICAL_FALLBACK_CATALOG,
  HistoricalEpochKey,
  CuratedHistoricalAsset,
};

export function toCanonicalWikimediaUrl(url: string): string {
  if (!url) return url;
  if (url.includes('upload.wikimedia.org/wikipedia/commons/')) {
    const filename = url.split('/').pop();
    if (filename) {
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}`;
    }
  }
  return url;
}

const ANCIENT_ERA_KEYWORDS = [
  'hùng vương', 'văn lang', 'âu lạc', 'an dương vương', 'cổ loa', 'đông sơn', 'trống đồng',
  'hai bà trưng', 'trưng trắc', 'trưng nhị', 'mê linh', 'hát môn', 'bà triệu',
  'lý bí', 'lý nam đế', 'vạn xuân', 'triệu quang phục', 'mai hắc đế', 'phùng hưng',
  'khúc thừa dụ', 'đại la', 'bắc thuộc'
];

const MODERN_ERA_KEYWORDS = [
  'cách mạng tháng tám', '1945', '1954', '1975', 'điện biên phủ', 'dinh độc lập',
  'chiến dịch hồ chí minh', 'hồ chí minh', 'hà nội 1945', 'ba đình', 'giải phóng miền nam',
  'kháng chiến chống mỹ', 'kháng chiến chống pháp', 'cần vương', 'yên thế', 'pháp thuộc', 'cầu long biên'
];

/**
 * Strict Semantic/Epoch Matcher for Curated Catalog.
 * Anti-Anachronism Principle (ADR-5): If no verified curated asset matches the
 * queried topic/epoch with confidence (score >= 3), return an empty array `[]`
 * instead of returning out-of-epoch assets (e.g. Bronze drum for Dien Bien Phu).
 */
export function matchCuratedCatalog(
  keywords: string,
  limit: number = 6,
  targetPeriodOrEpoch?: string
): VisualCandidate[] {
  const cleanKeywords = stripNegativeSearchTerms(keywords);
  if (!cleanKeywords) return [];
  const lowerKw = cleanKeywords.toLowerCase();
  const lowerPeriod = (targetPeriodOrEpoch || '').toLowerCase();
  const fullContext = `${lowerKw} ${lowerPeriod}`;
  const tokens = lowerKw.split(/[\s,.-]+/).filter((t) => t.length > 2 && !["anime", "cartoon", "watermark", "game", "render", "stock", "fictional"].includes(t));

  const isAncientContext = ANCIENT_ERA_KEYWORDS.some((kw) => fullContext.includes(kw)) ||
    lowerPeriod.includes('bắc thuộc') || lowerPeriod.includes('văn lang') || lowerPeriod.includes('âu lạc');
  const isModernContext = MODERN_ERA_KEYWORDS.some((kw) => fullContext.includes(kw)) ||
    lowerPeriod.includes('hiện đại') || lowerPeriod.includes('cận đại') || lowerPeriod.includes('1945') || lowerPeriod.includes('1975');

  const scored = HISTORICAL_FALLBACK_CATALOG.map((item) => {
    let score = 0;

    // Strict Epoch Gate (Anti-Anachronism ADR-5)
    if (isAncientContext && (item.epochKey === 'EPOCH_CAN_DAI' || item.epochKey === 'EPOCH_HIEN_DAI')) {
      return { item, score: -100 }; // Never match 20th-century assets to ancient events
    }
    if (isModernContext && (item.epochKey === 'EPOCH_HONG_BANG_VAN_LANG' || item.epochKey === 'EPOCH_BAC_THUOC')) {
      return { item, score: -100 }; // Never match bronze age / ancient assets to modern events
    }

    if (isAncientContext && (item.epochKey === 'EPOCH_BAC_THUOC' || item.epochKey === 'EPOCH_HONG_BANG_VAN_LANG')) {
      score += 3;
    }
    if (isModernContext && (item.epochKey === 'EPOCH_CAN_DAI' || item.epochKey === 'EPOCH_HIEN_DAI')) {
      score += 3;
    }

    // Exact topic match
    if (lowerKw.includes(item.topicKey.replace(/_/g, " "))) {
      score += 5;
    }
    // Matching topic keywords
    for (const kw of item.topicKeywords) {
      if (lowerKw.includes(kw.toLowerCase())) {
        score += 3;
      }
    }
    // Token overlap in title
    const titleTokens = item.title.toLowerCase().split(/[\s,.-]+/).filter((t) => t.length > 2);
    for (const t of tokens) {
      if (titleTokens.includes(t)) {
        score += 1;
      }
    }
    return { item, score };
  });

  const matchingResults = scored
    .filter((s) => s.score >= 3) // Strict semantic threshold
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);

  if (matchingResults.length === 0) {
    // "Pure Code over Wrong Image": Return empty array
    return [];
  }

  return matchingResults.slice(0, limit).map((item, idx) => ({
    candidateId: `cand_catalog_${idx + 1}`,
    imageUrl: toCanonicalWikimediaUrl(item.imageUrl),
    sourceUrl: item.sourceUrl,
    title: item.title,
    author: item.author,
    license: item.license,
    focalPoint: item.focalPoint || [0.5, 0.5],
    candidateBatch: 1,
  }));
}

/**
 * Offline curated catalog provider. Returns epoch-aligned verified historical assets.
 * If keywords don't match any epoch, returns [] to allow PURE_CODE fallback.
 */
export class CuratedCatalogProvider implements ImageSearchProvider {
  readonly name = "catalog";

  async search(keywords: string, limit: number, options?: ImageSearchProviderOptions): Promise<VisualCandidate[]> {
    return matchCuratedCatalog(keywords, limit, (options as any)?.historicalPeriod);
  }
}
