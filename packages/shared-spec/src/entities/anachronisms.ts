/**
 * Declarative Epoch Terminology & Anachronism Mappings (SSOT)
 */

export interface TerminologyReplacement {
  anachronisticTerm: string;
  canonicalTerm: string;
  pattern: RegExp;
  reason?: string;
}

export const EPOCH_TERMINOLOGY_REPLACEMENTS: Record<string, TerminologyReplacement[]> = {
  EPOCH_TAY_SON: [
    {
      anachronisticTerm: 'quân Hà Nội',
      canonicalTerm: 'nghĩa quân Tây Sơn',
      pattern: /\bquân\s+Hà\s+Nội\b/gi,
      reason: 'Địa danh "Hà Nội" chỉ được vua Minh Mạng đặt ra năm 1831; thời Tây Sơn là Thăng Long / Bắc Thành.',
    },
    {
      anachronisticTerm: 'chính quyền Hà Nội',
      canonicalTerm: 'triều đình Tây Sơn',
      pattern: /\bchính\s+quyền\s+Hà\s+Nội\b/gi,
      reason: 'Thuật ngữ phi lịch sử khi nói về triều đại Tây Sơn.',
    },
    {
      anachronisticTerm: 'thành phố Hà Nội',
      canonicalTerm: 'kinh thành Thăng Long',
      pattern: /\bthành\s+phố\s+Hà\s+Nội\b/gi,
      reason: 'Địa danh Thăng Long / Bắc Thành thời Tây Sơn.',
    },
  ],
  EPOCH_DAI_VIET: [
    {
      anachronisticTerm: 'Việt Nam',
      canonicalTerm: 'Đại Việt',
      pattern: /\bnước\s+Việt\s+Nam\b/gi,
      reason: 'Quốc hiệu Đại Việt thời Lý, Trần, Lê.',
    },
  ],
};
