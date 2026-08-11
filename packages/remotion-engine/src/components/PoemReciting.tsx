import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface PoemRecitingProps {
  title?: string;
  author?: string;
  poemText?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const PoemReciting: React.FC<PoemRecitingProps> = ({
  title = 'NAM QUỐC SƠN HÀ',
  author = 'LÝ THƯỜNG KIỆT (1077)',
  poemText = 'Nam quốc sơn hà Nam đế cư,\nTuyệt nhiên định phận tại thiên thư.\nNhư hà nghịch lỗ lai xâm phạm,\nNhữ đẳng hành khán thủ bại hư.',
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily, false);
  const activeSerifFont = getSafeFontFamily(theme?.fontFamily, true);

  const cleanTitle = toVietnameseUpperCase(title);
  const cleanAuthor = toVietnameseUpperCase(author);

  const cardDelay = 15;
  const cardScale = spring({
    frame: Math.max(0, frame - cardDelay),
    fps,
    from: 0.94,
    to: 1,
    config: { damping: 16, stiffness: 90 },
  });

  const opacity = interpolate(frame, [cardDelay, cardDelay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const poemLines = poemText.split('\n').filter((l) => Boolean(l.trim()));

  return (
    <div
      style={{
        position: 'absolute',
        top: `${Math.round(115 * scale)}px`,
        bottom: `${Math.round(165 * scale)}px`,
        left: '12%',
        right: '12%',
        zIndex: 20,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* 16:9 Full Width Centered Poetic Canvas */}
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity,
          width: '100%',
          padding: `${Math.round(36 * scale)}px ${Math.round(48 * scale)}px`,
          background: 'rgba(22, 18, 14, 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '2px',
          border: `1px solid ${activeTheme.primaryColor}`,
          outline: `1px solid ${activeTheme.accentGlow}`,
          outlineOffset: '-5px',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Title Badge */}
        <div
          style={{
            backgroundColor: 'rgba(155, 27, 27, 0.1)',
            color: COLOR_PALETTE.vermilionRed,
            fontFamily: activeFont,
            fontSize: `${Math.round(12 * scale)}px`,
            fontWeight: 900,
            letterSpacing: '2.5px',
            padding: `${Math.round(4 * scale)}px ${Math.round(16 * scale)}px`,
            borderRadius: '2px',
            border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
            marginBottom: `${Math.round(12 * scale)}px`,
            textTransform: 'uppercase',
          }}
        >
          【 THƠ THẦN LỊCH SỬ 】
        </div>

        {/* Poem Title */}
        <h1
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${Math.round(38 * scale)}px`,
            fontWeight: 900,
            color: activeTheme.primaryColor,
            letterSpacing: '2px',
            textShadow: '0 3px 12px rgba(0,0,0,0.9)',
          }}
        >
          {cleanTitle}
        </h1>

        {/* Author */}
        {cleanAuthor && (
          <span
            style={{
              fontFamily: activeFont,
              fontSize: `${Math.round(15 * scale)}px`,
              fontWeight: 800,
              color: COLOR_PALETTE.textSubtle,
              letterSpacing: '2px',
              marginTop: `${Math.round(6 * scale)}px`,
              marginBottom: `${Math.round(16 * scale)}px`,
            }}
          >
            — {cleanAuthor} —
          </span>
        )}

        {/* Heritage Line */}
        <div
          style={{
            width: `${Math.round(180 * scale)}px`,
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${activeTheme.primaryColor}, transparent)`,
            marginBottom: `${Math.round(20 * scale)}px`,
          }}
        />

        {/* Poem Stanzas (Staggered Reciting Fade-in) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${Math.round(12 * scale)}px` }}>
          {poemLines.map((line, idx) => {
            const lineDelay = cardDelay + 15 + idx * 12;
            const lineOpacity = interpolate(frame, [lineDelay, lineDelay + 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <p
                key={idx}
                style={{
                  margin: 0,
                  opacity: lineOpacity,
                  fontFamily: activeSerifFont,
                  fontSize: `${Math.round(24 * scale)}px`,
                  fontWeight: 700,
                  fontStyle: 'italic',
                  color: COLOR_PALETTE.textWhite,
                  letterSpacing: '0.5px',
                  textShadow: '0 2px 10px rgba(0,0,0,0.95)',
                }}
              >
                {normalizeVietnameseText(line)}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
};
