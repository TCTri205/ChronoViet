import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface SponsorSlideProps {
  sponsorTitle?: string;
  sponsorDesc?: string;
  ctaText?: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const SponsorSlide: React.FC<SponsorSlideProps> = ({
  sponsorTitle = 'TƯ LIỆU LỊCH SỬ CHRONOVIET',
  sponsorDesc = 'Khám phá kho tư liệu lịch sử Việt Nam số hóa và bài phân tích chuyên sâu tại ChronoViet.org',
  ctaText = 'KHÁM PHÁ NGAY TẠI CHRONOVIET.ORG',
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);
  const activeSerifFont = getSafeFontFamily(theme?.fontFamily, true);

  const cleanSponsorTitle = toVietnameseUpperCase(sponsorTitle);
  const cleanSponsorDesc = normalizeVietnameseText(sponsorDesc);
  const cleanCtaText = toVietnameseUpperCase(ctaText);

  // Vibrant Entry Animation
  const boxScale = spring({
    frame,
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 14, stiffness: 110 },
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const pulse = interpolate(frame % 30, [0, 15, 30], [1, 1.03, 1]);

  const titleFontSize = Math.round(34 * scale);
  const descFontSize = Math.round(18 * scale);
  const ctaFontSize = Math.round(16 * scale);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Historical Parchment Vignette Canvas Overlay */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at center, transparent 35%, rgba(14, 12, 10, 0.9) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Framed Sponsor Bảng Vàng Box */}
      <div
        style={{
          transform: `scale(${boxScale})`,
          opacity,
          maxWidth: '78%',
          backgroundColor: 'rgba(22, 18, 14, 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '2px',
          padding: `${Math.round(44 * scale)}px ${Math.round(52 * scale)}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95)',
          border: `1px solid ${activeTheme.primaryColor}`,
          outline: `1px solid ${activeTheme.accentGlow}`,
          outlineOffset: '-6px',
          zIndex: 10,
        }}
      >
        {/* Sponsor Red Seal Badge */}
        <div
          style={{
            backgroundColor: 'rgba(155, 27, 27, 0.15)',
            color: COLOR_PALETTE.vermilionRed,
            fontFamily: activeFont,
            fontWeight: 900,
            fontSize: `${Math.round(12 * scale)}px`,
            letterSpacing: '2px',
            padding: `${Math.round(5 * scale)}px ${Math.round(16 * scale)}px`,
            borderRadius: '2px',
            marginBottom: `${Math.round(16 * scale)}px`,
            border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
            textTransform: 'uppercase',
          }}
        >
          【 BẢNG VÀNG ĐỒNG HÀNH 】
        </div>

        {/* Sponsor Title */}
        <h2
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${titleFontSize}px`,
            fontWeight: 900,
            color: activeTheme.primaryColor,
            letterSpacing: '0.6px',
            lineHeight: 1.3,
          }}
        >
          {cleanSponsorTitle}
        </h2>

        {/* Sponsor Description */}
        <p
          style={{
            margin: `${Math.round(16 * scale)}px 0 ${Math.round(28 * scale)}px 0`,
            fontFamily: activeFont,
            fontSize: `${descFontSize}px`,
            lineHeight: 1.55,
            color: COLOR_PALETTE.textSubtle,
            maxWidth: '90%',
          }}
        >
          {cleanSponsorDesc}
        </p>

        {/* Call to Action Stamp Button */}
        <div
          style={{
            transform: `scale(${pulse})`,
            backgroundColor: COLOR_PALETTE.vermilionRed,
            color: COLOR_PALETTE.docParchment,
            fontFamily: activeFont,
            fontWeight: 900,
            fontSize: `${ctaFontSize}px`,
            letterSpacing: '1.5px',
            padding: `${Math.round(12 * scale)}px ${Math.round(32 * scale)}px`,
            borderRadius: '2px',
            border: `1px solid ${activeTheme.primaryColor}`,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.8)',
          }}
        >
          {cleanCtaText}
        </div>
      </div>
    </AbsoluteFill>
  );
};

