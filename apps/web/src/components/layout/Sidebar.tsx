"use client";

import React, { useState, useEffect } from "react";
import {
  Film,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Scroll,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ProjectItem {
  id: string;
  topic: string;
  status: "INIT" | "RESEARCHING" | "SCRIPTING" | "TTS_GENERATING" | "VLM_INSPECTING" | "RENDERING" | "COMPLETED" | "FAILED";
  aspectRatio?: "16:9" | "9:16";
  durationSeconds?: number;
  createdAt: string;
}

export interface SidebarProps {
  activeProjectId?: string;
  onSelectProject?: (projectId: string) => void;
  className?: string;
}

export function Sidebar({
  activeProjectId,
  onSelectProject,
  className = "",
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<ProjectItem[]>([
    {
      id: "proj_bach_dang_1288",
      topic: "Trận chiến Bạch Đằng năm 1288",
      status: "COMPLETED",
      aspectRatio: "16:9",
      durationSeconds: 180,
      createdAt: "Vừa xong",
    },
    {
      id: "proj_hai_ba_trung",
      topic: "Khởi nghĩa Hai Bà Trưng (Năm 40)",
      status: "COMPLETED",
      aspectRatio: "9:16",
      durationSeconds: 60,
      createdAt: "Hôm qua",
    },
    {
      id: "proj_lam_son_1427",
      topic: "Khởi nghĩa Lam Sơn & Bình Ngô Đại Cáo",
      status: "COMPLETED",
      aspectRatio: "16:9",
      durationSeconds: 300,
      createdAt: "3 ngày trước",
    },
  ]);

  // Load actual project list from API
  useEffect(() => {
    let isMounted = true;
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/v1/projects?limit=20");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.items && data.items.length > 0) {
            setProjects(data.items);
          }
        }
      } catch {
        // keep initial default projects
      }
    };
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((p) =>
    p.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: ProjectItem["status"]) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="completed">HOÀN TẤT</Badge>;
      case "RENDERING":
      case "TTS_GENERATING":
      case "VLM_INSPECTING":
      case "RESEARCHING":
      case "SCRIPTING":
        return (
          <Badge variant="rendering" className="flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ĐANG TẠO
          </Badge>
        );
      case "FAILED":
        return <Badge variant="failed">THẤT BẠI</Badge>;
      default:
        return <Badge variant="outline">KHỞI TẠO</Badge>;
    }
  };

  return (
    <aside
      className={`h-full border-r border-primary/20 bg-lacquer-surface/95 backdrop-blur-md flex flex-col z-20 shrink-0 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-72"
      } ${className}`}
      aria-label="Kho lưu trữ dự án lịch sử"
    >
      {/* Sidebar Header & Toggle */}
      <div className="p-3 border-b border-primary/10 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Scroll className="w-4 h-4 text-primary" aria-hidden="true" />
            <h2 className="text-xs font-bold text-gold-300 uppercase tracking-wider font-headline">
              Kho Sử Liệu Đã Tạo
            </h2>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-md hover:bg-primary/10 text-text-secondary hover:text-gold-300 transition-colors mx-auto"
          aria-label={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Search Input (only visible when expanded) */}
      {!isCollapsed && (
        <div className="p-3 border-b border-primary/10">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-muted" />
            <Input
              type="text"
              placeholder="Tìm kiếm thước phim..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-lacquer-deep/60"
            />
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <TooltipProvider delayDuration={150}>
          {filteredProjects.map((proj) => {
            const isActive = activeProjectId === proj.id;
            if (isCollapsed) {
              return (
                <Tooltip key={proj.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelectProject?.(proj.id)}
                      className={`w-full h-11 rounded-lg flex items-center justify-center transition-colors ${
                        isActive
                          ? "bg-primary/20 text-gold-300 border border-primary/40"
                          : "text-text-secondary hover:bg-lacquer-elevated hover:text-text-primary"
                      }`}
                      aria-label={proj.topic}
                    >
                      <Film className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gold-300">{proj.topic}</span>
                      <div className="flex items-center gap-2 text-[10px]">
                        {getStatusBadge(proj.status)}
                        <span>{proj.aspectRatio || "16:9"}</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <button
                key={proj.id}
                onClick={() => onSelectProject?.(proj.id)}
                className={`w-full p-3 rounded-lg text-left transition-all border ${
                  isActive
                    ? "bg-primary/10 border-primary/40 text-gold-300 shadow-sm"
                    : "bg-lacquer-deep/40 border-primary/10 text-text-secondary hover:border-primary/25 hover:text-text-primary"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-medium text-xs text-text-primary line-clamp-2 leading-snug">
                    {proj.topic}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-text-muted mt-2">
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(proj.status)}
                    <span className="font-mono">{proj.aspectRatio || "16:9"}</span>
                  </div>
                  <span className="tabular-nums">{proj.createdAt}</span>
                </div>
              </button>
            );
          })}
        </TooltipProvider>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-primary/10 flex items-center justify-between text-xs text-text-muted">
        {!isCollapsed && (
          <span className="text-[11px] font-mono">ChronoViet v1.5</span>
        )}
        <Settings className="w-4 h-4 cursor-pointer hover:text-gold-300 transition-colors mx-auto" />
      </div>
    </aside>
  );
}
