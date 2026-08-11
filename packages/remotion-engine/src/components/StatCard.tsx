import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { OverlayPosition, StatItem, ThemeConfig } from '../types';
import { resolveOverlayPositionStyle, useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface StatCardProps {
  title?: string;
  name?: string;
  role?: string;
  details?: string;
  statItems?: StatItem[];
  position?: OverlayPosition;
  index?: number;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  name,
  role,
  details,
  statItems = [],
  position,
  index = 0,
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
  const cleanName = toVietnameseUpperCase(name);
  const cleanRole = normalizeVietnameseText(role);
  const cleanDetails = normalizeVietnameseText(details);

  // Animate card entrance in sync with scene start
  const cardDelay = 0;
  const containerScale = spring({
    frame: Math.max(0, frame - cardDelay),
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 15, stiffness: 90 },
  });

  const opacity = interpolate(frame, [cardDelay, cardDelay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const nameFontSize = Math.round(38 * scale);
  const roleFontSize = Math.round(20 * scale);
  const detailsFontSize = Math.round(17 * scale);

  const posStyle = resolveOverlayPositionStyle(position, index, scale);

  return (
    <div
      style={{
        position: 'absolute',
        width: `${Math.round(460 * scale)}px`,
        maxWidth: '92%',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
        pointerEvents: 'none',
        ...posStyle,
      }}
    >
      {/* Main Framed Mộc Bản Side Panel */}
      <div
        style={{
          transform: `scale(${containerScale}) translateZ(0)`,
          opacity,
          willChange: 'transform, opacity',
          width: '100%',
          maxHeight: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          textAlign: 'left',
          padding: `${Math.round(28 * scale)}px ${Math.round(32 * scale)}px`,
          background: 'rgba(22, 18, 14, 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '2px',
          border: `1px solid ${activeTheme.primaryColor}`,
          outline: `1px solid ${activeTheme.accentGlow}`,
          outlineOffset: '-5px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.95)',
        }}
      >
        {/* Card Header Tag (Con dấu Triện Son) */}
        {cleanTitle && (
          <div
            style={{
              backgroundColor: 'rgba(155, 27, 27, 0.1)',
              color: COLOR_PALETTE.vermilionRed,
              fontFamily: activeFont,
              fontSize: `${Math.round(12 * scale)}px`,
              fontWeight: 900,
              letterSpacing: '2px',
              padding: `${Math.round(4 * scale)}px ${Math.round(14 * scale)}px`,
              borderRadius: '2px',
              border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
              marginBottom: `${Math.round(14 * scale)}px`,
              textTransform: 'uppercase',
              boxShadow: 'inset 0 0 4px rgba(155, 27, 27, 0.25)',
            }}
          >
            【 {cleanTitle} 】
          </div>
        )}

        {/* Primary Name */}
        {cleanName && (
          <h2
            style={{
              margin: 0,
              fontFamily: activeSerifFont,
              fontSize: `${nameFontSize}px`,
              fontWeight: 900,
              color: activeTheme.primaryColor,
              letterSpacing: '0.5px',
              textShadow: '0 3px 12px rgba(0,0,0,0.9)',
              lineHeight: 1.2,
            }}
          >
            {cleanName}
          </h2>
        )}

        {/* Role / Title */}
        {cleanRole && (
          <p
            style={{
              margin: `${Math.round(6 * scale)}px 0 0 0`,
              fontFamily: activeFont,
              fontSize: `${roleFontSize}px`,
              fontWeight: 600,
              color: COLOR_PALETTE.textSubtle,
              letterSpacing: '0.3px',
              lineHeight: 1.35,
            }}
          >
            {cleanRole}
          </p>
        )}

        {/* Heritage Divider */}
        <div
          style={{
            width: '120px',
            height: '2px',
            background: `linear-gradient(90deg, ${activeTheme.primaryColor}, transparent)`,
            margin: `${Math.round(14 * scale)}px 0`,
          }}
        />

        {/* Details text */}
        {cleanDetails && (
          <p
            style={{
              margin: `0 0 ${Math.round(16 * scale)}px 0`,
              fontFamily: activeFont,
              fontSize: `${detailsFontSize}px`,
              color: COLOR_PALETTE.textSubtle,
              lineHeight: 1.5,
            }}
          >
            {cleanDetails}
          </p>
        )}

        {/* Stat Items Grid (Staggered Fade-in) */}
        {statItems.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${Math.round(10 * scale)}px`,
              width: '100%',
              marginTop: `${Math.round(6 * scale)}px`,
            }}
          >
            {statItems.map((item, idx) => {
              const itemDelay = cardDelay + 12 + idx * 6;
              const itemOpacity = interpolate(
                frame,
                [itemDelay, itemDelay + 10],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
              const itemY = interpolate(
                frame,
                [itemDelay, itemDelay + 10],
                [15, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );

              const badgeColor = item.color || activeTheme.primaryColor;
              const cleanLabel = normalizeVietnameseText(item.label);
              const cleanValue = normalizeVietnameseText(item.value);

              return (
                <div
                  key={idx}
                  style={{
                    opacity: itemOpacity,
                    transform: `translateY(${itemY}px)`,
                    padding: `${Math.round(10 * scale)}px ${Math.round(14 * scale)}px`,
                    background: 'rgba(32, 26, 18, 0.75)',
                    borderRadius: '2px',
                    borderLeft: `3px solid ${badgeColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      fontFamily: activeFont,
                      fontSize: `${Math.round(12 * scale)}px`,
                      color: COLOR_PALETTE.textSubtle,
                      marginBottom: `${Math.round(2 * scale)}px`,
                      fontWeight: 600,
                      letterSpacing: '0.2px',
                    }}
                  >
                    {cleanLabel}
                  </span>
                  <span
                    style={{
                      fontFamily: activeFont,
                      fontSize: `${Math.round(16 * scale)}px`,
                      fontWeight: 800,
                      color: badgeColor,
                      letterSpacing: '0.3px',
                    }}
                  >
                    {cleanValue}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

