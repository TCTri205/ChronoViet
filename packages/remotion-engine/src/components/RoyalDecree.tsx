import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface RoyalDecreeProps {
  title?: string;
  author?: string;
  decreeText?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const RoyalDecree: React.FC<RoyalDecreeProps> = ({
  title = 'CHIẾU CẦN VƯƠNG',
  author = 'VUA HÀM NGHI (1885)',
  decreeText = 'Từ cổ triều đình dựng nước, phương lược chống giặc không ngoài hai chữ Thủ và Chiến. Nay sơn hà nguy biến, trẫm ban chiếu này kêu gọi sĩ phu, nhân dân toàn quốc đồng lòng đứng lên vì xã tắc.',
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
  const cleanAuthor = toVietnameseUpperCase(author);
  const cleanText = normalizeVietnameseText(decreeText);

  // Unrolling parchment animation (16:9 width expansion)
  const unrollProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    from: 0.2,
    to: 1,
    config: { damping: 18, stiffness: 80 },
  });

  const opacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: `${Math.round(110 * scale)}px`,
        bottom: `${Math.round(160 * scale)}px`,
        left: '8%',
        right: '8%',
        zIndex: 20,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Royal Scroll Parchment Container */}
      <div
        style={{
          transform: `scaleX(${unrollProgress}) scaleY(1)`,
          opacity,
          width: '100%',
          height: '100%',
          padding: `${Math.round(40 * scale)}px ${Math.round(60 * scale)}px`,
          background: 'linear-gradient(135deg, rgba(32, 24, 16, 0.98) 0%, rgba(20, 15, 10, 0.98) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '4px',
          borderLeft: `16px solid ${activeTheme.primaryColor}`,
          borderRight: `16px solid ${activeTheme.primaryColor}`,
          borderTop: `2px solid ${COLOR_PALETTE.vermilionRed}`,
          borderBottom: `2px solid ${COLOR_PALETTE.vermilionRed}`,
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.98), inset 0 0 40px rgba(200, 157, 53, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Royal Seal Stamp Watermark (Con Dấu Triện Son Hoàng Đế) */}
        <div
          style={{
            position: 'absolute',
            right: `${Math.round(40 * scale)}px`,
            bottom: `${Math.round(30 * scale)}px`,
            width: `${Math.round(120 * scale)}px`,
            height: `${Math.round(120 * scale)}px`,
            border: `4px solid ${COLOR_PALETTE.vermilionRed}`,
            color: COLOR_PALETTE.vermilionRed,
            opacity: 0.85,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${Math.round(16 * scale)}px`,
            fontWeight: 900,
            fontFamily: activeSerifFont,
            transform: 'rotate(-8deg)',
            boxShadow: 'inset 0 0 10px rgba(155, 27, 27, 0.4)',
            letterSpacing: '2px',
          }}
        >
          【 SẮC PHONG 】
        </div>

        {/* Title */}
        <h1
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${Math.round(42 * scale)}px`,
            fontWeight: 900,
            color: activeTheme.primaryColor,
            letterSpacing: '4px',
            textShadow: '0 3px 12px rgba(0,0,0,0.9)',
            marginBottom: `${Math.round(10 * scale)}px`,
          }}
        >
          {cleanTitle}
        </h1>

        {/* Author / Era */}
        {cleanAuthor && (
          <span
            style={{
              fontFamily: activeFont,
              fontSize: `${Math.round(16 * scale)}px`,
              fontWeight: 800,
              color: COLOR_PALETTE.vermilionRed,
              letterSpacing: '3px',
              marginBottom: `${Math.round(20 * scale)}px`,
            }}
          >
            — {cleanAuthor} —
          </span>
        )}

        {/* Heritage Gold Line */}
        <div
          style={{
            width: `${Math.round(220 * scale)}px`,
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${activeTheme.primaryColor}, transparent)`,
            marginBottom: `${Math.round(24 * scale)}px`,
          }}
        />

        {/* Decree Body Text */}
        <p
          style={{
            margin: 0,
            maxWidth: '85%',
            fontFamily: activeSerifFont,
            fontSize: `${Math.round(24 * scale)}px`,
            fontWeight: 600,
            fontStyle: 'italic',
            lineHeight: 1.65,
            color: COLOR_PALETTE.textWhite,
            textAlign: 'center',
            letterSpacing: '0.4px',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.95)',
          }}
        >
          "{cleanText}"
        </p>
      </div>
    </div>
  );
};
