import { describe, it, expect } from 'vitest';
import { classifyChatIntent } from '../chat/intent-classifier.js';

describe('Intent Classifier & Fast-Path Router', () => {
  describe('Out-of-Domain Fast-Path', () => {
    it('classifies cooking and recipe questions as OUT_OF_DOMAIN with confidence >= 0.95', () => {
      const r1 = classifyChatIntent(
        'Hướng dẫn tôi cách làm món bánh mì nướng bơ tỏi bằng nồi chiên không dầu ngon nhất.'
      );
      expect(r1.intent).toBe('OUT_OF_DOMAIN');
      expect(r1.confidence).toBeGreaterThanOrEqual(0.95);
      expect(r1.fastPathResponse).toBeDefined();
      expect(r1.fastPathResponse).toContain('ngoài phạm vi');
      expect(r1.fastPathResponse).toContain('Lịch sử Việt Nam');

      const r2 = classifyChatIntent('Công thức nấu ăn món thịt kho tàu chuẩn vị miền Bắc?');
      expect(r2.intent).toBe('OUT_OF_DOMAIN');
    });

    it('classifies stock market and financial trading questions as OUT_OF_DOMAIN with confidence >= 0.95', () => {
      const r1 = classifyChatIntent(
        'Hôm nay mã cổ phiếu VNM có nên mua vào không, phân tích kỹ thuật giúp tôi với.'
      );
      expect(r1.intent).toBe('OUT_OF_DOMAIN');
      expect(r1.confidence).toBeGreaterThanOrEqual(0.95);
      expect(r1.fastPathResponse).toContain('ngoài phạm vi');

      const r2 = classifyChatIntent('Có nên đầu tư tài chính vào Bitcoin tiền ảo thời điểm này không?');
      expect(r2.intent).toBe('OUT_OF_DOMAIN');
    });

    it('classifies generic programming inquiries as OUT_OF_DOMAIN', () => {
      const r = classifyChatIntent('Hướng dẫn cách viết code python tạo bot discord.');
      expect(r.intent).toBe('OUT_OF_DOMAIN');
    });
  });

  describe('Chitchat and Compound Greetings', () => {
    it('classifies compound greetings as CHITCHAT', () => {
      const r1 = classifyChatIntent('Xin chào bạn, bạn là ai và có thể giúp gì cho tôi?');
      expect(r1.intent).toBe('CHITCHAT');
      expect(r1.fastPathResponse).toBeDefined();
      expect(r1.fastPathResponse).toContain('ChronoViet');
    });

    it('classifies system capabilities questions as CHITCHAT', () => {
      const r1 = classifyChatIntent('Hệ thống ChronoViet có những tính năng gì đặc biệt?');
      expect(r1.intent).toBe('CHITCHAT');
      expect(r1.fastPathResponse).toBeDefined();

      const r2 = classifyChatIntent('Bạn có thể làm được gì?');
      expect(r2.intent).toBe('CHITCHAT');
    });

    it('classifies simple greetings as CHITCHAT', () => {
      expect(classifyChatIntent('Xin chào').intent).toBe('CHITCHAT');
      expect(classifyChatIntent('Hello bot').intent).toBe('CHITCHAT');
      expect(classifyChatIntent('Cảm ơn bạn nhé').intent).toBe('CHITCHAT');
      expect(classifyChatIntent('Tạm biệt!').intent).toBe('CHITCHAT');
    });
  });

  describe('Video Creation Intent', () => {
    it('classifies video production prompts as VIDEO_INTENT', () => {
      const r1 = classifyChatIntent('Tạo video về Chiến thắng Bạch Đằng năm 938');
      expect(r1.intent).toBe('VIDEO_INTENT');
      expect(r1.suggestedTopic).toContain('Chiến thắng Bạch Đằng');

      const r2 = classifyChatIntent('Hãy làm một video 3 phút về cuộc đời Trần Hưng Đạo');
      expect(r2.intent).toBe('VIDEO_INTENT');
    });
  });

  describe('Historical Entity Disambiguation and Anti-Sycophancy', () => {
    it('recognizes same-person aliases as ENTITY_IDENTITY with confirmation', () => {
      const r = classifyChatIntent('Quang Trung và Nguyễn Huệ là ai?');
      expect(r.intent).toBe('ENTITY_IDENTITY');
      expect(r.fastPathResponse).toContain('CÙNG MỘT NHÂN VẬT LỊCH SỬ');
    });

    it('recognizes single entity identity questions', () => {
      const r = classifyChatIntent('Ngô Quyền là ai?');
      expect(r.intent).toBe('ENTITY_IDENTITY');
      expect(r.matchedCanonicalName).toBe('Ngô Quyền');
    });
  });

  describe('Historical Query Default', () => {
    it('defaults standard historical inquiries to HISTORICAL_QUERY', () => {
      const r = classifyChatIntent('Kế sách cắm cọc gỗ trên sông Bạch Đằng được triển khai ra sao?');
      expect(r.intent).toBe('HISTORICAL_QUERY');
    });
  });
});
