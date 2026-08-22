"use client";

import React from "react";
import { Loader2, CheckCircle2, Film } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export interface RenderProgressData {
  percent?: number;
  progressPercent?: number;
  currentFrame?: number;
  totalFrames?: number;
  remainingSeconds?: number;
  estimatedRemainingSec?: number;
  status: "INIT" | "RENDERING" | "COMPLETED" | "FAILED";
}

export interface RenderProgressBarProps {
  data: RenderProgressData;
  className?: string;
}

export function RenderProgressBar({
  data,
  className = "",
}: RenderProgressBarProps) {
  const percentValue = data.progressPercent ?? data.percent ?? 0;
  const remainingSec = data.estimatedRemainingSec ?? data.remainingSeconds;
  const isCompleted = percentValue >= 100 || data.status === "COMPLETED";

  return (
    <div
      className={`p-4 rounded-xl bg-lacquer-deep/70 border border-primary/20 space-y-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" />
          ) : (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          )}
          <span className="text-xs font-semibold text-text-primary">
            {isCompleted
              ? "Kết Xuất Video Hoàn Tất (1080p Sẵn Sàng)"
              : "Đang Kết Xuất Remotion MP4..."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {data.currentFrame !== undefined && data.totalFrames !== undefined && (
            <span className="font-mono text-[11px] text-text-muted tabular-nums">
              Frame {data.currentFrame}/{data.totalFrames}
            </span>
          )}
          <Badge
            variant={isCompleted ? "completed" : "rendering"}
            className="font-mono text-xs tabular-nums"
          >
            {Math.round(percentValue)}%
          </Badge>
        </div>
      </div>

      <Progress value={percentValue} className="h-2.5" />

      <div className="flex justify-between items-center text-[10px] text-text-muted font-mono">
        <span>Remotion v4 Engine • GPU Concurrency=1</span>
        {!isCompleted && remainingSec !== undefined && remainingSec > 0 && (
          <span className="tabular-nums">
            Ước tính còn: ~{remainingSec}s
          </span>
        )}
      </div>
    </div>
  );
}
