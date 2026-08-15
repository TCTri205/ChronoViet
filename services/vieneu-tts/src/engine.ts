import fs from 'fs';
import path from 'path';
import http from 'http';
import { VieNeuTTSRequest, VieNeuTTSResponse, WordTimestamp, envConfig, logFallbackAlert, createLogger } from '@chronoviet/shared-spec';
import { calculateSceneDurationInFrames } from './timestamp-converter.js';

const log = createLogger({ service: 'vieneu-tts' });

export interface IVieNeuEngine {
  synthesize(request: VieNeuTTSRequest): Promise<VieNeuTTSResponse>;
}

/**
 * Generate a valid PCM 16-bit Mono WAV Buffer for testing and fallback synthesis.
 * Produces clear audible test audio pulses corresponding to synthesized word timestamps.
 */
export function createSyntheticWavBuffer(
  durationMs: number,
  wordTimestamps: WordTimestamp[],
  sampleRate = 24000
): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const dataSize = numSamples * numChannels * bytesPerSample;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Audio generation: Optimized linear scanning O(N+M)
  const baseFreq = 480;
  let wordIdx = 0;
  for (let i = 0; i < numSamples; i++) {
    const currentSampleMs = (i / sampleRate) * 1000;

    while (wordIdx < wordTimestamps.length && currentSampleMs > wordTimestamps[wordIdx].endMs) {
      wordIdx++;
    }

    let sampleVal = 0;
    if (wordIdx < wordTimestamps.length) {
      const wt = wordTimestamps[wordIdx];
      if (currentSampleMs >= wt.startMs && currentSampleMs <= wt.endMs) {
        const freq = baseFreq + (wordIdx % 5) * 40;
        const t = i / sampleRate;
        sampleVal = Math.sin(2 * Math.PI * freq * t) * 12000;
      }
    }

    buffer.writeInt16LE(Math.floor(sampleVal), headerSize + i * bytesPerSample);
  }

  return buffer;
}

/**
 * Synthetic Fallback Engine for Development and Local CPU Environment
 */
export class SyntheticTTSFallbackEngine implements IVieNeuEngine {
  private cacheDir: string;

  constructor(cacheDir = path.resolve(process.cwd(), envConfig.AUDIO_CACHE_DIR)) {
    this.cacheDir = cacheDir;
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async synthesize(request: VieNeuTTSRequest): Promise<VieNeuTTSResponse> {
    const text = request.text.trim();
    if (!text) {
      return {
        status: 'ERROR',
        audioUrl: '',
        audioDurationMs: 0,
        calculatedFramesAt30fps: 0,
        wordTimestamps: [],
        errorMsg: 'Text cannot be empty',
        engineType: 'SYNTHETIC_FALLBACK_TONE',
      };
    }

    const words = text.split(/\s+/);
    const wordTimestamps: WordTimestamp[] = [];
    let currentMs = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Base duration proportional to word length (e.g. 220ms base + 35ms per char)
      const baseDuration = Math.max(180, word.length * 40);
      const startMs = currentMs;
      const endMs = startMs + baseDuration;
      wordTimestamps.push({ word, startMs, endMs });

      // Add pause if punctuation is present
      let pauseMs = 40;
      if (/[.,!?;:]$/.test(word)) {
        pauseMs = word.endsWith('.') ? 300 : 180;
      }
      currentMs = endMs + pauseMs;
    }

    const audioDurationMs = currentMs;
    const paddingMs = request.paddingMs ?? 300;
    const fps = request.fps ?? 30;
    const calculatedFramesAt30fps = calculateSceneDurationInFrames(audioDurationMs, paddingMs, fps);

    // Save or reuse cached synthetic WAV file (SHA256 deterministic hash)
    const fileHash = Buffer.from(`${text}_${request.sampleRate ?? 24000}`).toString('hex').substring(0, 16);
    const fileName = `tts_synth_${fileHash}.wav`;
    const filePath = path.join(this.cacheDir, fileName);

    if (!fs.existsSync(filePath)) {
      const wavBuffer = createSyntheticWavBuffer(audioDurationMs, wordTimestamps, request.sampleRate ?? 24000);
      fs.writeFileSync(filePath, wavBuffer);
    }

    return {
      status: 'SUCCESS',
      audioUrl: `/static/audio/${fileName}`,
      audioDurationMs,
      calculatedFramesAt30fps,
      wordTimestamps,
      engineType: 'SYNTHETIC_FALLBACK_TONE',
    };
  }
}

/**
 * Main VieNeu TTS Engine Wrapper (Python ONNX API Service + Fallback Engine)
 */
export class VieNeuEngine implements IVieNeuEngine {
  private fallbackEngine: SyntheticTTSFallbackEngine;
  private pythonUrl: string;

  constructor(pythonUrl = envConfig.VIENEU_PYTHON_URL) {
    this.pythonUrl = pythonUrl;
    this.fallbackEngine = new SyntheticTTSFallbackEngine();
  }

  async synthesize(request: VieNeuTTSRequest): Promise<VieNeuTTSResponse> {
    try {
      const payload = JSON.stringify(request);
      const url = new URL('/api/v1/synthesize', this.pythonUrl);

      const response = await new Promise<VieNeuTTSResponse>((resolve, reject) => {
        const req = http.request(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
            timeout: envConfig.TTS_HTTP_TIMEOUT_MS,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  resolve(JSON.parse(data));
                } catch (e) {
                  reject(e);
                }
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              }
            });
          }
        );

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        req.write(payload);
        req.end();
      });

      return response;
    } catch (err: any) {
      // If Python ONNX microservice is offline, seamlessly switch to Fallback Engine with warning log
      const reason = err?.message || 'Connection refused or offline';
      // Eval Integrity: strict mode must not substitute synthetic sine-wave audio
      if (envConfig.EVAL_STRICT) {
        throw new Error(`[EVAL_STRICT] VieNeu Python ONNX service unavailable: ${reason}`);
      }
      log.warn('tts.python_engine_failed', 'VieNeu Python ONNX engine failed; falling back to synthetic engine', {
        error: err,
        pythonUrl: this.pythonUrl,
        requestText: request.text,
      });
      logFallbackAlert({
        subsystem: 'TTS_ENGINE',
        primaryTarget: `VieNeu Python ONNX Neural Engine (${this.pythonUrl})`,
        fallbackTarget: 'SyntheticToneFallbackEngine (480Hz Sine Wave)',
        reason: reason,
        actionRequired: `Start VieNeu Python FastAPI ONNX service at ${this.pythonUrl} (e.g. python app.py)`,
      });
      return this.fallbackEngine.synthesize(request);
    }
  }
}
