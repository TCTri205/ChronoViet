import { NextRequest, NextResponse } from 'next/server';
import { ConversationSchema } from '@chronoviet/shared-spec';
import {
  createLogger,
  query,
  isPgAvailable,
  inMemoryStore,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/infra';

const log = createLogger({ service: 'web-api-conversations-detail' });

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();
  const { id } = params;

  try {
    const pgUp = await isPgAvailable();
    let conversation = null;

    if (pgUp) {
      const rows = await query<any>(
        'SELECT id, title, mode, metadata, created_at, updated_at FROM conversations WHERE id = $1',
        [id]
      );
      if (rows.length > 0) {
        conversation = ConversationSchema.parse({
          id: rows[0].id,
          title: rows[0].title,
          mode: rows[0].mode || 'RESEARCH',
          metadata: rows[0].metadata || {},
          createdAt: rows[0].created_at,
          updatedAt: rows[0].updated_at,
        });
      }
    } else {
      conversation = inMemoryStore.conversations.get(id) || null;
    }

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404, headers: { 'x-request-id': correlationId } }
      );
    }

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/conversations/[id]', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/conversations/[id]', status_class: '2xx' }, durationSec);

    return NextResponse.json({ conversation }, { headers: { 'x-request-id': correlationId } });
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/conversations/[id]', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'GET', route: '/api/v1/conversations/[id]', status_class: '5xx' }, durationSec);
    log.error('api.conversation_get_failed', 'Failed to get conversation: ' + err.message, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();
  const { id } = params;

  try {
    const pgUp = await isPgAvailable();
    if (pgUp) {
      await query('DELETE FROM conversation_messages WHERE conversation_id = $1', [id]);
      await query('DELETE FROM conversations WHERE id = $1', [id]);
    } else {
      inMemoryStore.conversations.delete(id);
      inMemoryStore.conversationMessages = inMemoryStore.conversationMessages.filter((m: any) => m.conversationId !== id);
    }

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'DELETE', route: '/api/v1/conversations/[id]', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'DELETE', route: '/api/v1/conversations/[id]', status_class: '2xx' }, durationSec);

    return NextResponse.json({ success: true }, { headers: { 'x-request-id': correlationId } });
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'DELETE', route: '/api/v1/conversations/[id]', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'DELETE', route: '/api/v1/conversations/[id]', status_class: '5xx' }, durationSec);
    log.error('api.conversation_delete_failed', 'Failed to delete conversation: ' + err.message, { error: err });
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: { 'x-request-id': correlationId } }
    );
  }
}
