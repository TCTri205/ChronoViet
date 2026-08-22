import { NextResponse } from 'next/server';
import {
  isPgAvailable,
  createLogger,
  formatErrorMessage,
  envConfig,
  hasAvailableApiKeys,
} from '@chronoviet/shared-spec';
import { getRedisClient } from '../../../lib/redis';

const log = createLogger({ service: 'web-api-readyz' });

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string; info?: string }> = {};
  let allHealthy = true;

  // 1. Check Redis
  const redisStart = Date.now();
  try {
    const redis = getRedisClient();
    const pingRes = await redis.ping();
    if (pingRes === 'PONG') {
      checks.redis = {
        status: 'healthy',
        latencyMs: Date.now() - redisStart,
        info: 'BullMQ & PubSub Gateway sẵn sàng',
      };
    } else {
      checks.redis = {
        status: 'degraded',
        latencyMs: Date.now() - redisStart,
        error: `Unexpected ping response: ${pingRes}`,
        info: 'Redis phản hồi bất thường',
      };
      allHealthy = false;
    }
  } catch (err) {
    checks.redis = {
      status: 'unreachable',
      error: formatErrorMessage(err),
      info: 'Redis offline / Không thể kết nối',
    };
    allHealthy = false;
  }

  // 2. Check PostgreSQL
  const pgStart = Date.now();
  try {
    const available = await isPgAvailable();
    if (available) {
      checks.postgres = {
        status: 'healthy',
        latencyMs: Date.now() - pgStart,
        info: 'pgvector (1024d HNSW index ready)',
      };
    } else {
      checks.postgres = {
        status: 'offline_mode',
        latencyMs: 0,
        info: 'PostgreSQL offline / Mock memory mode',
      };
      allHealthy = false;
    }
  } catch (err) {
    checks.postgres = {
      status: 'unreachable',
      error: formatErrorMessage(err),
      info: 'PostgreSQL không phản hồi',
    };
    allHealthy = false;
  }

  // 3. Check VieNeu TTS (Port 8080)
  const ttsStart = Date.now();
  try {
    const ttsUrl = envConfig.VIENEU_PYTHON_URL || 'http://localhost:8080';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const ttsRes = await fetch(`${ttsUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeoutId);

    if (ttsRes && (ttsRes.ok || ttsRes.status === 200)) {
      checks.tts = {
        status: 'healthy',
        latencyMs: Date.now() - ttsStart,
        info: 'Port 8080 ONNX (wordTimestamps synced)',
      };
    } else {
      checks.tts = {
        status: 'degraded',
        latencyMs: Date.now() - ttsStart,
        info: 'Chưa khởi chạy (Chạy Synthetic Fallback Engine)',
      };
      allHealthy = false;
    }
  } catch {
    checks.tts = {
      status: 'degraded',
      latencyMs: Date.now() - ttsStart,
      info: 'Chưa khởi chạy (Chạy Synthetic Fallback Engine)',
    };
    allHealthy = false;
  }

  // 4. Check LLM / Local AI (Port 8092 or Cloud API Keys)
  const llmStart = Date.now();
  try {
    const llmUrl = envConfig.LLM_BASE_URL || 'http://localhost:8092';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const llmRes = await fetch(`${llmUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeoutId);

    if (llmRes && (llmRes.ok || llmRes.status === 200)) {
      checks.llm = {
        status: 'healthy',
        latencyMs: Date.now() - llmStart,
        info: `Local llama-server (${envConfig.LOCAL_LLM_PRIMARY_MODEL})`,
      };
    } else {
      const hasCloud =
        hasAvailableApiKeys('gemini') ||
        hasAvailableApiKeys('agnes') ||
        hasAvailableApiKeys('openrouter') ||
        hasAvailableApiKeys('openai');

      if (hasCloud) {
        checks.llm = {
          status: 'degraded',
          latencyMs: Date.now() - llmStart,
          info: 'Local AI offline (Fallback: Cloud API Active)',
        };
      } else {
        checks.llm = {
          status: 'unreachable',
          latencyMs: Date.now() - llmStart,
          info: 'Chưa bật Model / Không có API key (Chế độ kịch bản mẫu)',
        };
      }
      allHealthy = false;
    }
  } catch {
    checks.llm = {
      status: 'unreachable',
      info: 'Chưa bật Model / Không có API key (Chế độ kịch bản mẫu)',
    };
    allHealthy = false;
  }

  if (!allHealthy) {
    log.warn('web.readiness_degraded', 'Readiness probe detected degraded dependency', { checks });
  }

  return NextResponse.json(
    {
      status: allHealthy ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
