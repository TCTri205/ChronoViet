import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface ChapterTitleProps {
  chapterNumber?: string; // e.g. "I", "II", "III"
  title: string;
  subtitle?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const ChapterTitle: React.FC<ChapterTitleProps> = ({
  chapterNumber,
  title,
  subtitle,
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
  const cleanSubtitle = normalizeVietnameseText(subtitle);
  const cleanChapterNumber = chapterNumber ? toVietnameseUpperCase(chapterNumber) : undefined;

  // Entrance spring animation
  const cardScale = spring({
    frame,
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const lineScale = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' });

  const numFontSize = Math.round(18 * scale);
  const titleFontSize = Math.round(44 * scale);
  const subFontSize = Math.round(20 * scale);

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

      {/* Main Content Box (Framed Mộc Bản) */}
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity,
          maxWidth: '80%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 10,
          padding: `${Math.round(44 * scale)}px ${Math.round(56 * scale)}px`,
          background: 'rgba(22, 18, 14, 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '2px',
          border: `1px solid ${activeTheme.primaryColor}`,
          outline: `1px solid ${activeTheme.accentGlow}`,
          outlineOffset: '-6px',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.95)',
        }}
      >
        {/* Chapter Header Badge (Con dấu Triện Son) */}
        {cleanChapterNumber && (
          <div
            style={{
              backgroundColor: 'rgba(155, 27, 27, 0.15)',
              color: COLOR_PALETTE.vermilionRed,
              fontFamily: activeFont,
              fontSize: `${numFontSize}px`,
              fontWeight: 900,
              letterSpacing: '2px',
              padding: `${Math.round(5 * scale)}px ${Math.round(18 * scale)}px`,
              borderRadius: '2px',
              border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
              marginBottom: `${Math.round(20 * scale)}px`,
              textTransform: 'uppercase',
              boxShadow: 'inset 0 0 4px rgba(155, 27, 27, 0.25)',
            }}
          >
            【 {cleanChapterNumber.startsWith('CHƯƠNG') || cleanChapterNumber.startsWith('PHẦN') || cleanChapterNumber.startsWith('CHAPTER')
              ? cleanChapterNumber
              : `CHƯƠNG ${cleanChapterNumber}`} 】
          </div>
        )}

        {/* Chapter Main Title */}
        <h1
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${titleFontSize}px`,
            fontWeight: 900,
            lineHeight: 1.3,
            color: activeTheme.primaryColor,
            letterSpacing: '0.8px',
            textShadow: '0 4px 16px rgba(0,0,0,0.95)',
          }}
        >
          {cleanTitle}
        </h1>

        {/* Animated Horizontal Line */}
        <div
          style={{
            width: `${Math.round(180 * scale)}px`,
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${activeTheme.primaryColor}, transparent)`,
            margin: `${Math.round(22 * scale)}px 0`,
            transform: `scaleX(${lineScale})`,
          }}
        />

        {/* Chapter Subtitle / Description */}
        {cleanSubtitle && (
          <p
            style={{
              margin: 0,
              fontFamily: activeFont,
              fontSize: `${subFontSize}px`,
              fontWeight: 500,
              color: COLOR_PALETTE.textSubtle,
              letterSpacing: '0.3px',
              maxWidth: '85%',
              lineHeight: 1.55,
            }}
          >
            {cleanSubtitle}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};

