import { describe, it, expect } from 'vitest';
import {
  HISTORICAL_FALLBACK_CATALOG,
  normalizeLicenseString,
  resolveVisualCandidates,
} from '../wikimedia-search.js';

describe('Wikimedia Search & Candidate Resolver Unit Tests', () => {
  it('normalizes various license string formats accurately', () => {
    expect(normalizeLicenseString('CC BY-SA 4.0')).toBe('CC_BY_SA_4_0');
    expect(normalizeLicenseString('CC BY 4.0')).toBe('CC_BY_4_0');
    expect(normalizeLicenseString('CC0')).toBe('CC0');
    expect(normalizeLicenseString('Public Domain')).toBe('PUBLIC_DOMAIN');
    expect(normalizeLicenseString(undefined)).toBe('PUBLIC_DOMAIN');
  });

  it('contains verified historical fallback catalog with real Wikimedia assets', () => {
    expect(HISTORICAL_FALLBACK_CATALOG.length).toBeGreaterThanOrEqual(10);
    for (const item of HISTORICAL_FALLBACK_CATALOG) {
      expect(item.imageUrl).toMatch(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//);
      expect(item.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(item.title.length).toBeGreaterThan(5);
      expect(item.license).toBeDefined();
    }
  });

  it('resolves visual candidates gracefully with matching topic keywords', async () => {
    const candidates = await resolveVisualCandidates('quang trung nguyen hue đống đa', 'scene_001', 3);
    expect(candidates).toHaveLength(3);
    expect(candidates[0].candidateId).toBe('cand_scene_001_01');
    expect(candidates[0].imageUrl).toContain('wikimedia.org');
    expect(candidates[0].license).toBeDefined();
  });
});
