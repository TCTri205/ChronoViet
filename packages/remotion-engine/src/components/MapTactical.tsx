import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface MapTacticalProps {
  title?: string;
  subtitle?: string;
  details?: string;
  commander?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const MapTactical: React.FC<MapTacticalProps> = ({
  title = 'SƠ ĐỒ TẤN CÔNG ĐỒN NGỌC HỒI',
  subtitle = 'TRẬN NGỌC HỒI - ĐỐNG ĐA (1789)',
  details = 'Quân Tây Sơn chia làm 5 đạo tiến quân. Đạo quân chủ lực do Quang Trung trực tiếp chỉ huy đánh thẳng vào đồn Ngọc Hồi đêm mùng 4 Tết.',
  commander = 'CHỦ HUY: QUANG TRUNG NGUYỄN HUỆ',
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
  const cleanSubtitle = normalizeVietnameseText(subtitle);
  const cleanDetails = normalizeVietnameseText(details);

  const cardDelay = 12;
  const cardScale = spring({
    frame: Math.max(0, frame - cardDelay),
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 15, stiffness: 90 },
  });

  const opacity = interpolate(frame, [cardDelay, cardDelay + 10], [0, 1], {
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
        width: `${Math.round(520 * scale)}px`,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* 16:9 Left Tactical Legend Panel */}
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity,
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
        {/* Tactical Badge */}
        <div
          style={{
            backgroundColor: 'rgba(155, 27, 27, 0.1)',
            color: COLOR_PALETTE.vermilionRed,
            fontFamily: activeFont,
            fontSize: `${Math.round(11 * scale)}px`,
            fontWeight: 900,
            letterSpacing: '2px',
            padding: `${Math.round(4 * scale)}px ${Math.round(12 * scale)}px`,
            borderRadius: '2px',
            border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
            marginBottom: `${Math.round(12 * scale)}px`,
            textTransform: 'uppercase',
            display: 'inline-block',
          }}
        >
          【 SA BÀN CHIẾN THUẬT 】
        </div>

        {/* Title */}
        <h2
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${Math.round(28 * scale)}px`,
            fontWeight: 900,
            color: activeTheme.primaryColor,
            lineHeight: 1.25,
            marginBottom: `${Math.round(6 * scale)}px`,
          }}
        >
          {cleanTitle}
        </h2>

        {/* Subtitle */}
        {cleanSubtitle && (
          <p
            style={{
              margin: 0,
              fontFamily: activeFont,
              fontSize: `${Math.round(15 * scale)}px`,
              fontWeight: 600,
              color: COLOR_PALETTE.textSubtle,
              marginBottom: `${Math.round(14 * scale)}px`,
            }}
          >
            {cleanSubtitle}
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

        {/* Details Text */}
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

        {/* Tactical Legend Box */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${Math.round(8 * scale)}px`,
            padding: `${Math.round(12 * scale)}px`,
            background: 'rgba(32, 26, 18, 0.8)',
            borderRadius: '2px',
            borderLeft: `3px solid ${activeTheme.primaryColor}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '14px', height: '14px', backgroundColor: COLOR_PALETTE.vermilionRed, borderRadius: '2px' }} />
            <span style={{ fontFamily: activeFont, fontSize: `${Math.round(13 * scale)}px`, color: COLOR_PALETTE.textWhite, fontWeight: 700 }}>
              Quân Đại Việt (Tây Sơn) — Hướng Tiến Công
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '14px', height: '14px', backgroundColor: '#4A6B5D', borderRadius: '2px' }} />
            <span style={{ fontFamily: activeFont, fontSize: `${Math.round(13 * scale)}px`, color: COLOR_PALETTE.textSubtle, fontWeight: 600 }}>
              Đồn lũy & Căn cứ địch
            </span>
          </div>
        </div>

        {/* Commander Footnote */}
        {commander && (
          <div
            style={{
              marginTop: `${Math.round(14 * scale)}px`,
              fontFamily: activeFont,
              fontSize: `${Math.round(13 * scale)}px`,
              fontWeight: 800,
              color: activeTheme.primaryColor,
              letterSpacing: '1px',
            }}
          >
            {commander}
          </div>
        )}
      </div>
    </div>
  );
};
