import { describe, it, expect } from 'vitest';
import {
  isAllowedImageDomain,
  inferLicenseFromDomain,
  ImageSearchToolInputSchema,
  getImageSearchProviderChain,
  getImageDomainWhitelist,
} from '../image-search.js';

describe('Image Search Whitelist & License Policy', () => {
  describe('isAllowedImageDomain', () => {
    it('allows standard Wikimedia Commons domains', () => {
      expect(isAllowedImageDomain('https://upload.wikimedia.org/wikipedia/commons/1/1a/Example.jpg')).toBe(true);
      expect(isAllowedImageDomain('https://commons.wikimedia.org/wiki/File:Example.jpg')).toBe(true);
    });

    it('allows Flickr static hosts', () => {
      expect(isAllowedImageDomain('https://live.staticflickr.com/65535/51234_b.jpg')).toBe(true);
      expect(isAllowedImageDomain('https://farm6.staticflickr.com/123/456.jpg')).toBe(true);
    });

    it('allows wildcard Vietnamese government subdomains (*.gov.vn)', () => {
      expect(isAllowedImageDomain('https://sub.baotang.gov.vn/img.jpg')).toBe(true);
      expect(isAllowedImageDomain('https://nlv.gov.vn/digital/item1.png')).toBe(true);
      expect(isAllowedImageDomain('https://vass.gov.vn/images/history.jpg')).toBe(true);
      expect(isAllowedImageDomain('https://viensuhoc.vass.gov.vn/media/artifact.jpg')).toBe(true);
      expect(isAllowedImageDomain('https://sub.archives.gov.vn/doc.png')).toBe(true);
    });

    it('allows official heritage and museum domains', () => {
      expect(isAllowedImageDomain('https://hoangthanhthanglong.vn/media/co-vat.jpg')).toBe(true);
      expect(isAllowedImageDomain('https://hueworldheritage.org.vn/assets/hue.jpg')).toBe(true);
      expect(isAllowedImageDomain('https://baotanglichsu.vn/assets/artifact.png')).toBe(true);
      expect(isAllowedImageDomain('https://btlsqs.vn/photo/bachdang.jpg')).toBe(true);
    });

    it('allows international archival and museum databases', () => {
      expect(isAllowedImageDomain('https://gallica.bnf.fr/ark:/12148/bpt6k.image')).toBe(true);
      expect(isAllowedImageDomain('https://archive.org/download/vietnam_history/page1.jpg')).toBe(true);
      expect(isAllowedImageDomain('https://images.metmuseum.org/CRDImages/as/original/DP123.jpg')).toBe(true);
      expect(isAllowedImageDomain('https://digitalcollections.nypl.org/items/image.jpg')).toBe(true);
      expect(isAllowedImageDomain('https://europeana.eu/media/thumb.jpg')).toBe(true);
    });

    it('rejects arbitrary, commercial, or unverified domains', () => {
      expect(isAllowedImageDomain('https://evil.com/fake.jpg')).toBe(false);
      expect(isAllowedImageDomain('https://random.cdn.net/img.png')).toBe(false);
      expect(isAllowedImageDomain('https://pinterest.com/pin/123.jpg')).toBe(false);
      expect(isAllowedImageDomain('https://not-really-gov.vn.attacker.com/pic.jpg')).toBe(false);
      expect(isAllowedImageDomain('invalid-url-string')).toBe(false);
    });
  });

  describe('inferLicenseFromDomain', () => {
    it('infers PUBLIC_DOMAIN for Wikimedia and major archives', () => {
      expect(inferLicenseFromDomain('https://upload.wikimedia.org/img.jpg')).toBe('PUBLIC_DOMAIN');
      expect(inferLicenseFromDomain('https://gallica.bnf.fr/item.jpg')).toBe('PUBLIC_DOMAIN');
      expect(inferLicenseFromDomain('https://archive.org/item.jpg')).toBe('PUBLIC_DOMAIN');
    });

    it('infers CC_BY_SA_4_0 for Flickr', () => {
      expect(inferLicenseFromDomain('https://live.staticflickr.com/123/456.jpg')).toBe('CC_BY_SA_4_0');
      expect(inferLicenseFromDomain('https://flickr.com/photos/user/123')).toBe('CC_BY_SA_4_0');
    });

    it('infers CC0 for Met Museum, British Museum, Rijksmuseum, and NYPL', () => {
      expect(inferLicenseFromDomain('https://images.metmuseum.org/img.jpg')).toBe('CC0');
      expect(inferLicenseFromDomain('https://www.britishmuseum.org/img.jpg')).toBe('CC0');
      expect(inferLicenseFromDomain('https://rijksmuseum.nl/img.jpg')).toBe('CC0');
      expect(inferLicenseFromDomain('https://digitalcollections.nypl.org/img.jpg')).toBe('CC0');
    });

    it('infers CC_BY_4_0 for official Vietnamese institutions and .gov.vn domains', () => {
      expect(inferLicenseFromDomain('https://baotanglichsu.vn/img.jpg')).toBe('CC_BY_4_0');
      expect(inferLicenseFromDomain('https://nlv.gov.vn/img.jpg')).toBe('CC_BY_4_0');
      expect(inferLicenseFromDomain('https://btlsqs.vn/img.jpg')).toBe('CC_BY_4_0');
      expect(inferLicenseFromDomain('https://hoangthanhthanglong.vn/img.jpg')).toBe('CC_BY_4_0');
      expect(inferLicenseFromDomain('https://sub.anything.gov.vn/img.jpg')).toBe('CC_BY_4_0');
    });

    it('returns UNKNOWN for unmapped or invalid URLs', () => {
      expect(inferLicenseFromDomain('https://unknown-domain.xyz/img.jpg')).toBe('UNKNOWN');
      expect(inferLicenseFromDomain('invalid-url')).toBe('UNKNOWN');
    });
  });

  describe('ImageSearchToolInputSchema', () => {
    it('applies default limit of 6 candidates', () => {
      const parsed = ImageSearchToolInputSchema.parse({
        sceneId: 'scene_001',
        primaryQuery: 'Trận Bạch Đằng',
      });
      expect(parsed.limit).toBe(6);
      expect(parsed.minResolution).toBe('HD');
      expect(parsed.visualType).toBe('GENERAL_HISTORICAL');
    });

    it('accepts explicit limit within bounds 1-10', () => {
      const parsed = ImageSearchToolInputSchema.parse({
        sceneId: 'scene_002',
        primaryQuery: 'Quang Trung',
        limit: 8,
      });
      expect(parsed.limit).toBe(8);
    });
  });

  describe('getImageSearchProviderChain', () => {
    it('returns ordered default chain', () => {
      const chain = getImageSearchProviderChain();
      expect(chain).toEqual(['serpapi', 'tavily', 'brave', 'wikimedia', 'gallica', 'catalog']);
    });
  });
});
