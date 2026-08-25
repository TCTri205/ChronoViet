/**
 * Unit Tests for 100+ Asset Master Curated Historical Matrix
 * Validates 10 epochs completeness, zero era contamination, and safe fallback.
 */

import { describe, it, expect } from 'vitest';
import {
  HISTORICAL_FALLBACK_CATALOG,
  matchCuratedCatalog,
  HistoricalEpochKey,
} from '../research/providers/wikimedia-search.js';

describe('100+ Asset Master Curated Historical Matrix', () => {
  const ALL_10_EPOCHS: HistoricalEpochKey[] = [
    'EPOCH_HONG_BANG_VAN_LANG',
    'EPOCH_BAC_THUOC',
    'EPOCH_NGO_DINH_TIEN_LE',
    'EPOCH_LY_TRAN',
    'EPOCH_HO_HAU_LE',
    'EPOCH_TRINH_NGUYEN',
    'EPOCH_TAY_SON',
    'EPOCH_NGUYEN',
    'EPOCH_CAN_DAI',
    'EPOCH_HIEN_DAI',
  ];

  it('contains at least 100 verified historical assets', () => {
    expect(HISTORICAL_FALLBACK_CATALOG.length).toBeGreaterThanOrEqual(100);
  });

  it('contains at least 10 verified assets for every single one of the 10 epochs', () => {
    for (const epoch of ALL_10_EPOCHS) {
      const itemsInEpoch = HISTORICAL_FALLBACK_CATALOG.filter((item) => item.epochKey === epoch);
      expect(itemsInEpoch.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('ensures every asset has 100% compliant license, valid URL, and focalPoint coordinates', () => {
    const validLicenses = new Set(['PUBLIC_DOMAIN', 'CC0', 'CC_BY_4_0', 'CC_BY_SA_4_0']);

    for (const asset of HISTORICAL_FALLBACK_CATALOG) {
      expect(validLicenses.has(asset.license)).toBe(true);
      expect(asset.imageUrl).toMatch(/^https:\/\//);
      expect(asset.title).toBeTruthy();
      expect(asset.author).toBeTruthy();
      expect(asset.topicKeywords.length).toBeGreaterThan(0);
      expect(asset.focalPoint).toBeDefined();
      expect(asset.focalPoint?.[0]).toBeGreaterThanOrEqual(0);
      expect(asset.focalPoint?.[0]).toBeLessThanOrEqual(1);
      expect(asset.focalPoint?.[1]).toBeGreaterThanOrEqual(0);
      expect(asset.focalPoint?.[1]).toBeLessThanOrEqual(1);
    }
  });

  describe('Strict Epoch Matching & Zero Contamination (ADR-5)', () => {
    it('matches Hong Bang / Dong Son queries with Bronze drum and Co Loa assets', () => {
      const results = matchCuratedCatalog('Trống đồng Đông Sơn thời Hùng Vương', 5);
      expect(results.some((r) => (r.title || '').toLowerCase().includes('đông sơn'))).toBe(true);
    });

    it('matches Bac Thuoc queries with Hai Ba Trung / Ba Trieu assets', () => {
      const results = matchCuratedCatalog('Khởi nghĩa Hai Bà Trưng cưỡi voi', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Hai Bà Trưng');
    });

    it('matches Ngo - Dinh - Tien Le queries with Bach Dang 938 and Hoa Lu', () => {
      const results = matchCuratedCatalog('Ngô Quyền cọc gỗ Bạch Đằng 938', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Bạch Đằng');
    });

    it('matches Ly - Tran queries with Ly Thai To and Tran Hung Dao', () => {
      const results = matchCuratedCatalog('Trần Hưng Đạo Hịch tướng sĩ đánh quân Nguyên', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Trần');
    });

    it('matches Ho - Hau Le queries with Thanh Nha Ho and Nguyen Trai', () => {
      const results = matchCuratedCatalog('Danh nhân Nguyễn Trãi Côn Sơn', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Nguyễn Trãi');
    });

    it('matches Trinh - Nguyen queries with Song Gianh and Chua Cau Hoi An', () => {
      const results = matchCuratedCatalog('Sông Gianh Trịnh Nguyễn phân tranh', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Sông Gianh');
    });

    it('matches Tay Son queries with Quang Trung and Rach Gam Xoai Mut', () => {
      const results = matchCuratedCatalog('Hoàng đế Quang Trung Nguyễn Huệ Gò Đống Đa', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Quang Trung');
    });

    it('matches Nguyen Dynasty queries with Co Do Hue and Chau Ban', () => {
      const results = matchCuratedCatalog('Châu bản triều Nguyễn Hoàng Sa Trường Sa', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Châu bản');
    });

    it('matches Can Dai queries with Yen The and Phan Boi Chau', () => {
      const results = matchCuratedCatalog('Thủ lĩnh Hoàng Hoa Thám khởi nghĩa Yên Thế', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Hoàng Hoa Thám');
    });

    it('matches Hien Dai queries with Dien Bien Phu and Dinh Doc Lap', () => {
      const results = matchCuratedCatalog('Chiến dịch Điện Biên Phủ Mường Thanh 1954', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Điện Biên Phủ');
    });

    it('returns empty array [] for unknown or future topics to enforce Pure Code over Wrong Image', () => {
      expect(matchCuratedCatalog('Vũ trụ lượng tử cyberpunk 2099')).toEqual([]);
      expect(matchCuratedCatalog('')).toEqual([]);
      expect(matchCuratedCatalog('Công nghệ trí tuệ nhân tạo bán dẫn')).toEqual([]);
    });
  });
});
