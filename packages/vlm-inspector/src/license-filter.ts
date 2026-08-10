import { LicenseTypeSchema } from '@chronoviet/shared-spec';
import { z } from 'zod';

export type LicenseType = z.infer<typeof LicenseTypeSchema>;

export function isWhitelistedLicense(licenseString: string): boolean {
  const normalized = licenseString.toUpperCase().replace(/[-_]/g, '_');
  return (
    normalized.includes('PUBLIC_DOMAIN') ||
    normalized.includes('CC0') ||
    normalized.includes('CC_BY_4_0') ||
    normalized.includes('CC_BY_SA_4_0')
  );
}
