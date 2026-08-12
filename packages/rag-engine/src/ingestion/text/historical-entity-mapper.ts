/**
 * Historical Entity Mapper: Location Temporal Mapping (SAME_AS_LOCATION) & Character Alias Resolution (ALIAS_OF)
 */

import { EntityAliasMapping, HistoricalLocationMapping, getCanonicalEntityIdPrefix } from '@chronoviet/shared-spec';

export interface HistoricalEntityInfo {
  entityId: string;
  canonicalName: string;
  type: 'HISTORICAL_PERSON' | 'LOCATION' | 'EVENT_BATTLE' | 'DYNASTY_ERA' | 'ORGANIZATION' | 'ARTIFACT' | 'DOCUMENT_CULTURE' | string;
  aliases: string[];
}

/**
 * Built-in Historical Character Dictionary with Canonical Entity IDs and Aliases
 */
export const HISTORICAL_PERSON_DICTIONARY: Record<string, HistoricalEntityInfo> = {
  'person_quang_trung': {
    entityId: 'person_quang_trung',
    canonicalName: 'Quang Trung',
    type: 'HISTORICAL_PERSON',
    aliases: ['Nguyễn Huệ', 'Hồ Thơm', 'Bắc Bình Vương', 'Vua Quang Trung', 'Quang Trung Hoàng Đế', 'Long Nhương Tướng Quân', 'Long Nhượng Tướng Quân'],
  },
  'person_nguyen_nhac': {
    entityId: 'person_nguyen_nhac',
    canonicalName: 'Nguyễn Nhạc',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tây Sơn Vương', 'Thái Đức Hoàng Đế', 'Vua Thái Đức'],
  },
  'person_tran_hung_dao': {
    entityId: 'person_tran_hung_dao',
    canonicalName: 'Trần Hưng Đạo',
    type: 'HISTORICAL_PERSON',
    aliases: ['Trần Quốc Tuấn', 'Hưng Đạo Đại Vương', 'Hưng Đạo Vương', 'Đức Thánh Trần'],
  },
  'person_le_loi': {
    entityId: 'person_le_loi',
    canonicalName: 'Lê Lợi',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Thái Tổ', 'Bình Định Vương', 'Vua Lê Lợi'],
  },
  'person_ngo_quyen': {
    entityId: 'person_ngo_quyen',
    canonicalName: 'Ngô Quyền',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tiền Ngô Vương', 'Vua Ngô Quyền'],
  },
  'person_ly_thai_to': {
    entityId: 'person_ly_thai_to',
    canonicalName: 'Lý Thái Tổ',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lý Công Uẩn', 'Vua Lý Thái Tổ'],
  },
  'person_dinh_tien_hoang': {
    entityId: 'person_dinh_tien_hoang',
    canonicalName: 'Đinh Tiên Hoàng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Đinh Bộ Lĩnh', 'Vạn Thắng Vương', 'Đinh Tiên Hoàng Đế'],
  },
  'person_nguyen_trai': {
    entityId: 'person_nguyen_trai',
    canonicalName: 'Nguyễn Trãi',
    type: 'HISTORICAL_PERSON',
    aliases: ['Ức Trai', 'Quan Trãi'],
  },
  'person_vo_nguyen_giap': {
    entityId: 'person_vo_nguyen_giap',
    canonicalName: 'Võ Nguyên Giáp',
    type: 'HISTORICAL_PERSON',
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
  'loc_ha_noi': {
    entityId: 'loc_ha_noi',
    canonicalName: 'Hà Nội',
    type: 'LOCATION',
    aliases: ['Thăng Long', 'Đông Quan', 'Đông Kinh', 'Tống Bình', 'Đại La'],
  },
  'loc_hue': {
    entityId: 'loc_hue',
    canonicalName: 'Huế',
    type: 'LOCATION',
    aliases: ['Phú Xuân', 'Thuận Hóa'],
  },
  'loc_ho_chi_minh': {
    entityId: 'loc_ho_chi_minh',
    canonicalName: 'Thành phố Hồ Chí Minh',
    type: 'LOCATION',
    aliases: ['Sài Gòn', 'Gia Định'],
  },
  'loc_ninh_binh': {
    entityId: 'loc_ninh_binh',
    canonicalName: 'Ninh Bình',
    type: 'LOCATION',
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
export function resolveEntityAlias(aliasOrName: string, entityType: string = 'HISTORICAL_PERSON'): EntityAliasMapping {
  const normInput = normalizeKey(aliasOrName);

  // Explicit Safeguard: "Tây Sơn Vương" maps strictly to Nguyễn Nhạc (person_nguyen_nhac)
  if (normInput === 'tay son vuong' || normInput === 'tây sơn vương') {
    return {
      alias: 'Tây Sơn Vương',
      canonicalId: 'person_nguyen_nhac',
      canonicalName: 'Nguyễn Nhạc',
    };
  }

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

  // Fallback for unknown entity with canonical prefix
  const slug = normInput.replace(/\s+/g, '_');
  const prefix = getCanonicalEntityIdPrefix(entityType as any);
  return {
    alias: aliasOrName.trim(),
    canonicalId: `${prefix}${slug}`,
    canonicalName: aliasOrName.trim(),
  };
}

/**
 * Resolves historical epoch IDs for a given time range (Spec Section 2.1)
 * Enforces Dual-Axis Overlap Protocol for 1771 - 1777 (EPOCH_09 and EPOCH_10)
 */
export function resolveHistoricalEpochs(timeStart?: number, timeEnd?: number): string[] {
  if (timeStart === undefined && timeEnd === undefined) return [];
  const start = timeStart ?? timeEnd!;
  const end = timeEnd ?? timeStart!;

  const epochSet = new Set<string>();

  // Dual-Axis Overlap Protocol (Spec 2.1): 1771 - 1777 must have BOTH EPOCH_09 and EPOCH_10
  if ((start >= 1771 && start <= 1777) || (end >= 1771 && end <= 1777) || (start <= 1771 && end >= 1777)) {
    epochSet.add('EPOCH_09');
    epochSet.add('EPOCH_10');
  }

  if (start < -179 || (start <= 179 && end <= 179)) epochSet.add('EPOCH_01');
  if (start >= -179 && start <= 938) epochSet.add('EPOCH_02');
  if (start >= 938 && start <= 1009) epochSet.add('EPOCH_03');
  if (start >= 1009 && start <= 1225) epochSet.add('EPOCH_04');
  if (start >= 1225 && start <= 1400) epochSet.add('EPOCH_05');
  if (start >= 1400 && start <= 1407) epochSet.add('EPOCH_06');
  if (start >= 1407 && start <= 1427) epochSet.add('EPOCH_07');
  if (start >= 1428 && start <= 1527) epochSet.add('EPOCH_08');
  if (start >= 1527 && start <= 1777) epochSet.add('EPOCH_09');
  if (start >= 1771 && start <= 1802) epochSet.add('EPOCH_10');
  if (start >= 1802 && start <= 1858) epochSet.add('EPOCH_11');
  if (start >= 1858 && start <= 1945) epochSet.add('EPOCH_12');
  if (start >= 1945 && start <= 1954) epochSet.add('EPOCH_13');
  if (start >= 1954 && start <= 1975) epochSet.add('EPOCH_14');
  if (start >= 1975) epochSet.add('EPOCH_15');

  return Array.from(epochSet);
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
