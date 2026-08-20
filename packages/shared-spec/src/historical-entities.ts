/**
 * Historical Entity Mapper: Location Temporal Mapping (SAME_AS_LOCATION) & Character Alias Resolution (ALIAS_OF)
 */

import { EntityAliasMapping, HistoricalLocationMapping } from './interfaces.js';
import { getCanonicalEntityIdPrefix } from './schema.js';
import { isPgAvailable, query, inMemoryStore } from './db/client.js';
import { generateEmbedding } from './embeddings.js';


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
  'person_le_dai_hanh': {
    entityId: 'person_le_dai_hanh',
    canonicalName: 'Lê Đại Hành',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Hoàn', 'Vua Lê Đại Hành', 'Lê Đại Hành Hoàng Đế'],
  },
  'person_ba_trieu': {
    entityId: 'person_ba_trieu',
    canonicalName: 'Bà Triệu',
    type: 'HISTORICAL_PERSON',
    aliases: ['Triệu Thị Trinh', 'Triệu Trinh Nương', 'Nhất Lục Nương'],
  },
  'person_hai_ba_trung': {
    entityId: 'person_hai_ba_trung',
    canonicalName: 'Hai Bà Trưng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Trưng Trắc', 'Trưng Nhị', 'Trưng Vương', 'Hai Bà Trưng'],
  },
  'person_ly_thuong_kiet': {
    entityId: 'person_ly_thuong_kiet',
    canonicalName: 'Lý Thường Kiệt',
    type: 'HISTORICAL_PERSON',
    aliases: ['Ngô Tuấn', 'Thái úy Lý Thường Kiệt', 'Thái úy'],
  },
  'person_an_duong_vuong': {
    entityId: 'person_an_duong_vuong',
    canonicalName: 'An Dương Vương',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thục Phán', 'Thục Phán An Dương Vương'],
  },
  'person_cao_lo': {
    entityId: 'person_cao_lo',
    canonicalName: 'Cao Lỗ',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tướng quân Cao Lỗ', 'Đô Lỗ'],
  },
  'person_hung_vuong': {
    entityId: 'person_hung_vuong',
    canonicalName: 'Hùng Vương',
    type: 'HISTORICAL_PERSON',
    aliases: ['Vua Hùng', 'Vua Hùng Vương', 'Hùng Vương thứ 18'],
  },
  'person_ly_bi': {
    entityId: 'person_ly_bi',
    canonicalName: 'Lý Bí',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lý Nam Đế', 'Vua Lý Nam Đế'],
  },
  'person_tran_nhan_tong': {
    entityId: 'person_tran_nhan_tong',
    canonicalName: 'Trần Nhân Tông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Vua Trần Nhân Tông', 'Trúc Lâm Đại Đầu Đà'],
  },
  'person_ho_quy_ly': {
    entityId: 'person_ho_quy_ly',
    canonicalName: 'Hồ Quý Ly',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Quý Ly', 'Vua Hồ Quý Ly'],
  },
  'person_ho_nguyen_trung': {
    entityId: 'person_ho_nguyen_trung',
    canonicalName: 'Hồ Nguyên Trừng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Trừng'],
  },
  'person_mac_dang_dung': {
    entityId: 'person_mac_dang_dung',
    canonicalName: 'Mạc Đăng Dung',
    type: 'HISTORICAL_PERSON',
    aliases: ['Mạc Thái Tổ', 'Vua Mạc Thái Tổ'],
  },
  'person_nguyen_kim': {
    entityId: 'person_nguyen_kim',
    canonicalName: 'Nguyễn Kim',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thái sư Lương quốc công Nguyễn Kim'],
  },
  'person_nguyen_hoang': {
    entityId: 'person_nguyen_hoang',
    canonicalName: 'Nguyễn Hoàng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Chúa Tiên', 'Đoan Quốc Công'],
  },
  'person_dao_duy_tu': {
    entityId: 'person_dao_duy_tu',
    canonicalName: 'Đào Duy Từ',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lộc Khê hầu'],
  },
  'person_gia_long': {
    entityId: 'person_gia_long',
    canonicalName: 'Gia Long',
    type: 'HISTORICAL_PERSON',
    aliases: ['Nguyễn Ánh', 'Vua Gia Long', 'Gia Long Hoàng Đế'],
  },
  'person_minh_mang': {
    entityId: 'person_minh_mang',
    canonicalName: 'Minh Mạng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Nguyễn Phúc Đảm', 'Vua Minh Mạng', 'Minh Mệnh'],
  },
  'person_pham_van_dong': {
    entityId: 'person_pham_van_dong',
    canonicalName: 'Phạm Văn Đồng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thủ tướng Phạm Văn Đồng', 'Anh Tô'],
  },
  'person_lieu_thang': {
    entityId: 'person_lieu_thang',
    canonicalName: 'Liễu Thăng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tổng binh Liễu Thăng'],
  },
  'person_mai_thuc_loan': {
    entityId: 'person_mai_thuc_loan',
    canonicalName: 'Mai Thúc Loan',
    type: 'HISTORICAL_PERSON',
    aliases: ['Mai Hắc Đế', 'Vua Mai Hắc Đế'],
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
 * Infers normalized entity taxonomy type from textual name clues
 */
export function inferEntityTypeFromName(name: string): 'HISTORICAL_PERSON' | 'LOCATION' | 'EVENT_BATTLE' | 'DYNASTY_ERA' | 'ORGANIZATION' | 'ARTIFACT' | 'DOCUMENT_CULTURE' {
  const norm = name.toLowerCase().trim();
  if (/\b(trận|chiến dịch|cuộc khởi nghĩa|khởi nghĩa|biến cố|hội nghị|hội thề)\b/.test(norm)) {
    return 'EVENT_BATTLE';
  }
  if (/\b(sông|núi|ải|thành|đô|trấn|phủ|huyện|tỉnh|làng|xã|đàng|đông kinh|đông quan|thăng long|hà nội)\b/.test(norm)) {
    return 'LOCATION';
  }
  if (/\b(triều|nhà|thời|kỷ|kỷ nguyên)\b/.test(norm)) {
    return 'DYNASTY_ERA';
  }
  if (/\b(quân|hội|viện|quán|đoàn|tập đoàn|triều đình)\b/.test(norm)) {
    return 'ORGANIZATION';
  }
  if (/\b(bia|sắc|ấn|trống|vũ khí|bảo vật|thần khí)\b/.test(norm)) {
    return 'ARTIFACT';
  }
  if (/\b(sử|bình|hịch|chiếu|cáo|thư|quyển|bản kỷ|tập|tác phẩm)\b/.test(norm)) {
    return 'DOCUMENT_CULTURE';
  }
  return 'HISTORICAL_PERSON';
}

/**
 * Resolves any person or entity alias to an EntityAliasMapping
 */
export function resolveEntityAlias(aliasOrName: string, entityType?: string): EntityAliasMapping {
  const effectiveType = entityType || inferEntityTypeFromName(aliasOrName);
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
  const rawSlug = normInput.replace(/\s+/g, '_');
  const slug = rawSlug.length > 100 ? rawSlug.slice(0, 100) : rawSlug;
  const prefix = getCanonicalEntityIdPrefix(effectiveType as any);
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

  if (start < -179 || (start <= -179 && end <= -179)) epochSet.add('EPOCH_01');
  if (start >= -179 && start < 938) epochSet.add('EPOCH_02');
  if (start >= 938 && start < 1009) epochSet.add('EPOCH_03');
  if (start >= 1009 && start < 1225) epochSet.add('EPOCH_04');
  if (start >= 1225 && start < 1400) epochSet.add('EPOCH_05');
  if (start >= 1400 && start < 1407) epochSet.add('EPOCH_06');
  if (start >= 1407 && start < 1428) epochSet.add('EPOCH_07');
  if (start >= 1428 && start < 1527) epochSet.add('EPOCH_08');
  if (start >= 1527 && start <= 1777) epochSet.add('EPOCH_09');
  if (start >= 1771 && start < 1802) epochSet.add('EPOCH_10');
  if (start >= 1802 && start < 1858) epochSet.add('EPOCH_11');
  if (start >= 1858 && start < 1945) epochSet.add('EPOCH_12');
  if (start >= 1945 && start < 1954) epochSet.add('EPOCH_13');
  if (start >= 1954 && start < 1975) epochSet.add('EPOCH_14');
  if (start >= 1975) epochSet.add('EPOCH_15');

  return Array.from(epochSet);
}

/**
 * Resolves any name variant/alias to its Canonical Historical Entity representation
 */
export function resolveCanonicalEntity(inputName: string): HistoricalEntityInfo {
  const inferredType = inferEntityTypeFromName(inputName);
  const aliasMapping = resolveEntityAlias(inputName, inferredType);

  const allDicts = [HISTORICAL_PERSON_DICTIONARY, HISTORICAL_LOCATION_DICTIONARY];
  for (const dict of allDicts) {
    if (dict[aliasMapping.canonicalId]) {
      return dict[aliasMapping.canonicalId];
    }
  }

  return {
    entityId: aliasMapping.canonicalId,
    canonicalName: aliasMapping.canonicalName,
    type: inferredType,
    aliases: [inputName.trim()],
  };
}

/**
 * Checks if an entity name or ID exists in the curated Master Historical Ontologies
 */
export function isKnownMasterEntity(nameOrId: string): boolean {
  if (!nameOrId || typeof nameOrId !== 'string') return false;
  const norm = normalizeKey(nameOrId);
  const aliasMapping = resolveEntityAlias(nameOrId);
  
  if (HISTORICAL_PERSON_DICTIONARY[aliasMapping.canonicalId] || HISTORICAL_LOCATION_DICTIONARY[aliasMapping.canonicalId]) {
    return true;
  }
  if (HISTORICAL_PERSON_DICTIONARY[nameOrId] || HISTORICAL_LOCATION_DICTIONARY[nameOrId]) {
    return true;
  }

  // Check against location mappings
  const loc = resolveLocationMapping(nameOrId);
  if (loc) return true;

  // Check aliases in person dictionary
  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    if (normalizeKey(person.canonicalName) === norm || person.aliases.some((a) => normalizeKey(a) === norm)) {
      return true;
    }
  }

  // Check aliases in location dictionary
  for (const location of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    if (normalizeKey(location.canonicalName) === norm || location.aliases.some((a) => normalizeKey(a) === norm)) {
      return true;
    }
  }

  return false;
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

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Ingests a historical document into the database/store (pure shared implementation)
 */
export async function ingestHistoricalDocument(
  content: string,
  metadata: { title: string; source: string; dynasty?: string; sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' }
): Promise<void> {
  const chunkId = `chunk_${hashString(metadata.title + content.slice(0, 50))}`;
  const embedding = await generateEmbedding(content);

  // Extract entities mentioned in content
  const entityMap = new Map<string, HistoricalEntityInfo>();

  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    if (content.includes(person.canonicalName) || person.aliases.some((a) => content.includes(a))) {
      entityMap.set(person.entityId, person);
    }
  }

  for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    if (content.includes(loc.canonicalName) || loc.aliases.some((a) => content.includes(a))) {
      entityMap.set(loc.entityId, loc);
    }
  }

  const pgConnected = await isPgAvailable();

  if (pgConnected) {
    await query(
      `INSERT INTO document_chunks (id, title, text_content, dynasty, source_reliability, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)
       ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content;`,
      [chunkId, metadata.title, content, metadata.dynasty || null, metadata.sourceReliability || 'LEVEL_1', JSON.stringify(embedding)]
    );

    for (const entity of entityMap.values()) {
      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET aliases = EXCLUDED.aliases;`,
        [entity.entityId, entity.canonicalName, entity.type, entity.aliases, JSON.stringify({})]
      );

      await query(
        `INSERT INTO entity_chunks (entity_id, chunk_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING;`,
        [entity.entityId, chunkId]
      );
    }

    const sameAsRels = formatSameAsLocationRelations();
    for (const rel of sameAsRels) {
      const srcEntity = resolveCanonicalEntity(rel.source);
      const tgtEntity = resolveCanonicalEntity(rel.target);
      if (srcEntity.entityId === tgtEntity.entityId) continue;

      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)
         ON CONFLICT (id) DO NOTHING;`,
        [srcEntity.entityId, srcEntity.canonicalName, srcEntity.type, srcEntity.aliases]
      );
      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)
         ON CONFLICT (id) DO NOTHING;`,
        [tgtEntity.entityId, tgtEntity.canonicalName, tgtEntity.type, tgtEntity.aliases]
      );
      await query(
        `INSERT INTO relationships (source_entity_id, target_entity_id, relation_type, confidence)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING;`,
        [srcEntity.entityId, tgtEntity.entityId, rel.relationType, rel.confidence]
      );
    }

    const aliasRels = formatAliasOfRelations();
    for (const rel of aliasRels) {
      const srcEntity = resolveCanonicalEntity(rel.source);
      const tgtEntity = resolveCanonicalEntity(rel.target);
      if (srcEntity.entityId === tgtEntity.entityId) continue;

      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)
         ON CONFLICT (id) DO NOTHING;`,
        [srcEntity.entityId, srcEntity.canonicalName, srcEntity.type, srcEntity.aliases]
      );
      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)
         ON CONFLICT (id) DO NOTHING;`,
        [tgtEntity.entityId, tgtEntity.canonicalName, tgtEntity.type, tgtEntity.aliases]
      );
      await query(
        `INSERT INTO relationships (source_entity_id, target_entity_id, relation_type, confidence)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING;`,
        [srcEntity.entityId, tgtEntity.entityId, rel.relationType, rel.confidence]
      );
    }
  } else {
    // In-memory fallback
    inMemoryStore.documentChunks.set(chunkId, {
      id: chunkId,
      title: metadata.title,
      text_content: content,
      dynasty: metadata.dynasty,
      source_reliability: metadata.sourceReliability || 'LEVEL_1',
      embedding,
    });

    for (const entity of entityMap.values()) {
      inMemoryStore.entities.set(entity.entityId, {
        id: entity.entityId,
        name: entity.canonicalName,
        type: entity.type,
        aliases: entity.aliases,
        metadata: {},
      });

      inMemoryStore.entityChunks.push({
        entity_id: entity.entityId,
        chunk_id: chunkId,
      });
    }

    const sameAsRels = formatSameAsLocationRelations();
    for (const rel of sameAsRels) {
      const srcEntity = resolveCanonicalEntity(rel.source);
      const tgtEntity = resolveCanonicalEntity(rel.target);
      if (srcEntity.entityId === tgtEntity.entityId) continue;

      const exists = inMemoryStore.relationships.some(
        (r) => r.source_entity_id === srcEntity.entityId && r.target_entity_id === tgtEntity.entityId && r.relation_type === rel.relationType
      );
      if (!exists) {
        inMemoryStore.relationships.push({
          id: inMemoryStore.nextRelId++,
          source_entity_id: srcEntity.entityId,
          target_entity_id: tgtEntity.entityId,
          relation_type: rel.relationType,
          confidence: rel.confidence,
        });
      }
    }

    const aliasRels = formatAliasOfRelations();
    for (const rel of aliasRels) {
      const srcEntity = resolveCanonicalEntity(rel.source);
      const tgtEntity = resolveCanonicalEntity(rel.target);
      if (srcEntity.entityId === tgtEntity.entityId) continue;

      const exists = inMemoryStore.relationships.some(
        (r) => r.source_entity_id === srcEntity.entityId && r.target_entity_id === tgtEntity.entityId && r.relation_type === rel.relationType
      );
      if (!exists) {
        inMemoryStore.relationships.push({
          id: inMemoryStore.nextRelId++,
          source_entity_id: srcEntity.entityId,
          target_entity_id: tgtEntity.entityId,
          relation_type: rel.relationType,
          confidence: rel.confidence,
        });
      }
    }
  }
}

