import React from 'react';
import { AbsoluteFill, Audio, interpolate, Loop, staticFile, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming, filmBurn, pushCut, dreamyZoom, crossZoom, linearBlur } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { ChronoVideoProps, TimelineScene, TransitionType } from '../types';
import { HistoryBackground, HistoryForeground } from './HistorySlide';
import { DocumentaryHeader } from '../components/DocumentaryHeader';
import { DocumentarySubtitle } from '../components/DocumentarySubtitle';
import { getMergedTheme } from '../utils/themeUtils';

const isHtmlInCanvasSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    return Boolean(ctx && 'drawElement' in (ctx as any));
  } catch (e) {
    return false;
  }
};

const getTransitionPresentation = (type?: TransitionType): any => {
  const canUseCanvasShader = isHtmlInCanvasSupported();

  switch (type) {
    case 'FADE':
    case 'FADE_TO_BLACK':
    case 'DISSOLVE':
      return fade();
    case 'SLIDE_LEFT':
      return slide({ direction: 'from-right' });
    case 'SLIDE_RIGHT':
      return slide({ direction: 'from-left' });
    case 'SLIDE_UP':
      return slide({ direction: 'from-bottom' });
    case 'SLIDE_DOWN':
      return slide({ direction: 'from-top' });
    case 'WIPE':
      return wipe({ direction: 'from-left' });
    case 'FLIP':
      return flip({});
    case 'CLOCK_WIPE':
      return clockWipe({ width: 1920, height: 1080 });
    case 'FILM_BURN':
    case 'LIGHT_LEAK':
      return canUseCanvasShader ? filmBurn({}) : wipe({ direction: 'from-top-left' });
    case 'GLITCH':
      return canUseCanvasShader ? pushCut({}) : slide({ direction: 'from-right' });
    case 'ZOOM_IN':
    case 'ZOOM_OUT':
    case 'ZOOM_DREAMY':
      return canUseCanvasShader ? dreamyZoom({}) : flip({});
    case 'CROSS_ZOOM':
      return canUseCanvasShader ? crossZoom({}) : clockWipe({ width: 1920, height: 1080 });
    case 'LINEAR_BLUR':
      return canUseCanvasShader ? linearBlur({}) : slide({ direction: 'from-bottom' });
    case 'NONE':
      return null;
    default:
      return fade();
  }
};

const getSceneDurationInFrames = (scene: TimelineScene, fps: number): number => {
  return (
    scene.durationInFrames ??
    (scene.startTime !== undefined && scene.endTime !== undefined
      ? Math.round((scene.endTime - scene.startTime) * fps)
      : Math.round(5 * fps))
  );
};

export const ChronoVideo: React.FC<ChronoVideoProps> = ({
  title,
  subtitle,
  audioUrl,
  bgmUrl,
  bgmVolume = 0.25,
  defaultLayoutMode = 'BLUR_BG',
  defaultFilterStyle = 'HISTORICAL',
  defaultTransition = 'FADE_TO_BLACK',
  enableTransitions = true,
  timeline = [],
  videoType,
  templateId,
  theme,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const effectiveTheme = getMergedTheme(templateId, theme, videoType);

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: '#000000',
        position: 'relative',
        fontFamily: effectiveTheme.fontFamily || 'system-ui, -apple-system, sans-serif',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Audio Layer 1: Primary Voiceover */}
      {audioUrl && (
        <Audio
          src={audioUrl.startsWith('http') ? audioUrl : staticFile(audioUrl)}
          volume={1.0}
        />
      )}

      {/* Audio Layer 2: Background Music with 15-frame fade-in ramp */}
      {bgmUrl && (
        <Loop durationInFrames={durationInFrames}>
          <Audio
            src={bgmUrl.startsWith('http') ? bgmUrl : staticFile(bgmUrl)}
            volume={(f) =>
              interpolate(f, [0, 15], [0, bgmVolume], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            }
          />
        </Loop>
      )}

      {/* 🎬 DYNAMIC SCENE TRANSITION SERIES (Background Media + Content Card) */}
      <TransitionSeries>
        {timeline.map((scene, index) => {
          const sceneDurationInFrames = getSceneDurationInFrames(scene, fps);
          const effectiveScene = {
            ...scene,
            layoutMode: scene.layoutMode || defaultLayoutMode,
            filterStyle: scene.filterStyle || defaultFilterStyle,
          };

          const effectiveTransition = scene.transition !== undefined ? scene.transition : defaultTransition;
          const transitionDuration = scene.transitionDurationFrames || 15;
          const hasTransition =
            enableTransitions &&
            effectiveTransition &&
            effectiveTransition !== 'NONE' &&
            index < timeline.length - 1;

          return (
            <React.Fragment key={`scene-${scene.id || index}`}>
              <TransitionSeries.Sequence durationInFrames={sceneDurationInFrames}>
                <AbsoluteFill style={{ overflow: 'hidden' }}>
                  {/* Layer 1: Background Media */}
                  <HistoryBackground
                    scene={effectiveScene}
                    durationInFrames={sceneDurationInFrames}
                    index={index}
                    theme={effectiveTheme}
                  />

                  {/* Layer 2: Foreground UI Content Card */}
                  <HistoryForeground
                    scene={effectiveScene}
                    durationInFrames={sceneDurationInFrames}
                    index={index}
                    theme={effectiveTheme}
                  />

                  {/* Layer 3: Persistent Overlay (Top Header & Bottom Subtitle) */}
                  {(() => {
                    const shouldHideSubtitle =
                      effectiveScene.layoutMode === 'OUTRO_CARD' ||
                      effectiveScene.layoutMode === 'SPONSOR_UI' ||
                      effectiveScene.hideSubtitle === true;

                    const shouldHideHeader =
                      effectiveScene.layoutMode === 'OUTRO_CARD' ||
                      effectiveScene.hideHeader === true;

                    return (
                      <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 100 }}>
                        {!shouldHideHeader && (
                          <DocumentaryHeader
                            seriesTitle={scene.overlayData?.seriesTitle || title || subtitle}
                            chapterTitle={scene.overlayData?.chapterNumber ? `PHẦN ${scene.overlayData.chapterNumber}` : scene.overlayData?.title}
                            theme={effectiveTheme}
                          />
                        )}
                        {!shouldHideSubtitle && (
                          <DocumentarySubtitle
                            text={scene.text || ''}
                            durationInFrames={sceneDurationInFrames}
                            theme={effectiveTheme}
                          />
                        )}
                      </AbsoluteFill>
                    );
                  })()}
                </AbsoluteFill>

                {/* Per-Scene Audio */}
                {scene.sceneAudioUrl && (
                  <Audio
                    src={
                      scene.sceneAudioUrl.startsWith('http')
                        ? scene.sceneAudioUrl
                        : staticFile(scene.sceneAudioUrl)
                    }
                    volume={1.0}
                  />
                )}
                {scene.sfxUrl && (
                  <Audio
                    src={
                      scene.sfxUrl.startsWith('http')
                        ? scene.sfxUrl
                        : staticFile(scene.sfxUrl)
                    }
                    volume={0.85}
                  />
                )}
              </TransitionSeries.Sequence>

              {/* Dynamic Scene Transition Presentation */}
              {hasTransition && (
                <TransitionSeries.Transition
                  presentation={getTransitionPresentation(effectiveTransition)}
                  timing={linearTiming({ durationInFrames: transitionDuration })}
                />
              )}
            </React.Fragment>
          );
        })}
      </TransitionSeries>
    </div>
  );
};

