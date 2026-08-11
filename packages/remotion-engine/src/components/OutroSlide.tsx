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
  const { scale } = useResponsiveLayout();
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

  // Phase 1: Poem quote (0 - 150 frames ~ 5s)
  const poemOpacity = interpolate(frame, [0, 20, 110, 140], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

  // Phase 2: End Card CTA (130 frames onwards)
  const endCardScale = spring({
    frame: Math.max(0, frame - 130),
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });

  const endCardOpacity = interpolate(frame, [130, 150], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const poemFontSize = Math.round(32 * scale);
  const titleFontSize = Math.round(34 * scale);

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
      {/* Historical Parchment Vignette Canvas Overlay */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at center, transparent 35%, rgba(14, 12, 10, 0.9) 100%)',
          pointerEvents: 'none',
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
              maxWidth: '70%',
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
                  letterSpacing: '1.5px',
                }}
              >
                — {cleanAuthor}
              </span>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* 2. Phase 2: Dynamic Outro End Card (Framed Mộc Bản) */}
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
            maxWidth: '75%',
            backgroundColor: 'rgba(22, 18, 14, 0.95)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: '2px',
            border: `1px solid ${activeTheme.primaryColor}`,
            outline: `1px solid ${activeTheme.accentGlow}`,
            outlineOffset: '-6px',
            padding: `${Math.round(44 * scale)}px ${Math.round(52 * scale)}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.95)',
          }}
        >
          {/* Dynamic Brand Square Seal Stamp Icon */}
          <div
            style={{
              width: `${Math.round(64 * scale)}px`,
              height: `${Math.round(64 * scale)}px`,
              borderRadius: '2px',
              backgroundColor: COLOR_PALETTE.vermilionRed,
              border: `2px solid ${activeTheme.primaryColor}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.95)',
              marginBottom: `${Math.round(18 * scale)}px`,
            }}
          >
            <span
              style={{
                fontFamily: activeSerifFont,
                fontSize: `${Math.round(28 * scale)}px`,
                fontWeight: 900,
                color: COLOR_PALETTE.docParchment,
              }}
            >
              印
            </span>
          </div>

          {cleanTitle && (
            <h2
              style={{
                margin: 0,
                fontFamily: activeSerifFont,
                fontSize: `${titleFontSize}px`,
                fontWeight: 900,
                color: activeTheme.primaryColor,
                letterSpacing: '1px',
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
                color: COLOR_PALETTE.textSubtle,
                letterSpacing: '1px',
              }}
            >
              {cleanCtaText}
            </p>
          )}

          {/* Dynamic Red Seal Badges from JSON Input */}
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
                    backgroundColor: idx === 0 ? 'rgba(155, 27, 27, 0.2)' : 'rgba(32, 26, 18, 0.6)',
                    border: idx === 0 ? `2px solid ${COLOR_PALETTE.vermilionRed}` : `1px solid ${activeTheme.primaryColor}`,
                    color: idx === 0 ? COLOR_PALETTE.vermilionRed : activeTheme.primaryColor,
                    fontFamily: activeFont,
                    fontWeight: 800,
                    fontSize: `${Math.round(13 * scale)}px`,
                    padding: '8px 20px',
                    borderRadius: '2px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  【 {toVietnameseUpperCase(badge)} 】
                </div>
              ))}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

