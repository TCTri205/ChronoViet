import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { COLOR_PALETTE } from '../../constants/config';
import { BaseSlideLayoutProps } from './types';

export const StandardImageLayout: React.FC<BaseSlideLayoutProps> = ({
  resolvedSrc,
  handlePrimaryError,
  filterCss,
  rotateDeg = 0,
  scale,
  translateX,
  translateY,
  safeBounds,
  canvasWidth,
  canvasHeight,
  naturalDimensions,
  setNaturalDimensions,
  layoutMode = 'BLUR_BG',
}) => {
  // 1. PURE_IMAGE_FULL: Clean Edge-to-Edge Uncropped Historical Photo
  if (layoutMode === 'PURE_IMAGE_FULL') {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        <Img
          src={resolvedSrc}
          onError={handlePrimaryError}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (!naturalDimensions && img.naturalWidth && img.naturalHeight) {
              setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `rotate(${rotateDeg}deg) scale(${scale * 1.08}) translate(${translateX * 0.35}%, ${translateY * 0.35}%) translateZ(0)`,
            willChange: 'transform',
            filter: filterCss,
          }}
        />
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 20%, transparent 75%, rgba(0,0,0,0.75) 100%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 2. FULL_COVER: Fullscreen Cover with Ken Burns motion
  if (layoutMode === 'FULL_COVER') {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        <Img
          src={resolvedSrc}
          onError={handlePrimaryError}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (!naturalDimensions && img.naturalWidth && img.naturalHeight) {
              setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `rotate(${rotateDeg}deg) scale(${scale * 1.08}) translate(${translateX * 0.4}%, ${translateY * 0.4}%)`,
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
          onError={handlePrimaryError}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (!naturalDimensions && img.naturalWidth && img.naturalHeight) {
              setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }
          }}
          style={{
            maxWidth: isScaleMode ? Math.round(canvasWidth * 0.90) : Math.round(canvasWidth * 0.95),
            maxHeight: isScaleMode ? Math.round(canvasHeight * 0.90) : Math.round(canvasHeight * 0.95),
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
          onError={handlePrimaryError}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (!naturalDimensions && img.naturalWidth && img.naturalHeight) {
              setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `rotate(${rotateDeg}deg) scale(${scale * 1.08}) translate(${translateX * 0.3}%, ${translateY * 0.3}%)`,
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
            onError={handlePrimaryError}
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
            padding: `${Math.round(canvasHeight * 0.04)}px`,
          }}
        >
          <div
            style={{
              transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.25}%, ${translateY * 0.25}%)`,
              maxHeight: safeBounds.outerMaxHeight,
              maxWidth: safeBounds.outerMaxWidth,
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
              onError={handlePrimaryError}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (!naturalDimensions && img.naturalWidth && img.naturalHeight) {
                  setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                }
              }}
              style={{
                maxHeight: safeBounds.maxHeight,
                maxWidth: safeBounds.maxWidth,
                objectFit: 'contain',
                filter: filterCss,
                display: 'block',
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
          onError={handlePrimaryError}
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
          padding: `${Math.round(canvasHeight * 0.04)}px`,
        }}
      >
        <div
          style={{
            transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.3}%, ${translateY * 0.3}%) translateZ(0)`,
            willChange: 'transform',
            maxHeight: safeBounds.outerMaxHeight,
            maxWidth: safeBounds.outerMaxWidth,
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(200, 157, 53, 0.3)',
            borderRadius: '2px',
            overflow: 'hidden',
            backgroundColor: COLOR_PALETTE.ancientWood,
          }}
        >
          <Img
            src={resolvedSrc}
            onError={handlePrimaryError}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (!naturalDimensions && img.naturalWidth && img.naturalHeight) {
                setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
              }
            }}
            style={{
              maxHeight: safeBounds.maxHeight,
              maxWidth: safeBounds.maxWidth,
              objectFit: 'contain',
              filter: filterCss,
              display: 'block',
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
