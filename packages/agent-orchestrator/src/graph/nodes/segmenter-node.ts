/**
 * Micro-Step 1B: Scene Segmenter & Layout Mapper Node
 * Breaks chapter scripts into 5s–25s scenes and assigns layout modes
 */

import { LayoutMode, SceneGeneration } from '@chronoviet/shared-spec';
import { ChronoGraphState, getNodeLogger } from '../state.js';

const TEMPLATE_LAYOUTS: Record<string, LayoutMode[]> = {
  QUICK_SHORTS: ['FULL_COVER', 'CENTER_SCALE', 'QUOTE_SLIDE', 'STAT_CARD'],
  MODERN_NEWS: ['STAT_CARD', 'TIMELINE_CHRONO', 'FULL_COVER', 'HISTORICAL_FRAME'],
  HISTORICAL_DOCUMENTARY: [
    'HISTORICAL_FRAME',
    'TIMELINE_CHRONO',
    'QUOTE_SLIDE',
    'STAT_CARD',
    'CENTER_SCALE',
    'FULL_COVER',
  ],
};

export function inferSemanticLayoutMode(
  text: string,
  templateId: string = 'HISTORICAL_DOCUMENTARY',
  fallbackIdx: number = 0,
  availableLayouts: LayoutMode[] = TEMPLATE_LAYOUTS.HISTORICAL_DOCUMENTARY
): LayoutMode {
  const lower = text.toLowerCase();

  // 1. Direct speech, proclamation or historical quote
  if (/["“'‘].{5,50}["”'’]|hịch tướng sĩ|bình ngô đại cáo|tuyên ngôn|lời thề|lời dặn|khẳng định rằng|lời nói của/i.test(text)) {
    if (availableLayouts.includes('QUOTE_SLIDE')) return 'QUOTE_SLIDE';
  }

  // 2. Comparison / Versus confrontation
  if (/so với|đối đầu|hai bên|tương quan lực lượng|địch và ta|quân ta.*quân địch|thủy chiến.*bộ chiến/i.test(lower)) {
    if (availableLayouts.includes('VERSUS_CARD')) return 'VERSUS_CARD';
  }

  // 3. Quantifiable statistics / Numbers / Dates
  if (/(?:\d+\s*(?:vạn|nghìn|triệu|chiến thuyền|quân|binh sĩ|khẩu thần công|ngày đêm))|năm\s+\d{3,4}/i.test(text)) {
    if (availableLayouts.includes('STAT_CARD')) return 'STAT_CARD';
    if (availableLayouts.includes('TIMELINE_CHRONO')) return 'TIMELINE_CHRONO';
  }

  // 4. Chronological progression / Milestones
  if (/tiến trình|giai đoạn|sau đó|tiếp theo|bước ngoặt|thời kỳ|thế kỷ/i.test(lower)) {
    if (availableLayouts.includes('TIMELINE_CHRONO')) return 'TIMELINE_CHRONO';
  }

  // 5. Default: balanced round-robin from template layouts
  return availableLayouts[fallbackIdx % availableLayouts.length];
}

export async function segmenterNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'segmenter');
  nodeLog.info('orchestrator.segmenter_started', `Segmenting chapter scripts into scenes`, {
    projectId: state.projectId,
    templateId: state.templateId,
  });

  const availableLayouts = TEMPLATE_LAYOUTS[state.templateId || 'HISTORICAL_DOCUMENTARY'] || TEMPLATE_LAYOUTS.HISTORICAL_DOCUMENTARY;
  const scenes: SceneGeneration[] = [];
  let globalSceneIdx = 0;

  const sortedEntries = Object.entries(state.chapterScripts).sort(([a], [b]) => Number(a) - Number(b));

  for (const [key, scriptText] of sortedEntries) {
    const chapterIdx = Number(key);
    // Split sentences
    const rawSentences = scriptText
      .split(/(?<=[.!?\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    // Group sentences into 5s-25s chunks (~15 - 45 words per scene)
    const sceneChunks: string[] = [];
    let currentChunk = '';

    for (const sentence of rawSentences) {
      if ((currentChunk + ' ' + sentence).split(/\s+/).length > 35) {
        if (currentChunk) sceneChunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      }
    }
    if (currentChunk) {
      sceneChunks.push(currentChunk.trim());
    }

    if (sceneChunks.length === 0 && scriptText.trim()) {
      sceneChunks.push(scriptText.trim());
    }

    for (let i = 0; i < sceneChunks.length; i++) {
      const voiceoverText = sceneChunks[i];
      const wordCount = voiceoverText.split(/\s+/).length;
      const targetDurationSeconds = Math.max(5, Math.ceil(wordCount / 2.5));
      const layoutMode = inferSemanticLayoutMode(voiceoverText, state.templateId, globalSceneIdx, availableLayouts);

      // Extract search keywords from text (including Vietnamese quotes and punctuation)
      const words = voiceoverText
        .replace(/[.,!?;:"'()“”‘’—…[\]]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 4);

      scenes.push({
        sceneId: `scene_${String(globalSceneIdx + 1).padStart(3, '0')}`,
        sceneIndex: globalSceneIdx,
        voiceoverText,
        layoutMode,
        contentType: 'IMAGE',
        targetDurationSeconds,
        searchKeywords: [state.userPrompt, ...words],
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
