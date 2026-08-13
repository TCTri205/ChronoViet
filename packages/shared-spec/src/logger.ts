/**
 * ChronoViet System Fallback Alert & Observability Logger
 * Emits standardized high-visibility logs when any subsystem triggers a fallback.
 */

export interface FallbackAlertPayload {
  subsystem: 'LLM_GATEWAY' | 'EMBEDDING' | 'RERANKER' | 'VLM_INSPECTOR' | 'TTS_ENGINE' | 'HISTORICAL_OCR';
  primaryTarget: string;
  fallbackTarget: string;
  reason: string;
  actionRequired?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a structured high-visibility Fallback Alert to stdout/stderr
 */
export function logFallbackAlert(payload: FallbackAlertPayload): void {
  const timestamp = new Date().toISOString();
  const banner = '================================================================================';
  const alertHeader = `⚠️ [CHRONOVIET FALLBACK ALERT] ${payload.subsystem} FALLBACK ACTIVATED`;

  console.warn(`
${banner}
${alertHeader}
🕒 Timestamp:       ${timestamp}
🎯 Primary Target:   ${payload.primaryTarget}
🔄 Fallback Target:  ${payload.fallbackTarget}
❌ Failure Reason:   ${payload.reason}
${payload.actionRequired ? `💡 Fix Action:       ${payload.actionRequired}\n` : ''}${payload.metadata ? `📦 Details:          ${JSON.stringify(payload.metadata)}\n` : ''}${banner}
`);
}
