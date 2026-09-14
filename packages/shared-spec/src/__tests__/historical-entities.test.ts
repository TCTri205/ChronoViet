import { describe, it, expect } from 'vitest';
import {
  resolveEntityAlias,
  resolveCanonicalEntity,
  isKnownMasterEntity,
} from '../historical-entities.js';

describe('Historical Entities & Landmark Aliases (Task 2)', () => {
  it('should reliably resolve Lũy Thầy and related fortification aliases to loc_luy_thay', () => {
    const aliasesToTest = [
      'lũy Thầy',
      'Lũy Thầy',
      'luy thay',
      'Luy Thay',
      'Lũy Đào Duy Từ',
      'lũy Đào Duy Từ',
      'chiến lũy Thầy',
      'Chiến lũy Thầy',
      'Lũy Nhật Lệ',
      'Lũy Trường Dục',
    ];

    for (const alias of aliasesToTest) {
      const mapping = resolveEntityAlias(alias);
      expect(mapping).toBeDefined();
      expect(mapping.canonicalId).toBe('loc_luy_thay');
    }
  });

  it('should resolve canonical entity info for loc_luy_thay', () => {
    const canonical = resolveCanonicalEntity('Lũy Thầy');
    expect(canonical.entityId).toBe('loc_luy_thay');
    expect(canonical.canonicalName).toBe('Lũy Thầy');
    expect(canonical.type).toBe('LOCATION');
    expect(isKnownMasterEntity('loc_luy_thay')).toBe(true);
    expect(isKnownMasterEntity('Lũy Thầy')).toBe(true);
  });

  it('should not resolve ambiguous standalone word "thầy" to loc_luy_thay', () => {
    const mapping = resolveEntityAlias('thầy');
    expect(mapping.canonicalId).not.toBe('loc_luy_thay');
  });
});
