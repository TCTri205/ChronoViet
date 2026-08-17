/**
 * Historical Entity Mapper: Location Temporal Mapping (SAME_AS_LOCATION) & Character Alias Resolution (ALIAS_OF)
 * Re-exported from @chronoviet/shared-spec (SSOT)
 */

export {
  HistoricalEntityInfo,
  HISTORICAL_PERSON_DICTIONARY,
  HISTORICAL_LOCATION_MAPPINGS,
  HISTORICAL_LOCATION_DICTIONARY,
  resolveLocationMapping,
  resolveEntityAlias,
  resolveHistoricalEpochs,
  resolveCanonicalEntity,
  isKnownMasterEntity,
  formatSameAsLocationRelations,
  formatAliasOfRelations,
  buildAliasTable,
} from '@chronoviet/shared-spec';
