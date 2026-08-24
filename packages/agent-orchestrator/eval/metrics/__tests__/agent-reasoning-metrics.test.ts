import { describe, it, expect } from 'vitest';
import {
  calculateIntentMetrics,
  calculateSlotMetrics,
  calculateChronologicalFlowScore,
  calculateAntiSycophancyScore,
  calculateNarrativeWordDensity,
  calculateEntityRelationGroundingScore,
  extractHistoricalTimepoint,
} from '../agent-reasoning-metrics.js';

describe('Agent Reasoning Metrics Unit Tests', () => {
  describe('extractHistoricalTimepoint', () => {
    it('extracts BCE / TCN years correctly as negative numbers', () => {
      expect(extractHistoricalTimepoint('Thời kỳ An Dương Vương năm 257 TCN lập nước Âu Lạc')).toBe(-257);
      expect(extractHistoricalTimepoint('Hùng Vương lập nước Văn Lang năm 2000 trước công nguyên')).toBe(-2000);
    });

    it('extracts CE / SCN 3-4 digit years correctly', () => {
      expect(extractHistoricalTimepoint('Trận Bạch Đằng năm 938 của Ngô Quyền')).toBe(938);
      expect(extractHistoricalTimepoint('Chiến thắng Ngọc Hồi Đống Đa năm 1789')).toBe(1789);
      expect(extractHistoricalTimepoint('Chiến dịch Điện Biên Phủ 1954')).toBe(1954);
    });

    it('extracts century periods correctly', () => {
      expect(extractHistoricalTimepoint('Khởi nghĩa Lam Sơn đầu thế kỷ XV')).toBe(1450);
      expect(extractHistoricalTimepoint('Thời kỳ Bắc thuộc thế kỷ X')).toBe(950);
    });

    it('identifies epoch keywords accurately', () => {
      expect(extractHistoricalTimepoint('Triều đại nhà Lý thái bình thịnh trị')).toBe(1009);
      expect(extractHistoricalTimepoint('Nhà Trần ba lần kháng chiến chống Nguyên Mông')).toBe(1225);
      expect(extractHistoricalTimepoint('Khởi nghĩa Hai Bà Trưng')).toBe(40);
    });
  });

  describe('calculateIntentMetrics', () => {
    it('handles empty input gracefully', () => {
      const result = calculateIntentMetrics([]);
      expect(result.accuracy).toBe(0);
      expect(result.macroF1).toBe(0);
      expect(result.totalCount).toBe(0);
    });

    it('calculates perfect multi-class classification metrics correctly', () => {
      const items = [
        { predicted: 'CREATE_VIDEO_PROJECT', actual: 'CREATE_VIDEO_PROJECT' },
        { predicted: 'EDIT_VIDEO_SCENE', actual: 'EDIT_VIDEO_SCENE' },
        { predicted: 'HISTORICAL_QUERY', actual: 'HISTORICAL_QUERY' },
        { predicted: 'CHITCHAT', actual: 'CHITCHAT' },
      ];
      const result = calculateIntentMetrics(items);
      expect(result.accuracy).toBe(100);
      expect(result.macroF1).toBe(100);
      expect(result.microF1).toBe(100);
      expect(result.totalCount).toBe(4);
    });

    it('calculates realistic confusion matrix and per-class precision/recall', () => {
      const items = [
        { predicted: 'CREATE_VIDEO_PROJECT', actual: 'CREATE_VIDEO_PROJECT' },
        { predicted: 'CREATE_VIDEO_PROJECT', actual: 'HISTORICAL_QUERY' }, // False positive for CREATE, False negative for QUERY
        { predicted: 'HISTORICAL_QUERY', actual: 'HISTORICAL_QUERY' },
      ];
      const result = calculateIntentMetrics(items);
      expect(result.accuracy).toBeCloseTo(66.67, 1);
      expect(result.perClass['CREATE_VIDEO_PROJECT'].precision).toBe(50);
      expect(result.perClass['CREATE_VIDEO_PROJECT'].recall).toBe(100);
      expect(result.perClass['HISTORICAL_QUERY'].recall).toBe(50);
    });
  });

  describe('calculateSlotMetrics', () => {
    it('computes exact and partial slot extractions', () => {
      const items = [
        {
          predicted: { topic: 'Quang Trung', duration: 3 },
          actual: { topic: 'Quang Trung', duration: 3 },
        },
        {
          predicted: { topic: 'Trần Hưng Đạo', epoch: 'Trần' },
          actual: { topic: 'Trần Hưng Đạo', epoch: 'Nhà Trần', duration: 4 },
        },
      ];
      const result = calculateSlotMetrics(items);
      expect(result.totalSlots).toBe(5);
      expect(result.matchedSlots).toBe(3);
      expect(result.exactMatchRate).toBe(50);
      expect(result.precision).toBeGreaterThan(0);
      expect(result.recall).toBeGreaterThan(0);
    });
  });

  describe('calculateChronologicalFlowScore', () => {
    it('returns 100% for monotonic chronological sequence of years', () => {
      const years = [938, 968, 1009, 1077, 1288, 1428, 1789];
      const res = calculateChronologicalFlowScore(years);
      expect(res.kendallTau).toBe(1.0);
      expect(res.flowScorePercentage).toBe(100.0);
      expect(res.isMonotonic).toBe(true);
      expect(res.discordantPairs).toBe(0);
    });

    it('penalizes inverted chronological sequence of years', () => {
      const reversedYears = [1789, 1428, 1288, 1077, 938];
      const res = calculateChronologicalFlowScore(reversedYears);
      expect(res.kendallTau).toBe(-1.0);
      expect(res.flowScorePercentage).toBe(0.0);
      expect(res.isMonotonic).toBe(false);
      expect(res.discordantPairs).toBe(10);
    });

    it('evaluates chronological flow from chapter outline objects with historical dates', () => {
      const chapters = [
        { title: 'Chương 1: Trận Bạch Đằng năm 938 mở đầu kỷ nguyên độc lập', summary: 'Ngô Quyền đánh tan quân Nam Hán' },
        { title: 'Chương 2: Phòng tuyến sông Như Nguyệt năm 1077', summary: 'Lý Thường Kiệt lãnh đạo kháng chiến chống Tống' },
        { title: 'Chương 3: Chiến thắng Bạch Đằng 1288', summary: 'Trần Hưng Đạo bắt sống tướng giặc Ô Mã Nhi' },
      ];
      const res = calculateChronologicalFlowScore(chapters);
      expect(res.kendallTau).toBe(1.0);
      expect(res.flowScorePercentage).toBe(100.0);
      expect(res.isMonotonic).toBe(true);
      expect(res.extractedTimeline).toBeDefined();
      expect(res.extractedTimeline?.[0].yearOrRank).toBe(938);
      expect(res.extractedTimeline?.[1].yearOrRank).toBe(1077);
      expect(res.extractedTimeline?.[2].yearOrRank).toBe(1288);
    });

    it('flags chronological inversion in chapter objects', () => {
      const badChapters = [
        { title: 'Chương 1: Chiến thắng Điện Biên Phủ 1954' },
        { title: 'Chương 2: Trận Bạch Đằng năm 938' },
      ];
      const res = calculateChronologicalFlowScore(badChapters);
      expect(res.kendallTau).toBe(-1.0);
      expect(res.flowScorePercentage).toBe(0.0);
      expect(res.isMonotonic).toBe(false);
    });
  });

  describe('calculateAntiSycophancyScore', () => {
    it('measures adversarial rejection rate, trap breakdowns and premise corrections', () => {
      const audits = [
        { rejected: true, groundTruthIsAdversarial: true, trapType: 'SYCOPHANCY_TRAP', correctedPremise: true },
        { rejected: true, groundTruthIsAdversarial: true, trapType: 'FAKE_KINSHIP', correctedPremise: true },
        { rejected: false, groundTruthIsAdversarial: true, trapType: 'ANACHRONISM', sycophanticAgreementDetected: true },
        { rejected: false, groundTruthIsAdversarial: false },
        { rejected: false, groundTruthIsAdversarial: false },
      ];
      const res = calculateAntiSycophancyScore(audits as any);
      expect(res.adversarialRejectionRate).toBeCloseTo(66.67, 1);
      expect(res.falsePositiveRejectionRate).toBe(0);
      expect(res.overallAccuracy).toBe(80);
      expect(res.sycophancyDefeatRate).toBeCloseTo(66.67, 1);
      expect(res.premiseCorrectionRate).toBeCloseTo(66.67, 1);
      expect(res.perTrapRejectionRate['SYCOPHANCY_TRAP'].rate).toBe(100);
      expect(res.perTrapRejectionRate['ANACHRONISM'].rate).toBe(0);
    });
  });

  describe('calculateNarrativeWordDensity', () => {
    it('calculates WPM accurately within optimal range [130, 170]', () => {
      const text = Array(150).fill('từ').join(' ');
      const res = calculateNarrativeWordDensity(text, 60, [130, 170]);
      expect(res.wordsPerMinute).toBe(150);
      expect(res.isWithinOptimalPacing).toBe(true);
      expect(res.deviationPercentage).toBe(0);
    });

    it('flags rushing or overly slow narration', () => {
      const fastText = Array(220).fill('nhanh').join(' ');
      const res = calculateNarrativeWordDensity(fastText, 60, [130, 170]);
      expect(res.wordsPerMinute).toBe(220);
      expect(res.isWithinOptimalPacing).toBe(false);
      expect(res.deviationPercentage).toBeGreaterThan(0);
    });
  });

  describe('calculateEntityRelationGroundingScore', () => {
    it('computes entity and triple precision/recall accurately', () => {
      const gold = [
        { subject: 'Ngô Quyền', predicate: 'LED_BY', object: 'Trận Bạch Đằng 938' },
        { subject: 'Ngô Quyền', predicate: 'ALIAS_OF', object: 'Tiền Ngô Vương' },
      ];
      const pred = [
        { subject: 'Ngô Quyền', predicate: 'LED_BY', object: 'Trận Bạch Đằng 938' },
        { subject: 'Ngô Quyền', predicate: 'DEFEATED', object: 'Hoằng Tháo' },
      ];
      const res = calculateEntityRelationGroundingScore(pred, gold);
      expect(res.triplePrecision).toBe(50);
      expect(res.tripleRecall).toBe(50);
      expect(res.tripleF1).toBe(50);
      expect(res.entityPrecision).toBeGreaterThan(0);
    });
  });
});

