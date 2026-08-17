"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  FileText,
  Subtitles,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KaraokeSubtitles, SubtitleSegment } from "./KaraokeSubtitles";
import { AttributionDrawer, MediaAttribution } from "./AttributionDrawer";

export interface VideoPlayerProps {
  videoUrl?: string;
  projectId?: string;
  projectTitle?: string;
  subtitles?: SubtitleSegment[];
  attributions?: MediaAttribution[];
  aspectRatio?: "16:9" | "9:16";
  className?: string;
}

export function VideoPlayer({
  videoUrl = "/api/v1/projects/proj_bach_dang_1288/video",
  projectId = "proj_bach_dang_1288",
  projectTitle = "Chiến Thắng Bạch Đằng Năm 1288",
  subtitles = [
    {
      text: "Vạn Kiếp sấm vang, sông Bạch Đằng cuộn sóng...",
      startMs: 0,
      endMs: 4000,
      words: [
        { word: "Vạn", startMs: 0, endMs: 500 },
        { word: "Kiếp", startMs: 500, endMs: 1000 },
        { word: "sấm", startMs: 1000, endMs: 1500 },
        { word: "vang,", startMs: 1500, endMs: 2000 },
        { word: "sông", startMs: 2000, endMs: 2500 },
        { word: "Bạch", startMs: 2500, endMs: 3000 },
        { word: "Đằng", startMs: 3000, endMs: 3500 },
        { word: "cuộn", startMs: 3500, endMs: 3800 },
        { word: "sóng...", startMs: 3800, endMs: 4000 },
      ],
    },
  ],
  attributions = [
    {
      id: "attr_1",
      title: "Tranh khắc mộc bản Trận Thủy Chiến Bạch Đằng",
      sourceType: "WOODBLOCK_SCROLL",
      license: "PUBLIC_DOMAIN",
      institution: "Viện Nghiên Cứu Hán Nôm",
    },
    {
      id: "attr_2",
      title: "Bản đồ cổ địa thế sông Bạch Đằng thế kỷ XIII",
      sourceType: "MAP_CHART",
      license: "CC0",
      institution: "Bảo Tàng Lịch Sử Quân Sự",
    },
  ],
  aspectRatio = "16:9",
  className = "",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isCcActive, setIsCcActive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAttributionOpen, setIsAttributionOpen] = useState(false);

  // Time & Duration updater
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 180);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback: mute and play
        videoRef.current!.muted = true;
        setIsMuted(true);
        videoRef.current!.play();
      });
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isMuted]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center bg-black/95 rounded-2xl overflow-hidden border border-primary/30 shadow-2xl group ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none bg-[#040405]" : ""
      } ${className}`}
    >
      {/* Video Canvas */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          // @ts-ignore
          webkit-playsinline="true"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
          className={`cursor-pointer ${
            aspectRatio === "9:16"
              ? "h-full max-w-sm object-contain"
              : "w-full max-h-[70vh] object-contain"
          }`}
        />

        {/* Karaoke Subtitles Overlay */}
        <KaraokeSubtitles
          currentTimeMs={currentTime * 1000}
          subtitles={subtitles}
          isVisible={isCcActive}
        />

        {/* Big Center Play Button when paused */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute z-20 w-16 h-16 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-2xl shadow-gold-glow hover:scale-110 transition-all cursor-pointer border-2 border-gold-300"
            aria-label="Phát video"
          >
            <Play className="w-7 h-7 fill-current ml-1" />
          </button>
        )}
      </div>

      {/* Control Bar Overlay */}
      <div className="w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 flex flex-col gap-2 z-30 transition-opacity">
        {/* Progress Timeline Slider */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-text-secondary tabular-nums">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-gold-300"
            aria-label="Tua thời gian video"
          />
          <span className="font-mono text-xs text-text-muted tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        {/* Bottom Actions Row */}
        <div className="flex items-center justify-between pt-1">
          {/* Left: Play/Pause, Mute */}
          <div className="flex items-center gap-3">
            <Button
              onClick={togglePlay}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gold-300 hover:bg-primary/20"
              aria-label={isPlaying ? "Tạm dừng video" : "Phát video"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>

            <Button
              onClick={toggleMute}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-secondary hover:text-gold-300"
              aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>

            <span className="text-xs font-headline font-semibold text-gold-300 hidden md:inline truncate max-w-xs">
              {projectTitle}
            </span>
          </div>

          {/* Right: CC, Attributions, Download, Fullscreen */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsCcActive(!isCcActive)}
              variant="ghost"
              size="sm"
              className={`h-8 text-xs gap-1 ${
                isCcActive ? "text-gold-300 bg-primary/10" : "text-text-muted"
              }`}
              aria-label="Bật/tắt phụ đề Karaoke"
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Phụ đề</span>
            </Button>

            <Button
              onClick={() => setIsAttributionOpen(true)}
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1 text-text-secondary hover:text-gold-300"
              aria-label="Xem kê khai bản quyền tư liệu"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tư liệu</span>
            </Button>

            <a
              href={videoUrl}
              download={`${projectId || "video"}.mp4`}
              className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium bg-primary/10 hover:bg-primary/20 text-gold-300 border border-primary/20 gap-1.5 transition-colors"
              aria-label="Tải video 1080p về máy"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tải MP4</span>
            </a>

            <Button
              onClick={toggleFullscreen}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-secondary hover:text-gold-300"
              aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình (Cinema Mode)"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Attribution Drawer */}
      <AttributionDrawer
        attributions={attributions}
        isOpen={isAttributionOpen}
        onClose={() => setIsAttributionOpen(false)}
      />
    </div>
  );
}
