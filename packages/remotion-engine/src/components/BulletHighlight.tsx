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
  const { scale } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);
  const activeSerifFont = getSafeFontFamily(theme?.fontFamily, true);
  const cleanTitle = toVietnameseUpperCase(title);

  // Delay card entrance by 15 frames (0.5s) so background media shows first
  const cardDelay = 15;
  const titleScale = spring({
    frame: Math.max(0, frame - cardDelay),
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 14, stiffness: 95 },
  });

  const titleOpacity = interpolate(frame, [cardDelay, cardDelay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleFontSize = Math.round(32 * scale);
  const bulletFontSize = Math.round(19 * scale);

  const posStyle = resolveOverlayPositionStyle(position, index, scale);

  return (
    <div
      style={{
        position: 'absolute',
        width: `${Math.round(480 * scale)}px`,
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
      {/* Main Framed Mộc Bản Container Card */}
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
                width: `${Math.round(4 * scale)}px`,
                height: `${Math.round(24 * scale)}px`,
                backgroundColor: COLOR_PALETTE.vermilionRed,
                borderRadius: '1px',
              }}
            />
            <h2
              style={{
                margin: 0,
                fontFamily: activeSerifFont,
                fontSize: `${titleFontSize}px`,
                fontWeight: 900,
                color: activeTheme.primaryColor,
                letterSpacing: '0.5px',
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
                  padding: `${Math.round(10 * scale)}px ${Math.round(14 * scale)}px`,
                  background: isActive
                    ? 'rgba(32, 26, 18, 0.85)'
                    : 'rgba(20, 16, 12, 0.5)',
                  borderRadius: '2px',
                  borderLeft: isActive
                    ? `3px solid ${activeTheme.primaryColor}`
                    : '3px solid rgba(200, 157, 53, 0.25)',
                }}
              >
                {/* Square Heritage Stamp Badge */}
                <div
                  style={{
                    minWidth: `${Math.round(26 * scale)}px`,
                    height: `${Math.round(26 * scale)}px`,
                    borderRadius: '2px',
                    backgroundColor: isActive
                      ? 'rgba(155, 27, 27, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: isActive
                      ? `1px solid ${COLOR_PALETTE.vermilionRed}`
                      : '1px solid rgba(255, 255, 255, 0.15)',
                    color: isActive ? COLOR_PALETTE.vermilionRed : COLOR_PALETTE.textSubtle,
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
                    lineHeight: 1.5,
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

