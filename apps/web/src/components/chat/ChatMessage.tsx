"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User, Film, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CitationBadge, CitationItem } from "./CitationBadge";

export interface MessageData {
  id: string;
  conversationId?: string;
  role: "user" | "assistant";
  content: string;
  citations?: CitationItem[];
  timestamp?: string;
  statusText?: string;
  videoHandover?: {
    topic: string;
    primaryEntityId?: string;
    canonicalName?: string;
  };
}

export interface ChatMessageProps {
  message: MessageData;
  onCitationClick?: (citation: CitationItem) => void;
  onCreateVideoFromTopic?: (topic: string, conversationId?: string) => void;
}

// Pure module-level topic title extractor for 1-click video handover
export function extractTopicFromMessage(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith("⚠️") &&
        !l.startsWith("*Hệ thống") &&
        !l.startsWith("🏛️") &&
        !l.startsWith("Chào") &&
        !l.startsWith("Xin chào") &&
        !l.startsWith("Tôi là") &&
        !l.startsWith("Bạn có thể") &&
        !l.startsWith("Dưới đây là") &&
        !l.startsWith("Theo sử liệu") &&
        !l.startsWith("Nguồn Sử Liệu")
    );

  for (const line of lines) {
    const candidate = line.replace(/^[#*`\-_:> ]+/g, "").replace(/[*`_#]/g, "").trim();
    // Look for lines that look like actual historical statements/entities
    if (
      candidate.length >= 6 &&
      candidate.length <= 80 &&
      !/^(?:chào|tôi là|hãy|vui lòng|dưới đây|theo sử sách|theo ghi chép)/i.test(candidate)
    ) {
      return candidate;
    }
  }

  const fallbackCandidate = text.split("\n").find((l) => l.trim().length > 6 && !/^(?:🏛️|⚠️|chào|xin chào)/i.test(l.trim()));
  if (fallbackCandidate) {
    const clean = fallbackCandidate.replace(/^[#*`\-_:> ]+/g, "").replace(/[#*`⚠️🏛️]/g, "").trim();
    if (clean.length >= 6 && clean.length <= 80) return clean;
    if (clean.length > 80) {
      const cut = clean.slice(0, 75);
      const lastSpace = cut.lastIndexOf(" ");
      return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + "...";
    }
  }

  return "Sự kiện lịch sử từ đoạn hội thoại";
}

function ChatMessageComponent({
  message,
  onCitationClick,
  onCreateVideoFromTopic,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isErrorMessage = !isUser && (message.content.includes("⚠️") || message.content.includes("Không thể kết nối"));
  const isReadyForVideo = !isUser && !isErrorMessage && Boolean(message.content && message.content.trim().length > 20);

  return (
    <div
      className={`flex gap-3.5 ${
        isUser ? "justify-end ml-auto max-w-[85%]" : "justify-start mr-auto max-w-[92%]"
      } group animate-in fade-in-20 duration-300`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className={`w-8 h-8 rounded-full bg-lacquer-surface border ${
          isErrorMessage ? "border-amber-500/40" : "border-primary/40"
        } shrink-0 flex items-center justify-center shadow-md shadow-gold-glow/20 mt-1`}>
          <span className="text-primary text-xs font-bold">{isErrorMessage ? "⚠️" : "🏛️"}</span>
        </div>
      )}

      <div className="flex flex-col space-y-2.5 min-w-0">
        {/* Message Bubble */}
        <div
          className={`p-4 rounded-xl text-sm leading-relaxed ${
            isUser
              ? "bg-primary/15 border border-primary/30 text-text-primary rounded-tr-xs"
              : isErrorMessage
              ? "bg-lacquer-surface/95 border border-amber-500/30 text-text-primary rounded-tl-xs shadow-md"
              : "bg-lacquer-surface/90 border border-primary/20 text-text-primary rounded-tl-xs shadow-md"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <div className="prose prose-invert max-w-none prose-sm text-text-primary prose-headings:font-headline prose-headings:text-gold-300 prose-a:text-primary prose-strong:text-gold-300">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => {
                    if (href?.startsWith("citation:")) {
                      const citationId = href.replace("citation:", "");
                      const matched = message.citations?.find((c) => String(c.id) === citationId);
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            if (matched) onCitationClick?.(matched);
                          }}
                          className="inline-flex items-center px-1 py-0.2 mx-0.5 rounded text-[11px] font-mono font-bold bg-primary/20 text-gold-300 hover:bg-primary/30 border border-primary/40 cursor-pointer align-baseline transition-colors"
                          title={`Xem trích dẫn sử liệu [${citationId}]`}
                          aria-label={`Xem trích dẫn sử liệu số ${citationId}`}
                        >
                          [{children}]
                        </button>
                      );
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {message.citations && message.citations.length > 0
                  ? message.content.replace(/\[(\d+)\](?!\()/g, "[$1](citation:$1)")
                  : message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-text-muted text-xs py-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="font-medium text-primary/80 animate-pulse">
                {message.statusText || "ChronoViet AI đang nghiên cứu sử liệu..."}
              </span>
            </div>
          )}

          {/* Citations List (if any attached to this response) */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-primary/15 space-y-2">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
                Nguồn Sử Liệu Trích Dẫn:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {message.citations.map((c) => (
                  <CitationBadge
                    key={c.id}
                    citation={c}
                    onClick={onCitationClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 1-Click Handover CTA Button only on completed, valid Assistant Message */}
        {isReadyForVideo && onCreateVideoFromTopic && (
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const chosenTopic = message.videoHandover?.topic || extractTopicFromMessage(message.content);
                onCreateVideoFromTopic(chosenTopic, message.conversationId);
              }}
              className="text-xs h-7 gap-1.5 border-primary/30 text-gold-300 hover:bg-primary/20 hover:text-white transition-all shadow-sm shadow-gold-glow/5"
            >
              <Film className="w-3.5 h-3.5 text-primary" />
              <span>⚡ Tạo Video từ cuộc trò chuyện này</span>
            </Button>
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-lacquer-elevated border border-primary/25 shrink-0 flex items-center justify-center mt-1">
          <User className="w-4 h-4 text-text-secondary" />
        </div>
      )}
    </div>
  );
}

export const ChatMessage = React.memo(ChatMessageComponent);
