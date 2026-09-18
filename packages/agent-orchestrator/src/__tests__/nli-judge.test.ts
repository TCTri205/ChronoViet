import { describe, it, expect } from 'vitest';
import { evaluateNliEntailmentScore } from '../guardrails/nli-hallucination-judge.js';

describe('Enhanced NLI Hallucination Judge', () => {
  it('should score high entailment for historically consistent claims within epoch bounds', () => {
    const request = {
      scriptClaim: 'Năm 981, Lê Hoàn lãnh đạo quân dân Đại Cồ Việt đánh bại quân Tống trên sông Bạch Đằng.',
      groundTruthChunks: [
        'Lê Hoàn (Lê Đại Hành) đánh tan quân Tống xâm lược trong trận thủy chiến trên sông Bạch Đằng năm 981.',
      ],
      epochBounds: {
        startYear: 980,
        endYear: 1009,
      },
    };

    const result = evaluateNliEntailmentScore(request);
    expect(result.entailmentScore).toBeGreaterThanOrEqual(0.80);
    expect(result.isHallucinated).toBe(false);
    expect(result.verdict).toBe('ENTAILMENT');
  });

  it('should severely penalize entailment score and flag contradiction when script claims out-of-epoch years (> 50 years deviation)', () => {
    const request = {
      scriptClaim: 'Năm 1428, Lê Hoàn đã chỉ huy quân đội đánh tan quân Tống trên sông Bạch Đằng.',
      groundTruthChunks: [
        'Lê Hoàn (Lê Đại Hành) đánh tan quân Tống xâm lược trong trận thủy chiến trên sông Bạch Đằng năm 981.',
      ],
      epochBounds: {
        startYear: 980,
        endYear: 1009,
      },
    };

    const result = evaluateNliEntailmentScore(request);
    expect(result.entailmentScore).toBeLessThan(0.60);
    expect(result.isHallucinated).toBe(true);
    expect(result.explanation).toContain('Chronological Anomaly');
  });

  it('should penalize impossible pairings across centuries (e.g. 1954 in a 1288 topic)', () => {
    const request = {
      scriptClaim: 'Năm 1954, Hưng Đạo Đại Vương Trần Quốc Tuấn đã lãnh đạo trận Bạch Đằng lịch sử.',
      groundTruthChunks: [
        'Năm 1288, Trần Quốc Tuấn đại thắng quân Nguyên Mông trên sông Bạch Đằng.',
      ],
      epochBounds: {
        startYear: 1258,
        endYear: 1288,
      },
    };

    const result = evaluateNliEntailmentScore(request);
    expect(result.entailmentScore).toBeLessThan(0.60);
    expect(result.isHallucinated).toBe(true);
    expect(result.explanation).toContain('1954');
  });

  it('should recognize legitimate genealogical and retrospective references without dynasty anomaly penalties', () => {
    const request = {
      scriptClaim: 'Năm 40, Trưng Trắc cùng em gái là Trưng Nhị phất cờ khởi nghĩa. Bà vốn là dòng dõi Hùng Vương kiên cường.',
      groundTruthChunks: [
        'Năm 40, Hai Bà Trưng lãnh đạo cuộc khởi nghĩa chống lại ách đô hộ của nhà Đông Hán.',
        'Trưng Trắc là con gái Lạc tướng Mê Linh, dòng dõi Hùng Vương.',
      ],
      epochBounds: {
        startYear: 40,
        endYear: 43,
      },
    };

    const result = evaluateNliEntailmentScore(request);
    expect(result.explanation).not.toContain('Dynasty Anomaly');
    expect(result.entailmentScore).toBeGreaterThanOrEqual(0.80);
    expect(result.isHallucinated).toBe(false);
  });

  it('should penalize anachronistic dynasty intrusion when no legitimate retrospective context exists', () => {
    const request = {
      scriptClaim: 'Năm 40, vua Gia Long đã chỉ huy nghĩa quân tiến đánh thái thú Tô Định.',
      groundTruthChunks: [
        'Năm 40, Hai Bà Trưng lãnh đạo cuộc khởi nghĩa chống lại ách đô hộ của nhà Đông Hán và thái thú Tô Định.',
      ],
      epochBounds: {
        startYear: 40,
        endYear: 43,
      },
    };

    const result = evaluateNliEntailmentScore(request);
    expect(result.explanation).toContain('Dynasty Anomaly');
    expect(result.entailmentScore).toBeLessThan(0.60);
    expect(result.isHallucinated).toBe(true);
  });

  it('should penalize geographical containment contradiction in script claims', () => {
    const request = {
      scriptClaim: 'Năm 968, Đinh Tiên Hoàng đóng đô tại cố đô Hoa Lư thuộc tỉnh Nghệ An.',
      groundTruthChunks: [
        'Đinh Bộ Lĩnh thống nhất 12 sứ quân, lập nên nhà Đinh và định đô tại Hoa Lư, Ninh Bình.',
      ],
      epochBounds: {
        startYear: 968,
        endYear: 980,
      },
    };

    const result = evaluateNliEntailmentScore(request);
    expect(result.explanation).toContain('Geographic Anomaly');
    expect(result.entailmentScore).toBeLessThan(0.60);
    expect(result.isHallucinated).toBe(true);
  });
});
