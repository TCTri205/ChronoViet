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

export function parseRawCitation(c: any, index: number): CitationItem {
  if (!c) {
    return {
      id: index + 1,
      sourceTitle: "Sử liệu Chrono-RAG",
      reliabilityLevel: 1,
      originalExcerpt: "",
    };
  }

  if (typeof c === "string") {
    const match = c.match(/^(.*?)(?:\s*\[(?:Nguồn:\s*)?(?:LEVEL_)?([123])\])?$/i);
    const cleanTitle = match && match[1] ? match[1].trim() : c.trim();
    const rawLevel = match && match[2] ? parseInt(match[2], 10) : 1;
    const reliabilityLevel: 1 | 2 | 3 = rawLevel === 2 ? 2 : rawLevel === 3 ? 3 : 1;

    return {
      id: index + 1,
      sourceTitle: cleanTitle,
      annalsName:
        reliabilityLevel === 1
          ? "Chính Sử Quốc Triều"
          : reliabilityLevel === 2
          ? "Khảo Cứu / Thứ Sử"
          : "Dã Sử & Truyền Thuyết",
      dynasty: "Thời Cổ Trung Đại",
      period: "Tiến trình Lịch sử Việt Nam",
      reliabilityLevel,
      originalExcerpt: cleanTitle,
    };
  }

  let cleanTitle = c.sourceTitle || c.title || "Đại Việt Sử Ký Toàn Thư";
  let reliabilityLevel: 1 | 2 | 3 = c.reliabilityLevel || 1;
  const match = cleanTitle.match(/^(.*?)(?:\s*\[(?:Nguồn:\s*)?(?:LEVEL_)?([123])\])?$/i);
  if (match && match[1]) {
    cleanTitle = match[1].trim();
    if (match[2] && !c.reliabilityLevel) {
      const rawLevel = parseInt(match[2], 10);
      reliabilityLevel = rawLevel === 2 ? 2 : rawLevel === 3 ? 3 : 1;
    }
  }

  return {
    id: c.id ?? index + 1,
    sourceTitle: cleanTitle,
    annalsName: c.annalsName || (reliabilityLevel === 1 ? "Chính Sử" : "Tài liệu Khảo Cứu"),
    dynasty: c.dynasty || "Thời Trần / Lê / Tây Sơn",
    period: c.period || "Lịch Sử Cổ Trung Đại",
    reliabilityLevel,
    originalExcerpt: c.originalExcerpt || c.excerpt || c.content || cleanTitle,
    confidenceScore: c.confidenceScore,
  };
}

export function CitationBadge({
  citation,
  onClick,
  className = "",
}: CitationBadgeProps) {
  const normalized = parseRawCitation(
    citation,
    typeof citation.id === "number" ? citation.id - 1 : 0
  );
  const relLevel = normalized.reliabilityLevel || 1;

  const levelLabel =
    relLevel === 1 ? "Chính sử" : relLevel === 2 ? "Khảo cứu" : "Dã sử";
  const badgeStyle =
    relLevel === 1
      ? "border-[#D4AF37]/40 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37]"
      : relLevel === 2
      ? "border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300"
      : "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300";

  const tooltipText = `${normalized.sourceTitle}${
    normalized.annalsName ? ` (${normalized.annalsName})` : ""
  } • Độ tin cậy: Cấp độ ${relLevel} (${levelLabel})`;

  return (
    <button
      type="button"
      onClick={() => onClick?.(normalized)}
      title={tooltipText}
      className={`inline-flex items-center max-w-full gap-1.5 px-2.5 py-1 my-0.5 rounded-lg border text-xs font-medium transition-all cursor-pointer group shadow-sm ${badgeStyle} ${className}`}
      aria-label={`Tra cứu nguồn sử liệu [${normalized.id}] ${normalized.sourceTitle}`}
    >
      <BookOpen className="w-3 h-3 group-hover:scale-110 transition-transform shrink-0" />
      <span className="font-mono text-[11px] font-semibold shrink-0">
        [{normalized.id}]
      </span>
      <span className="truncate max-w-[220px] sm:max-w-[320px] text-[11px] font-sans text-left">
        {normalized.sourceTitle}
      </span>
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-text-muted font-sans shrink-0 hidden sm:inline">
        {levelLabel}
      </span>
    </button>
  );
}
