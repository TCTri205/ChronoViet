import { NextRequest, NextResponse } from 'next/server';
import { VieNeuEngine } from '@chronoviet/vieneu-tts';
import {
  createLogger,
  httpRequestsTotal,
  httpRequestDurationSeconds,
} from '@chronoviet/shared-spec';

const log = createLogger({ service: 'web-api-tts' });
const ttsEngine = new VieNeuEngine();

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const correlationId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const body = await req.json();
    const { text, speakerId, speedRatio } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text string is required' }, { status: 400 });
    }

    const ttsResult = await ttsEngine.synthesize({
      text,
      speakerId: speakerId || 'vi_historical_male_1',
      speedRatio: speedRatio || 1.0,
      sampleRate: 24000,
      paddingMs: 200,
      fps: 30,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/tts', status_class: '2xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/tts', status_class: '2xx' }, durationSec);

    return NextResponse.json(ttsResult, {
      headers: { 'x-request-id': correlationId },
    });
  } catch (err: any) {
    const durationSec = (Date.now() - startTime) / 1000;
    httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/tts', status_class: '5xx' });
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api/v1/tts', status_class: '5xx' }, durationSec);
    log.error('api.tts_synthesis_failed', `TTS API error: ${err.message}`, { error: err });
    return NextResponse.json({ error: err.message || 'TTS synthesis failed' }, { status: 500 });
  }
}
