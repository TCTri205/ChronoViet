/**
 * Vision Language Model (VLM) Inspector Scorer with Multi-Provider Routing & Dual-Cache
 *
 * Supported Providers:
 * 1. LOCAL_VLM / OPENAI_VLM: OpenAI-compatible vision completions endpoint (llama-server, Ollama, vLLM, Qwen2.5-VL, etc.)
 * 2. GEMINI_CLOUD: Google Gemini Vision API (when key configured)
 * 3. CLIP_LOCAL_FALLBACK: Zero-downtime deterministic Cosine Similarity & Noise Scorer
 */

import * as crypto from 'crypto';
import { createLogger, envConfig, logFallbackAlert } from '@chronoviet/shared-spec';
import { getCachedVLMScore, setCachedVLMScore, VLMScoreResult } from './redis-cache.js';
import { scoreImageWithLocalCLIP } from './clip-scorer.js';

const log = createLogger({ service: 'vlm-inspector' });

export interface ScoreImageOptions {
  sha256?: string;
  pHash?: string;
  contextHash?: string;
  metadata?: { title?: string; author?: string; license?: string };
}

function buildScoringPrompt(eventDescription: string, options: ScoreImageOptions): string {
  return `Bạn là chuyên gia thẩm định thị giác và bản sắc lịch sử Việt Nam cho nền tảng ChronoViet.
Hãy thẩm định hình ảnh tư liệu sau cho bối cảnh lịch sử:
"${eventDescription}"
Tiêu đề ảnh/metadata: "${options.metadata?.title || 'Không rõ'}" | Bản quyền: "${options.metadata?.license || 'Không rõ'}"

Hãy chấm điểm theo thang 100 với 3 tiêu chí:
1. historicalContextScore (0 - 40 điểm): Độ phù hợp bối cảnh lịch sử, trang phục, triều đại Việt Nam (loại bỏ nếu là phim cổ trang Trung Quốc/Hàn Quốc).
2. visualNoiseScore (0 - 30 điểm): Không dính watermark, logo, chữ đè, chất lượng sắc nét.
3. artisticFitScore (0 - 30 điểm): Bố cục điện ảnh, thẩm mỹ, tỉ lệ hài hòa.

Trả về DUY NHẤT một JSON object:
{
  "historicalContextScore": number,
  "visualNoiseScore": number,
  "artisticFitScore": number,
  "reasons": ["lý do 1", "lý do 2"]
}`;
}

function parseScoreJson(rawText: string, scorerType: 'LOCAL_VLM' | 'OPENAI_VLM' | 'GEMINI_CLOUD'): VLMScoreResult {
  const parsedJson = JSON.parse(rawText);
  const hScore = Math.min(40, Math.max(0, Number(parsedJson.historicalContextScore) || 20));
  const nScore = Math.min(30, Math.max(0, Number(parsedJson.visualNoiseScore) || 20));
  const aScore = Math.min(30, Math.max(0, Number(parsedJson.artisticFitScore) || 20));
  const totalScore = hScore + nScore + aScore;

  return {
    historicalContextScore: hScore,
    visualNoiseScore: nScore,
    artisticFitScore: aScore,
    totalScore,
    passed: totalScore >= 60,
    reasons: Array.isArray(parsedJson.reasons) ? parsedJson.reasons : [`Thẩm định bởi ${scorerType}`],
    scorerType,
  };
}

/**
 * Score an image with an OpenAI-compatible Vision Endpoint (e.g. llama-server, Ollama, vLLM, Qwen2.5-VL, etc.)
 */
export async function scoreImageWithLocalVLM(
  imageUrl: string,
  eventDescription: string,
  options: ScoreImageOptions = {}
): Promise<VLMScoreResult> {
  const prompt = buildScoringPrompt(eventDescription, options);
  const baseUrl = (envConfig.VLM_BASE_URL || envConfig.LLM_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
  const modelName = envConfig.VLM_MODEL || envConfig.EVAL_VLM_MODEL || envConfig.LOCAL_VLM_INSPECTOR || 'qwen3-vl-8b';
  const endpoint = `${baseUrl}/v1/chat/completions`;

  let imagePart: { type: 'image_url'; image_url: { url: string } };
  const fs = await import('fs');
  if (fs.existsSync(imageUrl)) {
    try {
      const imageBuffer = fs.readFileSync(imageUrl);
      const base64Data = imageBuffer.toString('base64');
      const ext = imageUrl.split('.').pop()?.toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';
      imagePart = { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } };
    } catch {
      imagePart = { type: 'image_url', image_url: { url: imageUrl } };
    }
  } else {
    imagePart = { type: 'image_url', image_url: { url: imageUrl } };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (envConfig.VLM_API_KEY) {
    headers['Authorization'] = `Bearer ${envConfig.VLM_API_KEY}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            imagePart,
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`VLM Vision endpoint HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('Empty response from VLM Vision endpoint');
  }

  const cleaned = rawText.replace(/```json|```/g, '').trim();
  return parseScoreJson(cleaned, envConfig.VLM_API_KEY ? 'OPENAI_VLM' : 'LOCAL_VLM');
}

/**
 * Score an image using Gemini Cloud Vision API
 */
export async function scoreImageWithGeminiApi(
  imageUrl: string,
  eventDescription: string,
  options: ScoreImageOptions = {}
): Promise<VLMScoreResult> {
  const prompt = buildScoringPrompt(eventDescription, options);
  const parts: any[] = [{ text: prompt }];

  const fs = await import('fs');
  if (fs.existsSync(imageUrl)) {
    try {
      const imageBuffer = fs.readFileSync(imageUrl);
      const base64Data = imageBuffer.toString('base64');
      const ext = imageUrl.split('.').pop()?.toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';

      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data,
        },
      });
    } catch {
      parts.push({ text: `Image Path: ${imageUrl}` });
    }
  } else if (imageUrl.startsWith('http')) {
    parts.push({ text: `Image URL: ${imageUrl}` });
  }

  const modelName = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${envConfig.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as any;
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Empty response from Gemini API');
  }

  return parseScoreJson(rawText, 'GEMINI_CLOUD');
}

/**
 * Score an image using the unified provider chain:
 * 1. Redis / In-Memory Dual-Cache
 * 2. Strict Eval: Local/Configured VLM only (throws on failure)
 * 3. Provider Routing:
 *    - 'local' | 'openai' | 'auto': attempts OpenAI-compatible Vision Endpoint (llama-server, Qwen2.5-VL, Ollama, etc.)
 *    - 'gemini': attempts Gemini Cloud API (if key present)
 *    - 'clip': falls back immediately to Local CLIP
 * 4. Resilient Fallback: Local CLIP Cosine Similarity Scorer
 */
export async function scoreImageWithVLM(
  imageUrl: string,
  eventDescription: string,
  options: ScoreImageOptions = {}
): Promise<VLMScoreResult> {
  const contextHash =
    options.contextHash ||
    crypto.createHash('sha256').update(eventDescription.trim().toLowerCase()).digest('hex').substring(0, 16);

  const cacheOpts = {
    imageSha256: options.sha256,
    imagePHash: options.pHash,
    contextHash,
  };

  // 1. Check Redis / In-Memory Dual Cache
  const cached = await getCachedVLMScore(cacheOpts);
  if (cached) {
    log.debug('vlm.cache_hit', 'Retrieved VLM score from dual-layer cache', {
      imageUrl,
      sha256: options.sha256,
      contextHash,
      score: cached.totalScore,
    });
    return cached;
  }

  // 2. Strict Evaluation Mode
  if (envConfig.EVAL_STRICT) {
    if (!envConfig.USE_LOCAL_LLM && envConfig.VLM_PROVIDER !== 'openai') {
      throw new Error('[EVAL_STRICT] USE_LOCAL_LLM must be true for local VLM evaluation');
    }
    try {
      const result = await scoreImageWithLocalVLM(imageUrl, eventDescription, options);
      await setCachedVLMScore(result, cacheOpts);
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`[EVAL_STRICT] Local VLM failed during evaluation: ${errMsg}`);
    }
  }

  const vlmProvider = envConfig.VLM_PROVIDER || 'auto';
  const vlmModel = envConfig.VLM_MODEL || envConfig.LOCAL_VLM_INSPECTOR || 'qwen3-vl-8b';
  const vlmBaseUrl = envConfig.VLM_BASE_URL || envConfig.LLM_BASE_URL || 'http://localhost:8080';

  // 3. Attempt Local / OpenAI Vision Model if enabled or auto
  if (vlmProvider === 'local' || vlmProvider === 'openai' || vlmProvider === 'auto') {
    try {
      const result = await scoreImageWithLocalVLM(imageUrl, eventDescription, options);
      await setCachedVLMScore(result, cacheOpts);
      return result;
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn('vlm.endpoint_failed', `VLM endpoint call failed (${vlmBaseUrl} [${vlmModel}]): ${errMsg}`, {
        imageUrl,
        vlmBaseUrl,
        vlmModel,
        error: errMsg,
      });

      // If explicitly configured for local/openai only and failed, don't silently jump to Gemini unless in auto mode
      if (vlmProvider !== 'auto' && !envConfig.GEMINI_API_KEY) {
        logFallbackAlert({
          subsystem: 'VLM_INSPECTOR',
          primaryTarget: `VLM Model (${vlmBaseUrl}) [${vlmModel}]`,
          fallbackTarget: 'Local CLIP Cosine Similarity Scorer',
          reason: errMsg,
          actionRequired: `Ensure Vision service is running at ${vlmBaseUrl} with model ${vlmModel}`,
        });

        const fallbackResult = scoreImageWithLocalCLIP(imageUrl, eventDescription, options.metadata);
        await setCachedVLMScore(fallbackResult, cacheOpts);
        return fallbackResult;
      }
    }
  }

  // 4. Attempt Gemini Cloud Vision API if configured
  if (envConfig.GEMINI_API_KEY && (vlmProvider === 'gemini' || vlmProvider === 'auto')) {
    try {
      const result = await scoreImageWithGeminiApi(imageUrl, eventDescription, options);
      await setCachedVLMScore(result, cacheOpts);
      return result;
    } catch (geminiErr: any) {
      log.warn('vlm.gemini_call_failed', `Gemini API call failed: ${geminiErr.message}; activating Local CLIP fallback`, {
        imageUrl,
        error: geminiErr.message,
      });

      logFallbackAlert({
        subsystem: 'VLM_INSPECTOR',
        primaryTarget: 'Gemini Cloud Vision API',
        fallbackTarget: 'Local CLIP Cosine Similarity Scorer',
        reason: `Gemini API call error: ${geminiErr.message}`,
        actionRequired: 'Check network connectivity or Gemini API quota',
      });

      const fallbackResult = scoreImageWithLocalCLIP(imageUrl, eventDescription, options.metadata);
      await setCachedVLMScore(fallbackResult, cacheOpts);
      return fallbackResult;
    }
  }

  // 5. Offline Fallback: Local CLIP Heuristic
  logFallbackAlert({
    subsystem: 'VLM_INSPECTOR',
    primaryTarget: `VLM Inspector (${vlmBaseUrl}) [${vlmModel}]`,
    fallbackTarget: 'Local CLIP Cosine Similarity Scorer (Offline ONNX/Rule Engine)',
    reason: `VLM endpoint (${vlmBaseUrl}) offline or unconfigured`,
    actionRequired: `Start VLM model (${vlmModel}) on ${vlmBaseUrl} or set VLM_BASE_URL in .env`,
  });

  const fallbackResult = scoreImageWithLocalCLIP(imageUrl, eventDescription, options.metadata);
  await setCachedVLMScore(fallbackResult, cacheOpts);
  return fallbackResult;
}

/**
 * Backward compatibility alias for scoreImageWithVLM
 */
export const scoreImageWithGemini = scoreImageWithVLM;
