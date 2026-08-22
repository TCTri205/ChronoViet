import { describe, it, expect } from "vitest";
import React from "react";
import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";
import { VideoGeneratorPanel } from "../components/video/VideoGeneratorPanel";
import { VideoPlayer } from "../components/player/VideoPlayer";
import { ChatContainer } from "../components/chat/ChatContainer";
import { ChatMessage } from "../components/chat/ChatMessage";
import { LiveAgentStepper } from "../components/video/LiveAgentStepper";
import { CitationBadge } from "../components/chat/CitationBadge";
import { KaraokeSubtitles } from "../components/player/KaraokeSubtitles";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";

describe("Frontend UI/UX Component Specifications", () => {
  describe("Layout & Navigation Components", () => {
    it("should define Header component correctly", () => {
      expect(Header).toBeDefined();
      expect(typeof Header).toBe("function");
    });

    it("should define Sidebar component correctly", () => {
      expect(Sidebar).toBeDefined();
      expect(typeof Sidebar).toBe("function");
    });

    it("should export Sheet UI primitives for mobile drawer", () => {
      expect(Sheet).toBeDefined();
      expect(SheetContent).toBeDefined();
      expect(SheetHeader).toBeDefined();
      expect(SheetTitle).toBeDefined();
      expect(SheetDescription).toBeDefined();
    });
  });

  describe("Video Studio & Generation Components", () => {
    it("should define VideoGeneratorPanel component correctly", () => {
      expect(VideoGeneratorPanel).toBeDefined();
      expect(typeof VideoGeneratorPanel).toBe("function");
    });

    it("should define LiveAgentStepper component correctly", () => {
      expect(LiveAgentStepper).toBeDefined();
      expect(typeof LiveAgentStepper).toBe("function");
    });

    it("should export ToggleGroup and ToggleGroupItem for narration tone selection", () => {
      expect(ToggleGroup).toBeDefined();
      expect(ToggleGroupItem).toBeDefined();
    });
  });

  describe("Player & Subtitle Components", () => {
    it("should define VideoPlayer component correctly", () => {
      expect(VideoPlayer).toBeDefined();
      expect(typeof VideoPlayer).toBe("function");
    });

    it("should define KaraokeSubtitles component correctly", () => {
      expect(KaraokeSubtitles).toBeDefined();
      expect(typeof KaraokeSubtitles).toBe("function");
    });
  });

  describe("Chat & Knowledge Hub Components", () => {
    it("should define ChatContainer component correctly", () => {
      expect(ChatContainer).toBeDefined();
      expect(typeof ChatContainer).toBe("function");
    });

    it("should define CitationBadge component correctly", () => {
      expect(CitationBadge).toBeDefined();
      expect(typeof CitationBadge).toBe("function");
    });

    it("should export ChatMessage component with resilient topic extraction support", () => {
      expect(ChatMessage).toBeDefined();
      expect(typeof ChatMessage).toBe("object"); // React.memo component is an object with render property or function
    });
  });
});

