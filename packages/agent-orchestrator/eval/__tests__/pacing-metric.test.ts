import { describe, it, expect } from 'vitest';
import { durationReconciliationNode } from '../../src/graph/nodes/reconciler-node.js';
import { ChronoGraphState } from '../../src/graph/state.js';

describe('Agent Orchestrator Pacing Metric Unit Tests', () => {
  it('computes script pacing error percentage correctly', async () => {
    const state: any = {
      projectId: 'test_pacing_metric',
      userPrompt: 'Chiến dịch Điện Biên Phủ',
      targetDurationMinutes: 2,
      videoType: 'BATTLE',
      templateId: 'HISTORICAL_DOCUMENTARY',
      status: 'TTS_SYNTHESIZED',
      currentStep: 6,
      chapters: [],
      currentChapterIndex: 0,
      runningNarrativeState: {
        previousChapterSummary: '',
        establishedTone: 'trang trọng',
        introducedEntities: [],
        transitionHook: '',
      },
      chapterScripts: {},
      factCheckLogs: [],
      audioAssets: [],
      scenes: [
        {
          sceneId: 'scene_001',
          sceneIndex: 0,
          voiceoverText: 'Đoạn 1 diễn giải chiến dịch.',
          audioDurationSeconds: 28.5,
          targetDurationSeconds: 30,
          layoutMode: 'MAP_TACTICAL',
          contentType: 'PURE_CODE',
          searchKeywords: ['Điện Biên Phủ'],
          candidates: [],
          usePureCodeFallback: false,
        },
        {
          sceneId: 'scene_002',
          sceneIndex: 1,
          voiceoverText: 'Đoạn 2 diễn giải cứ điểm Him Lam.',
          audioDurationSeconds: 29.0,
          targetDurationSeconds: 30,
          layoutMode: 'SPLIT_COMPARE',
          contentType: 'IMAGE',
          searchKeywords: ['Him Lam'],
          candidates: [],
          usePureCodeFallback: false,
        },
        {
          sceneId: 'scene_003',
          sceneIndex: 2,
          voiceoverText: 'Đoạn 3 diễn giải đồi A1.',
          audioDurationSeconds: 28.0,
          targetDurationSeconds: 30,
          layoutMode: 'FULL_COVER',
          contentType: 'IMAGE',
          searchKeywords: ['Đồi A1'],
          candidates: [],
          usePureCodeFallback: false,
        },
        {
          sceneId: 'scene_004',
          sceneIndex: 3,
          voiceoverText: 'Đoạn 4 chiến thắng vang dội.',
          audioDurationSeconds: 32.0,
          targetDurationSeconds: 30,
          layoutMode: 'QUOTE_CANVAS',
          contentType: 'PURE_CODE',
          searchKeywords: ['Chiến thắng'],
          candidates: [],
          usePureCodeFallback: false,
        },
      ],
    };

    const result = await durationReconciliationNode(state);
    expect(result.pacingErrorPercentage).toBeDefined();
    expect(result.pacingErrorPercentage!).toBeLessThan(3.0);
    const sumDuration = result.scenes!.reduce((sum, s) => sum + s.targetDurationSeconds, 0);
    expect(sumDuration).toBeCloseTo(120, 0);
  });
});
