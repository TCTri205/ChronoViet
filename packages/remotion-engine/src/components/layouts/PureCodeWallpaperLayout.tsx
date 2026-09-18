import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { COLOR_PALETTE } from '../../constants/config';
import { BaseSlideLayoutProps } from './types';

export const PureCodeWallpaperLayout: React.FC<BaseSlideLayoutProps> = ({
  resolvedSrc,
  handlePrimaryError,
  filterCss,
  rotateDeg = 0,
  scale,
  translateX,
  translateY,
}) => {
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
          filter: `${filterCss} blur(6px) brightness(0.60) saturate(0.95)`,
          transform: `rotate(${rotateDeg}deg) scale(${scale * 1.25}) translate(${translateX * 0.3}%, ${translateY * 0.3}%) translateZ(0)`,
          willChange: 'transform',
          opacity: 0.95,
        }}
      />
      {/* Darkening & Radial Vignette Overlay for Crisp UI Contrast */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(14, 12, 10, 0.25) 0%, rgba(14, 12, 10, 0.70) 75%, rgba(10, 8, 6, 0.85) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
