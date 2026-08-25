/**
 * Vision Language Model (VLM) Inspector Scorer with Multi-Provider Routing & Dual-Cache
 *
 * Supported Providers:
 * 1. LOCAL_VLM / OPENAI_VLM: OpenAI-compatible vision completions endpoint (llama-server, Ollama, vLLM, Qwen2.5-VL, etc.)
 * 2. GEMINI_CLOUD: Google Gemini Vision API (when key configured)
 * 3. CLIP_LOCAL_FALLBACK: Zero-downtime deterministic Cosine Similarity & Noise Scorer
 */

import * as crypto from 'crypto';
import {
  createLogger,
  envConfig,
  logFallbackAlert,
  executeWithKeyRotation,
  hasAvailableApiKeys,
  hybridInferenceDispatcher,
} from '@chronoviet/infra';
import { getCachedVLMScore, setCachedVLMScore, VLMScoreResult } from './redis-cache.js';
import { scoreImageWithLocalCLIP } from './clip-scorer.js';

const log = createLogger({ service: 'vlm-inspector' });

export interface ScoreImageOptions {
  sha256?: string;
  pHash?: string;
  contextHash?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  metadata?: { title?: string; author?: string; license?: string };
  correlationId?: string;
  sceneId?: string;
}

const MAX_IMAGE_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB guard limit

function buildScoringPrompt(eventDescription: string, options: ScoreImageOptions): string {
  return `Bạn là chuyên gia thẩm định thị giác và bản sắc lịch sử Việt Nam cho nền tảng ChronoViet.
Hãy thẩm định hình ảnh tư liệu sau cho bối cảnh lịch sử:
"${eventDescription}"
Tiêu đề ảnh/metadata: "${options.metadata?.title || 'Không rõ'}" | Bản quyền: "${options.metadata?.license || 'Không rõ'}"

QUY TẮC BẮT BUỘC CHỐNG LỆCH THỜI ĐẠI (ANTI-ANACHRONISM ADR-5):
1. historicalContextScore (0 - 40 điểm):
   - Đánh giá tính xác thực lịch sử Việt Nam và sự tương thích đúng triều đại/thời kỳ.
   - PHẠT NẶNG (cho dưới 10 điểm) nếu:
     * Dính trang phục / đầu tóc triều đại phong kiến ngoại quốc không đúng lịch sử Việt Nam (ví dụ: bím tóc đuôi sam nhà Mãn Thanh, trang phục Hanbok Triều Tiên, Kimono Nhật Bản).
     * Là hình ảnh AI vẽ giả tạo dị dạng (plastic skin, ngón tay biến dạng, vũ khí kỳ ảo fantasy không có thật trong lịch sử).
     * Chứa yếu tố kiến trúc / công trình hiện đại trong bối cảnh cổ đại.
2. visualNoiseScore (0 - 30 điểm):
   - Không dính watermark, logo đóng dấu thương mại (Getty Images, Shutterstock, Alamy, iStock, v.v.), không có chữ đè to làm hỏng khuôn hình.
   - PHẠT NẶNG (dưới 10 điểm) nếu dính watermark hoặc chữ bản quyền đè dày đặc.
3. artisticFitScore (0 - 30 điểm):
   - Bố cục điện ảnh, thẩm mỹ, tỉ lệ hài hòa (16:9 / tư liệu), ánh sáng và độ sắc nét cao.
4. focalPoint ([x, y]):
   - Tọa độ số thực chuẩn hóa từ 0.0 đến 1.0 của chủ thể chính trong bức ảnh (mặc định [0.5, 0.4] với chân dung, [0.5, 0.5] với hiện vật/phong cảnh). TUYỆT ĐỐI KHÔNG dùng dạng phần trăm 0-100.

Trả về DUY NHẤT một JSON object hợp lệ:
{
  "historicalContextScore": number,
  "visualNoiseScore": number,
  "artisticFitScore": number,
  "focalPoint": [number, number],
  "reasons": ["lý do 1", "lý do 2"]
}`;
}

export function extractAndParseJson(
  rawText: string,
  scorerType: 'LOCAL_VLM' | 'OPENAI_VLM' | 'GEMINI_CLOUD'
): VLMScoreResult {
  let cleaned = rawText.trim();
  // Strip markdown code block wrappers if present
  const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch) {
    cleaned = markdownMatch[1].trim();
  }

  // Find JSON object boundaries using regex
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;

  let parsedJson: any;
  try {
    parsedJson = JSON.parse(jsonStr);
  } catch (err: any) {
    log.warn('vlm.json_parse_fallback', `Failed to parse VLM response JSON directly: ${err.message}`, {
      rawText: rawText.substring(0, 300),
      scorerType,
    });
    // Fallback: Attempt heuristic regex extraction of score numbers
    const hMatch = rawText.match(/historicalContextScore["'\s:]+(\d+)/i) || rawText.match(/historical[_\s]context["'\s:]+(\d+)/i);
    const nMatch = rawText.match(/visualNoiseScore["'\s:]+(\d+)/i) || rawText.match(/visual[_\s]noise["'\s:]+(\d+)/i);
    const aMatch = rawText.match(/artisticFitScore["'\s:]+(\d+)/i) || rawText.match(/artistic[_\s]fit["'\s:]+(\d+)/i);

    parsedJson = {
      historicalContextScore: hMatch ? Number(hMatch[1]) : 20,
      visualNoiseScore: nMatch ? Number(nMatch[1]) : 20,
      artisticFitScore: aMatch ? Number(aMatch[1]) : 20,
      reasons: [`Trích xuất heuristic từ ${scorerType}`],
    };
  }

  const hScore = Math.min(40, Math.max(0, Number(parsedJson.historicalContextScore ?? parsedJson.historical_context_score) || 20));
  const nScore = Math.min(30, Math.max(0, Number(parsedJson.visualNoiseScore ?? parsedJson.visual_noise_score) || 20));
  const aScore = Math.min(30, Math.max(0, Number(parsedJson.artisticFitScore ?? parsedJson.artistic_fit_score) || 20));
  const totalScore = hScore + nScore + aScore;

  let focalPoint: [number, number] | undefined;
  const rawFocal = Array.isArray(parsedJson.focalPoint)
    ? parsedJson.focalPoint
    : Array.isArray(parsedJson.focal_point)
      ? parsedJson.focal_point
      : undefined;

  if (rawFocal && rawFocal.length === 2) {
    let rawX = Number(rawFocal[0]);
    let rawY = Number(rawFocal[1]);
    if (isNaN(rawX)) rawX = 0.5;
    if (isNaN(rawY)) rawY = 0.5;

    // Normalize percentage values (e.g. 50 -> 0.5, 40 -> 0.4)
    if (rawX > 1.0 && rawX <= 100.0) rawX /= 100.0;
    if (rawY > 1.0 && rawY <= 100.0) rawY /= 100.0;

    const fx = Math.min(1.0, Math.max(0.0, rawX));
    const fy = Math.min(1.0, Math.max(0.0, rawY));
    focalPoint = [fx, fy];
  }

  return {
    historicalContextScore: hScore,
    visualNoiseScore: nScore,
    artisticFitScore: aScore,
    totalScore,
    overallScore: totalScore,
    passed: totalScore >= 60,
    focalPoint,
    reasons: Array.isArray(parsedJson.reasons)
      ? parsedJson.reasons
      : parsedJson.reason
      ? [parsedJson.reason]
      : [`Thẩm định bởi ${scorerType}`],
    scorerType,
  };
}

export const parseScoreJson = extractAndParseJson;

/**
 * Score an image with an OpenAI-compatible Vision Endpoint (e.g. llama-server, Ollama, vLLM, Qwen2.5-VL, etc.)
 */
export async function scoreImageWithLocalVLM(
  imageUrl: string,
  eventDescription: string,
  options: ScoreImageOptions = {}
): Promise<VLMScoreResult> {
  const prompt = buildScoringPrompt(eventDescription, options);
  const baseUrl = (options.baseUrl || envConfig.VLM_BASE_URL || envConfig.LLM_BASE_URL || 'http://localhost:8092').replace(/\/$/, '');
  const modelName = options.model || envConfig.VLM_MODEL || envConfig.EVAL_VLM_MODEL || envConfig.LOCAL_VLM_INSPECTOR || envConfig.LOCAL_LLM_PRIMARY_MODEL || 'qwen3.5-9b-instruct-q4_k_m';
  const endpoint = `${baseUrl}/v1/chat/completions`;

  let imagePart: { type: 'image_url'; image_url: { url: string } };
  const fs = await import('fs');
  if (fs.existsSync(imageUrl)) {
    try {
      const imageBuffer = fs.readFileSync(imageUrl);
      if (imageBuffer.length > MAX_IMAGE_PAYLOAD_BYTES) {
        log.warn('vlm.payload_size_warning', `Image ${imageUrl} size (${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB) exceeds 5MB limit`, {
          imageUrl,
          sizeBytes: imageBuffer.length,
          correlationId: options.correlationId,
          sceneId: options.sceneId,
        });
      }
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
  const effectiveApiKey = options.apiKey || envConfig.VLM_API_KEY;
  if (effectiveApiKey) {
    headers['Authorization'] = `Bearer ${effectiveApiKey}`;
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

  return extractAndParseJson(rawText, effectiveApiKey ? 'OPENAI_VLM' : 'LOCAL_VLM');
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
      if (imageBuffer.length > MAX_IMAGE_PAYLOAD_BYTES) {
        log.warn('vlm.payload_size_warning', `Image ${imageUrl} size (${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB) exceeds 5MB limit`, {
          imageUrl,
          sizeBytes: imageBuffer.length,
          correlationId: options.correlationId,
          sceneId: options.sceneId,
        });
      }
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

  const modelName = options.model || envConfig.GEMINI_VISION_MODEL || 'gemini-3.6-flash';

  const runWithKey = async (geminiKey: string) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
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
      const err = new Error(`Gemini API HTTP ${res.status}: ${res.statusText}`);
      (err as any).status = res.status;
      throw err;
    }

    const data = (await res.json()) as any;
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Empty response from Gemini API');
    }

    return extractAndParseJson(rawText, 'GEMINI_CLOUD');
  };

  if (options.apiKey) {
    return await runWithKey(options.apiKey);
  }

  return executeWithKeyRotation('gemini', runWithKey);
}

/**
 * Score an image using the unified provider chain:
 * 1. Redis / In-Memory Dual-Cache
 * 2. Strict Eval: Local/Configured VLM only (throws on failure)
 * 3. Hybrid Round-Robin Mode (Rotates across Local Vision & Gemini Cloud Vision keys)
 * 4. Attempt Local / OpenAI Vision Model (llama-server, Qwen2.5-VL, Ollama, etc.)
 * 5. Attempt Gemini Cloud Vision API (when key configured)
 * 6. Offline Fallback: Local CLIP Cosine Similarity Scorer
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
      correlationId: options.correlationId,
      sceneId: options.sceneId,
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
  const vlmModel = envConfig.VLM_MODEL || envConfig.LOCAL_VLM_INSPECTOR || envConfig.LOCAL_LLM_PRIMARY_MODEL || 'qwen3.5-9b-instruct-q4_k_m';
  const vlmBaseUrl = envConfig.VLM_BASE_URL || envConfig.LLM_BASE_URL || 'http://localhost:8092';

  // 3. Hybrid Round-Robin Mode (Rotates across Local Vision & Gemini Cloud Vision keys)
  if (
    envConfig.INFERENCE_ROUTING_MODE === 'hybrid_round_robin' &&
    !envConfig.EVAL_STRICT &&
    vlmProvider === 'auto'
  ) {
    const vlmTargets = hybridInferenceDispatcher.getInferenceTargets('vlm');
    if (vlmTargets.length > 0) {
      try {
        const result = await hybridInferenceDispatcher.executeWithHybridRotation('vlm', async (target: any) => {
          if (target.type === 'local') {
            return await scoreImageWithLocalVLM(imageUrl, eventDescription, {
              ...options,
              baseUrl: target.baseUrl,
              model: target.model,
              apiKey: target.apiKey,
            });
          } else {
            return await scoreImageWithGeminiApi(imageUrl, eventDescription, {
              ...options,
              apiKey: target.apiKey,
              model: target.model,
            });
          }
        });
        await setCachedVLMScore(result, cacheOpts);
        return result;
      } catch (hybridErr: any) {
        log.warn('vlm.hybrid_targets_exhausted', `All VLM hybrid targets failed: ${hybridErr.message}; falling back to Priority/CLIP flow`, {
          correlationId: options.correlationId,
          sceneId: options.sceneId,
        });
      }
    }
  }

  // 4. Attempt Local / OpenAI Vision Model if enabled or auto
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
        correlationId: options.correlationId,
        sceneId: options.sceneId,
      });

      // If explicitly configured for local/openai only and failed, don't silently jump to Gemini unless in auto mode
      if (vlmProvider !== 'auto' && !hasAvailableApiKeys('gemini') && !envConfig.GEMINI_API_KEY) {
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

  // 5. Attempt Gemini Cloud Vision API if configured
  if ((hasAvailableApiKeys('gemini') || envConfig.GEMINI_API_KEY) && (vlmProvider === 'gemini' || vlmProvider === 'auto')) {
    try {
      const result = await scoreImageWithGeminiApi(imageUrl, eventDescription, options);
      await setCachedVLMScore(result, cacheOpts);
      return result;
    } catch (geminiErr: any) {
      log.warn('vlm.gemini_call_failed', `Gemini API call failed: ${geminiErr.message}; activating Local CLIP fallback`, {
        imageUrl,
        error: geminiErr.message,
        correlationId: options.correlationId,
        sceneId: options.sceneId,
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

  // 6. Offline Fallback: Local CLIP Heuristic
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
