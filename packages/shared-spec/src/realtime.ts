/**
 * Realtime Event Schemas & Redis PubSub Manager
 * SSOT for Video Render events, Orchestrator SSE streaming, and Project summaries.
 */

import { z } from 'zod';
import { GraphTripleItemSchema, HistoricalCitationItemSchema } from './schema.js';

// ============================================================================
// 1. Render Event Schemas (Redis PubSub channel `project_events:${projectId}`)
// ============================================================================

export const RenderEventTypeSchema = z.enum([
  'RENDER_PROGRESS',
  'RENDER_COMPLETED',
  'RENDER_FAILED',
]);
export type RenderEventType = z.infer<typeof RenderEventTypeSchema>;

export const RenderProgressEventSchema = z.object({
  projectId: z.string(),
  type: z.literal('RENDER_PROGRESS'),
  status: z.literal('RENDERING'),
  progressPercent: z.number().min(0).max(100),
  currentFrame: z.number().int().nonnegative(),
  totalFrames: z.number().int().positive(),
  estimatedRemainingSec: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});
export type RenderProgressEvent = z.infer<typeof RenderProgressEventSchema>;

export const RenderCompletedEventSchema = z.object({
  projectId: z.string(),
  type: z.literal('RENDER_COMPLETED'),
  status: z.literal('COMPLETED'),
  outputPath: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
});
export type RenderCompletedEvent = z.infer<typeof RenderCompletedEventSchema>;

export const RenderFailedEventSchema = z.object({
  projectId: z.string(),
  type: z.literal('RENDER_FAILED'),
  status: z.literal('FAILED'),
  errorMessage: z.string(),
  timestamp: z.string().datetime(),
});
export type RenderFailedEvent = z.infer<typeof RenderFailedEventSchema>;

export const RenderEventSchema = z.discriminatedUnion('type', [
  RenderProgressEventSchema,
  RenderCompletedEventSchema,
  RenderFailedEventSchema,
]);
export type RenderEvent = z.infer<typeof RenderEventSchema>;

// ============================================================================
// 2. SSE Stream Event Schema (Orchestrator pipeline -> Web SSE route)
// ============================================================================

export const SseEventStatusSchema = z.enum([
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'NEEDS_HUMAN_REVIEW',
]);
export type SseEventStatus = z.infer<typeof SseEventStatusSchema>;

export const SseEventSchema = z.object({
  nodeName: z.string(),
  update: z.record(z.string(), z.unknown()),
  state: z.string(),
  status: SseEventStatusSchema,
  projectId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});
export type SseEvent = z.infer<typeof SseEventSchema>;

// ============================================================================
// 3. Project Summary Schema (GET /api/v1/projects)
// ============================================================================

export const ProjectSummarySchema = z.object({
  projectId: z.string(),
  status: z.string(),
  currentStep: z.number().int().nonnegative(),
  title: z.string().optional(),
  topic: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  videoUrl: z.string().optional(),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

// ============================================================================
// 4. Chat Streaming Response Schema (POST /api/v1/chat)
// ============================================================================

export const ChatStreamResponseSchema = z.object({
  type: z.enum(['token', 'citation', 'intent', 'triples', 'done', 'error']),
  content: z.string().optional(),
  citations: z.array(z.union([z.string(), HistoricalCitationItemSchema])).optional(),
  intent: z.string().optional(),
  triples: z.array(GraphTripleItemSchema).optional(),
  error: z.string().optional(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
});
export type ChatStreamResponse = z.infer<typeof ChatStreamResponseSchema>;

// ============================================================================
// 5. Redis PubSub Manager
// ============================================================================

export function getProjectEventsChannel(projectId: string): string {
  return `project_events:${projectId}`;
}
