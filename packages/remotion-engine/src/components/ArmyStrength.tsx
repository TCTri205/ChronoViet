import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { StatItem, ThemeConfig, VersusSide } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface ArmyStrengthProps {
  title?: string;
  subtitle?: string;
  leftSide?: VersusSide;
  rightSide?: VersusSide;
  statItems?: StatItem[];
  details?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const ArmyStrength: React.FC<ArmyStrengthProps> = ({
  title,
  subtitle,
  leftSide,
  rightSide,
  statItems = [],
  details,
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily, false);
  const activeSerifFont = getSafeFontFamily(theme?.fontFamily, true);

  const cleanTitle = title ? toVietnameseUpperCase(title) : 'TƯƠNG QUAN LỰC LƯỢNG QUÂN SỰ';
  const cleanSubtitle = subtitle ? normalizeVietnameseText(subtitle) : undefined;
  const cleanDetails = details ? normalizeVietnameseText(details) : undefined;

  const rawLeft = leftSide || {
    name: 'ĐẠI VIỆT',
    stat: '100.000 quân',
    color: activeTheme.primaryColor,
    badge: 'QUÂN TIÊN PHONG',
  };
  const rawRight = rightSide || {
    name: 'ĐỐI PHƯƠNG',
    stat: '290.000 quân',
    color: COLOR_PALETTE.vermilionRed,
    badge: 'QUÂN CHỦ LỰC',
  };

  const left = {
    name: toVietnameseUpperCase(rawLeft.name),
    stat: normalizeVietnameseText(rawLeft.stat),
    badge: rawLeft.badge ? toVietnameseUpperCase(rawLeft.badge) : undefined,
    color: rawLeft.color || activeTheme.primaryColor,
  };

  const right = {
    name: toVietnameseUpperCase(rawRight.name),
    stat: normalizeVietnameseText(rawRight.stat),
    badge: rawRight.badge ? toVietnameseUpperCase(rawRight.badge) : undefined,
    color: rawRight.color || COLOR_PALETTE.vermilionRed,
  };

  const cardDelay = 10;
  const cardScale = spring({
    frame: Math.max(0, frame - cardDelay),
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 15, stiffness: 95 },
  });

  const opacity = interpolate(frame, [cardDelay, cardDelay + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const barProgress = interpolate(frame, [cardDelay + 10, cardDelay + 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: `${Math.round(110 * scale)}px`,
        bottom: `${Math.round(155 * scale)}px`,
        left: `${Math.round(48 * scale)}px`,
        right: `${Math.round(48 * scale)}px`,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity,
          width: '100%',
          maxWidth: `${Math.round(1120 * scale)}px`,
          padding: `${Math.round(30 * scale)}px ${Math.round(40 * scale)}px`,
          background: 'rgba(20, 16, 12, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '2px',
          border: `2px solid ${activeTheme.primaryColor}`,
          outline: `1px solid ${activeTheme.accentGlow}`,
          outlineOffset: '-6px',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Header Tag Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${Math.round(14 * scale)}px`,
            marginBottom: `${Math.round(18 * scale)}px`,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(155, 27, 27, 0.15)',
              color: COLOR_PALETTE.vermilionRed,
              fontFamily: activeFont,
              fontSize: `${Math.round(12 * scale)}px`,
              fontWeight: 900,
              letterSpacing: '2px',
              padding: `${Math.round(4 * scale)}px ${Math.round(16 * scale)}px`,
              borderRadius: '2px',
              border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
              textTransform: 'uppercase',
            }}
          >
            【 {cleanTitle} 】
          </div>
          {cleanSubtitle && (
            <span
              style={{
                fontFamily: activeFont,
                fontSize: `${Math.round(15 * scale)}px`,
                fontWeight: 700,
                color: activeTheme.primaryColor,
              }}
            >
              {cleanSubtitle}
            </span>
          )}
        </div>

        {/* Dual Force Strength Columns */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            gap: `${Math.round(24 * scale)}px`,
            marginBottom: `${Math.round(20 * scale)}px`,
          }}
        >
          {/* Left Army Card */}
          <div
            style={{
              flex: 1,
              padding: `${Math.round(18 * scale)}px ${Math.round(22 * scale)}px`,
              backgroundColor: 'rgba(32, 26, 18, 0.85)',
              borderRadius: '2px',
              borderLeft: `5px solid ${left.color}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: `${Math.round(6 * scale)}px` }}>
              <span
                style={{
                  fontFamily: activeSerifFont,
                  fontSize: `${Math.round(24 * scale)}px`,
                  fontWeight: 900,
                  color: left.color,
                }}
              >
                {left.name}
              </span>
              {left.badge && (
                <span
                  style={{
                    backgroundColor: 'rgba(200, 157, 53, 0.2)',
                    color: left.color,
                    fontFamily: activeFont,
                    fontSize: `${Math.round(11 * scale)}px`,
                    fontWeight: 800,
                    padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
                    borderRadius: '2px',
                    border: `1px solid ${left.color}`,
                  }}
                >
                  {left.badge}
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: activeFont,
                fontSize: `${Math.round(22 * scale)}px`,
                fontWeight: 900,
                color: COLOR_PALETTE.textWhite,
                letterSpacing: '0.5px',
              }}
            >
              {left.stat}
            </span>
          </div>

          {/* VS Center Emblem */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: `0 ${Math.round(8 * scale)}px`,
            }}
          >
            <div
              style={{
                width: `${Math.round(44 * scale)}px`,
                height: `${Math.round(44 * scale)}px`,
                borderRadius: '50%',
                backgroundColor: 'rgba(155, 27, 27, 0.95)',
                border: `2px solid ${COLOR_PALETTE.primaryGold}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: COLOR_PALETTE.primaryGold,
                fontFamily: activeSerifFont,
                fontSize: `${Math.round(18 * scale)}px`,
                fontWeight: 900,
                boxShadow: '0 0 16px rgba(200, 157, 53, 0.4)',
              }}
            >
              VS
            </div>
          </div>

          {/* Right Army Card */}
          <div
            style={{
              flex: 1,
              padding: `${Math.round(18 * scale)}px ${Math.round(22 * scale)}px`,
              backgroundColor: 'rgba(32, 26, 18, 0.85)',
              borderRadius: '2px',
              borderRight: `5px solid ${right.color}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              textAlign: 'right',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row-reverse', marginBottom: `${Math.round(6 * scale)}px` }}>
              <span
                style={{
                  fontFamily: activeSerifFont,
                  fontSize: `${Math.round(24 * scale)}px`,
                  fontWeight: 900,
                  color: right.color,
                }}
              >
                {right.name}
              </span>
              {right.badge && (
                <span
                  style={{
                    backgroundColor: 'rgba(155, 27, 27, 0.2)',
                    color: right.color,
                    fontFamily: activeFont,
                    fontSize: `${Math.round(11 * scale)}px`,
                    fontWeight: 800,
                    padding: `${Math.round(2 * scale)}px ${Math.round(8 * scale)}px`,
                    borderRadius: '2px',
                    border: `1px solid ${right.color}`,
                  }}
                >
                  {right.badge}
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: activeFont,
                fontSize: `${Math.round(22 * scale)}px`,
                fontWeight: 900,
                color: COLOR_PALETTE.textWhite,
                letterSpacing: '0.5px',
              }}
            >
              {right.stat}
            </span>
          </div>
        </div>

        {/* Animated Visual Comparison Ratio Bar */}
        <div
          style={{
            width: '100%',
            height: `${Math.round(12 * scale)}px`,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '6px',
            overflow: 'hidden',
            display: 'flex',
            marginBottom: `${Math.round(18 * scale)}px`,
            border: '1px solid rgba(200, 157, 53, 0.3)',
          }}
        >
          <div
            style={{
              width: `${50 * barProgress}%`,
              height: '100%',
              backgroundColor: left.color,
              transition: 'width 0.1s linear',
            }}
          />
          <div
            style={{
              width: `${50 * barProgress}%`,
              height: '100%',
              backgroundColor: right.color,
              marginLeft: 'auto',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        {/* Tactical Stat Highlights Grid */}
        {statItems.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(statItems.length, 3)}, 1fr)`,
              gap: `${Math.round(14 * scale)}px`,
              width: '100%',
              marginBottom: cleanDetails ? `${Math.round(14 * scale)}px` : 0,
            }}
          >
            {statItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: `${Math.round(10 * scale)}px ${Math.round(14 * scale)}px`,
                  backgroundColor: 'rgba(28, 22, 16, 0.8)',
                  borderRadius: '2px',
                  borderTop: `2px solid ${item.color || activeTheme.primaryColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: activeFont,
                    fontSize: `${Math.round(12 * scale)}px`,
                    color: COLOR_PALETTE.textSubtle,
                    marginBottom: `${Math.round(2 * scale)}px`,
                  }}
                >
                  {normalizeVietnameseText(item.label)}
                </span>
                <span
                  style={{
                    fontFamily: activeFont,
                    fontSize: `${Math.round(16 * scale)}px`,
                    fontWeight: 800,
                    color: item.color || activeTheme.primaryColor,
                  }}
                >
                  {normalizeVietnameseText(item.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Historical Commentary / Details */}
        {cleanDetails && (
          <p
            style={{
              margin: 0,
              fontFamily: activeFont,
              fontSize: `${Math.round(14 * scale)}px`,
              color: COLOR_PALETTE.textSubtle,
              textAlign: 'center',
              lineHeight: 1.45,
            }}
          >
            {cleanDetails}
          </p>
        )}
      </div>
    </div>
  );
};
