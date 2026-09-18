import { describe, it, expect } from 'vitest';
import { inferSemanticLayoutMode, segmenterNode, splitScriptIntoSentences } from '../graph/nodes/segmenter-node.js';
import { ChronoGraphState } from '../graph/state.js';
import { DOMAIN_LAYOUT_WHITELIST } from '@chronoviet/shared-spec';

describe('Segmenter Node & Domain-Aware Layout Inference', () => {
  describe('inferSemanticLayoutMode Domain Guardrails', () => {
    it('strictly forbids VERSUS_CARD in BIOGRAPHY even with confrontation keywords', () => {
      const confrontationText = 'Chủ tịch Hồ Chí Minh so với các nhà yêu nước cùng thời có tầm nhìn vượt bậc, lãnh đạo hai bên cùng hướng về độc lập.';
      const layout = inferSemanticLayoutMode(
        confrontationText,
        'HISTORICAL_DOCUMENTARY',
        0,
        undefined,
        'BIOGRAPHY'
      );
      expect(layout).not.toBe('VERSUS_CARD');
      expect(DOMAIN_LAYOUT_WHITELIST.BIOGRAPHY).toContain(layout);
    });

    it('strictly forbids VERSUS_CARD in ARTIFACT domain', () => {
      const artifactText = 'Trống đồng Đông Sơn đối đầu với thử thách của thời gian ngàn năm, hai bên vành trống chạm khắc hoa văn tinh xảo.';
      const layout = inferSemanticLayoutMode(
        artifactText,
        'HISTORICAL_DOCUMENTARY',
        0,
        undefined,
        'ARTIFACT'
      );
      expect(layout).not.toBe('VERSUS_CARD');
      expect(DOMAIN_LAYOUT_WHITELIST.ARTIFACT).toContain(layout);
    });

    it('allows VERSUS_CARD in BATTLE when confrontation keywords exist', () => {
      const battleText = 'Tương quan lực lượng giữa hai bên lúc này: địch và ta đối đầu quyết liệt trên sông Bạch Đằng.';
      const layout = inferSemanticLayoutMode(
        battleText,
        'HISTORICAL_DOCUMENTARY',
        0,
        undefined,
        'BATTLE'
      );
      expect(layout).toBe('VERSUS_CARD');
    });

    it('identifies quotes correctly across allowed domains', () => {
      const quoteText = 'Bác Hồ đã khẳng định rằng: “Không có gì quý hơn độc lập tự do!”';
      const layoutBio = inferSemanticLayoutMode(
        quoteText,
        'HISTORICAL_DOCUMENTARY',
        0,
        undefined,
        'BIOGRAPHY'
      );
      expect(layoutBio).toBe('QUOTE_SLIDE');
    });

    it('identifies milestones and stats for whitelisted domains', () => {
      const statText = 'Quân đội xuất kích với 20 vạn quân tinh nhuệ cùng 500 chiến thuyền ngày đêm vượt sóng.';
      const layoutBattle = inferSemanticLayoutMode(
        statText,
        'HISTORICAL_DOCUMENTARY',
        0,
        undefined,
        'BATTLE'
      );
      expect(layoutBattle).toBe('STAT_CARD');
    });

    it('does NOT trigger STAT_CARD on bare calendar years', () => {
      const calendarText = 'Vào mùa thu năm 1945, nhân dân cả nước đồng lòng đứng lên giành chính quyền.';
      const layout = inferSemanticLayoutMode(
        calendarText,
        'HISTORICAL_DOCUMENTARY',
        0,
        undefined,
        'BIOGRAPHY'
      );
      expect(layout).not.toBe('STAT_CARD');
    });

    it('does NOT trigger QUOTE_SLIDE on unquoted mention of proclamation words', () => {
      const narrativeText = 'Sự kiện đọc bản tuyên ngôn đã đi vào lịch sử dân tộc như một mốc son chói lọi.';
      const layout = inferSemanticLayoutMode(
        narrativeText,
        'HISTORICAL_DOCUMENTARY',
        0,
        undefined,
        'BIOGRAPHY'
      );
      expect(layout).not.toBe('QUOTE_SLIDE');
    });

    it('maintains backwards compatibility when videoType is omitted', () => {
      const confrontationText = 'Tương quan lực lượng hai bên đối đầu gay gắt.';
      const layoutDefault = inferSemanticLayoutMode(confrontationText);
      expect(layoutDefault).toBe('VERSUS_CARD');
    });
  });

  describe('segmenterNode execution with videoType', () => {
    it('segments chapter script into scenes adhering to BIOGRAPHY domain layout whitelist', async () => {
      const mockState: Partial<ChronoGraphState> = {
        projectId: 'test_segmenter_bio_001',
        templateId: 'HISTORICAL_DOCUMENTARY',
        videoType: 'BIOGRAPHY',
        chapterScripts: {
          0: 'Chủ tịch Hồ Chí Minh sinh năm 1890 tại Kim Liên, Nam Đàn, Nghệ An. Người ra đi tìm đường cứu nước năm 1911 từ bến cảng Nhà Rồng. So với các bậc tiền bối đương thời, Người đã chọn con đường cứu nước đúng đắn cho toàn thể dân tộc.',
        },
        chapters: [
          {
            chapterIndex: 0,
            title: 'Hành Trình Tìm Đường Cứu Nước',
            summary: 'Bác Hồ ra đi tìm đường cứu nước.',
            targetDurationSeconds: 30,
            keyEvents: ['Sinh năm 1890', 'Ra đi tìm đường cứu nước 1911'],
            introducedEntities: ['Chủ tịch Hồ Chí Minh'],
          },
        ],
      };

      const result = await segmenterNode(mockState as ChronoGraphState);
      expect(result.scenes).toBeDefined();
      expect(result.scenes!.length).toBeGreaterThan(0);

      for (const scene of result.scenes!) {
        expect(scene.layoutMode).not.toBe('VERSUS_CARD');
        expect(DOMAIN_LAYOUT_WHITELIST.BIOGRAPHY).toContain(scene.layoutMode);
      }
    });
  });

  describe('splitScriptIntoSentences clause boundary healing', () => {
    it('heals dangling clauses after colons and lists without creating fragments', () => {
      const fragmentedScript = `Quang Trung chia quân làm 5 đạo:\ntiền, hậu, tả, hữu và trung quân.\nTất cả đồng loạt tiến công tiêu diệt quân Mãn Thanh.`;
      const sentences = splitScriptIntoSentences(fragmentedScript);

      expect(sentences.length).toBe(2);
      expect(sentences[0]).toContain('chia quân làm 5 đạo: tiền, hậu, tả, hữu và trung quân.');
      expect(sentences[1]).toBe('Tất cả đồng loạt tiến công tiêu diệt quân Mãn Thanh.');
    });

    it('does not produce scenes starting with coordinate conjunctions or lowercase words', () => {
      const scriptWithDanglingConjunction = `Nghĩa quân Tây Sơn thần tốc tiến vào Thăng Long. Và làm nên đại thắng mùa xuân Kỷ Dậu 1789.`;
      const sentences = splitScriptIntoSentences(scriptWithDanglingConjunction);

      expect(sentences.length).toBe(1);
      expect(sentences[0]).toContain('Nghĩa quân Tây Sơn thần tốc tiến vào Thăng Long. Và làm nên đại thắng mùa xuân Kỷ Dậu 1789.');
    });

    it('protects numbers with periods as thousands separators from splitting', () => {
      const script = 'Quân đội Quốc gia Việt Nam phát triển lên tới 230.000 quân, chiếm 60% lực lượng Liên Hiệp Pháp ở Đông Dương. Kháng chiến bắt đầu bùng nổ.';
      const sentences = splitScriptIntoSentences(script);

      expect(sentences.length).toBe(2);
      expect(sentences[0]).toContain('230.000 quân');
      expect(sentences[1]).toContain('Kháng chiến bắt đầu bùng nổ.');
      expect(sentences.some((s) => s.startsWith('000 quân'))).toBe(false);
    });
  });
});
