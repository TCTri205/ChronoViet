/**
 * ChronoViet Unified Structured Logger
 *
 * Zero-dependency structured logging for the whole monorepo.
 *
 * Design decisions:
 * - JSON Lines output in production (machine-parseable), pretty-printed in dev.
 * - Level filtering driven by envConfig.LOG_LEVEL (now actually honored).
 * - `createLogger({ service, correlationId })` returns a leveled logger with
 *   a stable `event` field on every record so logs are queryable.
 * - `child({ ...fields })` produces a derived logger bound to extra context
 *   (e.g. runId, projectId, entityId) without re-creating sinks.
 * - `serializeError` flattens Error objects (message, name, stack, cause)
 *   and redacts known secret keys before they can reach the output stream.
 *
 * Output conventions:
 *   {"time":"...","level":"info","service":"data-ingestion","event":"ingestion.started","msg":"...",...fields}
 */

import { envConfig } from './config.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerOptions {
  /** Monorepo package / app / service name, e.g. "rag-engine", "vieneu-tts". */
  service: string;
  /** Correlation id propagated through a request / run / job. */
  correlationId?: string;
  /** Extra context fields bound to every record (low cardinality only). */
  baseFields?: Record<string, unknown>;
}

export interface ChildLoggerOptions {
  /** Correlation ID to override for the child logger (if not provided, inherits parent). */
  correlationId?: string;
  /** Bound fields for the child logger, e.g. { runId, entityId, projectId }. */
  fields?: Record<string, unknown>;
}

/**
 * Truncate long user input/topic strings before logging to avoid PII leak & log flooding.
 */
export function truncateSnippet(value: unknown, maxLen = 80): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}...[truncated ${str.length - maxLen} chars]`;
}

export interface LogRecord {
  time: string;
  level: LogLevel;
  service: string;
  event: string;
  msg: string;
  correlationId?: string;
  [key: string]: unknown;
}

/** Secret keys redacted from any record / error payload. */
const SECRET_KEY_PATTERN = /(password|passwd|secret|token|api[_-]?key|authorization|private[_-]?key|session)/i;

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

/**
 * Deep-copy and redact a payload so no secret value ever reaches the log stream.
 * Keeps the object small; non-plain objects are replaced by a type tag.
 */
export function sanitizePayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (depth > 6) return '[max-depth]';

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    if (value.length > 50) {
      return `[array:${value.length} items truncated]`;
    }
    return value.map((item) => sanitizePayload(item, depth + 1));
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    // Non-plain object (Date, Map, Pool, etc.) — represent compactly.
    if (value instanceof Date) return value.toISOString();
    return `[${value.constructor?.name ?? 'Object'}]`;
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = sanitizePayload(val, depth + 1);
  }
  return out;
}

/**
 * Human-readable single-line representation of any error (including AggregateError,
 * network errors with codes like ECONNREFUSED where message is empty, etc.).
 */
export function formatErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const code = (err as any).code ? ` [${(err as any).code}]` : '';
    if (err.message && err.message.trim().length > 0) {
      return `${err.message}${code}`;
    }
    if (Array.isArray((err as any).errors) && (err as any).errors.length > 0) {
      const inner = (err as any).errors.map(formatErrorMessage).filter(Boolean).join(', ');
      return `${err.name}${code}: ${inner}`;
    }
    if ((err as any).code) {
      return `${err.name} [${(err as any).code}]`;
    }
    return err.name || 'Error';
  }
  return String(err);
}

/**
 * Flatten an Error into a queryable object, preserving name/message/stack/cause/code/errors.
 * Returns the raw value unchanged if it is not an Error.
 */
export function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    const code = (err as any).code;
    let message = err.message;
    if (!message || message.trim().length === 0) {
      message = formatErrorMessage(err);
    }

    const out: Record<string, unknown> = {
      name: err.name,
      message,
    };
    if (code) out.code = code;
    if (err.stack) out.stack = err.stack;
    if (err.cause !== undefined && err.cause !== null) {
      out.cause = serializeError(err.cause);
    }
    if (Array.isArray((err as any).errors)) {
      out.errors = (err as any).errors.map(serializeError);
    }
    // Copy extra own enumerable props (e.g. statusCode, code).
    for (const key of Object.keys(err)) {
      if (!(key in out) && !isSecretKey(key)) {
        out[key] = err[key as keyof Error];
      }
    }
    return sanitizePayload(out);
  }
  return err;
}

export interface ChronoLogger {
  debug(event: string, msg: string, fields?: Record<string, unknown>): void;
  info(event: string, msg: string, fields?: Record<string, unknown>): void;
  warn(event: string, msg: string, fields?: Record<string, unknown>): void;
  error(event: string, msg: string, fields?: Record<string, unknown>): void;
  /** Derived logger bound to extra context. */
  child(opts: ChildLoggerOptions): ChronoLogger;
}

function getLogLevelPriority(level?: string): number {
  if (!level) return LEVEL_PRIORITY.info;
  return LEVEL_PRIORITY[level as LogLevel] ?? LEVEL_PRIORITY.info;
}

/**
 * Render one record: JSON line in production/test, pretty in dev (unless LOG_FORMAT=json).
 */
function renderRecord(record: LogRecord): string {
  if (envConfig.NODE_ENV === 'production' || envConfig.LOG_FORMAT === 'json') {
    return JSON.stringify(record);
  }
  const { time, level, service, event, msg, correlationId, ...rest } = record;
  const head = `${time} ${level.toUpperCase().padEnd(5)} [${service}] ${event}: ${msg}`;
  if (correlationId) {
    return `${head} (cid=${correlationId})${Object.keys(rest).length ? ' ' + JSON.stringify(rest) : ''}`;
  }
  return `${head}${Object.keys(rest).length ? ' ' + JSON.stringify(rest) : ''}`;
}

function emit(level: LogLevel, service: string, event: string, msg: string, fields: Record<string, unknown> | undefined, correlationId: string | undefined, baseFields: Record<string, unknown> | undefined): void {
  const currentThreshold = getLogLevelPriority(envConfig.LOG_LEVEL || process.env.LOG_LEVEL);
  if (LEVEL_PRIORITY[level] < currentThreshold) return;

  const record: LogRecord = {
    time: new Date().toISOString(),
    level,
    service,
    event,
    msg,
    ...(correlationId ? { correlationId } : {}),
    ...(baseFields ? (sanitizePayload(baseFields) as Record<string, unknown>) : {}),
    ...(fields ? (sanitizePayload(fields) as Record<string, unknown>) : {}),
  };

  const line = renderRecord(record);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

/**
 * Create a leveled structured logger bound to a service name.
 */
export function createLogger(opts: LoggerOptions): ChronoLogger {
  const { service, correlationId, baseFields } = opts;

  const logger: ChronoLogger = {
    debug: (event, msg, fields) => emit('debug', service, event, msg, fields, correlationId, baseFields),
    info: (event, msg, fields) => emit('info', service, event, msg, fields, correlationId, baseFields),
    warn: (event, msg, fields) => emit('warn', service, event, msg, fields, correlationId, baseFields),
    error: (event, msg, fields) => emit('error', service, event, msg, fields, correlationId, baseFields),
    child: (childOpts) => {
      const childFields = childOpts.fields ?? {};
      const newCorrelationId = childOpts.correlationId || (childFields.correlationId as string) || correlationId;
      return createLogger({
        service,
        correlationId: newCorrelationId,
        baseFields: { ...(baseFields ?? {}), ...childFields },
      });
    },
  };

  return logger;
}

// ============================================================
// Fallback Alert (throttled structured JSON event)
// ============================================================

export interface FallbackAlertPayload {
  subsystem: 'LLM_GATEWAY' | 'EMBEDDING' | 'RERANKER' | 'VLM_INSPECTOR' | 'TTS_ENGINE' | 'HISTORICAL_OCR';
  primaryTarget: string;
  fallbackTarget: string;
  reason: string;
  actionRequired?: string;
  metadata?: Record<string, unknown>;
}

const SYSTEM_LOGGER = createLogger({ service: 'system' });
const fallbackAlertTimestamps = new Map<string, number>();
const FALLBACK_ALERT_COOLDOWN_MS = 30_000;

/** Reset throttle cooldown cache (useful in unit tests) */
export function resetFallbackAlertThrottle(): void {
  fallbackAlertTimestamps.clear();
}

/**
 * Log a structured high-visibility Fallback Alert as a JSON `system.fallback_activated`
 * event on the warn channel. Automatically throttles identical alerts within a 30s
 * window to prevent terminal spam when processing parallel batches.
 */
export function logFallbackAlert(payload: FallbackAlertPayload): void {
  const key = `${payload.subsystem}:${payload.reason}`;
  const now = Date.now();
  const lastAlert = fallbackAlertTimestamps.get(key) ?? 0;

  if (now - lastAlert < FALLBACK_ALERT_COOLDOWN_MS) {
    return;
  }
  fallbackAlertTimestamps.set(key, now);

  SYSTEM_LOGGER.warn('system.fallback_activated', `${payload.subsystem} fallback activated`, {
    subsystem: payload.subsystem,
    primaryTarget: payload.primaryTarget,
    fallbackTarget: payload.fallbackTarget,
    reason: payload.reason,
    ...(payload.actionRequired ? { actionRequired: payload.actionRequired } : {}),
    ...(payload.metadata ? { metadata: payload.metadata } : {}),
  });
}
