import { describe, it, expect } from 'vitest';
import { numberToVietnameseWords, normalizeVietnameseTextForSpeech, alignSpokenWordTimestamps } from '../tts/text-normalizer.js';

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

  it('aligns multi-word spoken numbers and abbreviations to canonical raw text tokens', () => {
    const rawText = 'Năm 1789, Quang Trung';
    // 1 ("Năm") + 7 ("một", "nghìn", "bảy", "trăm", "tám", "mươi", "chín") + 2 ("Quang", "Trung") = 10 spoken words
    const spokenTimestamps = [
      { word: 'năm', startMs: 0, endMs: 250 },
      { word: 'một', startMs: 300, endMs: 500 },
      { word: 'nghìn', startMs: 500, endMs: 700 },
      { word: 'bảy', startMs: 700, endMs: 900 },
      { word: 'trăm', startMs: 900, endMs: 1100 },
      { word: 'tám', startMs: 1100, endMs: 1300 },
      { word: 'mươi', startMs: 1300, endMs: 1500 },
      { word: 'chín', startMs: 1500, endMs: 1800 },
      { word: 'quang', startMs: 2000, endMs: 2300 },
      { word: 'trung', startMs: 2300, endMs: 2600 },
    ];

    const aligned = alignSpokenWordTimestamps(rawText, spokenTimestamps, 30);
    expect(aligned).toHaveLength(4); // 'Năm', '1789,', 'Quang', 'Trung'
    expect(aligned[0].word).toBe('Năm');
    expect(aligned[0].startFrame).toBe(0); // 0s * 30
    expect(aligned[0].endFrame).toBe(8);   // 0.25s * 30

    // '1789,' should span from 'một' (300ms = 9 frames) to 'chín' (1800ms = 54 frames)
    expect(aligned[1].word).toBe('1789,');
    expect(aligned[1].startFrame).toBe(9);
    expect(aligned[1].endFrame).toBe(54);

    expect(aligned[2].word).toBe('Quang');
    expect(aligned[2].startFrame).toBe(60);
    expect(aligned[3].word).toBe('Trung');
    expect(aligned[3].startFrame).toBe(69);
  });

  it('correctly aligns multi-word Roman numeral century expressions like thế kỷ XIII', () => {
    const rawText = 'Vào thế kỷ XIII, nhà Trần';
    // 'Vào' (1) + 'thế' (1) + 'kỷ' (1) + 'mười ba' (2) + 'nhà' (1) + 'Trần' (1) = 7 spoken words
    const spokenTimestamps = [
      { word: 'vào', startMs: 0, endMs: 200 },
      { word: 'thế', startMs: 220, endMs: 400 },
      { word: 'kỷ', startMs: 420, endMs: 600 },
      { word: 'mười', startMs: 620, endMs: 800 },
      { word: 'ba', startMs: 820, endMs: 1000 },
      { word: 'nhà', startMs: 1050, endMs: 1250 },
      { word: 'trần', startMs: 1270, endMs: 1600 },
    ];

    const aligned = alignSpokenWordTimestamps(rawText, spokenTimestamps, 30);
    expect(aligned).toHaveLength(6); // 'Vào', 'thế', 'kỷ', 'XIII,', 'nhà', 'Trần'
    expect(aligned[0].word).toBe('Vào');
    expect(aligned[1].word).toBe('thế');
    expect(aligned[2].word).toBe('kỷ');
    expect(aligned[3].word).toBe('XIII,');
    // 'XIII,' should span across 'mười' (620ms -> 19 frames) and 'ba' (1000ms -> 30 frames)
    expect(aligned[3].startFrame).toBe(19);
    expect(aligned[3].endFrame).toBe(30);

    expect(aligned[4].word).toBe('nhà');
    expect(aligned[4].startFrame).toBe(32);
    expect(aligned[5].word).toBe('Trần');
    expect(aligned[5].startFrame).toBe(38);
    expect(aligned[5].endFrame).toBe(48);
  });
});


