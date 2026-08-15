/**
 * Image Research Agent — Domain Whitelist & License Safety Helpers
 * Online image search providers (SerpAPI/Tavily/Brave) may return URLs from
 * arbitrary domains. To keep copyright compliance 100%, only URLs whose host
 * belongs to trusted public-domain / Creative-Commons repositories are accepted.
 */

import { envConfig } from './config.js';
import { LicenseType } from './schema.js';

export type ImageSearchProviderName =
  | 'serpapi'
  | 'tavily'
  | 'brave'
  | 'wikimedia'
  | 'catalog';

export const IMAGE_SEARCH_PROVIDER_NAMES: ImageSearchProviderName[] = [
  'serpapi',
  'tavily',
  'brave',
  'wikimedia',
  'catalog',
];

/**
 * Default whitelist of image hosts trusted for copyright-safe crawl.
 * Wikimedia Commons (PD/CC), Flickr (CC filterable) and museum archives.
 */
export const DEFAULT_IMAGE_DOMAIN_WHITELIST = [
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'live.staticflickr.com',
  'flickr.com',
  'farm1.staticflickr.com',
  'farm2.staticflickr.com',
  'farm3.staticflickr.com',
  'farm4.staticflickr.com',
  'farm5.staticflickr.com',
  'farm6.staticflickr.com',
  'farm8.staticflickr.com',
  'farm9.staticflickr.com',
  'farm10.staticflickr.com',
  'images.metmuseum.org',
  'collectionapi.metmuseum.org',
  'www.britishmuseum.org',
  'media.britishmuseum.org',
  'upload.wikimedia.org',
];

/**
 * Resolve the active domain whitelist from environment configuration
 * (comma-separated), falling back to the default list.
 */
export function getImageDomainWhitelist(): string[] {
  const raw = envConfig.IMAGE_DOMAIN_WHITELIST?.trim();
  if (!raw) return [...DEFAULT_IMAGE_DOMAIN_WHITELIST];
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean);
}

/**
 * Returns true when the given image URL points to a host inside the
 * configured domain whitelist (used to guarantee license compliance).
 */
export function isAllowedImageDomain(imageUrl: string): boolean {
  try {
    const hostname = new URL(imageUrl).hostname.toLowerCase();
    return getImageDomainWhitelist().some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Parse IMAGE_SEARCH_PROVIDER_CHAIN env into an ordered provider list,
 * filtering out unsupported names and duplicates while preserving order.
 */
export function getImageSearchProviderChain(): ImageSearchProviderName[] {
  const raw = envConfig.IMAGE_SEARCH_PROVIDER_CHAIN?.trim();
  if (!raw) return [...IMAGE_SEARCH_PROVIDER_NAMES];
  const seen = new Set<string>();
  const chain: ImageSearchProviderName[] = [];
  for (const name of raw.split(',')) {
    const trimmed = name.trim().toLowerCase() as ImageSearchProviderName;
    if (IMAGE_SEARCH_PROVIDER_NAMES.includes(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed);
      chain.push(trimmed);
    }
  }
  return chain.length > 0 ? chain : [...IMAGE_SEARCH_PROVIDER_NAMES];
}

/**
 * Infers a copyright license for an image URL based on its host.
 * Wikimedia / Flickr hosts are treated as PUBLIC_DOMAIN or CC0 (safe defaults),
 * anything else returns UNKNOWN (license-filter will reject it downstream).
 */
export function inferLicenseFromDomain(imageUrl: string): LicenseType {
  const host = new URL(imageUrl).hostname.toLowerCase();
  if (host === 'upload.wikimedia.org' || host === 'commons.wikimedia.org') {
    return 'PUBLIC_DOMAIN';
  }
  if (
    host === 'flickr.com' ||
    host.endsWith('.flickr.com') ||
    host === 'live.staticflickr.com' ||
    host.endsWith('.staticflickr.com')
  ) {
    return 'CC_BY_SA_4_0';
  }
  if (
    host === 'images.metmuseum.org' ||
    host === 'www.britishmuseum.org' ||
    host === 'media.britishmuseum.org'
  ) {
    return 'CC0';
  }
  return 'UNKNOWN';
}
