import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { OverlayPosition, ThemeConfig } from '../types';
import { resolveOverlayPositionStyle, useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface BulletHighlightProps {
  title?: string;
  bulletPoints?: string[];
  position?: OverlayPosition;
  index?: number;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const BulletHighlight: React.FC<BulletHighlightProps> = ({
  title,
  bulletPoints = [],
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

  // Delay card entrance by 15 frames (0.5s) so background media shows first
  const cardDelay = 15;
  const titleScale = spring({
    frame: Math.max(0, frame - cardDelay),
    fps,
    from: 0.88,
    to: 1,
    config: { damping: 12, stiffness: 100 },
  });

  const titleOpacity = interpolate(frame, [cardDelay, cardDelay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleFontSize = Math.round((isLandscape ? 34 : 26) * scale);
  const bulletFontSize = Math.round((isLandscape ? 20 : 16) * scale);

  const posStyle = resolveOverlayPositionStyle(position, index, scale, isLandscape);

  return (
    <div
      style={{
        position: 'absolute',
        width: isLandscape ? `${Math.round(480 * scale)}px` : '90%',
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
      {/* Main Glassmorphic Container Card */}
      <div
        style={{
          transform: `scale(${titleScale})`,
          opacity: titleOpacity,
          width: '100%',
          maxHeight: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: `${Math.round(28 * scale)}px ${Math.round(30 * scale)}px`,
          background: 'rgba(9, 14, 24, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: `${Math.round(20 * scale)}px`,
          border: `1px solid ${activeTheme.secondaryColor}`,
          boxShadow: `0 20px 60px rgba(0, 0, 0, 0.85), 0 0 25px ${activeTheme.accentGlow}`,
        }}
      >
        {/* Title */}
        {cleanTitle && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${Math.round(10 * scale)}px`,
              marginBottom: `${Math.round(20 * scale)}px`,
            }}
          >
            <div
              style={{
                width: `${Math.round(6 * scale)}px`,
                height: `${Math.round(22 * scale)}px`,
                backgroundColor: activeTheme.primaryColor,
                borderRadius: `${Math.round(3 * scale)}px`,
              }}
            />
            <h2
              style={{
                margin: 0,
                fontFamily: activeFont,
                fontSize: `${titleFontSize}px`,
                fontWeight: 900,
                color: COLOR_PALETTE.textWhite,
                letterSpacing: '0.4px',
              }}
            >
              {cleanTitle}
            </h2>
          </div>
        )}

        {/* Bullet Items */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${Math.round(12 * scale)}px`,
            width: '100%',
          }}
        >
          {bulletPoints.map((point, index) => {
            const startF = cardDelay + 12 + index * 18;
            const itemProgress = interpolate(
              frame,
              [startF, startF + 10],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

            const itemY = interpolate(
              frame,
              [startF, startF + 10],
              [16, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

            const isActive = frame >= startF;
            const cleanPoint = normalizeVietnameseText(point);

            return (
              <div
                key={index}
                style={{
                  opacity: itemProgress,
                  transform: `translateY(${itemY}px)`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: `${Math.round(12 * scale)}px`,
                  padding: `${Math.round(12 * scale)}px ${Math.round(16 * scale)}px`,
                  background: isActive
                    ? 'rgba(37, 99, 235, 0.22)'
                    : 'rgba(15, 23, 38, 0.6)',
                  borderRadius: `${Math.round(12 * scale)}px`,
                  border: isActive
                    ? `1px solid ${activeTheme.primaryColor}`
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isActive
                    ? `0 4px 15px rgba(0,0,0,0.5), 0 0 10px ${activeTheme.accentGlow}`
                    : 'none',
                }}
              >
                {/* Bullet Number Badge */}
                <div
                  style={{
                    minWidth: `${Math.round(28 * scale)}px`,
                    height: `${Math.round(28 * scale)}px`,
                    borderRadius: '50%',
                    backgroundColor: isActive
                      ? activeTheme.primaryColor
                      : 'rgba(255, 255, 255, 0.15)',
                    color: isActive ? '#000000' : COLOR_PALETTE.textWhite,
                    fontFamily: activeFont,
                    fontWeight: 900,
                    fontSize: `${Math.round(13 * scale)}px`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: `${Math.round(2 * scale)}px`,
                  }}
                >
                  {index + 1}
                </div>

                {/* Text Content */}
                <p
                  style={{
                    margin: 0,
                    fontFamily: activeFont,
                    fontSize: `${bulletFontSize}px`,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? COLOR_PALETTE.textWhite : COLOR_PALETTE.textSubtle,
                    lineHeight: 1.45,
                  }}
                >
                  {cleanPoint}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
