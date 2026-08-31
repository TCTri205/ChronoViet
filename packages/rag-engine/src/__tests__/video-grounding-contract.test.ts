import { describe, it, expect } from 'vitest';
import {
  HistoricalAnswerResponseSchema,
  VisualAnchorSuggestionSchema,
  LayoutModeSchema,
  PURE_IMAGE_LAYOUTS,
} from '@chronoviet/shared-spec';
import { groundClaims } from '../generation/claim-grounder.js';

describe('Video-Ready Grounding & Remotion Bridge Contract', () => {
  it('should infer appropriate visual anchor types from historical claims', () => {
    const text = `Vào năm 1789, vua Quang Trung chỉ huy quân Tây Sơn thần tốc tiến ra Thăng Long đánh tan 29 vạn quân Thanh tại đồn Ngọc Hồi và Đống Đa. [Nguồn: chunk_1]`;
    const chunks = [
      {
        id: 'chunk_1',
        title: 'Chiến thắng Kỷ Dậu 1789',
        content: 'Năm 1789, vua Quang Trung chỉ huy quân Tây Sơn tiến ra Thăng Long đại phá 29 vạn quân Thanh tại Ngọc Hồi và Đống Đa.',
        reliability: 'LEVEL_1',
      },
    ];

    const result = groundClaims(text, chunks);

    expect(result.claims.length).toBeGreaterThan(0);
    expect(result.visualAnchors.length).toBeGreaterThan(0);

    const personAnchor = result.visualAnchors.find((a) => a.entityId === 'person_quang_trung');
    expect(personAnchor).toBeDefined();
    expect(personAnchor?.suggestedVisualType).toBe('PORTRAIT');

    const locAnchor = result.visualAnchors.find((a) => a.entityId === 'loc_thang_long');
    expect(locAnchor).toBeDefined();
    expect(locAnchor?.suggestedVisualType).toBe('MAP');

    for (const anchor of result.visualAnchors) {
      expect(() => VisualAnchorSuggestionSchema.parse(anchor)).not.toThrow();
    }
  });

  it('should validate full HistoricalAnswerResponse against schema with visualAnchors', () => {
    const mockResponse = {
      answerText: 'Vua Quang Trung đại phá quân Thanh năm 1789.',
      claims: [
        {
          claimText: 'Vua Quang Trung đại phá quân Thanh năm 1789.',
          sourceChunkId: 'chunk_1',
          sourceTitle: 'Sử liệu Quang Trung',
          reliability: 'LEVEL_1' as const,
          entailmentScore: 0.95,
          visualAnchors: [
            {
              entityId: 'person_quang_trung',
              label: 'Quang Trung',
              suggestedVisualType: 'PORTRAIT' as const,
              matchedClaimText: 'Vua Quang Trung đại phá quân Thanh năm 1789.',
            },
          ],
        },
      ],
      citations: ['Sử liệu Quang Trung [Nguồn: LEVEL_1]'],
      triplesUsed: [
        {
          source: 'person_quang_trung',
          relation: 'LED_BY',
          target: 'event_ngoc_hoi_dong_da',
          confidence: 1.0,
        },
      ],
      visualAnchors: [
        {
          entityId: 'person_quang_trung',
          label: 'Quang Trung',
          suggestedVisualType: 'PORTRAIT' as const,
          matchedClaimText: 'Vua Quang Trung đại phá quân Thanh năm 1789.',
        },
      ],
      metrics: {
        retrievalLatencyMs: 12.5,
        generationLatencyMs: 450.0,
        ttftMs: 380.0,
        totalTokens: 150,
      },
    };

    const parsed = HistoricalAnswerResponseSchema.parse(mockResponse);
    expect(parsed.visualAnchors).toHaveLength(1);
    expect(parsed.visualAnchors[0].entityId).toBe('person_quang_trung');
    expect(parsed.metrics.ttftMs).toBe(380.0);
  });

  it('should map visual anchors to Remotion layout modes cleanly', () => {
    const visualTypesToLayoutModes: Record<string, string> = {
      PORTRAIT: 'CHARACTER_PROFILE',
      MAP: 'MAP_TACTICAL',
      BATTLE_SCENE: 'FULL_COVER',
      DOCUMENT: 'ROYAL_DECREE',
      HERO_SPOTLIGHT: 'HERO_SPOTLIGHT',
    };

    for (const [vType, lMode] of Object.entries(visualTypesToLayoutModes)) {
      expect(() => LayoutModeSchema.parse(lMode)).not.toThrow();
    }
  });
});
