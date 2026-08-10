import React from 'react';
import { Composition } from 'remotion';
import { ChronoVideo } from './compositions/ChronoVideo';
import { CANVAS_DIMENSIONS, DEFAULT_FPS } from './constants/config';
import quangTrungTimeline from './data/quang-trung/quangTrungTimeline.json';
import mongolViet2Timeline from './data/mongol-viet-2/mongolViet2Timeline.json';
import haiBaTrungTimeline from './data/hai-ba-trung/haiBaTrungTimeline.json';
import biographyTimeline from './data/biographyTimeline.json';
import battleTimeline from './data/battleTimeline.json';
import dynastyTimeline from './data/dynastyTimeline.json';
import mysteryTimeline from './data/mysteryTimeline.json';
import artifactTimeline from './data/artifactTimeline.json';
import templateGeneralTimeline from './data/templateGeneralTimeline.json';
import { ChronoVideoProps, ChronoVideoSchema } from './types';

export const RemotionRoot: React.FC = () => {
  const quangTrungProps = quangTrungTimeline as unknown as ChronoVideoProps;
  const mongolViet2Props = mongolViet2Timeline as unknown as ChronoVideoProps;
  const haiBaTrungProps = haiBaTrungTimeline as unknown as ChronoVideoProps;

  const biographyProps = biographyTimeline as unknown as ChronoVideoProps;
  const battleProps = battleTimeline as unknown as ChronoVideoProps;
  const dynastyProps = dynastyTimeline as unknown as ChronoVideoProps;
  const mysteryProps = mysteryTimeline as unknown as ChronoVideoProps;
  const artifactProps = artifactTimeline as unknown as ChronoVideoProps;

  const quickShortsProps: ChronoVideoProps = {
    ...(templateGeneralTimeline as unknown as ChronoVideoProps),
    templateId: 'QUICK_SHORTS',
    aspectRatio: '9:16',
  };

  const modernNewsProps: ChronoVideoProps = {
    ...(templateGeneralTimeline as unknown as ChronoVideoProps),
    templateId: 'MODERN_NEWS',
    aspectRatio: '16:9',
  };

  const calculateMetadataHelper = async ({ props }: { props: any }) => {
    // Validate schema with Zod at runtime
    const parsedProps = ChronoVideoSchema.safeParse(props);
    const typedProps: ChronoVideoProps = parsedProps.success ? (parsedProps.data as ChronoVideoProps) : (props as ChronoVideoProps);

    const fps = typedProps.fps || DEFAULT_FPS;
    const defaultTransition = typedProps.defaultTransition || 'FADE_TO_BLACK';
    const enableTransitions = typedProps.enableTransitions ?? true;
    const timeline = typedProps.timeline || [];

    // Calculate exact duration accounting for TransitionSeries overlaps
    let totalFrames = 0;
    timeline.forEach((scene, index) => {
      const sceneDuration =
        scene.durationInFrames ??
        (scene.startTime !== undefined && scene.endTime !== undefined
          ? Math.round((scene.endTime - scene.startTime) * fps)
          : Math.round(5 * fps));

      totalFrames += sceneDuration;

      const effectiveTransition = scene.transition !== undefined ? scene.transition : defaultTransition;
      const transitionDuration = scene.transitionDurationFrames || 15;
      const hasTransition =
        enableTransitions &&
        effectiveTransition &&
        effectiveTransition !== 'NONE' &&
        index < timeline.length - 1;

      if (hasTransition) {
        totalFrames -= transitionDuration;
      }
    });

    const durationInFrames = Math.max(1, totalFrames);
    const aspectRatio = typedProps.aspectRatio || '16:9';
    const dimensions = CANVAS_DIMENSIONS[aspectRatio] || CANVAS_DIMENSIONS['16:9'];

    return {
      durationInFrames,
      fps,
      width: dimensions.width,
      height: dimensions.height,
    };
  };

  return (
    <>
      {/* 0. Primary Dynamic Engine Composition (Accepts ANY JSON via --props) */}
      <Composition
        id="ChronoVideo"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={4500}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={templateGeneralTimeline as unknown as ChronoVideoProps}
        calculateMetadata={calculateMetadataHelper}
      />

      {/* 5 Domain Compositions Spec v3.0 (5-Minute Longform Documentaries) */}

      {/* 1. Domain: BIOGRAPHY */}
      <Composition
        id="BiographyVideo"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={12150}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={biographyProps}
        calculateMetadata={calculateMetadataHelper}
      />

      {/* 2. Domain: BATTLE */}
      <Composition
        id="BattleVideo"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={12150}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={battleProps}
        calculateMetadata={calculateMetadataHelper}
      />

      {/* 3. Domain: DYNASTY */}
      <Composition
        id="DynastyVideo"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={12150}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={dynastyProps}
        calculateMetadata={calculateMetadataHelper}
      />

      {/* 4. Domain: MYSTERY */}
      <Composition
        id="MysteryVideo"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={11250}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={mysteryProps}
        calculateMetadata={calculateMetadataHelper}
      />

      {/* 5. Domain: ARTIFACT */}
      <Composition
        id="ArtifactVideo"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={11250}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={artifactProps}
        calculateMetadata={calculateMetadataHelper}
      />

      {/* 6. Template: QUICK_SHORTS (9:16 Vertical Video) */}
      <Composition
        id="QuickShortsVideo"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={4350}
        fps={DEFAULT_FPS}
        width={1080}
        height={1920}
        defaultProps={quickShortsProps}
        calculateMetadata={calculateMetadataHelper}
      />

      {/* 7. Template: MODERN_NEWS (16:9 Modern News Style) */}
      <Composition
        id="ModernNewsVideo"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={4350}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={modernNewsProps}
        calculateMetadata={calculateMetadataHelper}
      />

      {/* Legacy Video Compositions */}
      <Composition
        id="QuangTrungVideo"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={7350}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={quangTrungProps}
        calculateMetadata={calculateMetadataHelper}
      />

      <Composition
        id="MongolViet2Video"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={34200}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={mongolViet2Props}
        calculateMetadata={calculateMetadataHelper}
      />

      <Composition
        id="HaiBaTrungVideo"
        component={ChronoVideo as React.ComponentType<any>}
        durationInFrames={13500}
        fps={DEFAULT_FPS}
        width={1920}
        height={1080}
        defaultProps={haiBaTrungProps}
        calculateMetadata={calculateMetadataHelper}
      />
    </>
  );
};
