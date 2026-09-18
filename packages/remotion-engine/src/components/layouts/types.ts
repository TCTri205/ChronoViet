import { AssetMetadata, CustomKenBurns, FilterStyle, KenBurnsEffect, LayoutMode } from '../../types';

export interface BaseSlideLayoutProps {
  resolvedSrc: string;
  resolvedSecondarySrc?: string;
  handlePrimaryError: () => void;
  handleSecondaryError?: () => void;
  scale: number;
  translateX: number;
  translateY: number;
  rotateDeg?: number;
  filterCss: string;
  safeBounds: {
    maxWidth: number;
    maxHeight: number;
    outerMaxWidth: number;
    outerMaxHeight: number;
  };
  canvasWidth: number;
  canvasHeight: number;
  naturalDimensions: { width: number; height: number } | null;
  setNaturalDimensions: (dims: { width: number; height: number }) => void;
  layoutMode?: LayoutMode;
}
