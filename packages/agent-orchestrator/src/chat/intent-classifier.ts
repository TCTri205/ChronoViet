/**
 * Multi-Tier Intent Classifier & Fast-Path Router (<1ms execution)
 * Facade module re-exporting patterns, signals, and composite classifier.
 */

export type {
  ChatIntent,
  ChatSubIntent,
} from '@chronoviet/shared-spec';

export type {
  IntentClassificationSignals,
  IntentClassificationResult,
  ExtractedHistoricalEntity,
} from './intent/composite-classifier.js';

export {
  OUT_OF_DOMAIN_PATTERNS,
  PURE_CHITCHAT_PATTERNS,
  BOT_IDENTITY_PATTERNS,
  SHADOW_CHITCHAT_PATTERNS,
  PLEASANTRY_PREFIX_REGEX,
  SECONDARY_GREETING_PREFIX_REGEX,
  SECONDARY_BOT_IDENTITY_PREFIX_REGEX,
  SECONDARY_VIDEO_SUFFIX_REGEX,
  SECONDARY_OOD_SUFFIX_REGEX,
  PRIMARY_VIDEO_START_REGEX,
  VIDEO_INTENT_PATTERNS,
  KINSHIP_AND_RELATION_REGEX,
  SUBSTANTIVE_QUESTION_REGEX,
  DIRECT_CONVERSATIONAL_ADDRESS_REGEX,
  CASUAL_REMARK_REGEX,
  CONJUNCTION_ENTITY_PATTERNS,
  SINGLE_ENTITY_IDENTITY_PATTERNS,
  CONVERSATIONAL_STOPWORDS,
} from './intent/patterns.js';

export {
  splitQueryIntoSemanticClauses,
  cleanHistoricalClause,
  extractHistoricalEntityFromQuery,
  hasHistoricalDomainSignals,
  classifyChatIntent,
  detectHistoricalSubIntent,
} from './intent/composite-classifier.js';
