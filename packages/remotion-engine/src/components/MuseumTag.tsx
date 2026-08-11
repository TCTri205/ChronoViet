import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ArtifactInfo, OverlayPosition, ThemeConfig } from '../types';
import { resolveOverlayPositionStyle, useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText, toVietnameseUpperCase } from '../utils/fontUtils';

interface MuseumTagProps {
  title?: string;
  subtitle?: string;
  artifactInfo?: ArtifactInfo;
  position?: OverlayPosition;
  index?: number;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const MuseumTag: React.FC<MuseumTagProps> = ({
  title = 'TÊN BẢO VẬT / CỔ VẬT',
  subtitle = 'BẢO VẬT QUỐC GIA',
  artifactInfo,
  position,
  index = 0,
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

  // Delay card entrance by 15 frames (0.5s) so background media shows first
  const cardDelay = 15;
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

  const titleFontSize = Math.round(36 * scale);
  const subFontSize = Math.round(18 * scale);
  const infoFontSize = Math.round(18 * scale);

  const infoRows = [
    { label: 'Niên đại / Văn hóa:', value: normalizeVietnameseText(artifactInfo?.period) },
    { label: 'Chất liệu:', value: normalizeVietnameseText(artifactInfo?.material) },
    { label: 'Địa điểm phát hiện:', value: normalizeVietnameseText(artifactInfo?.origin) },
    { label: 'Kích thước:', value: normalizeVietnameseText(artifactInfo?.dimensions) },
    { label: 'Nơi lưu giữ hiện tại:', value: normalizeVietnameseText(artifactInfo?.location) },
  ].filter((r) => Boolean(r.value));

  const posStyle = resolveOverlayPositionStyle(position || 'BOTTOM_LEFT', index, scale);

  return (
    <div
      style={{
        position: 'absolute',
        width: `${Math.round(450 * scale)}px`,
        maxWidth: '92%',
        maxHeight: `${Math.round(500 * scale)}px`,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        pointerEvents: 'none',
        ...posStyle,
      }}
    >
      {/* Museum Display Showcase Tag (Framed Mộc Bản Di Sản) */}
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity,
          width: '100%',
          maxHeight: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          textAlign: 'left',
          padding: `${Math.round(24 * scale)}px ${Math.round(28 * scale)}px`,
          background: 'rgba(22, 18, 14, 0.94)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '2px',
          border: `1px solid ${activeTheme.primaryColor}`,
          outline: `1px solid ${activeTheme.accentGlow}`,
          outlineOffset: '-5px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95)',
        }}
      >
        {/* Vietnamese Red Seal Stamp Badge (Con dấu Triện Son Bảo Tàng) */}
        <div
          style={{
            border: `2px solid ${COLOR_PALETTE.vermilionRed}`,
            color: COLOR_PALETTE.vermilionRed,
            backgroundColor: 'rgba(155, 27, 27, 0.1)',
            fontFamily: activeFont,
            fontSize: `${Math.round(11 * scale)}px`,
            fontWeight: 900,
            letterSpacing: '2px',
            padding: `${Math.round(3 * scale)}px ${Math.round(12 * scale)}px`,
            borderRadius: '2px',
            marginBottom: `${Math.round(12 * scale)}px`,
            textTransform: 'uppercase',
            boxShadow: 'inset 0 0 4px rgba(155, 27, 27, 0.25)',
          }}
        >
          【 BẢO VẬT QUỐC GIA 】
        </div>

        {/* Title */}
        <h1
          style={{
            margin: 0,
            fontFamily: activeSerifFont,
            fontSize: `${titleFontSize * 0.85}px`,
            fontWeight: 900,
            color: activeTheme.primaryColor,
            letterSpacing: '0.5px',
            textShadow: '0 2px 10px rgba(0,0,0,0.9)',
            lineHeight: 1.25,
          }}
        >
          {cleanTitle}
        </h1>

        {/* Subtitle */}
        {cleanSubtitle && (
          <p
            style={{
              margin: `${Math.round(4 * scale)}px 0 0 0`,
              fontFamily: activeFont,
              fontSize: `${subFontSize}px`,
              fontWeight: 600,
              color: COLOR_PALETTE.textSubtle,
              letterSpacing: '0.3px',
            }}
          >
            {cleanSubtitle}
          </p>
        )}

        {/* Divider Line */}
        <div
          style={{
            width: '100px',
            height: '2px',
            background: `linear-gradient(90deg, ${activeTheme.primaryColor}, transparent)`,
            margin: `${Math.round(14 * scale)}px 0`,
          }}
        />

        {/* Info Rows */}
        {infoRows.length > 0 && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: `${Math.round(8 * scale)}px`,
              textAlign: 'left',
            }}
          >
            {infoRows.map((row, idx) => {
              const rowDelay = cardDelay + 10 + idx * 6;
              const rowOpacity = interpolate(
                frame,
                [rowDelay, rowDelay + 8],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );

              return (
                <div
                  key={idx}
                  style={{
                    opacity: rowOpacity,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: `${Math.round(6 * scale)}px ${Math.round(12 * scale)}px`,
                    background: 'rgba(32, 26, 18, 0.75)',
                    borderRadius: '2px',
                    borderLeft: `3px solid ${activeTheme.primaryColor}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: activeFont,
                      fontSize: `${infoFontSize * 0.85}px`,
                      fontWeight: 700,
                      color: activeTheme.primaryColor,
                      letterSpacing: '0.2px',
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontFamily: activeFont,
                      fontSize: `${infoFontSize * 0.9}px`,
                      fontWeight: 500,
                      color: COLOR_PALETTE.textWhite,
                      marginTop: `${Math.round(2 * scale)}px`,
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

