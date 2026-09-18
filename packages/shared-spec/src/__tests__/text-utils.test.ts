import { describe, it, expect } from 'vitest';
import {
  removeVietnameseAccents,
  removeVietnameseTones,
  normalizeWhitespace,
  sanitizeSentenceBoundaries,
} from '../text-utils.js';

describe('Shared Spec - Text Normalization Utilities', () => {
  it('strips Vietnamese accents and converts đ/Đ to d/D', () => {
    expect(removeVietnameseAccents('Đại Việt Sử Ký Toàn Thư')).toBe('Dai Viet Su Ky Toan Thu');
    expect(removeVietnameseAccents('Trần Hưng Đạo')).toBe('Tran Hung Dao');
    expect(removeVietnameseAccents('')).toBe('');
  });

  it('provides removeVietnameseTones identical behavior', () => {
    expect(removeVietnameseTones('Ngô Quyền đánh quân Nam Hán')).toBe(
      removeVietnameseAccents('Ngô Quyền đánh quân Nam Hán')
    );
  });

  it('normalizes excessive whitespace', () => {
    expect(normalizeWhitespace('  Bạch   Đằng    Giang  ')).toBe('Bạch Đằng Giang');
    expect(normalizeWhitespace('\n\t Quang   Trung \n')).toBe('Quang Trung');
  });

  it('sanitizes sentence boundaries and excessive repetitive punctuation', () => {
    expect(sanitizeSentenceBoundaries('Chiến thắng Bạch Đằng???')).toBe('Chiến thắng Bạch Đằng?');
    expect(sanitizeSentenceBoundaries('Quân giặc khiếp sợ !!!')).toBe('Quân giặc khiếp sợ!');
  });
});
