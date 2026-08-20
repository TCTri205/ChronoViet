import React from 'react';
import { AbsoluteFill, Audio, interpolate, Loop, Sequence, staticFile, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { ChronoVideoProps, TimelineScene, TransitionType, isPureImageLayout } from '../types';
import { HistoryBackground, HistoryForeground } from './HistorySlide';
import { DocumentaryHeader } from '../components/DocumentaryHeader';
import { DocumentarySubtitle } from '../components/DocumentarySubtitle';
import { getMergedTheme } from '../utils/themeUtils';

const resolveMediaUrl = (url?: string): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const clean = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  try {
    return staticFile(clean);
  } catch {
    return trimmed;
  }
};

const transitionPresentationCache = new Map<string, any>();

const getTransitionPresentation = (type?: TransitionType, width = 1920, height = 1080): any => {
  const cacheKey = `${type || 'DEFAULT'}_${width}x${height}`;
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
      presentation = clockWipe({ width, height });
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
  if (scene.durationInFrames !== undefined && scene.durationInFrames > 0) {
    return scene.durationInFrames;
  }
  if (scene.durationInSeconds !== undefined && scene.durationInSeconds > 0) {
    return Math.round(scene.durationInSeconds * fps);
  }
  if (scene.captions && scene.captions.length > 0) {
    const maxCaptionEndFrame = Math.max(...scene.captions.map((c) => c.endFrame));
    return Math.max(maxCaptionEndFrame + 15, Math.round(3 * fps));
  }
  if (scene.startTime !== undefined && scene.endTime !== undefined) {
    const computed = Math.round((scene.endTime - scene.startTime) * fps);
    return computed > 0 ? computed : Math.round(5 * fps);
  }
  return Math.round(5 * fps);
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
  captions = [],
  videoType,
  templateId,
  theme,
}) => {
  const { fps, durationInFrames, width, height } = useVideoConfig();
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
          src={resolveMediaUrl(audioUrl)}
          volume={1.0}
        />
      )}

      {/* Audio Layer 2: Background Music with 15-frame fade-in ramp */}
      {bgmUrl && (
        <Loop durationInFrames={durationInFrames}>
          <Audio
            src={resolveMediaUrl(bgmUrl)}
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

          // Determine effective layout mode with fallback support
          let effectiveLayoutMode = scene.layoutMode || defaultLayoutMode;
          const isPureImage = scene.type === 'PURE_IMAGE' || isPureImageLayout(effectiveLayoutMode);
          if (isPureImage && !scene.assetUrl && scene.fallbackLayoutMode) {
            effectiveLayoutMode = scene.fallbackLayoutMode;
          }

          const effectiveScene: TimelineScene = {
            ...scene,
            layoutMode: effectiveLayoutMode,
            filterStyle: scene.filterStyle || defaultFilterStyle,
          };

          const effectiveTransition = scene.transition !== undefined ? scene.transition : defaultTransition;
          const transitionDuration = scene.transitionDurationFrames || 15;
          const hasTransition =
            enableTransitions &&
            effectiveTransition &&
            effectiveTransition !== 'NONE' &&
            index < timeline.length - 1;

          const shouldHideSubtitle =
            effectiveScene.layoutMode === 'OUTRO_CARD' ||
            effectiveScene.layoutMode === 'SPONSOR_UI' ||
            effectiveScene.hideSubtitle === true;

          const shouldHideHeader =
            effectiveScene.layoutMode === 'OUTRO_CARD' ||
            effectiveScene.hideHeader === true;

          const attribution = scene.attribution;

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

                  {/* Layer 3: Persistent Overlay (Header, Subtitle & Attribution) */}
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
                        captions={scene.captions}
                      />
                    )}
                    {attribution && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 24,
                          right: 32,
                          backgroundColor: 'rgba(0, 0, 0, 0.65)',
                          color: '#9CA3AF',
                          fontSize: 12,
                          fontFamily: 'sans-serif',
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        📷 Nguồn: {attribution.author} {attribution.license ? `(${attribution.license})` : ''}
                      </div>
                    )}
                  </AbsoluteFill>
                </AbsoluteFill>

                {/* Per-Scene Primary Audio */}
                {scene.sceneAudioUrl && (
                  <Audio
                    src={resolveMediaUrl(scene.sceneAudioUrl)}
                    volume={1.0}
                  />
                )}
                {/* Legacy single SFX */}
                {scene.sfxUrl && (
                  <Audio
                    src={resolveMediaUrl(scene.sfxUrl)}
                    volume={0.85}
                  />
                )}
                {/* Multi-track SFX Array */}
                {scene.soundEffects &&
                  scene.soundEffects.map((sfx, sfxIdx) => (
                    <Sequence key={`sfx-${sfxIdx}`} from={sfx.offsetFrame || 0}>
                      <Audio
                        src={resolveMediaUrl(sfx.sfxUrl)}
                        volume={sfx.volume ?? 0.85}
                      />
                    </Sequence>
                  ))}
              </TransitionSeries.Sequence>

              {/* Dynamic Scene Transition Presentation */}
              {hasTransition && (
                <TransitionSeries.Transition
                  presentation={getTransitionPresentation(effectiveTransition, width, height)}
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
