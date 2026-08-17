/**
 * Unit tests for Image Search Providers (SerpAPI / Tavily / Brave)
 * Uses mocked global fetch so no real network calls happen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SerpApiImageSearchProvider } from '../search/serpapi-search.js';
import { TavilyImageSearchProvider } from '../search/tavily-search.js';
import { BraveImageSearchProvider } from '../search/brave-search.js';
import { isAllowedImageDomain, inferLicenseFromDomain } from '@chronoviet/shared-spec';

const originalFetch = globalThis.fetch;

function mockFetchOnce(payload: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => payload,
  } as any));
}

describe('SerpApiImageSearchProvider', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch as any;
  });

  it('should skip when no API key is configured', async () => {
    const provider = new SerpApiImageSearchProvider('');
    const result = await provider.search('Ngô Quyền', 3);
    expect(result).toEqual([]);
  });

  it('should map images_results to candidates and filter non-whitelisted domains', async () => {
    mockFetchOnce({
      images_results: [
        {
          position: 1,
          original: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Latte_and_dark_coffee.jpg',
          link: 'https://en.wikipedia.org/wiki/Coffee',
          title: 'Coffee - Wikipedia',
          source: 'Wikipedia',
          license_details_url: 'http://creativecommons.org/publicdomain/zero/1.0/',
        },
        {
          position: 2,
          original: 'https://evil.example.com/hacked.jpg',
          link: 'https://evil.example.com/',
          title: 'Bad domain',
          source: 'Evil',
        },
      ],
    });

    const provider = new SerpApiImageSearchProvider('test-key');
    const result = await provider.search('coffee', 3);
    expect(result.length).toBe(1);
    expect(result[0].imageUrl).toContain('upload.wikimedia.org');
    expect(result[0].license).toBe('PUBLIC_DOMAIN');
  });
});

describe('TavilyImageSearchProvider', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch as any;
  });

  it('should skip when no API key is configured', async () => {
    const provider = new TavilyImageSearchProvider('');
    expect(await provider.search('test', 3)).toEqual([]);
  });

  it('should map top-level images array and filter non-whitelisted domains', async () => {
    mockFetchOnce({
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg',
        'https://random.cdn.example.com/photo.jpg',
      ],
    });

    const provider = new TavilyImageSearchProvider('test-key');
    const result = await provider.search('Hai Bà Trưng', 3);
    expect(result.length).toBe(1);
    expect(result[0].imageUrl).toContain('wikimedia.org');
  });
});

describe('BraveImageSearchProvider', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch as any;
  });

  it('should skip when no API key is configured', async () => {
    const provider = new BraveImageSearchProvider('');
    expect(await provider.search('test', 3)).toEqual([]);
  });

  it('should map properties.url and filter non-whitelisted domains', async () => {
    mockFetchOnce({
      results: [
        {
          title: 'Trống đồng Đông Sơn',
          url: 'https://commons.wikimedia.org/wiki/File:Trong_dong.jpg',
          properties: { url: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Battle_at_the_River_Tho-xuong.jpg' },
          source: 'Wikimedia Commons',
        },
        {
          title: 'Bad',
          url: 'https://evil.example.com',
          properties: { url: 'https://evil.example.com/photo.png' },
          source: 'Evil',
        },
      ],
    });

    const provider = new BraveImageSearchProvider('test-key');
    const result = await provider.search('Trống đồng', 3);
    expect(result.length).toBe(1);
    expect(result[0].imageUrl).toContain('upload.wikimedia.org');
  });
});

describe('Domain whitelist & license inference', () => {
  it('should allow trusted Wikimedia / Flickr / museum hosts', () => {
    expect(isAllowedImageDomain('https://upload.wikimedia.org/wikipedia/commons/a/a.jpg')).toBe(true);
    expect(isAllowedImageDomain('https://commons.wikimedia.org/wiki/File:X.jpg')).toBe(true);
    expect(isAllowedImageDomain('https://live.staticflickr.com/65535/1.jpg')).toBe(true);
  });

  it('should reject arbitrary hosts', () => {
    expect(isAllowedImageDomain('https://cdn.example.com/a.jpg')).toBe(false);
    expect(isAllowedImageDomain('https://i.ytimg.com/vi/x/hqdefault.jpg')).toBe(false);
  });

  it('should infer license from host', () => {
    expect(inferLicenseFromDomain('https://upload.wikimedia.org/a.jpg')).toBe('PUBLIC_DOMAIN');
    expect(inferLicenseFromDomain('https://live.staticflickr.com/1/a.jpg')).toBe('CC_BY_SA_4_0');
    expect(inferLicenseFromDomain('https://images.metmuseum.org/a.jpg')).toBe('CC0');
    expect(inferLicenseFromDomain('https://cdn.example.com/a.jpg')).toBe('UNKNOWN');
  });
});
