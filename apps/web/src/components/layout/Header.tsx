"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Plus, Circle, Server, Database, Volume2, Cpu, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export interface NodeHealth {
  name: string;
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
  activeProjectTitle = "Chiến Thắng Bạch Đằng 1288",
  className = "",
}: HeaderProps) {
  const [nodes, setNodes] = useState<NodeHealth[]>([
    {
      name: "Postgres",
      status: "degraded",
      info: "Đang kiểm tra...",
      icon: Database,
    },
    {
      name: "Redis",
      status: "degraded",
      info: "Đang kiểm tra...",
      icon: Server,
    },
    {
      name: "VieNeu TTS",
      status: "unreachable",
      info: "Đang kiểm tra...",
      icon: Volume2,
    },
    {
      name: "LLM Agnes",
      status: "unreachable",
      info: "Đang kiểm tra...",
      icon: Cpu,
    },
  ]);

  // Periodic health check fetcher querying /api/readyz with real-time mapping
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
              if (node.name === "Postgres" && checks.postgres) {
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
                      ? "pgvector (1024d HNSW index ready)"
                      : "PostgreSQL offline / Mock memory mode"),
                };
              }
              if (node.name === "Redis" && checks.redis) {
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
                  info: checks.redis.info || checks.redis.error || "BullMQ & PubSub Gateway",
                };
              }
              if (node.name === "VieNeu TTS" && checks.tts) {
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
                  info: checks.tts.info || checks.tts.error || "VieNeu TTS Engine",
                };
              }
              if (node.name === "LLM Agnes" && checks.llm) {
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
                  info: checks.llm.info || checks.llm.error || "LLM Engine",
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
              status: "unreachable",
              info: "Không thể kết nối tới Web API Server",
            }))
          );
        }
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header
      className={`w-full h-16 border-b border-primary/20 bg-lacquer-deep/90 backdrop-blur-md flex justify-between items-center px-4 sm:px-6 z-30 shrink-0 sticky top-0 ${className}`}
      role="banner"
    >
      {/* Left: Mobile Menu Trigger & Brand Emblem */}
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
        <div className="w-9 h-9 rounded-full border border-primary/50 flex items-center justify-center bg-lacquer-surface shadow-md shadow-gold-glow/20 shrink-0">
          <span className="text-primary text-lg font-headline font-bold">🇻🇳</span>
        </div>
        <div className="flex flex-col">
          <h1 className="font-headline font-bold text-gold-300 text-lg sm:text-xl tracking-tight leading-none flex items-center gap-2">
            ChronoViet
            <span className="text-[10px] font-mono font-normal tracking-normal text-text-muted px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5">
              Studio AI v1.5
            </span>
          </h1>
          <span className="text-[11px] text-text-secondary hidden sm:inline leading-tight">
            Xưởng Phim & Tra Cứu Sử Liệu Tự Động
          </span>
        </div>
      </div>

      {/* Multi-Node Infrastructure Health Monitor */}
      <TooltipProvider delayDuration={150}>
        <div
          className="hidden md:flex items-center gap-4 text-xs font-mono text-text-secondary bg-lacquer-surface/80 px-3 py-1.5 rounded-full border border-primary/15"
          role="status"
          aria-live="polite"
        >
          {nodes.map((node) => {
            const Icon = node.icon;
            const isHealthy = node.status === "healthy";
            const isDegraded = node.status === "degraded";
            const statusDotClass = isHealthy
              ? "bg-[#2ECC71] shadow-[0_0_8px_rgba(46,204,113,0.6)]"
              : isDegraded
              ? "bg-[#F39C12] shadow-[0_0_8px_rgba(243,156,18,0.6)]"
              : "bg-destructive shadow-[0_0_8px_rgba(192,57,43,0.6)]";

            return (
              <Tooltip key={node.name}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary transition-colors">
                    <span
                      className={`w-2 h-2 rounded-full ${statusDotClass}`}
                      aria-hidden="true"
                    />
                    <Icon className="w-3.5 h-3.5 opacity-70" />
                    <span>{node.name}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-gold-300">{node.name}</span>
                    <span className="text-[11px] text-text-secondary">{node.info}</span>
                    {node.latencyMs !== undefined && (
                      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        Độ trễ: {node.latencyMs}ms
                      </span>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
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
