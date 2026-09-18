/**
 * Chapter RAG Router: Temporal Sub-Query Formulator & Chronological Evidence Partitioner
 * Formulates time-bounded semantic sub-queries per chapter macro-beat and partitions evidence
 * chunks to prevent "Temporal Smearing" across historical chapters.
 */

import {
  ChapterPlan,
  HistoricalContextEntity,
} from '@chronoviet/shared-spec';
import { createLogger } from '@chronoviet/infra';

const log = createLogger({ service: 'chapter-rag-router' });

export interface TimeRange {
  startYear?: number;
  endYear?: number;
}

/**
 * Extracts 3-4 digit historical years from text (CE/BCE or standard AD years).
 */
export function extractYearsFromText(text: string): number[] {
  if (!text || typeof text !== 'string') return [];
  const years: number[] = [];
  const yearRegex = /\b(?:năm\s+)?(\d{3,4})\b/gi;
  let match: RegExpExecArray | null;

  while ((match = yearRegex.exec(text)) !== null) {
    const y = parseInt(match[1], 10);
    // Filter realistic historical years (e.g. 100 to 2050)
    if (y >= 100 && y <= 2050) {
      years.push(y);
    }
  }

  return Array.from(new Set(years)).sort((a, b) => a - b);
}

/**
 * Extracts time range from chapter metadata (timeAnchor, title, summary, keyEvents).
 */
export function extractTimeRangeFromChapter(chapter: ChapterPlan): TimeRange {
  // If timeAnchor is explicitly structured
  if (chapter.timeAnchor && typeof chapter.timeAnchor === 'object') {
    return {
      startYear: chapter.timeAnchor.startYear,
      endYear: chapter.timeAnchor.endYear,
    };
  }

  const combinedText = [
    typeof chapter.timeAnchor === 'string' ? chapter.timeAnchor : '',
    chapter.title,
    chapter.summary,
    ...(chapter.keyEvents || []),
  ].join(' ');

  // Look for patterns like "1890 - 1911", "1890–1911", "1890 đến 1911", "từ 1941 đến 1954"
  const rangeMatch = combinedText.match(/(\d{3,4})\s*(?:-|–|—|đến|tới)\s*(\d{3,4})/i);
  if (rangeMatch) {
    const y1 = parseInt(rangeMatch[1], 10);
    const y2 = parseInt(rangeMatch[2], 10);
    if (y1 >= 100 && y1 <= 2050 && y2 >= 100 && y2 <= 2050) {
      return {
        startYear: Math.min(y1, y2),
        endYear: Math.max(y1, y2),
      };
    }
  }

  const years = extractYearsFromText(combinedText);
  if (years.length >= 2) {
    return {
      startYear: years[0],
      endYear: years[years.length - 1],
    };
  } else if (years.length === 1) {
    return {
      startYear: years[0],
      endYear: years[0],
    };
  }

  return {};
}

/**
 * Tokenizes text into lowercase semantic tokens (excluding stop words).
 */
function getTokens(text: string): Set<string> {
  if (!text) return new Set();
  const rawTokens = text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !['và', 'là', 'của', 'những', 'các', 'trong', 'với', 'cho', 'này', 'đó', 'tại', 'vào'].includes(t));
  return new Set(rawTokens);
}

/**
 * Computes relevance score between a historical chunk and a chapter's requirements,
 * enforcing monotonic temporal bounding to prevent prior-phase chunks leaking into later chapters.
 */
export function scoreChunkForChapter(
  chunk: HistoricalContextEntity,
  chapter: ChapterPlan,
  timeRange: TimeRange,
  minChronologicalYear?: number
): number {
  let score = 0;

  const chunkText = [chunk.canonicalName, chunk.title, chunk.summary, ...(chunk.aliases || [])].filter(Boolean).join(' ');
  const chunkTokens = getTokens(chunkText);
  const chunkYears = extractYearsFromText(chunkText);

  // 1. Semantic Token Overlap
  const queryText = [
    chapter.title,
    chapter.summary,
    ...(chapter.keyEvents || []),
    ...(chapter.introducedEntities || []),
  ].join(' ');
  const queryTokens = getTokens(queryText);

  let overlapCount = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) {
      overlapCount++;
    }
  }
  score += overlapCount * 10;

  // 2. Exact Entity / Title Matches
  if (chapter.introducedEntities && chapter.introducedEntities.length > 0) {
    for (const ent of chapter.introducedEntities) {
      if (chunkText.toLowerCase().includes(ent.toLowerCase())) {
        score += 25;
      }
    }
  }

  // 3. Temporal Bounding ($\pm 15$ years buffer)
  if (timeRange.startYear !== undefined && timeRange.endYear !== undefined) {
    const effectiveMin = minChronologicalYear !== undefined ? Math.max(timeRange.startYear - 15, minChronologicalYear) : timeRange.startYear - 15;
    const minBound = timeRange.startYear - 15;
    const maxBound = timeRange.endYear + 15;

    if (chunkYears.length > 0) {
      const insideYears = chunkYears.filter((y) => y >= effectiveMin && y <= maxBound);
      const outsideYears = chunkYears.filter((y) => y < minBound - 20 || y > maxBound + 20);

      if (insideYears.length > 0) {
        score += insideYears.length * 30;
      }
      if (outsideYears.length > 0 && insideYears.length === 0) {
        // Heavy penalty if all years in chunk are far outside the chapter's era
        score -= outsideYears.length * 20;
      }
    }
  }

  // 4. Monotonic Chronological Invariant: T_start(Chapter_{i+1}) >= T_start(Chapter_i)
  // Heavily penalize chunks whose timeline precedes established earlier milestone
  if (minChronologicalYear !== undefined && chunkYears.length > 0) {
    const isStrictlyPrior = chunkYears.every((y) => y < minChronologicalYear);
    if (isStrictlyPrior) {
      score -= 50;
    }
  }

  return score;
}

/**
 * Helper to get representative year from chunk (timeStart, or extracted years).
 */
export function getChunkRepresentativeYear(chunk: HistoricalContextEntity): number | undefined {
  if (chunk.timeStart !== undefined) return chunk.timeStart;
  if (chunk.timeEnd !== undefined) return chunk.timeEnd;
  const chunkText = [chunk.canonicalName, chunk.title, chunk.summary].filter(Boolean).join(' ');
  const years = extractYearsFromText(chunkText);
  return years.length > 0 ? years[0] : undefined;
}

/**
 * Partitions and assigns verified RAG chunks to each chapter based on temporal and semantic relevance
 * with monotonic chronological anchoring.
 */
export function routeChunksToChapters(
  chapters: ChapterPlan[],
  globalChunks: HistoricalContextEntity[],
  maxChunksPerChapter: number = 4
): ChapterPlan[] {
  if (!chapters || chapters.length === 0) return [];
  if (!globalChunks || globalChunks.length === 0) {
    return chapters.map((c) => ({ ...c, chapterChunks: [] }));
  }

  // Pre-sort globalChunks chronologically so fallbacks and tie-breakers maintain monotonic timeline
  const sortedGlobalChunks = [...globalChunks].sort((a, b) => {
    const ya = getChunkRepresentativeYear(a) ?? 9999;
    const yb = getChunkRepresentativeYear(b) ?? 9999;
    return ya - yb;
  });

  // Determine global time boundaries from sorted chunks
  const validGlobalYears = sortedGlobalChunks
    .map(getChunkRepresentativeYear)
    .filter((y): y is number => y !== undefined);
  const globalMinYear = validGlobalYears.length > 0 ? Math.min(...validGlobalYears) : undefined;
  const globalMaxYear = validGlobalYears.length > 0 ? Math.max(...validGlobalYears) : undefined;

  let runningMinYear: number | undefined = undefined;

  return chapters.map((chapter, idx) => {
    let timeRange = extractTimeRangeFromChapter(chapter);

    // Monotonic chronological interpolation: if chapter has no explicit year anchor
    // but global chunks span an era, estimate chapter's timeline based on chapter index stride
    if (timeRange.startYear === undefined && globalMinYear !== undefined && globalMaxYear !== undefined && chapters.length > 1) {
      const stride = (globalMaxYear - globalMinYear) / (chapters.length - 1);
      const estStart = Math.round(globalMinYear + idx * stride);
      const estEnd = Math.round(globalMinYear + (idx + 1) * stride);
      timeRange = {
        startYear: estStart,
        endYear: estEnd,
      };
    }

    if (timeRange.startYear !== undefined) {
      runningMinYear = runningMinYear !== undefined ? Math.max(runningMinYear, timeRange.startYear) : timeRange.startYear;
    }

    const scoredChunks = sortedGlobalChunks.map((chunk) => ({
      chunk,
      score: scoreChunkForChapter(chunk, chapter, timeRange, runningMinYear),
    }));

    // Sort descending by score
    scoredChunks.sort((a, b) => b.score - a.score);

    // Pick top candidates
    let selectedChunks = scoredChunks
      .filter((s) => s.score > 0)
      .slice(0, maxChunksPerChapter)
      .map((s) => s.chunk);

    // Fallback: If chapter gets fewer than 2 chunks, supplement with chronological stride from sortedGlobalChunks
    // instead of always dumping index 0 and 1 into every chapter.
    if (selectedChunks.length < 2) {
      const existingIds = new Set(selectedChunks.map((c) => c.entityId || c.canonicalName));
      const chunkStride = Math.max(1, Math.floor(sortedGlobalChunks.length / chapters.length));
      const startOffset = Math.min((chapter.chapterIndex ?? idx) * chunkStride, Math.max(0, sortedGlobalChunks.length - 2));

      // Attempt stride window first
      for (let k = startOffset; k < sortedGlobalChunks.length && selectedChunks.length < 2; k++) {
        const candidate = sortedGlobalChunks[k];
        const cid = candidate.entityId || candidate.canonicalName;
        if (!existingIds.has(cid)) {
          selectedChunks.push(candidate);
          existingIds.add(cid);
        }
      }

      // If still fewer than 2, scan remaining from beginning
      if (selectedChunks.length < 2) {
        for (const candidate of sortedGlobalChunks) {
          const cid = candidate.entityId || candidate.canonicalName;
          if (!existingIds.has(cid)) {
            selectedChunks.push(candidate);
            existingIds.add(cid);
            if (selectedChunks.length >= 2) break;
          }
        }
      }
    }

    log.debug('orchestrator.chapter_rag_partitioned', `Partitioned RAG chunks for chapter ${chapter.title}`, {
      chapterIndex: chapter.chapterIndex,
      chapterTitle: chapter.title,
      timeRange,
      chunkCount: selectedChunks.length,
      runningMinYear,
    });

    return {
      ...chapter,
      chapterChunks: selectedChunks,
    };
  });
}

export class ChapterRAGRouter {
  public route(
    chapters: ChapterPlan[],
    globalChunks: HistoricalContextEntity[],
    maxChunksPerChapter: number = 4
  ): ChapterPlan[] {
    return routeChunksToChapters(chapters, globalChunks, maxChunksPerChapter);
  }
}
