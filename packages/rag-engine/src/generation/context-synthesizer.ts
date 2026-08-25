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

  // 3. Lost-in-the-Middle Sandwich Reordering & Numbered Evidence Chunks
  // Prime chunks (Rank 1 & Rank 2) are placed at the prompt extremities (Top & Bottom)
  let orderedContext = [...verifiedContext];
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
    const cleanContent = truncateToSentenceBoundary(rawContent, 800);
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
};
