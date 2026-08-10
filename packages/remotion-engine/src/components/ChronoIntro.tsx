import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface ChronoIntroProps {
  articleTitle?: string;
  authorName?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const ChronoIntro: React.FC<ChronoIntroProps> = ({
  articleTitle = 'TƯ LIỆU SỬ VIỆT',
  authorName,
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, isLandscape } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);

  const cleanArticleTitle = toVietnameseUpperCase(articleTitle);
  const cleanAuthorName = normalizeVietnameseText(authorName);

  // Logo Animation Pop-in & Scale
  const logoScale = spring({
    frame,
    fps,
    from: 0.3,
    to: 1,
    config: { damping: 14, stiffness: 90 },
  });

  const logoOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [20, 40], [30, 0], { extrapolateRight: 'clamp' });

  // Ambient pulsing glow effect
  const glowPulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.7, 1.1]
  );

  const logoSize = Math.round((isLandscape ? 130 : 100) * scale);
  const brandFontSize = Math.round((isLandscape ? 44 : 32) * scale);
  const tagFontSize = Math.round((isLandscape ? 16 : 13) * scale);
  const videoTitleFontSize = Math.round((isLandscape ? 28 : 22) * scale);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Lightweight Edge Vignette Accent */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.7) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Content Box: Logo + Title */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 10,
          padding: `${Math.round(40 * scale)}px`,
          maxWidth: isLandscape ? '75%' : '88%',
        }}
      >
        {/* ChronoViet Crest Icon */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            width: `${logoSize}px`,
            height: `${logoSize}px`,
            borderRadius: '50%',
            backgroundColor: activeTheme.secondaryColor,
            border: `3px solid ${activeTheme.primaryColor}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: `0 0 50px ${activeTheme.accentGlow}, 0 0 25px ${activeTheme.accentGlow}`,
            marginBottom: `${Math.round(24 * scale)}px`,
          }}
        >
          <span
            style={{
              fontFamily: activeFont,
              fontSize: `${Math.round(logoSize * 0.45)}px`,
              fontWeight: 900,
              color: activeTheme.primaryColor,
              letterSpacing: '-1px',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            CV
          </span>
        </div>

        {/* Project / Brand Name */}
        <h1
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            margin: 0,
            fontFamily: activeFont,
            fontSize: `${brandFontSize}px`,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '5px',
            textShadow: '0 4px 18px rgba(0,0,0,0.9)',
          }}
        >
          {cleanArticleTitle}
        </h1>

        {/* Project Subtitle Tag */}
        {cleanAuthorName && (
          <span
            style={{
              transform: `scale(${logoScale})`,
              opacity: logoOpacity,
              marginTop: `${Math.round(8 * scale)}px`,
              fontFamily: activeFont,
              fontSize: `${tagFontSize}px`,
              fontWeight: 700,
              color: COLOR_PALETTE.textSubtle,
              letterSpacing: '2px',
            }}
          >
            Biên Soạn: {cleanAuthorName}
          </span>
        )}

        {/* Decorative Divider */}
        <div
          style={{
            opacity: titleOpacity,
            width: `${Math.round(140 * scale)}px`,
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${activeTheme.primaryColor}, transparent)`,
            margin: `${Math.round(28 * scale)}px 0`,
          }}
        />

        {/* Video Feature Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: activeFont,
              fontSize: `${videoTitleFontSize}px`,
              fontWeight: 800,
              color: COLOR_PALETTE.textWhite,
              letterSpacing: '0.8px',
              lineHeight: 1.4,
              textShadow: '0 3px 12px rgba(0,0,0,0.9)',
            }}
          >
            {cleanArticleTitle}
          </h2>
        </div>
      </div>
    </AbsoluteFill>
  );
};
