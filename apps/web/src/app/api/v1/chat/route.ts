import { NextRequest } from 'next/server';
import {
  ChatStreamResponse,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  truncateSnippet,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  query as dbQuery,
  isPgAvailable,
  inMemoryStore,
} from '@chronoviet/infra';
import { handleChatQueryStream } from '@chronoviet/agent-orchestrator';

const log = createLogger({ service: 'web-api-chat' });

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();
  const reqLog = log.child({ correlationId });

  try {
    const body = await req.json();
    const query = body.query;
    const conversationId = body.conversationId || undefined;
    const explicitHistory = body.history || [];

    if (!query || typeof query !== 'string') {
      httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/chat', status_class: '4xx' });
      return new Response(JSON.stringify({ error: 'Query string is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'x-request-id': correlationId },
      });
    }

    reqLog.info('api.chat_started', `Handling chat query: "${truncateSnippet(query)}"`, {
      querySnippet: truncateSnippet(query),
      conversationId,
    });

    // Load recent history from DB if conversationId is provided and explicitHistory is empty
    let historyTurns = explicitHistory;
    if (conversationId && historyTurns.length === 0) {
      try {
        const pgUp = await isPgAvailable();
        if (pgUp) {
          const rows = await dbQuery<any>(
            `SELECT role, content FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 10`,
            [conversationId]
          );
          historyTurns = rows.map((r) => ({ role: r.role, content: r.content }));
        } else {
          historyTurns = inMemoryStore.conversationMessages
            .filter((m: any) => m.conversationId === conversationId)
            .map((m: any) => ({ role: m.role, content: m.content }));
        }
      } catch (histErr: any) {
        reqLog.warn('api.chat_history_load_warning', `Could not load history: ${histErr.message}`);
      }
    }

    // Persist user turn and ensure conversation exists
    const now = new Date().toISOString();
    if (conversationId) {
      const userMsgId = `msg_u_${Date.now()}`;
      try {
        const pgUp = await isPgAvailable();
        if (pgUp) {
          await dbQuery(
            `INSERT INTO conversations (id, title, mode, metadata, created_at, updated_at)
             VALUES ($1, $2, 'RESEARCH', '{}'::jsonb, $3, $3)
             ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
            [conversationId, truncateSnippet(query, 60), now]
          );
          await dbQuery(
            `INSERT INTO conversation_messages (id, conversation_id, role, content, created_at)
             VALUES ($1, $2, 'user', $3, $4)`,
            [userMsgId, conversationId, query, now]
          );
        } else {
          if (!inMemoryStore.conversations.has(conversationId)) {
            inMemoryStore.conversations.set(conversationId, {
              id: conversationId,
              title: truncateSnippet(query, 60),
              mode: 'RESEARCH',
              metadata: {},
              createdAt: now,
              updatedAt: now,
            });
          } else {
            const conv = inMemoryStore.conversations.get(conversationId);
            if (conv) conv.updatedAt = now;
          }
          inMemoryStore.conversationMessages.push({
            id: userMsgId,
            conversationId,
            role: 'user',
            content: query,
            createdAt: now,
          });
        }
      } catch (saveErr: any) {
        reqLog.warn('api.chat_save_turn_failed', `Failed to save user turn: ${saveErr.message}`);
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullAssistantResponse = '';
        let assistantCitations: any[] = [];
        let detectedIntent: string | undefined;

        try {
          for await (const chunk of handleChatQueryStream({
            query,
            conversationId,
            history: historyTurns,
            signal: req.signal,
          })) {
            if (req.signal.aborted) {
              reqLog.info('api.chat_aborted_by_client', 'Client aborted chat stream early');
              break;
            }

            if (chunk.type === 'token' && chunk.content) {
              fullAssistantResponse += chunk.content;
            } else if (chunk.type === 'citation' && chunk.citations) {
              assistantCitations = chunk.citations;
            } else if (chunk.type === 'intent' && chunk.intent) {
              detectedIntent = chunk.intent;
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch (streamErr: any) {
          reqLog.warn('api.chat_stream_error', `Chat supervisor stream error: ${streamErr.message}`);
          const errChunk: ChatStreamResponse = {
            type: 'error',
            error: streamErr.message || 'Lỗi khi xử lý phản hồi từ trợ lý AI',
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errChunk)}\n\n`));
        }

        // Persist assistant turn on completion
        if (conversationId && fullAssistantResponse.trim()) {
          const assistantMsgId = `msg_a_${Date.now()}`;
          const finishedAt = new Date().toISOString();
          try {
            const pgUp = await isPgAvailable();
            if (pgUp) {
              await dbQuery(
                `INSERT INTO conversation_messages (id, conversation_id, role, content, citations, intent, created_at)
                 VALUES ($1, $2, 'assistant', $3, $4, $5, $6)`,
                [assistantMsgId, conversationId, fullAssistantResponse, JSON.stringify(assistantCitations), detectedIntent, finishedAt]
              );
            } else {
              inMemoryStore.conversationMessages.push({
                id: assistantMsgId,
                conversationId,
                role: 'assistant',
                content: fullAssistantResponse,
                citations: assistantCitations,
                intent: detectedIntent,
                createdAt: finishedAt,
              });
            }
          } catch {}
        }

        controller.close();
      },
    });

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/chat', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/chat', status_class: '2xx' }, durationSec);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'x-request-id': correlationId,
      },
    });
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/chat', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/chat', status_class: '5xx' }, durationSec);
    reqLog.error('api.chat_failed', `Chat API failed: ${err.message}`, { error: err });
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'x-request-id': correlationId },
    });
  }
}
