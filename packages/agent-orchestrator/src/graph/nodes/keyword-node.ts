/**
 * Micro-Step 1C: Keyword Extractor Agent
 * Enhances each IMAGE scene's searchKeywords with canonical entity names and
 * aliases from the RAG context, plus license-whitelist tags, so the Research
 * Agent can crawl with precise historical keywords.
 */

import { createLogger, SceneGeneration } from '@chronoviet/shared-spec';
import { ChronoGraphState } from '../state.js';

const log = createLogger({ service: 'agent-orchestrator' });

const VIETNAMESE_STOP_WORDS = new Set([
  'năm', 'thời', 'của', 'và', 'với', 'trong', 'cho', 'trên', 'dưới', 'tại',
  'vào', 'ra', 'về', 'lại', 'các', 'những', 'một', 'đã', 'đang', 'sẽ',
  'người', 'quân', 'cuộc', 'trận', 'nhà', 'vua', 'sau', 'trước', 'khi',
  'không', 'có', 'là', 'được', 'bị', 'từ', 'đến', 'cùng', 'giữa', 'này',
]);

/**
 * Extract meaningful search keywords from a scene's voiceover text:
 * - Keeps the userPrompt as a base context term (passed in separately).
 * - Pulls capitalized proper nouns + year tokens, drops stop words.
 */
export function extractSearchKeywordsFromText(
  voiceoverText: string,
  ragEntities: string[] = [],
  userPrompt: string = ''
): string[] {
  const cleaned = voiceoverText.replace(/[.,!?;:"'()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = cleaned.split(' ').filter((w) => w.length > 2 && !VIETNAMESE_STOP_WORDS.has(w.toLowerCase()));

  // Prefer canonical entity names + aliases from RAG when they appear in the text
  const matchedEntities = ragEntities.filter((e) => {
    const lower = e.toLowerCase();
    return cleaned.toLowerCase().includes(lower);
  });

  // Fallback: proper-noun-looking tokens (first letter uppercase) + years
  const properNouns = tokens.filter((w) => /^[A-ZÀ-Ỹ]/.test(w) && !/^\d+$/.test(w));
  const years = tokens.filter((w) => /^\d{3,4}$/.test(w));

  const keywords: string[] = [];
  if (userPrompt.trim()) keywords.push(userPrompt.trim());
  keywords.push(...matchedEntities.slice(0, 4));
  keywords.push(...properNouns.slice(0, 4));
  keywords.push(...years.slice(0, 2));

  // De-duplicate preserving order
  return Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean))).slice(0, 8);
}

export async function keywordNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  log.info('orchestrator.keyword_extraction_started', `Extracting search keywords for ${state.scenes.length} scenes`, {
    projectId: state.projectId,
  });

  const ragEntities = state.ragContext?.verifiedContext?.map((e) => e.canonicalName) || [];
  const aliasTerms = Object.values(state.ragContext?.aliasTable || {}).flat().slice(0, 10);

  const updatedScenes: SceneGeneration[] = state.scenes.map((scene) => {
    if (scene.contentType !== 'IMAGE') return scene;
    const keywords = extractSearchKeywordsFromText(scene.voiceoverText, [...ragEntities, ...aliasTerms], state.userPrompt);
    return {
      ...scene,
      searchKeywords: keywords.length > 0 ? keywords : scene.searchKeywords,
    };
  });

  return {
    status: 'KEYWORDS_EXTRACTED',
    currentStep: 6,
    scenes: updatedScenes,
  };
}
