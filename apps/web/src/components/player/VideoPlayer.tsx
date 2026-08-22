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
  videoUrl,
  projectId = "proj_bach_dang_1288",
  projectTitle = "Chiến Thắng Bạch Đằng Năm 1288",
  subtitles,
  attributions,
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

  // Dynamic project hydration states
  const [effectiveVideoUrl, setEffectiveVideoUrl] = useState(
    videoUrl || `/api/v1/projects/${projectId}/video`
  );
  const [effectiveTitle, setEffectiveTitle] = useState(projectTitle);
  const [dynamicSubtitles, setDynamicSubtitles] = useState<SubtitleSegment[]>(
    subtitles || [
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
    ]
  );
  const [dynamicAttributions, setDynamicAttributions] = useState<MediaAttribution[]>(
    attributions || [
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
    ]
  );
  const [videoStatus, setVideoStatus] = useState<"READY" | "PROCESSING">("READY");

  // Hydrate project manifest dynamically when projectId changes
  useEffect(() => {
    if (!projectId) return;

    let isCancelled = false;
    fetch(`/api/v1/projects/${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isCancelled || !data) return;

        if (data.metadata?.topic || data.metadata?.title) {
          setEffectiveTitle(data.metadata.topic || data.metadata.title);
        }

        if (data.videoUrl) {
          setEffectiveVideoUrl(data.videoUrl);
          setVideoStatus("READY");
        } else if (data.status && data.status !== "COMPLETED") {
          setVideoStatus("PROCESSING");
        }

        // Hydrate subtitles from timeline schema if not provided via props
        if (!subtitles && data.schema?.timeline && Array.isArray(data.schema.timeline)) {
          let elapsedMs = 0;
          const parsedSubs: SubtitleSegment[] = [];
          const parsedAttrs: MediaAttribution[] = [];

          for (const scene of data.schema.timeline) {
            const sceneDurMs = Math.round(
              (scene.audioDurationSeconds || scene.targetDurationSeconds || 5) * 1000
            );
            const startMs = elapsedMs;
            const endMs = elapsedMs + sceneDurMs;

            if (scene.voiceoverText) {
              parsedSubs.push({
                text: scene.voiceoverText,
                startMs,
                endMs,
                words:
                  scene.wordTimestamps?.map((w: any) => ({
                    word: w.word,
                    startMs: startMs + (w.startMs || 0),
                    endMs: startMs + (w.endMs || 250),
                  })) || [],
              });
            }

            if (scene.selectedAsset) {
              parsedAttrs.push({
                id: scene.selectedAsset.candidateId || scene.sceneId || `attr_${parsedAttrs.length + 1}`,
                title: scene.selectedAsset.title || scene.voiceoverText?.slice(0, 45) || "Tư liệu sử liệu",
                sourceType: scene.selectedAsset.sourceType || "HISTORICAL_IMAGE",
                license: scene.selectedAsset.license || "PUBLIC_DOMAIN",
                institution:
                  scene.selectedAsset.institution ||
                  scene.selectedAsset.author ||
                  "Kho Tư Liệu ChronoViet",
              });
            }

            elapsedMs = endMs;
          }

          if (parsedSubs.length > 0) setDynamicSubtitles(parsedSubs);
          if (parsedAttrs.length > 0) setDynamicAttributions(parsedAttrs);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [projectId, subtitles, attributions]);

  // Time & Duration updater with resilience against NaN and Infinity
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      if (Number.isFinite(cur) && !Number.isNaN(cur) && cur >= 0) {
        setCurrentTime(cur);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const rawDuration = videoRef.current.duration;
      if (Number.isFinite(rawDuration) && !Number.isNaN(rawDuration) && rawDuration > 0) {
        setDuration(rawDuration);
      } else {
        setDuration(180);
      }
    }
  };

  const isPlayingRef = useRef(isPlaying);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlayingRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback: mute and play
        if (videoRef.current) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.play();
        }
      });
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMutedRef.current;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (Number.isFinite(time) && videoRef.current) {
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

  // Keyboard Shortcuts Listener (bound once on mount)
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
  }, []);

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || Number.isNaN(secs) || secs < 0) {
      return "0:00";
    }
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (videoStatus === "PROCESSING") {
    return (
      <div
        className={`w-full aspect-video bg-lacquer-surface border border-primary/25 rounded-2xl flex flex-col items-center justify-center p-6 text-center shadow-xl ${className}`}
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6 text-primary animate-spin" />
        </div>
        <h4 className="text-sm font-headline font-bold text-gold-300">
          Đang Chuẩn Bị Kết Xuất Thước Phim Lịch Sử...
        </h4>
        <p className="text-xs text-text-muted mt-1.5 max-w-sm leading-relaxed">
          {effectiveTitle} đang được chuỗi Multi-Agent tự động xử lý kịch bản, âm thanh và kết xuất Remotion.
        </p>
      </div>
    );
  }

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
          src={effectiveVideoUrl}
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
          subtitles={dynamicSubtitles}
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
              {effectiveTitle}
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
              href={effectiveVideoUrl}
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
        attributions={dynamicAttributions}
        isOpen={isAttributionOpen}
        onClose={() => setIsAttributionOpen(false)}
      />
    </div>
  );
}
