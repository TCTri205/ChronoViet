import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface HeroSpotlightProps {
  title?: string;
  name?: string;
  role?: string;
  subtitle?: string;
  details?: string;
  quote?: string;
  bulletPoints?: string[];
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({
  title,
  name = 'QUANG TRUNG NGUYỄN HUỆ',
  role = 'ANH HÙNG DÂN TỘC — BÁCH CHIẾN BÁCH THẮNG',
  subtitle,
  details = 'Vị hoàng đế anh minh kiệt xuất, thống nhất non sông, quét sạch 29 vạn quân Mãn Thanh mùa xuân Kỷ Dậu 1789.',
  quote = 'Đánh cho để dài tóc, đánh cho để đen răng, đánh cho nó chích luân bất phản, đánh cho nó phiến giáp bất hoàn!',
  bulletPoints,
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily, false);
  const activeSerifFont = getSafeFontFamily(theme?.fontFamily, true);

  const cleanTitle = title ? toVietnameseUpperCase(title) : 'ANH HÙNG DÂN TỘC';
  const cleanSubtitle = subtitle ? normalizeVietnameseText(subtitle) : undefined;
  const cleanName = toVietnameseUpperCase(name);
  const cleanRole = normalizeVietnameseText(role);
  const cleanDetails = normalizeVietnameseText(details);
  const cleanQuote = normalizeVietnameseText(quote);

  // Smooth entrance animation
  const cardDelay = 12;
  const cardScale = spring({
    frame: Math.max(0, frame - cardDelay),
    fps,
    from: 0.93,
    to: 1,
    config: { damping: 16, stiffness: 95 },
  });

  const opacity = interpolate(frame, [cardDelay, cardDelay + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const glowPulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.25, 0.45]
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: `${Math.round(110 * scale)}px`,
        bottom: `${Math.round(155 * scale)}px`,
        left: `${Math.round(48 * scale)}px`,
        width: `${Math.round(580 * scale)}px`,
        maxWidth: '92%',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity,
          padding: `${Math.round(32 * scale)}px ${Math.round(38 * scale)}px`,
          background: 'rgba(20, 16, 12, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '2px',
          border: `2px solid ${activeTheme.primaryColor}`,
          outline: `1px solid ${activeTheme.accentGlow}`,
          outlineOffset: '-6px',
          boxShadow: `0 24px 64px rgba(0, 0, 0, 0.95), 0 0 40px rgba(200, 157, 53, ${glowPulse})`,
        }}
      >
        {/* Header Tag Badge */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: `${Math.round(14 * scale)}px`,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(155, 27, 27, 0.15)',
              color: COLOR_PALETTE.vermilionRed,
              fontFamily: activeFont,
              fontSize: `${Math.round(12 * scale)}px`,
              fontWeight: 900,
              letterSpacing: '2.2px',
              padding: `${Math.round(4 * scale)}px ${Math.round(14 * scale)}px`,
              borderRadius: '2px',
              border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
              textTransform: 'uppercase',
              boxShadow: 'inset 0 0 6px rgba(155, 27, 27, 0.3)',
            }}
          >
            【 {cleanTitle} 】
          </div>
          {cleanSubtitle && (
            <span
              style={{
                fontFamily: activeFont,
                fontSize: `${Math.round(14 * scale)}px`,
                fontWeight: 700,
                color: activeTheme.primaryColor,
                letterSpacing: '0.8px',
              }}
            >
              {cleanSubtitle}
            </span>
          )}
        </div>

        {/* Hero Name with Imperial Gold Gradient */}
        <h1
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${Math.round(36 * scale)}px`,
            fontWeight: 900,
            color: activeTheme.primaryColor,
            lineHeight: 1.18,
            letterSpacing: '0.5px',
            textShadow: '0 4px 16px rgba(0,0,0,0.95)',
            marginBottom: `${Math.round(6 * scale)}px`,
          }}
        >
          {cleanName}
        </h1>

        {/* Hero Epithet / Role */}
        {cleanRole && (
          <p
            style={{
              margin: 0,
              fontFamily: activeFont,
              fontSize: `${Math.round(16 * scale)}px`,
              fontWeight: 700,
              color: COLOR_PALETTE.textSubtle,
              letterSpacing: '0.4px',
              marginBottom: `${Math.round(14 * scale)}px`,
            }}
          >
            {cleanRole}
          </p>
        )}

        {/* Heritage Gold Divider */}
        <div
          style={{
            width: '140px',
            height: '2px',
            background: `linear-gradient(90deg, ${activeTheme.primaryColor}, transparent)`,
            marginBottom: `${Math.round(14 * scale)}px`,
          }}
        />

        {/* Deeds / Historical Details */}
        {cleanDetails && (
          <p
            style={{
              margin: `0 0 ${Math.round(14 * scale)}px 0`,
              fontFamily: activeFont,
              fontSize: `${Math.round(15 * scale)}px`,
              color: COLOR_PALETTE.textWhite,
              lineHeight: 1.52,
            }}
          >
            {cleanDetails}
          </p>
        )}

        {/* Optional Bullet Achievements */}
        {bulletPoints && bulletPoints.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${Math.round(8 * scale)}px`,
              marginBottom: `${Math.round(14 * scale)}px`,
            }}
          >
            {bulletPoints.map((bp, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: `${Math.round(8 * scale)}px`,
                  fontFamily: activeFont,
                  fontSize: `${Math.round(14 * scale)}px`,
                  color: COLOR_PALETTE.textWhite,
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: activeTheme.primaryColor, fontWeight: 900 }}>◆</span>
                <span>{normalizeVietnameseText(bp)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Famous Historical Declaration / Quote */}
        {cleanQuote && (
          <div
            style={{
              padding: `${Math.round(12 * scale)}px ${Math.round(16 * scale)}px`,
              background: 'rgba(32, 26, 18, 0.9)',
              borderRadius: '2px',
              borderLeft: `4px solid ${activeTheme.primaryColor}`,
              fontFamily: activeSerifFont,
              fontSize: `${Math.round(15 * scale)}px`,
              fontWeight: 700,
              fontStyle: 'italic',
              color: COLOR_PALETTE.textWhite,
              lineHeight: 1.45,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            "{cleanQuote}"
          </div>
        )}
      </div>
    </div>
  );
};
