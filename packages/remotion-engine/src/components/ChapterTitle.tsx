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
  const { scale, isLandscape } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);

  const cleanTitle = toVietnameseUpperCase(title);
  const cleanSubtitle = normalizeVietnameseText(subtitle);
  const cleanChapterNumber = chapterNumber ? toVietnameseUpperCase(chapterNumber) : undefined;

  // Entrance spring animation
  const cardScale = spring({
    frame,
    fps,
    from: 0.88,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const lineScale = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' });

  const numFontSize = Math.round((isLandscape ? 22 : 18) * scale);
  const titleFontSize = Math.round((isLandscape ? 44 : 32) * scale);
  const subFontSize = Math.round((isLandscape ? 20 : 16) * scale);

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
      {/* Background Subtle Gradient & Grid Accent */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at center, #111a28 0%, #090d14 50%, #040609 100%)',
        }}
      />

      {/* Chrono Blue Ambient Glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at center, ${activeTheme.accentGlow} 0%, transparent 65%)`,
          opacity: 0.6,
        }}
      />

      {/* Decorative Grid Lines */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(37, 99, 235, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(37, 99, 235, 0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Main Content Box */}
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity,
          maxWidth: isLandscape ? '80%' : '90%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 10,
          padding: `${Math.round(48 * scale)}px ${Math.round(60 * scale)}px`,
          background: 'rgba(11, 16, 24, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: `${Math.round(20 * scale)}px`,
          border: `2px solid ${activeTheme.secondaryColor}`,
          boxShadow: `0 25px 70px rgba(0, 0, 0, 0.85), 0 0 35px ${activeTheme.accentGlow}`,
        }}
      >
        {/* Chapter Header Badge */}
        {cleanChapterNumber && (
          <div
            style={{
              backgroundColor: activeTheme.secondaryColor,
              color: '#ffffff',
              fontFamily: activeFont,
              fontSize: `${numFontSize}px`,
              fontWeight: 900,
              letterSpacing: '1.5px',
              padding: `${Math.round(6 * scale)}px ${Math.round(22 * scale)}px`,
              borderRadius: `${Math.round(30 * scale)}px`,
              border: `1px solid ${activeTheme.primaryColor}`,
              boxShadow: `0 0 16px ${activeTheme.accentGlow}`,
              marginBottom: `${Math.round(20 * scale)}px`,
            }}
          >
          {cleanChapterNumber.startsWith('CHƯƠNG') || cleanChapterNumber.startsWith('PHẦN') || cleanChapterNumber.startsWith('CHAPTER')
            ? cleanChapterNumber
            : `CHƯƠNG ${cleanChapterNumber}`}
          </div>
        )}

        {/* Chapter Main Title */}
        <h1
          style={{
            margin: 0,
            fontFamily: activeFont,
            fontSize: `${titleFontSize}px`,
            fontWeight: 900,
            lineHeight: 1.3,
            color: COLOR_PALETTE.textWhite,
            letterSpacing: '0.8px',
            textShadow: '0 4px 16px rgba(0,0,0,0.8)',
          }}
        >
          {cleanTitle}
        </h1>

        {/* Animated Horizontal Line */}
        <div
          style={{
            width: `${Math.round(180 * scale)}px`,
            height: '3px',
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
              lineHeight: 1.5,
            }}
          >
            {cleanSubtitle}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
