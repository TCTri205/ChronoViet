import { describe, it, expect, vi } from 'vitest';

vi.mock('@chronoviet/infra', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    callLlm: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        queries: [
          {
            sceneId: 'scene_001',
            primaryQuery: 'Trận Bạch Đằng Ngô Quyền',
            englishQuery: 'Battle of Bach Dang Ngo Quyen',
            visualType: 'BATTLE_SCENE',
            historicalPeriod: 'Ngo Dynasty',
          },
        ],
      }),
    }),
  };
});

import {
  translateHistoricalQueryToEnglish,
  translateHistoricalQueryToFrench,
  generateFacetQueries,
  DEFAULT_NEGATIVE_QUERY,
  extractSearchKeywordsFromText,
  inferVisualTypeHeuristic,
  keywordNode,
} from '../graph/nodes/keyword-node.js';
import { ChronoGraphState } from '../graph/state.js';

describe('Trilingual Historical Glossary & Keyword Node', () => {
  describe('translateHistoricalQueryToEnglish', () => {
    it('translates major battle queries accurately without LLM', () => {
      expect(translateHistoricalQueryToEnglish('Trận Bạch Đằng Ngô Quyền')).toBe(
        'Battle of Bach Dang Ngo Quyen'
      );
      expect(translateHistoricalQueryToEnglish('Trận Ngọc Hồi Đống Đa Quang Trung')).toBe(
        'Battle of Ngoc Hoi Dong Da Quang Trung'
      );
      expect(translateHistoricalQueryToEnglish('Chiến dịch Điện Biên Phủ')).toBe(
        'Dien Bien Phu Campaign'
      );
    });

    it('translates monuments, artifacts, and historical locations', () => {
      expect(translateHistoricalQueryToEnglish('Tượng đài Quang Trung gò Đống Đa')).toBe(
        'Statue of Quang Trung Dong Da Mound'
      );
      expect(translateHistoricalQueryToEnglish('Trống đồng Đông Sơn')).toBe(
        'Dong Son bronze drum'
      );
      expect(translateHistoricalQueryToEnglish('Bãi cọc Bạch Đằng')).toBe(
        'Bach Dang wooden stakes'
      );
      expect(translateHistoricalQueryToEnglish('Hoàng thành Thăng Long')).toBe(
        'Imperial Citadel of Thang Long'
      );
    });

    it('translates historical figures, uprisings, and dynasties', () => {
      expect(translateHistoricalQueryToEnglish('Khởi nghĩa Hai Bà Trưng')).toBe(
        'Trung Sisters uprising'
      );
      expect(translateHistoricalQueryToEnglish('Khởi nghĩa Lam Sơn Lê Lợi')).toBe(
        'Lam Son uprising Le Loi'
      );
      expect(translateHistoricalQueryToEnglish('Nhà Trần Trần Hưng Đạo')).toBe(
        'Tran Dynasty Tran Hung Dao'
      );
    });

    it('handles untranslated words gracefully by removing tones', () => {
      expect(translateHistoricalQueryToEnglish('Tướng quân đánh giặc ngoại xâm')).toBe(
        'Tuong quan danh giac ngoai xam'
      );
    });
  });

  describe('translateHistoricalQueryToFrench', () => {
    it('translates French colonial and Nguyen dynasty topics accurately', () => {
      expect(translateHistoricalQueryToFrench('Kinh thành Huế Triều Nguyễn')).toBe(
        'Citadelle de Hue Dynastie des Nguyen'
      );
      expect(translateHistoricalQueryToFrench('Chiến dịch Điện Biên Phủ')).toBe(
        'Bataille de Dien Bien Phu'
      );
      expect(translateHistoricalQueryToFrench('Cầu Long Biên Bắc Kỳ')).toBe(
        'Pont Paul Doumer Tonkin'
      );
      expect(translateHistoricalQueryToFrench('Khởi nghĩa Yên Thế Hoàng Hoa Thám')).toBe(
        'Insurrection de Yen The Hoang Hoa Tham De Tham'
      );
    });

    it('translates ancient monuments and artifacts into French', () => {
      expect(translateHistoricalQueryToFrench('Trống đồng Đông Sơn')).toBe(
        'Tambour de bronze de Dong Son'
      );
      expect(translateHistoricalQueryToFrench('Chùa Một Cột Thăng Long')).toBe(
        'Pagode au pilier unique Thang Long'
      );
      expect(translateHistoricalQueryToFrench('Châu bản triều Nguyễn')).toBe(
        'Archives royales des Nguyen'
      );
    });
  });

  describe('generateFacetQueries', () => {
    it('generates 4-facet visual query expansion correctly', () => {
      const facets = generateFacetQueries(
        'Vua Quang Trung',
        'Emperor Quang Trung',
        'Empereur Quang Trung',
        'PORTRAIT',
        'Tây Sơn'
      );

      expect(facets.portrait).toContain('chân dung');
      expect(facets.portrait).toContain('Tây Sơn');
      expect(facets.artifact).toContain('hiện vật');
      expect(facets.map).toContain('bản đồ');
      expect(facets.battleOrArt).toContain('tranh vẽ');
    });
  });

  describe('extractSearchKeywordsFromText', () => {
    it('extracts proper nouns, years, and verified entities', () => {
      const text = 'Năm 938, Ngô Quyền đã lãnh đạo trận Bạch Đằng đánh tan quân Nam Hán.';
      const entities = ['Ngô Quyền', 'Nam Hán'];
      const keywords = extractSearchKeywordsFromText(text, entities, 'Bạch Đằng');

      expect(keywords).toContain('Bạch Đằng');
      expect(keywords).toContain('Ngô Quyền');
      expect(keywords).toContain('938');
    });
  });

  describe('inferVisualTypeHeuristic', () => {
    it('detects visual types based on domain markers', () => {
      expect(inferVisualTypeHeuristic('Trận thủy chiến trên sông Bạch Đằng')).toBe('BATTLE_SCENE');
      expect(inferVisualTypeHeuristic('Chân dung vua Quang Trung')).toBe('PORTRAIT');
      expect(inferVisualTypeHeuristic('Bản đồ địa bàn chiến sự')).toBe('MAP_CHRONO');
      expect(inferVisualTypeHeuristic('Trống đồng Ngọc Lũ thời kỳ Đông Sơn')).toBe('ARTIFACT');
      expect(inferVisualTypeHeuristic('Di chỉ khảo cổ Hoàng thành Thăng Long')).toBe('ARCHAEOLOGY');
      expect(inferVisualTypeHeuristic('Phong cảnh núi non sông nước Ninh Bình')).toBe('LANDSCAPE');
    });
  });

  describe('keywordNode execution', () => {
    it('populates searchParams with candidate limit 6, trilingual queries, negative query, and 4 facets', async () => {
      const mockState = {
        projectId: 'test_proj',
        correlationId: 'test_corr',
        userPrompt: 'Trận Bạch Đằng năm 938',
        videoBriefId: undefined,
        targetDurationMinutes: 1,
        videoType: 'BATTLE',
        templateId: 'HISTORICAL_DOCUMENTARY',
        status: 'SCENES_SEGMENTED',
        currentStep: 5,
        scenes: [
          {
            sceneId: 'scene_001',
            sceneIndex: 0,
            voiceoverText: 'Trận Bạch Đằng năm 938 của Ngô Quyền ghi dấu ấn lịch sử vẻ vang.',
            layoutMode: 'HISTORICAL_FRAME',
            contentType: 'IMAGE',
            targetDurationSeconds: 10,
            searchKeywords: [],
            candidates: [],
            usePureCodeFallback: false,
          } as any,
        ],
        ragContext: {
          verifiedContext: [
            {
              entityId: 'e1',
              canonicalName: 'Ngô Quyền',
              aliases: ['Tiền Ngô Vương'],
              summary: 'Ngô Quyền',
              citations: ['Đại Việt Sử Ký Toàn Thư'],
              confidenceScore: 0.95,
            },
          ],
          aliasTable: {},
          citations: [],
        },
      } as unknown as ChronoGraphState;

      const res = await keywordNode(mockState);
      expect(res.status).toBe('KEYWORDS_EXTRACTED');
      expect(res.scenes?.[0].searchParams).toBeDefined();
      expect(res.scenes?.[0].searchParams?.limit).toBe(6);
      expect(res.scenes?.[0].searchParams?.englishQuery).toContain('Bach Dang');
      expect(res.scenes?.[0].searchParams?.frenchQuery).toBeDefined();
      expect(res.scenes?.[0].searchParams?.negativeQuery).toBe(DEFAULT_NEGATIVE_QUERY);
      expect(res.scenes?.[0].searchParams?.facetQueries?.portrait).toBeDefined();
      expect(res.scenes?.[0].searchParams?.facetQueries?.map).toBeDefined();
    });
  });
});
