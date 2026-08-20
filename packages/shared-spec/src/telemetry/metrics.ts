/**
 * ChronoViet Centralized Metrics (Prometheus / prom-client)
 *
 * Implements RED (Rate, Errors, Duration) for HTTP & AI Gateway,
 * and USE (Utilization, Saturation, Errors) for Queues & WebSockets.
 *
 * Strict Cardinality Guard: All labels must come from bounded sets.
 * Never use user IDs, project IDs, raw queries, or full URLs in labels.
 */

import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

// Global singleton Prometheus Registry
export const metricsRegistry = new Registry();

// Collect Node.js process / runtime metrics (GC, memory, event loop lag, CPU)
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'chronoviet_',
});

// ============================================================================
// 1. HTTP RED Metrics (Web API & Services)
// ============================================================================

export const httpRequestsTotal = new Counter({
  name: 'chronoviet_http_requests_total',
  help: 'Total number of HTTP requests received',
  labelNames: ['method', 'route', 'status_class'],
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'chronoviet_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_class'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// ============================================================================
// 2. AI Gateway & External Dependency RED Metrics
// ============================================================================

export const llmRequestsTotal = new Counter({
  name: 'chronoviet_llm_requests_total',
  help: 'Total number of LLM inference requests made to local/cloud providers',
  labelNames: ['provider', 'model', 'status'],
  registers: [metricsRegistry],
});

export const llmRequestDurationSeconds = new Histogram({
  name: 'chronoviet_llm_request_duration_seconds',
  help: 'Duration of LLM calls in seconds',
  labelNames: ['provider', 'model'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [metricsRegistry],
});

export const circuitBreakerGauge = new Gauge({
  name: 'chronoviet_circuit_breaker_state',
  help: 'Circuit breaker state (0 = CLOSED/HEALTHY, 1 = OPEN/TRIPPED)',
  labelNames: ['subsystem'],
  registers: [metricsRegistry],
});

export const circuitBreakerFailuresGauge = new Gauge({
  name: 'chronoviet_circuit_breaker_failures',
  help: 'Consecutive failure count recorded by circuit breaker',
  labelNames: ['subsystem'],
  registers: [metricsRegistry],
});

export const ttsRequestsTotal = new Counter({
  name: 'chronoviet_tts_requests_total',
  help: 'Total number of TTS synthesis requests',
  labelNames: ['engine', 'status'],
  registers: [metricsRegistry],
});

export const ttsSynthesisDurationSeconds = new Histogram({
  name: 'chronoviet_tts_synthesis_duration_seconds',
  help: 'Duration of TTS synthesis in seconds',
  labelNames: ['engine'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20],
  registers: [metricsRegistry],
});

// ============================================================================
// 3. Queue & Background Tasks USE Metrics (BullMQ & Remotion)
// ============================================================================

export const bullmqQueueJobsGauge = new Gauge({
  name: 'chronoviet_bullmq_queue_jobs',
  help: 'Number of jobs in BullMQ queues categorized by state',
  labelNames: ['queue', 'state'],
  registers: [metricsRegistry],
});

export const renderDurationSeconds = new Histogram({
  name: 'chronoviet_render_duration_seconds',
  help: 'Duration of Remotion video render jobs in seconds',
  labelNames: ['status'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry],
});

// ============================================================================
// 4. Realtime / WebSocket USE Metrics
// ============================================================================

export const websocketActiveConnectionsGauge = new Gauge({
  name: 'chronoviet_websocket_active_connections',
  help: 'Number of currently active WebSocket client connections',
  registers: [metricsRegistry],
});

// ============================================================================
// 5. Multi-Agent Orchestrator RED Metrics (LangGraph Pipeline)
// ============================================================================

export const orchestratorNodeDurationSeconds = new Histogram({
  name: 'chronoviet_orchestrator_node_duration_seconds',
  help: 'Duration of orchestrator graph node executions in seconds',
  labelNames: ['node', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

export const orchestratorPacingErrorPercent = new Histogram({
  name: 'chronoviet_orchestrator_pacing_error_percent',
  help: 'Pacing error percentage across reconciled scenes',
  labelNames: ['template_id'],
  buckets: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 5.0, 10.0],
  registers: [metricsRegistry],
});

// ============================================================================
// Utility Helpers & Cardinality Guardians
// ============================================================================

/**
 * Maps HTTP status code (200, 404, 500) to bounded status class (2xx, 4xx, 5xx).
 */
export function getStatusClass(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 300 && statusCode < 400) return '3xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  if (statusCode >= 500 && statusCode < 600) return '5xx';
  return 'other';
}

/**
 * Normalizes dynamic pathnames to prevent cardinality explosions.
 * Examples:
 *   /api/v1/projects/proj_123456_abc -> /api/v1/projects/:id
 *   /api/v1/projects/proj_123456_abc/render -> /api/v1/projects/:id/render
 */
export function normalizeRoute(pathname: string): string {
  if (!pathname) return '/';
  return pathname
    .replace(/\/proj_[a-zA-Z0-9_-]+/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/\d+/g, '/:num')
    .split('?')[0];
}

/**
 * Returns Prometheus formatted metrics exposition text.
 */
export async function getMetricsSnapshot(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Returns Prometheus content-type header string.
 */
export function getMetricsContentType(): string {
  return metricsRegistry.contentType;
}
