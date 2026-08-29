/**
 * Dynamic Audio Ducking Envelope Interpolator for Remotion Engine
 * 
 * Auto-ducks Background Music (BGM) to -12dB (~25.1% of nominal volume)
 * whenever speech/voiceover is active, with smooth 15-frame cross-fade transitions.
 */

export interface SpeechInterval {
  start: number; // in frames
  end: number;   // in frames
}

/**
 * -12 dB attenuation factor: 10^(-12 / 20) ≈ 0.25118864
 */
export const DUCKING_FACTOR_12DB = 0.25118864;

/**
 * Computes instantaneous BGM volume at frame `f` considering speech ducking and fade transitions.
 */
export function computeDuckedBgmVolume(
  f: number,
  baseVolume: number,
  intervals: SpeechInterval[],
  totalDurationFrames: number,
  fadeFrames = 15
): number {
  if (baseVolume <= 0) return 0;

  // 1. Initial fade-in ramp (0 to 15 frames)
  let initialFade = 1.0;
  if (f < fadeFrames) {
    initialFade = Math.max(0, f / fadeFrames);
  }

  // 2. Final fade-out ramp (last 15 frames)
  let finalFade = 1.0;
  if (f > totalDurationFrames - fadeFrames) {
    finalFade = Math.max(0, (totalDurationFrames - f) / fadeFrames);
  }

  // 3. Dynamic Speech Ducking
  const duckedVolume = baseVolume * DUCKING_FACTOR_12DB;

  if (!intervals || intervals.length === 0) {
    return baseVolume * initialFade * finalFade;
  }

  // Find if inside or distance to speech interval
  let isInsideSpeech = false;
  let minDistanceToSpeech = Infinity;

  for (const interval of intervals) {
    const paddedStart = Math.max(0, interval.start - 5);
    const paddedEnd = interval.end + 5;

    if (f >= paddedStart && f <= paddedEnd) {
      isInsideSpeech = true;
      break;
    }

    if (f < paddedStart) {
      minDistanceToSpeech = Math.min(minDistanceToSpeech, paddedStart - f);
    } else if (f > paddedEnd) {
      minDistanceToSpeech = Math.min(minDistanceToSpeech, f - paddedEnd);
    }
  }

  let effectiveVolume: number;
  if (isInsideSpeech) {
    effectiveVolume = duckedVolume;
  } else if (minDistanceToSpeech <= fadeFrames) {
    // Smooth cosine or linear cross-fade ramp between duckedVolume and baseVolume
    const progress = minDistanceToSpeech / fadeFrames;
    effectiveVolume = duckedVolume + (baseVolume - duckedVolume) * progress;
  } else {
    effectiveVolume = baseVolume;
  }

  return effectiveVolume * initialFade * finalFade;
}
