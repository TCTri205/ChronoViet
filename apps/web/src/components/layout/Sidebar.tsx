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

export interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
}

export interface SidebarProps {
  activeProjectId?: string;
  activeConversationId?: string;
  onSelectProject?: (projectId: string) => void;
  onSelectConversation?: (conversationId: string) => void;
  className?: string;
}

export function Sidebar({
  activeProjectId,
  activeConversationId,
  onSelectProject,
  onSelectConversation,
  className = "",
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"projects" | "conversations">("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  // Load actual project and conversation lists from API
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [projRes, convRes] = await Promise.all([
          fetch("/api/v1/projects?limit=20").catch(() => null),
          fetch("/api/v1/conversations").catch(() => null),
        ]);

        if (projRes && projRes.ok) {
          const data = await projRes.json();
          if (isMounted && Array.isArray(data.items)) {
            const normalized: ProjectItem[] = data.items.map((item: any) => ({
              id: item.id || item.projectId,
              topic: item.topic || item.title || item.projectId || "Chủ đề chưa đặt tên",
              status: item.status || "INIT",
              aspectRatio: item.aspectRatio || "16:9",
              durationSeconds: item.durationSeconds || item.targetDurationSeconds,
              createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : "Gần đây",
            }));
            setProjects(normalized);
          }
        }

        if (convRes && convRes.ok) {
          const cData = await convRes.json();
          if (isMounted && Array.isArray(cData.conversations)) {
            setConversations(
              cData.conversations.map((c: any) => ({
                id: c.id,
                title: c.title || "Đoạn trao đổi sử liệu",
                updatedAt: c.updatedAt ? new Date(c.updatedAt).toLocaleDateString("vi-VN") : "Gần đây",
              }))
            );
          }
        }
      } catch {
        // keep initial defaults
      }
    };
    fetchData();
  }, []);

  const filteredProjects = projects.filter((p) =>
    (p?.topic || "").toLowerCase().includes((searchQuery || "").toLowerCase())
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

      {/* Tab Switcher (when expanded) */}
      {!isCollapsed && (
        <div className="flex border-b border-primary/10 bg-lacquer-deep/40 text-xs">
          <button
            onClick={() => setActiveTab("projects")}
            className={`flex-1 py-2 font-semibold text-center transition-colors border-b-2 ${
              activeTab === "projects"
                ? "border-primary text-gold-300 bg-primary/10"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            🎬 Dự Án ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab("conversations")}
            className={`flex-1 py-2 font-semibold text-center transition-colors border-b-2 ${
              activeTab === "conversations"
                ? "border-primary text-gold-300 bg-primary/10"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            💬 Đoạn Chat ({conversations.length})
          </button>
        </div>
      )}

      {/* Search Input (only visible when expanded) */}
      {!isCollapsed && (
        <div className="p-2.5 border-b border-primary/10">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-muted" />
            <Input
              type="text"
              placeholder={activeTab === "projects" ? "Tìm thước phim..." : "Tìm đoạn chat..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-lacquer-deep/60"
            />
          </div>
        </div>
      )}

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <TooltipProvider delayDuration={150}>
          {activeTab === "projects" ? (
            filteredProjects.length === 0 ? (
              !isCollapsed && (
                <div className="p-4 text-center text-text-muted text-xs flex flex-col items-center justify-center min-h-[140px]">
                  <Film className="w-6 h-6 mb-2 opacity-30 text-gold-300" />
                  <p className="font-medium text-text-secondary">Chưa có dự án nào</p>
                  <p className="text-[11px] text-text-muted/70 mt-1">Tạo thước phim mới ở khung bên phải</p>
                </div>
              )
            ) : (
              filteredProjects.map((proj) => {
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
              })
            )
          ) : (
            conversations.filter((c) => (c.title || "").toLowerCase().includes((searchQuery || "").toLowerCase())).length === 0 ? (
              !isCollapsed && (
                <div className="p-4 text-center text-text-muted text-xs flex flex-col items-center justify-center min-h-[140px]">
                  <Scroll className="w-6 h-6 mb-2 opacity-30 text-gold-300" />
                  <p className="font-medium text-text-secondary">Chưa có đoạn chat nào</p>
                  <p className="text-[11px] text-text-muted/70 mt-1">Bắt đầu tra cứu ở khung bên trái</p>
                </div>
              )
            ) : (
              conversations
                .filter((c) => (c.title || "").toLowerCase().includes((searchQuery || "").toLowerCase()))
                .map((conv) => {
                  const isActive = activeConversationId === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => onSelectConversation?.(conv.id)}
                      className={`w-full p-2.5 rounded-lg text-left transition-all border ${
                        isActive
                          ? "bg-primary/15 border-primary/40 text-gold-300 shadow-sm"
                          : "bg-lacquer-deep/40 border-primary/10 text-text-secondary hover:border-primary/25 hover:text-text-primary"
                      }`}
                    >
                      <span className="font-medium text-xs text-text-primary line-clamp-2 leading-snug block">
                        {conv.title}
                      </span>
                      <span className="text-[10px] text-text-muted mt-1 block">
                        {conv.updatedAt}
                      </span>
                    </button>
                  );
                })
            )
          )}
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
