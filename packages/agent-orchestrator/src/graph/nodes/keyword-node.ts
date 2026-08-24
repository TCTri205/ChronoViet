/**
 * Micro-Step 1C: Visual Query Planning & Keyword Extractor Agent
 * Analyzes each IMAGE scene and generates structured ImageSearchToolInput
 * (bilingual queries, visual type, historical period) for the Research Agent Tool.
 */

import {
  SceneGeneration,
} from '@chronoviet/shared-spec';
import {
  callLlm,
  createLogger,
  envConfig,
  ImageSearchToolInput,
  ImageSearchVisualType,
  parseLlmJson,
} from '@chronoviet/infra';
import { ChronoGraphState, getNodeLogger } from '../state.js';

const log = createLogger({ service: 'agent-orchestrator' });

const VIETNAMESE_STOP_WORDS = new Set([
  'năm', 'thời', 'của', 'và', 'với', 'trong', 'cho', 'trên', 'dưới', 'tại',
  'vào', 'ra', 'về', 'lại', 'các', 'những', 'một', 'đã', 'đang', 'sẽ',
  'người', 'quân', 'cuộc', 'trận', 'nhà', 'vua', 'sau', 'trước', 'khi',
  'không', 'có', 'là', 'được', 'bị', 'từ', 'đến', 'cùng', 'giữa', 'này',
]);

export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Heuristic fallback to extract meaningful search keywords from a scene's voiceover text
 */
export function extractSearchKeywordsFromText(
  voiceoverText: string,
  ragEntities: string[] = [],
  userPrompt: string = ''
): string[] {
  const cleaned = voiceoverText.replace(/[.,!?;:"'()“”‘’—…[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = cleaned.split(' ').filter((w) => w.length > 2 && !VIETNAMESE_STOP_WORDS.has(w.toLowerCase()));

  const matchedEntities = ragEntities.filter((e) => {
    const lower = e.toLowerCase();
    return cleaned.toLowerCase().includes(lower);
  });
  const entityKeywords = matchedEntities.length > 0 ? matchedEntities.slice(0, 4) : ragEntities.slice(0, 2);

  const properNouns = tokens.filter((w) => /^[A-ZÀ-Ỹ]/.test(w) && !/^\d+$/.test(w));
  const years = tokens.filter((w) => /^\d{3,4}$/.test(w));

  const keywords: string[] = [];
  if (userPrompt.trim()) keywords.push(userPrompt.trim());
  keywords.push(...entityKeywords);
  keywords.push(...properNouns.slice(0, 4));
  keywords.push(...years.slice(0, 2));

  return Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean))).slice(0, 8);
}

/**
 * Infer visual type heuristically from voiceover text
 */
export function inferVisualTypeHeuristic(text: string): ImageSearchVisualType {
  const lower = text.toLowerCase();
  if (lower.includes('trận') || lower.includes('chiến') || lower.includes('tấn công') || lower.includes('đại phá') || lower.includes('thủy chiến')) {
    return 'BATTLE_SCENE';
  }
  if (lower.includes('chân dung') || lower.includes('vua') || lower.includes('hoàng đế') || lower.includes('tướng') || lower.includes('tiểu sử')) {
    return 'PORTRAIT';
  }
  if (lower.includes('bản đồ') || lower.includes('địa bàn') || lower.includes('ranh giới') || lower.includes('lãnh thổ')) {
    return 'MAP_CHRONO';
  }
  if (lower.includes('trống đồng') || lower.includes('hiện vật') || lower.includes('vũ khí') || lower.includes('bảo vật') || lower.includes('cổ vật')) {
    return 'ARTIFACT';
  }
  if (lower.includes('khảo cổ') || lower.includes('di chỉ') || lower.includes('lăng mộ') || lower.includes('thành cổ')) {
    return 'ARCHAEOLOGY';
  }
  if (lower.includes('sông') || lower.includes('núi') || lower.includes('phong cảnh') || lower.includes('đền') || lower.includes('chùa')) {
    return 'LANDSCAPE';
  }
  return 'GENERAL_HISTORICAL';
}

/**
 * Visual Query Formulation Agent Node:
 * Employs LLM to formulate structured ImageSearchToolInput for each scene,
 * falling back to bilingual heuristic extraction when LLM is unavailable.
 */
export async function keywordNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'keyword');
  nodeLog.info('orchestrator.keyword_extraction_started', `Extracting search keywords for ${state.scenes.length} scenes`, {
    projectId: state.projectId,
  });

  const ragEntities = state.ragContext?.verifiedContext?.map((e) => e.canonicalName) || [];
  const aliasTerms = Object.values(state.ragContext?.aliasTable || {}).flat().slice(0, 10);
  const allContextEntities = [...ragEntities, ...aliasTerms];

  const imageScenes = state.scenes.filter((s) => s.contentType === 'IMAGE');

  // Attempt LLM structured query planning
  let llmQueriesMap: Record<string, Partial<ImageSearchToolInput>> = {};

  if (imageScenes.length > 0) {
    try {
      const scenesSummary = imageScenes
        .map((s) => `[Scene ${s.sceneId}] Voiceover: "${s.voiceoverText}"`)
        .join('\n');

      const systemPrompt = `Bạn là Visual Research Planning Agent của ChronoViet.
Nhiệm vụ: Phân tích voiceover của từng cảnh phim lịch sử và tạo ra Search Tool Input chuẩn để tìm kiếm tư liệu ảnh lịch sử (trên Wikimedia Commons & Search Engines).
QUY TẮC BẮT BUỘC:
1. Xuất duy nhất 1 JSON object hợp lệ: { "queries": [ { "sceneId": "...", "primaryQuery": "...", "englishQuery": "...", "visualType": "...", "historicalPeriod": "..." } ] }.
2. "primaryQuery": từ khóa tiếng Việt chi tiết, giàu ngữ cảnh lịch sử (ví dụ: "Tượng đài Trần Hưng Đạo bãi cọc Bạch Đằng").
3. "englishQuery": từ khóa tiếng Anh tương ứng chuẩn xác (ví dụ: "Statue of Tran Hung Dao Bach Dang battle painting").
4. "visualType": chọn 1 trong: ['PORTRAIT', 'BATTLE_SCENE', 'MAP_CHRONO', 'ARTIFACT', 'LANDSCAPE', 'ARCHAEOLOGY', 'GENERAL_HISTORICAL'].
5. Không thêm văn bản giải thích ngoài JSON.`;

      const userContent = `Chủ đề chung: "${state.userPrompt}"
Thực thể lịch sử kiểm chứng: ${ragEntities.join(', ') || 'Không có'}

Danh sách các cảnh phim:
${scenesSummary}`;

      const res = await callLlm({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
        responseFormat: 'json_object',
        timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
      });

      const parsed = parseLlmJson(res.content);
      const queryList = Array.isArray(parsed) ? parsed : parsed.queries || [parsed];
      for (const item of queryList) {
        if (item?.sceneId && item?.primaryQuery) {
          llmQueriesMap[item.sceneId] = {
            sceneId: item.sceneId,
            primaryQuery: String(item.primaryQuery),
            englishQuery: item.englishQuery ? String(item.englishQuery) : undefined,
            visualType: item.visualType || 'GENERAL_HISTORICAL',
            historicalPeriod: item.historicalPeriod ? String(item.historicalPeriod) : undefined,
          };
        }
      }
      nodeLog.debug('orchestrator.keyword_llm_success', `LLM formulated queries for ${Object.keys(llmQueriesMap).length} scenes`);
    } catch (err: any) {
      nodeLog.warn('orchestrator.keyword_llm_fallback', `LLM query planning fallback to heuristic: ${err.message}`);
    }
  }

  const updatedScenes: SceneGeneration[] = state.scenes.map((scene) => {
    if (scene.contentType !== 'IMAGE') return scene;

    const plannedQuery = llmQueriesMap[scene.sceneId];
    const rawKeywords = extractSearchKeywordsFromText(scene.voiceoverText, allContextEntities, state.userPrompt);

    if (plannedQuery && plannedQuery.primaryQuery) {
      const keywords = Array.from(
        new Set([
          plannedQuery.primaryQuery,
          ...(plannedQuery.englishQuery ? [plannedQuery.englishQuery] : []),
          ...rawKeywords,
        ])
      );
      return {
        ...scene,
        searchKeywords: keywords,
        searchParams: {
          sceneId: scene.sceneId,
          primaryQuery: plannedQuery.primaryQuery,
          englishQuery: plannedQuery.englishQuery,
          visualType: plannedQuery.visualType,
          historicalPeriod: plannedQuery.historicalPeriod,
          limit: 3,
        },
      };
    }

    // Heuristic fallback
    const primaryQuery = rawKeywords.length > 0 ? rawKeywords.join(' ') : state.userPrompt;
    const englishQuery = removeVietnameseTones(primaryQuery);
    const visualType = inferVisualTypeHeuristic(scene.voiceoverText);

    return {
      ...scene,
      searchKeywords: rawKeywords.length > 0 ? rawKeywords : [primaryQuery, englishQuery],
      searchParams: {
        sceneId: scene.sceneId,
        primaryQuery,
        englishQuery,
        visualType,
        historicalPeriod: state.userPrompt,
        limit: 3,
      },
    };
  });

  return {
    status: 'KEYWORDS_EXTRACTED',
    currentStep: 6,
    scenes: updatedScenes,
  };
}
