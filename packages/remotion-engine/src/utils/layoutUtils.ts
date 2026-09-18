import { useVideoConfig } from 'remotion';
import { LayoutMode } from '../types';

export interface ResponsiveLayout {
  width: number;
  height: number;
  scale: number;
  safeMarginX: number;
  safeMarginY: number;
}

/**
 * Custom hook to calculate responsive scale factor and safe margins
 * based strictly on Remotion 16:9 landscape HD video dimensions (1920x1080 baseline).
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useVideoConfig();

  // Scale factor normalized to standard 1920px 16:9 HD baseline
  const scale = Math.min(Math.max(width / 1920, 0.5), 2.0);

  // Safe area margins (4% inset)
  const safeMarginX = Math.round(width * 0.04);
  const safeMarginY = Math.round(height * 0.04);

  return {
    width,
    height,
    scale,
    safeMarginX,
    safeMarginY,
  };
}

/**
 * Checks whether a given layout mode takes over the full canvas
 * (thus disabling standard overlay badges and branding headers).
 */
export function isFullscreenLayout(layoutMode?: LayoutMode): boolean {
  if (!layoutMode) return false;
  return ([
    'ARTICLE_UI',
    'CHAPTER_CARD',
    'QUOTE_CANVAS',
    'SPONSOR_UI',
    'OUTRO_CARD',
    'TITLE_CARD',
    'ROYAL_DECREE',
    'POEM_RECITING',
    'TIMELINE_CHRONO',
    'HERO_SPOTLIGHT',
    'ARMY_STRENGTH',
    'VERSUS_CARD',
    'SPLIT_THEORY',
    'MAP_TACTICAL',
    'PURE_IMAGE_FULL',
    'DOCUMENTARY_GRID',
    'NEWSPAPER_ARCHIVE',
    'GALLERY_3D',
  ] as LayoutMode[]).includes(layoutMode);
}

/**
 * Checks whether a given layout mode is a pure code / UI component layout
 * where the primary visual component is code UI (e.g. ChapterTitle, StatCard, QuoteSlide).
 */
export function isPureCodeLayout(layoutMode?: LayoutMode): boolean {
  if (!layoutMode) return false;
  return ([
    'ARTICLE_UI',
    'CHAPTER_CARD',
    'QUOTE_CANVAS',
    'QUOTE_SLIDE',
    'SPONSOR_UI',
    'OUTRO_CARD',
    'TITLE_CARD',
    'VERSUS_CARD',
    'SPLIT_THEORY',
    'POEM_RECITING',
    'TIMELINE_CHRONO',
    'MAP_TACTICAL',
    'ARMY_STRENGTH',
    'CHARACTER_PROFILE',
    'ROYAL_DECREE',
    'ARTIFACT_INSPECT',
    'HERO_SPOTLIGHT',
    'STAT_CARD',
    'BULLET_HIGHLIGHT',
    'MUSEUM_TAG',
  ] as LayoutMode[]).includes(layoutMode);
}

/**
 * Resolves CSS positioning properties dynamically for overlay cards in 16:9 landscape format.
 * If position is explicit ('LEFT', 'RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT', 'CENTER'), uses it.
 * If position is not specified, auto-alternates between LEFT and RIGHT based on scene index.
 */
export function resolveOverlayPositionStyle(
  position?: 'LEFT' | 'RIGHT' | 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'CENTER',
  index: number = 0,
  scale: number = 1.0
): React.CSSProperties {
  const margin = `${Math.round(40 * scale)}px`;
  const topSafe = `${Math.round(115 * scale)}px`;
  const bottomSafe = `${Math.round(165 * scale)}px`;

  const effectivePos = position || (index % 2 === 1 ? 'RIGHT' : 'LEFT');

  switch (effectivePos) {
    case 'RIGHT':
    case 'TOP_RIGHT':
      return {
        top: topSafe,
        bottom: bottomSafe,
        right: margin,
        left: 'auto',
        alignItems: 'flex-end',
      };
    case 'BOTTOM_LEFT':
      return {
        bottom: bottomSafe,
        left: margin,
        right: 'auto',
        alignItems: 'flex-start',
      };
    case 'BOTTOM_RIGHT':
      return {
        bottom: bottomSafe,
        right: margin,
        left: 'auto',
        alignItems: 'flex-end',
      };
    case 'CENTER':
      return {
        top: topSafe,
        bottom: bottomSafe,
        left: '50%',
        transform: 'translateX(-50%)',
        alignItems: 'center',
      };
    case 'LEFT':
    case 'TOP_LEFT':
    default:
      return {
        top: topSafe,
        bottom: bottomSafe,
        left: margin,
        right: 'auto',
        alignItems: 'flex-start',
      };
  }
}

/**
 * Detects whether an image's aspect ratio severely mismatches the composition canvas aspect ratio.
 * Used to prevent aggressive cropping (>40% to 80% loss) in full-cover layout modes.
 *
 * @param imageAspect width / height of the visual asset
 * @param canvasAspect width / height of the video canvas (e.g. 16/9 = 1.777, 9/16 = 0.5625)
 * @returns true if the aspect ratio mismatch is severe enough that object-fit: cover would destroy essential content
 */
export function isSevereAspectRatioMismatch(imageAspect: number, canvasAspect: number): boolean {
  if (!Number.isFinite(imageAspect) || !Number.isFinite(canvasAspect) || imageAspect <= 0 || canvasAspect <= 0) {
    return false;
  }

  const ratioMismatch = imageAspect / canvasAspect;
  // ratioMismatch < 0.65 means image is far more vertical than canvas (e.g. 1:2 stela in 16:9 canvas -> 0.5 / 1.777 = 0.28)
  // ratioMismatch > 1.65 means image is far more horizontal than canvas (e.g. 3:1 panorama in 16:9 -> 3 / 1.777 = 1.69, or 16:9 in 9:16 vertical canvas -> 1.777 / 0.5625 = 3.16)
  return ratioMismatch < 0.65 || ratioMismatch > 1.65;
}

/**
 * Resolves a safe layout mode against potential severe aspect ratio cropping.
 * Automatically falls back to BLUR_BG (which preserves 100% of the image inside a contain frame with ambient blurred backdrop)
 * when a crop-heavy layout mode (FULL_COVER, PURE_IMAGE_FULL, VIGNETTE_DARK) is paired with an extreme aspect ratio.
 */
export function resolveSafeLayoutMode(
  requestedMode?: LayoutMode,
  imageAspect?: number | null,
  canvasAspect: number = 16 / 9
): LayoutMode {
  const effectiveMode = requestedMode || 'BLUR_BG';

  if (!imageAspect || !Number.isFinite(imageAspect) || imageAspect <= 0) {
    return effectiveMode;
  }

  const isCropLayout =
    effectiveMode === 'FULL_COVER' ||
    effectiveMode === 'PURE_IMAGE_FULL' ||
    effectiveMode === 'VIGNETTE_DARK';

  if (isCropLayout && isSevereAspectRatioMismatch(imageAspect, canvasAspect)) {
    return 'BLUR_BG';
  }

  return effectiveMode;
}

export interface SafeImageBounds {
  maxWidth: number;
  maxHeight: number;
  outerMaxWidth: number;
  outerMaxHeight: number;
}

/**
 * Calculates deterministic pixel bounds for image rendering in Remotion compositions,
 * strictly derived from canvas resolution (useVideoConfig().width and height) instead of browser viewport units (vw/vh).
 */
export function calculateSafeImageBounds(
  canvasWidth: number,
  canvasHeight: number,
  layoutMode?: LayoutMode
): SafeImageBounds {
  const mode = layoutMode || 'BLUR_BG';

  switch (mode) {
    case 'HISTORICAL_FRAME':
      return {
        outerMaxWidth: Math.round(canvasWidth * 0.82),
        outerMaxHeight: Math.round(canvasHeight * 0.80),
        maxWidth: Math.round(canvasWidth * 0.78),
        maxHeight: Math.round(canvasHeight * 0.75),
      };
    case 'DOCUMENTARY_GRID':
      return {
        outerMaxWidth: Math.round(canvasWidth * 0.85),
        outerMaxHeight: Math.round(canvasHeight * 0.82),
        maxWidth: Math.round(canvasWidth * 0.80),
        maxHeight: Math.round(canvasHeight * 0.78),
      };
    case 'NEWSPAPER_ARCHIVE':
      return {
        outerMaxWidth: Math.round(canvasWidth * 0.82),
        outerMaxHeight: Math.round(canvasHeight * 0.82),
        maxWidth: Math.round(canvasWidth * 0.75),
        maxHeight: Math.round(canvasHeight * 0.70),
      };
    case 'GALLERY_3D':
      return {
        outerMaxWidth: Math.round(canvasWidth * 0.82),
        outerMaxHeight: Math.round(canvasHeight * 0.80),
        maxWidth: Math.round(canvasWidth * 0.78),
        maxHeight: Math.round(canvasHeight * 0.75),
      };
    case 'FULL_CONTAIN':
    case 'CENTER_SCALE':
      return {
        outerMaxWidth: Math.round(canvasWidth * 0.92),
        outerMaxHeight: Math.round(canvasHeight * 0.92),
        maxWidth: Math.round(canvasWidth * 0.90),
        maxHeight: Math.round(canvasHeight * 0.90),
      };
    case 'BLUR_BG':
    default:
      return {
        outerMaxWidth: Math.round(canvasWidth * 0.85),
        outerMaxHeight: Math.round(canvasHeight * 0.82),
        maxWidth: Math.round(canvasWidth * 0.82),
        maxHeight: Math.round(canvasHeight * 0.80),
      };
  }
}

