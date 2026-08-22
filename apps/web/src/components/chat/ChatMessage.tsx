"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User, Film, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CitationBadge, CitationItem } from "./CitationBadge";

export interface MessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: CitationItem[];
  timestamp?: string;
}

export interface ChatMessageProps {
  message: MessageData;
  onCitationClick?: (citation: CitationItem) => void;
  onCreateVideoFromTopic?: (topic: string) => void;
}

// Pure module-level topic title extractor for 1-click video handover
export function extractTopicFromMessage(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("⚠️") && !l.startsWith("*Hệ thống") && !l.startsWith("🏛️"));

  if (lines.length > 0) {
    const candidate = lines[0].replace(/^[#*`\-_:> ]+/g, "").replace(/[*`_]/g, "").trim();
    if (candidate.length > 5 && candidate.length < 80) {
      return candidate;
    }
  }

  const fallbackCandidate = text.split("\n")[0].replace(/[#*`⚠️🏛️]/g, "").trim();
  return fallbackCandidate.length > 5 && fallbackCandidate.length < 80
    ? fallbackCandidate
    : "Sự kiện lịch sử từ đoạn hội thoại";
}

function ChatMessageComponent({
  message,
  onCitationClick,
  onCreateVideoFromTopic,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isErrorMessage = !isUser && (message.content.includes("⚠️") || message.content.includes("Không thể kết nối"));

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
          ) : (
            <div className="prose prose-invert max-w-none prose-sm text-text-primary prose-headings:font-headline prose-headings:text-gold-300 prose-a:text-primary prose-strong:text-gold-300">
              <ReactMarkdown>{message.content}</ReactMarkdown>
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

        {/* 1-Click Handover CTA Button on Assistant Message */}
        {!isUser && onCreateVideoFromTopic && (
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreateVideoFromTopic(extractTopicFromMessage(message.content))}
              className="text-xs h-7 gap-1.5 border-primary/30 text-gold-300 hover:bg-primary/20 hover:text-white"
            >
              <Film className="w-3.5 h-3.5 text-primary" />
              <span>⚡ Tạo Video từ chủ đề này</span>
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

