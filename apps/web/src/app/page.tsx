"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { VideoGeneratorPanel } from "@/components/video/VideoGeneratorPanel";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { MessageSquare, Film } from "lucide-react";

export default function MasterWorkspacePage() {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [videoTopic, setVideoTopic] = useState<string>("");
  const [mobileActiveTab, setMobileActiveTab] = useState<"chat" | "studio">(
    "chat"
  );
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

  // Sync isDesktop breakpoint (1024px = Tailwind lg) to avoid dual-mounting panels
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // Restore active project from localStorage or query params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("projectId");
      const convId = params.get("conversationId");
      if (queryId) {
        setActiveProjectId(queryId);
      }
      if (convId) {
        setActiveConversationId(convId);
      }
    }
  }, []);

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setMobileActiveTab("studio");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("projectId", projectId);
      window.history.pushState({}, "", url.toString());
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setMobileActiveTab("chat");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("conversationId", conversationId);
      window.history.pushState({}, "", url.toString());
    }
  };

  const handleNewProject = () => {
    setActiveProjectId(null);
    setVideoTopic("");
    setMobileActiveTab("studio");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("projectId");
      window.history.pushState({}, "", url.toString());
    }
  };

  const handleDeleteProject = (projectId: string) => {
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
      setVideoTopic("");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("projectId");
        window.history.pushState({}, "", url.toString());
      }
    }
  };

  const handleDeleteConversation = (conversationId: string) => {
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("conversationId");
        window.history.pushState({}, "", url.toString());
      }
    }
  };

  const handleNewConversation = () => {
    const newConvId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    handleSelectConversation(newConvId);
  };

  const handleHandoverFromChat = (topic: string, conversationId?: string) => {
    setActiveProjectId(null);
    setVideoTopic(topic);
    if (conversationId) {
      setActiveConversationId(conversationId);
    }
    setMobileActiveTab("studio");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("projectId");
      window.history.pushState({}, "", url.toString());
    }
  };

  return (
    <div className="flex flex-col h-dvh w-full bg-lacquer-deep bg-lacquer-grain text-text-primary overflow-hidden">
      {/* Top Application Header */}
      <Header
        activeProjectTitle={videoTopic || undefined}
        onNewProject={handleNewProject}
        onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
      />

      {/* Mobile Navigation Drawer */}
      <Sheet open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
        <SheetContent side="left" className="p-0 w-80 bg-lacquer-surface border-r border-primary/20">
          <SheetHeader className="sr-only">
            <SheetTitle>Kho Lưu Trữ Dự Án & Đoạn Chat</SheetTitle>
            <SheetDescription>Chọn hoặc tìm kiếm các thước phim và cuộc trò chuyện lịch sử</SheetDescription>
          </SheetHeader>
          <Sidebar
            activeProjectId={activeProjectId || undefined}
            activeConversationId={activeConversationId || undefined}
            onSelectProject={(id) => {
              handleSelectProject(id);
              setIsMobileDrawerOpen(false);
            }}
            onSelectConversation={(id) => {
              handleSelectConversation(id);
              setIsMobileDrawerOpen(false);
            }}
            onDeleteProject={handleDeleteProject}
            onDeleteConversation={handleDeleteConversation}
            onNewProject={() => {
              handleNewProject();
              setIsMobileDrawerOpen(false);
            }}
            onNewConversation={() => {
              handleNewConversation();
              setIsMobileDrawerOpen(false);
            }}
            className="w-full h-full border-r-0"
          />
        </SheetContent>
      </Sheet>

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
          activeConversationId={activeConversationId || undefined}
          onSelectProject={handleSelectProject}
          onSelectConversation={handleSelectConversation}
          onDeleteProject={handleDeleteProject}
          onDeleteConversation={handleDeleteConversation}
          onNewProject={handleNewProject}
          onNewConversation={handleNewConversation}
          className="hidden sm:flex"
        />

        {/* Desktop Split View (>= 1024px) vs Mobile Tabbed Container (< 1024px) */}
        {/* Strictly conditional rendering to ensure only ONE instance of VideoGeneratorPanel and ChatContainer are mounted */}
        {isDesktop ? (
          <div className="flex flex-1 h-full overflow-hidden">
            <ResizablePanelGroup direction="horizontal">
              {/* Left/Middle Column: Knowledge Chat Hub (45%) */}
              <ResizablePanel defaultSize={45} minSize={30}>
                <ChatContainer
                  activeConversationId={activeConversationId}
                  onSelectConversation={setActiveConversationId}
                  onHandoverToVideo={handleHandoverFromChat}
                />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Right Column: 1-Click Autonomous Video Generator & Showcase (55%) */}
              <ResizablePanel defaultSize={55} minSize={35}>
                <VideoGeneratorPanel
                  initialTopic={videoTopic}
                  initialConversationId={activeConversationId || undefined}
                  activeProjectId={activeProjectId}
                  onNewProject={handleNewProject}
                  onProjectCreated={(id) => {
                    setActiveProjectId(id);
                  }}
                  onProjectCompleted={() => {
                    // VideoGeneratorPanel switches automatically to SHOWCASE
                  }}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        ) : (
          <div className="flex-1 h-full overflow-hidden">
            {mobileActiveTab === "chat" ? (
              <ChatContainer
                activeConversationId={activeConversationId}
                onSelectConversation={setActiveConversationId}
                onHandoverToVideo={handleHandoverFromChat}
              />
            ) : (
              <VideoGeneratorPanel
                initialTopic={videoTopic}
                initialConversationId={activeConversationId || undefined}
                activeProjectId={activeProjectId}
                onNewProject={handleNewProject}
                onProjectCreated={(id) => {
                  setActiveProjectId(id);
                }}
                onProjectCompleted={() => {
                  // VideoGeneratorPanel switches automatically to SHOWCASE
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
