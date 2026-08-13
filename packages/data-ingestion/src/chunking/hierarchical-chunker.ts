/**
 * Dynamic Hierarchical Temporal Chunking Engine
 * Component 3 of Module 0 Data Preprocessing & Ingestion ETL
 */

import { SourceReliability } from '@chronoviet/shared-spec';
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
  const parentMinWords = options.parentMinWords ?? 2000;
  const parentMaxWords = options.parentMaxWords ?? 3000;
  const childTargetWords = options.childTargetWords ?? 400;
  const childOverlapWords = options.childOverlapWords ?? 40;

  const paragraphs = splitParagraphs(text);
  const parentChunks: ProcessedHierarchicalChunk[] = [];
  const childChunks: ProcessedHierarchicalChunk[] = [];

  let currentParentParagraphs: string[] = [];
  let currentParentWordCount = 0;
  let parentIndex = 1;
  const timestamp = Date.now();

  const totalWords = countWords(text);

  const titleHash = (docMetadata.title + text.slice(0, 30))
    .split('')
    .reduce((acc, char) => (acc * 33) ^ char.charCodeAt(0), 5381) >>> 0;

  // Helper function to process a completed Parent Chunk and generate its Child Chunks
  const processParent = () => {
    if (currentParentParagraphs.length === 0) return;

    const parentContent = currentParentParagraphs.join('\n\n');
    const parentWords = countWords(parentContent);
    const parentId = `parent_chunk_${timestamp}_${titleHash}_${parentIndex}`;

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

    while (wordCursor < words.length) {
      let targetEnd = Math.min(wordCursor + childTargetWords, words.length);
      let actualEnd = targetEnd;

      // Sentence boundary snapping: search for nearest sentence ending punctuation in ±40 words window
      if (targetEnd < words.length) {
        let foundSentenceEnd = false;
        const searchMin = Math.max(wordCursor + Math.floor(childTargetWords * 0.7), targetEnd - 40);
        const searchMax = Math.min(words.length - 1, targetEnd + 40);

        for (let i = searchMin; i <= searchMax; i++) {
          if (/[.!?]["'”’)]?$/.test(words[i])) {
            actualEnd = i + 1;
            foundSentenceEnd = true;
            break;
          }
        }
        if (!foundSentenceEnd) {
          actualEnd = targetEnd;
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
      // Advance cursor with overlap if not reached end
      if (actualEnd >= words.length) {
        break;
      }
      wordCursor = Math.max(wordCursor + 1, actualEnd - childOverlapWords);
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
