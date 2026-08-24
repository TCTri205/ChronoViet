import { NextRequest, NextResponse } from 'next/server';
import {
  ConversationMessage,
  ConversationMessageSchema,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  query,
  isPgAvailable,
  inMemoryStore,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/infra';
import { getVideoBriefsByConversationId } from '@chronoviet/agent-orchestrator';

const log = createLogger({ service: 'web-api-conversation-messages' });

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const conversationId = params.id;
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const pgUp = await isPgAvailable();
    let messages: ConversationMessage[] = [];

    if (pgUp) {
      const rows = await query<any>(
        `SELECT id, conversation_id, role, content, citations, intent, created_at
         FROM conversation_messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversationId]
      );
      messages = rows.map((r) =>
        ConversationMessageSchema.parse({
          id: r.id,
          conversationId: r.conversation_id,
          role: r.role,
          content: r.content,
          citations: Array.isArray(r.citations) ? r.citations : typeof r.citations === 'string' ? JSON.parse(r.citations) : [],
          intent: r.intent || undefined,
          createdAt: r.created_at,
        })
      );
    } else {
      messages = inMemoryStore.conversationMessages.filter((m: any) => m.conversationId === conversationId);
    }

    // Load associated briefs
    const briefs = await getVideoBriefsByConversationId(conversationId).catch(() => []);

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/conversations/:id/messages', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/conversations/:id/messages', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      {
        conversationId,
        messages,
        briefs,
      },
      { headers: { 'x-request-id': correlationId } }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/conversations/:id/messages', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/conversations/:id/messages', status_class: '5xx' }, durationSec);
    log.error('api.messages_get_failed', `Failed to get messages: ${err.message}`, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const conversationId = params.id;
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const body = await req.json();
    const role = body.role || 'user';
    const content = body.content || '';
    const citations = body.citations || [];
    const intent = body.intent || undefined;
    const id = body.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const message: ConversationMessage = ConversationMessageSchema.parse({
      id,
      conversationId,
      role,
      content,
      citations,
      intent,
      createdAt: now,
    });

    const pgUp = await isPgAvailable();
    if (pgUp) {
      await query(
        `INSERT INTO conversation_messages (id, conversation_id, role, content, citations, intent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [message.id, message.conversationId, message.role, message.content, JSON.stringify(message.citations), message.intent, message.createdAt]
      );
      await query(
        `UPDATE conversations SET updated_at = $1 WHERE id = $2`,
        [now, conversationId]
      );
    } else {
      inMemoryStore.conversationMessages.push(message);
      const conv = inMemoryStore.conversations.get(conversationId);
      if (conv) {
        conv.updatedAt = now;
      }
    }

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/conversations/:id/messages', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/conversations/:id/messages', status_class: '2xx' }, durationSec);

    return NextResponse.json(
      { message },
      { status: 201, headers: { 'x-request-id': correlationId } }
    );
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/conversations/:id/messages', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/conversations/:id/messages', status_class: '5xx' }, durationSec);
    log.error('api.messages_post_failed', `Failed to append message: ${err.message}`, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}
