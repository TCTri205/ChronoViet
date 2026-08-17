"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { VideoGeneratorPanel } from "@/components/video/VideoGeneratorPanel";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { MessageSquare, Film, X, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MasterWorkspacePage() {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    "proj_bach_dang_1288"
  );
  const [videoTopic, setVideoTopic] = useState<string>(
    "Chiến Thắng Bạch Đằng Năm 1288"
  );
  const [mobileActiveTab, setMobileActiveTab] = useState<"chat" | "studio">(
    "chat"
  );
  const [isTheaterDockOpen, setIsTheaterDockOpen] = useState(true);

  // Restore active project from localStorage or query params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("projectId");
      if (queryId) {
        setActiveProjectId(queryId);
      }
    }
  }, []);

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("projectId", projectId);
      window.history.pushState({}, "", url.toString());
    }
  };

  const handleNewProject = () => {
    const newId = `proj_${Date.now()}`;
    setActiveProjectId(newId);
    setVideoTopic("");
    setIsTheaterDockOpen(false);
    setMobileActiveTab("studio");
  };

  const handleHandoverFromChat = (topic: string) => {
    setVideoTopic(topic);
    setMobileActiveTab("studio");
  };

  return (
    <div className="flex flex-col h-dvh w-full bg-lacquer-deep bg-lacquer-grain text-text-primary overflow-hidden">
      {/* Top Application Header */}
      <Header
        activeProjectTitle={videoTopic || undefined}
        onNewProject={handleNewProject}
      />

      {/* Mobile Tab Switcher (< 1024px) */}
      <div className="lg:hidden flex border-b border-primary/20 bg-lacquer-surface shrink-0 z-20">
        <button
          onClick={() => setMobileActiveTab("chat")}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
            mobileActiveTab === "chat"
              ? "border-primary text-gold-300 bg-primary/10"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
          aria-label="Chuyển sang tab Tra cứu sử liệu"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>💬 Tra Cứu Sử Liệu</span>
        </button>
        <button
          onClick={() => setMobileActiveTab("studio")}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
            mobileActiveTab === "studio"
              ? "border-primary text-gold-300 bg-primary/10"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
          aria-label="Chuyển sang tab Xưởng phim AI"
        >
          <Film className="w-3.5 h-3.5" />
          <span>🎬 Xưởng Phim AI</span>
        </button>
      </div>

      {/* Main Responsive Workspace */}
      <main
        id="main-workspace"
        className="flex-1 flex overflow-hidden relative"
      >
        {/* Left Side Navigation (Desktop History Rail & Panel) */}
        <Sidebar
          activeProjectId={activeProjectId || undefined}
          onSelectProject={handleSelectProject}
          className="hidden sm:flex"
        />

        {/* Desktop Split View (>= 1024px) */}
        <div className="hidden lg:flex flex-1 h-full overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Left/Middle Column: Knowledge Chat Hub (45%) */}
            <ResizablePanel defaultSize={45} minSize={30}>
              <ChatContainer onHandoverToVideo={handleHandoverFromChat} />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Column: 1-Click Autonomous Video Generator (55%) */}
            <ResizablePanel defaultSize={55} minSize={35}>
              <VideoGeneratorPanel
                initialTopic={videoTopic}
                activeProjectId={activeProjectId}
                onProjectCreated={(id) => {
                  setActiveProjectId(id);
                  setIsTheaterDockOpen(false);
                }}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Mobile View (< 1024px) Tabbed Container */}
        <div className="lg:hidden flex-1 h-full overflow-hidden">
          {mobileActiveTab === "chat" ? (
            <ChatContainer onHandoverToVideo={handleHandoverFromChat} />
          ) : (
            <VideoGeneratorPanel
              initialTopic={videoTopic}
              activeProjectId={activeProjectId}
              onProjectCreated={(id) => {
                setActiveProjectId(id);
                setIsTheaterDockOpen(false);
              }}
            />
          )}
        </div>

        {/* Floating Theater Dock (Slides up when active or completed) */}
        {isTheaterDockOpen && activeProjectId && (
          <div className="absolute bottom-4 right-4 z-40 w-full max-w-lg animate-in slide-in-from-bottom-6 duration-300 shadow-2xl">
            <div className="relative">
              <button
                onClick={() => setIsTheaterDockOpen(false)}
                className="absolute -top-3 -right-2 z-50 p-1 rounded-full bg-lacquer-elevated border border-primary/40 text-text-secondary hover:text-white shadow-lg cursor-pointer"
                aria-label="Thu nhỏ trình phát"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <VideoPlayer
                projectId={activeProjectId}
                projectTitle={videoTopic || "Thước Phim Lịch Sử"}
              />
            </div>
          </div>
        )}

        {/* Minimized Dock Button */}
        {!isTheaterDockOpen && activeProjectId && (
          <button
            onClick={() => setIsTheaterDockOpen(true)}
            className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-xs shadow-xl shadow-gold-glow/50 hover:brightness-110 cursor-pointer border border-gold-300"
            aria-label="Mở lại trình phát video"
          >
            <Film className="w-4 h-4 fill-current" />
            <span>Xem Video Thành Phẩm</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        )}
      </main>
    </div>
  );
}
