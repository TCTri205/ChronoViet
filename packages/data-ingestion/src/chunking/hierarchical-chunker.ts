/**
 * Dynamic Hierarchical Temporal Chunking Engine
 * Component 3 of Module 0 Data Preprocessing & Ingestion ETL
 */

import { SourceReliability } from '@chronoviet/shared-spec';
import {
  CHUNK_PARENT_MIN_WORDS,
  CHUNK_PARENT_MAX_WORDS,
  CHUNK_CHILD_MIN_WORDS,
  CHUNK_CHILD_MAX_WORDS,
  CHUNK_CHILD_TARGET_WORDS,
  CHUNK_CHILD_OVERLAP_WORDS,
} from '@chronoviet/shared-spec';
import { enrichChunkMetadata, EnrichedMetadata } from './metadata-enricher.js';

export interface ProcessedHierarchicalChunk {
  id: string;
  title: string;
  textContent: string;
  isParent: boolean;
  wordCount: number;
  metadata: EnrichedMetadata;
}

export interface HierarchicalChunkingOptions {
  parentMinWords?: number; // Default 2000
  parentMaxWords?: number; // Default 3000
  childTargetWords?: number; // Default 400 (range 300-500)
  childOverlapWords?: number; // Default 40
}
export interface HierarchicalChunkingResult {
  parentChunks: ProcessedHierarchicalChunk[];
  childChunks: ProcessedHierarchicalChunk[];
  totalWords: number;
}

/**
 * Helper to count words in a string
 */

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Splits document text into clean paragraphs
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Dynamic Hierarchical Temporal Chunking Algorithm
 * Creates Parent Chunks (2,000 - 3,000 words) for macro context and
 * Child Chunks (300 - 500 words) for micro events linked to parent_chunk_id.
 */
export function chunkDocumentHierarchical(
  text: string,
  docMetadata: {
    title: string;
    sourceName?: string;
    dynasty?: string;
    sourceReliability?: SourceReliability;
    pageNumber?: number;
    keyFigures?: string[];
    location?: string;
  },
  options: HierarchicalChunkingOptions = {}
): HierarchicalChunkingResult {
  const parentMinWords = options.parentMinWords ?? CHUNK_PARENT_MIN_WORDS;
  const parentMaxWords = options.parentMaxWords ?? CHUNK_PARENT_MAX_WORDS;
  const childTargetWords = options.childTargetWords ?? CHUNK_CHILD_TARGET_WORDS;
  const childOverlapWords = options.childOverlapWords ?? CHUNK_CHILD_OVERLAP_WORDS;

  const paragraphs = splitParagraphs(text);
  const parentChunks: ProcessedHierarchicalChunk[] = [];
  const childChunks: ProcessedHierarchicalChunk[] = [];

  let currentParentParagraphs: string[] = [];
  let currentParentWordCount = 0;
  let parentIndex = 1;

  const totalWords = countWords(text);

  const titleHash = (docMetadata.title + text.slice(0, 30))
    .split('')
    .reduce((acc, char) => (acc * 33) ^ char.charCodeAt(0), 5381) >>> 0;

  // Helper function to process a completed Parent Chunk and generate its Child Chunks
  const processParent = () => {
    if (currentParentParagraphs.length === 0) return;

    const parentContent = currentParentParagraphs.join('\n\n');
    const parentWords = countWords(parentContent);
    const parentId = `parent_chunk_${titleHash}_${parentIndex}`;

    // 1. Create Parent Chunk with enriched metadata
    const parentMetadata = enrichChunkMetadata(parentContent, {
      title: docMetadata.title,
      sourceName: docMetadata.sourceName,
      dynasty: docMetadata.dynasty,
      sourceReliability: docMetadata.sourceReliability,
      pageNumber: docMetadata.pageNumber,
      keyFigures: docMetadata.keyFigures,
      location: docMetadata.location,
    });

    const parentChunk: ProcessedHierarchicalChunk = {
      id: parentId,
      title: `${docMetadata.title} (Phần ${parentIndex})`,
      textContent: parentContent,
      isParent: true,
      wordCount: parentWords,
      metadata: parentMetadata,
    };
    parentChunks.push(parentChunk);

    // 2. Generate Child Chunks (300 - 500 words) from Parent Content
    const words = parentContent.split(/\s+/);
    let childIndex = 1;
    let wordCursor = 0;

    // A "good remainder" is a leftover tail that can itself be chunked validly:
    //   - 0 words (end of text)
    //   - between MIN and MAX words (one final chunk)
    //   - at least 2*MIN words (can keep splitting)
    // The "dead zone" (MAX < tail < 2*MIN) is avoided so no tail chunk falls short.
    const isGoodRemainder = (end: number): boolean => {
      const rem = words.length - end;
      return rem === 0 || (rem >= CHUNK_CHILD_MIN_WORDS && rem <= CHUNK_CHILD_MAX_WORDS) || rem >= 2 * CHUNK_CHILD_MIN_WORDS;
    };

    while (wordCursor < words.length) {
      const remaining = words.length - wordCursor;
      let actualEnd = Math.min(wordCursor + childTargetWords, words.length);

      // 1. If the whole remainder fits in one chunk, take it all.
      if (remaining <= CHUNK_CHILD_MAX_WORDS) {
        actualEnd = words.length;
      } else {
        // 2. Try sentence-boundary snapping first (must preserve validity).
        let snappedEnd = -1;
        const searchMin = Math.max(wordCursor + Math.floor(childTargetWords * 0.7), actualEnd - 40);
        const searchMax = Math.min(words.length - 1, actualEnd + 40);
        for (let i = searchMin; i <= searchMax; i++) {
          if (/[.!?]["'”’)]?$/.test(words[i])) {
            const candidateEnd = i + 1;
            const candidateSize = candidateEnd - wordCursor;
            if (candidateSize >= CHUNK_CHILD_MIN_WORDS && candidateSize <= CHUNK_CHILD_MAX_WORDS && isGoodRemainder(candidateEnd)) {
              snappedEnd = candidateEnd;
            }
            break;
          }
        }

        const targetIsGood = isGoodRemainder(actualEnd) && actualEnd - wordCursor <= CHUNK_CHILD_MAX_WORDS;
        if (snappedEnd > 0) {
          actualEnd = snappedEnd;
        } else if (!targetIsGood) {
          // 3. No valid snap: adjust the target so the remainder is good.
          const remAfterTarget = words.length - actualEnd;
          if (remAfterTarget < CHUNK_CHILD_MIN_WORDS) {
            // Short tail: if the whole remainder fits in one chunk, absorb it all;
            // otherwise leave exactly MIN words for the final chunk.
            actualEnd = remaining <= CHUNK_CHILD_MAX_WORDS ? words.length : words.length - CHUNK_CHILD_MIN_WORDS;
          } else if (remAfterTarget > CHUNK_CHILD_MAX_WORDS) {
            // Extend this chunk so the leftover tail is exactly MAX (single valid chunk).
            actualEnd = words.length - CHUNK_CHILD_MAX_WORDS;
          } else {
            // Pull back so the remainder is exactly MAX.
            actualEnd = words.length - CHUNK_CHILD_MAX_WORDS;
          }
          if (actualEnd - wordCursor < CHUNK_CHILD_MIN_WORDS) {
            actualEnd = words.length;
          }
        }
      }

      const childWords = words.slice(wordCursor, actualEnd);
      const childContent = childWords.join(' ');
      const childWordCount = childWords.length;

      const childId = `${parentId}_child_${childIndex}`;

      // Enrich Child Chunk metadata linking back to parentId
      const childMetadata = enrichChunkMetadata(childContent, {
        ...parentMetadata,
        parentChunkId: parentId,
      });

      childChunks.push({
        id: childId,
        title: `${docMetadata.title} - Đoạn ${parentIndex}.${childIndex}`,
        textContent: childContent,
        isParent: false,
        wordCount: childWordCount,
        metadata: childMetadata,
      });

      childIndex++;
      // Advance cursor with overlap only when it keeps every future chunk valid.
      if (actualEnd >= words.length) {
        break;
      }
      const overlapCursor = actualEnd - CHUNK_CHILD_OVERLAP_WORDS;
      // Overlap is safe only if the next chunk size stays within [MIN, MAX] bounds.
      const nextSize = words.length - overlapCursor;
      const nextSizeValid =
        nextSize >= CHUNK_CHILD_MIN_WORDS && nextSize <= CHUNK_CHILD_MAX_WORDS;
      if (overlapCursor > wordCursor && nextSizeValid && isGoodRemainder(overlapCursor)) {
        wordCursor = overlapCursor;
      } else {
        wordCursor = actualEnd;
      }
    }

    parentIndex++;
    currentParentParagraphs = [];
    currentParentWordCount = 0;
  };

  // Group paragraphs into Parent Chunks based on word count
  for (const para of paragraphs) {
    const paraWords = countWords(para);
    if (currentParentWordCount + paraWords > parentMaxWords && currentParentWordCount >= parentMinWords) {
      processParent();
    }
    currentParentParagraphs.push(para);
    currentParentWordCount += paraWords;
  }

  // Flush remaining paragraphs
  processParent();

  return {
    parentChunks,
    childChunks,
    totalWords,
  };
}
