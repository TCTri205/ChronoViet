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

    it('distinguishes distinct brother entities without false co-reference flag', () => {
      const result = analyzePremiseAndLeadingIntent('Nguyễn Nhạc và Nguyễn Huệ là 2 anh em hả?');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.isSameEntityCoReference).toBeUndefined();
      expect(result.suggestedDirective).toContain('Cả hai nhân vật đều có thật trong lịch sử');
    });

    it('injects strict anti-hallucination directive when one entity is unverified/unknown', () => {
      const result = analyzePremiseAndLeadingIntent('Lê Lợi và Lê Độ có phải là 2 anh em hay không?');
      expect(result.isLeadingQuestion).toBe(true);
      expect(result.detectedEntities).toContain('Lê Lợi');
      expect(result.detectedEntities).toContain('Lê Độ');
      expect(result.suggestedDirective).toContain('KHÔNG CÓ trong chính sử Việt Nam với tư cách thân tộc');
      expect(result.suggestedDirective).toContain('TUYỆT ĐỐI KHÔNG phỏng đoán');
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
  });
});
