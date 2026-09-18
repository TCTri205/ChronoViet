import { describe, it, expect } from 'vitest';
import {
  resolveEntityAlias,
  resolveCanonicalEntity,
  isKnownMasterEntity,
  validateAdministrativeContainment,
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

describe('Administrative Containment & Geographic Hierarchy (Task 2)', () => {
  it('should validate canonical village/district/province containment correctly', () => {
    const r1 = validateAdministrativeContainment('Kim Liên', 'Nam Đàn');
    expect(r1.valid).toBe(true);
    expect(r1.actualProvince).toBe('Nghệ An');

    const r2 = validateAdministrativeContainment('Kim Liên', 'Nghệ An');
    expect(r2.valid).toBe(true);

    const r3 = validateAdministrativeContainment('Hoa Lư', 'Ninh Bình');
    expect(r3.valid).toBe(true);

    const r4 = validateAdministrativeContainment('Lam Sơn', 'Thanh Hóa');
    expect(r4.valid).toBe(true);

    const r5 = validateAdministrativeContainment('Cổ Loa', 'Hà Nội');
    expect(r5.valid).toBe(true);
  });

  it('should flag geographical hallucinations and contradictory co-occurrences', () => {
    const r1 = validateAdministrativeContainment('Hoa Lư', 'Nghệ An');
    expect(r1.valid).toBe(false);
    expect(r1.suggestedCorrection).toBe('Ninh Bình');
    expect(r1.reason).toContain('Ninh Bình');

    const r2 = validateAdministrativeContainment('Kim Liên', 'Hà Nội');
    expect(r2.valid).toBe(false);
    expect(r2.suggestedCorrection).toBe('Nghệ An');

    const r3 = validateAdministrativeContainment('Cổ Loa', 'Huế');
    expect(r3.valid).toBe(false);
    expect(r3.suggestedCorrection).toBe('Hà Nội');
  });

  it('should validate text fragments for administrative consistency', () => {
    const validText = 'Chủ tịch Hồ Chí Minh sinh ra tại làng Kim Liên, huyện Nam Đàn, tỉnh Nghệ An.';
    const validRes = validateAdministrativeContainment(validText);
    expect(validRes.valid).toBe(true);

    const invalidText = 'Cố đô Hoa Lư tọa lạc tại tỉnh Nghệ An, nơi ghi dấu nhiều chiến công lẫy lừng.';
    const invalidRes = validateAdministrativeContainment(invalidText);
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.childName).toBe('Hoa Lư');
    expect(invalidRes.suggestedCorrection).toBe('Ninh Bình');
  });
});
