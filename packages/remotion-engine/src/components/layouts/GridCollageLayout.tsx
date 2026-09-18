import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { COLOR_PALETTE } from '../../constants/config';
import { BaseSlideLayoutProps } from './types';

export const GridCollageLayout: React.FC<BaseSlideLayoutProps> = ({
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
}) => {
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
          padding: `${Math.round(canvasHeight * 0.04)}px`,
        }}
      >
        <div
          style={{
            transform: `rotate(${rotateDeg}deg) scale(${scale}) translate(${translateX * 0.25}%, ${translateY * 0.25}%) translateZ(0)`,
            maxHeight: safeBounds.outerMaxHeight,
            maxWidth: safeBounds.outerMaxWidth,
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
};
