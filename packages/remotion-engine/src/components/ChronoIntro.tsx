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
  const { scale } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);
  const activeSerifFont = getSafeFontFamily(theme?.fontFamily, true);

  const cleanArticleTitle = toVietnameseUpperCase(articleTitle);
  const cleanAuthorName = normalizeVietnameseText(authorName);

  // Logo Animation Pop-in & Scale
  const logoScale = spring({
    frame,
    fps,
    from: 0.5,
    to: 1,
    config: { damping: 14, stiffness: 90 },
  });

  const logoOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [20, 40], [30, 0], { extrapolateRight: 'clamp' });

  const logoSize = Math.round(120 * scale);
  const brandFontSize = Math.round(44 * scale);
  const tagFontSize = Math.round(16 * scale);
  const videoTitleFontSize = Math.round(28 * scale);

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

      {/* Main Content Box: Logo + Title */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 10,
          padding: `${Math.round(40 * scale)}px`,
          maxWidth: '75%',
        }}
      >
        {/* ChronoViet Imperial Red Seal Stamp Crest Icon */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            width: `${logoSize}px`,
            height: `${logoSize}px`,
            borderRadius: '2px',
            backgroundColor: COLOR_PALETTE.vermilionRed,
            border: `2px solid ${activeTheme.primaryColor}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 15px 40px rgba(0, 0, 0, 0.95)',
            marginBottom: `${Math.round(24 * scale)}px`,
          }}
        >
          <span
            style={{
              fontFamily: activeSerifFont,
              fontSize: `${Math.round(logoSize * 0.45)}px`,
              fontWeight: 900,
              color: COLOR_PALETTE.docParchment,
              letterSpacing: '1px',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            印
          </span>
        </div>

        {/* Project / Brand Name */}
        <h1
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${brandFontSize}px`,
            fontWeight: 900,
            color: activeTheme.primaryColor,
            letterSpacing: '4px',
            textShadow: '0 4px 18px rgba(0,0,0,0.95)',
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
              marginTop: `${Math.round(10 * scale)}px`,
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

        {/* Decorative Heritage Divider */}
        <div
          style={{
            opacity: titleOpacity,
            width: `${Math.round(160 * scale)}px`,
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

