import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { COLOR_PALETTE } from '../../constants/config';
import { BaseSlideLayoutProps } from './types';

export const ArchiveCardLayout: React.FC<BaseSlideLayoutProps> = ({
  resolvedSrc,
  handlePrimaryError,
  filterCss,
  rotateDeg = 0,
  scale,
  translateX,
  translateY,
  safeBounds,
  canvasHeight,
  naturalDimensions,
  setNaturalDimensions,
  layoutMode,
}) => {
  // 1. GALLERY_3D: Heritage Exhibition Gallery Perspective Style
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
            maxHeight: safeBounds.outerMaxHeight,
            maxWidth: safeBounds.outerMaxWidth,
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

  // 2. NEWSPAPER_ARCHIVE: Archival Press Vintage Style (default for ArchiveCardLayout)
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
          padding: `${Math.round(canvasHeight * 0.04)}px`,
        }}
      >
        <div
          style={{
            transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.2}%, ${translateY * 0.2}%) translateZ(0)`,
            maxHeight: safeBounds.outerMaxHeight,
            maxWidth: safeBounds.outerMaxWidth,
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
          <div style={{ overflow: 'hidden', border: '1px solid #5a4738', maxHeight: safeBounds.maxHeight, maxWidth: safeBounds.maxWidth }}>
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
                filter: 'sepia(0.35) contrast(1.1) brightness(0.92)',
                display: 'block',
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
};
