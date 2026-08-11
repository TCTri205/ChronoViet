import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR_PALETTE } from '../constants/config';
import { CaptionWord, ThemeConfig } from '../types';
import { useResponsiveLayout } from '../utils/layoutUtils';
import { resolveTheme } from '../utils/themeUtils';
import { getSafeFontFamily, normalizeVietnameseText } from '../utils/fontUtils';

interface DocumentarySubtitleProps {
  text: string;
  durationInFrames: number;
  theme?: ThemeConfig;
  captions?: CaptionWord[];
}

export const DocumentarySubtitle: React.FC<DocumentarySubtitleProps> = ({
  text,
  durationInFrames,
  theme,
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, safeMarginX, height } = useResponsiveLayout();
  const activeTheme = React.useMemo(() => resolveTheme(theme), [theme]);
  const activeFont = React.useMemo(() => getSafeFontFamily(theme?.fontFamily), [theme?.fontFamily]);
  const cleanText = React.useMemo(() => normalizeVietnameseText(text), [text]);

  const hasWordCaptions = Boolean(captions && captions.length > 0);

  const layoutStyles = React.useMemo(() => {
    const textLength = cleanText ? cleanText.length : (hasWordCaptions ? captions!.map(c => c.word).join(' ').length : 0);
    if (!textLength) return null;

    const bottomOffset = Math.round(height * 0.05);
    const baseSize = 24;
    const fontDynamicScale = textLength > 140 ? 0.85 : textLength > 90 ? 0.92 : 1.0;
    const fontSize = Math.round(baseSize * scale * fontDynamicScale);
    const paddingY = Math.round(10 * scale);
    const paddingX = Math.round(24 * scale);

    return { bottomOffset, fontSize, paddingY, paddingX };
  }, [height, cleanText, hasWordCaptions, captions, scale]);

  if ((!cleanText && !hasWordCaptions) || !layoutStyles) return null;

  // Stagger subtitle entrance (frame delay = 10) following background & header
  const entranceDelay = 10;
  const entrance = spring({
    frame: Math.max(0, frame - entranceDelay),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const translateY = interpolate(entrance, [0, 1], [25, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  const { bottomOffset, fontSize, paddingY, paddingX } = layoutStyles;

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
          background: 'rgba(22, 18, 14, 0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${activeTheme.primaryColor}`,
          outline: `1px solid ${activeTheme.accentGlow}`,
          outlineOffset: '-4px',
          borderRadius: '2px',
          padding: `${paddingY}px ${paddingX}px`,
          boxShadow: '0 12px 35px rgba(0, 0, 0, 0.95)',
          maxWidth: '85%',
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
            letterSpacing: '0.2px',
            margin: 0,
            textShadow: '0 2px 8px rgba(0,0,0,0.95)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            columnGap: '6px',
            rowGap: '2px',
          }}
        >
          {hasWordCaptions
            ? captions!.map((cap, idx) => {
                const isActive =
                  frame >= cap.startFrame &&
                  (idx === captions!.length - 1
                    ? frame <= cap.endFrame
                    : frame < cap.endFrame);
                const isPast = frame >= cap.endFrame;

                return (
                  <span
                    key={`cap-${idx}`}
                    style={{
                      color: isActive
                        ? activeTheme.primaryColor
                        : isPast
                        ? COLOR_PALETTE.textWhite
                        : 'rgba(245, 242, 235, 0.65)',
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                      fontWeight: isActive ? 800 : 600,
                      textShadow: isActive
                        ? `0 0 10px ${activeTheme.primaryColor}, 0 2px 8px rgba(0,0,0,0.95)`
                        : '0 2px 8px rgba(0,0,0,0.95)',
                      display: 'inline-block',
                    }}
                  >
                    {cap.word}
                  </span>
                );
              })
            : cleanText}
        </p>
      </div>
    </div>
  );
};

