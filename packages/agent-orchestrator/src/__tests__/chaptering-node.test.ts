import { describe, it, expect, vi } from 'vitest';
import {
  isValidHistoricalEntity,
  extractHistoricalEntitiesFromRag,
  cleanCrawlerText,
  enrichMacroBeatsToChapterPlans,
  chapteringNode,
} from '../graph/nodes/chaptering-node.js';
import { callLlm } from '@chronoviet/infra';
import { ChronoGraphState } from '../graph/state.js';

// Mock callLlm for deterministic testing
vi.mock('@chronoviet/infra', async (importOriginal) => {
  const original = await importOriginal<typeof import('@chronoviet/infra')>();
  return {
    ...original,
    callLlm: vi.fn().mockImplementation(async ({ messages }) => {
      const userMsg = messages.find((m: any) => m.role === 'user')?.content || '';
      if (userMsg.includes('đúng 2 hồi')) {
        return {
          content: JSON.stringify({
            chapterBeats: [
              {
                chapterIndex: 0,
                title: 'Trận địa cọc ngầm Bạch Đằng',
                timeAnchor: 'Năm 981',
                mainEvent: 'Lê Hoàn bố trí bãi cọc nhử quân Tống vào trận địa mai phục',
              },
              {
                chapterIndex: 1,
                title: 'Tiêu diệt Hầu Nhân Bảo toàn thắng',
                timeAnchor: 'Tháng 4 năm 981',
                mainEvent: 'Quân dân Đại Cồ Việt phản công chém chết tướng giặc Hầu Nhân Bảo',
              },
            ],
          }),
        };
      }
      return {
        content: JSON.stringify({
          chapters: [
            {
              chapterIndex: 0,
              title: 'Hồi 1: Bối cảnh và Khởi nguồn',
              summary: 'Lê Hoàn tổ chức trận địa cọc ngầm chuẩn bị nghênh chiến quân Tống xâm lược.',
              targetDurationSeconds: 60,
              keyEvents: ['Chuẩn bị trận địa'],
              introducedEntities: ['Lê Hoàn', 'person_invalid_id'],
              transitionHook: 'Tiếp tục diễn biến...',
              establishedTone: 'Hào hùng, trang trọng',
            },
            {
              chapterIndex: 1,
              title: 'Hồi 2: Thủy chiến Bạch Đằng',
              summary: 'Quân dân Đại Cồ Việt quyết chiến tiêu diệt chủ tướng Hầu Nhân Bảo.',
              targetDurationSeconds: 60,
              keyEvents: ['Tiêu diệt Hầu Nhân Bảo'],
              introducedEntities: ['Hầu Nhân Bảo'],
              transitionHook: '',
              establishedTone: 'Hào hùng, trang trọng',
            },
          ],
        }),
      };
    }),
  };
});

describe('Chaptering Node & Entity Sanitizer', () => {
  describe('cleanCrawlerText', () => {
    it('should strip crawler metadata, markdown headers, and percent-encoding artifacts', () => {
      const dirty = 'source_reliability: LEVEL_1\n### Trận đánh lớn\nBB%8Bch Đ%C3%A0ng Page 12 ***hào hùng***\nChi tiết trận đánh.';
      const cleaned = cleanCrawlerText(dirty);
      expect(cleaned).not.toContain('source_reliability');
      expect(cleaned).not.toContain('###');
      expect(cleaned).not.toContain('Page 12');
      expect(cleaned).not.toContain('BB%8Bch');
      expect(cleaned).not.toContain('***');
      expect(cleaned).toContain('Chi tiết trận đánh.');
    });
  });

  describe('isValidHistoricalEntity', () => {
    it('should accept valid capitalized Vietnamese historical entities', () => {
      expect(isValidHistoricalEntity('Lê Hoàn')).toBe(true);
      expect(isValidHistoricalEntity('Nguyễn Trãi')).toBe(true);
      expect(isValidHistoricalEntity('Bình Ngô Đại Cáo')).toBe(true);
      expect(isValidHistoricalEntity('Trần Hưng Đạo')).toBe(true);
      expect(isValidHistoricalEntity('Sông Như Nguyệt')).toBe(true);
    });

    it('should reject database entity ID prefixes', () => {
      expect(isValidHistoricalEntity('person_le_hoan_pha_tong')).toBe(false);
      expect(isValidHistoricalEntity('loc_song_bach_dang')).toBe(false);
      expect(isValidHistoricalEntity('doc_binh_ngo_dai_cao')).toBe(false);
      expect(isValidHistoricalEntity('event_tran_bach_dang')).toBe(false);
      expect(isValidHistoricalEntity('org_nha_tien_le')).toBe(false);
      expect(isValidHistoricalEntity('epoch_tien_le')).toBe(false);
      expect(isValidHistoricalEntity('item_sung_truong')).toBe(false);
    });

    it('should reject raw ASCII slugs with underscores', () => {
      expect(isValidHistoricalEntity('le_hoan_pha_tong')).toBe(false);
      expect(isValidHistoricalEntity('pha_tong_binh_chiem')).toBe(false);
      expect(isValidHistoricalEntity('buon_ma_thuot')).toBe(false);
    });

    it('should reject pure numbers and strings < 3 chars', () => {
      expect(isValidHistoricalEntity('981')).toBe(false);
      expect(isValidHistoricalEntity('1428')).toBe(false);
      expect(isValidHistoricalEntity('AB')).toBe(false);
      expect(isValidHistoricalEntity('')).toBe(false);
    });

    it('should reject generic structural stop phrases', () => {
      expect(isValidHistoricalEntity('Việt Nam')).toBe(false);
      expect(isValidHistoricalEntity('Lịch Sử')).toBe(false);
      expect(isValidHistoricalEntity('Tóm tắt')).toBe(false);
      expect(isValidHistoricalEntity('Nội dung')).toBe(false);
      expect(isValidHistoricalEntity('Chrono Viet')).toBe(false);
    });
  });

  describe('extractHistoricalEntitiesFromRag', () => {
    it('should cleanly extract valid entities from verifiedContext and aliasTable while filtering corrupted IDs', () => {
      const ragContext = {
        verifiedContext: [
          {
            entityId: 'person_1',
            canonicalName: 'Lê Hoàn',
            summary: 'Lê Hoàn lãnh đạo quân dân Đại Cồ Việt đánh tan quân Tống trên sông Bạch Đằng.',
            aliases: ['person_le_hoan_pha_tong', 'Lê Đại Hành', '981', 'le_hoan'],
            citations: ['ĐVSKTT'],
            confidenceScore: 0.98,
            sourceReliability: 'LEVEL_1' as const,
          },
        ],
        aliasTable: {
          'Lê Hoàn': ['Lê Đại Hành', 'person_le_hoan'],
          'loc_song_bach_dang': ['Sông Bạch Đằng'],
          'Bạch Đằng': ['sông Bạch Đằng', 'trận Bạch Đằng'],
        },
        citations: [],
      };

      const entities = extractHistoricalEntitiesFromRag(ragContext);

      expect(entities).toContain('Lê Hoàn');
      expect(entities).toContain('Lê Đại Hành');
      expect(entities).toContain('Bạch Đằng');
      expect(entities).not.toContain('person_le_hoan_pha_tong');
      expect(entities).not.toContain('loc_song_bach_dang');
      expect(entities).not.toContain('981');
      expect(entities).not.toContain('le_hoan');
    });
  });

  describe('chapteringNode LLM generation & validation gate', () => {
    it('should generate properly structured chapters and filter invalid entity IDs from introducedEntities', async () => {
      const state: Partial<ChronoGraphState> = {
        projectId: 'test_proj',
        userPrompt: 'Chiến thắng Bạch Đằng năm 981',
        videoType: 'BATTLE',
        targetDurationMinutes: 2,
        templateId: 'HISTORICAL_DOCUMENTARY',
        status: 'INIT',
        currentStep: 1,
        ragContext: {
          verifiedContext: [
            {
              entityId: 'e1',
              canonicalName: 'Lê Hoàn',
              aliases: [],
              citations: [],
              confidenceScore: 1.0,
              summary: 'Lê Hoàn tổ chức trận địa cọc ngầm đánh bại Hầu Nhân Bảo trên sông Bạch Đằng.',
              sourceReliability: 'LEVEL_1',
            },
            {
              entityId: 'e2',
              canonicalName: 'Hầu Nhân Bảo',
              aliases: [],
              citations: [],
              confidenceScore: 1.0,
              summary: 'Chủ tướng quân Tống bị tiêu diệt trong trận thủy chiến Bạch Đằng.',
              sourceReliability: 'LEVEL_1',
            },
          ],
          aliasTable: {},
          citations: [],
        },
        chapters: [],
        currentChapterIndex: 0,
        runningNarrativeState: {
          previousChapterSummary: '',
          establishedTone: 'Hùng tráng',
          introducedEntities: [],
          transitionHook: '',
        },
        chapterScripts: {},
        factCheckLogs: [],
        scenes: [],
        researchResults: {},
        audioAssets: [],
        pacingErrorPercentage: 0,
        telemetryAudit: [],
        needsHumanReview: false,
      };

      const result = await chapteringNode(state as ChronoGraphState);

      expect(result.status).toBe('OUTLINE_CHAPTERED');
      expect(result.chapters).toBeDefined();
      expect(result.chapters!.length).toBe(3);
      expect(result.chapters![0].targetDurationSeconds).toBe(40);
      expect(result.chapters![1].targetDurationSeconds).toBe(40);
      expect(result.chapters![0].summary.length).toBeGreaterThanOrEqual(25);
      expect(result.chapters![0].introducedEntities).toContain('Lê Hoàn');
      expect(result.chapters![0].introducedEntities).not.toContain('person_invalid_id');
      expect(result.runningNarrativeState?.previousChapterSummary).toBeTruthy();
    });

    it('should generate 2 chapters for short videos (< 90s) and preserve prompt entities in both chapters', async () => {
      const state: Partial<ChronoGraphState> = {
        projectId: 'test_short_video',
        userPrompt: 'Chiến thắng Bạch Đằng năm 981 của Lê Hoàn',
        videoType: 'BATTLE',
        targetDurationMinutes: 1, // 60s -> 2 chapters
        templateId: 'QUICK_SHORTS',
        status: 'INIT',
        currentStep: 1,
        ragContext: {
          verifiedContext: [
            {
              entityId: 'e1',
              canonicalName: 'Lê Hoàn',
              aliases: [],
              citations: [],
              confidenceScore: 1.0,
              summary: 'source_reliability: LEVEL_1\n### Trận địa\nLê Hoàn tổ chức bãi cọc nhử quân Tống trên sông Bạch Đằng.',
              sourceReliability: 'LEVEL_1',
            },
            {
              entityId: 'e2',
              canonicalName: 'Hầu Nhân Bảo',
              aliases: [],
              citations: [],
              confidenceScore: 1.0,
              summary: 'Chủ tướng quân Tống bị tiêu diệt trong đợt phản công quyết định.',
              sourceReliability: 'LEVEL_1',
            },
          ],
          aliasTable: {},
          citations: [],
        },
        chapters: [],
        currentChapterIndex: 0,
        runningNarrativeState: {
          previousChapterSummary: '',
          establishedTone: 'Hùng tráng',
          introducedEntities: [],
          transitionHook: '',
        },
        chapterScripts: {},
        factCheckLogs: [],
        scenes: [],
        researchResults: {},
        audioAssets: [],
        pacingErrorPercentage: 0,
        telemetryAudit: [],
        needsHumanReview: false,
      };

      const result = await chapteringNode(state as ChronoGraphState);

      expect(result.status).toBe('OUTLINE_CHAPTERED');
      expect(result.chapters).toBeDefined();
      expect(result.chapters!.length).toBe(2);
      expect(result.chapters![0].targetDurationSeconds).toBe(30);
      expect(result.chapters![1].targetDurationSeconds).toBe(30);
      // User prompt entity "Lê Hoàn" must be in Chapter 0 and Chapter 1
      expect(result.chapters![0].introducedEntities).toContain('Lê Hoàn');
      expect(result.chapters![1].introducedEntities).toContain('Lê Hoàn');
      // Verify crawler sanitization on chapter summaries
      expect(result.chapters![0].summary).not.toContain('source_reliability');
      expect(result.chapters![0].summary).not.toContain('###');
    });

    it('should enrich 5 macro-beats with deterministic prompt entity distribution across Chapter 0, Climax, and Resolution', () => {
      const beats = [
        { chapterIndex: 0, title: 'Bối cảnh khởi phát', timeAnchor: 'Năm 1284', mainEvent: 'Thoát Hoan dẫn đại quân áp sát biên giới' },
        { chapterIndex: 1, title: 'Hội nghị Diên Hồng', timeAnchor: 'Đầu năm 1285', mainEvent: 'Thượng hoàng Trần Thánh Tông triệu họp các bô lão' },
        { chapterIndex: 2, title: 'Hịch tướng sĩ hiệu triệu', timeAnchor: 'Năm 1285', mainEvent: 'Trần Quốc Tuấn soạn Hịch tướng sĩ khích lệ quân sĩ' },
        { chapterIndex: 3, title: 'Trận Tây Kết Hàm Tử', timeAnchor: 'Mùa hè 1285', mainEvent: 'Quân dân nhà Trần tổng phản công phá tan quân giặc' },
        { chapterIndex: 4, title: 'Khúc khải hoàn toàn thắng', timeAnchor: 'Cuối năm 1285', mainEvent: 'Thoát Hoan chui ống đồng tháo chạy non sông thái bình' },
      ];

      const chapters = enrichMacroBeatsToChapterPlans(beats, {
        userPrompt: 'Hào khí Đông A và Hịch tướng sĩ',
        videoType: 'DOCUMENTARY',
        totalTargetSec: 300,
        secPerChapter: 60,
        allHistoricalEntities: ['Trần Hưng Đạo', 'Thoát Hoan', 'Trần Thánh Tông', 'Hịch tướng sĩ', 'Hào khí Đông A'],
        userPromptEntities: ['Hịch tướng sĩ', 'Hào khí Đông A'],
        verifiedChunks: [
          {
            canonicalName: 'Hịch tướng sĩ',
            summary: 'source_reliability: LEVEL_1\n### Áng văn bất hủ\nTrần Quốc Tuấn viết Hịch tướng sĩ hiệu triệu quân dân quyết chiến chống giặc Mông Nguyên.',
          },
        ],
      });

      expect(chapters.length).toBe(5);
      // Chapter 0 (Opening), Chapter 3 (Climax for 5 chapters), Chapter 4 (Resolution) must contain prompt entities
      expect(chapters[0].introducedEntities).toContain('Hịch tướng sĩ');
      expect(chapters[3].introducedEntities).toContain('Hịch tướng sĩ');
      expect(chapters[4].introducedEntities).toContain('Hịch tướng sĩ');
      // Total duration sum must equal totalTargetSec
      const totalSec = chapters.reduce((sum, c) => sum + c.targetDurationSeconds, 0);
      expect(totalSec).toBe(300);
      // Crawler text must be clean
      expect(chapters[0].summary).not.toContain('source_reliability');
      expect(chapters[0].summary).not.toContain('###');
    });

    it('should gracefully handle LLM error and generate fallback chapters with telemetry audit', async () => {
      const mockCallLlm = vi.mocked(callLlm);
      mockCallLlm.mockRejectedValue(new Error('LLM connection timeout'));

      const state: Partial<ChronoGraphState> = {
        projectId: 'test_fallback_proj',
        userPrompt: 'Chiến dịch Điện Biên Phủ 1954',
        videoType: 'BATTLE',
        targetDurationMinutes: 3,
        templateId: 'HISTORICAL_DOCUMENTARY',
        status: 'INIT',
        currentStep: 1,
        ragContext: {
          verifiedContext: [
            {
              entityId: 'e1',
              canonicalName: 'Võ Nguyên Giáp',
              aliases: [],
              citations: [],
              confidenceScore: 1.0,
              summary: 'Đại tướng Võ Nguyên Giáp chỉ huy chiến dịch Điện Biên Phủ toàn thắng.',
              sourceReliability: 'LEVEL_1',
            },
          ],
          aliasTable: {},
          citations: [],
        },
        chapters: [],
        currentChapterIndex: 0,
        runningNarrativeState: {
          previousChapterSummary: '',
          establishedTone: 'Hùng tráng',
          introducedEntities: [],
          transitionHook: '',
        },
        chapterScripts: {},
        factCheckLogs: [],
        scenes: [],
        researchResults: {},
        audioAssets: [],
        pacingErrorPercentage: 0,
        telemetryAudit: [],
        needsHumanReview: false,
      };

      const result = await chapteringNode(state as ChronoGraphState);

      expect(result.status).toBe('OUTLINE_CHAPTERED');
      expect(result.chapters).toBeDefined();
      expect(result.chapters!.length).toBe(3);
      expect(result.telemetryAudit).toBeDefined();
      const fallbackEntry = result.telemetryAudit!.find((t) => t.category === 'FALLBACK');
      expect(fallbackEntry).toBeDefined();
      expect(fallbackEntry?.message).toContain('LLM connection timeout');
    });
  });
});
