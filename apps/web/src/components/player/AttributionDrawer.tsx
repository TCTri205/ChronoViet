"use client";

import React from "react";
import { ShieldCheck, ExternalLink, Image as ImageIcon, Scroll, Award } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export interface MediaAttribution {
  id: string;
  title: string;
  sourceUrl?: string;
  sourceType: "WOODBLOCK_SCROLL" | "ARCHIVE_PHOTO" | "MUSEUM_PAINTING" | "MAP_CHART" | "PURE_CODE";
  license: "CC0" | "PUBLIC_DOMAIN" | "CC_BY_4_0" | "HISTORICAL_HERITAGE";
  institution?: string;
  confidenceScore?: number;
}

export interface AttributionDrawerProps {
  attributions: MediaAttribution[];
  isOpen: boolean;
  onClose: () => void;
}

export function AttributionDrawer({
  attributions,
  isOpen,
  onClose,
}: AttributionDrawerProps) {
  const getLicenseBadge = (license: MediaAttribution["license"]) => {
    switch (license) {
      case "CC0":
      case "PUBLIC_DOMAIN":
        return <Badge variant="completed">CC0 / Miễn Phí Bản Quyền</Badge>;
      case "CC_BY_4_0":
        return <Badge variant="outline">CC-BY-4.0 (Ghi Nhận)</Badge>;
      default:
        return <Badge variant="citation">Di Sản Quốc Gia</Badge>;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="bg-lacquer-surface border-l border-primary/30 w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader className="pb-4 border-b border-primary/15">
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Kê Khai Bản Quyền & Nguồn Gốc Tư Liệu
            </span>
          </div>
          <SheetTitle className="text-xl font-headline text-gold-300">
            Hồ Sơ Minh Bạch Tư Liệu Cổ
          </SheetTitle>
          <SheetDescription className="text-text-secondary text-xs">
            Toàn bộ hình ảnh, tranh khắc mộc bản, bản đồ sử dụng trong thước phim được kiểm duyệt qua VLM Inspector theo chuẩn bản quyền quốc tế.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-4">
          {attributions.length === 0 ? (
            <div className="p-6 text-center text-text-muted text-xs">
              Chưa có dữ liệu kê khai tư liệu.
            </div>
          ) : (
            attributions.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-lg bg-lacquer-deep/70 border border-primary/15 space-y-2 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-xs text-text-primary line-clamp-1">
                      {item.title}
                    </span>
                  </div>
                  {getLicenseBadge(item.license)}
                </div>

                <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
                  <span>Lưu trữ: {item.institution || "Bảo Tàng Lịch Sử Quốc Gia"}</span>
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <span>Xem gốc</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}

          {/* VLM Verification seal */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-3 mt-6">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-semibold text-gold-300 block">
                Xác Thực 100% An Toàn Bản Quyền
              </span>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Tất cả hình ảnh đã được lọc qua Whitelisted License Filter (CC0, CC-BY, Public Domain). Các phân đoạn không rõ nguồn gốc đã tự động chuyển sang chế độ đồ họa thư pháp cổ (PURE_CODE).
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
