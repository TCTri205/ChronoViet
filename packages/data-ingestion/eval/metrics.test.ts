import { describe, it, expect } from 'vitest';
import { evaluateChunkQuality } from './metrics.js';
import { CHUNK_PARENT_MIN_WORDS, CHUNK_CHILD_MIN_WORDS } from '@chronoviet/shared-spec';

function makeText(n: number): string {
  const words: string[] = [];
  for (let i = 0; i < n; i++) words.push(`từ${i}`);
  return words.join(' ');
}

const baseMetadata = {
  title: 'Tài liệu',
  sourceName: 'Nguồn',
  sourceReliability: 'LEVEL_1',
};

describe('evaluateChunkQuality bounds (Parent 2000-3000, Child 300-500)', () => {
  it('marks a valid parent chunk (2000 words, full metadata) as valid', () => {
    const res = evaluateChunkQuality({
      id: 'p1',
      textContent: makeText(CHUNK_PARENT_MIN_WORDS),
      ...baseMetadata,
    });
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('marks a short parent chunk (1000 words) as invalid', () => {
    const res = evaluateChunkQuality({
      id: 'p2',
      textContent: makeText(1000),
      ...baseMetadata,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.join(' ')).toContain('outside bounds');
  });

  it('marks a valid child chunk (300-500 words) as valid', () => {
    const res = evaluateChunkQuality({
      id: 'c1',
      parentChunkId: 'p1',
      textContent: makeText(CHUNK_CHILD_MIN_WORDS),
      ...baseMetadata,
    });
    expect(res.isValid).toBe(true);
  });

  it('marks an oversized child chunk (600 words) as invalid', () => {
    const res = evaluateChunkQuality({
      id: 'c2',
      parentChunkId: 'p1',
      textContent: makeText(600),
      ...baseMetadata,
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.join(' ')).toContain('outside bounds');
  });

  it('marks a chunk missing required metadata as invalid', () => {
    const res = evaluateChunkQuality({
      id: 'c3',
      textContent: makeText(CHUNK_PARENT_MIN_WORDS),
      title: 'Tài liệu',
      // missing sourceName + sourceReliability
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.join(' ')).toContain('Missing required chunk metadata');
  });
});
