import { describe, it, expect, vi } from 'vitest';
import { durationReconciliationNode } from '../graph/nodes/reconciler-node.js';
import { validateFolkloreHypothesisTone } from '../guardrails/folklore-validator.js';
import { ChronoGraphState } from '../graph/state.js';
import { defaultCheckpointer } from '../graph/checkpointer.js';
import { runOrchestratorPipeline, resumeOrchestratorPipeline } from '../graph/orchestrator.js';

// Mock callLlm for deterministic unit testing
vi.mock('@chronoviet/shared-spec', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    callLlm: vi.fn().mockImplementation(async ({ messages, responseFormat }) => {
      const prompt = messages[0]?.content || '';
      if (responseFormat === 'json_object' || prompt.includes('JSON')) {
        return {
          content: JSON.stringify([
            {
              chapterIndex: 0,
              title: 'Hồi 1: Trận chiến trên sông Bạch Đằng',
              summary: 'Ngô Quyền tổ chức cọc ngầm và đánh tan quân Nam Hán.',
              targetDurationSeconds: 60,
              keyEvents: ['Đóng cọc ngầm', 'Dụ địch vào trận địa'],
              introducedEntities: ['Ngô Quyền', 'Lưu Hoằng Thao'],
              transitionHook: 'Chiến thắng mở ra kỷ nguyên độc lập.',
              establishedTone: 'Hùng tráng',
            },
          ]),
        };
      }
      return {
        content:
          'Năm 938, trên dòng sông Bạch Đằng lịch sử, Tiền Ngô Vương Ngô Quyền đã lãnh đạo quân dân Đại Việt lập nên chiến công hiển hách. Trận đánh vang dội này đã vĩnh viễn chấm dứt hơn một nghìn năm Bắc thuộc, mở ra kỷ nguyên độc lập tự chủ lâu dài cho dân tộc ta.',
      };
    }),
  };
});

// Mock VLM inspector so the E2E pipeline does not require a live VLM server
vi.mock('@chronoviet/vlm-inspector', async () => {
  const actual = await vi.importActual<any>('@chronoviet/vlm-inspector');
  return {
    ...actual,
    resolveImageCandidates: vi.fn(async (keywords: string, sceneId: string, limit: number) => ({
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
    })),
    inspectSceneVisuals: vi.fn(async (_projectId: string, scene: any, candidates: any[]) => {
      const top = candidates[0];
      return {
        updatedScene: {
          ...scene,
          candidates,
          selectedAsset: top || undefined,
          layoutMode: top ? 'HISTORICAL_FRAME' : 'STAT_CARD',
          contentType: top ? 'IMAGE' : 'PURE_CODE',
          usePureCodeFallback: !top,
        },
        inspectedCandidates: candidates,
        selectedCandidate: top,
        isPureCodeFallback: !top,
        selectedLayoutMode: top ? 'HISTORICAL_FRAME' : 'STAT_CARD',
      };
    }),
  };
});

// Mock VieNeu TTS so the E2E pipeline does not require the Python ONNX service
vi.mock('@chronoviet/vieneu-tts', async () => {
  const actual = await vi.importActual<any>('@chronoviet/vieneu-tts');
  return {
    ...actual,
    VieNeuEngine: class {
      async synthesize(opts: any) {
        const words = (opts.text || '').split(/\s+/).filter(Boolean);
        const durationMs = Math.max(2000, words.length * 350);
        return {
          status: 'SUCCESS',
          audioUrl: '/static/audio/mock.wav',
          audioDurationMs: durationMs,
          calculatedFramesAt30fps: Math.ceil((durationMs / 1000) * 30),
          wordTimestamps: words.map((w: string, i: number) => ({
            word: w,
            startMs: Math.round((i * 350) + 100),
            endMs: Math.round((i * 350) + 100 + 250),
          })),
          engineType: 'MOCK_VieNeuEngine',
        };
      }
    },
    createSyntheticWavBuffer: () => Buffer.alloc(0),
  };
});

describe('Agent Orchestrator Unit Tests', () => {
  describe('Duration Reconciliation Node', () => {
    it('should reconcile scene durations and maintain pacing error < 3%', async () => {
      const mockState: Partial<ChronoGraphState> = {
        projectId: 'test_reconciler_bounds',
        userPrompt: 'Test Prompt',
        targetDurationMinutes: 1, // 60s
        videoType: 'BIOGRAPHY',
        templateId: 'HISTORICAL_DOCUMENTARY',
        status: 'TTS_SYNTHESIZED',
        currentStep: 7,
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
        scenes: [
          {
            sceneId: 'sc_001',
            sceneIndex: 0,
            voiceoverText: 'Cảnh 1 siêu ngắn',
            layoutMode: 'HISTORICAL_FRAME',
            contentType: 'IMAGE',
            searchKeywords: ['ngô quyền'],
            candidates: [],
            usePureCodeFallback: false,
            targetDurationSeconds: 10,
            audioDurationSeconds: 8.2,
          },
          {
            sceneId: 'sc_002',
            sceneIndex: 1,
            voiceoverText: 'Cảnh 2 phân đoạn lịch sử',
            layoutMode: 'HISTORICAL_FRAME',
            contentType: 'IMAGE',
            searchKeywords: ['ngô quyền'],
            candidates: [],
            usePureCodeFallback: false,
            targetDurationSeconds: 40,
            audioDurationSeconds: 38.6,
          },
        ],
        audioAssets: [],
      };

      const result = await durationReconciliationNode(mockState as ChronoGraphState);
      expect(result.scenes).toBeDefined();
      expect(result.scenes?.length).toBe(2);
      expect(result.pacingErrorPercentage).toBeLessThan(3.0);

      const totalReconciled = result.scenes!.reduce((sum, s) => sum + s.targetDurationSeconds, 0);
      expect(Math.abs(totalReconciled - 60)).toBeLessThanOrEqual(1.8);
    });

    it('should protect audio duration when voiceover exceeds estimated target', async () => {
      const mockState: Partial<ChronoGraphState> = {
        projectId: 'test_reconciler_audio_protect',
        targetDurationMinutes: 1,
        scenes: [
          {
            sceneId: 'sc_001',
            sceneIndex: 0,
            voiceoverText: 'Cảnh thuyết minh dài',
            layoutMode: 'HISTORICAL_FRAME',
            contentType: 'IMAGE',
            searchKeywords: ['quang trung'],
            candidates: [],
            usePureCodeFallback: false,
            targetDurationSeconds: 20,
            audioDurationSeconds: 28.5,
          },
        ],
      };

      const result = await durationReconciliationNode(mockState as ChronoGraphState);
      expect(result.scenes![0].targetDurationSeconds).toBeGreaterThanOrEqual(29);
    });
  });

  describe('Folklore Guardrail', () => {
    it('should validate hypothesis framing for folklore sources', () => {
      const validText = 'Theo truyền thuyết dân gian kể lại, Sơn Tinh và Thủy Tinh tranh giành Mỵ Nương.';
      const res1 = validateFolkloreHypothesisTone(validText, true);
      expect(res1.isValid).toBe(true);

      const invalidText = 'Chắc chắn 100% sự việc đã xảy ra y như vậy không cần bàn cãi.';
      const res2 = validateFolkloreHypothesisTone(invalidText, true);
      expect(res2.isValid).toBe(false);
    });

    it('should skip validation for non-folklore sources', () => {
      const historicalText = 'Ngô Quyền đại phá quân Nam Hán trên sông Bạch Đằng năm 938.';
      const res = validateFolkloreHypothesisTone(historicalText, false);
      expect(res.isValid).toBe(true);
    });
  });

  describe('Native Checkpointing & Persistence', () => {
    it('should save and reload latest state snapshot', async () => {
      const testProjectId = 'test_checkpointer_proj_001';
      const sampleState: Partial<ChronoGraphState> = {
        projectId: testProjectId,
        userPrompt: 'Ngô Quyền đại phá quân Nam Hán',
        targetDurationMinutes: 1,
        status: 'OUTLINE_CHAPTERED',
        currentStep: 3,
      };

      // Put checkpoint
      await defaultCheckpointer.put(
        { configurable: { thread_id: testProjectId } },
        {
          v: 1,
          id: 'cp_001',
          ts: '2026-08-15T00:00:00Z',
          channel_values: sampleState,
          channel_versions: {},
          versions_seen: {},
          pending_sends: [],
        },
        { source: 'update', step: 1, writes: {}, parents: {} }
      );

      const loaded = await defaultCheckpointer.loadLatestProjectState(testProjectId);
      expect(loaded).toBeDefined();
      expect(loaded?.projectId).toBe(testProjectId);
      expect(loaded?.status).toBe('OUTLINE_CHAPTERED');
    });
  });

  describe('End-to-End Orchestrator Pipeline', () => {
    it('should execute full pipeline and produce validated video props with pacing error < 3%', async () => {
      const projectId = 'test_pipeline_e2e_001';
      const initialState: Partial<ChronoGraphState> = {
        projectId,
        userPrompt: 'Chiến thắng Bạch Đằng năm 938',
        targetDurationMinutes: 1,
        videoType: 'BATTLE',
        templateId: 'HISTORICAL_DOCUMENTARY',
        status: 'INIT',
        currentStep: 1,
        ragContext: {
          verifiedContext: [
            {
              entityId: 'e_ngo_quyen',
              canonicalName: 'Ngô Quyền',
              aliases: ['Tiền Ngô Vương'],
              summary: 'Ngô Quyền lãnh đạo quân dân Đại Việt đánh tan quân Nam Hán trên sông Bạch Đằng năm 938.',
              citations: ['Đại Việt Sử Ký Toàn Thư'],
              confidenceScore: 0.98,
            },
          ],
          aliasTable: {
            'Ngô Quyền': ['Tiền Ngô Vương'],
          },
          citations: ['Đại Việt Sử Ký Toàn Thư'],
        },
      };

      const finalState = await runOrchestratorPipeline(initialState as ChronoGraphState, {
        resumeFromCheckpoint: false,
      });

      expect(finalState.status).toBe('COMPLETED');
      expect(finalState.videoProps).toBeDefined();
      expect(finalState.videoProps?.timeline.length).toBeGreaterThan(0);
      expect(finalState.pacingErrorPercentage).toBeDefined();
      expect(finalState.pacingErrorPercentage!).toBeLessThan(3.0);
    }, 30000);
  });
});
