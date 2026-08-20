import { describe, it, expect } from 'vitest';
import { CANVAS_DIMENSIONS, DEFAULT_FPS } from '../constants/config';
import { ChronoVideoProps, TimelineScene } from '../types';

export function calculateTimelineDurationFrames(props: Partial<ChronoVideoProps>): number {
  const fps = props.fps || DEFAULT_FPS;
  const defaultTransition = props.defaultTransition || 'FADE_TO_BLACK';
  const enableTransitions = props.enableTransitions ?? true;
  const timeline = props.timeline || [];

  let totalFrames = 0;
  timeline.forEach((scene, index) => {
    let sceneDuration = scene.durationInFrames;
    if (sceneDuration === undefined && scene.durationInSeconds !== undefined) {
      sceneDuration = Math.round(scene.durationInSeconds * fps);
    }
    if (sceneDuration === undefined) {
      if (scene.captions && scene.captions.length > 0) {
        const maxCaptionEndFrame = Math.max(...scene.captions.map((c) => c.endFrame));
        sceneDuration = Math.max(maxCaptionEndFrame + 15, Math.round(3 * fps));
      } else if (scene.startTime !== undefined && scene.endTime !== undefined) {
        const computed = Math.round((scene.endTime - scene.startTime) * fps);
        sceneDuration = computed > 0 ? computed : Math.round(5 * fps);
      } else {
        sceneDuration = Math.round(5 * fps);
      }
    }

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

  return Math.max(1, totalFrames);
}

describe('timing and duration calculations', () => {
  it('returns 1 frame minimum for empty timeline', () => {
    const duration = calculateTimelineDurationFrames({ timeline: [] });
    expect(duration).toBe(1);
  });

  it('calculates duration correctly with durationInFrames and transitions deducted', () => {
    const scenes: TimelineScene[] = [
      { id: 's1', durationInFrames: 150, transition: 'FADE_TO_BLACK', transitionDurationFrames: 15 },
      { id: 's2', durationInFrames: 150, transition: 'FADE_TO_BLACK', transitionDurationFrames: 15 },
      { id: 's3', durationInFrames: 150, transition: 'NONE' },
    ];

    // Total: 150 + 150 + 150 - 15 (s1->s2) - 15 (s2->s3) = 420 frames
    const duration = calculateTimelineDurationFrames({ timeline: scenes });
    expect(duration).toBe(420);
  });

  it('does not deduct transition overlap if enableTransitions is false', () => {
    const scenes: TimelineScene[] = [
      { id: 's1', durationInFrames: 150, transition: 'FADE_TO_BLACK', transitionDurationFrames: 15 },
      { id: 's2', durationInFrames: 150, transition: 'FADE_TO_BLACK', transitionDurationFrames: 15 },
    ];

    // Total without transition deduction: 150 + 150 = 300
    const duration = calculateTimelineDurationFrames({
      timeline: scenes,
      enableTransitions: false,
    });
    expect(duration).toBe(300);
  });

  it('converts durationInSeconds to frames based on fps', () => {
    const scenes: TimelineScene[] = [
      { id: 's1', durationInSeconds: 5, transition: 'NONE' },
      { id: 's2', durationInSeconds: 3, transition: 'NONE' },
    ];

    // 5s * 30fps + 3s * 30fps = 150 + 90 = 240
    const duration = calculateTimelineDurationFrames({
      fps: 30,
      timeline: scenes,
    });
    expect(duration).toBe(240);
  });

  it('computes duration from captions endFrame with safety margin', () => {
    const scenes: TimelineScene[] = [
      {
        id: 's1',
        captions: [
          { word: 'Quang', startFrame: 0, endFrame: 30 },
          { word: 'Trung', startFrame: 30, endFrame: 75 },
        ],
        transition: 'NONE',
      },
    ];

    // maxCaptionEndFrame (75) + 15 = 90
    const duration = calculateTimelineDurationFrames({ timeline: scenes });
    expect(duration).toBe(90);
  });

  it('verifies standard canvas dimensions for aspect ratios', () => {
    expect(CANVAS_DIMENSIONS['16:9']).toEqual({ width: 1920, height: 1080 });
    expect(CANVAS_DIMENSIONS['9:16']).toEqual({ width: 1080, height: 1920 });
    expect(CANVAS_DIMENSIONS['1:1']).toEqual({ width: 1080, height: 1080 });
  });
});
