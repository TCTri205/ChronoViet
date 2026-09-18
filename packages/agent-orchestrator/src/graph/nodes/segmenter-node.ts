/**
 * Micro-Step 1B: Scene Segmenter & Layout Mapper Node
 * Breaks chapter scripts into 5s–25s scenes and assigns layout modes
 */

import {
  DOMAIN_LAYOUT_WHITELIST,
  LayoutMode,
  SceneGeneration,
  VideoType,
  isPureImageLayout,
  getTargetWpm,
} from '@chronoviet/shared-spec';
import { ChronoGraphState, getNodeLogger } from '../state.js';
import { isValidHistoricalEntity } from './chaptering-node.js';

const TEMPLATE_LAYOUTS: Record<string, LayoutMode[]> = {
  QUICK_SHORTS: ['FULL_COVER', 'CENTER_SCALE', 'QUOTE_SLIDE', 'STAT_CARD'],
  MODERN_NEWS: ['STAT_CARD', 'TIMELINE_CHRONO', 'FULL_COVER', 'HISTORICAL_FRAME'],
  HISTORICAL_DOCUMENTARY: [
    'HISTORICAL_FRAME',
    'FULL_COVER',
    'BLUR_BG',
    'CENTER_SCALE',
    'DOCUMENTARY_GRID',
  ],
};

export function inferSemanticLayoutMode(
  text: string,
  templateId: string = 'HISTORICAL_DOCUMENTARY',
  fallbackIdx: number = 0,
  availableLayouts: LayoutMode[] = TEMPLATE_LAYOUTS.HISTORICAL_DOCUMENTARY,
  videoType?: VideoType
): LayoutMode {
  const lower = text.toLowerCase();
  const allowedPool = videoType && DOMAIN_LAYOUT_WHITELIST[videoType]
    ? new Set(DOMAIN_LAYOUT_WHITELIST[videoType])
    : null;

  // 1. Direct speech, proclamation or genuine historical quote enclosed in quotes or with direct proclamation verb + colon
  // Requires actual quotation marks or explicit proclamation syntax (e.g. "khẳng định rằng: ...", "tuyên bố: ...")
  const hasEnclosedQuotes = /["“'‘][^"”'’\n]{5,300}["”'’]/.test(text);
  const hasDirectProclamation = /(?:tuyên ngôn|hịch tướng sĩ|bình ngô đại cáo|lời thề|lời kêu gọi|lời dặn|khẳng định rằng|tuyên bố rằng|dõng dạc nói)\s*:\s*["“'‘]?[^"”'’\n]{5,300}/i.test(text);

  if (hasEnclosedQuotes || hasDirectProclamation) {
    if (!allowedPool || allowedPool.has('QUOTE_SLIDE')) {
      return 'QUOTE_SLIDE';
    }
  }

  // 2. Explicit quantifiable military / resource / physical statistics (strictly paired with count units, NOT bare calendar years)
  // e.g. "20 vạn quân", "500 chiến thuyền", "30 khẩu thần công", "55 ngày đêm", "1000 cây số"
  const hasConcreteStats = /\b\d+\s*(?:vạn|nghìn|ngàn|triệu|tỷ)?\s*(?:quân\s+sĩ|binh\s+sĩ|vạn\s+quân|quân|binh|chiến\s+thuyền|thuyền\s+chiến|khẩu\s+pháo|khẩu\s+thần\s+công|khẩu\s+súng|máy\s+bay|xe\s+tăng|tàu\s+chiến|ngày\s+đêm|km|cây\s+số|vạn\s+dặm|chiến\s+sĩ|tử\s+sĩ|tù\s+binh|đồng\s+bào|người)\b/i.test(text);

  if (hasConcreteStats) {
    if (!allowedPool || allowedPool.has('STAT_CARD')) {
      return 'STAT_CARD';
    }
  }

  // 3. Comparison / Versus confrontation (Strictly forbidden for BIOGRAPHY and ARTIFACT)
  if (/so với|đối đầu|hai bên|tương quan lực lượng|địch và ta|quân ta.*quân địch|thủy chiến.*bộ chiến/i.test(lower)) {
    if (!allowedPool || allowedPool.has('VERSUS_CARD')) {
      return 'VERSUS_CARD';
    }
  }

  // 4. Character Profile (Exclusive for BIOGRAPHY when introducing identity, birth, titles, roles, or aliases)
  if (videoType === 'BIOGRAPHY' && /sinh ra tại|quê quán|tên khai sinh|tên thật là|thân phụ|thân mẫu|thuở nhỏ|bí danh|danh xưng|chức vụ|tổng bí thư|chủ tịch nước|lãnh tụ/i.test(lower)) {
    if (!allowedPool || allowedPool.has('CHARACTER_PROFILE')) {
      return 'CHARACTER_PROFILE';
    }
  }

  // 5. Artifact Tag & Inspection (Exclusive for ARTIFACT when presenting museum artifact profile or technical specs)
  if (videoType === 'ARTIFACT' && /hiện vật trưng bày|hồ sơ bảo vật|thông số hiện vật|trưng bày tại bảo tàng/i.test(lower)) {
    if (!allowedPool || allowedPool.has('MUSEUM_TAG')) {
      return 'MUSEUM_TAG';
    }
  }

  // 6. Royal Decree (For DYNASTY when presenting official edicts or capital transfer proclamations)
  if (videoType === 'DYNASTY' && /toàn văn chiếu|trích nguyên văn chiếu|ban chiếu dời đô|chiếu truyền ngôi/i.test(lower)) {
    if (!allowedPool || allowedPool.has('ROYAL_DECREE')) {
      return 'ROYAL_DECREE';
    }
  }

  // 7. Split Theory (Exclusive for MYSTERY when presenting contrasting hypotheses or historical debates)
  if (videoType === 'MYSTERY' && /hai luồng giả thuyết|các giả thuyết đối lập|tranh luận sử học về/i.test(lower)) {
    if (!allowedPool || allowedPool.has('SPLIT_THEORY')) {
      return 'SPLIT_THEORY';
    }
  }

  // 8. Tactical Map (For BATTLE when describing tactical map or march deployment diagram)
  if (videoType === 'BATTLE' && /sơ đồ tác chiến|bản đồ tác chiến|bản đồ hành quân|sơ đồ thế trận/i.test(lower)) {
    if (!allowedPool || allowedPool.has('MAP_TACTICAL')) {
      return 'MAP_TACTICAL';
    }
  }

  // 9. Chronological progression / Milestones
  if (/(?:tiến trình lịch sử|giai đoạn then chốt|bước ngoặt thời kỳ|từ năm\s+\d{3,4}\s+đến\s+(?:năm\s+)?\d{3,4})/i.test(lower)) {
    if (!allowedPool || allowedPool.has('TIMELINE_CHRONO')) {
      return 'TIMELINE_CHRONO';
    }
  }

  // 6. Default: Visual-First round-robin across cinematic image layouts filtered by whitelist
  let visualLayouts = availableLayouts.filter((l) => isPureImageLayout(l));
  if (allowedPool) {
    const whitelistedVisuals = visualLayouts.filter((l) => allowedPool.has(l));
    if (whitelistedVisuals.length > 0) {
      visualLayouts = whitelistedVisuals;
    }
  }
  const pool = visualLayouts.length > 0 ? visualLayouts : availableLayouts;
  const selectedLayout = pool[fallbackIdx % pool.length];

  // If CENTER_SCALE is selected, verify word count <= 18 words to prevent visual overflow; otherwise fallback to HISTORICAL_FRAME / FULL_COVER
  if (selectedLayout === 'CENTER_SCALE') {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount > 18) {
      return pool.find((l) => l === 'HISTORICAL_FRAME' || l === 'FULL_COVER') || pool[0];
    }
  }

  return selectedLayout;
}

export function splitScriptIntoSentences(scriptText: string): string[] {
  if (!scriptText || !scriptText.trim()) return [];

  // 1. Prevent splitting on newlines after colons, semicolons, dashes, or dangling lists
  let normalized = scriptText
    .replace(/:\s*\n+/g, ': ')
    .replace(/;\s*\n+/g, '; ')
    .replace(/,\s*\n+/g, ', ')
    .replace(/\n+\s*([a-zà-ỹ])/g, ' $1');

  // 2. Context-Aware Abbreviation Masking
  normalized = normalized.replace(/\b(GS|PGS|TS|ThS|TP|TX|TT)\.\s+(?=[A-ZÀ-Ỹ])/g, '$1__DOT__ ');
  normalized = normalized.replace(/\b(v\.v)\.(?=\s*[,a-zà-ỹ])/gi, '$1__VVDOT__');

  // 3. Split strictly on terminal punctuation followed by whitespace
  const rawParts = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/__DOT__/g, '.').replace(/__VVDOT__/g, '.').trim())
    .filter((s) => s.length > 0);

  // 4. Clause boundary healing: merge dangling fragments and lowercase continuations
  const healedSentences: string[] = [];
  for (const part of rawParts) {
    if (healedSentences.length > 0) {
      const isFragment =
        /^[a-zà-ỹ]/u.test(part) ||
        /^(?:tiền|hậu|tả|hữu|trung quân|và|hoặc|nhưng|rồi|mà|với|cùng)(?:\s+|$)/iu.test(part) ||
        part.length < 15;

      const lastIdx = healedSentences.length - 1;
      const prev = healedSentences[lastIdx];
      const prevEndsWithColonOrComma = /[:;,–—]\s*$/.test(prev) || !/[.!?]$/.test(prev);

      if (isFragment || prevEndsWithColonOrComma) {
        healedSentences[lastIdx] = `${prev} ${part}`.replace(/\s+/g, ' ').trim();
        continue;
      }
    }
    healedSentences.push(part);
  }

  return healedSentences.filter((s) => s.length > 5);
}

export async function segmenterNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'segmenter');
  nodeLog.info('orchestrator.segmenter_started', `Segmenting chapter scripts into scenes`, {
    projectId: state.projectId,
    templateId: state.templateId,
  });

  const availableLayouts = TEMPLATE_LAYOUTS[state.templateId || 'HISTORICAL_DOCUMENTARY'] || TEMPLATE_LAYOUTS.HISTORICAL_DOCUMENTARY;
  const targetWpm = getTargetWpm(state.templateId);
  const scenes: SceneGeneration[] = [];
  let globalSceneIdx = 0;

  const sortedEntries = Object.entries(state.chapterScripts).sort(([a], [b]) => Number(a) - Number(b));

  for (const [key, scriptText] of sortedEntries) {
    const chapterIdx = Number(key);
    const currentChapter = state.chapters?.[chapterIdx];

    const rawSentences = splitScriptIntoSentences(scriptText);

    // Group sentences into 8s-25s chunks (~30 - 65 words per scene, ideal for documentary visual pacing)
    const sceneChunks: string[] = [];
    let currentChunk = '';

    for (const sentence of rawSentences) {
      const combinedWords = (currentChunk ? `${currentChunk} ${sentence}` : sentence).split(/\s+/).filter(Boolean).length;
      if (currentChunk && combinedWords > 52) {
        sceneChunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      }
    }
    if (currentChunk) {
      sceneChunks.push(currentChunk.trim());
    }

    // Merge short dangling sentence (< 14 words or < 3.5s) into previous scene to avoid rapid micro-scenes
    if (sceneChunks.length > 1) {
      const lastIdx = sceneChunks.length - 1;
      const lastWords = sceneChunks[lastIdx].split(/\s+/).filter(Boolean).length;
      const lastSec = lastWords / (targetWpm / 60);
      if (lastWords < 14 || lastSec < 3.5) {
        const dangling = sceneChunks.pop()!;
        sceneChunks[sceneChunks.length - 1] = `${sceneChunks[sceneChunks.length - 1]} ${dangling}`.trim();
      }
    }

    if (sceneChunks.length === 0 && scriptText.trim()) {
      sceneChunks.push(scriptText.trim());
    }

    let chapterPureCodeCount = 0;
    for (let i = 0; i < sceneChunks.length; i++) {
      const voiceoverText = sceneChunks[i];
      const wordCount = voiceoverText.split(/\s+/).filter(Boolean).length;
      const targetDurationSeconds = Math.max(5, Math.min(25, Math.ceil(wordCount / (targetWpm / 60))));
      let layoutMode = inferSemanticLayoutMode(voiceoverText, state.templateId, globalSceneIdx, availableLayouts, state.videoType);

      // Throttling: In HISTORICAL_DOCUMENTARY, cap Pure Code layouts at max 1 per chapter (~85%+ visual scenes)
      if (state.templateId === 'HISTORICAL_DOCUMENTARY' || !state.templateId) {
        if (!isPureImageLayout(layoutMode)) {
          if (chapterPureCodeCount >= 1) {
            const rawVisualPool: LayoutMode[] = ['HISTORICAL_FRAME', 'FULL_COVER', 'BLUR_BG', 'CENTER_SCALE'];
            const allowedPool = state.videoType && DOMAIN_LAYOUT_WHITELIST[state.videoType]
              ? new Set(DOMAIN_LAYOUT_WHITELIST[state.videoType])
              : null;
            const visualPool = allowedPool
              ? rawVisualPool.filter((l) => allowedPool.has(l))
              : rawVisualPool;
            const effectiveVisualPool = visualPool.length > 0 ? visualPool : rawVisualPool;
            layoutMode = effectiveVisualPool[globalSceneIdx % effectiveVisualPool.length];
          } else {
            chapterPureCodeCount++;
          }
        }
      }

      // Extract search keywords from scene text: capitalized proper nouns, chapter entities, and userPrompt
      const properNouns = Array.from(
        voiceoverText.matchAll(/(?<!\p{L})((?:\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?)(?:\s+\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?){1,3})(?!\p{L})/gu)
      ).map((m) => m[1].trim()).filter(isValidHistoricalEntity);

      const sceneKeywords = Array.from(
        new Set([
          state.userPrompt,
          ...properNouns,
          ...(currentChapter?.introducedEntities || []).slice(0, 2),
        ])
      ).filter(Boolean).slice(0, 5);

      scenes.push({
        sceneId: `scene_${String(globalSceneIdx + 1).padStart(3, '0')}`,
        sceneIndex: globalSceneIdx,
        chapterIndex: chapterIdx,
        voiceoverText,
        layoutMode,
        contentType: 'IMAGE',
        targetDurationSeconds,
        searchKeywords: sceneKeywords,
        candidates: [],
        usePureCodeFallback: false,
      });

      globalSceneIdx++;
    }
  }

  return {
    status: 'SCENES_SEGMENTED',
    currentStep: 6,
    scenes,
  };
}
