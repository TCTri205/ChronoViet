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
});
