/**
 * Micro-Step 1B: Scene Segmenter & Layout Mapper Node
 * Breaks chapter scripts into 5s–25s scenes and assigns layout modes
 */

import { createLogger, LayoutMode, SceneGeneration } from '@chronoviet/shared-spec';
import { ChronoGraphState } from '../state.js';

const log = createLogger({ service: 'agent-orchestrator' });

const DEFAULT_LAYOUTS: LayoutMode[] = [
  'HISTORICAL_FRAME',
  'TIMELINE_CHRONO',
  'QUOTE_SLIDE',
  'STAT_CARD',
  'CENTER_SCALE',
  'FULL_COVER',
];

export async function segmenterNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  log.info('orchestrator.segmenter_started', `Segmenting chapter scripts into scenes`, {
    projectId: state.projectId,
  });

  const scenes: SceneGeneration[] = [];
  let globalSceneIdx = 0;

  for (const [key, scriptText] of Object.entries(state.chapterScripts)) {
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
      const layoutMode = DEFAULT_LAYOUTS[globalSceneIdx % DEFAULT_LAYOUTS.length];

      // Extract search keywords from text
      const words = voiceoverText
        .replace(/[,.!?]/g, '')
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
