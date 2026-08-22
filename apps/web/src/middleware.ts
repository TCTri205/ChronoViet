import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const traceparent = request.headers.get('traceparent');
  const correlationId = request.headers.get('x-correlation-id');
  const existingRequestId = request.headers.get('x-request-id');

  // Derive requestId: x-request-id || x-correlation-id || trace ID from traceparent || random UUID
  let requestId = existingRequestId || correlationId;
  if (!requestId && traceparent) {
    const parts = traceparent.split('-');
    if (parts.length >= 4 && parts[1]) {
      requestId = parts[1];
    }
  }
  if (!requestId) {
    requestId = crypto.randomUUID();
  }

  // Clone request headers for downstream route handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('x-correlation-id', correlationId || requestId);
  if (traceparent) {
    requestHeaders.set('traceparent', traceparent);
  }

  // Return response with headers attached
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('x-request-id', requestId);
  response.headers.set('x-correlation-id', correlationId || requestId);
  if (traceparent) {
    response.headers.set('traceparent', traceparent);
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
