"use client";

import React, { useState } from "react";
import { Sparkles, Scroll, Compass, Award, ChevronDown, ChevronUp, Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface EmptyChatStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export interface HistoricalEpoch {
  id: string;
  name: string;
  shortName: string;
  years: string;
  prompt: string;
  isFeatured?: boolean;
}

export const HISTORICAL_EPOCHS: HistoricalEpoch[] = [
  {
    id: "hong_bang",
    name: "Hồng Bàng & Văn Lang",
    shortName: "Văn Lang",
    years: "2879 TCN – 258 TCN",
    prompt: "Hãy trình bày về nguồn gốc dân tộc, thời kỳ Hùng Vương dựng nước Văn Lang và những dấu ấn văn hóa thời kỳ đồ đồng Đông Sơn.",
    isFeatured: true,
  },
  {
    id: "au_lac",
    name: "Âu Lạc & An Dương Vương",
    shortName: "Âu Lạc",
    years: "257 TCN – 179 TCN",
    prompt: "Kể lại sự tích xây thành Cổ Loa của An Dương Vương, nỏ thần Kim Quy và bài học lịch sử sâu sắc từ cuộc xâm lược của Triệu Đà.",
  },
  {
    id: "bac_thuoc",
    name: "Nghìn Năm Bắc Thuộc",
    shortName: "Bắc Thuộc",
    years: "179 TCN – 938",
    prompt: "Tóm lược các cuộc khởi nghĩa tiêu biểu trong thời kỳ Bắc thuộc như Hai Bà Trưng (40), Bà Triệu (248), Lý Bí (542) và Mai Thúc Loan.",
  },
  {
    id: "ngo_dinh_le",
    name: "Ngô – Đinh – Tiền Lê",
    shortName: "Đinh - Tiền Lê",
    years: "938 – 1009",
    prompt: "Trình bày chiến thắng Bạch Đằng năm 938 của Ngô Quyền chấm dứt 1000 năm Bắc thuộc, cùng công cuộc dẹp loạn 12 sứ quân của Đinh Bộ Lĩnh.",
  },
  {
    id: "nha_ly",
    name: "Triều Đại Nhà Lý",
    shortName: "Nhà Lý",
    years: "1009 – 1225",
    prompt: "Phân tích Chiếu Dời Đô năm 1010 của Lý Thái Tổ về Thăng Long và chiến dịch phòng ngự - phản công trên sông Như Nguyệt của Lý Thường Kiệt.",
    isFeatured: true,
  },
  {
    id: "nha_tran",
    name: "Triều Đại Nhà Trần",
    shortName: "Nhà Trần",
    years: "1225 – 1400",
    prompt: "Trình bày hào khí Đông A và 3 lần đại phá quân Nguyên - Mông lẫy lừng của quân dân nhà Trần (1258, 1285, 1288).",
    isFeatured: true,
  },
  {
    id: "nha_ho",
    name: "Triều Đại Nhà Hồ",
    shortName: "Nhà Hồ",
    years: "1400 – 1407",
    prompt: "Phân tích những cải cách táo bạo của Hồ Quý Ly (tiền giấy, thi cử, thành nhà Hồ) và nguyên nhân thất bại trước quân xâm lược nhà Minh.",
  },
  {
    id: "hau_le",
    name: "Khởi Nghĩa Lam Sơn & Hậu Lê",
    shortName: "Hậu Lê",
    years: "1428 – 1527",
    prompt: "Tóm lược 10 năm nếm mật nằm gai của khởi nghĩa Lam Sơn (Lê Lợi, Nguyễn Trãi) và sự thịnh vượng của thời kỳ Hồng Đức dưới triều vua Lê Thánh Tông.",
  },
  {
    id: "nha_mac",
    name: "Triều Đại Nhà Mạc",
    shortName: "Nhà Mạc",
    years: "1527 – 1592",
    prompt: "Đánh giá vai trò của triều Mạc trong lịch sử Việt Nam, sự phát triển kinh tế công thương và những danh nhân tiêu biểu như Trạng Trình Nguyễn Bỉnh Khiêm.",
  },
  {
    id: "trinh_nguyen",
    name: "Trịnh – Nguyễn Phân Tranh",
    shortName: "Trịnh - Nguyễn",
    years: "1627 – 1777",
    prompt: "Trình bày bối cảnh Trịnh - Nguyễn phân tranh (Đàng Ngoài - Đàng Trong), lũy Thầy và công cuộc mở cõi phương Nam của các chúa Nguyễn.",
  },
  {
    id: "tay_son",
    name: "Phong Trào Tây Sơn",
    shortName: "Tây Sơn",
    years: "1778 – 1802",
    prompt: "Kể lại cuộc hành quân thần tốc của Hoàng đế Quang Trung đại phá 29 vạn quân Mãn Thanh mùa xuân Kỷ Dậu 1789 giải phóng Thăng Long.",
    isFeatured: true,
  },
  {
    id: "nha_nguyen",
    name: "Triều Đại Nhà Nguyễn",
    shortName: "Nhà Nguyễn",
    years: "1802 – 1945",
    prompt: "Trình bày quá trình thống nhất bờ cõi từ Mục Nam Quan đến Mũi Cà Mau dưới triều Nguyễn, xác lập chủ quyền Hoàng Sa - Trường Sa và những công trình kiến trúc Huế.",
  },
  {
    id: "can_dai",
    name: "Phong Trào Cần Vương & Duy Tân",
    shortName: "Cần Vương - Duy Tân",
    years: "1885 – 1945",
    prompt: "Tóm tắt các phong trào yêu nước chống thực dân Pháp cuối thế kỷ XIX - đầu thế kỷ XX: Phong trào Cần Vương, Đông Du của Phan Bội Châu, Duy Tân của Phan Châu Trinh.",
  },
  {
    id: "khang_chien",
    name: "Thời Kỳ Kháng Chiến",
    shortName: "Kháng Chiến",
    years: "1945 – 1975",
    prompt: "Phân tích ý nghĩa lịch sử của Cách mạng Tháng Tám 1945, Chiến thắng Điện Biên Phủ 1954 'lừng lẫy năm châu, chấn động địa cầu' và Đại thắng mùa Xuân 1975.",
  },
  {
    id: "hien_dai",
    name: "Đổi Mới & Hiện Đại",
    shortName: "Hiện Đại",
    years: "1986 – Nay",
    prompt: "Khái quát công cuộc Đổi Mới đất nước từ Đại hội VI năm 1986, hội nhập quốc tế và giữ gìn bản sắc văn hóa lịch sử dân tộc Việt Nam.",
  },
];

export const HISTORICAL_PROMPTS = [
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
  const [selectedEpoch, setSelectedEpoch] = useState<string | null>(null);
  const [isEpochsExpanded, setIsEpochsExpanded] = useState(false);

  const displayedEpochs = isEpochsExpanded
    ? HISTORICAL_EPOCHS
    : HISTORICAL_EPOCHS.filter((e) => e.isFeatured);

  const handleEpochClick = (epoch: HistoricalEpoch) => {
    setSelectedEpoch(epoch.id);
    onSelectPrompt(epoch.prompt);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center max-w-3xl mx-auto space-y-6 animate-in fade-in-50 duration-500 overflow-y-auto">
      {/* Decorative Heritage Emblem */}
      <div className="relative">
        <div className="w-16 h-16 rounded-full border border-primary/40 bg-lacquer-surface flex items-center justify-center shadow-lg shadow-gold-glow/20">
          <svg
            className="w-8 h-8 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path
              d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </div>
      </div>

      {/* Greeting & Welcome */}
      <div className="space-y-2">
        <h2 className="font-headline text-2xl sm:text-3xl font-bold text-gold-300 tracking-tight">
          Không Gian Tri Thức Lịch Sử Việt Nam
        </h2>
        <p className="text-xs sm:text-sm text-text-secondary max-w-lg mx-auto leading-relaxed">
          Tra cứu sử liệu chính thống qua <span className="text-primary font-medium">Chrono-RAG</span> (Đại Việt Sử Ký Toàn Thư, Khâm Định Việt Sử). Bạn có thể hỏi bất kỳ sự kiện nào hoặc bấm 1-Click để chuyển thành thước phim tài liệu.
        </p>
      </div>

      {/* 15 Vietnamese Historical Epochs Collapsible / Expandable Panel */}
      <div className="w-full space-y-2 text-left bg-lacquer-surface/70 border border-primary/20 rounded-xl p-3 backdrop-blur-sm transition-all shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-gold-300 font-headline">
              15 Thời Kỳ Lịch Sử Việt Nam
            </span>
            <span className="text-[10px] font-mono text-text-muted hidden sm:inline">
              (Bấm để tra cứu nhanh)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsEpochsExpanded(!isEpochsExpanded)}
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-gold-300 transition-colors py-0.5 px-2 rounded-md hover:bg-primary/10 cursor-pointer"
            aria-expanded={isEpochsExpanded}
            aria-label={isEpochsExpanded ? "Thu gọn danh sách thời kỳ lịch sử" : "Mở rộng toàn bộ 15 thời kỳ lịch sử"}
          >
            <span>{isEpochsExpanded ? "Thu gọn" : `Mở rộng (15 thời kỳ)`}</span>
            {isEpochsExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Epochs Button List */}
        <div
          className={`flex flex-wrap gap-1.5 transition-all duration-300 ${
            isEpochsExpanded ? "max-h-60 overflow-y-auto pt-1" : "pt-0.5"
          }`}
        >
          {displayedEpochs.map((epoch) => {
            const isSelected = selectedEpoch === epoch.id;
            return (
              <button
                key={epoch.id}
                type="button"
                onClick={() => handleEpochClick(epoch)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                  isSelected
                    ? "bg-primary/25 border-primary text-gold-300 font-semibold shadow-sm shadow-gold-glow/20 ring-1 ring-primary"
                    : "bg-lacquer-deep/60 border-primary/20 text-text-secondary hover:text-text-primary hover:border-primary/45 hover:bg-lacquer-elevated"
                }`}
                title={`${epoch.name} (${epoch.years})`}
                aria-label={`Tra cứu thời kỳ ${epoch.name}`}
              >
                <span>{epoch.name}</span>
                <span className="text-[9px] text-text-muted font-mono hidden md:inline">
                  {epoch.years.split("–")[0].trim()}
                </span>
              </button>
            );
          })}

          {/* Inline Expand Hint when collapsed */}
          {!isEpochsExpanded && (
            <button
              type="button"
              onClick={() => setIsEpochsExpanded(true)}
              className="text-[11px] px-2 py-1 rounded-full border border-dashed border-primary/30 text-primary hover:text-gold-300 hover:border-primary/60 hover:bg-primary/10 transition-colors cursor-pointer"
            >
              +11 thời kỳ khác...
            </button>
          )}
        </div>
      </div>

      {/* Prompt Starter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {HISTORICAL_PROMPTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(item.prompt)}
              className="p-4 rounded-xl bg-lacquer-surface/80 hover:bg-lacquer-elevated border border-primary/20 hover:border-primary/50 cursor-pointer transition-all duration-200 group hover:shadow-md hover:shadow-gold-glow/10 text-left active:scale-[0.99] focus-visible:ring-1 focus-visible:ring-primary"
              aria-label={`Chọn câu hỏi: ${item.title}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-xs font-semibold text-text-primary group-hover:text-gold-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-text-muted line-clamp-2 leading-tight">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
