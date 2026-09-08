import { describe, it, expect } from 'vitest';
import { classifyChatIntent } from '../chat/intent-classifier.js';

describe('Intent Classifier & Fast-Path Router', () => {
  describe('Out-of-Domain Detection', () => {
    it('classifies cooking and recipe questions as OUT_OF_DOMAIN with confidence >= 0.95', () => {
      const r1 = classifyChatIntent(
        'Hướng dẫn tôi cách làm món bánh mì nướng bơ tỏi bằng nồi chiên không dầu ngon nhất.'
      );
      expect(r1.intent).toBe('OUT_OF_DOMAIN');
      expect(r1.confidence).toBeGreaterThanOrEqual(0.95);

      const r2 = classifyChatIntent('Công thức nấu ăn món thịt kho tàu chuẩn vị miền Bắc?');
      expect(r2.intent).toBe('OUT_OF_DOMAIN');
    });

    it('classifies stock market and financial trading questions as OUT_OF_DOMAIN with confidence >= 0.95', () => {
      const r1 = classifyChatIntent(
        'Hôm nay mã cổ phiếu VNM có nên mua vào không, phân tích kỹ thuật giúp tôi với.'
      );
      expect(r1.intent).toBe('OUT_OF_DOMAIN');
      expect(r1.confidence).toBeGreaterThanOrEqual(0.95);

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
    });

    it('classifies system capabilities questions as CHITCHAT', () => {
      const r1 = classifyChatIntent('Hệ thống ChronoViet có những tính năng gì đặc biệt?');
      expect(r1.intent).toBe('CHITCHAT');

      const r2 = classifyChatIntent('Bạn có thể làm được gì?');
      expect(r2.intent).toBe('CHITCHAT');

      const r3 = classifyChatIntent('phạm vi tra cứu của bạn như thế nào?');
      expect(r3.intent).toBe('CHITCHAT');

      const r4 = classifyChatIntent('bạn có thẻ giusp đuowcj gì cho tôi?');
      expect(r4.intent).toBe('CHITCHAT');
    });

    it('classifies simple greetings as CHITCHAT', () => {
      expect(classifyChatIntent('Xin chào').intent).toBe('CHITCHAT');
      expect(classifyChatIntent('Hello bot').intent).toBe('CHITCHAT');
      expect(classifyChatIntent('Cảm ơn bạn nhé').intent).toBe('CHITCHAT');
      expect(classifyChatIntent('Tạm biệt!').intent).toBe('CHITCHAT');
    });

    it('classifies typing error / Telex-sticky queries and unaccented variants as CHITCHAT', () => {
      // Real-world user scenario that triggered the issue
      const r1 = classifyChatIntent('hello, bạnlaf ai?');
      expect(r1.intent).toBe('CHITCHAT');
      expect(r1.confidence).toBeGreaterThanOrEqual(0.95);

      const r2 = classifyChatIntent('ban la ai');
      expect(r2.intent).toBe('CHITCHAT');

      const r3 = classifyChatIntent('bạn laf ai zậy');
      expect(r3.intent).toBe('CHITCHAT');

      const r4 = classifyChatIntent('cho mình hỏi botla ai the');
      expect(r4.intent).toBe('CHITCHAT');

      const r5 = classifyChatIntent('alo bot ơi');
      expect(r5.intent).toBe('CHITCHAT');

      const r6 = classifyChatIntent('who are you');
      expect(r6.intent).toBe('CHITCHAT');
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
      expect(r.matchedCanonicalName).toBe('Quang Trung');
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

    it('accurately identifies embedded entities in natural conversational questions', () => {
      const r1 = classifyChatIntent('kể về vua Lê Lợi cho tôi nghe');
      expect(r1.intent).toBe('HISTORICAL_QUERY');
      expect(r1.matchedCanonicalName).toBe('Lê Lợi');

      const r2 = classifyChatIntent('Nguyễn Huệ đã làm những gì cho tôi biết');
      expect(r2.intent).toBe('HISTORICAL_QUERY');
      expect(r2.matchedCanonicalName).toBe('Quang Trung');

      const r3 = classifyChatIntent('Trần Hưng Đạo đánh giặc nào');
      expect(r3.intent).toBe('HISTORICAL_QUERY');
      expect(r3.matchedCanonicalName).toBe('Trần Hưng Đạo');

      const r4 = classifyChatIntent('Thế kỷ V TCN có sự kiện gì quan trọng?');
      expect(r4.intent).toBe('HISTORICAL_QUERY');

      const r5 = classifyChatIntent('kể cho tôi nghe về lịch sử Việt Nam');
      expect(r5.intent).toBe('HISTORICAL_QUERY');
    });

    it('does not falsely trigger HISTORICAL_QUERY on non-historical quantities or modern phrases', () => {
      const r1 = classifyChatIntent('tôi có 500 câu hỏi về bạn');
      expect(r1.intent).toBe('CHITCHAT');

      const r2 = classifyChatIntent('nhà lên giá nhiều quá');
      expect(r2.intent).not.toBe('HISTORICAL_QUERY');
    });
  });
});
