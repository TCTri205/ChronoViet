import { describe, it, expect } from 'vitest';
import { numberToVietnameseWords, normalizeVietnameseTextForSpeech } from '../tts/text-normalizer.js';

describe('Vietnamese Text Normalizer & Number Expander', () => {
  it('correctly converts numbers to Vietnamese spoken words', () => {
    expect(numberToVietnameseWords(0)).toBe('không');
    expect(numberToVietnameseWords(5)).toBe('năm');
    expect(numberToVietnameseWords(15)).toBe('mười lăm');
    expect(numberToVietnameseWords(21)).toBe('hai mươi mốt');
    expect(numberToVietnameseWords(24)).toBe('hai mươi tư');
    expect(numberToVietnameseWords(25)).toBe('hai mươi lăm');
    expect(numberToVietnameseWords(105)).toBe('một trăm lẻ năm');
    expect(numberToVietnameseWords(938)).toBe('chín trăm ba mươi tám');
    expect(numberToVietnameseWords(1010)).toBe('một nghìn không trăm mười');
    expect(numberToVietnameseWords(1288)).toBe('một nghìn hai trăm tám mươi tám');
    expect(numberToVietnameseWords(1789)).toBe('một nghìn bảy trăm tám mươi chín');
    expect(numberToVietnameseWords(1975)).toBe('một nghìn chín trăm bảy mươi lăm');
  });

  it('normalizes historical centuries and years for speech', () => {
    expect(normalizeVietnameseTextForSpeech('Trận Bạch Đằng năm 938')).toBe('Trận Bạch Đằng năm chín trăm ba mươi tám');
    expect(normalizeVietnameseTextForSpeech('Đại thắng Mùa Xuân năm 1975')).toBe('Đại thắng Mùa Xuân năm một nghìn chín trăm bảy mươi lăm');
    expect(normalizeVietnameseTextForSpeech('Vào thế kỷ XIII, nhà Trần ba lần đánh tan quân Nguyên Mông'))
      .toBe('Vào thế kỷ mười ba, nhà Trần ba lần đánh tan quân Nguyên Mông');
    expect(normalizeVietnameseTextForSpeech('Chiến thắng năm 1789 của Quang Trung'))
      .toBe('Chiến thắng năm một nghìn bảy trăm tám mươi chín của Quang Trung');
    expect(normalizeVietnameseTextForSpeech('Năm 257 TCN, Thục Phán lập nước Âu Lạc'))
      .toBe('Năm hai trăm năm mươi bảy trước Công nguyên, Thục Phán lập nước Âu Lạc');
    expect(normalizeVietnameseTextForSpeech('Di tích tại TP. Hà Nội và TX. Sơn Tây'))
      .toBe('Di tích tại thành phố Hà Nội và thị xã Sơn Tây');
    expect(normalizeVietnameseTextForSpeech('Năm 111 tr.CN nhà Triệu thất thủ'))
      .toBe('Năm một trăm mười một trước Công nguyên nhà Triệu thất thủ');
  });
});

