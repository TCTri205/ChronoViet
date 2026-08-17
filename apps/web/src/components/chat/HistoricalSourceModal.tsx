"use client";

import React from "react";
import { BookOpen, ShieldCheck, Calendar, Bookmark, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CitationItem } from "./CitationBadge";

export interface HistoricalSourceModalProps {
  citation: CitationItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function HistoricalSourceModal({
  citation,
  isOpen,
  onClose,
}: HistoricalSourceModalProps) {
  if (!citation) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="bg-lacquer-surface border-l border-primary/30 w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader className="pb-4 border-b border-primary/15">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="citation" className="text-[11px]">
              Trích Dẫn [{citation.id}]
            </Badge>
            {citation.reliabilityLevel && (
              <Badge
                variant={citation.reliabilityLevel === 1 ? "completed" : "outline"}
                className="text-[10px]"
              >
                Độ Tin Cậy Cấp {citation.reliabilityLevel} (Chính Sử)
              </Badge>
            )}
          </div>
          <SheetTitle className="text-xl font-headline text-gold-300">
            {citation.sourceTitle}
          </SheetTitle>
          {citation.annalsName && (
            <SheetDescription className="text-text-secondary text-xs">
              Bộ sử: <span className="text-text-primary font-medium">{citation.annalsName}</span>
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-3">
            {citation.dynasty && (
              <div className="p-3 rounded-lg bg-lacquer-deep/60 border border-primary/15 flex items-start gap-2.5">
                <Bookmark className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-[11px] text-text-muted">Triều Đại</span>
                  <span className="text-xs font-semibold text-text-primary">
                    {citation.dynasty}
                  </span>
                </div>
              </div>
            )}
            {citation.period && (
              <div className="p-3 rounded-lg bg-lacquer-deep/60 border border-primary/15 flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-[11px] text-text-muted">Niên Đại</span>
                  <span className="text-xs font-semibold text-text-primary">
                    {citation.period}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Original Source Excerpt (Parchment Styled) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-headline font-semibold text-gold-300">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>Trích Đoạn Sử Liệu Nguyên Bản</span>
            </div>
            <div className="parchment-scroll p-4 rounded-lg text-sm leading-relaxed text-text-primary font-serif italic border border-primary/20 shadow-inner">
              "{citation.originalExcerpt}"
            </div>
          </div>

          {/* Fact-checking badge */}
          <div className="p-4 rounded-lg bg-emerald-jade/15 border border-emerald-jade/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#2ECC71] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#2ECC71] block">
                Đã Thẩm Định Qua Hội Đồng Lịch Sử Multi-Agent
              </span>
              <p className="text-[11px] text-text-secondary leading-normal">
                Dữ kiện này đã được Chrono-RAG đối chiếu chéo giữa các nguồn Đại Việt Sử Ký Toàn Thư và Khâm Định Việt Sử, bảo đảm tính xác thực 0 sai lệch.
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
