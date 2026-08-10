import { Easing, interpolate } from 'remotion';
import { FilterStyle, KenBurnsEffect } from '../types';

export interface KenBurnsTransform {
  scale: number;
  translateX: number; // percentage
  translateY: number; // percentage
}

/**
 * Calculates smooth cinematic Ken Burns motion parameters based on frame progress.
 */
export function calculateKenBurnsTransform(
  effect: KenBurnsEffect = 'KEN_BURNS_ZOOM_IN',
  progress: number,
  customKenBurns?: import('../types').CustomKenBurns
): KenBurnsTransform {
  const easedProgress = Easing.inOut(Easing.ease)(progress);

  if (customKenBurns && (customKenBurns.scaleFrom !== undefined || customKenBurns.scaleTo !== undefined)) {
    const scaleFrom = customKenBurns.scaleFrom ?? 1.0;
    const scaleTo = customKenBurns.scaleTo ?? 1.15;
    const originX = customKenBurns.originX ?? 0.5;
    const originY = customKenBurns.originY ?? 0.5;

    // Convert originX/originY (0..1) to transform translation percentage (-5% to 5%)
    const translateX = (0.5 - originX) * 10 * easedProgress;
    const translateY = (0.5 - originY) * 10 * easedProgress;
    const scale = interpolate(easedProgress, [0, 1], [scaleFrom, scaleTo], { extrapolateRight: 'clamp' });

    return { scale, translateX, translateY };
  }

  switch (effect) {
    case 'KEN_BURNS_ZOOM_IN':
      return {
        scale: interpolate(easedProgress, [0, 1], [1.0, 1.15], { extrapolateRight: 'clamp' }),
        translateX: 0,
        translateY: 0,
      };
    case 'KEN_BURNS_ZOOM_OUT':
      return {
        scale: interpolate(easedProgress, [0, 1], [1.18, 1.03], { extrapolateRight: 'clamp' }),
        translateX: 0,
        translateY: 0,
      };
    case 'KEN_BURNS_PAN_LEFT':
      return {
        scale: 1.12,
        translateX: interpolate(easedProgress, [0, 1], [2, -2], { extrapolateRight: 'clamp' }),
        translateY: 0,
      };
    case 'KEN_BURNS_PAN_RIGHT':
      return {
        scale: 1.12,
        translateX: interpolate(easedProgress, [0, 1], [-2, 2], { extrapolateRight: 'clamp' }),
        translateY: 0,
      };
    case 'KEN_BURNS_PAN_UP':
      return {
        scale: 1.12,
        translateX: 0,
        translateY: interpolate(easedProgress, [0, 1], [2, -2], { extrapolateRight: 'clamp' }),
      };
    case 'KEN_BURNS_PAN_DOWN':
      return {
        scale: 1.12,
        translateX: 0,
        translateY: interpolate(easedProgress, [0, 1], [-2, 2], { extrapolateRight: 'clamp' }),
      };
    default:
      return {
        scale: interpolate(easedProgress, [0, 1], [1.0, 1.12], { extrapolateRight: 'clamp' }),
        translateX: 0,
        translateY: 0,
      };
  }
}

/**
 * Returns CSS filter string according to historical filter preset
 */
export function getFilterCss(style: FilterStyle = 'HISTORICAL'): string {
  switch (style) {
    case 'HISTORICAL':
      return 'sepia(0.2) contrast(1.08) brightness(0.95)';
    case 'SEPIA':
      return 'sepia(0.4) contrast(1.1) brightness(0.9)';
    case 'VINTAGE':
      return 'sepia(0.15) contrast(1.05) saturate(0.85) brightness(0.95)';
    case 'NONE':
    default:
      return 'none';
  }
}

/**
 * Gets a default Ken Burns effect based on scene index if unspecified
 */
export function getDefaultKenBurnsForIndex(index: number): KenBurnsEffect {
  const effects: KenBurnsEffect[] = [
    'KEN_BURNS_ZOOM_IN',
    'KEN_BURNS_PAN_RIGHT',
    'KEN_BURNS_ZOOM_OUT',
    'KEN_BURNS_PAN_LEFT',
    'KEN_BURNS_PAN_UP',
    'KEN_BURNS_PAN_DOWN',
  ];
  return effects[index % effects.length];
}
