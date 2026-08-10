import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface QuoteSlideProps {
  quoteText: string;
  author?: string;
  subtitle?: string;
  bgImageSrc?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const QuoteSlide: React.FC<QuoteSlideProps> = ({
  quoteText,
  author,
  subtitle,
  bgImageSrc,
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, isLandscape } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily, false);
  const activeSerifFont = getSafeFontFamily(theme?.fontFamily, true);

  const cleanQuoteText = normalizeVietnameseText(quoteText);
  const cleanAuthor = toVietnameseUpperCase(author);
  const cleanSubtitle = normalizeVietnameseText(subtitle);

  // Dimming background progress
  const bgOpacity = interpolate(frame, [0, 15], [0.3, 0.55], { extrapolateRight: 'clamp' });
  const bgScale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], { extrapolateRight: 'clamp' });

  // Delay quote card entrance by 18 frames (0.6s) so background media & overlay headers establish first
  const cardDelay = 18;
  const cardScale = spring({
    frame: Math.max(0, frame - cardDelay),
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 14, stiffness: 90 },
  });

  const opacity = interpolate(frame, [cardDelay, cardDelay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const badgeFontSize = Math.round(12 * scale);
  const quoteFontSize = Math.round((isLandscape ? 34 : 26) * scale);
  const authorFontSize = Math.round(17 * scale);
  const subtitleFontSize = Math.round(14 * scale);
  const markSize = Math.round(64 * scale);

  const [hasBgError, setHasBgError] = React.useState(false);

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

      {/* Decorative Canvas Texture */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(rgba(212, 175, 55, 0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.7,
        }}
      />


      {/* 2. Main Quote Card Container */}
      <div
        style={{
          transform: `scale(${cardScale}) translateZ(0)`,
          opacity,
          willChange: 'transform, opacity',
          maxWidth: isLandscape ? '82%' : '92%',
          width: isLandscape ? '880px' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 10,
          padding: `${Math.round(36 * scale)}px ${Math.round(44 * scale)}px`,
          background: 'rgba(10, 8, 6, 0.94)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: `${Math.round(16 * scale)}px`,
          border: `1px solid ${activeTheme.accentGlow}`,
          borderLeft: `4px solid ${activeTheme.primaryColor}`,
          boxShadow:
            `0 25px 70px rgba(0, 0, 0, 0.95), 0 0 50px ${activeTheme.accentGlow}`,
        }}
      >
        {/* Dynamic Category Header Badge */}
        {cleanSubtitle && (
          <div
            style={{
              fontFamily: activeFont,
              fontSize: `${badgeFontSize}px`,
              fontWeight: 800,
              letterSpacing: '2px',
              color: activeTheme.primaryColor,
              backgroundColor: 'rgba(212, 175, 55, 0.12)',
              border: `1px solid ${activeTheme.accentGlow}`,
              padding: '4px 16px',
              borderRadius: '20px',
              marginBottom: `${Math.round(14 * scale)}px`,
            }}
          >
            ✦ {cleanSubtitle} ✦
          </div>
        )}

        {/* Decorative Quote Mark */}
        <span
          style={{
            fontFamily: activeSerifFont,
            fontSize: `${markSize}px`,
            lineHeight: 0.5,
            color: activeTheme.primaryColor,
            opacity: 0.9,
            marginBottom: `${Math.round(10 * scale)}px`,
            textShadow: `0 0 24px ${activeTheme.accentGlow}`,
          }}
        >
          “
        </span>

        {/* Quote Text */}
        <h2
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${quoteFontSize}px`,
            fontWeight: 700,
            fontStyle: 'italic',
            lineHeight: 1.5,
            color: COLOR_PALETTE.textWhite,
            letterSpacing: '0.2px',
            textShadow: '0 4px 14px rgba(0, 0, 0, 0.95)',
          }}
        >
          "{cleanQuoteText}"
        </h2>

        {/* Decorative Divider */}
        <div
          style={{
            width: `${Math.round(140 * scale)}px`,
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${activeTheme.primaryColor}, transparent)`,
            margin: `${Math.round(20 * scale)}px 0`,
          }}
        />

        {/* Author / Source */}
        {cleanAuthor && (
          <span
            style={{
              fontFamily: activeFont,
              fontSize: `${authorFontSize}px`,
              fontWeight: 800,
              color: activeTheme.primaryColor,
              letterSpacing: '1.5px',
            }}
          >
            — {cleanAuthor}
          </span>
        )}

        {cleanSubtitle && (
          <span
            style={{
              fontFamily: activeFont,
              fontSize: `${subtitleFontSize}px`,
              fontWeight: 500,
              color: COLOR_PALETTE.textSubtle,
              marginTop: `${Math.round(6 * scale)}px`,
              letterSpacing: '0.5px',
            }}
          >
            ({cleanSubtitle})
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};
