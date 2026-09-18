"use client";

import React, { useState } from "react";
import {
  ScrollText,
  Copy,
  Check,
  Download,
  Clock,
  Play,
  Volume2,
  BookOpen,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface TranscriptScene {
  sceneId: string;
  chapterIndex?: number;
  chapterTitle?: string;
  startMs: number;
  endMs: number;
  text: string;
  layoutMode?: string;
}

export interface TranscriptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectTitle: string;
  scenes: TranscriptScene[];
  currentTimeMs: number;
  onSeekToMs: (ms: number) => void;
}

function formatTimestamp(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function TranscriptDrawer({
  isOpen,
  onClose,
  projectTitle,
  scenes,
  currentTimeMs,
  onSeekToMs,
}: TranscriptDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [copiedSceneId, setCopiedSceneId] = useState<string | null>(null);

  // Group scenes by chapter
  const chaptersMap = new Map<number, { title: string; scenes: TranscriptScene[] }>();

  scenes.forEach((sc, idx) => {
    const chIdx = sc.chapterIndex ?? Math.floor(idx / 5);
    const existing = chaptersMap.get(chIdx);
    const title = sc.chapterTitle || `Hồi ${chIdx + 1}`;
    if (existing) {
      existing.scenes.push(sc);
    } else {
      chaptersMap.set(chIdx, { title, scenes: [sc] });
    }
  });

  const totalWords = scenes.reduce(
    (acc, sc) => acc + (sc.text ? sc.text.split(/\s+/).filter(Boolean).length : 0),
    0
  );
  const totalDurationMs = scenes.length > 0 ? scenes[scenes.length - 1].endMs : 0;

  const copyToClipboard = async (text: string): Promise<boolean> => {
    // 1. Try modern navigator.clipboard API if available in secure context
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        // clipboard.writeText may fail due to permissions or iframe policy; proceed to fallback
        console.warn("navigator.clipboard.writeText failed, trying fallback execCommand:", err);
      }
    }

    // 2. Resilient fallback using textarea & document.execCommand
    if (typeof document !== "undefined") {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.contain = "strict";
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);

        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (successful) return true;
      } catch (err) {
        console.warn("execCommand copy fallback failed:", err);
      }
    }

    return false;
  };

  const handleCopyFullTranscript = async () => {
    if (scenes.length === 0) {
      toast.info("Chưa có nội dung kịch bản để sao chép");
      return;
    }

    try {
      const fullText = Array.from(chaptersMap.entries())
        .map(([chIdx, ch]) => {
          const header = `=== HỒI ${chIdx + 1}: ${ch.title.toUpperCase()} ===\n`;
          const lines = ch.scenes
            .map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`)
            .join("\n\n");
          return `${header}\n${lines}`;
        })
        .join("\n\n---\n\n");

      const transcriptContent = `CHRONOVIET - KỊCH BẢN THUYẾT MINH LỊCH SỬ\nChủ đề: ${projectTitle}\nThời lượng: ${formatTimestamp(
        totalDurationMs
      )} | Tổng số từ: ${totalWords}\n\n${fullText}`;

      const copiedSuccess = await copyToClipboard(transcriptContent);
      if (copiedSuccess) {
        setCopied(true);
        toast.success("Đã sao chép toàn bộ kịch bản vào clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error("Không thể truy cập bộ nhớ tạm. Hãy cấp quyền sao chép trên trình duyệt.");
      }
    } catch {
      toast.error("Không thể sao chép văn bản");
    }
  };

  const handleCopySceneText = async (sc: TranscriptScene, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sc.text) return;
    const formatted = `[${formatTimestamp(sc.startMs)}] ${sc.text}`;
    const success = await copyToClipboard(formatted);
    if (success) {
      setCopiedSceneId(sc.sceneId);
      toast.success(`Đã sao chép phân cảnh ${formatTimestamp(sc.startMs)}`);
      setTimeout(() => setCopiedSceneId(null), 2000);
    } else {
      toast.error("Không thể sao chép văn bản");
    }
  };

  const handleDownloadTranscript = () => {
    const fullText = Array.from(chaptersMap.entries())
      .map(([chIdx, ch]) => {
        const header = `=== HỒI ${chIdx + 1}: ${ch.title.toUpperCase()} ===\n`;
        const lines = ch.scenes
          .map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`)
          .join("\n\n");
        return `${header}\n${lines}`;
      })
      .join("\n\n---\n\n");

    const content = `CHRONOVIET - KỊCH BẢN THUYẾT MINH LỊCH SỬ\nChủ đề: ${projectTitle}\nThời lượng: ${formatTimestamp(
      totalDurationMs
    )} | Tổng số từ: ${totalWords}\n\n${fullText}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kich_ban_${projectTitle.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Đã tải tệp kịch bản (.txt)");
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="bg-lacquer-surface border-l border-primary/30 w-full sm:max-w-xl flex flex-col p-0 overflow-hidden shadow-2xl"
      >
        {/* Header Section */}
        <SheetHeader className="p-5 border-b border-primary/20 bg-lacquer-deep/60 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-primary">
                Kịch Bản Toàn Văn • VieNeu Neural TTS
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-gold-300">
              {scenes.length} Phân Cảnh
            </Badge>
          </div>

          <SheetTitle className="text-lg font-headline font-bold text-gold-300 line-clamp-1 mt-1">
            {projectTitle}
          </SheetTitle>

          <SheetDescription className="text-xs text-text-secondary flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{formatTimestamp(totalDurationMs)}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>{totalWords} từ</span>
            </span>
            <span>•</span>
            <span className="text-[11px] text-text-muted">Bấm vào câu để tua video</span>
          </SheetDescription>

          {/* Quick Action Bar */}
          <div className="flex items-center gap-2 pt-3">
            <Button
              onClick={handleCopyFullTranscript}
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-primary/30 text-gold-300 hover:bg-primary/20 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#2ECC71]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Đã sao chép" : "Sao chép toàn bộ"}</span>
            </Button>

            <Button
              onClick={handleDownloadTranscript}
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-primary/30 text-text-secondary hover:text-gold-300 hover:bg-primary/10 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file .txt</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Scrollable Transcript Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {scenes.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">
              Đang chuẩn bị kịch bản thuyết minh...
            </div>
          ) : (
            Array.from(chaptersMap.entries()).map(([chIdx, ch]) => (
              <div key={chIdx} className="space-y-3">
                {/* Chapter Banner */}
                <div className="sticky top-0 z-10 flex items-center gap-2 py-1.5 px-3 rounded bg-lacquer-deep/95 backdrop-blur-md border-l-2 border-primary border-y border-primary/15 text-xs shadow-sm">
                  <span className="font-headline font-bold text-gold-300 tracking-wide">
                    HỒI {chIdx + 1}: {ch.title.replace(/^Hồi\s*\d+\s*[:–—\-]\s*/i, '')}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono ml-auto">
                    {ch.scenes.length} cảnh
                  </span>
                </div>

                {/* Scenes List in Chapter */}
                <div className="space-y-2.5 pl-1">
                  {ch.scenes.map((sc) => {
                    const isCurrentlyPlaying =
                      currentTimeMs >= sc.startMs && currentTimeMs <= sc.endMs;

                    return (
                      <div
                        key={sc.sceneId}
                        onClick={() => onSeekToMs(sc.startMs)}
                        className={`group p-3 rounded-lg border transition-all cursor-pointer text-left ${
                          isCurrentlyPlaying
                            ? "bg-primary/15 border-primary text-text-primary shadow-md shadow-gold-glow/20 ring-1 ring-primary/60"
                            : "bg-lacquer-deep/40 border-primary/10 hover:border-primary/30 hover:bg-lacquer-deep/70 text-text-secondary"
                        }`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Tua đến ${formatTimestamp(sc.startMs)}: ${sc.text.slice(0, 40)}`}
                      >
                        {/* Meta row: timestamp & layout */}
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span
                            className={`font-mono font-semibold flex items-center gap-1.5 transition-colors ${
                              isCurrentlyPlaying ? "text-gold-300" : "text-primary group-hover:text-gold-300"
                            }`}
                          >
                            {isCurrentlyPlaying ? (
                              <Volume2 className="w-3.5 h-3.5 text-primary animate-pulse" />
                            ) : (
                              <Play className="w-3 h-3 fill-current opacity-70 group-hover:opacity-100" />
                            )}
                            <span>{formatTimestamp(sc.startMs)}</span>
                          </span>

                          <div className="flex items-center gap-2">
                            {sc.layoutMode && (
                              <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
                                {sc.layoutMode.replace(/_/g, " ")}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleCopySceneText(sc, e)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-primary/20 text-text-muted hover:text-gold-300"
                              title="Sao chép đoạn kịch bản này"
                              aria-label="Sao chép phân cảnh"
                            >
                              {copiedSceneId === sc.sceneId ? (
                                <Check className="w-3 h-3 text-[#2ECC71]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Voiceover text */}
                        <p
                          className={`text-xs leading-relaxed transition-colors ${
                            isCurrentlyPlaying
                              ? "text-white font-medium"
                              : "text-text-primary group-hover:text-gold-300/90"
                          }`}
                        >
                          {sc.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
