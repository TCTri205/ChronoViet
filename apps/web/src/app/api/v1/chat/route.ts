import { NextRequest } from 'next/server';
import { ChronoRagEngine } from '@chronoviet/rag-engine';
import {
  generateLLMCompletionStream,
  ChatStreamResponse,
  createLogger,
  truncateSnippet,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/shared-spec';

const log = createLogger({ service: 'web-api-chat' });

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();
  const reqLog = log.child({ correlationId });

  try {
    const body = await req.json();
    const query = body.query;

    if (!query || typeof query !== 'string') {
      httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/chat', status_class: '4xx' });
      return new Response(JSON.stringify({ error: 'Query string is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'x-request-id': correlationId },
      });
    }

    reqLog.info('api.chat_started', `Handling chat query: "${truncateSnippet(query)}"`, {
      querySnippet: truncateSnippet(query),
    });

    let citations: string[] = [];
    let contextText = '';

    try {
      const ragEngine = new ChronoRagEngine();
      const ragRes = await ragEngine.search({
        query,
        maxTokens: 2000,
        rerankTopK: 5,
      });

      citations = ragRes.citations || [];
      contextText = ragRes.verifiedContext
        .map((c) => `[${c.canonicalName}]: ${c.summary}`)
        .join('\n');
    } catch (ragErr: any) {
      log.warn('api.chat_rag_fallback', `RAG query failed: ${ragErr.message}`);
    }

    const messages = [
      {
        role: 'system' as const,
        content: `Bạn là trợ lý sử liệu Việt Nam thông thái của ChronoViet. Hãy giải thích chính xác, trang trọng, dựa trên tư liệu lịch sử được cung cấp dưới đây:\n\n${contextText}`,
      },
      {
        role: 'user' as const,
        content: query,
      },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // 1. Send citations first if available
        if (citations.length > 0) {
          const citationChunk: ChatStreamResponse = {
            type: 'citation',
            citations,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(citationChunk)}\n\n`));
        }

        // 2. Stream LLM tokens
        try {
          for await (const token of generateLLMCompletionStream(messages)) {
            const tokenChunk: ChatStreamResponse = {
              type: 'token',
              content: token,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(tokenChunk)}\n\n`));
          }
        } catch (llmErr: any) {
          const errChunk: ChatStreamResponse = {
            type: 'error',
            error: llmErr.message,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errChunk)}\n\n`));
        }

        // 3. Send done marker
        const doneChunk: ChatStreamResponse = {
          type: 'done',
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));
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
