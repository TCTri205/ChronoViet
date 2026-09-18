import { describe, it, expect, vi } from 'vitest';
import { vlmInspectionNode } from '../graph/nodes/vlm-node.js';
import { ChronoGraphState } from '../graph/state.js';
import { inferSemanticPureCodeLayout } from '@chronoviet/vlm-inspector';
import { DOMAIN_LAYOUT_WHITELIST } from '@chronoviet/shared-spec';

describe('VLM Node & Domain-Aware Pure Code Fallback', () => {
  describe('inferSemanticPureCodeLayout', () => {
    it('never produces VERSUS_CARD for BIOGRAPHY even with confrontation keywords', () => {
      const text = 'Cuộc đấu tranh gay gắt đối đầu hai bên trên mặt trận chính trị.';
      const layout = inferSemanticPureCodeLayout(text, 3, 'BIOGRAPHY');
      expect(layout).not.toBe('VERSUS_CARD');
      expect(DOMAIN_LAYOUT_WHITELIST.BIOGRAPHY).toContain(layout);
    });

    it('never produces VERSUS_CARD for ARTIFACT domain', () => {
      const text = 'So với các bảo vật khác, chiếc nỏ thần đối đầu với thời gian.';
      const layout = inferSemanticPureCodeLayout(text, 3, 'ARTIFACT');
      expect(layout).not.toBe('VERSUS_CARD');
      expect(DOMAIN_LAYOUT_WHITELIST.ARTIFACT).toContain(layout);
    });

    it('allows VERSUS_CARD for BATTLE when confrontation keywords exist', () => {
      const text = 'Quân ta và quân địch đối đầu quyết liệt trên sông Bạch Đằng.';
      const layout = inferSemanticPureCodeLayout(text, 0, 'BATTLE');
      expect(layout).toBe('VERSUS_CARD');
    });

    it('supports rotation across whitelisted pure code layouts for BIOGRAPHY', () => {
      const neutralText = 'Một chặng đường lịch sử đầy gian nan.';
      for (let i = 0; i < 8; i++) {
        const layout = inferSemanticPureCodeLayout(neutralText, i, 'BIOGRAPHY');
        expect(layout).not.toBe('VERSUS_CARD');
        expect(DOMAIN_LAYOUT_WHITELIST.BIOGRAPHY).toContain(layout);
      }
    });
  });

  describe('vlmInspectionNode execution', () => {
    it('falls back to pure code without assigning VERSUS_CARD when candidates are empty in BIOGRAPHY', async () => {
      const mockState: Partial<ChronoGraphState> = {
        projectId: 'test_vlm_node_bio_001',
        videoType: 'BIOGRAPHY',
        scenes: [
          {
            sceneId: 'sc_bio_01',
            sceneIndex: 0,
            chapterIndex: 0,
            voiceoverText: 'Chủ tịch Hồ Chí Minh đối đầu với bao gian truân thử thách.',
            layoutMode: 'HISTORICAL_FRAME',
            contentType: 'IMAGE',
            candidates: [],
            usePureCodeFallback: false,
            targetDurationSeconds: 5,
            searchKeywords: [],
          },
        ],
      };

      const result = await vlmInspectionNode(mockState as ChronoGraphState);
      expect(result.scenes).toBeDefined();
      expect(result.scenes![0].layoutMode).not.toBe('VERSUS_CARD');
      expect(DOMAIN_LAYOUT_WHITELIST.BIOGRAPHY).toContain(result.scenes![0].layoutMode);
    });
  });
});
