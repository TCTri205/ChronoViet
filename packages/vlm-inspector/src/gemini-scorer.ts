/**
 * Vision Scorer with Dual-Cache & Provider Routing
 * Priority: cache -> Local VLM (llama-server, required in eval strict mode)
 *           -> Gemini cloud (dev, when key present) -> Local CLIP (dev only)
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

function parseScoreJson(rawText: string, scorerType: 'LOCAL_VLM' | 'GEMINI_CLOUD'): VLMScoreResult {
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
 * Score an image with the LOCAL VLM served by llama-server (OpenAI chat-completions format).
 * This is the real VLM path used during eval strict mode — never the CLIP heuristic.
 */
export async function scoreImageWithLocalVLM(
  imageUrl: string,
  eventDescription: string,
  options: ScoreImageOptions = {}
): Promise<VLMScoreResult> {
  const prompt = buildScoringPrompt(eventDescription, options);
  const endpoint = `${envConfig.LLM_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`;

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: envConfig.EVAL_VLM_MODEL,
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
    throw new Error(`Local VLM HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('Empty response from local VLM');
  }

  // llama-server may wrap JSON in markdown fences — strip them
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  return parseScoreJson(cleaned, 'LOCAL_VLM');
}

/**
 * Score an image using the configured provider chain.
 * - Eval strict: local VLM only; failure throws (no CLIP heuristic).
 * - Dev: Gemini cloud when key present (CLIP fallback), else CLIP.
 */
export async function scoreImageWithGemini(
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

  // 1. Check Redis / In-Memory Dual Cache (scoped to image hash + context hash)
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

  // 2. Eval strict: local VLM is the only valid scorer
  if (envConfig.EVAL_STRICT) {
    if (!envConfig.USE_LOCAL_LLM) {
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

  // 3. Dev: Gemini cloud when key present
  if (envConfig.GEMINI_API_KEY) {
    try {
      const prompt = buildScoringPrompt(eventDescription, options);

      const parts: any[] = [{ text: prompt }];

      // If imageUrl is a local file, read and send inline data
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
            contents: [
              {
                parts,
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
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

      const result = parseScoreJson(rawText, 'GEMINI_CLOUD');
      await setCachedVLMScore(result, cacheOpts);
      return result;
    } catch (err: any) {
      log.warn('vlm.gemini_call_failed', `Gemini API call failed: ${err.message}; activating Local CLIP fallback`, {
        imageUrl,
        error: err.message,
      });

      logFallbackAlert({
        subsystem: 'VLM_INSPECTOR',
        primaryTarget: 'Gemini Cloud Vision API',
        fallbackTarget: 'Local CLIP Cosine Similarity Scorer',
        reason: `Gemini API call error: ${err.message}`,
        actionRequired: 'Check network connectivity or quota limits',
      });

      const fallbackResult = scoreImageWithLocalCLIP(imageUrl, eventDescription, options.metadata);
      await setCachedVLMScore(fallbackResult, cacheOpts);
      return fallbackResult;
    }
  }

  // 4. Dev: no key -> Local CLIP heuristic
  logFallbackAlert({
    subsystem: 'VLM_INSPECTOR',
    primaryTarget: `VLM Inspector / Gemini Vision API [${envConfig.LOCAL_VLM_INSPECTOR}]`,
    fallbackTarget: 'Local CLIP Cosine Similarity Scorer (Offline ONNX/Rule Engine)',
    reason: 'GEMINI_API_KEY environment variable is unconfigured',
    actionRequired: 'Set GEMINI_API_KEY in .env or rely on local CLIP fallback',
  });

  const fallbackResult = scoreImageWithLocalCLIP(imageUrl, eventDescription, options.metadata);
  await setCachedVLMScore(fallbackResult, cacheOpts);
  return fallbackResult;
}
