"use client";

import React, { useState, useEffect } from "react";
import {
  Film,
  Play,
  StopCircle,
  Sparkles,
  Loader2,
  Clock,
  Monitor,
  Smartphone,
  Flame,
  BookOpen,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LiveAgentStepper } from "./LiveAgentStepper";
import { AbortDialog } from "./AbortDialog";
import { RenderProgressData } from "./RenderProgressBar";
import { toast } from "sonner";

export interface VideoGeneratorPanelProps {
  initialTopic?: string;
  initialConversationId?: string;
  onProjectCreated?: (projectId: string) => void;
  onProjectCompleted?: () => void;
  activeProjectId?: string | null;
  className?: string;
}

export function VideoGeneratorPanel({
  initialTopic = "",
  initialConversationId = "",
  onProjectCreated,
  onProjectCompleted,
  activeProjectId = null,
  className = "",
}: VideoGeneratorPanelProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [duration, setDuration] = useState("3"); // 1, 3, 5 mins
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [tone, setTone] = useState("epic");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAbortDialogOpen, setIsAbortDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("INIT");
  const [renderProgress, setRenderProgress] = useState<RenderProgressData>({
    percent: 0,
    status: "INIT",
  });

  // Sync initialTopic if updated from Chat handover
  useEffect(() => {
    if (initialTopic) {
      setTopic(initialTopic);
    }
  }, [initialTopic]);

  // Connect to SSE stream and WS if activeProjectId is set
  useEffect(() => {
    if (!activeProjectId) return;

    let sseSource: EventSource | null = null;
    let ws: WebSocket | null = null;
    let isCancelled = false;

    // Check project status before assuming active generation
    fetch(`/api/v1/projects/${activeProjectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isCancelled || !data) return;
        if (data.status === "COMPLETED" || data.videoUrl) {
          setCurrentStep("completed");
          setRenderProgress({ percent: 100, status: "COMPLETED" });
          setIsGenerating(false);
          return;
        }
        if (data.status === "FAILED" || data.status === "ABORTED") {
          setIsGenerating(false);
          return;
        }

        // If in-progress project, connect live listeners
        setIsGenerating(true);
        if (data.metadata?.topic) {
          setTopic(data.metadata.topic);
        }

        try {
          // 1. SSE Stream for Multi-Agent Stepper
          sseSource = new EventSource(`/api/v1/projects/${activeProjectId}/stream`);
          sseSource.onmessage = (event) => {
            try {
              const streamData = JSON.parse(event.data);
              if (streamData.nodeName) {
                setCurrentStep(streamData.nodeName);
              }
              if (streamData.status === "COMPLETED") {
                setCurrentStep("completed");
                setIsGenerating(false);
                toast.success("Thước phim lịch sử đã hoàn tất kết xuất!");
                onProjectCompleted?.();
                sseSource?.close();
                ws?.close();
              } else if (streamData.status === "FAILED" || streamData.status === "ABORTED") {
                setIsGenerating(false);
                sseSource?.close();
                ws?.close();
              }
            } catch {
              // ignore parsing error
            }
          };

          sseSource.onerror = () => {
            sseSource?.close();
          };

          // 2. WebSocket for Render Progress %
          const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/projects/${activeProjectId}`);
          ws.onmessage = (event) => {
            try {
              const wsData = JSON.parse(event.data);
              if (wsData.type === "RENDER_PROGRESS") {
                setRenderProgress({
                  percent: wsData.progressPercent || 0,
                  currentFrame: wsData.currentFrame,
                  totalFrames: wsData.totalFrames,
                  remainingSeconds: wsData.estimatedRemainingSec,
                  status: "RENDERING",
                });
              } else if (wsData.type === "RENDER_COMPLETED") {
                setRenderProgress({ percent: 100, status: "COMPLETED" });
                setCurrentStep("completed");
                setIsGenerating(false);
                onProjectCompleted?.();
                ws?.close();
              } else if (wsData.type === "RENDER_FAILED") {
                setIsGenerating(false);
                ws?.close();
              }
            } catch {
              // fallback
            }
          };

          ws.onerror = () => {
            ws?.close();
          };
        } catch {
          // Offline fallback
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      sseSource?.close();
      ws?.close();
    };
  }, [activeProjectId]);

  const handleStartGeneration = async () => {
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);
    setCurrentStep("research_topic");
    setRenderProgress({ percent: 5, status: "RENDERING" });

    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: topic,
          conversationId: initialConversationId || undefined,
          targetDurationMinutes: parseInt(duration, 10) || 3,
          aspectRatio,
          tone,
        }),
      });

      if (!res.ok) {
        throw new Error("Không thể khởi tạo dự án");
      }

      const data = await res.json();
      if (data.projectId) {
        toast.success("Đã kích hoạt chuỗi Multi-Agent tự động!");
        onProjectCreated?.(data.projectId);
      }
    } catch (err: any) {
      toast.error(err.message || "Không thể khởi tạo tiến trình video");
      setIsGenerating(false);
      setCurrentStep("INIT");
    }
  };

  const handleAbort = async () => {
    setIsAbortDialogOpen(false);
    setIsGenerating(false);
    setCurrentStep("INIT");
    toast.warning("Đã dừng tiến trình kết xuất phim");
    if (activeProjectId) {
      try {
        await fetch(`/api/v1/projects/${activeProjectId}/abort`, { method: "POST" });
      } catch {
        // ignore
      }
    }
  };

  return (
    <section
      className={`flex flex-col h-full bg-lacquer-deep p-4 sm:p-6 overflow-y-auto space-y-6 ${className}`}
      aria-label="Xưởng sản xuất video 1-click"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-primary/15 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-headline text-base font-bold text-gold-300">
              Xưởng Phim Tự Động (1-Click Studio)
            </h2>
            <span className="text-xs text-text-secondary">
              Zero Manual Intervention • 100% Multi-Agent AI
            </span>
          </div>
        </div>

        {isGenerating && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsAbortDialogOpen(true)}
            className="text-xs h-8 gap-1.5"
            aria-label="Dừng tiến trình tạo video"
          >
            <StopCircle className="w-3.5 h-3.5" />
            <span>Hủy tạo</span>
          </Button>
        )}
      </div>

      {/* 1-Click Form Controls */}
      <div className="space-y-4 p-5 rounded-xl bg-lacquer-surface/90 border border-primary/20 backdrop-blur-sm shadow-md">
        {/* Topic / Prompt Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Chủ Đề & Bối Cảnh Lịch Sử</span>
          </label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isGenerating}
            placeholder="Ví dụ: Chiến Thắng Bạch Đằng 1288, Khởi Nghĩa Lam Sơn..."
            className="bg-lacquer-deep text-sm h-10 border-primary/30 focus-visible:ring-primary"
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {/* Duration Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>Thời Lượng Mục Tiêu</span>
          </label>
          <ToggleGroup
            type="single"
            value={duration}
            onValueChange={(val) => val && setDuration(val)}
            disabled={isGenerating}
            className="justify-start gap-2"
          >
            <ToggleGroupItem value="1" className="flex-1 text-xs py-1.5">
              1 Phút (Tóm lược)
            </ToggleGroupItem>
            <ToggleGroupItem value="3" className="flex-1 text-xs py-1.5 font-bold">
              3 Phút (Tiêu chuẩn ★)
            </ToggleGroupItem>
            <ToggleGroupItem value="5" className="flex-1 text-xs py-1.5">
              5 Phút (Chuyên sâu)
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-primary" />
            <span>Tỷ Lệ Khung Hình</span>
          </label>
          <ToggleGroup
            type="single"
            value={aspectRatio}
            onValueChange={(val: any) => val && setAspectRatio(val)}
            disabled={isGenerating}
            className="justify-start gap-2"
          >
            <ToggleGroupItem value="16:9" className="flex-1 text-xs gap-1.5">
              <Monitor className="w-3.5 h-3.5" />
              <span>16:9 (Ngang/YouTube)</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="9:16" className="flex-1 text-xs gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              <span>9:16 (Dọc/TikTok/Shorts)</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Narration Tone Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Sắc Thái & Phong Cách Lời Bình</span>
          </label>
          <ToggleGroup
            type="single"
            value={tone}
            onValueChange={(val) => val && setTone(val)}
            disabled={isGenerating}
            className="justify-start gap-2 flex-wrap"
          >
            <ToggleGroupItem value="epic" className="flex-1 text-xs gap-1.5 min-w-[120px]">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Hào Hùng (Sử Thi)</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="academic" className="flex-1 text-xs gap-1.5 min-w-[120px]">
              <BookOpen className="w-3.5 h-3.5 text-gold-300" />
              <span>Trang Nghiêm (Chính Sử)</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="reflective" className="flex-1 text-xs gap-1.5 min-w-[120px]">
              <Waves className="w-3.5 h-3.5 text-blue-400" />
              <span>Trầm Lắng (Cảm Xúc)</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Primary 1-Click CTA */}
        <Button
          onClick={handleStartGeneration}
          disabled={!topic.trim() || isGenerating}
          variant="heritage"
          size="lg"
          className="w-full h-12 text-sm font-bold tracking-wide mt-2"
        >
          {isGenerating ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#08090B]" />
              <span>Đang Tự Động Hóa 12 Bước Multi-Agent...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#08090B]" />
              <span>TẠO THƯỚC PHIM LỊCH SỬ (TỰ ĐỘNG 1-CLICK)</span>
            </div>
          )}
        </Button>
      </div>

      {/* Live Agent Stepper */}
      <LiveAgentStepper
        currentStep={currentStep}
        renderProgress={renderProgress}
        onRetryPhase={(phaseId) => {
          toast.info(`Đang thử lại giai đoạn ${phaseId}...`);
        }}
      />

      {/* Abort Confirmation Dialog */}
      <AbortDialog
        isOpen={isAbortDialogOpen}
        onConfirmAbort={handleAbort}
        onClose={() => setIsAbortDialogOpen(false)}
      />
    </section>
  );
}
