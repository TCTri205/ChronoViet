import { describe, it, expect } from 'vitest';
import { chunkDocumentHierarchical } from '../chunking/hierarchical-chunker.js';
import { CHUNK_CHILD_MIN_WORDS, CHUNK_CHILD_MAX_WORDS } from '@chronoviet/shared-spec';

/** Generate N Vietnamese words joined by spaces. */
function makeText(n: number): string {
  const words: string[] = [];
  for (let i = 0; i < n; i++) {
    words.push(`từ${i}`);
  }
  return words.join(' ');
}

describe('chunkDocumentHierarchical child chunk bounds (300-500 words)', () => {
  it('splits a 2000-word parent into valid child chunks within [300, 500]', () => {
    const text = makeText(2000);
    const result = chunkDocumentHierarchical(text, { title: 'Tài liệu test' });
    expect(result.parentChunks.length).toBe(1);
    expect(result.childChunks.length).toBeGreaterThanOrEqual(4);
    for (const chunk of result.childChunks) {
      expect(chunk.wordCount).toBeGreaterThanOrEqual(CHUNK_CHILD_MIN_WORDS);
      expect(chunk.wordCount).toBeLessThanOrEqual(CHUNK_CHILD_MAX_WORDS);
    }
  });

  it('keeps the final tail chunk valid (no short tail below 300 words)', () => {
    // 2000 words with no sentence punctuation exercises the tail-absorption path.
    const text = makeText(2000);
    const result = chunkDocumentHierarchical(text, { title: 'Tài liệu test' });
    const last = result.childChunks[result.childChunks.length - 1];
    expect(last.wordCount).toBeGreaterThanOrEqual(CHUNK_CHILD_MIN_WORDS);
    expect(last.wordCount).toBeLessThanOrEqual(CHUNK_CHILD_MAX_WORDS);
  });

  it('does not produce chunks above 500 words when snapping pulls past the target', () => {
    // Sentences with end punctuation every ~50 words; snapping should still respect MAX.
    const sentences: string[] = [];
    for (let i = 0; i < 45; i++) {
      sentences.push(makeText(50) + '.');
    }
    const text = sentences.join(' ');
    const result = chunkDocumentHierarchical(text, { title: 'Tài liệu test' });
    for (const chunk of result.childChunks) {
      expect(chunk.wordCount).toBeGreaterThanOrEqual(CHUNK_CHILD_MIN_WORDS);
      expect(chunk.wordCount).toBeLessThanOrEqual(CHUNK_CHILD_MAX_WORDS);
    }
  });

  it('preserves parent-chunk link metadata on child chunks', () => {
    const text = makeText(2000);
    const result = chunkDocumentHierarchical(text, { title: 'Tài liệu test' });
    const parentId = result.parentChunks[0].id;
    for (const chunk of result.childChunks) {
      expect(chunk.metadata.parentChunkId).toBe(parentId);
    }
  });

  it('safely partitions an oversized document (10,000 words) without double newlines into multiple parent chunks', () => {
    const sentences: string[] = [];
    for (let i = 0; i < 200; i++) {
      sentences.push(makeText(50) + '.');
    }
    const text = sentences.join(' ');
    const result = chunkDocumentHierarchical(text, { title: 'Tài liệu dài không ngắt đoạn' });
    expect(result.parentChunks.length).toBeGreaterThan(1);
    for (const chunk of result.parentChunks) {
      expect(chunk.wordCount).toBeGreaterThanOrEqual(1000);
      expect(chunk.wordCount).toBeLessThanOrEqual(3500);
    }
  });
});
