import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { COLOR_PALETTE } from '../../constants/config';
import { BaseSlideLayoutProps } from './types';

export const SplitCompareLayout: React.FC<BaseSlideLayoutProps> = ({
  resolvedSrc,
  resolvedSecondarySrc,
  handlePrimaryError,
  handleSecondaryError,
  filterCss,
  scale,
  translateX,
  translateY,
}) => {
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
            src={resolvedSecondarySrc || resolvedSrc}
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
};
