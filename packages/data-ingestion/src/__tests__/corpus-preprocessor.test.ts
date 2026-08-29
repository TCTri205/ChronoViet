import { describe, it, expect } from 'vitest';
import {
  normalizeEncodingAndGlyphs,
  unwrapGuardedSoftWraps,
  fixInternalCasingErrors,
  separateGluedWordsAndNumbers,
  normalizePunctuationSpacing,
  healSplitSyllablesWithLexicon,
  normalizeHyphenatedVietnameseWords,
  cleanMediaWikiRemnants,
  unwrapBrokenOcrTables,
  mergeAdjacentSplitHeadings,
  normalizePipedWatermarks,
  cleanWoodblockPageMarkers,
  cleanFootnotesAndSuperscripts,
  demoteDialoguePseudoHeadings,
  filterAnnualWikiNoise,
  preprocessCorpusDocument,
} from '../text/corpus-preprocessor.js';

describe('Layer 0 Corpus Preprocessor & Normalization Engine', () => {
  describe('normalizeEncodingAndGlyphs', () => {
    it('normalizes legacy OCR transliterations (ñ, Ñ, ð, Ð) to standard Vietnamese đ/Đ', () => {
      const input = 'ñược vua phong, ðặng hầu tước, ñiều binh khiển tướng, ñề ra chính sách';
      const output = normalizeEncodingAndGlyphs(input);
      expect(output).toContain('được vua phong');
      expect(output).toContain('Đặng hầu tước');
      expect(output).toContain('điều binh khiển tướng');
      expect(output).toContain('đề ra chính sách');
    });

    it('maps CJK fullwidth punctuation to standard ASCII and removes zero-width characters', () => {
      const input = 'Quân ta tiến công\u200B，quân địch rút chạy\uFEFF。Tại sao？Nguy cấp！';
      const output = normalizeEncodingAndGlyphs(input);
      expect(output).toBe('Quân ta tiến công, quân địch rút chạy. Tại sao? Nguy cấp!');
    });
  });

  describe('unwrapGuardedSoftWraps', () => {
    it('unwraps soft-wrapped lines while strictly guarding markdown headers and lists', () => {
      const input = [
        '# Chương 1',
        'Vua Quang Trung tiến quân ra',
        'Bắc đánh tan 29 vạn',
        'quân Thanh.',
        '',
        '* Mục 1',
        '* Mục 2',
      ].join('\n');

      const output = unwrapGuardedSoftWraps(input);
      expect(output).toContain('# Chương 1');
      expect(output).toContain('Vua Quang Trung tiến quân ra Bắc đánh tan 29 vạn quân Thanh.');
      expect(output).toContain('* Mục 1\n* Mục 2');
    });
  });

  describe('fixInternalCasingErrors', () => {
    it('repairs OCR mid-word casing errors without damaging proper nouns', () => {
      const input = 'khôNg có gì lạ khi LInh và CÙ Thị bàn về thế Kỷ 18';
      const output = fixInternalCasingErrors(input);
      expect(output).toContain('không có gì lạ');
      expect(output).toContain('Linh');
      expect(output).toContain('Cù Thị');
      expect(output).toContain('thế kỷ 18');
    });
  });

  describe('separateGluedWordsAndNumbers', () => {
    it('separates glued numbers and conjunctions', () => {
      const input = 'Vào năm1973 và tháng12 ngày30 tờ8b trang29 vàđem quân';
      const output = separateGluedWordsAndNumbers(input);
      expect(output).toBe('Vào năm 1973 và tháng 12 ngày 30 tờ 8b trang 29 và đem quân');
    });
  });

  describe('healSplitSyllablesWithLexicon', () => {
    it('repairs 3-token and 2-token split syllables', () => {
      const input = 'v ươ ng triều tr ư ớc có người tài là Nguy ễn Trãi';
      const output = healSplitSyllablesWithLexicon(input);
      expect(output).toContain('vương triều');
      expect(output).toContain('trước có');
      expect(output).toContain('người tài');
      expect(output).toContain('Nguyễn Trãi');
    });

    it('protects valid standalone single-letter words from greedy merge', () => {
      const input = 'viên a bảo rằng ả họ Đặng e rằng y như lời sấm truyền';
      const output = healSplitSyllablesWithLexicon(input);
      expect(output).toBe('viên a bảo rằng ả họ Đặng e rằng y như lời sấm truyền');
    });
  });

  describe('normalizeHyphenatedVietnameseWords', () => {
    it('un-hyphenates multi-part proper names and compounds', () => {
      const input = 'Chu-Thành-Vương phong cho Kinh-Lược-Chiêu-Thảo-Sứ Triệu-Đà thông-ngôn năm Kỷ-sửu';
      const output = normalizeHyphenatedVietnameseWords(input);
      expect(output).toContain('Chu Thành Vương');
      expect(output).toContain('Kinh Lược Chiêu Thảo Sứ');
      expect(output).toContain('Triệu Đà');
      expect(output).toContain('thông ngôn');
      expect(output).toContain('Kỷ sửu');
    });

    it('strictly preserves military codes and numeric date ranges in whitelist', () => {
      const input = 'Chiến dịch 1954-1975 sử dụng máy bay B-52, B-52G, MiG-21 và súng AK-47';
      const output = normalizeHyphenatedVietnameseWords(input);
      expect(output).toContain('1954-1975');
      expect(output).toContain('B-52');
      expect(output).toContain('B-52G');
      expect(output).toContain('MiG-21');
      expect(output).toContain('AK-47');
    });
  });

  describe('cleanWoodblockPageMarkers (Strict Mộc Bản Regex)', () => {
    it('removes woodblock page markers across variants', () => {
      const input = 'Đoạn sử này [1a] chép rõ **[18a]** sự việc [tờ 8b] và [tờ** **8b].';
      const output = cleanWoodblockPageMarkers(input);
      expect(output).not.toContain('[1a]');
      expect(output).not.toContain('**[18a]**');
      expect(output).not.toContain('[tờ 8b]');
    });

    it('strictly preserves Gregorian calendar years in brackets and bracketed editorial names', () => {
      const input = 'Năm [40] Hai Bà Trưng khởi nghĩa. Năm [938] Ngô Quyền đại thắng. Vua [An Dương Vương] cùng [Triệu] Việt Vương.';
      const output = cleanWoodblockPageMarkers(input);
      expect(output).toContain('[40]');
      expect(output).toContain('[938]');
      expect(output).toContain('[An Dương Vương]');
      expect(output).toContain('[Triệu] Việt Vương');
    });
  });

  describe('cleanFootnotesAndSuperscripts', () => {
    it('strips punctuation-adjacent footnote superscripts without eating punctuation', () => {
      const input = 'Theo Kinh Dịch¹., điều đó không¹?".';
      const output = cleanFootnotesAndSuperscripts(input);
      expect(output).toBe('Theo Kinh Dịch., điều đó không?".');
    });
  });

  describe('unwrapBrokenOcrTables', () => {
    it('unwraps broken OCR pipe table lines into continuous prose', () => {
      const input = '|thư|Lạc cáo||||\n|Tức đất ba châu...|';
      const output = unwrapBrokenOcrTables(input);
      expect(output).toContain('thư Lạc cáo');
      expect(output).toContain('Tức đất ba châu...');
    });
  });

  describe('filterAnnualWikiNoise', () => {
    it('filters Nobel sections and keeps domestic historical events and Vietnamese figures', () => {
      const input = [
        '== Sự kiện ==',
        '* 7 tháng 5: Chiến dịch Điện Biên Phủ toàn thắng.',
        '* 21 tháng 7: Ký kết Hiệp định Genève về Đông Dương.',
        '* 15 tháng 8: Lễ trao giải Oscar lần thứ 26 diễn ra tại Hollywood.',
        '== Giải Nobel ==',
        '* Giải Nobel Hòa bình: UNHCR.',
        '== Sinh ==',
        '* 10 tháng 2: Nguyễn Văn A, nhà thơ Việt Nam.',
        '* 15 tháng 3: John Smith, vận động viên bóng bầu dục Mỹ.',
      ].join('\n');

      const output = filterAnnualWikiNoise(input, '1954.md');
      expect(output).toContain('Điện Biên Phủ');
      expect(output).toContain('Hiệp định Genève');
      expect(output).not.toContain('Giải Nobel');
      expect(output).not.toContain('Oscar');
      expect(output).toContain('Nguyễn Văn A');
      expect(output).not.toContain('John Smith');
    });
  });

  describe('preprocessCorpusDocument Master Pipeline', () => {
    it('executes full pipeline with quality score >= 99.5%', () => {
      const rawText = [
        '# Đại Việt Sử Ký',
        'Vào năm 1973 [tờ 8b], quân ta ñược lệnh tiến quân v ươ ng triều.',
        'Chu-Thành-Vương ra lệnh cho Tiết-độ-sứ.',
        'Năm [938] Ngô Quyền đại thắng trên sông Bạch Đằng.',
      ].join('\n');

      const result = preprocessCorpusDocument(rawText, { isChronicle: true });
      expect(result.qualityScore).toBeGreaterThanOrEqual(99.5);
      expect(result.cleanedText).toContain('được lệnh');
      expect(result.cleanedText).toContain('vương triều');
      expect(result.cleanedText).toContain('Chu Thành Vương');
      expect(result.cleanedText).toContain('Tiết độ sứ');
      expect(result.cleanedText).toContain('[938]');
      expect(result.cleanedText).not.toContain('[tờ 8b]');
    });
  });
});
