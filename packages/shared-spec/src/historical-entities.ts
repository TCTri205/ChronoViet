/**
 * Historical Entity Mapper: Location Temporal Mapping (SAME_AS_LOCATION) & Character Alias Resolution (ALIAS_OF)
 */

import { EntityAliasMapping, HistoricalLocationMapping } from './interfaces.js';
import { getCanonicalEntityIdPrefix } from './schema.js';


export interface HistoricalEntityInfo {
  entityId: string;
  canonicalName: string;
  type: 'HISTORICAL_PERSON' | 'LOCATION' | 'EVENT_BATTLE' | 'DYNASTY_ERA' | 'ORGANIZATION' | 'ARTIFACT' | 'DOCUMENT_CULTURE' | string;
  aliases: string[];
  timeRange?: { start?: number; end?: number };
  dynasty?: string;
  isMythological?: boolean;
}

export function removeVietnameseAccents(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Curated Lexicon for Modern Technology / Modern Weaponry (strictly >= 19th/20th century)
 */
export const MODERN_TECH_LEXICON: string[] = [
  'tàu bọc thép',
  'tàu sắt',
  'tàu hơi nước',
  'máy bay',
  'phi cơ',
  'tiêm kích',
  'oanh tạc cơ',
  'trực thăng',
  'xe tăng',
  'xe thiết giáp',
  'súng máy',
  'súng trường',
  'súng tự động',
  'súng bắn tỉa',
  'bom nguyên tử',
  'vũ khí hạt nhân',
  'hạt nhân',
  'nguyên tử',
  'radar',
  'ra-đa',
  'tên lửa',
  'ngư lôi',
  'tàu ngầm',
  'điện tín',
  'internet',
  'vệ tinh',
  'súng phóng lựu',
];

/**
 * Curated Lexicon for Mythological / Legendary Entities
 */
export const MYTHOLOGICAL_ENTITIES_LEXICON: string[] = [
  'thần kim quy',
  'kim quy',
  'sơn tinh',
  'thủy tinh',
  'thánh gióng',
  'phù đổng thiên vương',
  'bà chúa liễu hạnh',
  'liễu hạnh',
  'chử đồng tử',
  'rùa vàng',
];

/**
 * Curated Lexicon for Modern Treaties & Political Events
 */
export const MODERN_POLITICAL_LEGAL_LEXICON: string[] = [
  'hiệp định geneva',
  'hiệp định giơ-ne-vơ',
  'hiệp định paris',
  'hội nghị potsdam',
  'hòa ước giáp tuất',
  'hòa ước patenôtre',
  'hòa ước hác-măng',
  'tuyên ngôn độc lập 1945',
  'liên hợp quốc',
  'bầu cử quốc hội',
];

/**
 * Built-in Historical Character Dictionary with Canonical Entity IDs, Aliases, and Temporal Bounds
 */
export const HISTORICAL_PERSON_DICTIONARY: Record<string, HistoricalEntityInfo> = {
  'person_quang_trung': {
    entityId: 'person_quang_trung',
    canonicalName: 'Quang Trung',
    type: 'HISTORICAL_PERSON',
    aliases: ['Nguyễn Huệ', 'Hồ Thơm', 'Bắc Bình Vương', 'Vua Quang Trung', 'Quang Trung Hoàng Đế', 'Long Nhương Tướng Quân', 'Long Nhượng Tướng Quân'],
    timeRange: { start: 1753, end: 1792 },
    dynasty: 'Nhà Tây Sơn',
  },
  'person_nguyen_nhac': {
    entityId: 'person_nguyen_nhac',
    canonicalName: 'Nguyễn Nhạc',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tây Sơn Vương', 'Thái Đức Hoàng Đế', 'Vua Thái Đức'],
    timeRange: { start: 1743, end: 1793 },
    dynasty: 'Nhà Tây Sơn',
  },
  'person_tran_hung_dao': {
    entityId: 'person_tran_hung_dao',
    canonicalName: 'Trần Hưng Đạo',
    type: 'HISTORICAL_PERSON',
    aliases: ['Trần Quốc Tuấn', 'Hưng Đạo Đại Vương', 'Hưng Đạo Vương', 'Đức Thánh Trần'],
    timeRange: { start: 1228, end: 1300 },
    dynasty: 'Nhà Trần',
  },
  'person_le_loi': {
    entityId: 'person_le_loi',
    canonicalName: 'Lê Lợi',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Thái Tổ', 'Bình Định Vương', 'Vua Lê Lợi'],
    timeRange: { start: 1385, end: 1433 },
    dynasty: 'Nhà Hậu Lê',
  },
  'person_ngo_quyen': {
    entityId: 'person_ngo_quyen',
    canonicalName: 'Ngô Quyền',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tiền Ngô Vương', 'Vua Ngô Quyền'],
    timeRange: { start: 897, end: 944 },
    dynasty: 'Nhà Ngô / Thời kỳ Tự chủ',
  },
  'person_ly_thai_to': {
    entityId: 'person_ly_thai_to',
    canonicalName: 'Lý Thái Tổ',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lý Công Uẩn', 'Vua Lý Thái Tổ'],
    timeRange: { start: 974, end: 1028 },
    dynasty: 'Nhà Lý',
  },
  'person_dinh_tien_hoang': {
    entityId: 'person_dinh_tien_hoang',
    canonicalName: 'Đinh Tiên Hoàng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Đinh Bộ Lĩnh', 'Vạn Thắng Vương', 'Đinh Tiên Hoàng Đế'],
    timeRange: { start: 924, end: 979 },
    dynasty: 'Nhà Đinh',
  },
  'person_nguyen_trai': {
    entityId: 'person_nguyen_trai',
    canonicalName: 'Nguyễn Trãi',
    type: 'HISTORICAL_PERSON',
    aliases: ['Ức Trai', 'Quan Trãi'],
    timeRange: { start: 1380, end: 1442 },
    dynasty: 'Nhà Hậu Lê',
  },
  'person_vo_nguyen_giap': {
    entityId: 'person_vo_nguyen_giap',
    canonicalName: 'Võ Nguyên Giáp',
    type: 'HISTORICAL_PERSON',
    aliases: ['Đại tướng Võ Nguyên Giáp', 'Tướng Giáp', 'Anh Văn'],
    timeRange: { start: 1911, end: 2013 },
    dynasty: 'Thời kỳ Hiện đại',
  },
  'person_le_dai_hanh': {
    entityId: 'person_le_dai_hanh',
    canonicalName: 'Lê Đại Hành',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Hoàn', 'Vua Lê Đại Hành', 'Lê Đại Hành Hoàng Đế'],
    timeRange: { start: 941, end: 1005 },
    dynasty: 'Nhà Tiền Lê',
  },
  'person_ba_trieu': {
    entityId: 'person_ba_trieu',
    canonicalName: 'Bà Triệu',
    type: 'HISTORICAL_PERSON',
    aliases: ['Triệu Thị Trinh', 'Triệu Trinh Nương', 'Nhất Lục Nương'],
    timeRange: { start: 225, end: 248 },
    dynasty: 'Thời kỳ Bắc thuộc',
  },
  'person_hai_ba_trung': {
    entityId: 'person_hai_ba_trung',
    canonicalName: 'Hai Bà Trưng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Trưng Trắc', 'Trưng Nhị', 'Trưng Vương', 'Hai Bà Trưng'],
    timeRange: { start: 14, end: 43 },
    dynasty: 'Trưng Nữ Vương',
  },
  'person_ly_thuong_kiet': {
    entityId: 'person_ly_thuong_kiet',
    canonicalName: 'Lý Thường Kiệt',
    type: 'HISTORICAL_PERSON',
    aliases: ['Ngô Tuấn', 'Thái úy Lý Thường Kiệt', 'Thái úy'],
    timeRange: { start: 1019, end: 1105 },
    dynasty: 'Nhà Lý',
  },
  'person_an_duong_vuong': {
    entityId: 'person_an_duong_vuong',
    canonicalName: 'An Dương Vương',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thục Phán', 'Thục Phán An Dương Vương'],
    timeRange: { start: -257, end: -208 },
    dynasty: 'Âu Lạc',
    isMythological: false,
  },
  'person_cao_lo': {
    entityId: 'person_cao_lo',
    canonicalName: 'Cao Lỗ',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tướng quân Cao Lỗ', 'Đô Lỗ'],
    timeRange: { start: -257, end: -208 },
    dynasty: 'Âu Lạc',
  },
  'person_hung_vuong': {
    entityId: 'person_hung_vuong',
    canonicalName: 'Hùng Vương',
    type: 'HISTORICAL_PERSON',
    aliases: ['Vua Hùng', 'Vua Hùng Vương', 'Hùng Vương thứ 18'],
    timeRange: { start: -2879, end: -258 },
    dynasty: 'Hồng Bàng / Văn Lang',
    isMythological: true,
  },
  'person_than_kim_quy': {
    entityId: 'person_than_kim_quy',
    canonicalName: 'Thần Kim Quy',
    type: 'HISTORICAL_PERSON',
    aliases: ['Rùa Vàng', 'Thần Rùa Vàng', 'Kim Quy'],
    isMythological: true,
  },
  'person_thanh_giong': {
    entityId: 'person_thanh_giong',
    canonicalName: 'Thánh Gióng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Phù Đổng Thiên Vương', 'Gióng'],
    isMythological: true,
  },
  'person_son_tinh': {
    entityId: 'person_son_tinh',
    canonicalName: 'Sơn Tinh',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tản Viên Sơn Thánh'],
    isMythological: true,
  },
  'person_thuy_tinh': {
    entityId: 'person_thuy_tinh',
    canonicalName: 'Thủy Tinh',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    isMythological: true,
  },
  'person_ly_bi': {
    entityId: 'person_ly_bi',
    canonicalName: 'Lý Bí',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lý Nam Đế', 'Vua Lý Nam Đế'],
    timeRange: { start: 503, end: 548 },
    dynasty: 'Nhà Tiền Lý / Vạn Xuân',
  },
  'person_tran_nhan_tong': {
    entityId: 'person_tran_nhan_tong',
    canonicalName: 'Trần Nhân Tông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Vua Trần Nhân Tông', 'Trúc Lâm Đại Đầu Đà'],
    timeRange: { start: 1258, end: 1308 },
    dynasty: 'Nhà Trần',
  },
  'person_ho_quy_ly': {
    entityId: 'person_ho_quy_ly',
    canonicalName: 'Hồ Quý Ly',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Quý Ly', 'Vua Hồ Quý Ly'],
    timeRange: { start: 1336, end: 1407 },
    dynasty: 'Nhà Hồ',
  },
  'person_ho_nguyen_trung': {
    entityId: 'person_ho_nguyen_trung',
    canonicalName: 'Hồ Nguyên Trừng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Trừng'],
    timeRange: { start: 1374, end: 1446 },
    dynasty: 'Nhà Hồ',
  },
  'person_mac_dang_dung': {
    entityId: 'person_mac_dang_dung',
    canonicalName: 'Mạc Đăng Dung',
    type: 'HISTORICAL_PERSON',
    aliases: ['Mạc Thái Tổ', 'Vua Mạc Thái Tổ'],
    timeRange: { start: 1483, end: 1541 },
    dynasty: 'Nhà Mạc',
  },
  'person_nguyen_kim': {
    entityId: 'person_nguyen_kim',
    canonicalName: 'Nguyễn Kim',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thái sư Lương quốc công Nguyễn Kim'],
    timeRange: { start: 1468, end: 1545 },
    dynasty: 'Lê Trung Hưng',
  },
  'person_nguyen_hoang': {
    entityId: 'person_nguyen_hoang',
    canonicalName: 'Nguyễn Hoàng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Chúa Tiên', 'Đoan Quốc Công'],
    timeRange: { start: 1525, end: 1613 },
    dynasty: 'Chúa Nguyễn',
  },
  'person_dao_duy_tu': {
    entityId: 'person_dao_duy_tu',
    canonicalName: 'Đào Duy Từ',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lộc Khê hầu'],
    timeRange: { start: 1572, end: 1634 },
    dynasty: 'Chúa Nguyễn',
  },
  'person_gia_long': {
    entityId: 'person_gia_long',
    canonicalName: 'Gia Long',
    type: 'HISTORICAL_PERSON',
    aliases: ['Nguyễn Ánh', 'Vua Gia Long', 'Gia Long Hoàng Đế'],
    timeRange: { start: 1762, end: 1820 },
    dynasty: 'Nhà Nguyễn',
  },
  'person_minh_mang': {
    entityId: 'person_minh_mang',
    canonicalName: 'Minh Mạng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Nguyễn Phúc Đảm', 'Vua Minh Mạng', 'Minh Mệnh'],
    timeRange: { start: 1791, end: 1841 },
    dynasty: 'Nhà Nguyễn',
  },
  'person_pham_van_dong': {
    entityId: 'person_pham_van_dong',
    canonicalName: 'Phạm Văn Đồng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thủ tướng Phạm Văn Đồng', 'Anh Tô'],
    timeRange: { start: 1906, end: 2000 },
    dynasty: 'Thời kỳ Hiện đại',
  },
  'person_lieu_thang': {
    entityId: 'person_lieu_thang',
    canonicalName: 'Liễu Thăng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tổng binh Liễu Thăng'],
    timeRange: { start: 1370, end: 1427 },
    dynasty: 'Nhà Minh',
  },
  'person_mai_thuc_loan': {
    entityId: 'person_mai_thuc_loan',
    canonicalName: 'Mai Thúc Loan',
    type: 'HISTORICAL_PERSON',
    aliases: ['Mai Hắc Đế', 'Vua Mai Hắc Đế'],
    timeRange: { start: 670, end: 722 },
    dynasty: 'Thời kỳ Bắc thuộc',
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
  if (/\b(trận|chiến dịch|cuộc khởi nghĩa|khởi nghĩa|biến cố|hội nghị|hội thề|sáng lập|dựng nước|chiến thắng|đại thắng|dẹp loạn)\b/.test(norm)) {
    return 'EVENT_BATTLE';
  }
  if (/\b(sông|núi|ải|thành|đô|trấn|phủ|huyện|tỉnh|làng|xã|đàng|đông kinh|đông quan|thăng long|hà nội|phong châu|mê linh|hát môn|luy lâu|phú xuân|mường thanh|ngọc hồi|đống đa|chi lăng|xương giang|bạch đằng|như nguyệt|cổ loa|tây đô|hoa lư|huế|sài gòn|gia định)\b/.test(norm)) {
    return 'LOCATION';
  }
  if (/\b(triều|nhà|thời|kỷ|kỷ nguyên|hồng bàng|văn lang|âu lạc|vạn xuân|đại cồ việt|đông sơn)\b/.test(norm)) {
    return 'DYNASTY_ERA';
  }
  if (/\b(quân|hội|viện|quán|đoàn|tập đoàn|triều đình|tây sơn)\b/.test(norm)) {
    return 'ORGANIZATION';
  }
  if (/\b(bia|sắc|ấn|trống|vũ khí|bảo vật|thần khí|nỏ)\b/.test(norm)) {
    return 'ARTIFACT';
  }
  if (/\b(sử|bình|hịch|chiếu|cáo|thư|quyển|bản kỷ|tập|tác phẩm|luật|hiệp định)\b/.test(norm)) {
    return 'DOCUMENT_CULTURE';
  }
  return 'HISTORICAL_PERSON';
}

  const DYNASTY_DICTIONARY: Record<string, { entityId: string; canonicalName: string; aliases: string[] }> = {
    'dynasty_nam_han': { entityId: 'dynasty_nam_han', canonicalName: 'Nam Hán', aliases: ['quân Nam Hán', 'Nam Hán'] },
    'dynasty_tong': { entityId: 'dynasty_tong', canonicalName: 'Nhà Tống', aliases: ['quân Tống', 'nhà Tống', 'triều Tống'] },
    'dynasty_minh': { entityId: 'dynasty_minh', canonicalName: 'Nhà Minh', aliases: ['quân Minh', 'nhà Minh', 'triều Minh'] },
    'dynasty_thanh': { entityId: 'dynasty_thanh', canonicalName: 'Nhà Thanh', aliases: ['quân Mãn Thanh', 'quân Thanh', 'nhà Thanh', 'triều Thanh'] },
    'dynasty_nguyen_mong': { entityId: 'dynasty_nguyen_mong', canonicalName: 'Quân Nguyên Mông', aliases: ['quân Nguyên Mông', 'quân Mông Cổ', 'quân Nguyên'] },
    'dynasty_van_lang': { entityId: 'dynasty_van_lang', canonicalName: 'Văn Lang', aliases: ['nhà nước Văn Lang', 'Văn Lang'] },
    'dynasty_au_lac': { entityId: 'dynasty_au_lac', canonicalName: 'Âu Lạc', aliases: ['nhà nước Âu Lạc', 'Âu Lạc'] },
    'dynasty_van_xuan': { entityId: 'dynasty_van_xuan', canonicalName: 'Vạn Xuân', aliases: ['nhà nước Vạn Xuân', 'Vạn Xuân'] },
    'dynasty_dai_co_viet': { entityId: 'dynasty_dai_co_viet', canonicalName: 'Đại Cồ Việt', aliases: ['nhà nước Đại Cồ Việt', 'Đại Cồ Việt'] },
    'dynasty_dai_viet': { entityId: 'dynasty_dai_viet', canonicalName: 'Đại Việt', aliases: ['nước Đại Việt', 'Đại Việt'] },
    'dynasty_dai_nam': { entityId: 'dynasty_dai_nam', canonicalName: 'Đại Nam', aliases: ['nước Đại Nam', 'Đại Nam'] },
    'dynasty_tay_son': { entityId: 'dynasty_tay_son', canonicalName: 'Nhà Tây Sơn', aliases: ['Tây Sơn', 'nhà Tây Sơn', 'triều Tây Sơn'] },
  };

// Pre-computed O(1) In-Memory Lookup Index for Entity Resolution
const FAST_ENTITY_MAP = new Map<string, EntityAliasMapping>();

function initFastEntityMap(): void {
  function register(alias: string, canonicalId: string, canonicalName: string) {
    const mapping: EntityAliasMapping = { alias, canonicalId, canonicalName };
    const norm = normalizeKey(alias);
    if (norm) {
      FAST_ENTITY_MAP.set(norm, mapping);
      const unaccented = norm.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
      if (unaccented && unaccented.length >= 3) {
        FAST_ENTITY_MAP.set(unaccented, mapping);
      }
    }
  }

  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    register(person.canonicalName, person.entityId, person.canonicalName);
    for (const alias of person.aliases) {
      register(alias, person.entityId, person.canonicalName);
    }
  }

  for (const dyn of Object.values(DYNASTY_DICTIONARY)) {
    register(dyn.canonicalName, dyn.entityId, dyn.canonicalName);
    for (const alias of dyn.aliases) {
      register(alias, dyn.entityId, dyn.canonicalName);
    }
  }

  for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    register(loc.canonicalName, loc.entityId, loc.canonicalName);
    const stripped = loc.canonicalName.replace(/^(thành|sông|núi|ải|phủ|đồn|xứ|cố đô|kinh đô|kinh thành|tỉnh)\s+/i, '');
    if (stripped !== loc.canonicalName) {
      register(stripped, loc.entityId, loc.canonicalName);
    }
    for (const alias of loc.aliases) {
      register(alias, loc.entityId, loc.canonicalName);
      const strippedAlias = alias.replace(/^(thành|sông|núi|ải|phủ|đồn|xứ|cố đô|kinh đô|kinh thành|tỉnh)\s+/i, '');
      if (strippedAlias !== alias) {
        register(strippedAlias, loc.entityId, loc.canonicalName);
      }
    }
  }

  const CORE_EVENTS: Array<{ id: string; name: string; aliases: string[] }> = [
    { id: 'event_dung_nuoc_van_lang', name: 'Sáng lập nhà nước Văn Lang', aliases: ['Dựng nước Văn Lang', 'Sáng lập Văn Lang'] },
    { id: 'event_khoi_nghia_hai_ba_trung', name: 'Khởi nghĩa Hai Bà Trưng', aliases: ['Khởi nghĩa Mê Linh'] },
    { id: 'event_khoi_nghia_ba_trieu', name: 'Khởi nghĩa Bà Triệu', aliases: [] },
    { id: 'event_khoi_nghia_ly_bi', name: 'Khởi nghĩa Lý Bí', aliases: ['Khởi nghĩa Vạn Xuân'] },
    { id: 'event_bach_dang_938', name: 'Chiến thắng Bạch Đằng năm 938', aliases: ['Trận Bạch Đằng (938)', 'Trận Bạch Đằng năm 938', 'Chiến thắng Bạch Đằng 938', 'Trận Bạch Đằng 938'] },
    { id: 'event_bach_dang_981', name: 'Trận Bạch Đằng năm 981', aliases: ['Trận Bạch Đằng (981)', 'Chiến thắng Bạch Đằng 981', 'Trận Bạch Đằng 981'] },
    { id: 'event_bach_dang_1288', name: 'Trận Bạch Đằng năm 1288', aliases: ['Trận Bạch Đằng (1288)', 'Chiến thắng Bạch Đằng 1288', 'Đại thắng Bạch Đằng 1288', 'Trận Bạch Đằng 1288'] },
    { id: 'event_dep_loan_12_su_quan', name: 'Dẹp loạn 12 sứ quân', aliases: [] },
    { id: 'event_khoi_nghia_lam_son', name: 'Khởi nghĩa Lam Sơn', aliases: [] },
    { id: 'event_chi_lang_xuong_giang', name: 'Chiến dịch Chi Lăng - Xương Giang', aliases: ['Trận Chi Lăng - Xương Giang', 'Chi Lăng - Xương Giang'] },
    { id: 'event_hoi_the_dong_quan', name: 'Hội thề Đông Quan', aliases: [] },
    { id: 'event_ngoc_hoi_dong_da', name: 'Trận Ngọc Hồi - Đống Đa', aliases: ['Chiến thắng Ngọc Hồi - Đống Đa', 'Đại thắng Ngọc Hồi - Đống Đa', 'Ngọc Hồi - Đống Đa'] },
    { id: 'event_dien_bien_phu', name: 'Chiến dịch Điện Biên Phủ', aliases: ['Trận Điện Biên Phủ', 'Điện Biên Phủ'] },
    { id: 'event_bien_gioi_1950', name: 'Chiến dịch Biên giới Thu Đông 1950', aliases: ['Chiến dịch Biên giới 1950', 'Chiến dịch Biên giới'] },
    { id: 'event_ho_chi_minh', name: 'Chiến dịch Hồ Chí Minh', aliases: [] },
    { id: 'event_dien_hong', name: 'Hội nghị Diên Hồng', aliases: [] },
    { id: 'event_binh_than', name: 'Hội nghị Bình Than', aliases: [] },
  ];

  for (const ev of CORE_EVENTS) {
    register(ev.name, ev.id, ev.name);
    for (const al of ev.aliases) {
      register(al, ev.id, ev.name);
    }
  }

  const CORE_ARTIFACTS: Array<{ id: string; name: string; aliases: string[] }> = [
    { id: 'artifact_trong_dong_dong_son', name: 'Trống đồng Đông Sơn', aliases: ['Trống đồng Ngọc Lũ', 'Trống đồng Sông Đà', 'Trống đồng Hoàng Hạ'] },
    { id: 'artifact_no_lien_chau', name: 'Nỏ Liên Châu', aliases: ['Nỏ thần', 'Nỏ thần Liên Châu'] },
    { id: 'artifact_thong_bao_hoi_sao', name: 'Thông Bảo Hội Sao', aliases: [] },
    { id: 'artifact_xe_tang_390', name: 'Xe tăng 390', aliases: [] },
  ];

  for (const art of CORE_ARTIFACTS) {
    register(art.name, art.id, art.name);
    for (const al of art.aliases) {
      register(al, art.id, art.name);
    }
  }

  const CORE_DOCS: Array<{ id: string; name: string; aliases: string[] }> = [
    { id: 'doc_chieu_doi_do', name: 'Chiếu dời đô', aliases: [] },
    { id: 'doc_hich_tuong_si', name: 'Hịch tướng sĩ', aliases: [] },
    { id: 'doc_binh_ngo_dai_cao', name: 'Bình Ngô đại cáo', aliases: [] },
    { id: 'doc_tuyen_ngon_doc_lap', name: 'Tuyên ngôn Độc lập', aliases: [] },
    { id: 'doc_nam_quoc_son_ha', name: 'Nam quốc sơn hà', aliases: [] },
    { id: 'doc_luat_hong_duc', name: 'Luật Hồng Đức', aliases: ['Quốc triều hình luật'] },
    { id: 'doc_dai_viet_su_ky_toan_thu', name: 'Đại Việt sử ký toàn thư', aliases: ['Toàn Thư', 'Đại Việt Sử Ký'] },
    { id: 'doc_dai_nam_thuc_luc', name: 'Đại Nam thực lục', aliases: [] },
  ];

  for (const d of CORE_DOCS) {
    register(d.name, d.id, d.name);
    for (const al of d.aliases) {
      register(al, d.id, d.name);
    }
  }

  // Explicit Special Guards
  register('Tây Sơn Vương', 'person_nguyen_nhac', 'Nguyễn Nhạc');
  register('Tay Son Vuong', 'person_nguyen_nhac', 'Nguyễn Nhạc');
}

initFastEntityMap();

/**
 * Resolves any person or entity alias to an EntityAliasMapping
 */
export function resolveEntityAlias(aliasOrName: string, entityType?: string): EntityAliasMapping {
  const effectiveType = entityType || inferEntityTypeFromName(aliasOrName);
  const normInput = normalizeKey(aliasOrName);
  const unaccentedNormInput = normInput
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');

  // 1. O(1) Fast Map Lookup
  const directMatch = FAST_ENTITY_MAP.get(normInput) || FAST_ENTITY_MAP.get(unaccentedNormInput);
  if (directMatch) {
    return directMatch;
  }

  const strippedNorm = normInput.replace(/^(thành|sông|núi|ải|phủ|đồn|xứ|cố đô|kinh đô|kinh thành|tỉnh)\s+/, '');
  const unaccentedStrippedNorm = strippedNorm.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
  const strippedMatch = FAST_ENTITY_MAP.get(strippedNorm) || FAST_ENTITY_MAP.get(unaccentedStrippedNorm);
  if (strippedMatch) {
    return strippedMatch;
  }

  // 2. Honorific & Title Stripping (Vua, Hoàng đế, Thái sư, Tướng quân, Đức Thánh, Chúa, Đại tướng...)
  const strippedHonorific = normInput.replace(/^(vua|hoàng\s*đế|thái\s*sư|tướng\s*quân|đức\s*thánh|đại\s*vương|chúa|thượng\s*hoàng|thái\s*úy|tổng\s*binh|đại\s*tướng|thủ\s*tướng|anh\s*hùng)\s+/, '');
  const unaccentedStrippedHonorific = strippedHonorific.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
  const honorificMatch = FAST_ENTITY_MAP.get(strippedHonorific) || FAST_ENTITY_MAP.get(unaccentedStrippedHonorific);
  if (honorificMatch) {
    return honorificMatch;
  }

  // Fallback for unknown entity with canonical prefix & ASCII slug
  const slug = aliasOrName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
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
  const unaccented = norm.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');

  if (FAST_ENTITY_MAP.has(norm) || (unaccented.length >= 3 && FAST_ENTITY_MAP.has(unaccented))) {
    return true;
  }

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

  // Check valid canonical ontology entity IDs
  if (/^(person_|loc_|event_|dynasty_|org_|artifact_|doc_|epoch_)[a-z0-9_]+$/.test(nameOrId)) {
    return true;
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

