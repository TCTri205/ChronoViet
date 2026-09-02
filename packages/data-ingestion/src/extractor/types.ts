import { HistoricalRelationType, CandidateEntitySpan } from '@chronoviet/shared-spec';
import { isValidCandidateSpan } from '../text/vietnamese-ner.js';

export function isValidEntityName(name: string): boolean {
  return isValidCandidateSpan(name);
}

export interface ExtractedTriple {
  sourceEntityId: string;
  sourceEntityName: string;
  relationType: HistoricalRelationType;
  targetEntityId: string;
  targetEntityName: string;
  confidence: number;
}

export interface DetailedExtractionResult {
  triples: ExtractedTriple[];
  candidateSpans?: CandidateEntitySpan[];
  provider?: string;
  targetProvider?: string;
  targetId?: string;
  model?: string;
  strategy: 'ensemble_ai' | 'regex_only' | 'rule_based_fallback';
  durationMs: number;
  llmError?: string;
  cached?: boolean;
}

export interface ExtractionOptions {
  strict?: boolean;
  allowFallback?: boolean;
  timeoutMs?: number;
  regexOnly?: boolean;
  stage?: 'vector' | 'graph' | 'all';
  correlationId?: string;
  headingAnchorYear?: number;
  chunkId?: string;
  skipCache?: boolean;
  skipMvRefresh?: boolean;
}

export const VALID_RELATIONS = new Set<HistoricalRelationType>([
  'PART_OF',
  'LED_BY',
  'HAPPENED_IN',
  'HAPPENED_AT',
  'SAME_AS_LOCATION',
  'ALIAS_OF',
  'ROYAL_LINEAGE',
  'MENTIONED_IN',
]);

/**
 * Patterns matching all 2,360+ chronicler commentary styles in historical corpora
 */
export const HISTORIAN_COMMENTARY_PATTERNS = [
  /\*\*Lời cẩn án\s*[-–—:]/i,
  /\*\*Lời chua\s*[-–—:]/i,
  /\*\*Lời phê\s*[-–—:]/i,
  /\*\*Lời bàn\s*[-–—:]/i,
  /Sử thần Ngô Sĩ Liên nói:/i,
  /Lê Văn Hưu nói:/i,
  /Phan Phu Tiên nói:/i,
  /Sử thần Hà Sĩ Dương nói:/i,
  /Sử thần Vũ Quỳnh nói:/i,
  /Sử thần bàn rằng:/i,
  /Lời thông luận:/i,
  /Xét sử cũ:/i,
  /Lời Phụ Chú:/i,
];

export function isHistorianCommentaryText(text: string): boolean {
  return HISTORIAN_COMMENTARY_PATTERNS.some((p) => p.test(text));
}
