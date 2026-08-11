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
  const activeTheme = React.useMemo(() => resolveTheme(theme), [theme]);
  const activeFont = React.useMemo(() => getSafeFontFamily(theme?.fontFamily), [theme?.fontFamily]);

  const effectiveSeriesTitle = seriesTitle || activeTheme.headerTitle;
  const cleanSeriesTitle = React.useMemo(() => toVietnameseUpperCase(effectiveSeriesTitle), [effectiveSeriesTitle]);
  const cleanChapterTitle = React.useMemo(() => toVietnameseUpperCase(chapterTitle), [chapterTitle]);

  // Stagger header entrance slightly (frame delay = 4) to let background visual establish first
  const entranceDelay = 4;
  const entrance = spring({
    frame: Math.max(0, frame - entranceDelay),
    fps,
    config: { damping: 16, stiffness: 100 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateY = interpolate(entrance, [0, 1], [-20, 0]);

  const layoutMetrics = React.useMemo(() => {
    return {
      fontSize: Math.round(12 * scale),
      paddingY: Math.round(6 * scale),
      paddingX: Math.round(16 * scale),
      dotSize: Math.round(6 * scale),
    };
  }, [scale]);

  const { fontSize, paddingY, paddingX, dotSize } = layoutMetrics;

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
            backgroundColor: 'rgba(22, 18, 14, 0.94)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: `1px solid ${activeTheme.primaryColor}`,
            borderRadius: '2px',
            padding: `${paddingY}px ${paddingX}px`,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.85)',
            maxWidth: '45%',
          }}
        >
          <span
            style={{
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              minWidth: `${dotSize}px`,
              borderRadius: '1px',
              backgroundColor: COLOR_PALETTE.vermilionRed,
            }}
          />
          <span
            style={{
              color: COLOR_PALETTE.textWhite,
              fontFamily: activeFont,
              fontSize: `${fontSize}px`,
              fontWeight: 800,
              letterSpacing: '1.4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cleanSeriesTitle}
          </span>
        </div>
      ) : (
        <div />
      )}

      {/* Chapter Title Badge */}
      {cleanChapterTitle && cleanChapterTitle !== cleanSeriesTitle && (
        <div
          style={{
            backgroundColor: 'rgba(22, 18, 14, 0.94)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: `1px solid ${activeTheme.primaryColor}`,
            borderRadius: '2px',
            padding: `${paddingY}px ${paddingX}px`,
            color: activeTheme.primaryColor,
            fontFamily: activeFont,
            fontSize: `${fontSize}px`,
            fontWeight: 700,
            letterSpacing: '0.8px',
            maxWidth: '45%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {cleanChapterTitle}
        </div>
      )}
    </div>
  );
};

