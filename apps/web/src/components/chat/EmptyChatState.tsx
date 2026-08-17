"use client";

import React from "react";
import { Sparkles, Scroll, Compass, Award } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface EmptyChatStateProps {
  onSelectPrompt: (prompt: string) => void;
}

const HISTORICAL_PROMPTS = [
  {
    title: "Trận Bạch Đằng 1288",
    subtitle: "Chiến thuật cắm cọc & lợi dụng quy luật thủy triều của Trần Hưng Đạo",
    icon: Compass,
    prompt: "Hãy phân tích chi tiết chiến thuật cắm cọc trên sông Bạch Đằng năm 1288 của Quốc công Tiết chế Trần Hưng Đạo và sự phối hợp giữa thủy quân và bộ binh.",
  },
  {
    title: "Khởi Nghĩa Hai Bà Trưng",
    subtitle: "Năm 40 SCN — Tiếng trống Mê Linh rửa nợ nước, trả thù nhà",
    icon: Award,
    prompt: "Kể lại diễn biến khởi nghĩa Hai Bà Trưng năm 40 SCN, tinh thần quật khởi và ý nghĩa của việc lập vương xưng đế tại Mê Linh.",
  },
  {
    title: "Hội Nghị Diên Hồng 1284",
    subtitle: "Ý chí toàn dân 'Nên Đánh hay Nên Hòa' thời Trần",
    icon: Scroll,
    prompt: "Trình bày bối cảnh và ý nghĩa lịch sử của Hội nghị Diên Hồng năm 1284, sự đồng lòng của các bô lão và vua tôi nhà Trần.",
  },
  {
    title: "Quang Trung Đại Phá Quân Thanh",
    subtitle: "Mùa xuân Kỷ Dậu 1789 — Thần tốc hành quân giải phóng Thăng Long",
    icon: Sparkles,
    prompt: "Tóm tắt cuộc hành quân thần tốc của Hoàng đế Quang Trung (Nguyễn Huệ) đại phá 29 vạn quân Mãn Thanh vào mùa xuân Kỷ Dậu 1789.",
  },
];

export function EmptyChatState({ onSelectPrompt }: EmptyChatStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto space-y-8 animate-in fade-in-50 duration-500">
      {/* Decorative Heritage Emblem */}
      <div className="relative">
        <div className="w-16 h-16 rounded-full border border-primary/40 bg-lacquer-surface flex items-center justify-center shadow-lg shadow-gold-glow/20">
          <span className="text-2xl font-headline text-gold-300">🏛️</span>
        </div>
      </div>

      {/* Greeting & Welcome */}
      <div className="space-y-2">
        <h2 className="font-headline text-2xl sm:text-3xl font-bold text-gold-300 tracking-tight">
          Không Gian Tri Thức Lịch Sử Việt Nam
        </h2>
        <p className="text-sm text-text-secondary max-w-lg leading-relaxed">
          Tra cứu sử liệu chính thống qua <span className="text-primary font-medium">Chrono-RAG</span> (Đại Việt Sử Ký Toàn Thư, Khâm Định Việt Sử). Bạn có thể hỏi bất kỳ sự kiện nào hoặc bấm 1-Click để chuyển thành thước phim tài liệu.
        </p>
      </div>

      {/* Prompt Starter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {HISTORICAL_PROMPTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Card
              key={idx}
              onClick={() => onSelectPrompt(item.prompt)}
              className="p-4 bg-lacquer-surface/80 hover:bg-lacquer-elevated border-primary/20 hover:border-primary/50 cursor-pointer transition-all duration-200 group hover:shadow-md hover:shadow-gold-glow/10"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-text-primary group-hover:text-gold-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-text-muted line-clamp-2 leading-tight">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
