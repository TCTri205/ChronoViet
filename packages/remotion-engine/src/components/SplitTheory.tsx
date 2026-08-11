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
  const { scale } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);
  const activeSerifFont = getSafeFontFamily(theme?.fontFamily, true);
  const cleanTitle = toVietnameseUpperCase(title);

  const titleScale = spring({
    frame,
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 14, stiffness: 95 },
  });

  const titleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const titleFontSize = Math.round(28 * scale);
  const cardTitleFontSize = Math.round(22 * scale);
  const descFontSize = Math.round(16 * scale);

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
      {/* Historical Parchment Vignette Canvas Overlay */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at center, transparent 40%, rgba(14, 12, 10, 0.85) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Section Title Badge (Con dấu Triện Son Tiêu Đề) */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          zIndex: 20,
          marginBottom: `${Math.round(24 * scale)}px`,
          backgroundColor: 'rgba(155, 27, 27, 0.15)',
          color: COLOR_PALETTE.vermilionRed,
          fontFamily: activeFont,
          fontSize: `${titleFontSize}px`,
          fontWeight: 900,
          letterSpacing: '2px',
          padding: `${Math.round(6 * scale)}px ${Math.round(24 * scale)}px`,
          borderRadius: '2px',
          border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
        }}
      >
        【 {cleanTitle} 】
      </div>

      {/* Theories Container (Framed Mộc Bản) */}
      {theories.length > 0 && (
        <div
          style={{
            width: '88%',
            maxWidth: '1200px',
            display: 'grid',
            gridTemplateColumns:
              theories.length > 1 ? `repeat(${theories.length}, 1fr)` : '1fr',
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
            const borderColor = isPrimary ? activeTheme.primaryColor : COLOR_PALETTE.vermilionRed;
            const cleanProb = toVietnameseUpperCase(theory.probability);
            const cleanTheoryTitle = toVietnameseUpperCase(theory.title);
            const cleanDesc = normalizeVietnameseText(theory.desc);

            return (
              <div
                key={idx}
                style={{
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px)`,
                  padding: `${Math.round(26 * scale)}px ${Math.round(24 * scale)}px`,
                  background: 'rgba(22, 18, 14, 0.95)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderRadius: '2px',
                  border: `1px solid ${borderColor}`,
                  outline: `1px solid ${activeTheme.accentGlow}`,
                  outlineOffset: '-5px',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9)',
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
                        backgroundColor: 'rgba(200, 157, 53, 0.15)',
                        color: borderColor,
                        fontFamily: activeFont,
                        fontSize: `${Math.round(11 * scale)}px`,
                        fontWeight: 900,
                        letterSpacing: '1px',
                        padding: `${Math.round(3 * scale)}px ${Math.round(10 * scale)}px`,
                        borderRadius: '2px',
                        border: `1px solid ${borderColor}`,
                        marginBottom: `${Math.round(12 * scale)}px`,
                      }}
                    >
                      【 {cleanProb} 】
                    </span>
                  )}

                  <h3
                    style={{
                      margin: 0,
                      fontFamily: activeSerifFont,
                      fontSize: `${cardTitleFontSize}px`,
                      fontWeight: 900,
                      color: borderColor,
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

