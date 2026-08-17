"use client";

import React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export interface PhaseErrorStateProps {
  phaseName: string;
  errorMessage?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export function PhaseErrorState({
  phaseName,
  errorMessage = "Giai đoạn gặp sự cố hạ tầng hoặc giới hạn kết nối.",
  onRetry,
  isRetrying = false,
}: PhaseErrorStateProps) {
  return (
    <Alert variant="destructive" className="bg-destructive/15 border-destructive/40 my-3">
      <AlertTriangle className="h-4 w-4 text-destructive" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        <div className="space-y-0.5">
          <AlertTitle className="text-xs font-bold text-destructive">
            Sự Cố Tại: {phaseName}
          </AlertTitle>
          <AlertDescription className="text-[11px] text-text-secondary">
            {errorMessage}
          </AlertDescription>
        </div>
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          variant="outline"
          size="sm"
          className="shrink-0 h-8 border-destructive/40 text-destructive hover:bg-destructive/20 gap-1.5 text-xs self-start sm:self-auto"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
          <span>Thử lại bước này</span>
        </Button>
      </div>
    </Alert>
  );
}
