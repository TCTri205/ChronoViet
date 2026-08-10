import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';

export type FadeToBlackProps = {
  /** Optional custom color to fade to, default #000000 */
  color?: string;
};

const FadeToBlackPresentation: React.FC<TransitionPresentationComponentProps<FadeToBlackProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const color = passedProps?.color || '#000000';

  let opacity = 1;
  if (presentationDirection === 'exiting') {
    // Progress 0.0 -> 0.5: opacity 1.0 -> 0.0
    opacity = interpolate(presentationProgress, [0, 0.5], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else {
    // Progress 0.5 -> 1.0: opacity 0.0 -> 1.0
    opacity = interpolate(presentationProgress, [0.5, 1], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: color }}>
      <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const fadeToBlack = (
  props?: FadeToBlackProps
): TransitionPresentation<FadeToBlackProps> => {
  return {
    component: FadeToBlackPresentation,
    props: props || {},
  };
};
