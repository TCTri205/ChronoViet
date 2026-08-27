/**
 * ChronoViet Context Synthesizer
 * Formats multi-hop graph triples, chronological timeline, and verified evidence chunks
 * into high-density, structured RAG context for LLM reasoning.
 */

import {
  HistoricalContextEntity,
  GraphTripleItem,
} from '@chronoviet/shared-spec';
import { truncateToSentenceBoundary } from '../retrieval/reranker.js';

export interface StructuredContextInput {
  verifiedContext: (HistoricalContextEntity & {
    chunkId?: string;
    title?: string;
    textContent?: string;
    sourceReliability?: string;
    parentChunkId?: string;
    timeStart?: number;
    timeEnd?: number;
    dynasty?: string;
    epochIds?: string[];
  })[];
  triples?: GraphTripleItem[];
  aliasTable?: Record<string, string[]>;
  maxTokenBudget?: number;
}

export interface StructuredContextResult {
  formattedContext: string;
  chunkMap: Map<string, { id: string; title: string; content: string; reliability: string }>;
  tokenEstimate: number;
}

const CHARS_PER_TOKEN = 3.5;

/**
 * Strips duplicate boundary overlap words between two sibling chunks
 */
export function stripBoundaryOverlap(textA: string, textB: string, minCommonWords: number = 10): string {
  if (!textA || !textB) return (textB || '').trim();
  const wordsA = textA.trim().split(/\s+/);
  const wordsB = textB.trim().split(/\s+/);

  const maxCheck = Math.min(60, wordsA.length, wordsB.length);
  for (let len = maxCheck; len >= minCommonWords; len--) {
    const suffixA = wordsA.slice(wordsA.length - len).map((w) => w.toLowerCase()).join(' ');
    const prefixB = wordsB.slice(0, len).map((w) => w.toLowerCase()).join(' ');
    if (suffixA === prefixB) {
      return wordsB.slice(len).join(' ').trim();
    }
  }
  return textB.trim();
}

/**
 * Parses child index from chunkId (e.g. _child_1, _c1, _1) or title (Đoạn 1.1, Đoạn 1)
 */
export function parseChildIndex(chunkId?: string, title?: string): number | null {
  if (chunkId) {
    const m1 = chunkId.match(/_child_(\d+)/i);
    if (m1) return parseInt(m1[1], 10);
    const m2 = chunkId.match(/_c(\d+)/i);
    if (m2) return parseInt(m2[1], 10);
    const m3 = chunkId.match(/_(\d+)$/);
    if (m3) return parseInt(m3[1], 10);
  }
  if (title) {
    const mTitle = title.match(/Đoạn\s+(\d+(?:\.\d+)?)/i);
    if (mTitle) return parseFloat(mTitle[1]);
  }
  return null;
}

/**
 * Stitches contiguous sibling child chunks sharing the same parentChunkId and strips boundary overlap.
 */
export function stitchSiblingChunks<T extends {
  chunkId?: string;
  title?: string;
  textContent?: string;
  summary?: string;
  sourceReliability?: any;
  parentChunkId?: string;
  timeStart?: number;
  timeEnd?: number;
  dynasty?: string;
  epochIds?: string[];
  [key: string]: any;
}>(items: T[]): T[] {
  if (!items || items.length <= 1) return items;

  const parentGroups = new Map<string, { item: T; originalIndex: number; childIdx: number | null }[]>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.parentChunkId) {
      const childIdx = parseChildIndex(item.chunkId, item.title);
      const list = parentGroups.get(item.parentChunkId) || [];
      list.push({ item, originalIndex: i, childIdx });
      parentGroups.set(item.parentChunkId, list);
    }
  }

  const itemsToRemove = new Set<number>();
  const itemsToReplace = new Map<number, T>();

  for (const [, group] of parentGroups.entries()) {
    if (group.length < 2) continue;

    const indexed = group.filter((g) => g.childIdx !== null) as { item: T; originalIndex: number; childIdx: number }[];
    if (indexed.length < 2) continue;

    indexed.sort((a, b) => a.childIdx - b.childIdx);

    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j + 1 < indexed.length && indexed[j + 1].childIdx === indexed[j].childIdx + 1) {
        j++;
      }

      if (j > i) {
        const sequence = indexed.slice(i, j + 1);
        const firstEntry = sequence[0];

        let mergedContent = firstEntry.item.textContent || firstEntry.item.summary || '';
        let minStart = firstEntry.item.timeStart;
        let maxEnd = firstEntry.item.timeEnd;
        let bestReliability = firstEntry.item.sourceReliability || 'LEVEL_1';
        const allEpochs = new Set<string>(firstEntry.item.epochIds || []);

        for (let k = 1; k < sequence.length; k++) {
          const nextEntry = sequence[k];
          const nextText = nextEntry.item.textContent || nextEntry.item.summary || '';
          const strippedNext = stripBoundaryOverlap(mergedContent, nextText, 10);
          mergedContent = `${mergedContent}\n\n${strippedNext}`.trim();

          if (nextEntry.item.timeStart !== undefined) {
            minStart = minStart !== undefined ? Math.min(minStart, nextEntry.item.timeStart) : nextEntry.item.timeStart;
          }
          if (nextEntry.item.timeEnd !== undefined) {
            maxEnd = maxEnd !== undefined ? Math.max(maxEnd, nextEntry.item.timeEnd) : nextEntry.item.timeEnd;
          }
          if (nextEntry.item.sourceReliability === 'LEVEL_1' || bestReliability === 'LEVEL_1') {
            bestReliability = 'LEVEL_1';
          } else if (nextEntry.item.sourceReliability === 'LEVEL_2') {
            bestReliability = 'LEVEL_2';
          }
          for (const ep of nextEntry.item.epochIds || []) allEpochs.add(ep);
        }

        const baseTitle = firstEntry.item.title?.replace(/\s*-\s*Đoạn.*$/i, '').trim() || firstEntry.item.title;
        const stitchedTitle = `${baseTitle} - Đoạn hợp nhất (${firstEntry.childIdx}-${sequence[sequence.length - 1].childIdx})`;

        const mergedItem: T = {
          ...firstEntry.item,
          title: stitchedTitle,
          textContent: mergedContent,
          summary: mergedContent,
          sourceReliability: bestReliability,
          timeStart: minStart,
          timeEnd: maxEnd,
          epochIds: Array.from(allEpochs),
        };

        itemsToReplace.set(firstEntry.originalIndex, mergedItem);
        for (let k = 1; k < sequence.length; k++) {
          itemsToRemove.add(sequence[k].originalIndex);
        }

        i = j + 1;
      } else {
        i++;
      }
    }
  }

  const result: T[] = [];
  for (let i = 0; i < items.length; i++) {
    if (itemsToRemove.has(i)) continue;
    if (itemsToReplace.has(i)) {
      result.push(itemsToReplace.get(i)!);
    } else {
      result.push(items[i]);
    }
  }
  return result;
}

/**
 * Synthesizes and budgets RAG context with graph triples and numbered evidence chunks.
 */
export function assembleContext(input: StructuredContextInput): StructuredContextResult {
  const {
    verifiedContext = [],
    triples = [],
    aliasTable = {},
    maxTokenBudget = 3000,
  } = input;

  const chunkMap = new Map<string, { id: string; title: string; content: string; reliability: string }>();
  const sections: string[] = [];

  // 1. Graph Triples Section (Multi-hop structural relationships)
  if (triples.length > 0) {
    const topTriples = triples.slice(0, 15);
    const tripleLines = topTriples.map(
      (t) => `- [${t.source}] --(${t.relation})--> [${t.target}] (Độ tin cậy: ${(t.confidence * 100).toFixed(0)}%)`
    );
    sections.push(`### QUAN HỆ THỰC THỂ & LIÊN KẾT ĐA CHẶNG (GRAPH TRIPLES):\n${tripleLines.join('\n')}`);
  }

  // 2. Master Alias Table (Key naming conventions)
  const aliasEntries = Object.entries(aliasTable).slice(0, 8);
  if (aliasEntries.length > 0) {
    const aliasLines = aliasEntries.map(
      ([canonical, aliases]) => `- ${canonical}: còn gọi là ${aliases.slice(0, 3).join(', ')}`
    );
    sections.push(`### DANH XƯNG & TÊN GỌI LIÊN QUAN:\n${aliasLines.join('\n')}`);
  }

  // 3. Sibling Chunk Stitching
  const stitchedContext = stitchSiblingChunks(verifiedContext);

  // 4. Lost-in-the-Middle Sandwich Reordering & Numbered Evidence Chunks
  // Prime chunks (Rank 1 & Rank 2) are placed at the prompt extremities (Top & Bottom)
  let orderedContext = [...stitchedContext];
  if (orderedContext.length >= 3) {
    const rank1 = orderedContext[0];
    const rank2 = orderedContext[1];
    const middleChunks = orderedContext.slice(2);
    orderedContext = [rank1, ...middleChunks, rank2];
  }

  const chunkSections: string[] = [];
  let currentTokenEstimate = sections.join('\n\n').length / CHARS_PER_TOKEN;

  for (let i = 0; i < orderedContext.length; i++) {
    const item = orderedContext[i];
    const chunkId = item.chunkId || item.entityId || `chunk_${i + 1}`;
    const title = item.title || item.canonicalName || `Tài liệu ${i + 1}`;
    const rawContent = item.textContent || item.summary || '';
    const reliability = (item.sourceReliability as string) || 'LEVEL_1';

    // Truncate chunk cleanly at sentence boundary to conserve token budget & boost precision
    const cleanContent = truncateToSentenceBoundary(rawContent, 1200);
    const chunkEstimatedTokens = (title.length + cleanContent.length + 50) / CHARS_PER_TOKEN;

    if (chunkSections.length > 0 && currentTokenEstimate + chunkEstimatedTokens > maxTokenBudget) {
      break;
    }

    chunkMap.set(chunkId, {
      id: chunkId,
      title,
      content: cleanContent,
      reliability,
    });

    chunkSections.push(
      `[CHUNK_${i + 1}] ID: ${chunkId}\nTiêu đề: ${title}\nĐộ tin cậy: ${reliability}\nNội dung: ${cleanContent}`
    );

    currentTokenEstimate += chunkEstimatedTokens;
  }

  if (chunkSections.length > 0) {
    sections.push(`### TƯ LIỆU SỬ LIỆU XÁC THỰC (EVIDENCE CHUNKS):\n${chunkSections.join('\n\n')}`);
  }

  const formattedContext = sections.join('\n\n');
  const totalTokenEstimate = Math.ceil(formattedContext.length / CHARS_PER_TOKEN);

  return {
    formattedContext,
    chunkMap,
    tokenEstimate: totalTokenEstimate,
  };
}

export const ContextSynthesizer = {
  assembleContext,
  stitchSiblingChunks,
  stripBoundaryOverlap,
  parseChildIndex,
};
