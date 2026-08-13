import {
  chunkDocumentHierarchical,
  extractTimeBounds,
  detectDynasty,
  enrichChunkMetadata,
  EnrichedMetadata,
  ProcessedHierarchicalChunk,
} from './chunking/index.js';

export { extractTimeBounds, detectDynasty, enrichChunkMetadata };
export type ChunkMetadata = EnrichedMetadata;
export type ProcessedChunk = ProcessedHierarchicalChunk;

/**
 * Backward-compatible chunkDocument wrapper that delegates to chunkDocumentHierarchical
 */
export function chunkDocument(
  text: string,
  docMetadata: {
    title: string;
    dynasty?: string;
    sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
    pageNumber?: number;
    keyFigures?: string[];
    location?: string;
  }
): { parentChunks: ProcessedChunk[]; childChunks: ProcessedChunk[] } {
  const result = chunkDocumentHierarchical(text, docMetadata);
  return {
    parentChunks: result.parentChunks,
    childChunks: result.childChunks,
  };
}

