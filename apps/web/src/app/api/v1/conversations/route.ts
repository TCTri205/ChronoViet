import { NextRequest, NextResponse } from 'next/server';
import {
  Conversation,
  ConversationSchema,
  createLogger,
  query,
  isPgAvailable,
  inMemoryStore,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/shared-spec';

const log = createLogger({ service: 'web-api-conversations' });

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const pgUp = await isPgAvailable();
    let conversations: Conversation[] = [];

    if (pgUp) {
      const rows = await query<any>(
        `SELECT id, title, mode, metadata, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 50`
      );
      conversations = rows.map((r) =>
        ConversationSchema.parse({
          id: r.id,
          title: r.title,
          mode: r.mode || 'RESEARCH',
          metadata: r.metadata || {},
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })
      );
    } else {
      conversations = Array.from(inMemoryStore.conversations.values()).sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
    }

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/conversations', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/conversations', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      { conversations },
      { headers: { 'x-request-id': correlationId } }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/conversations', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/conversations', status_class: '5xx' }, durationSec);
    log.error('api.conversations_list_failed', `Failed to list conversations: ${err.message}`, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const body = await req.json().catch(() => ({}));
    const title = body.title?.trim() || 'Cuộc trò chuyện mới';
    const mode = body.mode || 'RESEARCH';
    const metadata = body.metadata || {};
    const id = body.id || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const conversation: Conversation = ConversationSchema.parse({
      id,
      title,
      mode,
      metadata,
      createdAt: now,
      updatedAt: now,
    });

    const pgUp = await isPgAvailable();
    if (pgUp) {
      await query(
        `INSERT INTO conversations (id, title, mode, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, mode = EXCLUDED.mode, updated_at = EXCLUDED.updated_at`,
        [conversation.id, conversation.title, conversation.mode, JSON.stringify(conversation.metadata), conversation.createdAt, conversation.updatedAt]
      );
    } else {
      inMemoryStore.conversations.set(conversation.id, conversation);
    }

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/conversations', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/conversations', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      { conversation },
      { status: 201, headers: { 'x-request-id': correlationId } }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/conversations', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/conversations', status_class: '5xx' }, durationSec);
    log.error('api.conversations_create_failed', `Failed to create conversation: ${err.message}`, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}
