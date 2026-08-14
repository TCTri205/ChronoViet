/**
 * Hierarchical Chunking Bounds (SSOT)
 * Single source of truth for chunk size limits used by both the
 * data-ingestion chunker and the evaluation metrics.
 *
 * Spec: Parent Chunk 2000-3000 words, Child Chunk 300-500 words
 * (docs/RAG_plan.md, docs/IMPLEMENTATION_PLAN.md, docs/modules/00_*.md)
 */

export const CHUNK_PARENT_MIN_WORDS = 2000;
export const CHUNK_PARENT_MAX_WORDS = 3000;
export const CHUNK_CHILD_MIN_WORDS = 300;
export const CHUNK_CHILD_MAX_WORDS = 500;
export const CHUNK_CHILD_TARGET_WORDS = 400;
export const CHUNK_CHILD_OVERLAP_WORDS = 40;
