import React from 'react';
import { AbsoluteFill, Audio, interpolate, Loop, staticFile, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
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

const transitionPresentationCache = new Map<string, any>();

const getTransitionPresentation = (type?: TransitionType): any => {
  const cacheKey = type || 'DEFAULT';
  if (transitionPresentationCache.has(cacheKey)) {
    return transitionPresentationCache.get(cacheKey);
  }

  let presentation: any;

  switch (type) {
    case 'FADE_TO_BLACK':
    case 'FADE':
    case 'DISSOLVE':
      presentation = fade();
      break;
    case 'SLIDE_LEFT':
      presentation = slide({ direction: 'from-right' });
      break;
    case 'SLIDE_RIGHT':
      presentation = slide({ direction: 'from-left' });
      break;
    case 'SLIDE_UP':
      presentation = slide({ direction: 'from-bottom' });
      break;
    case 'SLIDE_DOWN':
      presentation = slide({ direction: 'from-top' });
      break;
    case 'WIPE':
      presentation = wipe({ direction: 'from-left' });
      break;
    case 'FLIP':
      presentation = flip({});
      break;
    case 'CLOCK_WIPE':
    case 'CROSS_ZOOM':
      presentation = clockWipe({ width: 1920, height: 1080 });
      break;
    case 'FILM_BURN':
    case 'LIGHT_LEAK':
      presentation = wipe({ direction: 'from-top-left' });
      break;
    case 'GLITCH':
      presentation = slide({ direction: 'from-right' });
      break;
    case 'ZOOM_IN':
    case 'ZOOM_OUT':
    case 'ZOOM_DREAMY':
      presentation = flip({});
      break;
    case 'LINEAR_BLUR':
      presentation = slide({ direction: 'from-bottom' });
      break;
    case 'NONE':
      presentation = null;
      break;
    default:
      presentation = fade();
      break;
  }

  transitionPresentationCache.set(cacheKey, presentation);
  return presentation;
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
                            seriesTitle={scene.overlayData?.seriesTitle || 'CHRONOVIET DOCUMENTARY'}
                            chapterTitle={
                              scene.overlayData?.chapterNumber
                                ? `PHẦN ${scene.overlayData.chapterNumber}${scene.overlayData?.title ? ` • ${scene.overlayData.title}` : ''}`
                                : scene.overlayData?.title
                            }
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

