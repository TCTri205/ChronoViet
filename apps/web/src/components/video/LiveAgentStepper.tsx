"use client";

import React from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  BookOpen,
  PenTool,
  Scale,
  Mic,
  ShieldCheck,
  Film,
  AlertCircle,
} from "lucide-react";
import { RenderProgressBar, RenderProgressData } from "./RenderProgressBar";
import { PhaseErrorState } from "./PhaseErrorState";

export interface StepperPhase {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "idle" | "running" | "completed" | "error";
  details?: string;
}

export interface LiveAgentStepperProps {
  currentStep?: string; // LangGraph node name or status string
  renderProgress?: RenderProgressData;
  errorPhase?: number | null;
  errorMessage?: string;
  onRetryPhase?: (phaseId: number) => void;
  isRetrying?: boolean;
  className?: string;
}

export function LiveAgentStepper({
  currentStep = "INIT",
  renderProgress,
  errorPhase = null,
  errorMessage,
  onRetryPhase,
  isRetrying = false,
  className = "",
}: LiveAgentStepperProps) {
  // Map current step name to phase index (1 to 6)
  const getPhaseStatuses = (step: string): StepperPhase["status"][] => {
    const s = (step || "").toLowerCase().trim();
    let activeIdx = 1;

    if (s === "completed" || s === "done" || s === "rendered" || s === "finished") activeIdx = 7;
    else if (s.includes("render") || s.includes("packag") || s.includes("remotion")) activeIdx = 6;
    else if (s.includes("vlm") || s === "research" || s.includes("inspect") || s.includes("asset")) activeIdx = 5;
    else if (s.includes("tts") || s.includes("audio") || s.includes("synthesize") || s.includes("voice") || s.includes("reconcil") || s.includes("duration")) activeIdx = 4;
    else if (s.includes("fact")) activeIdx = 3;
    else if (s.includes("chapter") || s.includes("script") || s.includes("segmenter") || s.includes("keyword")) activeIdx = 2;
    else if (s.includes("rag") || s.includes("research_topic") || s === "init") activeIdx = 1;
    else activeIdx = 1;

    return [1, 2, 3, 4, 5, 6].map((phaseNum) => {
      if (errorPhase === phaseNum) return "error";
      if (phaseNum < activeIdx) return "completed";
      if (phaseNum === activeIdx) return activeIdx === 7 ? "completed" : "running";
      return "idle";
    });
  };

  const statuses = getPhaseStatuses(currentStep);

  const phases: StepperPhase[] = [
    {
      id: 1,
      title: "1. Khảo Cứu Sử Liệu GraphRAG",
      subtitle: "Truy xuất thực thể & biên niên sử Đại Việt Sử Ký",
      icon: BookOpen,
      status: statuses[0],
      details: "Trích xuất 1024d Dense Vectors & Graph CTEs",
    },
    {
      id: 2,
      title: "2. Khởi Tạo Kịch Bản 3 Hồi",
      subtitle: "Biên soạn kịch bản 5 micro-steps chuẩn điện ảnh",
      icon: PenTool,
      status: statuses[1],
      details: "Phân chia hồi kịch, lời bình & mô tả cảnh",
    },
    {
      id: 3,
      title: "3. Hội Đồng Thẩm Định Sử Liệu",
      subtitle: "Thẩm định chéo dữ kiện lịch sử (0 sai lệch)",
      icon: Scale,
      status: statuses[2],
      details: "Kiểm tra niên đại, địa danh & hòa giải số liệu",
    },
    {
      id: 4,
      title: "4. Thu Âm Thuyết Minh VieNeu",
      subtitle: "Tổng hợp giọng đọc truyền cảm & wordTimestamps",
      icon: Mic,
      status: statuses[3],
      details: "Đồng bộ phụ đề karaoke chính xác từng mili-giây",
    },
    {
      id: 5,
      title: "5. Thẩm Định Bản Quyền Tư Liệu",
      subtitle: "Kiểm tra giấy phép CC0/PD qua VLM Inspector",
      icon: ShieldCheck,
      status: statuses[4],
      details: "Lọc ảnh chuẩn di sản hoặc auto-fallback PURE_CODE",
    },
    {
      id: 6,
      title: "6. Xuất Video Remotion MP4",
      subtitle: "Render video 1080p 60fps với 31 Layout Modes",
      icon: Film,
      status: statuses[5],
      details: "Kết xuất hoàn tất sẵn sàng trình chiếu",
    },
  ];

  return (
    <div
      className={`space-y-4 p-5 rounded-xl bg-lacquer-surface/80 border border-primary/20 backdrop-blur-sm ${className}`}
      role="region"
      aria-label="Tiến trình Multi-Agent tự động"
      aria-live="polite"
    >
      <div className="flex items-center justify-between border-b border-primary/10 pb-3">
        <h3 className="font-headline text-sm font-bold text-gold-300">
          Tiến Trình Multi-Agent Tự Động (12 Bước AI)
        </h3>
        <span className="text-[10px] font-mono text-text-muted">
          LangGraph Engine
        </span>
      </div>

      <div className="space-y-3 relative">
        {phases.map((phase) => {
          const Icon = phase.icon;
          const isRunning = phase.status === "running";
          const isCompleted = phase.status === "completed";
          const isError = phase.status === "error";

          return (
            <div key={phase.id} className="space-y-2">
              <div
                className={`flex items-start gap-3 p-2.5 rounded-lg transition-all ${
                  isRunning
                    ? "bg-primary/15 border border-primary/40 shadow-sm shadow-gold-glow/20"
                    : isCompleted
                    ? "bg-emerald-jade/10 border border-emerald-jade/20"
                    : isError
                    ? "bg-destructive/10 border border-destructive/30"
                    : "opacity-50"
                }`}
              >
                {/* Node Status Icon */}
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" />
                  ) : isRunning ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : isError ? (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  ) : (
                    <Circle className="w-4 h-4 text-text-muted" />
                  )}
                </div>

                {/* Phase Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold truncate ${
                        isRunning
                          ? "text-gold-300"
                          : isCompleted
                          ? "text-[#EDEDEF]"
                          : isError
                          ? "text-destructive"
                          : "text-text-muted"
                      }`}
                    >
                      {phase.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">
                    {phase.subtitle}
                  </p>
                </div>
              </div>

              {/* Error State with Inline Retry */}
              {isError && (
                <PhaseErrorState
                  phaseName={phase.title}
                  errorMessage={errorMessage}
                  onRetry={() => onRetryPhase?.(phase.id)}
                  isRetrying={isRetrying}
                />
              )}

              {/* Render Progress Bar for Phase 6 */}
              {phase.id === 6 && isRunning && renderProgress && (
                <div className="pl-7 pt-1">
                  <RenderProgressBar data={renderProgress} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
