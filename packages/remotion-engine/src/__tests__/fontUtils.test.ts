import { describe, it, expect } from 'vitest';
import {
  beVietnamFont,
  merriweatherFont,
  normalizeVietnameseText,
  toVietnameseUpperCase,
  getSafeFontFamily,
} from '../utils/fontUtils';

describe('fontUtils', () => {
  describe('normalizeVietnameseText', () => {
    it('returns empty string for null, undefined, or empty text', () => {
      expect(normalizeVietnameseText(null)).toBe('');
      expect(normalizeVietnameseText(undefined)).toBe('');
      expect(normalizeVietnameseText('')).toBe('');
    });

    it('normalizes decomposed Unicode (NFD) to composed Unicode (NFC)', () => {
      const original = 'Quang Trung Nguyễn Huệ';
      const nfd = original.normalize('NFD');
      expect(nfd).not.toBe(original);
      const normalized = normalizeVietnameseText(nfd);
      expect(normalized).toBe(original);
      expect(normalized.normalize('NFC')).toBe(normalized);
    });

    it('preserves already normalized Vietnamese characters intact', () => {
      const input = 'Bách chiến bách thắng, uy danh lẫy lừng!';
      expect(normalizeVietnameseText(input)).toBe(input);
    });
  });

  describe('toVietnameseUpperCase', () => {
    it('returns empty string for null, undefined, or empty text', () => {
      expect(toVietnameseUpperCase(null)).toBe('');
      expect(toVietnameseUpperCase(undefined)).toBe('');
      expect(toVietnameseUpperCase('')).toBe('');
    });

    it('converts Vietnamese text with accents to NFC uppercase', () => {
      const input = 'nguyễn huệ - quang trung đại đế';
      const output = toVietnameseUpperCase(input);
      expect(output).toBe('NGUYỄN HUỆ - QUANG TRUNG ĐẠI ĐẾ');
      expect(output.normalize('NFC')).toBe(output);
    });

    it('handles heavy diacritics properly in uppercase', () => {
      const input = 'trận ngọc hồi đống đa 1789';
      expect(toVietnameseUpperCase(input)).toBe('TRẬN NGỌC HỒI ĐỐNG ĐA 1789');
    });
  });

  describe('getSafeFontFamily', () => {
    it('returns default sans-serif font stack when no custom font provided', () => {
      const font = getSafeFontFamily();
      expect(font).toBe(`${beVietnamFont}, ${merriweatherFont}, sans-serif`);
    });

    it('returns default serif font stack when isSerif is true', () => {
      const font = getSafeFontFamily(undefined, true);
      expect(font).toBe(`${merriweatherFont}, ${beVietnamFont}, serif`);
    });

    it('prepends custom font family to fallback stack', () => {
      const font = getSafeFontFamily('Playfair Display', true);
      expect(font).toContain('Playfair Display');
      expect(font).toContain(merriweatherFont);
      expect(font).toContain(beVietnamFont);
    });
  });
});
