import { describe, it, expect, vi } from 'vitest';
import { isValidHistoricalEntity, extractHistoricalEntitiesFromRag, chapteringNode } from '../graph/nodes/chaptering-node.js';
import { ChronoGraphState } from '../graph/state.js';

// Mock callLlm for deterministic testing
vi.mock('@chronoviet/infra', async (importOriginal) => {
  const original = await importOriginal<typeof import('@chronoviet/infra')>();
  return {
    ...original,
    callLlm: vi.fn().mockImplementation(async ({ messages, responseFormat }) => {
      const prompt = messages[0]?.content || '';
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
      expect(result.chapters!.length).toBe(2);
      expect(result.chapters![0].targetDurationSeconds).toBe(60);
      expect(result.chapters![1].targetDurationSeconds).toBe(60);
      expect(result.chapters![0].summary.length).toBeGreaterThanOrEqual(25);
      expect(result.chapters![0].introducedEntities).toContain('Lê Hoàn');
      expect(result.chapters![0].introducedEntities).not.toContain('person_invalid_id');
      expect(result.runningNarrativeState?.previousChapterSummary).toBeTruthy();
    });
  });
});
