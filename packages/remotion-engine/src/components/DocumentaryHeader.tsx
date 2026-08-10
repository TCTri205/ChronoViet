import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, toVietnameseUpperCase } from '../utils/fontUtils';

interface DocumentaryHeaderProps {
  seriesTitle?: string;
  chapterTitle?: string;
  theme?: ThemeConfig;
}

export const DocumentaryHeader: React.FC<DocumentaryHeaderProps> = ({
  seriesTitle,
  chapterTitle,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, safeMarginX, safeMarginY } = useResponsiveLayout();
  const activeTheme = resolveTheme(theme);
  const activeFont = getSafeFontFamily(theme?.fontFamily);

  const cleanSeriesTitle = toVietnameseUpperCase(seriesTitle);
  const cleanChapterTitle = toVietnameseUpperCase(chapterTitle);

  // Stagger header entrance slightly (frame delay = 4) to let background visual establish first
  const entranceDelay = 4;
  const entrance = spring({
    frame: Math.max(0, frame - entranceDelay),
    fps,
    config: { damping: 16, stiffness: 100 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateY = interpolate(entrance, [0, 1], [-20, 0]);

  const fontSize = Math.round(13 * scale);
  const paddingY = Math.round(7 * scale);
  const paddingX = Math.round(18 * scale);
  const dotSize = Math.round(8 * scale);

  return (
    <div
      style={{
        position: 'absolute',
        top: `${safeMarginY}px`,
        left: `${safeMarginX}px`,
        right: `${safeMarginX}px`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 30,
        opacity,
        transform: `translateY(${translateY}px) translateZ(0)`,
        willChange: 'transform, opacity',
        pointerEvents: 'none',
      }}
    >
      {/* Dynamic Brand / Series Badge */}
      {cleanSeriesTitle ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${Math.round(8 * scale)}px`,
            backgroundColor: 'rgba(10, 14, 22, 0.92)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: `1px solid ${activeTheme.accentGlow}`,
            borderRadius: `${Math.round(20 * scale)}px`,
            padding: `${paddingY}px ${paddingX}px`,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
          }}
        >
          <span
            style={{
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              borderRadius: '50%',
              backgroundColor: activeTheme.primaryColor,
              boxShadow: `0 0 8px ${activeTheme.primaryColor}`,
            }}
          />
          <span
            style={{
              color: COLOR_PALETTE.textWhite,
              fontFamily: activeFont,
              fontSize: `${fontSize}px`,
              fontWeight: 800,
              letterSpacing: '1.4px',
            }}
          >
            {cleanSeriesTitle}
          </span>
        </div>
      ) : <div />}

      {/* Chapter Title Badge */}
      {cleanChapterTitle && (
        <div
          style={{
            backgroundColor: 'rgba(10, 14, 22, 0.92)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: `1px solid ${activeTheme.accentGlow}`,
            borderRadius: `${Math.round(20 * scale)}px`,
            padding: `${paddingY}px ${paddingX}px`,
            color: activeTheme.primaryColor,
            fontFamily: activeFont,
            fontSize: `${fontSize}px`,
            fontWeight: 700,
            letterSpacing: '0.8px',
          }}
        >
          {cleanChapterTitle}
        </div>
      )}
    </div>
  );
};
