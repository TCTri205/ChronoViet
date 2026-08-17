import { NextResponse } from 'next/server';
import { getMetricsSnapshot, getMetricsContentType } from '@chronoviet/shared-spec';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metrics = await getMetricsSnapshot();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': getMetricsContentType(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    return new NextResponse(`Error collecting metrics: ${err.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
