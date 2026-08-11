import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface CharacterProfileProps {
  name?: string;
  role?: string;
  era?: string;
  details?: string;
  quote?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const CharacterProfile: React.FC<CharacterProfileProps> = ({
  name = 'QUANG TRUNG NGUYỄN HUỆ',
  role = 'ANH HÙNG DÂN TỘC — HOÀNG ĐẾ NHÀ TÂY SƠN',
  era = '1753 – 1792',
  details = 'Vị tướng thiên tài bách chiến bách thắng trong lịch sử Việt Nam. Đã đánh tan 5 vạn quân Xiêm ở Rạch Gầm - Xoài Mút (1785) và 29 vạn quân Thanh ở Ngọc Hồi - Đống Đa (1789).',
  quote = 'Đánh cho lịch sử biết rằng nước Nam ta là có chủ!',
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily, false);
  const activeSerifFont = getSafeFontFamily(theme?.fontFamily, true);

  const cleanName = toVietnameseUpperCase(name);
  const cleanRole = normalizeVietnameseText(role);
  const cleanDetails = normalizeVietnameseText(details);
  const cleanQuote = normalizeVietnameseText(quote);

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

  return (
    <div
      style={{
        position: 'absolute',
        top: `${Math.round(115 * scale)}px`,
        bottom: `${Math.round(165 * scale)}px`,
        left: `${Math.round(40 * scale)}px`,
        width: `${Math.round(560 * scale)}px`,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* 16:9 Left Dual-Column Profile Card */}
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity,
          padding: `${Math.round(30 * scale)}px ${Math.round(36 * scale)}px`,
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
        {/* Era Tag Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: `${Math.round(12 * scale)}px` }}>
          <div
            style={{
              backgroundColor: 'rgba(155, 27, 27, 0.1)',
              color: COLOR_PALETTE.vermilionRed,
              fontFamily: activeFont,
              fontSize: `${Math.round(11 * scale)}px`,
              fontWeight: 900,
              letterSpacing: '2px',
              padding: `${Math.round(3 * scale)}px ${Math.round(12 * scale)}px`,
              borderRadius: '2px',
              border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
              textTransform: 'uppercase',
            }}
          >
            【 DANH NHÂN LỊCH SỬ 】
          </div>
          {era && (
            <span
              style={{
                fontFamily: activeFont,
                fontSize: `${Math.round(14 * scale)}px`,
                fontWeight: 800,
                color: activeTheme.primaryColor,
                letterSpacing: '1px',
              }}
            >
              ( {era} )
            </span>
          )}
        </div>

        {/* Primary Name */}
        <h1
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${Math.round(34 * scale)}px`,
            fontWeight: 900,
            color: activeTheme.primaryColor,
            lineHeight: 1.2,
            marginBottom: `${Math.round(6 * scale)}px`,
          }}
        >
          {cleanName}
        </h1>

        {/* Role */}
        {cleanRole && (
          <p
            style={{
              margin: 0,
              fontFamily: activeFont,
              fontSize: `${Math.round(16 * scale)}px`,
              fontWeight: 700,
              color: COLOR_PALETTE.textSubtle,
              marginBottom: `${Math.round(14 * scale)}px`,
            }}
          >
            {cleanRole}
          </p>
        )}

        {/* Divider */}
        <div
          style={{
            width: '120px',
            height: '2px',
            background: `linear-gradient(90deg, ${activeTheme.primaryColor}, transparent)`,
            marginBottom: `${Math.round(14 * scale)}px`,
          }}
        />

        {/* Biography Details */}
        {cleanDetails && (
          <p
            style={{
              margin: `0 0 ${Math.round(16 * scale)}px 0`,
              fontFamily: activeFont,
              fontSize: `${Math.round(15 * scale)}px`,
              color: COLOR_PALETTE.textWhite,
              lineHeight: 1.5,
            }}
          >
            {cleanDetails}
          </p>
        )}

        {/* Famous Quote Card Box */}
        {cleanQuote && (
          <div
            style={{
              padding: `${Math.round(12 * scale)}px ${Math.round(16 * scale)}px`,
              background: 'rgba(32, 26, 18, 0.85)',
              borderRadius: '2px',
              borderLeft: `4px solid ${activeTheme.primaryColor}`,
              fontFamily: activeSerifFont,
              fontSize: `${Math.round(15 * scale)}px`,
              fontWeight: 700,
              fontStyle: 'italic',
              color: COLOR_PALETTE.textWhite,
              lineHeight: 1.4,
            }}
          >
            "{cleanQuote}"
          </div>
        )}
      </div>
    </div>
  );
};
