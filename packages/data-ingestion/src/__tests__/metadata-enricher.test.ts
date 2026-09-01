import { describe, it, expect } from 'vitest';
import {
  extractTimeBounds,
  detectDynasty,
  extractKeyFigures,
  extractLocation,
  enrichChunkMetadata,
} from '../chunking/metadata-enricher.js';
import { findHistoricalEpoch } from '@chronoviet/shared-spec';

describe('Metadata Enricher & Chronology Unit Tests', () => {
  describe('findHistoricalEpoch', () => {
    it('should accurately resolve BCE years', () => {
      const epoch = findHistoricalEpoch(-257);
      expect(epoch).toBeDefined();
      expect(epoch?.dynastyId).toBe('dynasty_au_lac');
      expect(epoch?.name).toContain('Âu Lạc');
    });

    it('should resolve ancient years (< 800 AD)', () => {
      const e40 = findHistoricalEpoch(40);
      expect(e40?.dynastyId).toBe('dynasty_hai_ba_trung');

      const e544 = findHistoricalEpoch(544);
      expect(e544?.dynastyId).toBe('dynasty_tien_ly');

      const e938 = findHistoricalEpoch(938);
      expect(e938?.dynastyName).toBe('Thời kỳ Bắc thuộc / Tự chủ');

      const e939 = findHistoricalEpoch(939);
      expect(e939?.dynastyId).toBe('dynasty_ngo');
    });

    it('should accurately resolve complex transition periods (Ho, Minh thuoc, Le So, Mac, Trinh Nguyen)', () => {
      // 1400: Ho
      expect(findHistoricalEpoch(1400)?.dynastyId).toBe('dynasty_ho');
      // 1418: Minh thuoc / Lam Son
      expect(findHistoricalEpoch(1418)?.dynastyId).toBe('epoch_minh_thuoc');
      // 1428: Le So
      expect(findHistoricalEpoch(1428)?.dynastyId).toBe('dynasty_le_so');
      // 1550: Mac / Nam Bac Trieu
      expect(findHistoricalEpoch(1550)?.dynastyId).toBe('dynasty_mac');
      // 1650: Trinh - Nguyen
      expect(findHistoricalEpoch(1650)?.dynastyId).toBe('dynasty_le_trung_hung');
      // 1789: Tay Son
      expect(findHistoricalEpoch(1789)?.dynastyId).toBe('dynasty_nha_tay_son');
      // 1820: Nguyen
      expect(findHistoricalEpoch(1820)?.dynastyId).toBe('dynasty_nguyen');
      // 1954: Modern
      expect(findHistoricalEpoch(1954)?.dynastyId).toBe('epoch_hien_dai');
    });
  });

  describe('extractTimeBounds', () => {
    it('should extract ancient 2-digit years with prefix', () => {
      const bounds = extractTimeBounds('Khởi nghĩa Hai Bà Trưng bùng nổ vào năm 40.');
      expect(bounds.timeStart).toBe(40);
      expect(bounds.timeEnd).toBe(40);
    });

    it('should extract BCE years', () => {
      const bounds = extractTimeBounds('Năm 257 TCN, An Dương Vương thành lập nhà nước Âu Lạc.');
      expect(bounds.timeStart).toBe(-257);
      expect(bounds.timeEnd).toBe(-257);
    });

    it('should extract century ranges from Roman numerals', () => {
      const bounds = extractTimeBounds('Thời kỳ hoàng kim vào thế kỷ XIII dưới triều Trần.');
      expect(bounds.timeStart).toBe(1201);
      expect(bounds.timeEnd).toBe(1300);
    });

    it('should extract standard multiple years range', () => {
      const bounds = extractTimeBounds('Chiến tranh giải phóng từ năm 1945 đến năm 1975.');
      expect(bounds.timeStart).toBe(1945);
      expect(bounds.timeEnd).toBe(1975);
    });
  });

  describe('detectDynasty', () => {
    it('should detect dynasty by explicit priority match', () => {
      expect(detectDynasty('Quang Trung đại phá quân Mãn Thanh')).toBe('Nhà Tây Sơn');
      expect(detectDynasty('Triều đình nhà Nguyễn đóng đô ở Phú Xuân')).toBe('Nhà Nguyễn');
      expect(detectDynasty('Vua Lý Thái Tổ dời đô về Thăng Long')).toBe('Nhà Lý');
    });

    it('should infer dynasty from years if no direct keyword is present', () => {
      expect(detectDynasty('Sự kiện diễn ra vào năm 1010')).toBe('Nhà Lý');
      expect(detectDynasty('Khởi nghĩa năm 1418 tại vùng núi Lam Sơn')).toBe('Thời kỳ thuộc Minh / Hậu Trần');
    });
  });

  describe('extractKeyFigures', () => {
    it('should extract figures from text using SSOT definitions and aliases', () => {
      const text = 'Bác Hồ đọc Tuyên ngôn Độc lập, cùng Đại tướng Võ Nguyên Giáp chỉ huy.';
      const figures = extractKeyFigures(text);
      expect(figures).toContain('Hồ Chí Minh');
      expect(figures).toContain('Võ Nguyên Giáp');
    });

    it('should extract ancient figures and aliases', () => {
      const text = 'Đức Thánh Trần chỉ huy quân dân đánh tan quân Nguyên Mông.';
      const figures = extractKeyFigures(text);
      expect(figures).toContain('Trần Hưng Đạo');
    });
  });

  describe('enrichChunkMetadata', () => {
    it('should combine document and text metadata coherently', () => {
      const enriched = enrichChunkMetadata(
        'Năm 1789, vua Quang Trung đại phá 29 vạn quân Mãn Thanh tại Thăng Long.',
        {
          title: 'Chiến thắng Ngọc Hồi Đống Đa',
        }
      );
      expect(enriched.dynasty).toBe('Nhà Tây Sơn');
      expect(enriched.timeStart).toBe(1789);
      expect(enriched.keyFigures).toContain('Quang Trung');
      expect(enriched.location).toBe('Thăng Long');
    });
  });
});
