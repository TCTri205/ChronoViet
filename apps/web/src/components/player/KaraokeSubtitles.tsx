"use client";

import React from "react";

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

export function KaraokeSubtitles({
  currentTimeMs,
  subtitles,
  isVisible = true,
  className = "",
}: KaraokeSubtitlesProps) {
  if (!isVisible || subtitles.length === 0) return null;

  // Find active subtitle segment
  const activeSegment = subtitles.find(
    (seg) => currentTimeMs >= seg.startMs && currentTimeMs <= seg.endMs
  );

  if (!activeSegment) return null;

  return (
    <div
      className={`absolute bottom-16 inset-x-4 flex justify-center pointer-events-none z-30 transition-opacity duration-200 ${className}`}
    >
      <div className="bg-black/75 backdrop-blur-md px-6 py-2.5 rounded-xl border border-primary/25 shadow-2xl max-w-2xl text-center">
        {activeSegment.words && activeSegment.words.length > 0 ? (
          <p className="text-base sm:text-lg font-headline font-semibold leading-relaxed flex flex-wrap justify-center gap-1.5">
            {activeSegment.words.map((w, idx) => {
              const isSpoken =
                currentTimeMs >= w.startMs && currentTimeMs <= w.endMs;
              const hasPassed = currentTimeMs > w.endMs;

              return (
                <span
                  key={idx}
                  className={`transition-all duration-150 ${
                    isSpoken
                      ? "text-[#F3E5AB] scale-110 drop-shadow-[0_0_12px_rgba(212,175,55,0.8)] font-bold underline decoration-primary decoration-2"
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
          <p className="text-base sm:text-lg font-headline font-semibold text-gold-300 drop-shadow-md">
            {activeSegment.text}
          </p>
        )}
      </div>
    </div>
  );
}
