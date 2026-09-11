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

    it('accurately cleans compound greeting and bot inquiries from historical entity question', () => {
      const r = classifyChatIntent(
        'bạn là ai? bạn có thể giúp được gì cho tôi? phạm vi trợ giúp đến đâu? bạn có biết Bác Hồ là ai không?'
      );
      expect(r.intent).toBe('ENTITY_IDENTITY');
      expect(r.matchedEntityId).toBe('person_ho_chi_minh');
      expect(r.matchedCanonicalName).toBe('Hồ Chí Minh');
      expect(r.signals?.hasChitchatGreeting).toBe(true);
      expect(r.cleanSearchTopic).toBe('Bác Hồ là ai');
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

  describe('Multi-Intent Resolution & Surgical Cleansing', () => {
    it('handles compound greeting + entity identity inquiry with surgical cleansing', () => {
      const r = classifyChatIntent('hello, bạn là ai? và bạn có thể cho tôi biết Bác Hồ là ai không?');
      expect(r.intent).toBe('ENTITY_IDENTITY');
      expect(r.matchedCanonicalName).toBe('Hồ Chí Minh');
      expect(r.signals?.hasChitchatGreeting).toBe(true);
      expect(r.cleanSearchTopic).toBe('Bác Hồ là ai');
    });

    it('handles natural compound greeting + capability inquiry with "tới đâu" + entity inquiry', () => {
      const r = classifyChatIntent(
        'hello, bạn là ai? bạn có thể giúp được gì cho tôi? phạm vi trợ giúp tới đâu? và bạn có biết Bác Hồ là ai không?'
      );
      expect(r.intent).toBe('ENTITY_IDENTITY');
      expect(r.matchedCanonicalName).toBe('Hồ Chí Minh');
      expect(r.matchedEntityId).toBe('person_ho_chi_minh');
      expect(r.signals?.hasChitchatGreeting).toBe(true);
      expect(r.cleanSearchTopic).toBe('Bác Hồ là ai');
      expect(r.compositeResult?.hasGreetingOrIdentity).toBe(true);
      expect(r.compositeResult?.hasHistoricalInquiry).toBe(true);
      expect(r.videoHandover?.primaryEntityId).toBe('person_ho_chi_minh');
      expect(r.videoHandover?.topic).toBe('Bác Hồ là ai');
    });

    it('handles compound historical inquiry + video production request', () => {
      const r = classifyChatIntent('Tóm tắt trận Điện Biên Phủ và tạo video giúp tôi');
      expect(r.intent).toBe('HISTORICAL_QUERY');
      expect(r.signals?.hasVideoGeneration).toBe(true);
      expect(r.cleanSearchTopic).toBe('Tóm tắt trận Điện Biên Phủ');
      expect(r.videoBriefTopic).toBe('Tóm tắt trận Điện Biên Phủ');
    });

    it('handles compound historical query + secondary out-of-domain request', () => {
      const r = classifyChatIntent('Vua Quang Trung mất năm nào, và nhân tiện chỉ tôi nấu phở bò');
      expect(r.intent).toBe('HISTORICAL_QUERY');
      expect(r.subIntent).toBe('FACTOID_LOOKUP');
      expect(r.signals?.hasOutOfDomainTopic).toBe(true);
      expect(r.cleanSearchTopic).toBe('Vua Quang Trung mất năm nào');
      expect(r.outOfDomainTopic).toContain('nấu phở bò');
    });

    it('handles co-reference identity with isCoReferenceIdentity signal', () => {
      const r = classifyChatIntent('Quang Trung và Nguyễn Huệ có phải 2 anh em không?');
      expect(r.intent).toBe('ENTITY_IDENTITY');
      expect(r.matchedCanonicalName).toBe('Quang Trung');
      expect(r.signals?.isCoReferenceIdentity).toBe(true);
    });

    it('handles pleasantry prefix with co-reference query', () => {
      const r = classifyChatIntent('Chào bot, Quang Trung và Nguyễn Huệ là ai?');
      expect(r.intent).toBe('ENTITY_IDENTITY');
      expect(r.matchedCanonicalName).toBe('Quang Trung');
      expect(r.signals?.hasChitchatGreeting).toBe(true);
      expect(r.signals?.isCoReferenceIdentity).toBe(true);
    });
  });

  describe('Kinship Disambiguation & Speculative Semantic Arbitration Triggering', () => {
    it('does not falsely classify kinship inquiries with "anh" or "em" as CHITCHAT', () => {
      const r1 = classifyChatIntent('Lê Lợi và Lê Độ có phải là 2 anh em hay không?');
      expect(r1.intent).toBe('HISTORICAL_QUERY');
      expect(r1.subIntent).toBe('GENEALOGY_RELATION');

      const r2 = classifyChatIntent('Nguyễn Huệ và Nguyễn Nhạc là 2 anh em ruột phải không?');
      expect(r2.intent).toBe('HISTORICAL_QUERY');
      expect(r2.subIntent).toBe('GENEALOGY_RELATION');

      const r3 = classifyChatIntent('Trần Quốc Thao và Trần Quốc Thảo có phải là hai anh em không?');
      expect(r3.intent).toBe('HISTORICAL_QUERY');
      expect(r3.subIntent).toBe('GENEALOGY_RELATION');
      expect(r3.needsSemanticArbitration).toBe(true);

      const r4 = classifyChatIntent('Hai người đó có phải là anh em ruột không?');
      expect(r4.intent).toBe('HISTORICAL_QUERY');
      expect(r4.subIntent).toBe('GENEALOGY_RELATION');
      expect(r4.needsSemanticArbitration).toBe(true);
    });

    it('identifies unindexed or fictitious entity inquiries and flags for semantic arbitration', () => {
      const r1 = classifyChatIntent('Lê Độ là ai?');
      expect(r1.intent).toBe('HISTORICAL_QUERY');
      expect(r1.subIntent).toBe('FACTOID_LOOKUP');
      expect(r1.needsSemanticArbitration).toBe(true);

      const r2 = classifyChatIntent('Trần Quốc Thao là ai?');
      expect(r2.intent).toBe('HISTORICAL_QUERY');
      expect(r2.subIntent).toBe('FACTOID_LOOKUP');
      expect(r2.needsSemanticArbitration).toBe(true);
    });

    it('distinguishes genuine conversational address from kinship terms', () => {
      const r1 = classifyChatIntent('anh ơi cho em hỏi');
      expect(r1.intent).toBe('CHITCHAT');

      const r2 = classifyChatIntent('em ơi bạn tên gì');
      expect(r2.intent).toBe('CHITCHAT');

      const r3 = classifyChatIntent('chào anh nhé');
      expect(r3.intent).toBe('CHITCHAT');
    });

    it('handles casual remarks without question structure as CHITCHAT', () => {
      const r1 = classifyChatIntent('hôm nay trời đẹp ghê');
      expect(r1.intent).toBe('CHITCHAT');

      const r2 = classifyChatIntent('nhà lên giá nhiều quá');
      expect(r2.intent).toBe('CHITCHAT');

      const r3 = classifyChatIntent('mệt mỏi quá đi ngủ đây');
      expect(r3.intent).toBe('CHITCHAT');
    });

    it('preserves multi-part substantive questions without preambles in cleanSearchTopic', () => {
      const q = 'ông có tất cả bao nhiêu cái tên/biệt danh? và từng cái tương ứng với những giai đoạn lịch sử nào?';
      const r = classifyChatIntent(q);
      expect(r.intent).toBe('HISTORICAL_QUERY');
      expect(r.signals?.hasChitchatGreeting).toBe(false);
      // Punctuation is normalized, but core content across both clauses is fully preserved
      expect(r.cleanSearchTopic).toContain('ông có tất cả bao nhiêu cái tên/biệt danh');
      expect(r.cleanSearchTopic).toContain('tương ứng với những giai đoạn lịch sử nào');
    });
  });
});


