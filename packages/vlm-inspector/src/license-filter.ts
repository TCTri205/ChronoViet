import { LicenseTypeSchema } from '@chronoviet/shared-spec';
import { z } from 'zod';

export type LicenseType = z.infer<typeof LicenseTypeSchema>;

export function isWhitelistedLicense(licenseString: string): boolean {
  if (!licenseString) return false;
  const normalized = licenseString.toUpperCase().replace(/[\s-]+/g, '_');

  // Explicitly reject non-commercial, no-derivative, or unknown/copyright restricted
  if (
    normalized.includes('NC') ||
    normalized.includes('NON_COMMERCIAL') ||
    normalized.includes('ND') ||
    normalized.includes('NO_DERIVS') ||
    normalized.includes('ALL_RIGHTS_RESERVED') ||
    normalized.includes('COPYRIGHT_STRICT') ||
    normalized === 'UNKNOWN'
  ) {
    return false;
  }

  return (
    normalized.includes('PUBLIC_DOMAIN') ||
    normalized.includes('CC0') ||
    normalized.includes('ZERO') ||
    normalized.includes('PD') ||
    normalized.includes('CC_BY_SA') ||
    normalized.includes('CC_BY')
  );
}
