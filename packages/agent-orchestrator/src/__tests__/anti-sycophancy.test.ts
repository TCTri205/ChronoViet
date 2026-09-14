import { describe, it, expect } from 'vitest';
import {
  analyzePremiseAndLeadingIntent,
  verifyCoReferenceInvariant,
} from '../guardrails/anti-sycophancy.js';

describe('Anti-Sycophancy & Invariant Semantic Verification', () => {
  describe('analyzePremiseAndLeadingIntent', () => {
    it('detects co-reference aliases of the same person and provides immunization directives', () => {
      const result = analyzePremiseAndLeadingIntent('Quang Trung và Nguyễn Huệ có phải là 2 anh em không?');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.isSameEntityCoReference).toBe(true);
      expect(result.detectedEntities).toContain('Quang Trung');
      expect(result.detectedEntities).toContain('Nguyễn Huệ');
      expect(result.suggestedDirective).toContain('CÙNG MỘT NHÂN VẬT LỊCH SỬ');
      expect(result.suggestedDirective).toContain('anh em cột chèo');
      expect(result.suggestedDirective).toContain('Tây Sơn tam kiệt');
    });

    it('distinguishes distinct brother entities without false co-reference flag and generates objective kinship directive', () => {
      const result = analyzePremiseAndLeadingIntent('Nguyễn Nhạc và Nguyễn Huệ là 2 anh em hả?');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.isSameEntityCoReference).toBeUndefined();
      expect(result.suggestedDirective).toContain('Cả hai nhân vật đều có thật trong lịch sử');
      expect(result.suggestedDirective).toContain('KIỂM CHỨNG QUAN HỆ LỊCH SỬ KHÁCH QUAN');
      expect(result.suggestedDirective).toContain('Tây Sơn Tam Kiệt');
    });

    it('injects strict anti-hallucination directive when one entity is unverified/unknown', () => {
      const result = analyzePremiseAndLeadingIntent('Lê Lợi và Lê Văn Ảo có phải là 2 anh em hay không?');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.detectedEntities).toContain('Lê Lợi');
      expect(result.detectedEntities).toContain('Lê Văn Ảo');
      expect(result.suggestedDirective).toContain('KHÔNG CÓ trong chính sử Việt Nam với tư cách thân tộc');
      expect(result.suggestedDirective).toContain('TUYỆT ĐỐI KHÔNG phỏng đoán');
    });

    it('recognizes both entities as real historical figures across different eras and mandates chronological kinship refutation', () => {
      const result = analyzePremiseAndLeadingIntent('Lê Lợi và Lê Độ có phải là 2 anh em hay không?');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.detectedEntities).toContain('Lê Lợi');
      expect(result.detectedEntities).toContain('Lê Độ');
      expect(result.suggestedDirective).toContain('Cả hai nhân vật đều có thật trong lịch sử');
      expect(result.suggestedDirective).toContain('BẮT BUỘC BÁC BỎ TIỀN ĐỀ QUAN HỆ THÂN TỘC DO KHÁC BIỆT THỜI ĐẠI');
      expect(result.suggestedDirective).toContain('sống cách nhau hơn');
    });

    it('clarifies ancestor-descendant dynastic lineage when figures belong to the same dynasty across eras', () => {
      const result = analyzePremiseAndLeadingIntent('Vua Lý Thái Tổ và vua Lý Huệ Tông có quan hệ huyết thống dòng tộc thế nào?');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.suggestedDirective).toContain('LÀM RÕ QUAN HỆ TỔ TIÊN - HẬU DUỆ & KHÁC BIỆT THẾ HỆ');
      expect(result.suggestedDirective).toContain('Nhà Lý');
      expect(result.suggestedDirective).toContain('tổ tiên - hậu duệ');
    });

    it('preserves open historical investigation for figures not yet in master dictionary instead of blind kinship dismissal', () => {
      const result = analyzePremiseAndLeadingIntent('Trần Bình Trọng và Trần Quốc Toản có quan hệ như thế nào?');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.suggestedDirective).toContain('ĐỐI CHIẾU KIỂM CHỨNG TƯ LIỆU CHÍNH SỬ VỚI NHÂN VẬT THỨ HAI');
      expect(result.suggestedDirective).toContain('Trần Quốc Toản');
      expect(result.suggestedDirective).toContain('Trần Bình Trọng');
    });

    it('triggers declarative misconception directive for Gia Long and Nguyễn Ánh without hardcoded entityId branches', () => {
      const result = analyzePremiseAndLeadingIntent('Gia Long và Nguyễn Ánh có phải là 2 anh em cột chèo không?');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.isSameEntityCoReference).toBe(true);
      expect(result.suggestedDirective).toContain('CÙNG MỘT NHÂN VẬT LỊCH SỬ');
      expect(result.suggestedDirective).toContain('anh em cột chèo');
    });

    it('detects co-reference inside battle and event inquiries with multiple entities and sets questionType to EVENT', () => {
      const result = analyzePremiseAndLeadingIntent(
        'Trong chiến dịch Ngọc Hồi - Đống Đa, Nguyễn Huệ và Quang Trung đã cùng chỉ huy quân Tây Sơn như thế nào?'
      );
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.isSameEntityCoReference).toBe(true);
      expect(result.questionType).toBe('EVENT');
      expect(result.detectedEntities).toContain('Nguyễn Huệ');
      expect(result.detectedEntities).toContain('Quang Trung');
      expect(result.suggestedDirective).toContain('ĐÍNH CHÍNH DANH TÍNH CÙNG MỘT NGƯỜI TRONG SỰ KIỆN LỊCH SỬ');
      expect(result.suggestedDirective).toContain('VAI TRÒ THỐNG SOÁI DUY NHẤT');
    });

    it('injects ground-truth siblings as counter-evidence when rejecting an unverified family relation', () => {
      const result = analyzePremiseAndLeadingIntent('Lê Lợi và Lê Văn Tèo có phải là hai anh em ruột không?');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.suggestedDirective).toContain('Lê Học');
      expect(result.suggestedDirective).toContain('Lê Trừ');
    });
  });

  describe('verifyCoReferenceInvariant', () => {
    it('accepts correct non-contradictory historical descriptions', () => {
      const response = 'Quang Trung và Nguyễn Huệ thực chất là cùng một vị vua của nhà Tây Sơn. Ông tên thật là Hồ Thơm, sau đổi thành Nguyễn Huệ và lên ngôi lấy niên hiệu Quang Trung.';
      const res = verifyCoReferenceInvariant(response, 'Quang Trung', 'Nguyễn Huệ', 'Quang Trung');
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBe(response);
    });

    it('detects and sanitizes contradictory statements asserting co-referent aliases are 2 brothers', () => {
      const response = 'Theo một số nguồn, Quang Trung và Nguyễn Huệ là 2 anh em cùng tham gia phong trào Tây Sơn.';
      const res = verifyCoReferenceInvariant(response, 'Quang Trung', 'Nguyễn Huệ', 'Quang Trung');
      expect(res.isValid).toBe(false);
      expect(res.violation).toContain('Contradictory bilateral relation');
      expect(res.sanitized).toContain('cùng một nhân vật lịch sử (Quang Trung)');
    });

    it('detects and sanitizes false "anh em cột chèo" assertion between same-person aliases', () => {
      const response = 'Một quan điểm khác cho rằng Quang Trung và Nguyễn Huệ là hai người anh em cột chèo với nhau.';
      const res = verifyCoReferenceInvariant(response, 'Quang Trung', 'Nguyễn Huệ', 'Quang Trung');
      expect(res.isValid).toBe(false);
      expect(res.sanitized).toContain('cùng một nhân vật lịch sử (Quang Trung)');
    });

    it('detects and sanitizes contradictory pronoun claims such as "Họ là cha con"', () => {
      const response = 'Quang Trung và Nguyễn Huệ là cùng một người. Họ là cha con, không có quan hệ huyết thống với nhau.';
      const res = verifyCoReferenceInvariant(response, 'Quang Trung', 'Nguyễn Huệ', 'Quang Trung');
      expect(res.isValid).toBe(false);
      expect(res.violation).toContain('Contradictory pronoun kinship assertion');
      expect(res.sanitized).not.toContain('Họ là cha con');
    });

    it('detects and repairs sibling misattributed as child (Nguyễn Nhạc, Nguyễn Lữ)', () => {
      const response = 'Quang Trung là cha của Nguyễn Nhạc, Nguyễn Lữ và nhiều người khác.';
      const res = verifyCoReferenceInvariant(response, 'Quang Trung', 'Nguyễn Huệ', 'Quang Trung');
      expect(res.isValid).toBe(false);
      expect(res.violation).toContain('Sibling');
      expect(res.sanitized).toContain('có anh/em ruột được chính sử ghi nhận là Nguyễn Nhạc, Nguyễn Lữ');
    });

    it('preserves valid historical facts mentioning "anh em cột chèo" between Nguyễn Huệ and Nguyễn Ánh (zero censorship)', () => {
      const validText = 'Trong lịch sử, Nguyễn Huệ và Nguyễn Ánh là anh em cột chèo vì cùng kết duyên với hai nàng công chúa con vua Lê Hiển Tông.';
      const res = verifyCoReferenceInvariant(validText, 'Quang Trung', 'Nguyễn Huệ', 'Quang Trung');
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBe(validText);
    });

    it('preserves valid historical facts mentioning "hai anh em ruột" between Nguyễn Nhạc and Nguyễn Huệ (zero censorship)', () => {
      const validText = 'Nguyễn Nhạc và Nguyễn Huệ là hai anh em ruột trong phong trào Tây Sơn tam kiệt.';
      const res = verifyCoReferenceInvariant(validText, 'Quang Trung', 'Nguyễn Huệ', 'Quang Trung');
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBe(validText);
    });

    it('preserves valid negative statements refuting kinship without corrupting negation clause', () => {
      const negativeSentence = 'Nhiều người lầm tưởng rằng Đinh Tiên Hoàng là con trai của Đinh Bộ Lĩnh nhưng thực tế không phải vậy.';
      const res = verifyCoReferenceInvariant(negativeSentence, 'Đinh Tiên Hoàng', 'Đinh Bộ Lĩnh', 'Đinh Tiên Hoàng');
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBe(negativeSentence);
    });

    it('does not misattribute father as sibling when father is the explicit subject', () => {
      const fatherSentence = 'Hồ Phi Phúc là cha của Nguyễn Nhạc, Nguyễn Huệ và Nguyễn Lữ.';
      const res = verifyCoReferenceInvariant(fatherSentence, 'Quang Trung', 'Nguyễn Huệ', 'Quang Trung');
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBe(fatherSentence);
    });
  });

  describe('lowercase proper noun extraction', () => {
    it('successfully extracts lowercase candidates matching Vietnamese surnames', () => {
      const result = analyzePremiseAndLeadingIntent('le loi va le van teo co phai 2 anh em khong');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.detectedEntities.some((e) => e.toLowerCase().includes('le van teo'))).toBe(true);
    });
  });
});
