/**
 * Image Research Agent — Domain Whitelist & License Safety Helpers
 * Online image search providers (SerpAPI/Tavily/Brave) may return URLs from
 * arbitrary domains. To keep copyright compliance 100%, only URLs whose host
 * belongs to trusted public-domain / Creative-Commons repositories are accepted.
 */

import { z } from 'zod';
import { envConfig } from './config.js';
import { LicenseType, VisualCandidateSchema, VisualCandidate } from './schema.js';

export const ImageSearchVisualTypeSchema = z.enum([
  'PORTRAIT',
  'BATTLE_SCENE',
  'MAP_CHRONO',
  'ARTIFACT',
  'LANDSCAPE',
  'ARCHAEOLOGY',
  'GENERAL_HISTORICAL',
]);
export type ImageSearchVisualType = z.infer<typeof ImageSearchVisualTypeSchema>;

export const ImageSearchToolInputSchema = z.object({
  sceneId: z.string().describe("Mã định danh cảnh phim (ví dụ: 'scene_001')"),
  primaryQuery: z.string().min(1).describe("Từ khóa tìm kiếm tiếng Việt chi tiết có ngữ cảnh lịch sử"),
  englishQuery: z.string().optional().describe("Từ khóa tiếng Anh tương ứng để tối ưu tìm kiếm trên Wikimedia/Google"),
  visualType: ImageSearchVisualTypeSchema.optional().default('GENERAL_HISTORICAL').describe("Loại hình ảnh tư liệu mong muốn"),
  historicalPeriod: z.string().optional().describe("Thời kỳ / Triều đại lịch sử liên quan"),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional().describe("Tỷ lệ khung hình mong muốn cho Remotion video"),
  minResolution: z.enum(['HD', 'FHD', '4K', 'ANY']).optional().default('HD').describe("Độ phân giải tối thiểu"),
  limit: z.number().int().min(1).max(10).optional().default(3).describe("Số lượng ứng viên ảnh cần tìm"),
});
export type ImageSearchToolInput = z.input<typeof ImageSearchToolInputSchema>;

export const ImageSearchProvenanceSchema = z.object({
  provider: z.string(),
  count: z.number(),
  latencyMs: z.number(),
});
export type ImageSearchProvenance = z.infer<typeof ImageSearchProvenanceSchema>;

export const ImageSearchToolResultSchema = z.object({
  sceneId: z.string(),
  primaryQuery: z.string(),
  englishQuery: z.string().optional(),
  visualType: ImageSearchVisualTypeSchema,
  candidates: z.array(VisualCandidateSchema),
  provenance: z.array(ImageSearchProvenanceSchema),
  resolvedAt: z.string(),
});
export type ImageSearchToolResult = z.infer<typeof ImageSearchToolResultSchema>;

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
  'baotanglichsu.vn',
  'btlsqs.vn',
  'archives.gov.vn',
  'dsvh.gov.vn',
  'ditichlichsuvanhoa.vn',
  'nhandan.vn',
  'chinhphu.vn',
  'vietnam.vn',
  'loc.gov',
  'nga.gov',
  'si.edu',
  'rijksmuseum.nl',
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
 * museum / public archive hosts are treated as PUBLIC_DOMAIN / CC0 / CC_BY_4_0,
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
    host === 'media.britishmuseum.org' ||
    host === 'rijksmuseum.nl' ||
    host.endsWith('.rijksmuseum.nl') ||
    host === 'nga.gov' ||
    host.endsWith('.nga.gov') ||
    host === 'loc.gov' ||
    host.endsWith('.loc.gov') ||
    host === 'si.edu' ||
    host.endsWith('.si.edu')
  ) {
    return 'CC0';
  }
  if (
    host === 'baotanglichsu.vn' ||
    host.endsWith('.baotanglichsu.vn') ||
    host === 'btlsqs.vn' ||
    host.endsWith('.btlsqs.vn') ||
    host === 'archives.gov.vn' ||
    host.endsWith('.archives.gov.vn') ||
    host === 'dsvh.gov.vn' ||
    host.endsWith('.dsvh.gov.vn') ||
    host === 'ditichlichsuvanhoa.vn' ||
    host.endsWith('.ditichlichsuvanhoa.vn') ||
    host === 'nhandan.vn' ||
    host.endsWith('.nhandan.vn') ||
    host === 'chinhphu.vn' ||
    host.endsWith('.chinhphu.vn') ||
    host === 'vietnam.vn' ||
    host.endsWith('.vietnam.vn')
  ) {
    return 'CC_BY_4_0';
  }
  return 'UNKNOWN';
}
