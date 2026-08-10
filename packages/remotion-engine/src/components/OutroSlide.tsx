import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface OutroSlideProps {
  poemQuote?: string;
  author?: string;
  title?: string;
  ctaText?: string;
  bulletPoints?: string[];
  bgImageSrc?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const OutroSlide: React.FC<OutroSlideProps> = ({
  poemQuote,
  author,
  title,
  ctaText,
  bulletPoints = [],
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

  const cleanPoemQuote = normalizeVietnameseText(poemQuote);
  const cleanAuthor = normalizeVietnameseText(author);
  const cleanTitle = toVietnameseUpperCase(title);
  const cleanCtaText = toVietnameseUpperCase(ctaText);

  // Derive logo initials from title or default dynamically
  const logoInitials = cleanTitle
    ? cleanTitle.split(' ').map((w) => w[0]).join('').slice(0, 2)
    : 'CV';

  // Background zoom motion
  const bgScale = interpolate(frame, [0, durationInFrames], [1.0, 1.1], { extrapolateRight: 'clamp' });
  const [hasBgError, setHasBgError] = React.useState(false);

  // Phase 1: Poem quote (0 - 150 frames ~ 5s)
  const poemOpacity = interpolate(frame, [0, 20, 110, 140], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

  // Phase 2: End Card CTA (130 frames onwards)
  const endCardScale = spring({
    frame: Math.max(0, frame - 130),
    fps,
    from: 0.85,
    to: 1,
    config: { damping: 14, stiffness: 100 },
  });

  const endCardOpacity = interpolate(frame, [130, 150], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const poemFontSize = Math.round((isLandscape ? 32 : 24) * scale);
  const titleFontSize = Math.round((isLandscape ? 34 : 26) * scale);

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

      {/* Primary Glow Accent */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at center, ${activeTheme.accentGlow} 0%, transparent 65%)`,
          opacity: 0.5,
        }}
      />

      {/* 1. Phase 1: Dynamic Poem / Quote */}
      {cleanPoemQuote && (
        <AbsoluteFill
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: poemOpacity,
            padding: `${Math.round(40 * scale)}px`,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: isLandscape ? '70%' : '85%',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontFamily: activeSerifFont,
                fontSize: `${poemFontSize}px`,
                fontWeight: 700,
                fontStyle: 'italic',
                lineHeight: 1.6,
                color: activeTheme.primaryColor,
                whiteSpace: 'pre-line',
                textShadow: '0 4px 16px rgba(0, 0, 0, 0.95)',
                margin: 0,
              }}
            >
              {cleanPoemQuote}
            </p>
            {cleanAuthor && (
              <span
                style={{
                  display: 'block',
                  marginTop: `${Math.round(20 * scale)}px`,
                  fontFamily: activeFont,
                  fontSize: `${Math.round(16 * scale)}px`,
                  fontWeight: 700,
                  color: COLOR_PALETTE.textSubtle,
                  letterSpacing: '1px',
                }}
              >
                — {cleanAuthor}
              </span>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* 2. Phase 2: Dynamic Outro End Card */}
      <AbsoluteFill
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: endCardOpacity,
          transform: `scale(${endCardScale})`,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: isLandscape ? '75%' : '88%',
            backgroundColor: 'rgba(15, 23, 34, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: `${Math.round(24 * scale)}px`,
            border: `2px solid ${activeTheme.secondaryColor}`,
            padding: `${Math.round(48 * scale)}px ${Math.round(56 * scale)}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: `0 25px 80px rgba(0,0,0,0.9), 0 0 45px ${activeTheme.accentGlow}`,
          }}
        >
          {/* Dynamic Brand Icon */}
          <div
            style={{
              width: `${Math.round(72 * scale)}px`,
              height: `${Math.round(72 * scale)}px`,
              borderRadius: '50%',
              backgroundColor: activeTheme.secondaryColor,
              border: `2px solid ${activeTheme.primaryColor}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: `0 0 30px ${activeTheme.accentGlow}`,
              marginBottom: `${Math.round(18 * scale)}px`,
            }}
          >
            <span
              style={{
                fontFamily: activeFont,
                fontSize: `${Math.round(32 * scale)}px`,
                fontWeight: 900,
                color: activeTheme.primaryColor,
              }}
            >
              {logoInitials}
            </span>
          </div>

          {cleanTitle && (
            <h2
              style={{
                margin: 0,
                fontFamily: activeFont,
                fontSize: `${titleFontSize}px`,
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '0.8px',
              }}
            >
              {cleanTitle}
            </h2>
          )}

          {cleanCtaText && (
            <p
              style={{
                margin: `${Math.round(14 * scale)}px 0 ${Math.round(24 * scale)}px 0`,
                fontFamily: activeFont,
                fontSize: `${Math.round(18 * scale)}px`,
                fontWeight: 700,
                color: activeTheme.primaryColor,
                letterSpacing: '0.8px',
              }}
            >
              {cleanCtaText}
            </p>
          )}

          {/* Dynamic Badges from JSON Input */}
          {bulletPoints.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: `${Math.round(16 * scale)}px`,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {bulletPoints.map((badge, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: idx === 0 ? activeTheme.secondaryColor : 'rgba(255, 255, 255, 0.1)',
                    border: idx === 0 ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    fontFamily: activeFont,
                    fontWeight: 800,
                    fontSize: `${Math.round(14 * scale)}px`,
                    padding: '10px 24px',
                    borderRadius: '20px',
                    letterSpacing: '0.8px',
                  }}
                >
                  {toVietnameseUpperCase(badge)}
                </div>
              ))}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
