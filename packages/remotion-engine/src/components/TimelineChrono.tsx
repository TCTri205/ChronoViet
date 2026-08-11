import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface MilestoneItem {
  time: string;
  title: string;
  desc?: string;
}

interface TimelineChronoProps {
  title?: string;
  subtitle?: string;
  milestones?: MilestoneItem[];
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const TimelineChrono: React.FC<TimelineChronoProps> = ({
  title = 'TRỤC NIÊN ĐẠI LỊCH SỬ',
  subtitle = 'DIỄN BIẾN CHÍNH',
  milestones = [],
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

  // Entrance spring animation
  const cardDelay = 15;
  const cardScale = spring({
    frame: Math.max(0, frame - cardDelay),
    fps,
    from: 0.94,
    to: 1,
    config: { damping: 15, stiffness: 90 },
  });

  const opacity = interpolate(frame, [cardDelay, cardDelay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Timeline line progress animation across 16:9 width
  const lineProgress = interpolate(frame, [cardDelay + 10, cardDelay + 50], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Default fallback milestones if none provided
  const displayMilestones = milestones.length > 0 ? milestones : [
    { time: 'Mùng 4 Tết', title: 'Áp sát đồn Ngọc Hồi', desc: 'Đêm mùng 4 Kỷ Dậu, quân Tây Sơn bao vây đồn địch' },
    { time: 'Sáng Mùng 5', title: 'Tổng công phá đồn', desc: 'Dùng rơm bện khiên rơm nhúng nước chắn hỏa lực' },
    { time: 'Mùng 5 Tết', title: 'Giải phóng Thăng Long', desc: 'Sầm Nghi Đống thắt cổ, Tôn Sĩ Nghị tháo chạy' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: `${Math.round(115 * scale)}px`,
        bottom: `${Math.round(165 * scale)}px`,
        left: '5%',
        right: '5%',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity,
          width: '100%',
          padding: `${Math.round(30 * scale)}px ${Math.round(40 * scale)}px`,
          background: 'rgba(22, 18, 14, 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '2px',
          border: `1px solid ${activeTheme.primaryColor}`,
          outline: `1px solid ${activeTheme.accentGlow}`,
          outlineOffset: '-5px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Header Badge & Title */}
        <div
          style={{
            backgroundColor: 'rgba(155, 27, 27, 0.1)',
            color: COLOR_PALETTE.vermilionRed,
            fontFamily: activeFont,
            fontSize: `${Math.round(12 * scale)}px`,
            fontWeight: 900,
            letterSpacing: '2.5px',
            padding: '4px 16px',
            borderRadius: '2px',
            border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
            marginBottom: `${Math.round(10 * scale)}px`,
            textTransform: 'uppercase',
          }}
        >
          【 {cleanSubtitle || 'DIỄN BIẾN LỊCH SỬ'} 】
        </div>

        <h1
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${Math.round(36 * scale)}px`,
            fontWeight: 900,
            color: activeTheme.primaryColor,
            letterSpacing: '0.5px',
            textShadow: '0 3px 12px rgba(0,0,0,0.9)',
          }}
        >
          {cleanTitle}
        </h1>

        {/* 16:9 Horizontal Timeline Axis */}
        <div
          style={{
            position: 'relative',
            width: '90%',
            marginTop: `${Math.round(35 * scale)}px`,
            marginBottom: `${Math.round(15 * scale)}px`,
          }}
        >
          {/* Base Gray Line */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: 0,
              right: 0,
              height: '4px',
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '2px',
            }}
          />

          {/* Active Glowing Golden Progress Line */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: 0,
              width: `${lineProgress}%`,
              height: '4px',
              background: `linear-gradient(90deg, ${COLOR_PALETTE.vermilionRed}, ${activeTheme.primaryColor})`,
              borderRadius: '2px',
              boxShadow: `0 0 10px ${activeTheme.primaryColor}`,
            }}
          />

          {/* Milestones Container */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              position: 'relative',
              zIndex: 5,
            }}
          >
            {displayMilestones.map((m, idx) => {
              const nodeDelay = cardDelay + 15 + idx * 10;
              const nodeOpacity = interpolate(frame, [nodeDelay, nodeDelay + 10], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const nodeY = interpolate(frame, [nodeDelay, nodeDelay + 10], [15, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              return (
                <div
                  key={idx}
                  style={{
                    opacity: nodeOpacity,
                    transform: `translateY(${nodeY}px)`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: `${Math.round(240 * scale)}px`,
                  }}
                >
                  {/* Glowing Node Button */}
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(22, 18, 14, 0.95)',
                      border: `3px solid ${activeTheme.primaryColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 0 15px ${activeTheme.accentGlow}`,
                      marginBottom: `${Math.round(12 * scale)}px`,
                    }}
                  >
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: COLOR_PALETTE.vermilionRed,
                      }}
                    />
                  </div>

                  {/* Time Badge */}
                  <span
                    style={{
                      fontFamily: activeFont,
                      fontSize: `${Math.round(14 * scale)}px`,
                      fontWeight: 800,
                      color: activeTheme.primaryColor,
                      letterSpacing: '1px',
                      marginBottom: '4px',
                    }}
                  >
                    {m.time}
                  </span>

                  {/* Title */}
                  <span
                    style={{
                      fontFamily: activeSerifFont,
                      fontSize: `${Math.round(16 * scale)}px`,
                      fontWeight: 700,
                      color: COLOR_PALETTE.textWhite,
                      textAlign: 'center',
                      marginBottom: '4px',
                    }}
                  >
                    {normalizeVietnameseText(m.title)}
                  </span>

                  {/* Description */}
                  {m.desc && (
                    <span
                      style={{
                        fontFamily: activeFont,
                        fontSize: `${Math.round(13 * scale)}px`,
                        color: COLOR_PALETTE.textSubtle,
                        textAlign: 'center',
                        lineHeight: 1.3,
                      }}
                    >
                      {normalizeVietnameseText(m.desc)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
