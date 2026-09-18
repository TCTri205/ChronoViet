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
  ScrollText,
  Sparkles,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubtitleSegment } from "./KaraokeSubtitles";
import { AttributionDrawer, MediaAttribution } from "./AttributionDrawer";
import { TranscriptDrawer, TranscriptScene } from "./TranscriptDrawer";

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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAttributionOpen, setIsAttributionOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [hasVideoError, setHasVideoError] = useState(false);

  // Dynamic project hydration states
  const [effectiveVideoUrl, setEffectiveVideoUrl] = useState(
    videoUrl || `/api/v1/projects/${projectId}/video`
  );
  const [effectiveTitle, setEffectiveTitle] = useState(projectTitle);
  const [effectiveAspectRatio, setEffectiveAspectRatio] = useState<"16:9" | "9:16">(aspectRatio);
  const [dynamicTranscript, setDynamicTranscript] = useState<TranscriptScene[]>([
    {
      sceneId: "scene_default_01",
      chapterIndex: 0,
      chapterTitle: "Hồi 1: Khí Thiêng Sông Bạch Đằng",
      startMs: 0,
      endMs: 4000,
      text: "Vạn Kiếp sấm vang, sông Bạch Đằng cuộn sóng... Hơn một nghìn năm lịch sử oai hùng của dân tộc Việt Nam ngời sáng nơi cửa biển linh thiêng.",
      layoutMode: "ARTICLE_UI",
    },
    {
      sceneId: "scene_default_02",
      chapterIndex: 0,
      chapterTitle: "Hồi 1: Khí Thiêng Sông Bạch Đằng",
      startMs: 4000,
      endMs: 8500,
      text: "Dưới sự lãnh đạo thiên tài của Quốc Công Tiết Chế Hưng Đạo Đại Vương Trần Quốc Tuấn, quân dân Đại Việt đã lập nên chiến tích lẫy lừng năm 1288.",
      layoutMode: "STAT_CARD",
    },
    {
      sceneId: "scene_default_03",
      chapterIndex: 1,
      chapterTitle: "Hồi 2: Trận Đồ Cọc Gỗ Thần Tốc",
      startMs: 8500,
      endMs: 14000,
      text: "Lợi dụng quy luật thủy triều, hàng vạn cọc gỗ bịt sắt nhọn được cắm ngầm xuống lòng sông, tạo nên chiếc bẫy rồng vĩ đại nhấn chìm chiến thuyền Ô Mã Nhi.",
      layoutMode: "BLUR_BG",
    },
    {
      sceneId: "scene_default_04",
      chapterIndex: 2,
      chapterTitle: "Hồi 3: Khải Hoàn Đại Thắng",
      startMs: 14000,
      endMs: 20000,
      text: "Sông Bạch Đằng nghìn thu lưu danh sử sách, khẳng định nền độc lập, tự chủ và ý chí quật cường vạn đại của non sông Việt Nam.",
      layoutMode: "OUTRO_CARD",
    },
  ]);
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

  // Keep aspectRatio state in sync if prop changes
  useEffect(() => {
    if (aspectRatio) {
      setEffectiveAspectRatio(aspectRatio);
    }
  }, [aspectRatio]);

  // Keep videoUrl in sync if prop changes
  useEffect(() => {
    if (videoUrl) {
      setEffectiveVideoUrl(videoUrl);
    }
  }, [videoUrl]);

  // Two-way synchronization with document fullscreen state (solves Esc key trap)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = document.fullscreenElement === containerRef.current;
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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

        if (data.metadata?.aspectRatio || data.aspectRatio) {
          setEffectiveAspectRatio(data.metadata?.aspectRatio || data.aspectRatio);
        }

        if (data.videoUrl) {
          setEffectiveVideoUrl(data.videoUrl);
          setVideoStatus("READY");
        } else if (data.status && data.status !== "COMPLETED") {
          setVideoStatus("PROCESSING");
        }

        // Hydrate subtitles and transcript from timeline schema
        if (data.schema?.timeline && Array.isArray(data.schema.timeline)) {
          let elapsedMs = 0;
          const parsedAttrs: MediaAttribution[] = [];
          const parsedTranscript: TranscriptScene[] = [];

          for (let sIdx = 0; sIdx < data.schema.timeline.length; sIdx++) {
            const scene = data.schema.timeline[sIdx];
            const fps = data.schema?.fps || 30;
            const hasDirectTime = typeof scene.startTime === "number" && typeof scene.endTime === "number";
            const startMs = hasDirectTime ? Math.round(scene.startTime * 1000) : elapsedMs;
            const sceneDurMs = hasDirectTime
              ? Math.max(1000, Math.round((scene.endTime - scene.startTime) * 1000))
              : Math.round(
                  (scene.durationInFrames
                    ? scene.durationInFrames / fps
                    : (scene.audioDurationSeconds || scene.targetDurationSeconds || 5)) * 1000
                );
            const endMs = startMs + sceneDurMs;
            const vText = scene.voiceoverText || scene.text || "";

            if (vText) {
              const chIdx = scene.chapterIndex ?? Math.floor(sIdx / 5);
              const chTitle =
                scene.overlayData?.title ||
                data.schema?.chapters?.[chIdx]?.title ||
                `Hồi ${chIdx + 1}`;

              parsedTranscript.push({
                sceneId: scene.id || scene.sceneId || `scene_${sIdx + 1}`,
                chapterIndex: chIdx,
                chapterTitle: chTitle,
                startMs,
                endMs,
                text: vText,
                layoutMode: scene.layoutMode,
              });
            }

            if (!attributions && scene.selectedAsset) {
              parsedAttrs.push({
                id: scene.selectedAsset.candidateId || scene.sceneId || `attr_${parsedAttrs.length + 1}`,
                title: scene.selectedAsset.title || vText.slice(0, 45) || "Tư liệu sử liệu",
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

          if (parsedTranscript.length > 0) setDynamicTranscript(parsedTranscript);
          if (!attributions && parsedAttrs.length > 0) setDynamicAttributions(parsedAttrs);
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
          videoRef.current.play().catch(() => {});
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

  const handleSeekToMs = (ms: number) => {
    const timeSec = ms / 1000;
    if (videoRef.current && Number.isFinite(timeSec)) {
      videoRef.current.currentTime = timeSec;
      setCurrentTime(timeSec);
    }
  };

  const speeds = [1, 1.25, 1.5, 2];
  const cyclePlaybackSpeed = () => {
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {
        // Fallback for browsers with restricted requestFullscreen
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen?.().catch(() => {
        setIsFullscreen(false);
      });
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

  const isPortrait = effectiveAspectRatio === "9:16";

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center bg-black/95 rounded-2xl overflow-hidden border border-primary/30 shadow-2xl group select-none ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none bg-[#040405] h-screen w-screen" : ""
      } ${className}`}
    >
      {/* Video Canvas */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden py-2">
        {/* 9:16 Portrait Mockup Container */}
        {isPortrait ? (
          <div className="relative h-full max-h-[70vh] aspect-[9/16] rounded-2xl overflow-hidden border-2 border-primary/40 shadow-[0_0_30px_rgba(212,175,55,0.15)] bg-lacquer-surface flex items-center justify-center">
            <video
              ref={videoRef}
              src={effectiveVideoUrl}
              playsInline
              // @ts-ignore
              webkit-playsinline="true"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onError={() => setHasVideoError(true)}
              onClick={togglePlay}
              className="w-full h-full object-cover cursor-pointer"
            />

            {/* Play Button Overlay */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute z-20 w-14 h-14 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-2xl shadow-gold-glow hover:scale-110 transition-all cursor-pointer border-2 border-gold-300"
                aria-label="Phát video"
              >
                <Play className="w-6 h-6 fill-current ml-1" />
              </button>
            )}
          </div>
        ) : (
          /* 16:9 Landscape Canvas */
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={effectiveVideoUrl}
              playsInline
              // @ts-ignore
              webkit-playsinline="true"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onError={() => setHasVideoError(true)}
              onClick={togglePlay}
              className="w-full max-h-[68vh] object-contain cursor-pointer"
            />

            {/* Play Button Overlay */}
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
        )}

        {/* Video Error Fallback Overlay */}
        {hasVideoError && (
          <div className="absolute inset-0 z-40 bg-lacquer-surface/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in-50">
            <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h4 className="text-sm font-headline font-bold text-gold-300">
              Đang Chuẩn Bị Tệp Video
            </h4>
            <p className="text-xs text-text-muted mt-1.5 max-w-xs leading-relaxed">
              Tệp video đang được hệ thống hoàn thiện hoặc mạng tải chậm.
            </p>
            <Button
              onClick={() => {
                setHasVideoError(false);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              variant="outline"
              size="sm"
              className="mt-4 border-primary/30 text-gold-300 hover:bg-primary/20 gap-1.5 text-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Thử nạp lại</span>
            </Button>
          </div>
        )}
      </div>

      {/* Control Bar Overlay */}
      <div className="w-full bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 flex flex-col gap-2 z-30 transition-opacity shrink-0">
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

          {/* Right: CC, Transcript, Attributions, Speed, Download, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              onClick={() => setIsTranscriptOpen(true)}
              variant="ghost"
              size="sm"
              className={`h-8 text-xs gap-1 cursor-pointer transition-colors ${
                isTranscriptOpen
                  ? "text-gold-300 bg-primary/20 border border-primary/30"
                  : "text-text-secondary hover:text-gold-300 hover:bg-primary/10"
              }`}
              aria-label="Xem toàn bộ kịch bản thuyết minh"
              title="Xem toàn bộ kịch bản (Transcript)"
            >
              <ScrollText className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline font-medium">Kịch bản</span>
            </Button>

            <Button
              onClick={() => setIsAttributionOpen(true)}
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1 text-text-secondary hover:text-gold-300 cursor-pointer"
              aria-label="Xem kê khai bản quyền tư liệu"
              title="Kê khai bản quyền tư liệu"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tư liệu</span>
            </Button>

            <button
              type="button"
              onClick={cyclePlaybackSpeed}
              className="h-8 px-2 rounded-md text-xs font-mono text-text-secondary hover:text-gold-300 hover:bg-primary/10 transition-colors border border-primary/15 cursor-pointer"
              title="Thay đổi tốc độ phát (1x / 1.25x / 1.5x / 2x)"
              aria-label={`Tốc độ phát hiện tại: ${playbackSpeed}x. Bấm để thay đổi.`}
            >
              {playbackSpeed}x
            </button>

            <a
              href={effectiveVideoUrl}
              download={`${projectId || "video"}.mp4`}
              className="inline-flex items-center justify-center h-8 px-2.5 sm:px-3 rounded-md text-xs font-medium bg-primary/10 hover:bg-primary/20 text-gold-300 border border-primary/20 gap-1.5 transition-colors"
              aria-label="Tải video 1080p về máy"
              title="Tải video MP4 chất lượng cao"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tải MP4</span>
            </a>

            <Button
              onClick={toggleFullscreen}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-secondary hover:text-gold-300 cursor-pointer"
              aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình (Cinema Mode)"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Full Transcript Drawer */}
      <TranscriptDrawer
        isOpen={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
        projectTitle={effectiveTitle}
        scenes={dynamicTranscript}
        currentTimeMs={currentTime * 1000}
        onSeekToMs={handleSeekToMs}
      />

      {/* Attribution Drawer */}
      <AttributionDrawer
        attributions={dynamicAttributions}
        isOpen={isAttributionOpen}
        onClose={() => setIsAttributionOpen(false)}
      />
    </div>
  );
}
