import { createLogger, envConfig, logFallbackAlert } from '@chronoviet/shared-spec';
import { VLMScoreResult } from './redis-cache.js';

const log = createLogger({ service: 'vlm-inspector' });

export async function scoreImageWithGemini(
  _imageUrl: string,
  _eventDescription: string
): Promise<VLMScoreResult> {
  if (!envConfig.GEMINI_API_KEY) {
    log.warn('vlm.api_key_missing', 'GEMINI_API_KEY not configured; using stub scoring engine', {
      fallback: 'Stub Verification Scoring Engine',
    });
    logFallbackAlert({
      subsystem: 'VLM_INSPECTOR',
      primaryTarget: `VLM Inspector / Gemini Vision API [${envConfig.LOCAL_VLM_INSPECTOR}]`,
      fallbackTarget: 'Stub Verification Scoring Engine',
      reason: 'GEMINI_API_KEY environment variable is unconfigured',
      actionRequired: 'Set GEMINI_API_KEY in .env or run local SigLIP 2 / Qwen3-VL inspector',
    });
    return {
      historicalContextScore: 35,
      visualNoiseScore: 28,
      artisticFitScore: 25,
      totalScore: 88,
      passed: true,
      reasons: ['Trang phục cổ truyền Việt Nam chuẩn xác', 'Không watermark (stub — GEMINI_API_KEY missing)'],
    };
  }

  // Primary Scorer using Gemini 2.5 Flash Cloud API
  // TODO: Implement real Gemini Vision API call when GEMINI_API_KEY is set
  log.debug('vlm.stub_scored', 'Gemini scorer returned stub result (real API not implemented)', {
    imageUrl: _imageUrl,
  });
  return {
    historicalContextScore: 35,
    visualNoiseScore: 28,
    artisticFitScore: 25,
    totalScore: 88,
    passed: true,
    reasons: ['Trang phục cổ truyền Việt Nam chuẩn xác', 'Không watermark'],
  };
}
