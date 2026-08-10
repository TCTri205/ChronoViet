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
  const { scale, isLandscape } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);
  const cleanTitle = toVietnameseUpperCase(title);

  // Delay card entrance by 15 frames (0.5s) so background media shows first
  const cardDelay = 15;
  const leftX = interpolate(frame, [cardDelay, cardDelay + 15], [-120, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rightX = interpolate(frame, [cardDelay, cardDelay + 15], [120, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const vsScale = spring({
    frame: Math.max(0, frame - cardDelay - 10),
    fps,
    from: 0,
    to: 1,
    config: { damping: 10, stiffness: 120 },
  });

  const opacity = interpolate(frame, [cardDelay, cardDelay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const vsPulse = Math.sin(frame * 0.1) * 0.08 + 1;

  const headerFontSize = Math.round((isLandscape ? 32 : 24) * scale);
  const nameFontSize = Math.round((isLandscape ? 34 : 26) * scale);
  const statFontSize = Math.round((isLandscape ? 18 : 15) * scale);

  const [hasBgError, setHasBgError] = React.useState(false);

  const rawLeft = leftSide || { name: '', stat: '', color: activeTheme.secondaryColor };
  const rawRight = rightSide || { name: '', stat: '', color: '#8B0000' };

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

      {/* Dynamic Background Split Glow */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, rgba(37, 99, 235, 0.2) 0%, transparent 45%, transparent 55%, rgba(139, 0, 0, 0.25) 100%)`,
        }}
      />

      {/* Header Badge */}
      {cleanTitle && (
        <div
          style={{
            opacity,
            transform: `translateY(${interpolate(frame, [0, 12], [-30, 0], { extrapolateRight: 'clamp' })}px)`,
            zIndex: 20,
            marginBottom: `${Math.round(30 * scale)}px`,
            backgroundColor: 'rgba(139, 0, 0, 0.3)',
            color: '#ffffff',
            fontFamily: activeFont,
            fontSize: `${headerFontSize}px`,
            fontWeight: 900,
            letterSpacing: '1px',
            padding: `${Math.round(8 * scale)}px ${Math.round(28 * scale)}px`,
            borderRadius: `${Math.round(30 * scale)}px`,
            border: `2px solid ${activeTheme.primaryColor}`,
            boxShadow: `0 0 30px ${activeTheme.accentGlow}`,
          }}
        >
          {cleanTitle}
        </div>
      )}

      {/* Main Versus Container */}
      <div
        style={{
          width: isLandscape ? '85%' : '94%',
          maxWidth: '1200px',
          display: 'flex',
          flexDirection: isLandscape ? 'row' : 'column',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: `${Math.round(24 * scale)}px`,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Left Side */}
        <div
          style={{
            flex: 1,
            transform: `translateX(${leftX}px)`,
            opacity,
            padding: `${Math.round(32 * scale)}px ${Math.round(28 * scale)}px`,
            background: 'rgba(10, 18, 32, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: `${Math.round(20 * scale)}px`,
            border: `2px solid ${left.color || activeTheme.secondaryColor}`,
            boxShadow: `0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(37, 99, 235, 0.3)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: isLandscape ? 'flex-end' : 'center',
            textAlign: isLandscape ? 'right' : 'center',
          }}
        >
          {left.badge && (
            <span
              style={{
                backgroundColor: left.color || activeTheme.secondaryColor,
                color: '#ffffff',
                fontFamily: activeFont,
                fontSize: `${Math.round(13 * scale)}px`,
                fontWeight: 800,
                padding: `${Math.round(4 * scale)}px ${Math.round(14 * scale)}px`,
                borderRadius: `${Math.round(12 * scale)}px`,
                marginBottom: `${Math.round(12 * scale)}px`,
              }}
            >
              {left.badge}
            </span>
          )}

          <h3
            style={{
              margin: 0,
              fontFamily: activeFont,
              fontSize: `${nameFontSize}px`,
              fontWeight: 900,
              color: left.color || activeTheme.secondaryColor,
              letterSpacing: '0.5px',
            }}
          >
            {left.name}
          </h3>

          <p
            style={{
              margin: `${Math.round(12 * scale)}px 0 0 0`,
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

        {/* Center VS Badge */}
        <div
          style={{
            alignSelf: 'center',
            transform: `scale(${vsScale * vsPulse})`,
            zIndex: 30,
            width: `${Math.round(76 * scale)}px`,
            height: `${Math.round(76 * scale)}px`,
            borderRadius: '50%',
            backgroundColor: COLOR_PALETTE.crimsonDark,
            border: `3px solid ${activeTheme.primaryColor}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: `0 0 40px ${activeTheme.accentGlow}, 0 0 25px rgba(239, 68, 68, 0.7)`,
          }}
        >
          <span
            style={{
              fontFamily: activeFont,
              fontSize: `${Math.round(30 * scale)}px`,
              fontWeight: 900,
              color: activeTheme.primaryColor,
              letterSpacing: '1px',
              fontStyle: 'italic',
            }}
          >
            VS
          </span>
        </div>

        {/* Right Side */}
        <div
          style={{
            flex: 1,
            transform: `translateX(${rightX}px)`,
            opacity,
            padding: `${Math.round(32 * scale)}px ${Math.round(28 * scale)}px`,
            background: 'rgba(28, 12, 16, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: `${Math.round(20 * scale)}px`,
            border: `2px solid ${right.color || COLOR_PALETTE.crimsonDark}`,
            boxShadow: `0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 0, 0, 0.35)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: isLandscape ? 'flex-start' : 'center',
            textAlign: isLandscape ? 'left' : 'center',
          }}
        >
          {right.badge && (
            <span
              style={{
                backgroundColor: right.color || COLOR_PALETTE.crimsonDark,
                color: '#ffffff',
                fontFamily: activeFont,
                fontSize: `${Math.round(13 * scale)}px`,
                fontWeight: 800,
                padding: `${Math.round(4 * scale)}px ${Math.round(14 * scale)}px`,
                borderRadius: `${Math.round(12 * scale)}px`,
                marginBottom: `${Math.round(12 * scale)}px`,
              }}
            >
              {right.badge}
            </span>
          )}

          <h3
            style={{
              margin: 0,
              fontFamily: activeFont,
              fontSize: `${nameFontSize}px`,
              fontWeight: 900,
              color: right.color || '#ef4444',
              letterSpacing: '0.5px',
            }}
          >
            {right.name}
          </h3>

          <p
            style={{
              margin: `${Math.round(12 * scale)}px 0 0 0`,
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
