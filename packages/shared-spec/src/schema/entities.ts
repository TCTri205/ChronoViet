/**
 * Base Historical Entity Taxonomy & System Schemas
 */
import { z } from 'zod';



export const EntityTypeEnum = z.enum([
  'HISTORICAL_PERSON',
  'LOCATION',
  'EVENT_BATTLE',
  'DYNASTY_ERA',
  'ORGANIZATION',
  'ARTIFACT',
  'DOCUMENT_CULTURE',
  'UNKNOWN',
]);

export const AliasTypeEnum = z.enum([
  'ROYAL_TITLE',
  'OFFICIAL_TITLE',
  'PHONETIC_VARIANT',
  'FOLK_BIRTH_NAME',
  'OTHER',
]);

export const StructuredAliasSchema = z.object({
  name: z.string(),
  type: AliasTypeEnum.default('OTHER'),
  confidence: z.number().min(0).max(1).default(1.0),
  notes: z.string().optional(),
});

export const AuditActionTypeEnum = z.enum([
  'MERGE_ENTITY',
  'ALIAS_UPDATE',
  'MODERN_OVERRIDE',
  'CONFLICT_RESOLVE',
]);

export const EntityAuditLogSchema = z.object({
  logId: z.number().int().optional(),
  entityId: z.string(),
  actionType: AuditActionTypeEnum,
  modifiedBy: z.string().default('SYSTEM'),
  timestamp: z.string().optional(),
  previousState: z.record(z.string(), z.unknown()).default({}),
  newState: z.record(z.string(), z.unknown()).default({}),
  rationale: z.string().optional(),
});

export function getCanonicalEntityIdPrefix(entityType: z.infer<typeof EntityTypeEnum> | string): string {
  switch (entityType) {
    case 'HISTORICAL_PERSON': return 'person_';
    case 'LOCATION': return 'loc_';
    case 'EVENT_BATTLE': return 'event_';
    case 'DYNASTY_ERA': return 'dynasty_';
    case 'ORGANIZATION': return 'org_';
    case 'ARTIFACT': return 'artifact_';
    case 'DOCUMENT_CULTURE': return 'doc_';
    case 'UNKNOWN': return 'unknown_';
    default: return 'entity_';
  }
}


export const HistoricalRelationTypeEnum = z.enum([
  'LED_BY',
  'PART_OF',
  'HAPPENED_IN',
  'HAPPENED_AT',
  'SAME_AS_LOCATION',
  'ALIAS_OF',
  'ROYAL_LINEAGE',
  'MENTIONED_IN',
]);

export const CandidateEntitySpanSchema = z.object({
  text: z.string(),
  cleanName: z.string().optional(),
  type: z.union([EntityTypeEnum, z.string()]),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).default(1.0),
  sourceLayer: z.enum(['GAZETTEER', 'RULE_PREFIX', 'PROPER_NOUN_REGEX', 'HYBRID']).default('GAZETTEER'),
  suggestedCanonicalId: z.string().optional(),
  priority: z.number().optional(),
  isEnclosedModifier: z.boolean().optional(),
  enclosingSpanText: z.string().optional(),
});

export type EntityType = z.infer<typeof EntityTypeEnum>;
export type AliasType = z.infer<typeof AliasTypeEnum>;
export type StructuredAlias = z.infer<typeof StructuredAliasSchema>;
export type AuditActionType = z.infer<typeof AuditActionTypeEnum>;
export type EntityAuditLog = z.infer<typeof EntityAuditLogSchema>;
export type HistoricalRelationType = z.infer<typeof HistoricalRelationTypeEnum>;
export type CandidateEntitySpan = z.infer<typeof CandidateEntitySpanSchema>;
