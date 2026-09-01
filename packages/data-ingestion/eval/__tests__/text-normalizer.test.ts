import { describe, it, expect } from 'vitest';
import {
  cleanOcrArtifacts,
  normalizeHistoricalTerms,
  normalizeText,
  segmentVietnameseWords,
} from '../../src/text/text-normalizer.js';

describe('Text Normalizer & Historical Document Cleaning Suite', () => {
  it('should normalize decomposed Unicode NFD to precomposed NFC', () => {
    // Decomposed NFD string: "H" + "o" + combining acute + "a" + " " + "L" + "u" + combining dot below
    const nfdString = 'Hoa Lư'.normalize('NFD');
    const cleaned = cleanOcrArtifacts(nfdString);
    expect(cleaned).toBe('Hoa Lư');
    expect(cleaned).toBe('Hoa Lư'.normalize('NFC'));
  });

  it('should clean OCR hyphenated line breaks across syllables', () => {
    const raw = 'Quân đội nhà Trần dưới sự lãnh đạo của Trần Quốc-\nTuấn đã giành thắng lợi lớn.';
    const cleaned = cleanOcrArtifacts(raw);
    expect(cleaned).toContain('Trần QuốcTuấn');
  });

  it('should remove inline page number tags like [Trang 12]', () => {
    const raw = 'Vua Lý Thái Tổ dời đô từ Hoa Lư về Đại La. [Trang 45] Sau đó đổi tên thành Thăng Long.';
    const cleaned = cleanOcrArtifacts(raw);
    expect(cleaned).not.toContain('[Trang 45]');
    expect(cleaned).toContain('Hoa Lư về Đại La. Sau đó đổi tên thành Thăng Long.');
  });

  it('should collapse multiple consecutive whitespaces and control characters', () => {
    const raw = 'Vua  \t  An Dương   Vương\u0000 xây dựng \u0007 thành Cổ Loa.';
    const cleaned = cleanOcrArtifacts(raw);
    expect(cleaned).toBe('Vua An Dương Vương xây dựng thành Cổ Loa.');
  });

  it('should normalize unaccented historical terms to canonical Vietnamese accents', () => {
    const raw = 'Tran Hung Dao danh bai quan Nguyen Mong tai Bach Dang, bao ve Dai Viet.';
    const normalized = normalizeHistoricalTerms(raw);
    expect(normalized).toContain('Trần Hưng Đạo');
    expect(normalized).toContain('Đại Việt');
  });

  it('should preserve historical compound entities through full normalization pipeline', () => {
    const raw = 'Hoang de Quang Trung dai pha quan Thanh tai Ngoc Hoi Dong Da nam 1789.';
    const fullNormalized = normalizeText(raw);
    expect(fullNormalized).toContain('Quang Trung');
    expect(fullNormalized).toContain('Ngọc Hồi');
    expect(fullNormalized).toContain('Đống Đa');
  });
});
