"use client";

import React, { useRef } from "react";

export interface SubtitleWord {
  word: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface SubtitleSegment {
  text: string;
  startMs: number;
  endMs: number;
  words?: SubtitleWord[];
}

export interface KaraokeSubtitlesProps {
  currentTimeMs: number;
  subtitles: SubtitleSegment[];
  isVisible?: boolean;
  className?: string;
}

// 400ms hold grace period between consecutive subtitle segments to prevent jitter/flicker
const SILENCE_HOLD_GRACE_MS = 400;

export function KaraokeSubtitles({
  currentTimeMs,
  subtitles,
  isVisible = true,
  className = "",
}: KaraokeSubtitlesProps) {
  const lastActiveRef = useRef<{ segment: SubtitleSegment; holdUntilMs: number } | null>(null);

  if (!isVisible || subtitles.length === 0) return null;

  // 1. Find direct active subtitle segment
  const activeSegment = subtitles.find(
    (seg) => currentTimeMs >= seg.startMs && currentTimeMs <= seg.endMs
  );

  let displayedSegment: SubtitleSegment | null = null;
  let isHoldingSilence = false;

  if (activeSegment) {
    displayedSegment = activeSegment;
    lastActiveRef.current = {
      segment: activeSegment,
      holdUntilMs: activeSegment.endMs + SILENCE_HOLD_GRACE_MS,
    };
  } else if (
    lastActiveRef.current &&
    currentTimeMs > lastActiveRef.current.segment.endMs &&
    currentTimeMs <= lastActiveRef.current.holdUntilMs
  ) {
    // Keep displaying previous sentence during short inter-sentence pauses
    displayedSegment = lastActiveRef.current.segment;
    isHoldingSilence = true;
  }

  if (!displayedSegment) return null;

  return (
    <div
      className={`absolute bottom-20 sm:bottom-24 inset-x-4 flex justify-center pointer-events-none z-30 transition-all duration-200 ${
        isHoldingSilence ? "opacity-75 scale-[0.99]" : "opacity-100 scale-100"
      } ${className}`}
      aria-live="off"
    >
      <div className="bg-black/80 backdrop-blur-md px-5 py-2.5 rounded-xl border border-primary/30 shadow-2xl max-w-2xl text-center ring-1 ring-gold-300/10">
        {displayedSegment.words && displayedSegment.words.length > 0 ? (
          <p className="text-sm sm:text-base md:text-lg font-body font-semibold leading-relaxed flex flex-wrap justify-center gap-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            {displayedSegment.words.map((w, idx) => {
              const isSpoken =
                currentTimeMs >= w.startMs && currentTimeMs <= w.endMs;
              const hasPassed = currentTimeMs > w.endMs;

              return (
                <span
                  key={idx}
                  className={`transition-all duration-100 ${
                    isSpoken
                      ? "text-[#F3E5AB] scale-105 drop-shadow-[0_0_12px_rgba(212,175,55,0.9)] font-bold underline decoration-primary decoration-2"
                      : hasPassed
                      ? "text-text-primary opacity-90"
                      : "text-text-muted opacity-50"
                  }`}
                >
                  {w.word}
                </span>
              );
            })}
          </p>
        ) : (
          <p className="text-sm sm:text-base md:text-lg font-body font-bold text-gold-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            {displayedSegment.text}
          </p>
        )}
      </div>
    </div>
  );
}
