import { describe, it, expect, vi } from 'vitest';
import {
  scriptwriterNode,
  sanitizeVoiceoverScript,
  synthesizeDeterministicHistoricalScript,
  getDomainChapterRoleGuidance,
} from '../graph/nodes/scriptwriter-node.js';
import { ChronoGraphState } from '../graph/state.js';

// Mock callLlm for deterministic testing
vi.mock('@chronoviet/infra', async (importOriginal) => {
  const original = await importOriginal<typeof import('@chronoviet/infra')>();
  return {
    ...original,
    callLlm: vi.fn().mockImplementation(async ({ messages }) => {
      return {
        content:
          'Chủ tịch Hồ Chí Minh đã cống hiến trọn đời mình cho sự nghiệp giải phóng dân tộc Việt Nam. Người ra đi tìm đường cứu nước từ bến cảng Nhà Rồng năm 1911 và dẫn dắt cách mạng đi tới thắng lợi vẻ vang.',
      };
    }),
  };
});

describe('Scriptwriter Node & Voiceover Sanitizer', () => {
  describe('sanitizeVoiceoverScript', () => {
    it('should strip speaker labels, code fences, and prompt instructions', () => {
      const raw = '```markdown\nNgười dẫn chuyện: Chủ tịch Hồ Chí Minh ra đi tìm đường cứu nước. [Nhạc hào hùng] (Hào hùng) **Hồi 1 - Mở cảnh:** Người tới nước Pháp.\n```';
      const cleaned = sanitizeVoiceoverScript(raw);
      expect(cleaned).not.toContain('Người dẫn chuyện:');
      expect(cleaned).not.toContain('```');
      expect(cleaned).not.toContain('[Nhạc hào hùng]');
      expect(cleaned).not.toContain('(Hào hùng)');
      expect(cleaned).not.toContain('**Hồi 1 - Mở cảnh:**');
      expect(cleaned).toContain('Chủ tịch Hồ Chí Minh ra đi tìm đường cứu nước.');
    });

    it('should strip truncated dangling words or hanging single initials at the end', () => {
      const raw = 'Người bắt đầu hành trình gian nan. Hoàng sơ tổ khảo là Thái bảo Nguyễn Bá P';
      const cleaned = sanitizeVoiceoverScript(raw);
      expect(cleaned).toBe('Người bắt đầu hành trình gian nan.');
      expect(cleaned).not.toContain('Nguyễn Bá P');
      expect(cleaned.endsWith('.')).toBe(true);
    });

    it('should strip dangling prepositions or conjunctions before terminal punctuation', () => {
      const raw = 'Quân dân ta đã giành được thắng lợi vang dội vào năm';
      const cleaned = sanitizeVoiceoverScript(raw);
      expect(cleaned).toBe('Quân dân ta đã giành được thắng lợi vang dội.');
      expect(cleaned).not.toContain('vào năm');
    });
  });

  describe('synthesizeDeterministicHistoricalScript', () => {
    it('should sanitize truncated chapter summaries before synthesis', () => {
      const truncatedSummary = 'Chủ tịch Hồ Chí Minh sinh ra tại Kim Liên, Nam Đàn. Hoàng sơ tổ khảo là Thái bảo Nguyễn Bá P';
      const script = synthesizeDeterministicHistoricalScript(
        'Thời Niên Thiếu',
        truncatedSummary,
        [],
        60,
        145
      );

      expect(script).toContain('Chủ tịch Hồ Chí Minh sinh ra tại Kim Liên, Nam Đàn.');
      expect(script).not.toContain('Nguyễn Bá P');
      expect(script.endsWith('.')).toBe(true);
    });

    it('should eliminate verbatim duplicate sentences between summary and chunks', () => {
      const summary = 'Mùa xuân năm 1789 Hoàng đế Quang Trung đại phá quân Mãn Thanh giải phóng Thăng Long.';
      const duplicateChunks = [
        {
          summary: 'Mùa xuân năm 1789 Hoàng đế Quang Trung đại phá quân Mãn Thanh giải phóng Thăng Long. Nghĩa quân tiến vào kinh thành trong niềm hân hoan của nhân dân.',
        },
      ];

      const script = synthesizeDeterministicHistoricalScript(
        'Đại Thắng Mùa Xuân',
        summary,
        duplicateChunks,
        60,
        145
      );

      // Should contain the sentence only once
      const matches = script.match(/Mùa xuân năm 1789 Hoàng đế Quang Trung đại phá quân Mãn Thanh/g);
      expect(matches?.length).toBe(1);
    });

    it('should normalize historical anachronisms such as quân Hà Nội', () => {
      const summary = 'Quân Hà Nội tiến đánh đồn Ngọc Hồi dưới sự chỉ huy của Quang Trung.';
      const script = synthesizeDeterministicHistoricalScript(
        'Đại Phá Ngọc Hồi',
        summary,
        [],
        60,
        145
      );

      expect(script).toContain('nghĩa quân Tây Sơn');
      expect(script).not.toContain('Quân Hà Nội');
    });
  });

  describe('scriptwriterNode', () => {
    it('should generate sanitized narration scripts for each chapter', async () => {
      const mockState: Partial<ChronoGraphState> = {
        projectId: 'test_scriptwriter_001',
        userPrompt: 'Chủ tịch Hồ Chí Minh',
        videoType: 'BIOGRAPHY',
        targetDurationMinutes: 1,
        chapters: [
          {
            chapterIndex: 0,
            title: 'Hồi 1: Khát vọng cứu nước',
            summary: 'Chủ tịch Hồ Chí Minh nuôi dưỡng ý chí cứu nước từ thuở thiếu thời. Hoàng sơ tổ khảo là Thái bảo Nguyễn Bá P',
            targetDurationSeconds: 60,
            keyEvents: ['Ý chí cứu nước'],
            introducedEntities: ['Hồ Chí Minh'],
          },
        ],
        chapterScripts: {},
        ragContext: {
          verifiedContext: [],
          aliasTable: {},
          citations: [],
        },
        telemetryAudit: [],
      };

      const result = await scriptwriterNode(mockState as ChronoGraphState);
      expect(result.chapterScripts).toBeDefined();
      expect(result.chapterScripts![0]).toBeDefined();
      expect(result.chapterScripts![0]).toContain('Chủ tịch Hồ Chí Minh');
      expect(result.chapterScripts![0]).not.toContain('Nguyễn Bá P');
      expect(result.chapterScripts![0].endsWith('.')).toBe(true);
      expect(result.narrativeLedger).toBeDefined();
      expect(result.narrativeLedger?.coveredMilestones).toBeDefined();
    });

    it('should eliminate cross-chapter verbatim sentence leakage', async () => {
      const mockState: Partial<ChronoGraphState> = {
        projectId: 'test_scriptwriter_dedup',
        userPrompt: 'Chủ tịch Hồ Chí Minh',
        videoType: 'BIOGRAPHY',
        targetDurationMinutes: 2,
        chapters: [
          {
            chapterIndex: 0,
            title: 'Hồi 1: Thuở thiếu thời',
            summary: 'Nguyễn Sinh Cung sinh năm 1890 tại làng Sen, Nam Đàn, Nghệ An.',
            targetDurationSeconds: 60,
            keyEvents: ['Năm 1890 sinh ra tại làng Sen'],
            introducedEntities: ['Nguyễn Sinh Cung'],
          },
          {
            chapterIndex: 1,
            title: 'Hồi 2: Bôn ba tìm đường cứu nước',
            summary: 'Năm 1911 người ra đi tìm đường cứu nước tại bến Nhà Rồng.',
            targetDurationSeconds: 60,
            keyEvents: ['Năm 1911 rời bến Nhà Rồng'],
            introducedEntities: ['Văn Ba', 'Nguyễn Ái Quốc'],
          },
        ],
        chapterScripts: {
          0: 'Nguyễn Sinh Cung sinh năm 1890 tại làng Sen, Nam Đàn, Nghệ An. Thuở thiếu thời người đã chứng kiến nỗi khổ của dân tộc và nung nấu ý chí giải phóng quê hương.',
        },
        ragContext: {
          verifiedContext: [],
          aliasTable: {},
          citations: [],
        },
        telemetryAudit: [],
      };

      const result = await scriptwriterNode(mockState as ChronoGraphState);
      expect(result.chapterScripts).toBeDefined();
      expect(result.chapterScripts![1]).toBeDefined();
      expect(result.narrativeLedger?.coveredMilestones.length).toBe(2);
    });
  });

  describe('getDomainChapterRoleGuidance across all 5 historical domains', () => {
    it('produces biography-specific arc for BIOGRAPHY domain without military jargon', () => {
      const firstChapter = getDomainChapterRoleGuidance('BIOGRAPHY', true, false, true);
      expect(firstChapter).toContain('THÂN THẾ, XUẤT THÂN & HOÀI BÃO');
      expect(firstChapter).not.toContain('hạ thành');
      expect(firstChapter).not.toContain('quân địch');

      const middleChapter = getDomainChapterRoleGuidance('BIOGRAPHY', false, false, true);
      expect(middleChapter).toContain('HÀNH TRÌNH, BIẾN CỐ & CỐNG HIẾN KIỆT XUẤT');

      const lastChapter = getDomainChapterRoleGuidance('BIOGRAPHY', false, true, true);
      expect(lastChapter).toContain('CHẶNG ĐƯỜNG CUỐI ĐỜI, SỰ RA ĐI & DI SẢN BẤT TỬ');
    });

    it('produces artifact-specific arc for ARTIFACT domain without battle commands', () => {
      const firstChapter = getDomainChapterRoleGuidance('ARTIFACT', true, false, true);
      expect(firstChapter).toContain('NGUỒN GỐC & ĐỈNH CAO CHẾ TÁC');
      expect(firstChapter).not.toContain('toàn quân');

      const middleChapter = getDomainChapterRoleGuidance('ARTIFACT', false, false, true);
      expect(middleChapter).toContain('GIẢI MÃ HOA VĂN & ĐỜI SỐNG CỔ ĐẠI');

      const lastChapter = getDomainChapterRoleGuidance('ARTIFACT', false, true, true);
      expect(lastChapter).toContain('HÀNH TRÌNH LƯU LẠC, KHẢO CỔ & DI SẢN TRƯỜNG TỒN');
    });

    it('produces dynasty-specific arc for DYNASTY domain', () => {
      const firstChapter = getDomainChapterRoleGuidance('DYNASTY', true, false, true);
      expect(firstChapter).toContain('LẬP TRIỀU, ĐỊNH ĐÔ & KHAI MỞ VẬN NƯỚC');

      const middleChapter = getDomainChapterRoleGuidance('DYNASTY', false, false, true);
      expect(middleChapter).toContain('THỊNH TRỊ, CẢI CÁCH & BIẾN CỐ VƯƠNG TRIỀU');

      const lastChapter = getDomainChapterRoleGuidance('DYNASTY', false, true, true);
      expect(lastChapter).toContain('BIẾN ĐỘNG VẬN NƯỚC, CHUYỂN GIAO & BÀI HỌC TRỊ QUỐC');
    });

    it('produces mystery-specific arc for MYSTERY domain', () => {
      const firstChapter = getDomainChapterRoleGuidance('MYSTERY', true, false, true);
      expect(firstChapter).toContain('BIẾN CỐ BẤT NGỜ & HIỆN TRƯỜNG BÍ ẨN');

      const middleChapter = getDomainChapterRoleGuidance('MYSTERY', false, false, true);
      expect(middleChapter).toContain('MANH MỐI, UẨN KHÚC & TRANH LUẬN SỬ HỌC');

      const lastChapter = getDomainChapterRoleGuidance('MYSTERY', false, true, true);
      expect(lastChapter).toContain('SỰ THẬT MINH OAN, NHẬN ĐỊNH SỬ HỌC & BÀI HỌC NHÂN TÂM');
    });

    it('produces tactical campaign arc for BATTLE domain', () => {
      const firstChapter = getDomainChapterRoleGuidance('BATTLE', true, false, true);
      expect(firstChapter).toContain('BỐI CẢNH & KHỞI PHÁT');

      const middleChapter = getDomainChapterRoleGuidance('BATTLE', false, false, true);
      expect(middleChapter).toContain('HÀNH QUÂN, SÁCH LƯỢC & CHIẾN TRẬN');

      const lastChapter = getDomainChapterRoleGuidance('BATTLE', false, true, true);
      expect(lastChapter).toContain('QUYẾT CHIẾN ĐỈNH ĐIỂM, ĐẠI THẮNG & DI SẢN');
    });

    it('handles single-chapter videos across domains', () => {
      const bioSingle = getDomainChapterRoleGuidance('BIOGRAPHY', true, true, false);
      expect(bioSingle).toContain('TOÀN BỘ CUỘC ĐỜI & SỰ NGHIỆP (CHƯƠNG ĐƠN)');

      const artifactSingle = getDomainChapterRoleGuidance('ARTIFACT', true, true, false);
      expect(artifactSingle).toContain('TOÀN BỘ HÀNH TRÌNH DI SẢN (CHƯƠNG ĐƠN)');
    });
  });
});
