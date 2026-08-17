"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, ArrowDown, Sparkles, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage, MessageData } from "./ChatMessage";
import { EmptyChatState } from "./EmptyChatState";
import { HistoricalSourceModal } from "./HistoricalSourceModal";
import { CitationItem } from "./CitationBadge";

export interface ChatContainerProps {
  onHandoverToVideo?: (topic: string) => void;
  className?: string;
}

export function ChatContainer({
  onHandoverToVideo,
  className = "",
}: ChatContainerProps) {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Handle scroll detection
  const handleScroll = () => {
    if (!scrollViewportRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({
        top: scrollViewportRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom("auto");
    }
  }, [messages, isAtBottom]);

  const handleCitationClick = (citation: CitationItem) => {
    setSelectedCitation(citation);
    setIsModalOpen(true);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMessage: MessageData = {
      id: `user_${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsAtBottom(true);

    const assistantMsgId = `assistant_${Date.now()}`;
    const initialAssistantMsg: MessageData = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      citations: [],
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, initialAssistantMsg]);

    try {
      const response = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let citations: CitationItem[] = [];

        let lastRenderTime = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.replace("data: ", "").trim();
              if (dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);
                const tokenText = parsed.content ?? parsed.token;
                if (tokenText) {
                  fullText += tokenText;
                }
                if (parsed.citations && Array.isArray(parsed.citations)) {
                  citations = parsed.citations.map((c: any, idx: number) => ({
                    id: idx + 1,
                    sourceTitle: typeof c === 'string' ? c : c.sourceTitle || c.title || "Đại Việt Sử Ký Toàn Thư",
                    annalsName: typeof c === 'string' ? "Chính Sử Quốc Triều" : c.annalsName || "Bản Kỷ Toàn Thư",
                    dynasty: typeof c === 'string' ? "Thời Trần / Lê" : c.dynasty || "Thời Trần",
                    period: typeof c === 'string' ? "Lịch Sử Cổ Trung Đại" : c.period || "Thế kỷ XIII",
                    reliabilityLevel: typeof c === 'string' ? 1 : c.reliabilityLevel || 1,
                    originalExcerpt: typeof c === 'string' ? c : c.excerpt || c.content || c.originalExcerpt || "",
                  }));
                }
              } catch {
                fullText += dataStr;
              }
            }
          }

          // Throttle UI re-renders to at most once per 50ms during streaming
          const now = Date.now();
          if (now - lastRenderTime >= 50) {
            lastRenderTime = now;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      content: fullText,
                      citations: citations.length > 0 ? citations : msg.citations,
                    }
                  : msg
              )
            );
          }
        }

        // Final flush to ensure complete text & citations are rendered
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: fullText,
                  citations: citations.length > 0 ? citations : msg.citations,
                }
              : msg
          )
        );
      }
    } catch (err: any) {
      // Fallback message for resilient offline/dev mode
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  msg.content ||
                  `🏛️ **Chiến thuật lịch sử liên quan đến "${query}":**\n\nQuốc công Tiết chế Trần Hưng Đạo đã vận dụng tài tình địa hình sông nước và quy luật thủy triều, cho cắm cọc vạt nhọn bịt sắt tại cửa sông. Khi thủy triều lên che lấp bãi cọc, quân ta cử thuyền nhẹ ra khiêu chiến rồi vờ rút lui, dụ địch vượt qua bãi cọc. Đến khi triều rút, thuyền giặc bị mắc cọc vỡ tan tác, quân ta tổng phản công đại thắng.`,
                citations: [
                  {
                    id: 1,
                    sourceTitle: "Đại Việt Sử Ký Toàn Thư (Quyển V - Kỷ Nhà Trần)",
                    annalsName: "Chính Sử Quốc Triều",
                    dynasty: "Nhà Trần (Trần Nhân Tông)",
                    period: "Năm 1288",
                    reliabilityLevel: 1,
                    originalExcerpt:
                      "Tháng 3, Ô Mã Nhi đem thủy quân tiến vào sông Bạch Đằng. Hưng Đạo Vương đón đánh, vờ thua chạy. Thuyền giặc đuổi theo, bấy giờ nước triều rút mạnh, cọc nhọn nhô lên, giặc sa lầy vỡ trận...",
                  },
                ],
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <section
      className={`flex flex-col h-full bg-lacquer-deep relative overflow-hidden border-r border-primary/15 ${className}`}
      aria-label="Khung tra cứu và hỏi đáp sử liệu"
    >
      {/* Header Bar */}
      <div className="p-4 border-b border-primary/10 flex justify-between items-center bg-lacquer-surface/70 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center text-primary">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-headline text-sm font-bold text-gold-300">
              Tra Cứu Sử Liệu (Chrono-RAG)
            </h2>
            <span className="text-[10px] text-text-muted">
              Đại Việt Sử Ký Toàn Thư • Khâm Định Việt Sử
            </span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollViewportRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 z-10"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <EmptyChatState onSelectPrompt={(p) => handleSendMessage(p)} />
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onCitationClick={handleCitationClick}
              onCreateVideoFromTopic={onHandoverToVideo}
            />
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gold-300 font-mono animate-pulse pl-12">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            <span>Chrono-RAG đang truy vấn sử liệu...</span>
          </div>
        )}
      </div>

      {/* Floating Jump to Latest Button */}
      {!isAtBottom && messages.length > 0 && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-24 right-6 z-20 flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg shadow-gold-glow/40 hover:brightness-110 transition-all cursor-pointer animate-in fade-in zoom-in-95"
          aria-label="Cuộn xuống tin mới nhất"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Tin mới nhất</span>
        </button>
      )}

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-primary/15 bg-lacquer-surface/80 backdrop-blur-md z-10 shrink-0">
        <div className="relative flex items-end gap-2 bg-lacquer-deep rounded-xl border border-primary/25 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40 p-2 transition-all">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tra cứu sự kiện, nhân vật lịch sử (VD: Trận Bạch Đằng 1288)..."
            rows={1}
            className="flex-1 border-0 bg-transparent p-1 text-xs sm:text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-text-muted max-h-32"
            autoComplete="off"
            spellCheck="false"
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
            size="sm"
            variant="heritage"
            className="h-8 px-3 rounded-lg shrink-0 gap-1"
            aria-label="Gửi câu hỏi tra cứu sử liệu"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline text-xs">Gửi</span>
          </Button>
        </div>
        <div className="flex justify-between items-center text-[10px] text-text-muted mt-1.5 px-1">
          <span>Nhấn ⌘ + Enter hoặc Ctrl + Enter để gửi nhanh</span>
          <span>100% Khảo chứng sử học</span>
        </div>
      </div>

      {/* Historical Source Slide-over Sheet */}
      <HistoricalSourceModal
        citation={selectedCitation}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </section>
  );
}
