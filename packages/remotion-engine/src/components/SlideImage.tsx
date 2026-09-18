import React from 'react';
import { staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { calculateKenBurnsTransform, getFilterCss } from '../utils/animationUtils';
import { AssetMetadata, CustomKenBurns, FilterStyle, KenBurnsEffect, LayoutMode } from '../types';
import {
  calculateSafeImageBounds,
  isPureCodeLayout,
  resolveSafeLayoutMode,
} from '../utils/layoutUtils';
import {
  BaseSlideLayoutProps,
  PureCodeWallpaperLayout,
  SplitCompareLayout,
  GridCollageLayout,
  ArchiveCardLayout,
  StandardImageLayout,
} from './layouts/index';

export interface SlideImageProps {
  src: string;
  secondaryAssetUrl?: string;
  assetMetadata?: AssetMetadata;
  secondaryAssetMetadata?: AssetMetadata;
  layoutMode?: LayoutMode;
  durationInFrames: number;
  zoomType?: KenBurnsEffect | 'zoom-in' | 'zoom-out' | 'pan-left';
  customKenBurns?: CustomKenBurns;
  filterStyle?: FilterStyle;
  rotateDeg?: number;
  isPureCodeScene?: boolean;
  sceneId?: string;
  index?: number;
}

const normalizePath = (url: string) => {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('file://')
  ) {
    return url;
  }
  // Absolute disk paths should not be passed to staticFile()
  if (
    url.startsWith('/Users') ||
    url.startsWith('/home') ||
    url.startsWith('/media') ||
    url.startsWith('/tmp') ||
    url.startsWith('/var') ||
    /^[A-Za-z]:[\\/]/.test(url)
  ) {
    return url;
  }
  const clean = url.startsWith('/') ? url.slice(1) : url;
  try {
    return staticFile(clean);
  } catch {
    return url;
  }
};

const FALLBACK_SRC =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231a1412"/><stop offset="100%" stop-color="%230c0a09"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bg)"/><text x="960" y="540" font-family="serif" font-size="42" fill="%23d4af37" text-anchor="middle" dominant-baseline="middle" opacity="0.6">ChronoViet Historical Visual</text></svg>';

const resolveUrl = (url?: string, isError?: boolean) => {
  if (isError || !url) return FALLBACK_SRC;
  return normalizePath(url);
};

export const SlideImage: React.FC<SlideImageProps> = ({
  src,
  secondaryAssetUrl,
  assetMetadata,
  secondaryAssetMetadata,
  layoutMode = 'BLUR_BG',
  durationInFrames,
  zoomType = 'KEN_BURNS_ZOOM_IN',
  customKenBurns,
  filterStyle = 'HISTORICAL',
  rotateDeg = 0,
  isPureCodeScene = false,
  sceneId,
  index,
}) => {
  const frame = useCurrentFrame();
  const { width: canvasWidth, height: canvasHeight } = useVideoConfig();
  const canvasAspect = canvasWidth / Math.max(canvasHeight, 1);
  const progress = frame / Math.max(durationInFrames, 1);

  // Measure or resolve image natural dimensions & aspect ratio
  const [naturalDimensions, setNaturalDimensions] = React.useState<{ width: number; height: number } | null>(
    assetMetadata?.width && assetMetadata?.height
      ? { width: assetMetadata.width, height: assetMetadata.height }
      : null
  );

  const imageAspect = React.useMemo(() => {
    if (naturalDimensions && naturalDimensions.height > 0) {
      return naturalDimensions.width / naturalDimensions.height;
    }
    if (assetMetadata?.width && assetMetadata?.height && assetMetadata.height > 0) {
      return assetMetadata.width / assetMetadata.height;
    }
    if (assetMetadata?.aspectRatio) {
      const parts = assetMetadata.aspectRatio.split(/[:/]/);
      if (parts.length === 2) {
        const w = parseFloat(parts[0]);
        const h = parseFloat(parts[1]);
        if (w > 0 && h > 0) return w / h;
      }
    }
    return null;
  }, [naturalDimensions, assetMetadata]);

  // Aspect Ratio Guard: Protect against severe cropping in cover modes
  const effectiveLayoutMode = React.useMemo(() => {
    return resolveSafeLayoutMode(layoutMode, imageAspect, canvasAspect);
  }, [layoutMode, imageAspect, canvasAspect]);

  // Deterministic pixel bounds derived from canvas resolution
  const safeBounds = React.useMemo(() => {
    return calculateSafeImageBounds(canvasWidth, canvasHeight, effectiveLayoutMode);
  }, [canvasWidth, canvasHeight, effectiveLayoutMode]);

  // Normalize effect parameter string
  const normalizedEffect: KenBurnsEffect =
    zoomType === 'zoom-in'
      ? 'KEN_BURNS_ZOOM_IN'
      : zoomType === 'zoom-out'
      ? 'KEN_BURNS_ZOOM_OUT'
      : zoomType === 'pan-left'
      ? 'KEN_BURNS_PAN_LEFT'
      : (zoomType as KenBurnsEffect);

  // Ken Burns Motion Interpolation
  const { scale, translateX, translateY } = calculateKenBurnsTransform(
    normalizedEffect,
    progress,
    customKenBurns
  );

  const filterCss = React.useMemo(() => getFilterCss(filterStyle), [filterStyle]);

  const [hasPrimaryError, setHasPrimaryError] = React.useState(false);
  const [hasSecondaryError, setHasSecondaryError] = React.useState(false);

  React.useEffect(() => {
    setHasPrimaryError(false);
  }, [src]);

  React.useEffect(() => {
    setHasSecondaryError(false);
  }, [secondaryAssetUrl]);

  const handlePrimaryError = React.useCallback(() => {
    if (!hasPrimaryError) {
      setHasPrimaryError(true);
      console.warn(
        `[remotion-engine] render.asset_load_failed: Failed to load primary asset '${src}' (sceneId: ${sceneId ?? 'unknown'}, layoutMode: ${effectiveLayoutMode}, index: ${index ?? 'unknown'})`
      );
    }
  }, [hasPrimaryError, src, sceneId, effectiveLayoutMode, index]);

  const handleSecondaryError = React.useCallback(() => {
    if (!hasSecondaryError) {
      setHasSecondaryError(true);
      console.warn(
        `[remotion-engine] render.asset_load_failed: Failed to load secondary asset '${secondaryAssetUrl}' (sceneId: ${sceneId ?? 'unknown'}, layoutMode: ${effectiveLayoutMode}, index: ${index ?? 'unknown'})`
      );
    }
  }, [hasSecondaryError, secondaryAssetUrl, sceneId, effectiveLayoutMode, index]);

  const resolvedSrc = resolveUrl(src, hasPrimaryError);
  const resolvedSecondarySrc = resolveUrl(secondaryAssetUrl, hasSecondaryError);

  const layoutProps: BaseSlideLayoutProps = {
    resolvedSrc,
    resolvedSecondarySrc,
    handlePrimaryError,
    handleSecondaryError,
    scale,
    translateX,
    translateY,
    rotateDeg,
    filterCss,
    safeBounds,
    canvasWidth,
    canvasHeight,
    naturalDimensions,
    setNaturalDimensions,
    layoutMode: effectiveLayoutMode,
  };

  // 0. Pure Code / UI Component Scenes
  if (isPureCodeScene || isPureCodeLayout(effectiveLayoutMode)) {
    return <PureCodeWallpaperLayout {...layoutProps} />;
  }

  // 1. SPLIT_COMPARE
  if (effectiveLayoutMode === 'SPLIT_COMPARE') {
    return <SplitCompareLayout {...layoutProps} />;
  }

  // 2. DOCUMENTARY_GRID
  if (effectiveLayoutMode === 'DOCUMENTARY_GRID') {
    return <GridCollageLayout {...layoutProps} />;
  }

  // 3. NEWSPAPER_ARCHIVE & GALLERY_3D
  if (effectiveLayoutMode === 'NEWSPAPER_ARCHIVE' || effectiveLayoutMode === 'GALLERY_3D') {
    return <ArchiveCardLayout {...layoutProps} />;
  }

  // 4. Standard Images (PURE_IMAGE_FULL, FULL_COVER, FULL_CONTAIN, CENTER_SCALE, VIGNETTE_DARK, HISTORICAL_FRAME, BLUR_BG)
  return <StandardImageLayout {...layoutProps} />;
};
