"use client";

import React from "react";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface CitationItem {
  id: number | string;
  sourceTitle: string;
  annalsName?: string;
  dynasty?: string;
  period?: string;
  reliabilityLevel?: 1 | 2 | 3;
  originalExcerpt: string;
  confidenceScore?: number;
}

export interface CitationBadgeProps {
  citation: CitationItem;
  onClick?: (citation: CitationItem) => void;
  className?: string;
}

export function CitationBadge({
  citation,
  onClick,
  className = "",
}: CitationBadgeProps) {
  const tooltipText = `${citation.sourceTitle}${
    citation.annalsName ? ` (${citation.annalsName})` : ""
  }${
    citation.reliabilityLevel
      ? ` • Độ tin cậy: Cấp độ ${citation.reliabilityLevel} (${
          citation.reliabilityLevel === 1
            ? "Chính sử"
            : citation.reliabilityLevel === 2
            ? "Thứ sử / Khảo cứu"
            : "Dã sử / Truyền thuyết"
        })`
      : ""
  }`;

  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      title={tooltipText}
      className={`inline-flex items-center max-w-full gap-1.5 px-2 py-0.5 my-0.5 rounded border border-[#D4AF37]/35 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/25 text-[#D4AF37] text-xs font-medium transition-all cursor-pointer group shadow-sm ${className}`}
      aria-label={`Tra cứu nguồn sử liệu [${citation.id}] ${citation.sourceTitle}`}
    >
      <BookOpen className="w-3 h-3 text-[#D4AF37] group-hover:scale-110 transition-transform shrink-0" />
      <span className="font-mono text-[11px] shrink-0">[{citation.id}]</span>
      <span className="truncate max-w-[180px] text-[11px] font-sans text-left">
        {citation.sourceTitle}
      </span>
    </button>
  );
}
