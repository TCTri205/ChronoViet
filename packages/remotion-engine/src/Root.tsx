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

interface CompositionDef {
  id: string;
  defaultProps: ChronoVideoProps;
  durationInFrames: number;
  width?: number;
  height?: number;
}

const COMPOSITION_DEFS: CompositionDef[] = [
  { id: 'ChronoVideo', defaultProps: templateGeneralTimeline as unknown as ChronoVideoProps, durationInFrames: 4500 },
  { id: 'BiographyVideo', defaultProps: biographyTimeline as unknown as ChronoVideoProps, durationInFrames: 12150 },
  { id: 'BattleVideo', defaultProps: battleTimeline as unknown as ChronoVideoProps, durationInFrames: 12150 },
  { id: 'DynastyVideo', defaultProps: dynastyTimeline as unknown as ChronoVideoProps, durationInFrames: 12150 },
  { id: 'MysteryVideo', defaultProps: mysteryTimeline as unknown as ChronoVideoProps, durationInFrames: 11250 },
  { id: 'ArtifactVideo', defaultProps: artifactTimeline as unknown as ChronoVideoProps, durationInFrames: 11250 },
  {
    id: 'QuickShortsVideo',
    defaultProps: { ...(templateGeneralTimeline as unknown as ChronoVideoProps), templateId: 'QUICK_SHORTS', aspectRatio: '9:16' },
    durationInFrames: 4350,
    width: 1080,
    height: 1920,
  },
  {
    id: 'ModernNewsVideo',
    defaultProps: { ...(templateGeneralTimeline as unknown as ChronoVideoProps), templateId: 'MODERN_NEWS', aspectRatio: '16:9' },
    durationInFrames: 4350,
  },
  { id: 'QuangTrungVideo', defaultProps: quangTrungTimeline as unknown as ChronoVideoProps, durationInFrames: 7350 },
  { id: 'MongolViet2Video', defaultProps: mongolViet2Timeline as unknown as ChronoVideoProps, durationInFrames: 34200 },
  { id: 'HaiBaTrungVideo', defaultProps: haiBaTrungTimeline as unknown as ChronoVideoProps, durationInFrames: 13500 },
];

export const RemotionRoot: React.FC = () => {
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
      {COMPOSITION_DEFS.map((comp) => (
        <Composition
          key={comp.id}
          id={comp.id}
          component={ChronoVideo as React.ComponentType<any>}
          durationInFrames={comp.durationInFrames}
          fps={DEFAULT_FPS}
          width={comp.width || 1920}
          height={comp.height || 1080}
          defaultProps={comp.defaultProps}
          calculateMetadata={calculateMetadataHelper}
        />
      ))}
    </>
  );
};
