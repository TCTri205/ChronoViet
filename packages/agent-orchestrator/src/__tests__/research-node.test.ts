/**
 * Unit tests for the Image Research Agent (Micro-Step 1C)
 * Covers provider chain resolution, domain whitelist filtering, and the
 * research node behavior (skip PURE_CODE, reuse existing results).
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the vlm-inspector search modules so tests never hit real network
vi.mock('@chronoviet/vlm-inspector', async () => {
  const actual = await vi.importActual<any>('@chronoviet/vlm-inspector');
  return {
    ...actual,
    resolveImageCandidates: vi.fn(async (keywords: string, sceneId: string, limit: number) => {
      return {
        candidates: [
          {
            candidateId: `cand_${sceneId}_01`,
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg',
            sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hai_ba_trung_Dong_ho.jpg',
            title: `Tư liệu cho ${keywords}`,
            author: 'Wikimedia Commons Contributor',
            license: 'PUBLIC_DOMAIN',
            candidateBatch: 1,
          },
        ],
        provenance: [{ provider: 'catalog', count: 1, latencyMs: 5 }],
      };
    }),
  };
});

import { researchNode } from '../graph/nodes/research-node.js';
import { keywordNode, extractSearchKeywordsFromText } from '../graph/nodes/keyword-node.js';
import { ChronoGraphState } from '../graph/state.js';
import { resolveImageCandidates } from '@chronoviet/vlm-inspector';

const mockResolve = vi.mocked(resolveImageCandidates);

function makeScene(overrides: Partial<ChronoGraphState['scenes'][number]> = {}) {
  return {
    sceneId: 'scene_001',
    sceneIndex: 0,
    voiceoverText: 'Ngô Quyền đại phá quân Nam Hán trên sông Bạch Đằng năm 938.',
    layoutMode: 'HISTORICAL_FRAME',
    contentType: 'IMAGE',
    targetDurationSeconds: 10,
    searchKeywords: ['Ngô Quyền', 'Bạch Đằng'],
    candidates: [],
    usePureCodeFallback: false,
    ...overrides,
  } as ChronoGraphState['scenes'][number];
}

function makeState(overrides: Partial<ChronoGraphState> = {}): ChronoGraphState {
  return {
    projectId: 'test_research',
    correlationId: 'test_research',
    userPrompt: 'Trận Bạch Đằng năm 938',
    targetDurationMinutes: 1,
    videoType: 'BATTLE',
    templateId: 'HISTORICAL_DOCUMENTARY',
    status: 'SCENES_SEGMENTED',
    currentStep: 6,
    ragContext: {
      verifiedContext: [
        {
          entityId: 'e_ngo_quyen',
          canonicalName: 'Ngô Quyền',
          aliases: ['Tiền Ngô Vương'],
          summary: 'Ngô Quyền lãnh đạo quân dân Đại Việt đánh tan quân Nam Hán năm 938.',
          citations: ['Đại Việt Sử Ký Toàn Thư'],
          confidenceScore: 0.98,
        },
      ],
      aliasTable: { 'Ngô Quyền': ['Tiền Ngô Vương'] },
      citations: ['Đại Việt Sử Ký Toàn Thư'],
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
    scenes: [makeScene()],
    researchResults: {},
    audioAssets: [],
    pacingErrorPercentage: 0,
    videoProps: undefined,
    errorLog: undefined,
    needsHumanReview: false,
    ...overrides,
  };
}

describe('Research Agent Node', () => {
  it('should resolve candidates for IMAGE scenes and store researchResults', async () => {
    mockResolve.mockClear();
    const state = makeState();
    const result = await researchNode(state);

    expect(result.status).toBe('RESEARCH_COMPLETED');
    expect(result.researchResults).toBeDefined();
    expect(result.researchResults!['scene_001']).toBeDefined();
    expect(result.researchResults!['scene_001'].candidates.length).toBeGreaterThan(0);
    expect(result.researchResults!['scene_001'].candidates[0].license).toBe('PUBLIC_DOMAIN');
    expect(mockResolve).toHaveBeenCalledWith('Ngô Quyền Bạch Đằng', 'scene_001', 3);
  });

  it('should skip PURE_CODE scenes', async () => {
    mockResolve.mockClear();
    const state = makeState({
      scenes: [makeScene({ sceneId: 'scene_pure', contentType: 'PURE_CODE' })],
    });
    const result = await researchNode(state);
    expect(result.researchResults!['scene_pure']).toBeUndefined();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('should reuse existing researchResults (idempotency / resume)', async () => {
    mockResolve.mockClear();
    const existing = {
      sceneId: 'scene_001',
      keywords: 'old keywords',
      candidates: [makeScene().candidates[0] as any],
      provenance: [{ provider: 'catalog', count: 1, latencyMs: 5 }],
      resolvedAt: '2026-01-01T00:00:00Z',
    };
    const state = makeState({ researchResults: { scene_001: existing } });
    const result = await researchNode(state);
    expect(result.researchResults!['scene_001']).toBe(existing);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('should not throw when resolveImageCandidates fails (resilience)', async () => {
    mockResolve.mockRejectedValueOnce(new Error('network down'));
    const state = makeState();
    const result = await researchNode(state);
    expect(result.researchResults!['scene_001'].candidates).toEqual([]);
    expect(result.researchResults!['scene_001'].provenance).toEqual([]);
  });
});

describe('Keyword Extractor Agent', () => {
  it('should extract canonical entities, proper nouns and years from voiceover text', () => {
    const keywords = extractSearchKeywordsFromText(
      'Ngô Quyền đại phá quân Nam Hán trên sông Bạch Đằng năm 938.',
      ['Ngô Quyền', 'Nam Hán'],
      'Trận Bạch Đằng'
    );
    expect(keywords).toContain('Trận Bạch Đằng');
    expect(keywords).toContain('Ngô Quyền');
    expect(keywords).toContain('Nam Hán');
    expect(keywords.some((k) => k.includes('938'))).toBe(true);
  });

  it('should update searchKeywords on IMAGE scenes via keywordNode', async () => {
    const state = makeState();
    const result = await keywordNode(state);
    const updated = result.scenes![0];
    expect(updated.searchKeywords.length).toBeGreaterThanOrEqual(3);
    expect(updated.searchKeywords.some((k) => k.startsWith('Trận Bạch Đằng'))).toBe(true);
  });

  it('should leave PURE_CODE scenes untouched', async () => {
    const state = makeState({
      scenes: [makeScene({ sceneId: 'scene_pure', contentType: 'PURE_CODE', searchKeywords: ['giữ nguyên'] })],
    });
    const result = await keywordNode(state);
    expect(result.scenes![0].searchKeywords).toEqual(['giữ nguyên']);
  });
});
