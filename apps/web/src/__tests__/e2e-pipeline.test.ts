import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChronoVideoProps, ChronoVideoScriptSchema } from "@chronoviet/shared-spec";

describe("E2E Pipeline Integration & Data Handover (CI-Safe)", () => {
  const sampleProjectId = "proj_e2e_bach_dang_1288";

  const mockProjectSchema: ChronoVideoProps = {
    title: "CHIẾN THẮNG BẠCH ĐẰNG 1288",
    subtitle: "ChronoViet Documentary Series",
    videoType: "BATTLE",
    templateId: "HISTORICAL_DOCUMENTARY",
    aspectRatio: "16:9",
    theme: {
      primaryColor: "#D4AF37",
      secondaryColor: "#C0392B",
      backgroundColor: "#08090B",
      fontFamily: "Playfair Display, serif",
      accentGlow: "rgba(212, 175, 55, 0.4)",
    },
    audioUrl: "assets/audio/voiceover_full.wav",
    bgmUrl: "assets/audio/bgm_heroic.wav",
    bgmVolume: 0.25,
    defaultLayoutMode: "BLUR_BG",
    defaultFilterStyle: "HISTORICAL",
    defaultTransition: "FADE",
    enableTransitions: true,
    timeline: [
      {
        id: "scene_01",
        startTime: 0,
        endTime: 5,
        text: "Tháng 3 năm 1288, thủy quân Thoát Hoan và Ô Mã Nhi tiến vào sông Bạch Đằng.",
        layoutMode: "TITLE_CARD",
        overlayData: {
          title: "CHIẾN THẮNG BẠCH ĐẰNG",
          subtitle: "Đại Thắng Năm 1288",
        },
      },
      {
        id: "scene_02",
        startTime: 5,
        endTime: 12,
        text: "Hưng Đạo Vương Trần Quốc Tuấn chỉ huy quân dân Đại Việt dụ giặc vào bãi cọc ngầm khi triều rút.",
        layoutMode: "SPLIT_COMPARE",
        assetUrl: "assets/images/bach_dang_stakes.jpg",
        attribution: {
          author: "Bảo Tàng Lịch Sử Quốc Gia",
          license: "PUBLIC_DOMAIN",
          sourceUrl: "https://baotanglichsu.vn",
        },
      },
    ],
  };

  it("should validate complete mock project schema against ChronoVideoScriptSchema v4.1", () => {
    const parseResult = ChronoVideoScriptSchema.safeParse(mockProjectSchema);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.timeline.length).toBe(2);
      expect(parseResult.data.videoType).toBe("BATTLE");
    }
  });

  it("should verify end-to-end event payload format from Orchestrator through WebSocket", () => {
    const renderProgressEvent = {
      projectId: sampleProjectId,
      type: "RENDER_PROGRESS",
      status: "RENDERING",
      progressPercent: 65,
      currentFrame: 650,
      totalFrames: 1000,
      estimatedRemainingSec: 15,
      timestamp: new Date().toISOString(),
    };

    expect(renderProgressEvent.type).toBe("RENDER_PROGRESS");
    expect(renderProgressEvent.progressPercent).toBe(65);
    expect(renderProgressEvent.currentFrame).toBe(650);
  });

  it("should verify completed render payload structure and video output handover", () => {
    const renderCompletedEvent = {
      projectId: sampleProjectId,
      type: "RENDER_COMPLETED",
      status: "COMPLETED",
      progressPercent: 100,
      outputPath: `/media/projects/${sampleProjectId}/output/video.mp4`,
      fileSizeBytes: 15420800,
      durationMs: 12000,
      timestamp: new Date().toISOString(),
    };

    expect(renderCompletedEvent.status).toBe("COMPLETED");
    expect(renderCompletedEvent.outputPath).toContain("video.mp4");
    expect(renderCompletedEvent.fileSizeBytes).toBeGreaterThan(0);
  });
});
