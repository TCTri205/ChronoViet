"use client";

import React, { useState, useEffect } from "react";
import { Plus, Server, Database, Volume2, Cpu, Menu, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface NodeHealth {
  id: string;
  name: string;
  category: string;
  status: "healthy" | "degraded" | "unreachable";
  latencyMs?: number;
  info: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface HeaderProps {
  onNewProject?: () => void;
  onOpenMobileMenu?: () => void;
  activeProjectTitle?: string;
  className?: string;
}

export function Header({
  onNewProject,
  onOpenMobileMenu,
  activeProjectTitle,
  className = "",
}: HeaderProps) {
  const [nodes, setNodes] = useState<NodeHealth[]>([
    {
      id: "postgres",
      name: "Kho Tri Thức & Sử Liệu",
      category: "pgvector 1024d HNSW",
      status: "healthy",
      info: "Cơ sở tri thức lịch sử sẵn sàng",
      icon: Database,
    },
    {
      id: "redis",
      name: "Hàng Đợi Xử Lý Kết Xuất",
      category: "BullMQ & PubSub Gateway",
      status: "healthy",
      info: "Điều phối tiến trình render video",
      icon: Server,
    },
    {
      id: "tts",
      name: "Giọng Đọc Thuyết Minh VieNeu",
      category: "VieNeu Neural TTS",
      status: "healthy",
      info: "Thuyết minh đồng bộ từng từ (Karaoke)",
      icon: Volume2,
    },
    {
      id: "llm",
      name: "Mô Hình Lịch Sử AI",
      category: "Chrono-RAG Multi-Agent",
      status: "healthy",
      info: "Tổng hợp và thẩm định sử liệu",
      icon: Cpu,
    },
  ]);

  // Periodic health check fetcher querying /api/readyz with user-friendly translation
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/readyz", { method: "GET" });
        if (isMounted) {
          const data = await res.json();
          const checks = data.checks || {};

          setNodes((prev) =>
            prev.map((node) => {
              if (node.id === "postgres" && checks.postgres) {
                const pgStatus =
                  checks.postgres.status === "healthy"
                    ? "healthy"
                    : checks.postgres.status === "offline_mode"
                    ? "degraded"
                    : "unreachable";
                return {
                  ...node,
                  status: pgStatus,
                  latencyMs: checks.postgres.latencyMs,
                  info:
                    checks.postgres.info ||
                    checks.postgres.error ||
                    (pgStatus === "healthy"
                      ? "Kho tri thức pgvector (1024d HNSW) sẵn sàng"
                      : "Chế độ bộ nhớ đệm giả lập"),
                };
              }
              if (node.id === "redis" && checks.redis) {
                const redisStatus =
                  checks.redis.status === "healthy"
                    ? "healthy"
                    : checks.redis.status === "degraded"
                    ? "degraded"
                    : "unreachable";
                return {
                  ...node,
                  status: redisStatus,
                  latencyMs: checks.redis.latencyMs,
                  info: checks.redis.info || checks.redis.error || "Hàng đợi điều phối phân tán sẵn sàng",
                };
              }
              if (node.id === "tts" && checks.tts) {
                const ttsStatus =
                  checks.tts.status === "healthy"
                    ? "healthy"
                    : checks.tts.status === "degraded"
                    ? "degraded"
                    : "unreachable";
                return {
                  ...node,
                  status: ttsStatus,
                  latencyMs: checks.tts.latencyMs,
                  info: checks.tts.info || checks.tts.error || "Giọng đọc truyền cảm VieNeu sẵn sàng",
                };
              }
              if (node.id === "llm" && checks.llm) {
                const llmStatus =
                  checks.llm.status === "healthy"
                    ? "healthy"
                    : checks.llm.status === "degraded"
                    ? "degraded"
                    : "unreachable";
                return {
                  ...node,
                  status: llmStatus,
                  latencyMs: checks.llm.latencyMs,
                  info: checks.llm.info || checks.llm.error || "Hội đồng khảo cứu lịch sử sẵn sàng",
                };
              }
              return node;
            })
          );
        }
      } catch {
        if (isMounted) {
          setNodes((prev) =>
            prev.map((node) => ({
              ...node,
              status: "degraded",
              info: "Kết nối dịch vụ ngoại vi tạm thời bị chậm",
            }))
          );
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Compute aggregated system status
  const hasUnreachable = nodes.some((n) => n.status === "unreachable");
  const hasDegraded = nodes.some((n) => n.status === "degraded");
  const systemStatus: "healthy" | "degraded" | "unreachable" = hasUnreachable
    ? "unreachable"
    : hasDegraded
    ? "degraded"
    : "healthy";

  const systemStatusConfig = {
    healthy: {
      label: "Hệ Thống Di Sản Sẵn Sàng",
      dotClass: "bg-[#2ECC71] shadow-[0_0_10px_rgba(46,204,113,0.7)]",
      badgeClass: "border-[#2ECC71]/30 bg-[#1B4D3E]/20 text-[#2ECC71]",
      icon: CheckCircle2,
    },
    degraded: {
      label: "Đang Tối Ưu Hóa Tự Động",
      dotClass: "bg-[#F39C12] shadow-[0_0_10px_rgba(243,156,18,0.7)]",
      badgeClass: "border-[#F39C12]/30 bg-[#F39C12]/10 text-[#F39C12]",
      icon: AlertTriangle,
    },
    unreachable: {
      label: "Bảo Trì Hạ Tầng",
      dotClass: "bg-destructive shadow-[0_0_10px_rgba(192,57,43,0.7)]",
      badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
      icon: XCircle,
    },
  }[systemStatus];

  return (
    <header
      className={`w-full h-16 border-b border-primary/20 bg-lacquer-deep/95 backdrop-blur-md flex justify-between items-center px-4 sm:px-6 z-30 shrink-0 sticky top-0 ${className}`}
      role="banner"
    >
      {/* Left: Mobile Menu Trigger & Brand Emblem (Đông Sơn Bronze Drum) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenMobileMenu && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenMobileMenu}
            className="sm:hidden h-9 w-9 text-gold-300 hover:bg-primary/20"
            aria-label="Mở danh sách dự án"
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}

        {/* Clickable Brand Logo & Title */}
        <a
          href="/"
          className="flex items-center gap-2.5 sm:gap-3 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-lg p-1 transition-all"
          title="ChronoViet — Về trang chủ"
          aria-label="ChronoViet — Về trang chủ"
        >
          <div className="w-9 h-9 rounded-full border border-primary/50 flex items-center justify-center bg-lacquer-surface shadow-md shadow-gold-glow/30 group-hover:scale-105 group-hover:border-primary transition-all shrink-0">
            <svg
              className="w-5 h-5 text-primary group-hover:text-gold-300 transition-colors"
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

          <div className="flex flex-col text-left">
            <h1 className="font-headline font-bold text-gold-300 group-hover:text-white text-lg sm:text-xl tracking-tight leading-none flex items-center gap-2 transition-colors">
              ChronoViet
              <span className="text-[10px] font-mono font-normal tracking-normal text-text-muted px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5">
                Studio AI v1.5
              </span>
            </h1>
            <span className="text-[11px] text-text-secondary hidden sm:inline leading-tight group-hover:text-text-primary transition-colors">
              Xưởng Phim & Tra Cứu Sử Liệu Tự Động
            </span>
          </div>
        </a>
      </div>

      {/* Middle: Consolidated Heritage System Health Indicator */}
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={`hidden md:flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-full border cursor-pointer transition-all hover:brightness-110 active:scale-95 ${systemStatusConfig.badgeClass}`}
              role="status"
              aria-live="polite"
              aria-label={`Trạng thái hệ thống: ${systemStatusConfig.label}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${systemStatusConfig.dotClass}`}
                aria-hidden="true"
              />
              <span className="font-medium">{systemStatusConfig.label}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="w-80 p-3 bg-lacquer-surface border-primary/30 shadow-2xl">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                <span className="font-headline font-semibold text-xs text-gold-300">
                  Kiến Trúc Hạ Tầng Di Sản
                </span>
                <span className="text-[10px] font-mono text-text-muted">4 Tầng Phục Vụ</span>
              </div>
              <div className="space-y-2">
                {nodes.map((node) => {
                  const Icon = node.icon;
                  const isHealthy = node.status === "healthy";
                  const isDegraded = node.status === "degraded";
                  const nodeDot = isHealthy
                    ? "bg-[#2ECC71]"
                    : isDegraded
                    ? "bg-[#F39C12]"
                    : "bg-destructive";

                  return (
                    <div key={node.id} className="flex items-start gap-2.5 text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${nodeDot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium text-text-primary text-[11px] truncate">
                            {node.name}
                          </span>
                          {node.latencyMs !== undefined && (
                            <span className="text-[10px] text-text-muted font-mono tabular-nums">
                              {node.latencyMs}ms
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-text-muted leading-tight">{node.info}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Right Action: Active Context & New Project CTA */}
      <div className="flex items-center gap-3">
        {activeProjectTitle && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/20 bg-lacquer-surface text-xs max-w-[220px]">
            <span className="text-text-muted">Đang xem:</span>
            <span className="text-gold-300 font-medium truncate">
              {activeProjectTitle}
            </span>
          </div>
        )}

        <Button
          onClick={onNewProject}
          variant="heritage"
          size="sm"
          className="flex items-center gap-1.5"
          aria-label="Khởi tạo dự án video lịch sử mới"
        >
          <Plus className="w-4 h-4 text-[#08090B]" aria-hidden="true" />
          <span className="hidden sm:inline">Dự Án Mới</span>
        </Button>
      </div>
    </header>
  );
}
