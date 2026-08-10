import { useVideoConfig } from 'remotion';
import { LayoutMode } from '../types';

export interface ResponsiveLayout {
  width: number;
  height: number;
  scale: number;
  isLandscape: boolean;
  isPortrait: boolean;
  safeMarginX: number;
  safeMarginY: number;
}

/**
 * Custom hook to calculate responsive scale factor and safe margins
 * based on Remotion 16:9 landscape video dimensions (1920x1080 baseline).
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useVideoConfig();
  const isLandscape = width >= height;
  const isPortrait = !isLandscape;

  // Scale factor normalized to standard 1920px 16:9 HD baseline
  const scale = Math.min(Math.max(width / 1920, 0.5), 2.0);

  // Safe area margins (4% inset)
  const safeMarginX = Math.round(width * 0.04);
  const safeMarginY = Math.round(height * 0.04);

  return {
    width,
    height,
    scale,
    isLandscape,
    isPortrait,
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
  ] as LayoutMode[]).includes(layoutMode);
}

/**
 * Resolves CSS positioning properties dynamically for overlay cards.
 * If position is explicit ('LEFT', 'RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT', 'CENTER'), uses it.
 * If position is not specified, auto-alternates between LEFT and RIGHT based on scene index.
 */
export function resolveOverlayPositionStyle(
  position?: 'LEFT' | 'RIGHT' | 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'CENTER',
  index: number = 0,
  scale: number = 1.0,
  isLandscape: boolean = true
): React.CSSProperties {
  const margin = `${Math.round(40 * scale)}px`;
  const topSafe = `${Math.round(115 * scale)}px`;
  const bottomSafe = `${Math.round(165 * scale)}px`;

  const effectivePos = position || ((index % 2 === 1 && isLandscape) ? 'RIGHT' : 'LEFT');

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
