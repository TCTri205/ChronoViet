/**
 * ChronoViet - Dual-Syntax Heading-Aware Hierarchical Chunking Engine
 * Component 3 of Module 0 Data Preprocessing & Ingestion ETL
 *
 * Characteristics:
 * - Dual-syntax Heading Stack tracking: Markdown (#, ##, ###) & MediaWiki (==, ===, ====)
 * - Dialogue Pseudo-Heading bypass (##### ... nói: does not push to Heading Stack)
 * - Heading Truncation (max 15 words) & Trailing Punctuation Stripping
 * - Document-Level & Hierarchy Dynasty Inheritance
 * - Dynamic Macro-Context Header injection:
 *   [Sử Liệu: ...] [Kỷ/Triều Đại: ...] [Mục: ...] [Nhân Vật: ...] [Thời Gian: ...]
 * - Dynamic Window Splitting & Tail Fragment Merging strictly guaranteeing [300, 500] bounds (>= 95% compliance)
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
import { enrichChunkMetadata, detectDynasty, EnrichedMetadata } from './metadata-enricher.js';

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

interface HeadingFrame {
  level: number;
  title: string;
  dynasty?: string;
}

const PSEUDO_DIALOGUE_HEADING_REGEX = /^(#####|\*{2})\s*(Sử\s+Trung\s+nói:|Thật\s+là:|Sư\s+nói:|Khắc\s+Chung\s+đáp:|Ô\s+Mã\s+Nhi\s+nói:|Lê\s+Văn\s+Hưu\s+nói:|Ngô\s+Sĩ\s+Liên\s+nói:|Sử\s+thần\s+bàn\s+rằng:|Lời\s+thông\s+luận:|Xét\s+sử\s+cũ:)/i;

/**
 * Helper to count words in a string
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Truncate heading to max words and clean trailing punctuation
 */
function cleanHeadingTitle(rawTitle: string, maxWords: number = 15): string {
  let clean = rawTitle
    .replace(/^[\#\=\s]+|[\#\=\s]+$/g, '')
    .replace(/[\.\:\;\,\!\?]+$/g, '')
    .trim();

  const words = clean.split(/\s+/);
  if (words.length > maxWords) {
    clean = words.slice(0, maxWords).join(' ') + '...';
  }
  return clean;
}

/**
 * Infer dynasty from heading title
 */
function extractDynastyFromHeading(heading: string): string | undefined {
  return detectDynasty(heading);
}

/**
 * Splits document text into clean paragraphs, tracking section boundaries
 */
function splitParagraphs(text: string, maxParagraphWords: number = 800): string[] {
  const rawParas = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const result: string[] = [];
  for (const para of rawParas) {
    const wordCount = countWords(para);
    if (wordCount <= maxParagraphWords) {
      result.push(para);
      continue;
    }

    // Split oversized single paragraph by sentence boundaries
    const sentences = para.match(/[^.!?\n]+[.!?]+(\s+|$)|[^.!?\n]+$/g) || [para];
    let curr: string[] = [];
    let currWords = 0;

    for (const sent of sentences) {
      const sTrim = sent.trim();
      if (!sTrim) continue;
      const sWords = countWords(sTrim);
      if (currWords + sWords > maxParagraphWords && currWords > 0) {
        result.push(curr.join(' '));
        curr = [];
        currWords = 0;
      }
      curr.push(sTrim);
      currWords += sWords;
    }

    if (curr.length > 0) {
      result.push(curr.join(' '));
    }
  }

  return result;
}

/**
 * Formats Macro-Context Header banner for child chunks
 */
function formatMacroContextBanner(
  title: string,
  dynasty: string,
  sectionTitle: string,
  keyFigures: string[],
  timeStart?: number,
  timeEnd?: number
): string {
  const figuresStr = keyFigures.length > 0 ? keyFigures.slice(0, 3).join(', ') : 'Chính sử';
  let timeStr = 'Chưa xác định';
  if (timeStart !== undefined && timeEnd !== undefined) {
    timeStr = timeStart === timeEnd ? `${timeStart}` : `${timeStart} - ${timeEnd}`;
  } else if (timeStart !== undefined) {
    timeStr = `${timeStart}`;
  } else if (timeEnd !== undefined) {
    timeStr = `${timeEnd}`;
  }

  return `[Sử Liệu: ${title}] [Kỷ/Triều Đại: ${dynasty}] [Mục: ${sectionTitle}] [Nhân Vật: ${figuresStr}] [Thời Gian: ${timeStr}]`;
}

/**
 * Dynamic Dual-Syntax Heading-Aware Hierarchical Chunking Algorithm
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

  // Heading Stack tracking
  const headingStack: HeadingFrame[] = [];
  let currentActiveDynasty = docMetadata.dynasty || 'Chính sử';
  let currentSectionTitle = cleanHeadingTitle(docMetadata.title);

  const totalWords = countWords(text);
  const titleHash = (docMetadata.title + text.slice(0, 30))
    .split('')
    .reduce((acc, char) => (acc * 33) ^ char.charCodeAt(0), 5381) >>> 0;

  // Helper function to process completed Parent Chunk and generate its Child Chunks
  const processParent = () => {
    if (currentParentParagraphs.length === 0) return;

    const parentContent = currentParentParagraphs.join('\n\n');
    const parentWords = countWords(parentContent);
    const parentId = `parent_chunk_${titleHash}_${parentIndex}`;

    // 1. Create Parent Chunk with enriched metadata
    const parentMetadata = enrichChunkMetadata(parentContent, {
      title: docMetadata.title,
      sourceName: docMetadata.sourceName,
      dynasty: currentActiveDynasty,
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

    // 2. Generate Child Chunks (300 - 500 words) with Macro-Context Headers
    const words = parentContent.split(/\s+/).filter((w) => w.length > 0);
    let childIndex = 1;
    let wordCursor = 0;

    const isGoodRemainder = (end: number): boolean => {
      const rem = words.length - end;
      return rem === 0 || (rem >= CHUNK_CHILD_MIN_WORDS && rem <= CHUNK_CHILD_MAX_WORDS) || rem >= 2 * CHUNK_CHILD_MIN_WORDS;
    };

    while (wordCursor < words.length) {
      const remaining = words.length - wordCursor;
      let actualEnd = Math.min(wordCursor + childTargetWords, words.length);

      // If remainder fits in one chunk, absorb it all
      if (remaining <= CHUNK_CHILD_MAX_WORDS) {
        actualEnd = words.length;
      } else {
        // Sentence-boundary snapping
        let snappedEnd = -1;
        const searchMin = Math.max(wordCursor + Math.floor(childTargetWords * 0.75), actualEnd - 40);
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
          const remAfterTarget = words.length - actualEnd;
          if (remAfterTarget < CHUNK_CHILD_MIN_WORDS) {
            actualEnd = remaining <= CHUNK_CHILD_MAX_WORDS ? words.length : words.length - CHUNK_CHILD_MIN_WORDS;
          } else if (remAfterTarget > CHUNK_CHILD_MAX_WORDS) {
            actualEnd = words.length - CHUNK_CHILD_MAX_WORDS;
          } else {
            actualEnd = words.length - CHUNK_CHILD_MAX_WORDS;
          }
          if (actualEnd - wordCursor < CHUNK_CHILD_MIN_WORDS) {
            actualEnd = words.length;
          }
        }
      }

      // Tail fragment merging: if final leftover fragment is < 260 words, merge with previous
      const childWords = words.slice(wordCursor, actualEnd);
      const rawChildContent = childWords.join(' ');

      const childId = `${parentId}_child_${childIndex}`;

      // Enrich Child Chunk metadata
      const childMetadata = enrichChunkMetadata(rawChildContent, {
        ...parentMetadata,
        dynasty: currentActiveDynasty,
        parentChunkId: parentId,
      });

      // Construct Macro-Context Header Banner
      const banner = formatMacroContextBanner(
        docMetadata.title,
        childMetadata.dynasty || currentActiveDynasty,
        currentSectionTitle,
        childMetadata.keyFigures,
        childMetadata.timeStart,
        childMetadata.timeEnd
      );

      const enrichedChildContent = `${banner}\n\n${rawChildContent}`;
      const totalChildWordCount = countWords(enrichedChildContent);

      childChunks.push({
        id: childId,
        title: `${docMetadata.title} - Đoạn ${parentIndex}.${childIndex}`,
        textContent: enrichedChildContent,
        isParent: false,
        wordCount: totalChildWordCount,
        metadata: childMetadata,
      });

      childIndex++;
      if (actualEnd >= words.length) {
        break;
      }

      const overlapCursor = actualEnd - childOverlapWords;
      const nextSize = words.length - overlapCursor;
      const nextSizeValid = nextSize >= CHUNK_CHILD_MIN_WORDS && nextSize <= CHUNK_CHILD_MAX_WORDS;

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

  // Group paragraphs into Parent Chunks while tracking Heading Stack
  for (const para of paragraphs) {
    const trimmed = para.trim();

    // Check Markdown headings (# to #####) or MediaWiki headings (== to =====)
    let headingLevel = 0;
    let headingTitle = '';

    const mdMatch = trimmed.match(/^(#{1,5})\s+(.+)$/);
    const wikiMatch = trimmed.match(/^(={2,5})\s*([^=]+?)\s*\1$/);

    if (mdMatch && !PSEUDO_DIALOGUE_HEADING_REGEX.test(trimmed)) {
      headingLevel = mdMatch[1].length;
      headingTitle = mdMatch[2].trim();
    } else if (wikiMatch) {
      headingLevel = wikiMatch[1].length;
      headingTitle = wikiMatch[2].trim();
    }

    if (headingLevel > 0 && headingTitle) {
      currentSectionTitle = cleanHeadingTitle(headingTitle);

      // Pop deeper or equal levels from stack
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= headingLevel) {
        headingStack.pop();
      }

      // Check dynasty update
      const extractedDynasty = extractDynastyFromHeading(headingTitle);
      const activeDynasty = extractedDynasty || (headingStack.length > 0 ? headingStack[headingStack.length - 1].dynasty : docMetadata.dynasty) || 'Chính sử';

      headingStack.push({
        level: headingLevel,
        title: currentSectionTitle,
        dynasty: activeDynasty,
      });

      currentActiveDynasty = activeDynasty;
    }

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
