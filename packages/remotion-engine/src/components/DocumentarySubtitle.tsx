import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText } from '../utils/fontUtils';

interface DocumentarySubtitleProps {
  text: string;
  durationInFrames: number;
  theme?: ThemeConfig;
}

export const DocumentarySubtitle: React.FC<DocumentarySubtitleProps> = ({
  text,
  durationInFrames,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, safeMarginX, height, isLandscape } = useResponsiveLayout();
  const activeTheme = React.useMemo(() => resolveTheme(theme), [theme]);
  const activeFont = React.useMemo(() => getSafeFontFamily(theme?.fontFamily), [theme?.fontFamily]);
  const cleanText = React.useMemo(() => normalizeVietnameseText(text), [text]);

  const layoutStyles = React.useMemo(() => {
    if (!cleanText) return null;
    const bottomOffset = Math.round(height * 0.05);
    const baseSize = isLandscape ? 24 : 22;
    const fontDynamicScale = cleanText.length > 140 ? 0.85 : cleanText.length > 90 ? 0.92 : 1.0;
    const fontSize = Math.round(baseSize * scale * fontDynamicScale);
    const paddingY = Math.round(12 * scale);
    const paddingX = Math.round(26 * scale);
    const borderRadius = Math.round(14 * scale);

    return { bottomOffset, fontSize, paddingY, paddingX, borderRadius };
  }, [height, isLandscape, cleanText, scale]);

  if (!cleanText || !layoutStyles) return null;

  // Stagger subtitle entrance (frame delay = 10) following background & header
  const entranceDelay = 10;
  const entrance = spring({
    frame: Math.max(0, frame - entranceDelay),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const translateY = interpolate(entrance, [0, 1], [25, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  const { bottomOffset, fontSize, paddingY, paddingX, borderRadius } = layoutStyles;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: `${bottomOffset}px`,
        left: `${safeMarginX}px`,
        right: `${safeMarginX}px`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
        transform: `translateY(${translateY}px) translateZ(0)`,
        opacity,
        willChange: 'transform, opacity',
      }}
    >
      <div
        style={{
          background: 'rgba(9, 12, 18, 0.94)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${activeTheme.accentGlow}`,
          borderRadius: `${Math.round(14 * scale)}px`,
          padding: `${paddingY}px ${paddingX}px`,
          boxShadow: `0 12px 35px rgba(0, 0, 0, 0.85), 0 0 18px ${activeTheme.accentGlow}`,
          maxWidth: isLandscape ? '85%' : '95%',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            color: COLOR_PALETTE.textWhite,
            fontFamily: activeFont,
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            lineHeight: 1.5,
            letterSpacing: '0.1px',
            margin: 0,
            textShadow: '0 2px 8px rgba(0,0,0,0.95)',
          }}
        >
          {cleanText}
        </p>
      </div>
    </div>
  );
};
