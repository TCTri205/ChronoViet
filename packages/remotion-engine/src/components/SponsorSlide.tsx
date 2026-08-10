import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
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
  const { scale, isLandscape } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);

  const cleanSponsorTitle = toVietnameseUpperCase(sponsorTitle);
  const cleanSponsorDesc = normalizeVietnameseText(sponsorDesc);
  const cleanCtaText = toVietnameseUpperCase(ctaText);

  // Vibrant Entry Animation
  const boxScale = spring({
    frame,
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 14, stiffness: 110 },
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const pulse = interpolate(frame % 30, [0, 15, 30], [1, 1.05, 1]);

  const titleFontSize = Math.round((isLandscape ? 36 : 26) * scale);
  const descFontSize = Math.round((isLandscape ? 20 : 16) * scale);
  const ctaFontSize = Math.round((isLandscape ? 18 : 14) * scale);

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

      {/* Chrono Blue Glow Accent */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at center, ${activeTheme.accentGlow} 0%, transparent 70%)`,
          opacity: 0.8,
        }}
      />

      {/* Main Bright Sponsor Card Box */}
      <div
        style={{
          transform: `scale(${boxScale})`,
          opacity,
          maxWidth: isLandscape ? '78%' : '88%',
          backgroundColor: '#ffffff',
          color: '#1a1a1a',
          borderRadius: `${Math.round(20 * scale)}px`,
          padding: `${Math.round(44 * scale)}px ${Math.round(52 * scale)}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: `0 30px 80px rgba(0, 0, 0, 0.9), 0 0 50px ${activeTheme.accentGlow}`,
          border: `3px solid ${activeTheme.secondaryColor}`,
          zIndex: 10,
        }}
      >
        {/* Sponsor Badge */}
        <div
          style={{
            backgroundColor: '#eff6ff',
            color: activeTheme.secondaryColor,
            fontFamily: activeFont,
            fontWeight: 800,
            fontSize: `${Math.round(13 * scale)}px`,
            letterSpacing: '1.5px',
            padding: `${Math.round(6 * scale)}px ${Math.round(18 * scale)}px`,
            borderRadius: `${Math.round(20 * scale)}px`,
            marginBottom: `${Math.round(16 * scale)}px`,
            border: `1px solid ${activeTheme.secondaryColor}`,
          }}
        >
          CHRONOVIET SPECIAL FEATURE
        </div>

        {/* Sponsor Title */}
        <h2
          style={{
            margin: 0,
            fontFamily: activeFont,
            fontSize: `${titleFontSize}px`,
            fontWeight: 900,
            color: '#0f172a',
            letterSpacing: '0.4px',
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
            lineHeight: 1.5,
            color: '#475569',
            maxWidth: '90%',
          }}
        >
          {cleanSponsorDesc}
        </p>

        {/* Pulsing Call to Action Button */}
        <div
          style={{
            transform: `scale(${pulse})`,
            backgroundColor: activeTheme.secondaryColor,
            color: '#ffffff',
            fontFamily: activeFont,
            fontWeight: 900,
            fontSize: `${ctaFontSize}px`,
            letterSpacing: '1px',
            padding: `${Math.round(14 * scale)}px ${Math.round(36 * scale)}px`,
            borderRadius: `${Math.round(30 * scale)}px`,
            boxShadow: `0 10px 25px ${activeTheme.accentGlow}`,
            cursor: 'pointer',
          }}
        >
          {cleanCtaText}
        </div>
      </div>
    </AbsoluteFill>
  );
};
