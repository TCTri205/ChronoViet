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
  const { scale, isLandscape } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);
  
  const cleanTitle = toVietnameseUpperCase(title);
  const cleanName = toVietnameseUpperCase(name);
  const cleanRole = normalizeVietnameseText(role);
  const cleanDetails = normalizeVietnameseText(details);

  // Delay card entrance by 20 frames (0.66s) so background media & overlay headers establish first
  const cardDelay = 20;
  const containerScale = spring({
    frame: Math.max(0, frame - cardDelay),
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 14, stiffness: 90 },
  });

  const opacity = interpolate(frame, [cardDelay, cardDelay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const nameFontSize = Math.round((isLandscape ? 40 : 30) * scale);
  const roleFontSize = Math.round((isLandscape ? 22 : 18) * scale);
  const detailsFontSize = Math.round((isLandscape ? 18 : 15) * scale);

  const posStyle = resolveOverlayPositionStyle(position, index, scale, isLandscape);

  return (
    <div
      style={{
        position: 'absolute',
        width: isLandscape ? `${Math.round(450 * scale)}px` : '90%',
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
      {/* Main Glassmorphic Side Panel */}
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
          background: 'rgba(10, 15, 26, 0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: `${Math.round(20 * scale)}px`,
          border: `1px solid ${activeTheme.primaryColor}`,
          boxShadow: `0 20px 60px rgba(0, 0, 0, 0.85), 0 0 30px ${activeTheme.accentGlow}`,
        }}
      >
        {/* Card Header Tag */}
        {cleanTitle && (
          <div
            style={{
              backgroundColor: 'rgba(212, 175, 55, 0.18)',
              color: activeTheme.primaryColor,
              fontFamily: activeFont,
              fontSize: `${Math.round(13 * scale)}px`,
              fontWeight: 800,
              letterSpacing: '1px',
              padding: `${Math.round(4 * scale)}px ${Math.round(14 * scale)}px`,
              borderRadius: `${Math.round(14 * scale)}px`,
              border: `1px solid ${activeTheme.primaryColor}`,
              marginBottom: `${Math.round(12 * scale)}px`,
            }}
          >
            {cleanTitle}
          </div>
        )}

        {/* Primary Name */}
        {cleanName && (
          <h2
            style={{
              margin: 0,
              fontFamily: activeFont,
              fontSize: `${nameFontSize}px`,
              fontWeight: 900,
              color: COLOR_PALETTE.textWhite,
              letterSpacing: '0.4px',
              textShadow: '0 3px 12px rgba(0,0,0,0.9)',
              lineHeight: 1.15,
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
              color: activeTheme.primaryColor,
              letterSpacing: '0.2px',
              lineHeight: 1.3,
            }}
          >
            {cleanRole}
          </p>
        )}

        {/* Divider */}
        <div
          style={{
            width: '100px',
            height: '2px',
            background: `linear-gradient(90deg, ${activeTheme.secondaryColor}, transparent)`,
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
              lineHeight: 1.45,
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
                    background: 'rgba(18, 25, 38, 0.7)',
                    borderRadius: `${Math.round(10 * scale)}px`,
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
                      fontWeight: 500,
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
                      letterSpacing: '0.2px',
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
