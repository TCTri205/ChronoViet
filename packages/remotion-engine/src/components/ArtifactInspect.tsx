import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ArtifactInfo, ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface ArtifactInspectProps {
  title?: string;
  subtitle?: string;
  artifactInfo?: ArtifactInfo;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const ArtifactInspect: React.FC<ArtifactInspectProps> = ({
  title = 'TRỐNG ĐỒNG ĐÔNG SƠN',
  subtitle = 'BẢO VẬT QUỐC GIA',
  artifactInfo = {
    period: 'Văn hóa Đông Sơn (Thế kỷ III - II TCN)',
    material: 'Đồng thau đúc hoa văn chìm',
    origin: 'Đông Sơn, Thanh Hóa',
    dimensions: 'Đường kính mặt 79 cm, cao 63 cm',
    location: 'Bảo tàng Lịch sử Quốc gia',
  },
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

  const rows = [
    { label: 'Niên đại / Văn hóa', value: artifactInfo?.period },
    { label: 'Chất liệu chế tác', value: artifactInfo?.material },
    { label: 'Địa điểm phát hiện', value: artifactInfo?.origin },
    { label: 'Kích thước hiện vật', value: artifactInfo?.dimensions },
    { label: 'Nơi lưu giữ hiện tại', value: artifactInfo?.location },
  ].filter((r) => Boolean(r.value));

  return (
    <div
      style={{
        position: 'absolute',
        top: `${Math.round(115 * scale)}px`,
        bottom: `${Math.round(165 * scale)}px`,
        left: `${Math.round(40 * scale)}px`,
        width: `${Math.round(540 * scale)}px`,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* 16:9 Left Showcase Inspection Panel */}
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
        {/* Red Seal Badge */}
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
            marginBottom: `${Math.round(12 * scale)}px`,
            textTransform: 'uppercase',
            display: 'inline-block',
          }}
        >
          【 GIÁM ĐỊNH BẢO VẬT 】
        </div>

        {/* Artifact Title */}
        <h1
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${Math.round(32 * scale)}px`,
            fontWeight: 900,
            color: activeTheme.primaryColor,
            lineHeight: 1.25,
            marginBottom: `${Math.round(4 * scale)}px`,
          }}
        >
          {cleanTitle}
        </h1>

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

        {/* Hotspot Inspection Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${Math.round(10 * scale)}px` }}>
          {rows.map((row, idx) => {
            const rowDelay = cardDelay + 10 + idx * 6;
            const rowOpacity = interpolate(frame, [rowDelay, rowDelay + 8], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={idx}
                style={{
                  opacity: rowOpacity,
                  padding: `${Math.round(8 * scale)}px ${Math.round(14 * scale)}px`,
                  background: 'rgba(32, 26, 18, 0.75)',
                  borderRadius: '2px',
                  borderLeft: `3px solid ${activeTheme.primaryColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <span
                  style={{
                    fontFamily: activeFont,
                    fontSize: `${Math.round(12 * scale)}px`,
                    fontWeight: 800,
                    color: activeTheme.primaryColor,
                    letterSpacing: '0.5px',
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    fontFamily: activeFont,
                    fontSize: `${Math.round(15 * scale)}px`,
                    fontWeight: 600,
                    color: COLOR_PALETTE.textWhite,
                    marginTop: '2px',
                  }}
                >
                  {normalizeVietnameseText(row.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
