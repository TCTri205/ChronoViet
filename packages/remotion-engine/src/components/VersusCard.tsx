import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig, VersusSide } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface VersusCardProps {
  title?: string;
  leftSide?: VersusSide;
  rightSide?: VersusSide;
  bgImageSrc?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const VersusCard: React.FC<VersusCardProps> = ({
  title,
  leftSide,
  rightSide,
  bgImageSrc,
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);
  const activeSerifFont = getSafeFontFamily(theme?.fontFamily, true);
  const cleanTitle = toVietnameseUpperCase(title);

  // Delay card entrance by 15 frames (0.5s) so background media shows first
  const cardDelay = 15;
  const leftX = interpolate(frame, [cardDelay, cardDelay + 15], [-100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rightX = interpolate(frame, [cardDelay, cardDelay + 15], [100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const vsScale = spring({
    frame: Math.max(0, frame - cardDelay - 8),
    fps,
    from: 0,
    to: 1,
    config: { damping: 12, stiffness: 110 },
  });

  const opacity = interpolate(frame, [cardDelay, cardDelay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const headerFontSize = Math.round(28 * scale);
  const nameFontSize = Math.round(32 * scale);
  const statFontSize = Math.round(17 * scale);

  const rawLeft = leftSide || { name: '', stat: '', color: activeTheme.primaryColor };
  const rawRight = rightSide || { name: '', stat: '', color: COLOR_PALETTE.vermilionRed };

  const left = {
    ...rawLeft,
    name: toVietnameseUpperCase(rawLeft.name),
    badge: toVietnameseUpperCase(rawLeft.badge),
    stat: normalizeVietnameseText(rawLeft.stat),
  };

  const right = {
    ...rawRight,
    name: toVietnameseUpperCase(rawRight.name),
    badge: toVietnameseUpperCase(rawRight.badge),
    stat: normalizeVietnameseText(rawRight.stat),
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Historical Parchment Vignette Canvas Overlay */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at center, transparent 40%, rgba(14, 12, 10, 0.85) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header Badge (Con dấu Triện Son Tiêu Đề) */}
      {cleanTitle && (
        <div
          style={{
            opacity,
            transform: `translateY(${interpolate(frame, [0, 12], [-30, 0], { extrapolateRight: 'clamp' })}px)`,
            zIndex: 20,
            marginBottom: `${Math.round(28 * scale)}px`,
            backgroundColor: 'rgba(155, 27, 27, 0.15)',
            color: COLOR_PALETTE.vermilionRed,
            fontFamily: activeFont,
            fontSize: `${headerFontSize}px`,
            fontWeight: 900,
            letterSpacing: '2px',
            padding: `${Math.round(6 * scale)}px ${Math.round(24 * scale)}px`,
            borderRadius: '2px',
            border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
          }}
        >
          【 {cleanTitle} 】
        </div>
      )}

      {/* Main Versus Container */}
      <div
        style={{
          width: '85%',
          maxWidth: '1200px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: `${Math.round(20 * scale)}px`,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Left Side (Phe 1 - Framed Mộc Bản) */}
        <div
          style={{
            flex: 1,
            transform: `translateX(${leftX}px)`,
            opacity,
            padding: `${Math.round(28 * scale)}px ${Math.round(26 * scale)}px`,
            background: 'rgba(22, 18, 14, 0.95)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: '2px',
            border: `1px solid ${left.color || activeTheme.primaryColor}`,
            outline: `1px solid ${activeTheme.accentGlow}`,
            outlineOffset: '-5px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            textAlign: 'right',
          }}
        >
          {left.badge && (
            <span
              style={{
                backgroundColor: 'rgba(200, 157, 53, 0.15)',
                color: left.color || activeTheme.primaryColor,
                fontFamily: activeFont,
                fontSize: `${Math.round(12 * scale)}px`,
                fontWeight: 800,
                letterSpacing: '1px',
                padding: `${Math.round(3 * scale)}px ${Math.round(12 * scale)}px`,
                borderRadius: '2px',
                border: `1px solid ${left.color || activeTheme.primaryColor}`,
                marginBottom: `${Math.round(12 * scale)}px`,
              }}
            >
              {left.badge}
            </span>
          )}

          <h3
            style={{
              margin: 0,
              fontFamily: activeSerifFont,
              fontSize: `${nameFontSize}px`,
              fontWeight: 900,
              color: left.color || activeTheme.primaryColor,
              letterSpacing: '0.5px',
            }}
          >
            {left.name}
          </h3>

          <p
            style={{
              margin: `${Math.round(10 * scale)}px 0 0 0`,
              fontFamily: activeFont,
              fontSize: `${statFontSize}px`,
              color: COLOR_PALETTE.textSubtle,
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            {left.stat}
          </p>
        </div>

        {/* Center VS Badge (Con Dấu Triện Trận Đánh) */}
        <div
          style={{
            alignSelf: 'center',
            transform: `scale(${vsScale})`,
            zIndex: 30,
            width: `${Math.round(64 * scale)}px`,
            height: `${Math.round(64 * scale)}px`,
            borderRadius: '2px',
            backgroundColor: COLOR_PALETTE.vermilionRed,
            border: `2px solid ${activeTheme.primaryColor}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.95)',
          }}
        >
          <span
            style={{
              fontFamily: activeSerifFont,
              fontSize: `${Math.round(26 * scale)}px`,
              fontWeight: 900,
              color: COLOR_PALETTE.docParchment,
              letterSpacing: '1px',
            }}
          >
            VS
          </span>
        </div>

        {/* Right Side (Phe 2 - Framed Mộc Bản) */}
        <div
          style={{
            flex: 1,
            transform: `translateX(${rightX}px)`,
            opacity,
            padding: `${Math.round(28 * scale)}px ${Math.round(26 * scale)}px`,
            background: 'rgba(22, 18, 14, 0.95)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: '2px',
            border: `1px solid ${right.color || COLOR_PALETTE.vermilionRed}`,
            outline: `1px solid ${activeTheme.accentGlow}`,
            outlineOffset: '-5px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
          }}
        >
          {right.badge && (
            <span
              style={{
                backgroundColor: 'rgba(155, 27, 27, 0.15)',
                color: right.color || COLOR_PALETTE.vermilionRed,
                fontFamily: activeFont,
                fontSize: `${Math.round(12 * scale)}px`,
                fontWeight: 800,
                letterSpacing: '1px',
                padding: `${Math.round(3 * scale)}px ${Math.round(12 * scale)}px`,
                borderRadius: '2px',
                border: `1px solid ${right.color || COLOR_PALETTE.vermilionRed}`,
                marginBottom: `${Math.round(12 * scale)}px`,
              }}
            >
              {right.badge}
            </span>
          )}

          <h3
            style={{
              margin: 0,
              fontFamily: activeSerifFont,
              fontSize: `${nameFontSize}px`,
              fontWeight: 900,
              color: right.color || COLOR_PALETTE.vermilionRed,
              letterSpacing: '0.5px',
            }}
          >
            {right.name}
          </h3>

          <p
            style={{
              margin: `${Math.round(10 * scale)}px 0 0 0`,
              fontFamily: activeFont,
              fontSize: `${statFontSize}px`,
              color: COLOR_PALETTE.textSubtle,
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            {right.stat}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

