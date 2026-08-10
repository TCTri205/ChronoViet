import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { HistoricalTheory, ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface SplitTheoryProps {
  title?: string;
  theories?: HistoricalTheory[];
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const SplitTheory: React.FC<SplitTheoryProps> = ({
  title = 'GIẢ THUYẾT LỊCH SỬ',
  theories = [],
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, isLandscape } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);
  const cleanTitle = toVietnameseUpperCase(title);

  const titleScale = spring({
    frame,
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 14, stiffness: 95 },
  });

  const titleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const titleFontSize = Math.round((isLandscape ? 32 : 24) * scale);
  const cardTitleFontSize = Math.round((isLandscape ? 22 : 18) * scale);
  const descFontSize = Math.round((isLandscape ? 16 : 14) * scale);

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
      {/* Dark Suspense Ambient Background */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 40%, #171b26 0%, #0a0d14 60%, #030407 100%)',
        }}
      />

      {/* Detective Fog/Vignette Accent */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Section Title Badge */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          zIndex: 20,
          marginBottom: `${Math.round(24 * scale)}px`,
          backgroundColor: 'rgba(30, 41, 59, 0.85)',
          color: activeTheme.primaryColor,
          fontFamily: activeFont,
          fontSize: `${titleFontSize}px`,
          fontWeight: 900,
          letterSpacing: '1px',
          padding: `${Math.round(8 * scale)}px ${Math.round(28 * scale)}px`,
          borderRadius: `${Math.round(30 * scale)}px`,
          border: `2px solid ${activeTheme.primaryColor}`,
          boxShadow: `0 0 25px ${activeTheme.accentGlow}`,
        }}
      >
        {cleanTitle}
      </div>

      {/* Theories Container */}
      {theories.length > 0 && (
        <div
          style={{
            width: isLandscape ? '88%' : '94%',
            maxWidth: '1200px',
            display: 'grid',
            gridTemplateColumns:
              theories.length > 1 && isLandscape ? `repeat(${theories.length}, 1fr)` : '1fr',
            gap: `${Math.round(24 * scale)}px`,
            zIndex: 10,
          }}
        >
          {theories.map((theory, idx) => {
            const delay = 12 + idx * 12;
            const cardOpacity = interpolate(
              frame,
              [delay, delay + 12],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );
            const cardY = interpolate(
              frame,
              [delay, delay + 12],
              [30, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

            const isPrimary = idx === 0;
            const borderColor = isPrimary ? activeTheme.primaryColor : activeTheme.secondaryColor;
            const cleanProb = toVietnameseUpperCase(theory.probability);
            const cleanTheoryTitle = toVietnameseUpperCase(theory.title);
            const cleanDesc = normalizeVietnameseText(theory.desc);

            return (
              <div
                key={idx}
                style={{
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px)`,
                  padding: `${Math.round(28 * scale)}px ${Math.round(24 * scale)}px`,
                  background: 'rgba(15, 20, 30, 0.92)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderRadius: `${Math.round(18 * scale)}px`,
                  border: `2px solid ${borderColor}`,
                  boxShadow: `0 20px 50px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0,0,0,0.5)`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  {cleanProb && (
                    <span
                      style={{
                        display: 'inline-block',
                        backgroundColor: isPrimary ? activeTheme.primaryColor : activeTheme.secondaryColor,
                        color: '#000000',
                        fontFamily: activeFont,
                        fontSize: `${Math.round(12 * scale)}px`,
                        fontWeight: 900,
                        padding: `${Math.round(4 * scale)}px ${Math.round(12 * scale)}px`,
                        borderRadius: `${Math.round(10 * scale)}px`,
                        marginBottom: `${Math.round(12 * scale)}px`,
                      }}
                    >
                      {cleanProb}
                    </span>
                  )}

                  <h3
                    style={{
                      margin: 0,
                      fontFamily: activeFont,
                      fontSize: `${cardTitleFontSize}px`,
                      fontWeight: 900,
                      color: COLOR_PALETTE.textWhite,
                      letterSpacing: '0.4px',
                      lineHeight: 1.3,
                    }}
                  >
                    {cleanTheoryTitle}
                  </h3>

                  <p
                    style={{
                      margin: `${Math.round(14 * scale)}px 0 0 0`,
                      fontFamily: activeFont,
                      fontSize: `${descFontSize}px`,
                      color: COLOR_PALETTE.textSubtle,
                      lineHeight: 1.6,
                      fontWeight: 500,
                    }}
                  >
                    {cleanDesc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
