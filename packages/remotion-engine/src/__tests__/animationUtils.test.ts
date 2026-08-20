import { describe, it, expect } from 'vitest';
import {
  calculateKenBurnsTransform,
  getFilterCss,
  getDefaultKenBurnsForIndex,
} from '../utils/animationUtils';

describe('animationUtils', () => {
  describe('calculateKenBurnsTransform', () => {
    it('computes KEN_BURNS_ZOOM_IN scale interpolation correctly at progress 0 and 1', () => {
      const start = calculateKenBurnsTransform('KEN_BURNS_ZOOM_IN', 0);
      const end = calculateKenBurnsTransform('KEN_BURNS_ZOOM_IN', 1);

      expect(start.scale).toBeCloseTo(1.0, 2);
      expect(start.translateX).toBe(0);
      expect(start.translateY).toBe(0);

      expect(end.scale).toBeCloseTo(1.15, 2);
      expect(end.translateX).toBe(0);
      expect(end.translateY).toBe(0);
    });

    it('computes KEN_BURNS_ZOOM_OUT scale interpolation correctly at progress 0 and 1', () => {
      const start = calculateKenBurnsTransform('KEN_BURNS_ZOOM_OUT', 0);
      const end = calculateKenBurnsTransform('KEN_BURNS_ZOOM_OUT', 1);

      expect(start.scale).toBeCloseTo(1.18, 2);
      expect(end.scale).toBeCloseTo(1.03, 2);
    });

    it('computes KEN_BURNS_PAN_LEFT X translation correctly', () => {
      const start = calculateKenBurnsTransform('KEN_BURNS_PAN_LEFT', 0);
      const end = calculateKenBurnsTransform('KEN_BURNS_PAN_LEFT', 1);

      expect(start.scale).toBe(1.12);
      expect(start.translateX).toBeCloseTo(2, 2);
      expect(end.translateX).toBeCloseTo(-2, 2);
      expect(start.translateY).toBe(0);
    });

    it('computes KEN_BURNS_PAN_RIGHT X translation correctly', () => {
      const start = calculateKenBurnsTransform('KEN_BURNS_PAN_RIGHT', 0);
      const end = calculateKenBurnsTransform('KEN_BURNS_PAN_RIGHT', 1);

      expect(start.scale).toBe(1.12);
      expect(start.translateX).toBeCloseTo(-2, 2);
      expect(end.translateX).toBeCloseTo(2, 2);
    });

    it('computes KEN_BURNS_PAN_UP and PAN_DOWN Y translation correctly', () => {
      const upStart = calculateKenBurnsTransform('KEN_BURNS_PAN_UP', 0);
      const upEnd = calculateKenBurnsTransform('KEN_BURNS_PAN_UP', 1);
      expect(upStart.translateY).toBeCloseTo(2, 2);
      expect(upEnd.translateY).toBeCloseTo(-2, 2);

      const downStart = calculateKenBurnsTransform('KEN_BURNS_PAN_DOWN', 0);
      const downEnd = calculateKenBurnsTransform('KEN_BURNS_PAN_DOWN', 1);
      expect(downStart.translateY).toBeCloseTo(-2, 2);
      expect(downEnd.translateY).toBeCloseTo(2, 2);
    });

    it('supports customKenBurns parameters correctly', () => {
      const custom = {
        scaleFrom: 1.0,
        scaleTo: 1.3,
        originX: 0.2,
        originY: 0.8,
      };
      const transformStart = calculateKenBurnsTransform('KEN_BURNS_ZOOM_IN', 0, custom);
      const transformEnd = calculateKenBurnsTransform('KEN_BURNS_ZOOM_IN', 1, custom);

      expect(transformStart.scale).toBeCloseTo(1.0, 2);
      expect(transformEnd.scale).toBeCloseTo(1.3, 2);
      expect(transformStart.translateX).toBeCloseTo(0, 2);
      expect(transformEnd.translateX).toBeCloseTo(3, 1); // (0.5 - 0.2) * 10 = 3
    });
  });

  describe('getFilterCss', () => {
    it('returns expected CSS filter strings for each filter preset', () => {
      expect(getFilterCss('HISTORICAL')).toBe('sepia(0.2) contrast(1.08) brightness(0.95)');
      expect(getFilterCss('SEPIA')).toBe('sepia(0.4) contrast(1.1) brightness(0.9)');
      expect(getFilterCss('VINTAGE')).toBe('sepia(0.15) contrast(1.05) saturate(0.85) brightness(0.95)');
      expect(getFilterCss('NONE')).toBe('none');
    });
  });

  describe('getDefaultKenBurnsForIndex', () => {
    it('cycles deterministically through the 6 default Ken Burns motion types', () => {
      expect(getDefaultKenBurnsForIndex(0)).toBe('KEN_BURNS_ZOOM_IN');
      expect(getDefaultKenBurnsForIndex(1)).toBe('KEN_BURNS_PAN_RIGHT');
      expect(getDefaultKenBurnsForIndex(2)).toBe('KEN_BURNS_ZOOM_OUT');
      expect(getDefaultKenBurnsForIndex(3)).toBe('KEN_BURNS_PAN_LEFT');
      expect(getDefaultKenBurnsForIndex(4)).toBe('KEN_BURNS_PAN_UP');
      expect(getDefaultKenBurnsForIndex(5)).toBe('KEN_BURNS_PAN_DOWN');
      expect(getDefaultKenBurnsForIndex(6)).toBe('KEN_BURNS_ZOOM_IN');
    });
  });
});
