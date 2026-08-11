/**
 * Entity Disambiguation Engine: Alias Mapping & Temporal Location Resolution
 */

export interface HistoricalEntityInfo {
  entityId: string;
  canonicalName: string;
  type: 'Person' | 'Event' | 'Location' | 'Dynasty' | 'TimePeriod';
  aliases: string[];
}

// Built-in Historical Characters Alias Knowledge Base
export const HISTORICAL_PERSON_DICTIONARY: Record<string, HistoricalEntityInfo> = {
  'person:quang_trung': {
    entityId: 'person:quang_trung',
    canonicalName: 'Quang Trung',
    type: 'Person',
    aliases: ['Nguyễn Huệ', 'Hồ Thơm', 'Bắc Bình Vương', 'Vua Quang Trung', 'Quang Trung Hoàng Đế'],
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
  'person:vo_nguyen_giap': {
    entityId: 'person:vo_nguyen_giap',
    canonicalName: 'Võ Nguyên Giáp',
    type: 'Person',
    aliases: ['Đại tướng Võ Nguyên Giáp', 'Tướng Giáp', 'Anh Văn'],
  },
};

// Built-in Historical Location Knowledge Base (SAME_AS_LOCATION across eras)
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
 * Resolves any name variant/alias to its Canonical Historical Entity representation
 */
export function resolveCanonicalEntity(inputName: string): HistoricalEntityInfo {
  const normInput = normalizeKey(inputName);

  const allDicts = [HISTORICAL_PERSON_DICTIONARY, HISTORICAL_LOCATION_DICTIONARY];
  for (const dict of allDicts) {
    for (const info of Object.values(dict)) {
      if (normalizeKey(info.canonicalName) === normInput) {
        return info;
      }
      for (const alias of info.aliases) {
        if (normalizeKey(alias) === normInput) {
          return info;
        }
      }
    }
  }

  // Fallback for unknown entities
  const slug = normInput.replace(/\s+/g, '_');
  return {
    entityId: `entity:${slug}`,
    canonicalName: inputName.trim(),
    type: 'Person',
    aliases: [inputName.trim()],
  };
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
