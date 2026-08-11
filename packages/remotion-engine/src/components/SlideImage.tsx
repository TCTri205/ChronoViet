import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { calculateKenBurnsTransform, getFilterCss } from '../utils/animationUtils';
import { CustomKenBurns, FilterStyle, KenBurnsEffect, LayoutMode } from '../types';
import { isPureCodeLayout } from '../utils/layoutUtils';

interface SlideImageProps {
  src: string;
  secondaryAssetUrl?: string;
  layoutMode?: LayoutMode;
  durationInFrames: number;
  zoomType?: KenBurnsEffect | 'zoom-in' | 'zoom-out' | 'pan-left';
  customKenBurns?: CustomKenBurns;
  filterStyle?: FilterStyle;
  rotateDeg?: number;
  isPureCodeScene?: boolean;
}

const normalizePath = (url: string) => {
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const clean = url.startsWith('/') ? url : `/${url}`;
  return staticFile(clean);
};

const FALLBACK_SRC = normalizePath('assets/battle/bach_dang_river.jpg');

const resolveUrl = (url?: string, isError?: boolean) => {
  if (isError || !url) return FALLBACK_SRC;
  return normalizePath(url);
};

export const SlideImage: React.FC<SlideImageProps> = ({
  src,
  secondaryAssetUrl,
  layoutMode = 'BLUR_BG',
  durationInFrames,
  zoomType = 'KEN_BURNS_ZOOM_IN',
  customKenBurns,
  filterStyle = 'HISTORICAL',
  rotateDeg = 0,
  isPureCodeScene = false,
}) => {
  const frame = useCurrentFrame();
  const progress = frame / Math.max(durationInFrames, 1);

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

  const resolvedSrc = resolveUrl(src, hasPrimaryError);
  const resolvedSecondarySrc = resolveUrl(secondaryAssetUrl, hasSecondaryError);

  // 0. Pure Code / UI Component Scenes: Image is rendered purely as full-screen blurred background wallpaper (same blur as Type 1, no sharp image component)
  if (isPureCodeScene || isPureCodeLayout(layoutMode)) {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        {/* Fullscreen Blurred Cover Background Image with Ken Burns motion */}
        <Img
          src={resolvedSrc}
          onError={() => setHasPrimaryError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: `${filterCss} blur(22px) brightness(0.32) saturate(0.85)`,
            transform: `rotate(${rotateDeg}deg) scale(${scale * 1.25}) translate(${translateX * 0.3}%, ${translateY * 0.3}%) translateZ(0)`,
            willChange: 'transform',
            opacity: 0.95,
          }}
        />
        {/* Darkening & Radial Vignette Overlay for Crisp UI Contrast */}
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(14, 12, 10, 0.4) 0%, rgba(14, 12, 10, 0.85) 75%, rgba(10, 8, 6, 0.95) 100%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 1. SPLIT_COMPARE: Dual Image Side-by-Side Comparison
  if (layoutMode === 'SPLIT_COMPARE') {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          {/* Left Image */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRight: `2px solid ${COLOR_PALETTE.primaryGold}` }}>
            <Img
              src={resolvedSrc}
              onError={() => setHasPrimaryError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${scale}) translate(${translateX * 0.2}%, ${translateY * 0.2}%)`,
                filter: filterCss,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 20,
                left: 20,
                padding: '6px 14px',
                backgroundColor: 'rgba(22, 18, 14, 0.92)',
                border: `1px solid ${COLOR_PALETTE.primaryGold}`,
                borderRadius: '2px',
                color: COLOR_PALETTE.primaryGold,
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '1.5px',
              }}
            >
              HÌNH ẢNH I
            </div>
          </div>

          {/* Right Image */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <Img
              src={resolvedSecondarySrc}
              onError={() => setHasSecondaryError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${scale}) translate(${-translateX * 0.2}%, ${-translateY * 0.2}%)`,
                filter: filterCss,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                padding: '6px 14px',
                backgroundColor: 'rgba(22, 18, 14, 0.92)',
                border: `1px solid ${COLOR_PALETTE.vermilionRed}`,
                borderRadius: '2px',
                color: COLOR_PALETTE.vermilionRed,
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '1.5px',
              }}
            >
              HÌNH ẢNH II
            </div>
          </div>
        </div>

        {/* Top/Bottom Overlay Gradient */}
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.85) 100%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 2. FULL_COVER: Fullscreen Cover with Ken Burns motion (no background blur layer needed)
  if (layoutMode === 'FULL_COVER') {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        <Img
          src={resolvedSrc}
          onError={() => setHasPrimaryError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.4}%, ${translateY * 0.4}%)`,
            filter: filterCss,
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.85) 100%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 3. FULL_CONTAIN / CENTER_SCALE: Clean centered image without blurred background
  if (layoutMode === 'FULL_CONTAIN' || layoutMode === 'CENTER_SCALE') {
    const isScaleMode = layoutMode === 'CENTER_SCALE';
    return (
      <AbsoluteFill
        style={{
          backgroundColor: COLOR_PALETTE.lacquerBlack,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <Img
          src={resolvedSrc}
          onError={() => setHasPrimaryError(true)}
          style={{
            maxWidth: isScaleMode ? '90vw' : '95vw',
            maxHeight: isScaleMode ? '90vh' : '95vh',
            objectFit: 'contain',
            transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.25}%, ${translateY * 0.25}%)`,
            filter: filterCss,
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 22%, transparent 75%, rgba(0,0,0,0.85) 100%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 4. VIGNETTE_DARK: Reduced brightness (-40%) with heavy 4-corner radial dark vignette
  if (layoutMode === 'VIGNETTE_DARK') {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        <Img
          src={resolvedSrc}
          onError={() => setHasPrimaryError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.3}%, ${translateY * 0.3}%)`,
            filter: `${filterCss} brightness(0.6)`,
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.92) 85%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 5. HISTORICAL_FRAME: Vintage framed image with ornamental gold border
  if (layoutMode === 'HISTORICAL_FRAME') {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        {/* Background Blur */}
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img
            src={resolvedSrc}
            onError={() => setHasPrimaryError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(20px) brightness(0.3) saturate(0.8)',
              transform: `scale(${scale * 1.2})`,
            }}
          />
        </AbsoluteFill>

        {/* Vintage Framed Main Image */}
        <AbsoluteFill
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '50px',
          }}
        >
          <div
            style={{
              transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.25}%, ${translateY * 0.25}%)`,
              maxHeight: '80%',
              maxWidth: '82%',
              border: `3px solid ${COLOR_PALETTE.primaryGold}`,
              outline: `8px solid ${COLOR_PALETTE.vermilionRed}`,
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 40px rgba(200, 157, 53, 0.3)',
              borderRadius: '2px',
              overflow: 'hidden',
              backgroundColor: COLOR_PALETTE.ancientWood,
            }}
          >
            <Img
              src={resolvedSrc}
              onError={() => setHasPrimaryError(true)}
              style={{
                maxHeight: '75vh',
                maxWidth: '75vw',
                objectFit: 'contain',
                filter: filterCss,
              }}
            />
          </div>
        </AbsoluteFill>

        {/* Overlay Vignette */}
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at 50% 50%, transparent 50%, rgba(0,0,0,0.8) 100%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 6. BLUR_BG (Default): Contain image centered with blurred background
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
      {/* Background Blur */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={resolvedSrc}
          onError={() => setHasPrimaryError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(18px) brightness(0.35) saturate(0.85)',
            transform: `scale(${scale * 1.25}) translate(${translateX * 0.4}%, ${translateY * 0.4}%) translateZ(0)`,
            willChange: 'transform',
            opacity: 0.9,
          }}
        />
      </AbsoluteFill>

      {/* Foreground Container */}
      <AbsoluteFill
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
        }}
      >
        <div
          style={{
            transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.3}%, ${translateY * 0.3}%) translateZ(0)`,
            willChange: 'transform',
            maxHeight: '82%',
            maxWidth: '85%',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(200, 157, 53, 0.3)',
            borderRadius: '2px',
            overflow: 'hidden',
            backgroundColor: COLOR_PALETTE.ancientWood,
          }}
        >
          <Img
            src={resolvedSrc}
            onError={() => setHasPrimaryError(true)}
            style={{
              maxHeight: '80vh',
              maxWidth: '80vw',
              objectFit: 'contain',
              filter: filterCss,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Top & Bottom Cinematic Gradients for Readability */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 22%, transparent 72%, rgba(0,0,0,0.85) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

