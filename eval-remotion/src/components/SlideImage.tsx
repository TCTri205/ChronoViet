import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { calculateKenBurnsTransform, getFilterCss } from '../utils/animationUtils';
import { CustomKenBurns, FilterStyle, KenBurnsEffect } from '../types';

interface SlideImageProps {
  src: string;
  durationInFrames: number;
  zoomType?: KenBurnsEffect | 'zoom-in' | 'zoom-out' | 'pan-left';
  customKenBurns?: CustomKenBurns;
  filterStyle?: FilterStyle;
  rotateDeg?: number;
}

export const SlideImage: React.FC<SlideImageProps> = ({
  src,
  durationInFrames,
  zoomType = 'KEN_BURNS_ZOOM_IN',
  customKenBurns,
  filterStyle = 'HISTORICAL',
  rotateDeg = 0,
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

  const filterCss = getFilterCss(filterStyle);

  const [hasError, setHasError] = React.useState(false);

  const fallbackSrc = staticFile('assets/battle/bach_dang_river.jpg');

  const resolvedSrc = hasError
    ? fallbackSrc
    : src.startsWith('http') || src.startsWith('data:')
    ? src
    : staticFile(src);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d0d0d', overflow: 'hidden' }}>
      {/* 1. Lớp nền Mờ (Blur Background) cho ảnh kích thước không chuẩn */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={resolvedSrc}
          onError={() => setHasError(true)}
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

      {/* 2. Lớp ảnh chính (Foreground) có hiệu ứng Pan/Zoom & Viền Rõ Ràng */}
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
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.12)',
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: '#0a0807',
          }}
        >
          <Img
            src={resolvedSrc}
            onError={() => setHasError(true)}
            style={{
              maxHeight: '80vh',
              maxWidth: '80vw',
              objectFit: 'contain',
              // Áp dụng Sepia/Historical filter tạo chất cổ kính
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
