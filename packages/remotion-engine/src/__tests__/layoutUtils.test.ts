import { describe, it, expect } from 'vitest';
import {
  isPureCodeLayout,
  isFullscreenLayout,
  resolveOverlayPositionStyle,
} from '../utils/layoutUtils';
import { LayoutMode } from '../types';

describe('layoutUtils', () => {
  describe('isPureCodeLayout', () => {
    it('returns true for all 20 pure code layouts', () => {
      const pureCodeModes: LayoutMode[] = [
        'TITLE_CARD',
        'CHAPTER_CARD',
        'STAT_CARD',
        'VERSUS_CARD',
        'QUOTE_SLIDE',
        'BULLET_HIGHLIGHT',
        'TIMELINE_CHRONO',
        'ROYAL_DECREE',
        'MAP_TACTICAL',
        'CHARACTER_PROFILE',
        'ARTIFACT_INSPECT',
        'POEM_RECITING',
        'MUSEUM_TAG',
        'SPLIT_THEORY',
        'ARTICLE_UI',
        'SPONSOR_UI',
        'OUTRO_CARD',
        'QUOTE_CANVAS',
        'HERO_SPOTLIGHT',
        'ARMY_STRENGTH',
      ];

      pureCodeModes.forEach((mode) => {
        expect(isPureCodeLayout(mode)).toBe(true);
      });
    });

    it('returns false for pure image layout modes and undefined', () => {
      const pureImageModes: LayoutMode[] = [
        'BLUR_BG',
        'HISTORICAL_FRAME',
        'FULL_COVER',
        'FULL_CONTAIN',
        'CENTER_SCALE',
        'VIGNETTE_DARK',
        'SPLIT_COMPARE',
        'PURE_IMAGE_FULL',
        'DOCUMENTARY_GRID',
        'NEWSPAPER_ARCHIVE',
        'GALLERY_3D',
      ];

      pureImageModes.forEach((mode) => {
        expect(isPureCodeLayout(mode)).toBe(false);
      });
      expect(isPureCodeLayout(undefined)).toBe(false);
    });
  });

  describe('isFullscreenLayout', () => {
    it('returns true for fullscreen presentation modes', () => {
      expect(isFullscreenLayout('ARTICLE_UI')).toBe(true);
      expect(isFullscreenLayout('TITLE_CARD')).toBe(true);
      expect(isFullscreenLayout('HERO_SPOTLIGHT')).toBe(true);
      expect(isFullscreenLayout('ARMY_STRENGTH')).toBe(true);
      expect(isFullscreenLayout('DOCUMENTARY_GRID')).toBe(true);
    });

    it('returns false for non-fullscreen overlay modes or undefined', () => {
      expect(isFullscreenLayout('BLUR_BG')).toBe(false);
      expect(isFullscreenLayout('HISTORICAL_FRAME')).toBe(false);
      expect(isFullscreenLayout(undefined)).toBe(false);
    });
  });

  describe('resolveOverlayPositionStyle', () => {
    it('returns explicit LEFT position style', () => {
      const style = resolveOverlayPositionStyle('LEFT', 0, 1.0);
      expect(style.left).toBe('40px');
      expect(style.right).toBe('auto');
      expect(style.alignItems).toBe('flex-start');
    });

    it('returns explicit RIGHT position style', () => {
      const style = resolveOverlayPositionStyle('RIGHT', 0, 1.0);
      expect(style.right).toBe('40px');
      expect(style.left).toBe('auto');
      expect(style.alignItems).toBe('flex-end');
    });

    it('returns explicit CENTER position style', () => {
      const style = resolveOverlayPositionStyle('CENTER', 0, 1.0);
      expect(style.left).toBe('50%');
      expect(style.transform).toBe('translateX(-50%)');
      expect(style.alignItems).toBe('center');
    });

    it('auto-alternates between LEFT and RIGHT based on index when position is unspecified', () => {
      const styleEven = resolveOverlayPositionStyle(undefined, 0, 1.0);
      const styleOdd = resolveOverlayPositionStyle(undefined, 1, 1.0);

      expect(styleEven.left).toBe('40px');
      expect(styleOdd.right).toBe('40px');
    });

    it('scales margin and safe areas according to responsive scale multiplier', () => {
      const style = resolveOverlayPositionStyle('LEFT', 0, 1.5);
      expect(style.left).toBe('60px'); // 40 * 1.5
      expect(style.top).toBe('173px'); // Math.round(115 * 1.5)
    });
  });
});
