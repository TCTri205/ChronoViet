import { describe, it, expect } from 'vitest';
import { VisualAssetIngestor } from '../media/visual-asset-ingestor.js';

describe('VisualAssetIngestor.auditLicense whitelist behavior', () => {
  const ingestor = new VisualAssetIngestor();

  it('allows PUBLIC_DOMAIN, CC0, CC_BY_4_0, CC_BY_SA_4_0, PUBLIC_DOMAIN_MARK', () => {
    for (const license of ['PUBLIC_DOMAIN', 'CC0', 'CC_BY_4_0', 'CC_BY_SA_4_0', 'PUBLIC_DOMAIN_MARK']) {
      expect(ingestor.auditLicense(license).isWhitelisted, license).toBe(true);
    }
  });

  it('normalizes human-readable license variants', () => {
    expect(ingestor.auditLicense('Creative Commons CC0 1.0 Universal').isWhitelisted).toBe(true);
    expect(ingestor.auditLicense('CC BY-SA 4.0 International').isWhitelisted).toBe(true);
  });

  it('rejects non-commercial and no-derivatives licenses', () => {
    for (const license of ['CC_BY_NC_4_0', 'CC_BY_ND_4_0', 'CC_BY_NC_SA_4_0', 'CC_BY_NC_ND_4_0']) {
      expect(ingestor.auditLicense(license).isWhitelisted, license).toBe(false);
    }
  });

  it('rejects ALL_RIGHTS_RESERVED, COMMERCIAL_ONLY, PROPRIETARY, UNKNOWN, empty string', () => {
    for (const license of ['ALL_RIGHTS_RESERVED', 'COMMERCIAL_ONLY', 'PROPRIETARY', 'UNKNOWN', '']) {
      expect(ingestor.auditLicense(license).isWhitelisted, license).toBe(false);
    }
  });

  it('rejects CC_BY_3_0 (older version not in the whitelist)', () => {
    // CC BY 3.0 is NOT equivalent to CC BY 4.0; only 4.0 is whitelisted.
    expect(ingestor.auditLicense('CC_BY_3_0').isWhitelisted).toBe(false);
  });
});
