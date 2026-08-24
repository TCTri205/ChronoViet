import { describe, it, expect } from 'vitest';
import {
  calculateBudgetPacingMetrics,
  evaluateSceneGranularityCompliance,
  evaluateSyntheticDurationReconciliation,
  evaluateHistoricalScriptTone,
} from '../pacing-metrics.js';

describe('Pacing & Duration Budgeting Metrics Unit Tests', () => {
  describe('calculateBudgetPacingMetrics', () => {
    it('calculates total and chapter-level pacing error correctly', () => {
      const chapters = [
        { index: 0, title: 'Mở đầu', targetSeconds: 30, plannedSeconds: 30 },
        { index: 1, title: 'Diễn biến', targetSeconds: 60, plannedSeconds: 62 },
        { index: 2, title: 'Kết thúc', targetSeconds: 30, plannedSeconds: 29 },
      ];
      // Target total: 120s, Planned total: 121s (error: 1/120 = 0.83%)
      const result = calculateBudgetPacingMetrics(120, chapters);
      expect(result.totalPacingErrorPercentage).toBeCloseTo(0.83, 2);
      expect(result.isPassingPacingKpi).toBe(true);
      expect(result.chapterAnalyses).toHaveLength(3);
    });

    it('flags budget overrun when error exceeds tolerance', () => {
      const chapters = [
        { index: 0, targetSeconds: 60, plannedSeconds: 80 }, // 33% error
      ];
      const result = calculateBudgetPacingMetrics(60, chapters, 5.0);
      expect(result.totalPacingErrorPercentage).toBeCloseTo(33.33, 1);
      expect(result.isPassingPacingKpi).toBe(false);
    });
  });

  describe('evaluateSceneGranularityCompliance', () => {
    it('computes 100% compliance when all scenes are in [3, 8] seconds', () => {
      const scenes = [
        { id: 's1', durationSeconds: 4.5 },
        { id: 's2', durationSeconds: 6.0 },
        { id: 's3', durationSeconds: 7.8 },
      ];
      const res = evaluateSceneGranularityCompliance(scenes);
      expect(res.complianceRatePercentage).toBe(100);
      expect(res.isPassingGranularityKpi).toBe(true);
      expect(res.violatingSceneIds).toHaveLength(0);
    });

    it('identifies violating scenes outside bounds', () => {
      const scenes = [
        { id: 's1', durationSeconds: 2.0 }, // under 3s
        { id: 's2', durationSeconds: 5.0 },
        { id: 's3', durationSeconds: 9.5 }, // over 8s
      ];
      const res = evaluateSceneGranularityCompliance(scenes);
      expect(res.complianceRatePercentage).toBeCloseTo(33.33, 1);
      expect(res.isPassingGranularityKpi).toBe(false);
      expect(res.violatingSceneIds).toEqual(['s1', 's3']);
    });
  });

  describe('evaluateSyntheticDurationReconciliation', () => {
    it('reconciles injected audio drift back to exact target duration', () => {
      const targetSeconds = 60;
      const scenes = [
        { id: 's1', plannedDurationSeconds: 20, syntheticDriftFactor: 1.15 }, // +15% -> 23s
        { id: 's2', plannedDurationSeconds: 20, syntheticDriftFactor: 0.90 }, // -10% -> 18s
        { id: 's3', plannedDurationSeconds: 20, syntheticDriftFactor: 1.05 }, // +5% -> 21s
      ];

      // Proportional reconciler mock
      const mockReconcile = (drifted: any[]) => {
        const totalDrifted = drifted.reduce((sum, s) => sum + s.audioDurationSeconds, 0);
        const scale = targetSeconds / totalDrifted;
        return drifted.map((s) => ({
          id: s.id,
          targetDurationSeconds: s.audioDurationSeconds * scale,
        }));
      };

      const res = evaluateSyntheticDurationReconciliation(targetSeconds, scenes, mockReconcile);
      expect(res.reconciledDurationSeconds).toBeCloseTo(60, 0);
      expect(res.reconciliationErrorPercentage).toBeLessThan(0.1);
      expect(res.isFullyReconciled).toBe(true);
    });
  });

  describe('evaluateHistoricalScriptTone', () => {
    it('awards high tone score to solemn historical script with correct entities', () => {
      const script = 'Vào thế kỷ X, Ngô Quyền đã lãnh đạo quân sĩ Đại Việt giành thắng lợi lịch sử trên sông Bạch Đằng, mở ra kỷ nguyên độc lập và tự chủ cho dân tộc.';
      const res = evaluateHistoricalScriptTone(script, ['Ngô Quyền', 'Bạch Đằng']);
      expect(res.isPassingTone).toBe(true);
      expect(res.solemnityScore).toBeGreaterThanOrEqual(80);
      expect(res.slangPenalty).toBe(0);
      expect(res.entityCoveragePercentage).toBe(100);
      expect(res.isPassingEntityContinuity).toBe(true);
      expect(res.detectedSlangTerms).toHaveLength(0);
    });

    it('penalizes modern slang and casual expressions', () => {
      const slangScript = 'Ngô Quyền đánh trận này vãi thật, chém gió ảo ma và quân địch toang luôn ok chưa.';
      const res = evaluateHistoricalScriptTone(slangScript, ['Ngô Quyền']);
      expect(res.isPassingTone).toBe(false);
      expect(res.slangPenalty).toBeGreaterThan(50);
      expect(res.detectedSlangTerms.length).toBeGreaterThanOrEqual(3);
    });

    it('identifies missing expected entities strictly without length shortcuts', () => {
      const genericScript = 'Trận đánh này rất hào hùng và trang trọng, là một bước ngoặt lịch sử vĩ đại của dân tộc nghìn năm văn hiến.';
      const res = evaluateHistoricalScriptTone(genericScript, ['Trần Hưng Đạo', 'Quang Trung']);
      expect(res.entityCoveragePercentage).toBe(0);
      expect(res.missingEntities).toEqual(['Trần Hưng Đạo', 'Quang Trung']);
      expect(res.isPassingEntityContinuity).toBe(false);
    });

    it('handles empty script gracefully', () => {
      const res = evaluateHistoricalScriptTone('', ['Ngô Quyền']);
      expect(res.toneScorePercentage).toBe(0);
      expect(res.isPassingTone).toBe(false);
      expect(res.missingEntities).toEqual(['Ngô Quyền']);
    });
  });
});
