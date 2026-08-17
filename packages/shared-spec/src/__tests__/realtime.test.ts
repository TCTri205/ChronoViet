import { describe, it, expect } from 'vitest';
import {
  RenderProgressEventSchema,
  RenderCompletedEventSchema,
  RenderFailedEventSchema,
  RenderEventSchema,
  SseEventSchema,
  ProjectSummarySchema,
  ChatStreamResponseSchema,
  getProjectEventsChannel,
} from '../realtime.js';

describe('Realtime Schemas & Contracts', () => {
  it('validates RenderProgressEventSchema correctly', () => {
    const progressEvent = {
      projectId: 'proj_123',
      type: 'RENDER_PROGRESS',
      status: 'RENDERING',
      progressPercent: 45.5,
      currentFrame: 450,
      totalFrames: 1000,
      estimatedRemainingSec: 25,
      timestamp: new Date().toISOString(),
    };
    const parsed = RenderProgressEventSchema.parse(progressEvent);
    expect(parsed.progressPercent).toBe(45.5);
    expect(parsed.type).toBe('RENDER_PROGRESS');

    const unionParsed = RenderEventSchema.parse(progressEvent);
    expect(unionParsed.type).toBe('RENDER_PROGRESS');
  });

  it('validates RenderCompletedEventSchema correctly', () => {
    const completedEvent = {
      projectId: 'proj_123',
      type: 'RENDER_COMPLETED',
      status: 'COMPLETED',
      outputPath: '/media/projects/proj_123/output/video.mp4',
      fileSizeBytes: 10485760,
      durationMs: 12000,
      timestamp: new Date().toISOString(),
    };
    const parsed = RenderCompletedEventSchema.parse(completedEvent);
    expect(parsed.fileSizeBytes).toBe(10485760);

    const unionParsed = RenderEventSchema.parse(completedEvent);
    expect(unionParsed.type).toBe('RENDER_COMPLETED');
  });

  it('validates RenderFailedEventSchema correctly', () => {
    const failedEvent = {
      projectId: 'proj_123',
      type: 'RENDER_FAILED',
      status: 'FAILED',
      errorMessage: 'Chromium crash',
      timestamp: new Date().toISOString(),
    };
    const parsed = RenderFailedEventSchema.parse(failedEvent);
    expect(parsed.errorMessage).toBe('Chromium crash');

    const unionParsed = RenderEventSchema.parse(failedEvent);
    expect(unionParsed.type).toBe('RENDER_FAILED');
  });

  it('validates SseEventSchema correctly', () => {
    const sseEvent = {
      nodeName: 'scriptwriter',
      update: { chapterCount: 3 },
      state: 'SCRIPTWRITING',
      status: 'RUNNING',
      projectId: 'proj_123',
      timestamp: new Date().toISOString(),
    };
    const parsed = SseEventSchema.parse(sseEvent);
    expect(parsed.nodeName).toBe('scriptwriter');
    expect(parsed.status).toBe('RUNNING');
  });

  it('validates ProjectSummarySchema correctly', () => {
    const summary = {
      projectId: 'proj_123',
      status: 'COMPLETED',
      currentStep: 12,
      title: 'Trận Bạch Đằng 1288',
      topic: 'Bạch Đằng',
      createdAt: new Date().toISOString(),
      videoUrl: '/api/v1/projects/proj_123/video',
      progressPercent: 100,
    };
    const parsed = ProjectSummarySchema.parse(summary);
    expect(parsed.projectId).toBe('proj_123');
  });

  it('validates ChatStreamResponseSchema correctly', () => {
    const tokenChunk = {
      type: 'token',
      content: 'Trần Hưng Đạo...',
    };
    expect(ChatStreamResponseSchema.parse(tokenChunk).content).toBe('Trần Hưng Đạo...');

    const citationChunk = {
      type: 'citation',
      citations: ['Đại Việt Sử Ký Toàn Thư'],
    };
    expect(ChatStreamResponseSchema.parse(citationChunk).citations).toHaveLength(1);
  });

  it('generates correct project events channel name', () => {
    expect(getProjectEventsChannel('test-123')).toBe('project_events:test-123');
  });
});
