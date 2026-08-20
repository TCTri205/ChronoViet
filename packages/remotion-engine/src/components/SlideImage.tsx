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
  sceneId?: string;
  index?: number;
}

const normalizePath = (url: string) => {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
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

  const handlePrimaryError = React.useCallback(() => {
    if (!hasPrimaryError) {
      setHasPrimaryError(true);
      console.warn(
        `[remotion-engine] render.asset_load_failed: Failed to load primary asset '${src}' (sceneId: ${sceneId ?? 'unknown'}, layoutMode: ${layoutMode}, index: ${index ?? 'unknown'})`
      );
    }
  }, [hasPrimaryError, src, sceneId, layoutMode, index]);

  const handleSecondaryError = React.useCallback(() => {
    if (!hasSecondaryError) {
      setHasSecondaryError(true);
      console.warn(
        `[remotion-engine] render.asset_load_failed: Failed to load secondary asset '${secondaryAssetUrl}' (sceneId: ${sceneId ?? 'unknown'}, layoutMode: ${layoutMode}, index: ${index ?? 'unknown'})`
      );
    }
  }, [hasSecondaryError, secondaryAssetUrl, sceneId, layoutMode, index]);

  const resolvedSrc = resolveUrl(src, hasPrimaryError);
  const resolvedSecondarySrc = resolveUrl(secondaryAssetUrl, hasSecondaryError);

  // 0. Pure Code / UI Component Scenes: Image is rendered purely as full-screen blurred background wallpaper (same blur as Type 1, no sharp image component)
  if (isPureCodeScene || isPureCodeLayout(layoutMode)) {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        {/* Fullscreen Blurred Cover Background Image with Ken Burns motion */}
        <Img
          src={resolvedSrc}
          onError={handlePrimaryError}
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
              onError={handlePrimaryError}
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
              onError={handleSecondaryError}
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

  // 2. PURE_IMAGE_FULL: Clean Edge-to-Edge Uncropped Historical Photo
  if (layoutMode === 'PURE_IMAGE_FULL') {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        <Img
          src={resolvedSrc}
          onError={handlePrimaryError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `rotate(${rotateDeg}deg) scale(${scale * 1.05}) translate(${translateX * 0.35}%, ${translateY * 0.35}%) translateZ(0)`,
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

  // 3. FULL_COVER: Fullscreen Cover with Ken Burns motion
  if (layoutMode === 'FULL_COVER') {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        <Img
          src={resolvedSrc}
          onError={handlePrimaryError}
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

  // 4. FULL_CONTAIN / CENTER_SCALE: Clean centered image without blurred background
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

  // 5. VIGNETTE_DARK: Reduced brightness (-40%) with heavy 4-corner radial dark vignette
  if (layoutMode === 'VIGNETTE_DARK') {
    return (
      <AbsoluteFill style={{ backgroundColor: COLOR_PALETTE.lacquerBlack, overflow: 'hidden' }}>
        <Img
          src={resolvedSrc}
          onError={handlePrimaryError}
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

  // 6. HISTORICAL_FRAME: Vintage framed image with ornamental gold border
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
              onError={handlePrimaryError}
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

  // 7. DOCUMENTARY_GRID: Archival photo layout with corner gold frame
  if (layoutMode === 'DOCUMENTARY_GRID') {
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
              filter: 'blur(24px) brightness(0.3) saturate(0.8)',
              transform: `scale(${scale * 1.2})`,
            }}
          />
        </AbsoluteFill>

        {/* Main Framed Documentary Photo */}
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
              transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.25}%, ${translateY * 0.25}%) translateZ(0)`,
              maxHeight: '82%',
              maxWidth: '85%',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 2px rgba(200, 157, 53, 0.4)',
              border: `2px solid ${COLOR_PALETTE.primaryGold}`,
              borderRadius: '2px',
              overflow: 'hidden',
              backgroundColor: COLOR_PALETTE.ancientWood,
              position: 'relative',
            }}
          >
            <Img
              src={resolvedSrc}
              onError={handlePrimaryError}
              style={{
                maxHeight: '78vh',
                maxWidth: '78vw',
                objectFit: 'contain',
                filter: filterCss,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 16,
                padding: '4px 10px',
                backgroundColor: 'rgba(14, 12, 10, 0.88)',
                border: `1px solid ${COLOR_PALETTE.primaryGold}`,
                borderRadius: '2px',
                color: COLOR_PALETTE.primaryGold,
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '1.5px',
              }}
            >
              TƯ LIỆU LỊCH SỬ
            </div>
          </div>
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,0.85) 100%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 8. NEWSPAPER_ARCHIVE: Archival Press Vintage Style
  if (layoutMode === 'NEWSPAPER_ARCHIVE') {
    return (
      <AbsoluteFill style={{ backgroundColor: '#120f0d', overflow: 'hidden' }}>
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img
            src={resolvedSrc}
            onError={handlePrimaryError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'sepia(0.5) blur(20px) brightness(0.25)',
              transform: `scale(${scale * 1.2})`,
            }}
          />
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '45px',
          }}
        >
          <div
            style={{
              transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.2}%, ${translateY * 0.2}%) translateZ(0)`,
              maxHeight: '82%',
              maxWidth: '82%',
              backgroundColor: '#d8c7a6',
              padding: '16px 16px 20px 16px',
              borderRadius: '2px',
              boxShadow: '0 25px 65px rgba(0,0,0,0.95)',
              border: '1px solid #8c734b',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid #2d241e',
                paddingBottom: '6px',
                marginBottom: '10px',
                color: '#2d241e',
                fontFamily: 'serif',
                fontSize: '13px',
                fontWeight: 900,
                letterSpacing: '2px',
              }}
            >
              <span>BẢN TIN SỬ LIỆU</span>
              <span>CHRONOVIET ARCHIVE</span>
            </div>
            <div style={{ overflow: 'hidden', border: '1px solid #5a4738', maxHeight: '68vh', maxWidth: '72vw' }}>
              <Img
                src={resolvedSrc}
                onError={handlePrimaryError}
                style={{
                  maxHeight: '68vh',
                  maxWidth: '72vw',
                  objectFit: 'contain',
                  filter: 'sepia(0.35) contrast(1.1) brightness(0.92)',
                }}
              />
            </div>
          </div>
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.85) 100%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 9. GALLERY_3D: Heritage Exhibition Gallery Perspective Style
  if (layoutMode === 'GALLERY_3D') {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: COLOR_PALETTE.lacquerBlack,
          perspective: '1200px',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img
            src={resolvedSrc}
            onError={handlePrimaryError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(28px) brightness(0.25) saturate(0.7)',
              transform: `scale(${scale * 1.3})`,
            }}
          />
        </AbsoluteFill>

        <div
          style={{
            transform: `rotateY(-6deg) rotateX(4deg) rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.25}%, ${translateY * 0.25}%) translateZ(0)`,
            maxHeight: '80%',
            maxWidth: '82%',
            border: `4px solid ${COLOR_PALETTE.primaryGold}`,
            boxShadow: '0 30px 80px rgba(0,0,0,0.95), 0 0 50px rgba(200, 157, 53, 0.25)',
            borderRadius: '3px',
            backgroundColor: COLOR_PALETTE.ancientWood,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Img
            src={resolvedSrc}
            onError={handlePrimaryError}
            style={{
              maxHeight: '75vh',
              maxWidth: '75vw',
              objectFit: 'contain',
              filter: filterCss,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              padding: '4px 12px',
              backgroundColor: 'rgba(22, 18, 14, 0.9)',
              border: `1px solid ${COLOR_PALETTE.primaryGold}`,
              borderRadius: '2px',
              color: COLOR_PALETTE.primaryGold,
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '1px',
            }}
          >
            TRIỂN LÃM DI SẢN
          </div>
        </div>

        <AbsoluteFill
          style={{
            background: 'radial-gradient(circle at 50% 40%, transparent 35%, rgba(10, 8, 6, 0.9) 100%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // 10. BLUR_BG (Default): Contain image centered with blurred background
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
            onError={handlePrimaryError}
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

