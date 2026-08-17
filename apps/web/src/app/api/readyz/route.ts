import { NextResponse } from 'next/server';
import { isPgAvailable, getDatabaseClient, createLogger, formatErrorMessage } from '@chronoviet/shared-spec';
import { getRedisClient } from '../../../lib/redis';

const log = createLogger({ service: 'web-api-readyz' });

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
  let allHealthy = true;

  // 1. Check Redis
  const redisStart = Date.now();
  try {
    const redis = getRedisClient();
    const pingRes = await redis.ping();
    if (pingRes === 'PONG') {
      checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart };
    } else {
      checks.redis = { status: 'degraded', error: `Unexpected ping response: ${pingRes}` };
      allHealthy = false;
    }
  } catch (err) {
    checks.redis = { status: 'unhealthy', error: formatErrorMessage(err) };
    allHealthy = false;
  }

  // 2. Check PostgreSQL
  const pgStart = Date.now();
  try {
    const available = await isPgAvailable();
    if (available) {
      checks.postgres = { status: 'healthy', latencyMs: Date.now() - pgStart };
    } else {
      checks.postgres = { status: 'offline_mode', latencyMs: 0 };
    }
  } catch (err) {
    checks.postgres = { status: 'unhealthy', error: formatErrorMessage(err) };
    allHealthy = false;
  }

  const statusCode = allHealthy ? 200 : 503;
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
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
