import { describe, it, expect } from 'vitest';
import {
  isPureCodeLayout,
  isFullscreenLayout,
  resolveOverlayPositionStyle,
  isSevereAspectRatioMismatch,
  resolveSafeLayoutMode,
  calculateSafeImageBounds,
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

  describe('isSevereAspectRatioMismatch', () => {
    const canvas16x9 = 1920 / 1080; // ~1.777
    const canvas9x16 = 1080 / 1920; // ~0.5625
    const canvas1x1 = 1.0;

    it('detects severe mismatch for extreme vertical images in 16:9 canvas', () => {
      const verticalDecree = 1 / 3; // 0.333
      const verticalStela = 1 / 2; // 0.5
      const verticalPortrait = 2 / 3; // 0.667

      expect(isSevereAspectRatioMismatch(verticalDecree, canvas16x9)).toBe(true);
      expect(isSevereAspectRatioMismatch(verticalStela, canvas16x9)).toBe(true);
      expect(isSevereAspectRatioMismatch(verticalPortrait, canvas16x9)).toBe(true);
    });

    it('detects severe mismatch for extreme horizontal panorama in 16:9 canvas', () => {
      const ultraWidePanorama = 3.5; // 3.5:1
      expect(isSevereAspectRatioMismatch(ultraWidePanorama, canvas16x9)).toBe(true);
    });

    it('detects severe mismatch for 16:9 landscape image in 9:16 vertical canvas', () => {
      const landscapeImage = 16 / 9; // 1.777
      expect(isSevereAspectRatioMismatch(landscapeImage, canvas9x16)).toBe(true);
    });

    it('returns false when aspect ratios are compatible', () => {
      // 16:9 image in 16:9 canvas
      expect(isSevereAspectRatioMismatch(16 / 9, canvas16x9)).toBe(false);
      // 4:3 image in 16:9 canvas
      expect(isSevereAspectRatioMismatch(4 / 3, canvas16x9)).toBe(false);
      // 3:2 image in 16:9 canvas
      expect(isSevereAspectRatioMismatch(3 / 2, canvas16x9)).toBe(false);
      // 9:16 vertical image in 9:16 vertical canvas
      expect(isSevereAspectRatioMismatch(9 / 16, canvas9x16)).toBe(false);
      // 1:1 image in 1:1 canvas
      expect(isSevereAspectRatioMismatch(1.0, canvas1x1)).toBe(false);
    });

    it('handles invalid or zero inputs gracefully', () => {
      expect(isSevereAspectRatioMismatch(0, canvas16x9)).toBe(false);
      expect(isSevereAspectRatioMismatch(-1, canvas16x9)).toBe(false);
      expect(isSevereAspectRatioMismatch(NaN, canvas16x9)).toBe(false);
    });
  });

  describe('resolveSafeLayoutMode', () => {
    const canvas16x9 = 1920 / 1080;

    it('automatically falls back from FULL_COVER to BLUR_BG for vertical images in 16:9', () => {
      const verticalScroll = 0.4; // 1:2.5 vertical scroll
      expect(resolveSafeLayoutMode('FULL_COVER', verticalScroll, canvas16x9)).toBe('BLUR_BG');
      expect(resolveSafeLayoutMode('PURE_IMAGE_FULL', verticalScroll, canvas16x9)).toBe('BLUR_BG');
      expect(resolveSafeLayoutMode('VIGNETTE_DARK', verticalScroll, canvas16x9)).toBe('BLUR_BG');
    });

    it('preserves FULL_COVER when aspect ratio is compatible with canvas', () => {
      const standardLandscape = 16 / 9;
      expect(resolveSafeLayoutMode('FULL_COVER', standardLandscape, canvas16x9)).toBe('FULL_COVER');
      expect(resolveSafeLayoutMode('PURE_IMAGE_FULL', standardLandscape, canvas16x9)).toBe('PURE_IMAGE_FULL');
    });

    it('preserves non-crop layout modes regardless of image aspect ratio', () => {
      const verticalScroll = 0.33;
      expect(resolveSafeLayoutMode('HISTORICAL_FRAME', verticalScroll, canvas16x9)).toBe('HISTORICAL_FRAME');
      expect(resolveSafeLayoutMode('DOCUMENTARY_GRID', verticalScroll, canvas16x9)).toBe('DOCUMENTARY_GRID');
      expect(resolveSafeLayoutMode('CENTER_SCALE', verticalScroll, canvas16x9)).toBe('CENTER_SCALE');
      expect(resolveSafeLayoutMode('BLUR_BG', verticalScroll, canvas16x9)).toBe('BLUR_BG');
    });

    it('defaults to BLUR_BG when requestedMode is unspecified', () => {
      expect(resolveSafeLayoutMode(undefined, 1.0, canvas16x9)).toBe('BLUR_BG');
    });
  });

  describe('calculateSafeImageBounds', () => {
    it('calculates deterministic pixel bounds for 16:9 canvas (1920x1080)', () => {
      const bounds = calculateSafeImageBounds(1920, 1080, 'BLUR_BG');
      expect(bounds.maxWidth).toBe(1574); // 1920 * 0.82
      expect(bounds.maxHeight).toBe(864); // 1080 * 0.80
      expect(bounds.outerMaxWidth).toBe(1632); // 1920 * 0.85
      expect(bounds.outerMaxHeight).toBe(886); // 1080 * 0.82
    });

    it('calculates deterministic pixel bounds for 9:16 vertical canvas (1080x1920)', () => {
      const bounds = calculateSafeImageBounds(1080, 1920, 'HISTORICAL_FRAME');
      expect(bounds.maxWidth).toBe(842); // 1080 * 0.78
      expect(bounds.maxHeight).toBe(1440); // 1920 * 0.75
      expect(bounds.outerMaxWidth).toBe(886); // 1080 * 0.82
      expect(bounds.outerMaxHeight).toBe(1536); // 1920 * 0.80
    });

    it('calculates deterministic pixel bounds for 1:1 square canvas (1080x1080)', () => {
      const bounds = calculateSafeImageBounds(1080, 1080, 'DOCUMENTARY_GRID');
      expect(bounds.maxWidth).toBe(864); // 1080 * 0.80
      expect(bounds.maxHeight).toBe(842); // 1080 * 0.78
    });
  });
});
