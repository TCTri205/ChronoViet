/**
 * Historical Entity Mapper: Location Temporal Mapping (SAME_AS_LOCATION) & Character Alias Resolution (ALIAS_OF)
 */

import { EntityAliasMapping, HistoricalLocationMapping } from '@chronoviet/shared-spec';

export interface HistoricalEntityInfo {
  entityId: string;
  canonicalName: string;
  type: 'Person' | 'Event' | 'Location' | 'Dynasty' | 'TimePeriod' | 'Artifact';
  aliases: string[];
}

/**
 * Built-in Historical Character Dictionary with Canonical Entity IDs and Aliases
 */
export const HISTORICAL_PERSON_DICTIONARY: Record<string, HistoricalEntityInfo> = {
  'person:quang_trung': {
    entityId: 'person:quang_trung',
    canonicalName: 'Quang Trung',
    type: 'Person',
    aliases: ['Nguyễn Huệ', 'Hồ Thơm', 'Bắc Bình Vương', 'Vua Quang Trung', 'Quang Trung Hoàng Đế', 'Tây Sơn Vương'],
  },
  'person:tran_hung_dao': {
    entityId: 'person:tran_hung_dao',
    canonicalName: 'Trần Hưng Đạo',
    type: 'Person',
    aliases: ['Trần Quốc Tuấn', 'Hưng Đạo Đại Vương', 'Hưng Đạo Vương', 'Đức Thánh Trần'],
  },
  'person:le_loi': {
    entityId: 'person:le_loi',
    canonicalName: 'Lê Lợi',
    type: 'Person',
    aliases: ['Lê Thái Tổ', 'Bình Định Vương', 'Vua Lê Lợi'],
  },
  'person:ngo_quyen': {
    entityId: 'person:ngo_quyen',
    canonicalName: 'Ngô Quyền',
    type: 'Person',
    aliases: ['Tiền Ngô Vương', 'Vua Ngô Quyền'],
  },
  'person:ly_thai_to': {
    entityId: 'person:ly_thai_to',
    canonicalName: 'Lý Thái Tổ',
    type: 'Person',
    aliases: ['Lý Công Uẩn', 'Vua Lý Thái Tổ'],
  },
  'person:dinh_tien_hoang': {
    entityId: 'person:dinh_tien_hoang',
    canonicalName: 'Đinh Tiên Hoàng',
    type: 'Person',
    aliases: ['Đinh Bộ Lĩnh', 'Vạn Thắng Vương', 'Đinh Tiên Hoàng Đế'],
  },
  'person:nguyen_trai': {
    entityId: 'person:nguyen_trai',
    canonicalName: 'Nguyễn Trãi',
    type: 'Person',
    aliases: ['Ức Trai', 'Quan Trãi'],
  },
  'person:vo_nguyen_giap': {
    entityId: 'person:vo_nguyen_giap',
    canonicalName: 'Võ Nguyên Giáp',
    type: 'Person',
    aliases: ['Đại tướng Võ Nguyên Giáp', 'Tướng Giáp', 'Anh Văn'],
  },
};

/**
 * Built-in Historical Location Mapping Table across eras (SAME_AS_LOCATION)
 */
export const HISTORICAL_LOCATION_MAPPINGS: HistoricalLocationMapping[] = [
  {
    historicalName: 'Thăng Long',
    canonicalModernName: 'Hà Nội',
    dynasty: 'Nhà Lý / Nhà Trần / Nhà Lê',
    timeRange: { start: 1010, end: 1788 },
  },
  {
    historicalName: 'Đông Quan',
    canonicalModernName: 'Hà Nội',
    dynasty: 'Thuộc Minh',
    timeRange: { start: 1407, end: 1427 },
  },
  {
    historicalName: 'Đông Kinh',
    canonicalModernName: 'Hà Nội',
    dynasty: 'Nhà Lê Sơ',
    timeRange: { start: 1430, end: 1788 },
  },
  {
    historicalName: 'Tống Bình',
    canonicalModernName: 'Hà Nội',
    dynasty: 'Thuộc Tùy - Đường',
    timeRange: { start: 602, end: 905 },
  },
  {
    historicalName: 'Đại La',
    canonicalModernName: 'Hà Nội',
    dynasty: 'Thuộc Đường',
    timeRange: { start: 866, end: 1010 },
  },
  {
    historicalName: 'Phú Xuân',
    canonicalModernName: 'Huế',
    dynasty: 'Chúa Nguyễn / Nhà Tây Sơn / Nhà Nguyễn',
    timeRange: { start: 1687, end: 1945 },
  },
  {
    historicalName: 'Thuận Hóa',
    canonicalModernName: 'Huế',
    dynasty: 'Nhà Hậu Lê / Chúa Nguyễn',
    timeRange: { start: 1306, end: 1687 },
  },
  {
    historicalName: 'Sài Gòn',
    canonicalModernName: 'Thành phố Hồ Chí Minh',
    dynasty: 'Nhà Nguyễn / Pháp thuộc / VNCH',
    timeRange: { start: 1698, end: 1975 },
  },
  {
    historicalName: 'Gia Định',
    canonicalModernName: 'Thành phố Hồ Chí Minh',
    dynasty: 'Nhà Nguyễn',
    timeRange: { start: 1698, end: 1862 },
  },
  {
    historicalName: 'Hoa Lư',
    canonicalModernName: 'Ninh Bình',
    dynasty: 'Nhà Đinh / Nhà Tiền Lê',
    timeRange: { start: 968, end: 1010 },
  },
  {
    historicalName: 'Cố đô Hoa Lư',
    canonicalModernName: 'Ninh Bình',
    dynasty: 'Nhà Đinh / Nhà Tiền Lê',
    timeRange: { start: 968, end: 1010 },
  },
];

/**
 * Built-in Historical Location Dictionary with Canonical Entity IDs and Aliases
 */
export const HISTORICAL_LOCATION_DICTIONARY: Record<string, HistoricalEntityInfo> = {
  'location:ha_noi': {
    entityId: 'location:ha_noi',
    canonicalName: 'Hà Nội',
    type: 'Location',
    aliases: ['Thăng Long', 'Đông Quan', 'Đông Kinh', 'Tống Bình', 'Đại La'],
  },
  'location:hue': {
    entityId: 'location:hue',
    canonicalName: 'Huế',
    type: 'Location',
    aliases: ['Phú Xuân', 'Thuận Hóa'],
  },
  'location:ho_chi_minh': {
    entityId: 'location:ho_chi_minh',
    canonicalName: 'Thành phố Hồ Chí Minh',
    type: 'Location',
    aliases: ['Sài Gòn', 'Gia Định'],
  },
  'location:ninh_binh': {
    entityId: 'location:ninh_binh',
    canonicalName: 'Ninh Bình',
    type: 'Location',
    aliases: ['Hoa Lư', 'Cố đô Hoa Lư'],
  },
};

/**
 * Normalizes text string for entity lookup (lowercase, trimmed, strip redundant punctuation)
 */
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
    .trim();
}

/**
 * Resolves historical location mapping across eras (SAME_AS_LOCATION)
 */
export function resolveLocationMapping(locationName: string): HistoricalLocationMapping | undefined {
  const normInput = normalizeKey(locationName);
  return HISTORICAL_LOCATION_MAPPINGS.find(
    (m) => normalizeKey(m.historicalName) === normInput || normalizeKey(m.canonicalModernName) === normInput
  );
}

/**
 * Resolves any person or entity alias to an EntityAliasMapping
 */
export function resolveEntityAlias(aliasOrName: string): EntityAliasMapping {
  const normInput = normalizeKey(aliasOrName);

  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    if (normalizeKey(person.canonicalName) === normInput) {
      return {
        alias: person.canonicalName,
        canonicalId: person.entityId,
        canonicalName: person.canonicalName,
      };
    }
    for (const alias of person.aliases) {
      if (normalizeKey(alias) === normInput) {
        return {
          alias,
          canonicalId: person.entityId,
          canonicalName: person.canonicalName,
        };
      }
    }
  }

  for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    if (normalizeKey(loc.canonicalName) === normInput) {
      return {
        alias: loc.canonicalName,
        canonicalId: loc.entityId,
        canonicalName: loc.canonicalName,
      };
    }
    for (const alias of loc.aliases) {
      if (normalizeKey(alias) === normInput) {
        return {
          alias,
          canonicalId: loc.entityId,
          canonicalName: loc.canonicalName,
        };
      }
    }
  }

  // Fallback for unknown entity
  const slug = normInput.replace(/\s+/g, '_');
  return {
    alias: aliasOrName.trim(),
    canonicalId: `entity:${slug}`,
    canonicalName: aliasOrName.trim(),
  };
}

/**
 * Resolves any name variant/alias to its Canonical Historical Entity representation
 */
export function resolveCanonicalEntity(inputName: string): HistoricalEntityInfo {
  const aliasMapping = resolveEntityAlias(inputName);

  const allDicts = [HISTORICAL_PERSON_DICTIONARY, HISTORICAL_LOCATION_DICTIONARY];
  for (const dict of allDicts) {
    if (dict[aliasMapping.canonicalId]) {
      return dict[aliasMapping.canonicalId];
    }
  }

  return {
    entityId: aliasMapping.canonicalId,
    canonicalName: aliasMapping.canonicalName,
    type: 'Person',
    aliases: [inputName.trim()],
  };
}

/**
 * Builds SAME_AS_LOCATION relationship tuples for Graph Seeding
 */
export function formatSameAsLocationRelations(): Array<{
  source: string;
  target: string;
  relationType: 'SAME_AS_LOCATION';
  confidence: number;
}> {
  return HISTORICAL_LOCATION_MAPPINGS.map((mapping) => ({
    source: mapping.historicalName,
    target: mapping.canonicalModernName,
    relationType: 'SAME_AS_LOCATION',
    confidence: 1.0,
  }));
}

/**
 * Builds ALIAS_OF relationship tuples for Graph Seeding
 */
export function formatAliasOfRelations(): Array<{
  source: string;
  target: string;
  relationType: 'ALIAS_OF';
  confidence: number;
}> {
  const relations: Array<{
    source: string;
    target: string;
    relationType: 'ALIAS_OF';
    confidence: number;
  }> = [];

  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    for (const alias of person.aliases) {
      if (alias !== person.canonicalName) {
        relations.push({
          source: alias,
          target: person.canonicalName,
          relationType: 'ALIAS_OF',
          confidence: 1.0,
        });
      }
    }
  }

  return relations;
}

/**
 * Gets alias mapping table for a list of identified entity IDs
 */
export function buildAliasTable(entityIds: string[]): Record<string, string[]> {
  const aliasTable: Record<string, string[]> = {};
  const allDicts = [HISTORICAL_PERSON_DICTIONARY, HISTORICAL_LOCATION_DICTIONARY];

  for (const id of entityIds) {
    let found = false;
    for (const dict of allDicts) {
      if (dict[id]) {
        aliasTable[dict[id].canonicalName] = dict[id].aliases;
        found = true;
        break;
      }
    }
    if (!found) {
      const resolved = resolveCanonicalEntity(id);
      aliasTable[resolved.canonicalName] = resolved.aliases;
    }
  }

  return aliasTable;
}
