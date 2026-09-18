"use client";

import React, { useState, useEffect } from "react";
import {
  Film,
  Search,
  ChevronLeft,
  ChevronRight,
  Scroll,
  Settings,
  Plus,
  Trash2,
  Pencil,
  MessageSquarePlus,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  onDeleteProject?: (projectId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onNewProject?: () => void;
  onNewConversation?: () => void;
  className?: string;
}

function getTopicInitials(topic: string): string {
  const cleaned = topic
    .trim()
    .replace(/^(?:Trận|Cuộc|Chiến dịch|Chiến thắng|Khởi nghĩa|Hội nghị)\s+/i, "");
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return "VN";
}

export function Sidebar({
  activeProjectId,
  activeConversationId,
  onSelectProject,
  onSelectConversation,
  onDeleteProject,
  onDeleteConversation,
  onNewProject,
  onNewConversation,
  className = "",
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"projects" | "conversations">("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Deletion Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "project" | "conversation";
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rename/Edit Modal State
  const [renameTarget, setRenameTarget] = useState<{
    type: "project" | "conversation";
    id: string;
    name: string;
  } | null>(null);
  const [editNameInput, setEditNameInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load actual project and conversation lists from API
  const fetchData = async () => {
    try {
      setIsLoadingList(true);
      const [projRes, convRes] = await Promise.all([
        fetch("/api/v1/projects?limit=50").catch(() => null),
        fetch("/api/v1/conversations").catch(() => null),
      ]);

      if (projRes && projRes.ok) {
        const data = await projRes.json();
        if (Array.isArray(data.items)) {
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
        if (Array.isArray(cData.conversations)) {
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
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Delete Confirmation Execution
  const handleConfirmDelete = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!deleteTarget) return;
    const { type, id, name } = deleteTarget;
    setIsDeleting(true);

    try {
      if (type === "project") {
        const res = await fetch(`/api/v1/projects/${id}`, { method: "DELETE" });
        if (res.ok) {
          setProjects((prev) => prev.filter((p) => p.id !== id));
          if (activeProjectId === id) {
            onDeleteProject ? onDeleteProject(id) : onSelectProject?.("");
          }
          toast.success(`Đã xoá dự án "${name}"`);
          setDeleteTarget(null);
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || `Xoá dự án "${name}" thất bại`);
        }
      } else {
        const res = await fetch(`/api/v1/conversations/${id}`, { method: "DELETE" });
        if (res.ok) {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (activeConversationId === id) {
            onDeleteConversation ? onDeleteConversation(id) : onSelectConversation?.("");
          }
          toast.success(`Đã xoá cuộc trò chuyện "${name}"`);
          setDeleteTarget(null);
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || `Xoá cuộc trò chuyện "${name}" thất bại`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi mạng khi kết nối tới máy chủ");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Rename / Edit Submission
  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !editNameInput.trim()) return;
    const { type, id } = renameTarget;
    const newName = editNameInput.trim();
    setIsUpdating(true);

    try {
      if (type === "project") {
        const res = await fetch(`/api/v1/projects/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: newName }),
        });
        if (res.ok) {
          setProjects((prev) =>
            prev.map((p) => (p.id === id ? { ...p, topic: newName } : p))
          );
        }
      } else {
        const res = await fetch(`/api/v1/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newName }),
        });
        if (res.ok) {
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, title: newName } : c))
          );
        }
      }
    } catch {
      // failed gracefully
    } finally {
      setIsUpdating(false);
      setRenameTarget(null);
    }
  };

  // Create new conversation handler
  const handleCreateNewConversation = async () => {
    if (onNewConversation) {
      onNewConversation();
      return;
    }
    const newConvId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      const res = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newConvId,
          title: "Cuộc trò chuyện mới",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const conv = data.conversation;
        setConversations((prev) => [
          {
            id: conv.id,
            title: conv.title,
            updatedAt: "Vừa tạo",
          },
          ...prev,
        ]);
        onSelectConversation?.(conv.id);
      }
    } catch {
      onSelectConversation?.(newConvId);
    }
  };

  const filteredProjects = projects.filter((p) =>
    (p?.topic || "").toLowerCase().includes((searchQuery || "").toLowerCase())
  );

  const filteredConversations = conversations.filter((c) =>
    (c?.title || "").toLowerCase().includes((searchQuery || "").toLowerCase())
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

      {/* Tab Switcher: Expanded vs Collapsed Rail */}
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-1 border-b border-primary/10 py-2">
          <button
            onClick={() => setActiveTab("projects")}
            className={`w-10 h-9 rounded-lg flex items-center justify-center text-xs transition-colors ${
              activeTab === "projects"
                ? "bg-primary/20 text-gold-300 border border-primary/40 shadow-sm"
                : "text-text-muted hover:text-text-primary hover:bg-lacquer-elevated"
            }`}
            aria-label="Xem danh sách dự án phim"
            title="Dự án phim"
          >
            <Film className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab("conversations")}
            className={`w-10 h-9 rounded-lg flex items-center justify-center text-xs transition-colors ${
              activeTab === "conversations"
                ? "bg-primary/20 text-gold-300 border border-primary/40 shadow-sm"
                : "text-text-muted hover:text-text-primary hover:bg-lacquer-elevated"
            }`}
            aria-label="Xem danh sách đoạn chat sử liệu"
            title="Đoạn chat sử liệu"
          >
            <Scroll className="w-4 h-4" />
          </button>
        </div>
      ) : (
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

      {/* Action Header: Search & Create New Button */}
      {!isCollapsed && (
        <div className="p-2.5 border-b border-primary/10 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-muted" />
            <Input
              type="text"
              placeholder={activeTab === "projects" ? "Tìm thước phim..." : "Tìm đoạn chat..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-lacquer-deep/60 border-primary/20"
            />
          </div>
          {activeTab === "projects" ? (
            <Button
              onClick={onNewProject}
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs border-dashed border-primary/40 hover:border-primary text-gold-300 hover:bg-primary/10 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo thước phim mới</span>
            </Button>
          ) : (
            <Button
              onClick={handleCreateNewConversation}
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs border-dashed border-primary/40 hover:border-primary text-gold-300 hover:bg-primary/10 flex items-center justify-center gap-1.5"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Tạo cuộc trò chuyện mới</span>
            </Button>
          )}
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
                  <p className="text-[11px] text-text-muted/70 mt-1">Tạo thước phim mới ở nút bên trên</p>
                </div>
              )
            ) : (
              filteredProjects.map((proj) => {
                const isActive = activeProjectId === proj.id;
                const initials = getTopicInitials(proj.topic);

                if (isCollapsed) {
                  return (
                    <Tooltip key={proj.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onSelectProject?.(proj.id)}
                          className={`w-full h-11 rounded-lg flex flex-col items-center justify-center transition-colors ${
                            isActive
                              ? "bg-primary/20 text-gold-300 border border-primary/40 shadow-sm"
                              : "text-text-secondary hover:bg-lacquer-elevated hover:text-text-primary"
                          }`}
                          aria-label={proj.topic}
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-mono font-bold leading-none mt-0.5 text-gold-300">
                            {initials}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="flex flex-col gap-1 max-w-[220px]">
                          <span className="font-semibold text-gold-300 truncate">{proj.topic}</span>
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
                  <div
                    key={proj.id}
                    className={`group relative w-full p-2.5 rounded-lg text-left transition-all border cursor-pointer ${
                      isActive
                        ? "bg-primary/10 border-primary/40 text-gold-300 shadow-sm"
                        : "bg-lacquer-deep/40 border-primary/10 text-text-secondary hover:border-primary/25 hover:text-text-primary hover:bg-lacquer-deep/60"
                    }`}
                    onClick={() => onSelectProject?.(proj.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        onSelectProject?.(proj.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-medium text-xs text-text-primary line-clamp-2 leading-snug pr-12">
                        {proj.topic}
                      </span>
                    </div>

                    {/* Action Bar (Hover on desktop, subtly visible on mobile touch) */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-75 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-lacquer-surface/90 backdrop-blur-sm rounded px-1 py-0.5 border border-primary/20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTarget({ type: "project", id: proj.id, name: proj.topic });
                          setEditNameInput(proj.topic);
                        }}
                        className="p-1 text-text-muted hover:text-gold-300 hover:bg-primary/20 rounded transition-colors"
                        title="Đổi tên chủ đề"
                        aria-label={`Đổi tên dự án ${proj.topic}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ type: "project", id: proj.id, name: proj.topic });
                        }}
                        className="p-1 text-text-muted hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                        title="Xoá dự án"
                        aria-label={`Xoá dự án ${proj.topic}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-text-muted mt-2">
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(proj.status)}
                        <span className="font-mono">{proj.aspectRatio || "16:9"}</span>
                      </div>
                      <span className="tabular-nums">{proj.createdAt}</span>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            filteredConversations.length === 0 ? (
              !isCollapsed && (
                <div className="p-4 text-center text-text-muted text-xs flex flex-col items-center justify-center min-h-[140px]">
                  <Scroll className="w-6 h-6 mb-2 opacity-30 text-gold-300" />
                  <p className="font-medium text-text-secondary">Chưa có đoạn chat nào</p>
                  <p className="text-[11px] text-text-muted/70 mt-1">Bắt đầu tra cứu ở nút tạo mới</p>
                </div>
              )
            ) : (
              filteredConversations.map((conv) => {
                const isActive = activeConversationId === conv.id;

                if (isCollapsed) {
                  return (
                    <Tooltip key={conv.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onSelectConversation?.(conv.id)}
                          className={`w-full h-11 rounded-lg flex items-center justify-center transition-colors relative ${
                            isActive
                              ? "bg-primary/20 text-gold-300 border border-primary/40 shadow-sm"
                              : "text-text-secondary hover:bg-lacquer-elevated hover:text-text-primary"
                          }`}
                          aria-label={conv.title}
                        >
                          <Scroll className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div className="flex flex-col gap-0.5 max-w-[200px]">
                          <span className="font-semibold text-gold-300 truncate">{conv.title}</span>
                          <span className="text-[10px] text-text-muted">{conv.updatedAt}</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation?.(conv.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        onSelectConversation?.(conv.id);
                      }
                    }}
                    className={`group relative w-full p-2.5 rounded-lg text-left transition-all border cursor-pointer ${
                      isActive
                        ? "bg-primary/15 border-primary/40 text-gold-300 shadow-sm"
                        : "bg-lacquer-deep/40 border-primary/10 text-text-secondary hover:border-primary/25 hover:text-text-primary hover:bg-lacquer-deep/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-xs text-text-primary line-clamp-2 leading-snug block pr-12">
                        {conv.title}
                      </span>
                    </div>

                    {/* Action Bar (Hover on desktop, subtly visible on mobile touch) */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-75 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-lacquer-surface/90 backdrop-blur-sm rounded px-1 py-0.5 border border-primary/20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTarget({ type: "conversation", id: conv.id, name: conv.title });
                          setEditNameInput(conv.title);
                        }}
                        className="p-1 text-text-muted hover:text-gold-300 hover:bg-primary/20 rounded transition-colors"
                        title="Đổi tiêu đề"
                        aria-label={`Đổi tiêu đề đoạn chat ${conv.title}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ type: "conversation", id: conv.id, name: conv.title });
                        }}
                        className="p-1 text-text-muted hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                        title="Xoá đoạn chat"
                        aria-label={`Xoá đoạn chat ${conv.title}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-[10px] text-text-muted mt-1.5 block">
                      {conv.updatedAt}
                    </span>
                  </div>
                );
              })
            )
          )}
        </TooltipProvider>
      </div>

      {/* Footer Info & Interactive Settings Trigger */}
      <div className="p-3 border-t border-primary/10 flex items-center justify-between text-xs text-text-muted">
        {!isCollapsed && (
          <span className="text-[11px] font-mono">ChronoViet v1.5</span>
        )}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="p-1 rounded-md text-text-muted hover:text-gold-300 hover:bg-primary/15 transition-colors mx-auto cursor-pointer focus-visible:ring-1 focus-visible:ring-primary"
          title="Thông tin hệ thống & Phím tắt bàn phím"
          aria-label="Thông tin hệ thống và phím tắt bàn phím"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === "project" ? "Xác nhận xoá dự án" : "Xác nhận xoá đoạn chat"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "project" ? (
                <>
                  Bạn có chắc chắn muốn xoá dự án{" "}
                  <strong className="text-gold-300 font-semibold">&ldquo;{deleteTarget?.name}&rdquo;</strong>?
                  Toàn bộ kịch bản, âm thanh và tệp video kết xuất sẽ bị xoá vĩnh viễn khỏi hệ thống.
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn xoá cuộc trò chuyện{" "}
                  <strong className="text-gold-300 font-semibold">&ldquo;{deleteTarget?.name}&rdquo;</strong>?
                  Toàn bộ lịch sử tin nhắn sẽ bị xoá khỏi cơ sở dữ liệu.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Huỷ bỏ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {isDeleting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang xoá...
                </span>
              ) : (
                "Xác nhận xoá"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename / Edit Modal */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <form onSubmit={handleConfirmRename}>
            <DialogHeader>
              <DialogTitle>
                {renameTarget?.type === "project" ? "Đổi tên chủ đề dự án" : "Đổi tiêu đề đoạn chat"}
              </DialogTitle>
              <DialogDescription>
                Nhập tên mới cho {renameTarget?.type === "project" ? "thước phim lịch sử" : "cuộc trò chuyện sử liệu"}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                type="text"
                value={editNameInput}
                onChange={(e) => setEditNameInput(e.target.value)}
                placeholder="Nhập tên mới..."
                className="bg-lacquer-deep/60 border-primary/30 text-text-primary"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
                disabled={isUpdating}
              >
                Huỷ
              </Button>
              <Button
                type="submit"
                variant="heritage"
                disabled={isUpdating || !editNameInput.trim()}
              >
                {isUpdating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang lưu...
                  </span>
                ) : (
                  "Lưu thay đổi"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* System Settings & Shortcuts Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-md bg-lacquer-surface border border-primary/30 text-text-primary">
          <DialogHeader>
            <DialogTitle className="font-headline text-lg text-gold-300 flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              <span>Cấu Hình & Thông Tin Hệ Thống</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary">
              Kiến trúc hạ tầng ChronoViet AI Studio v1.5 & danh sách phím tắt điều khiển.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* System Info Box */}
            <div className="p-3 rounded-lg bg-lacquer-deep/70 border border-primary/20 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-text-muted">Phiên bản:</span>
                <span className="text-gold-300">ChronoViet Studio v1.5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Đồ thị tri thức:</span>
                <span className="text-text-primary">pgvector 1024d HNSW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Giọng đọc thuyết minh:</span>
                <span className="text-text-primary">VieNeu Neural TTS (Port 8080)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Xưởng render video:</span>
                <span className="text-text-primary">Remotion 1080p Engine</span>
              </div>
            </div>

            {/* Keyboard Shortcuts Box */}
            <div className="space-y-2">
              <span className="font-semibold text-gold-300 text-xs block font-headline">
                Phím Tắt Thao Tác Nhanh
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between p-2 rounded bg-lacquer-deep/50 border border-primary/10">
                  <span className="text-text-secondary">Phát / Dừng video</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-primary/30 font-mono text-[10px] text-gold-300">
                    Space
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-lacquer-deep/50 border border-primary/10">
                  <span className="text-text-secondary">Bật / Tắt âm</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-primary/30 font-mono text-[10px] text-gold-300">
                    M
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-lacquer-deep/50 border border-primary/10">
                  <span className="text-text-secondary">Toàn màn hình</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-primary/30 font-mono text-[10px] text-gold-300">
                    F
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-lacquer-deep/50 border border-primary/10">
                  <span className="text-text-secondary">Đóng modal / Thoát</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-primary/30 font-mono text-[10px] text-gold-300">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="heritage"
              onClick={() => setIsSettingsOpen(false)}
              className="w-full h-8 text-xs font-semibold"
            >
              Đã hiểu & Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
