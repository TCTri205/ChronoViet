/**
 * Historical Entity Mapper: Location Temporal Mapping (SAME_AS_LOCATION) & Character Alias Resolution (ALIAS_OF)
 */

import { EntityAliasMapping, HistoricalLocationMapping } from './interfaces.js';
import { getCanonicalEntityIdPrefix, EntityType } from './schema.js';
import {
  DEITY_TITLE_MAPPINGS,
  REIGN_ERA_DICTIONARY,
  VIETNAMESE_PROVINCES_AND_ADMIN_UNITS,
  HISTORICAL_CHRONOLOGY,
} from './dictionaries.js';


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
  'bom hạt nhân',
  'năng lượng nguyên tử',
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
  'person_kinh_duong_vuong': {
    entityId: 'person_kinh_duong_vuong',
    canonicalName: 'Kinh Dương Vương',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lộc Tục', 'Vua Kinh Dương Vương'],
    timeRange: { start: -2879, end: -2793 },
    dynasty: 'Hồng Bàng',
  },
  'person_lac_long_quan': {
    entityId: 'person_lac_long_quan',
    canonicalName: 'Lạc Long Quân',
    type: 'HISTORICAL_PERSON',
    aliases: ['Sùng Lãm', 'Bố Lạc Long Quân'],
    timeRange: { start: -2793, end: -2524 },
    dynasty: 'Hồng Bàng',
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
    aliases: ['Lê Thái Tổ', 'Bình Định Vương', 'Vua Lê Lợi', 'Thái Tổ Hoàng đế'],
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
    aliases: ['Lý Công Uẩn', 'Vua Lý Thái Tổ', 'Thái Tổ Hoàng đế'],
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
    timeRange: { start: -2524, end: -258 },
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
  'person_ly_nam_de': {
    entityId: 'person_ly_nam_de',
    canonicalName: 'Lý Nam Đế',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lý Bí', 'Vua Lý Nam Đế'],
    timeRange: { start: 503, end: 548 },
    dynasty: 'Nhà Tiền Lý / Vạn Xuân',
  },
  'person_trieu_da': {
    entityId: 'person_trieu_da',
    canonicalName: 'Triệu Đà',
    type: 'HISTORICAL_PERSON',
    aliases: ['Triệu Vũ Đế'],
    timeRange: { start: -257, end: -137 },
    dynasty: 'Nhà Triệu',
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
  'person_ho_chi_minh': {
    entityId: 'person_ho_chi_minh',
    canonicalName: 'Hồ Chí Minh',
    type: 'HISTORICAL_PERSON',
    aliases: ['Bác Hồ', 'Nguyễn Ái Quốc', 'Nguyễn Tất Thành', 'Chủ tịch Hồ Chí Minh', 'Cụ Hồ'],
    timeRange: { start: 1890, end: 1969 },
    dynasty: 'Thời kỳ Hiện đại',
  },
  'person_tran_thu_do': {
    entityId: 'person_tran_thu_do',
    canonicalName: 'Trần Thủ Độ',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thái sư Trần Thủ Độ'],
    timeRange: { start: 1194, end: 1264 },
    dynasty: 'Nhà Trần',
  },
  'person_tran_thai_tong': {
    entityId: 'person_tran_thai_tong',
    canonicalName: 'Trần Thái Tông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Trần Cảnh', 'Vua Trần Thái Tông'],
    timeRange: { start: 1218, end: 1277 },
    dynasty: 'Nhà Trần',
  },
  'person_tran_thanh_tong': {
    entityId: 'person_tran_thanh_tong',
    canonicalName: 'Trần Thánh Tông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Trần Hoảng', 'Vua Trần Thánh Tông'],
    timeRange: { start: 1240, end: 1290 },
    dynasty: 'Nhà Trần',
  },
  'person_phan_boi_chau': {
    entityId: 'person_phan_boi_chau',
    canonicalName: 'Phan Bội Châu',
    type: 'HISTORICAL_PERSON',
    aliases: ['Sào Nam', 'Cụ Phan Bội Châu'],
    timeRange: { start: 1867, end: 1940 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_phan_chau_trinh': {
    entityId: 'person_phan_chau_trinh',
    canonicalName: 'Phan Châu Trinh',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tây Hồ', 'Cụ Phan Châu Trinh'],
    timeRange: { start: 1872, end: 1926 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_hoang_hoa_tham': {
    entityId: 'person_hoang_hoa_tham',
    canonicalName: 'Hoàng Hoa Thám',
    type: 'HISTORICAL_PERSON',
    aliases: ['Đề Thám', 'Hùm xám Yên Thế'],
    timeRange: { start: 1858, end: 1913 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_le_thanh_tong': {
    entityId: 'person_le_thanh_tong',
    canonicalName: 'Lê Thánh Tông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Tư Thành', 'Vua Lê Thánh Tông'],
    timeRange: { start: 1442, end: 1497 },
    dynasty: 'Nhà Hậu Lê',
  },
  'person_chu_van_an': {
    entityId: 'person_chu_van_an',
    canonicalName: 'Chu Văn An',
    type: 'HISTORICAL_PERSON',
    aliases: ['Vạn Thế Sư Biểu', 'Tiều Ẩn'],
    timeRange: { start: 1292, end: 1370 },
    dynasty: 'Nhà Trần',
  },
  'person_trieu_quang_phuc': {
    entityId: 'person_trieu_quang_phuc',
    canonicalName: 'Triệu Quang Phục',
    type: 'HISTORICAL_PERSON',
    aliases: ['Dạ Trạch Vương', 'Triệu Việt Vương', 'Vua Triệu Việt Vương'],
    timeRange: { start: 548, end: 571 },
    dynasty: 'Vạn Xuân',
  },
  'person_khuc_thua_du': {
    entityId: 'person_khuc_thua_du',
    canonicalName: 'Khúc Thừa Dụ',
    type: 'HISTORICAL_PERSON',
    aliases: ['Khúc Tiên Chủ', 'Tiết độ sứ Khúc Thừa Dụ'],
    timeRange: { start: 830, end: 907 },
    dynasty: 'Thời kỳ Tự chủ',
  },
  'person_van_tien_dung': {
    entityId: 'person_van_tien_dung',
    canonicalName: 'Văn Tiến Dũng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Đại tướng Văn Tiến Dũng'],
    timeRange: { start: 1917, end: 2002 },
    dynasty: 'Thời kỳ Hiện đại',
  },
  'person_tran_quoc_toan': {
    entityId: 'person_tran_quoc_toan',
    canonicalName: 'Trần Quốc Toản',
    type: 'HISTORICAL_PERSON',
    aliases: ['Hoài Văn Hầu', 'Hoài Văn Hầu Trần Quốc Toản'],
    timeRange: { start: 1267, end: 1285 },
    dynasty: 'Nhà Trần',
  },
  'person_ly_thanh_tong': {
    entityId: 'person_ly_thanh_tong',
    canonicalName: 'Lý Thánh Tông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lý Nhật Tôn', 'Vua Lý Thánh Tông'],
    timeRange: { start: 1023, end: 1072 },
    dynasty: 'Nhà Lý',
  },
  'person_le_trang_tong': {
    entityId: 'person_le_trang_tong',
    canonicalName: 'Lê Trang Tông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Duy Ninh', 'Chúa Chổm', 'Vua Lê Trang Tông'],
    timeRange: { start: 1515, end: 1548 },
    dynasty: 'Lê Trung Hưng',
  },
  'person_nguyen_lu': {
    entityId: 'person_nguyen_lu',
    canonicalName: 'Nguyễn Lữ',
    type: 'HISTORICAL_PERSON',
    aliases: ['Đông Định Vương'],
    timeRange: { start: 1754, end: 1787 },
    dynasty: 'Nhà Tây Sơn',
  },
  'person_vuong_thong': {
    entityId: 'person_vuong_thong',
    canonicalName: 'Vương Thông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tổng binh Vương Thông'],
    timeRange: { start: 1390, end: 1452 },
    dynasty: 'Nhà Minh',
  },
  'person_nguyen_tri_phuong': {
    entityId: 'person_nguyen_tri_phuong',
    canonicalName: 'Nguyễn Tri Phương',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 1800, end: 1873 },
    dynasty: 'Nhà Nguyễn',
  },
  'person_truong_dinh': {
    entityId: 'person_truong_dinh',
    canonicalName: 'Trương Định',
    type: 'HISTORICAL_PERSON',
    aliases: ['Bình Tây Đại Nguyên Soái'],
    timeRange: { start: 1820, end: 1864 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_ton_that_thuyet': {
    entityId: 'person_ton_that_thuyet',
    canonicalName: 'Tôn Thất Thuyết',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 1839, end: 1913 },
    dynasty: 'Nhà Nguyễn',
  },
  'person_nguyen_thi_dinh': {
    entityId: 'person_nguyen_thi_dinh',
    canonicalName: 'Nguyễn Thị Định',
    type: 'HISTORICAL_PERSON',
    aliases: ['Nữ tướng Nguyễn Thị Định', 'Cô Ba Định'],
    timeRange: { start: 1920, end: 1992 },
    dynasty: 'Thời kỳ Hiện đại',
  },
  'person_nguyen_binh_khiem': {
    entityId: 'person_nguyen_binh_khiem',
    canonicalName: 'Nguyễn Bỉnh Khiêm',
    type: 'HISTORICAL_PERSON',
    aliases: ['Trạng Trình', 'Trạng Trình Nguyễn Bỉnh Khiêm'],
    timeRange: { start: 1491, end: 1585 },
    dynasty: 'Nhà Mạc',
  },
  'person_nguyen_thai_hoc': {
    entityId: 'person_nguyen_thai_hoc',
    canonicalName: 'Nguyễn Thái Học',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 1902, end: 1930 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_trinh_kiem': {
    entityId: 'person_trinh_kiem',
    canonicalName: 'Trịnh Kiểm',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thế Tổ Minh Khang Thái Vương'],
    timeRange: { start: 1503, end: 1570 },
    dynasty: 'Chúa Trịnh',
  },
  'person_bui_thi_xuan': {
    entityId: 'person_bui_thi_xuan',
    canonicalName: 'Bùi Thị Xuân',
    type: 'HISTORICAL_PERSON',
    aliases: ['Nữ tướng Bùi Thị Xuân', 'Đô đốc Bùi Thị Xuân'],
    timeRange: { start: 1752, end: 1802 },
    dynasty: 'Nhà Tây Sơn',
  },
  'person_ham_nghi': {
    entityId: 'person_ham_nghi',
    canonicalName: 'Hàm Nghi',
    type: 'HISTORICAL_PERSON',
    aliases: ['Vua Hàm Nghi', 'Ưng Lịch'],
    timeRange: { start: 1871, end: 1944 },
    dynasty: 'Nhà Nguyễn',
  },
  'person_khuc_hao': {
    entityId: 'person_khuc_hao',
    canonicalName: 'Khúc Hạo',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 860, end: 917 },
    dynasty: 'Thời kỳ Tự chủ',
  },
  'person_y_lan': {
    entityId: 'person_y_lan',
    canonicalName: 'Ỷ Lan',
    type: 'HISTORICAL_PERSON',
    aliases: ['Linh Nhân Hoàng thái hậu', 'Hoàng thái hậu Ỷ Lan'],
    timeRange: { start: 1044, end: 1117 },
    dynasty: 'Nhà Lý',
  },
  'person_than_nhan_trung': {
    entityId: 'person_than_nhan_trung',
    canonicalName: 'Thân Nhân Trung',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 1419, end: 1499 },
    dynasty: 'Nhà Lê Sơ',
  },
  'person_ngo_thi_nham': {
    entityId: 'person_ngo_thi_nham',
    canonicalName: 'Ngô Thì Nhậm',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 1746, end: 1803 },
    dynasty: 'Nhà Tây Sơn',
  },
  'person_ngo_van_so': {
    entityId: 'person_ngo_van_so',
    canonicalName: 'Ngô Văn Sở',
    type: 'HISTORICAL_PERSON',
    aliases: ['Đại tư mã Ngô Văn Sở'],
    timeRange: { start: 1750, end: 1795 },
    dynasty: 'Nhà Tây Sơn',
  },
  'person_nguyen_trung_truc': {
    entityId: 'person_nguyen_trung_truc',
    canonicalName: 'Nguyễn Trung Trực',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 1838, end: 1868 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_dinh_cong_trang': {
    entityId: 'person_dinh_cong_trang',
    canonicalName: 'Đinh Công Tráng',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 1842, end: 1887 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_phan_dinh_phung': {
    entityId: 'person_phan_dinh_phung',
    canonicalName: 'Phan Đình Phùng',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 1847, end: 1896 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_luong_van_can': {
    entityId: 'person_luong_van_can',
    canonicalName: 'Lương Văn Can',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 1854, end: 1927 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_vo_van_kiet': {
    entityId: 'person_vo_van_kiet',
    canonicalName: 'Võ Văn Kiệt',
    type: 'HISTORICAL_PERSON',
    aliases: ['Sáu Dân', 'Thủ tướng Võ Văn Kiệt'],
    timeRange: { start: 1922, end: 2008 },
    dynasty: 'Thời kỳ Hiện đại',
  },
  'person_duong_dinh_nghe': {
    entityId: 'person_duong_dinh_nghe',
    canonicalName: 'Dương Đình Nghệ',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 874, end: 937 },
    dynasty: 'Thời kỳ Tự chủ',
  },
  'person_le_lai': {
    entityId: 'person_le_lai',
    canonicalName: 'Lê Lai',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lê Lai cứu chúa'],
    timeRange: { start: 1390, end: 1419 },
    dynasty: 'Nhà Hậu Lê / Lam Sơn',
  },
  'person_ngo_si_lien': {
    entityId: 'person_ngo_si_lien',
    canonicalName: 'Ngô Sĩ Liên',
    type: 'HISTORICAL_PERSON',
    aliases: ['Sử thần Ngô Sĩ Liên'],
    timeRange: { start: 1400, end: 1498 },
    dynasty: 'Nhà Hậu Lê',
  },
  'person_phung_hung': {
    entityId: 'person_phung_hung',
    canonicalName: 'Phùng Hưng',
    type: 'HISTORICAL_PERSON',
    aliases: ['Bố Cái Đại Vương', 'Bố Cái Đại Vương Phùng Hưng'],
    timeRange: { start: 761, end: 802 },
    dynasty: 'Thời kỳ Bắc thuộc',
  },
  'person_mac_dinh_chi': {
    entityId: 'person_mac_dinh_chi',
    canonicalName: 'Mạc Đĩnh Chi',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lưỡng quốc Trạng nguyên', 'Lưỡng quốc Trạng nguyên Mạc Đĩnh Chi'],
    timeRange: { start: 1272, end: 1346 },
    dynasty: 'Nhà Trần',
  },
  'person_le_quy_don': {
    entityId: 'person_le_quy_don',
    canonicalName: 'Lê Quý Đôn',
    type: 'HISTORICAL_PERSON',
    aliases: ['Bảng nhãn Lê Quý Đôn', 'Quế Đường'],
    timeRange: { start: 1726, end: 1784 },
    dynasty: 'Nhà Hậu Lê / Thời Lê-Trịnh',
  },
  'person_phung_khac_khoan': {
    entityId: 'person_phung_khac_khoan',
    canonicalName: 'Phùng Khắc Khoan',
    type: 'HISTORICAL_PERSON',
    aliases: ['Trạng Bùng', 'Trạng Bùng Phùng Khắc Khoan'],
    timeRange: { start: 1528, end: 1613 },
    dynasty: 'Nhà Hậu Lê / Thời Lê Trung Hưng',
  },
  'person_nguyen_thiep': {
    entityId: 'person_nguyen_thiep',
    canonicalName: 'Nguyễn Thiếp',
    type: 'HISTORICAL_PERSON',
    aliases: ['La Sơn Phu Tử', 'La Sơn phu tử Nguyễn Thiếp'],
    timeRange: { start: 1723, end: 1804 },
    dynasty: 'Nhà Tây Sơn / Triều Lê Trung Hưng',
  },
  'person_le_van_huu': {
    entityId: 'person_le_van_huu',
    canonicalName: 'Lê Văn Hưu',
    type: 'HISTORICAL_PERSON',
    aliases: ['Sử gia Lê Văn Hưu'],
    timeRange: { start: 1230, end: 1322 },
    dynasty: 'Nhà Trần',
  },
  'person_phan_phu_tien': {
    entityId: 'person_phan_phu_tien',
    canonicalName: 'Phan Phu Tiên',
    type: 'HISTORICAL_PERSON',
    aliases: ['Sử gia Phan Phu Tiên'],
    timeRange: { start: 1370, end: 1460 },
    dynasty: 'Nhà Hậu Lê',
  },
  'person_phap_loa': {
    entityId: 'person_phap_loa',
    canonicalName: 'Pháp Loa',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thiền sư Pháp Loa', 'Đồng Kiên Cương'],
    timeRange: { start: 1284, end: 1330 },
    dynasty: 'Nhà Trần',
  },
  'person_huyen_quang': {
    entityId: 'person_huyen_quang',
    canonicalName: 'Huyền Quang',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thiền sư Huyền Quang', 'Lý Đạo Tái'],
    timeRange: { start: 1254, end: 1334 },
    dynasty: 'Nhà Trần',
  },
  'person_to_dinh': {
    entityId: 'person_to_dinh',
    canonicalName: 'Tô Định',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thái thú Tô Định'],
    timeRange: { start: 0, end: 50 },
    dynasty: 'Thời kỳ Bắc thuộc',
  },
  'person_che_cu': {
    entityId: 'person_che_cu',
    canonicalName: 'Chế Củ',
    type: 'HISTORICAL_PERSON',
    aliases: ['Rudravarman III'],
    timeRange: { start: 1040, end: 1075 },
    dynasty: 'Vương quốc Chăm-pa',
  },
  'person_tran_anh_tong': {
    entityId: 'person_tran_anh_tong',
    canonicalName: 'Trần Anh Tông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Trần Thuyên'],
    timeRange: { start: 1276, end: 1320 },
    dynasty: 'Nhà Trần',
  },
  'person_tran_quang_khai': {
    entityId: 'person_tran_quang_khai',
    canonicalName: 'Trần Quang Khải',
    type: 'HISTORICAL_PERSON',
    aliases: ['Chiêu Minh Đại Vương', 'Chiêu Minh Đại Vương Trần Quang Khải'],
    timeRange: { start: 1241, end: 1294 },
    dynasty: 'Nhà Trần',
  },
  'person_tran_nhat_duat': {
    entityId: 'person_tran_nhat_duat',
    canonicalName: 'Trần Nhật Duật',
    type: 'HISTORICAL_PERSON',
    aliases: ['Chiêu Văn Vương', 'Chiêu Văn Vương Trần Nhật Duật'],
    timeRange: { start: 1255, end: 1330 },
    dynasty: 'Nhà Trần',
  },
  'person_tran_quang_dieu': {
    entityId: 'person_tran_quang_dieu',
    canonicalName: 'Trần Quang Diệu',
    type: 'HISTORICAL_PERSON',
    aliases: ['Đô đốc Trần Quang Diệu'],
    timeRange: { start: 1760, end: 1802 },
    dynasty: 'Nhà Tây Sơn',
  },
  'person_nguyen_thi_binh': {
    entityId: 'person_nguyen_thi_binh',
    canonicalName: 'Nguyễn Thị Bình',
    type: 'HISTORICAL_PERSON',
    aliases: ['Bà Nguyễn Thị Bình'],
    timeRange: { start: 1927, end: 2026 },
    dynasty: 'Việt Nam Dân chủ Cộng hòa',
  },
  'person_nguyen_van_linh': {
    entityId: 'person_nguyen_van_linh',
    canonicalName: 'Nguyễn Văn Linh',
    type: 'HISTORICAL_PERSON',
    aliases: ['Tổng Bí thư Nguyễn Văn Linh'],
    timeRange: { start: 1915, end: 1998 },
    dynasty: 'Cộng hòa Xã hội Chủ nghĩa Việt Nam',
  },
  'person_de_castries': {
    entityId: 'person_de_castries',
    canonicalName: 'Christian de Castries',
    type: 'HISTORICAL_PERSON',
    aliases: ['De Castries', 'tướng De Castries', 'Đờ Cát', 'tướng Đờ Cát'],
    timeRange: { start: 1902, end: 1991 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_cao_thang': {
    entityId: 'person_cao_thang',
    canonicalName: 'Cao Thắng',
    type: 'HISTORICAL_PERSON',
    aliases: [],
    timeRange: { start: 1864, end: 1893 },
    dynasty: 'Thời kỳ Pháp thuộc',
  },
  'person_ly_thai_tong': {
    entityId: 'person_ly_thai_tong',
    canonicalName: 'Lý Thái Tông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lý Phật Mã', 'Vua Lý Thái Tông', 'Thái tử Lý Phật Mã', 'Phật Mã'],
    timeRange: { start: 1000, end: 1054 },
    dynasty: 'Nhà Lý',
  },
  'person_ly_nhan_tong': {
    entityId: 'person_ly_nhan_tong',
    canonicalName: 'Lý Nhân Tông',
    type: 'HISTORICAL_PERSON',
    aliases: ['Lý Càn Đức', 'Vua Lý Nhân Tông'],
    timeRange: { start: 1066, end: 1127 },
    dynasty: 'Nhà Lý',
  },
  'person_van_hanh': {
    entityId: 'person_van_hanh',
    canonicalName: 'Vạn Hạnh',
    type: 'HISTORICAL_PERSON',
    aliases: ['Thiền sư Vạn Hạnh', 'Quốc sư Vạn Hạnh', 'Sư Vạn Hạnh'],
    timeRange: { start: 938, end: 1018 },
    dynasty: 'Nhà Lý',
  },
  'person_dinh_lien': {
    entityId: 'person_dinh_lien',
    canonicalName: 'Đinh Liễn',
    type: 'HISTORICAL_PERSON',
    aliases: ['Nam Việt Vương', 'Nam Việt Vương Đinh Liễn', 'Đinh Khuông Liễn'],
    timeRange: { start: 940, end: 979 },
    dynasty: 'Nhà Đinh',
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
  {
    historicalName: 'Đông Bộ Đầu',
    canonicalModernName: 'Hà Nội',
    dynasty: 'Nhà Trần',
    timeRange: { start: 1225, end: 1400 },
  },
  {
    historicalName: 'Bắc Thành',
    canonicalModernName: 'Hà Nội',
    dynasty: 'Nhà Nguyễn',
    timeRange: { start: 1802, end: 1831 },
  },
  {
    historicalName: 'Gia Định Thành',
    canonicalModernName: 'Thành phố Hồ Chí Minh',
    dynasty: 'Nhà Nguyễn',
    timeRange: { start: 1802, end: 1832 },
  },
  {
    historicalName: 'phủ Thừa Thiên',
    canonicalModernName: 'Huế',
    dynasty: 'Nhà Nguyễn',
    timeRange: { start: 1802, end: 1945 },
  },
  {
    historicalName: 'thành Quy Nhơn',
    canonicalModernName: 'Bình Định',
    dynasty: 'Tây Sơn / Nhà Nguyễn',
    timeRange: { start: 1778, end: 1802 },
  },
  {
    historicalName: 'Quy Nhơn',
    canonicalModernName: 'Bình Định',
    dynasty: 'Tây Sơn / Nhà Nguyễn',
    timeRange: { start: 1778, end: 1802 },
  },
  {
    historicalName: 'Tây Đô',
    canonicalModernName: 'Thanh Hóa',
    dynasty: 'Nhà Hồ',
    timeRange: { start: 1397, end: 1407 },
  },
  {
    historicalName: 'Yên Kinh',
    canonicalModernName: 'Bắc Kinh',
    dynasty: 'Nhà Nguyên / Nhà Minh / Nhà Thanh',
    timeRange: { start: 1271, end: 1912 },
  },
  {
    historicalName: 'Hoan Châu',
    canonicalModernName: 'Nghệ An',
    dynasty: 'Bắc thuộc / Nhà Đinh / Tiền Lê',
    timeRange: { start: 602, end: 1010 },
  },
  {
    historicalName: 'Phú Điền',
    canonicalModernName: 'Thanh Hóa',
    dynasty: 'Bắc thuộc lần 2',
    timeRange: { start: 248, end: 248 },
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
    aliases: ['thành phố Hà Nội', 'Hà Thành', 'Bắc Thành'],
  },
  'loc_thang_long': {
    entityId: 'loc_thang_long',
    canonicalName: 'Thăng Long',
    type: 'LOCATION',
    aliases: ['kinh đô Thăng Long', 'hoàng thành Thăng Long', 'Đông Đô', 'Kinh Kỳ', 'Đại La', 'thành Đại La'],
  },
  'loc_dong_kinh': {
    entityId: 'loc_dong_kinh',
    canonicalName: 'Đông Kinh',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_dong_quan': {
    entityId: 'loc_dong_quan',
    canonicalName: 'Đông Quan',
    type: 'LOCATION',
    aliases: ['thành Đông Quan'],
  },
  'loc_tong_binh': {
    entityId: 'loc_tong_binh',
    canonicalName: 'phủ Tống Bình',
    type: 'LOCATION',
    aliases: ['Tống Bình'],
  },
  'loc_hoa_lu': {
    entityId: 'loc_hoa_lu',
    canonicalName: 'Hoa Lư',
    type: 'LOCATION',
    aliases: ['cố đô Hoa Lư', 'Cố đô Hoa Lư', 'kinh đô Hoa Lư'],
  },
  'loc_phu_xuan': {
    entityId: 'loc_phu_xuan',
    canonicalName: 'thành Phú Xuân',
    type: 'LOCATION',
    aliases: ['Phú Xuân', 'kinh thành Phú Xuân'],
  },
  'loc_sai_gon': {
    entityId: 'loc_sai_gon',
    canonicalName: 'Sài Gòn',
    type: 'LOCATION',
    aliases: ['Gia Định', 'Gia Định Thành'],
  },
  'loc_quy_nhon': {
    entityId: 'loc_quy_nhon',
    canonicalName: 'Quy Nhơn',
    type: 'LOCATION',
    aliases: ['thành Quy Nhơn', 'Thành Quy Nhơn'],
  },
  'loc_phong_chau': {
    entityId: 'loc_phong_chau',
    canonicalName: 'Phong Châu',
    type: 'LOCATION',
    aliases: ['kinh đô Phong Châu'],
  },
  'loc_hue': {
    entityId: 'loc_hue',
    canonicalName: 'Huế',
    type: 'LOCATION',
    aliases: ['thành phố Huế', 'Cố đô Huế'],
  },
  'loc_ho_chi_minh': {
    entityId: 'loc_ho_chi_minh',
    canonicalName: 'Thành phố Hồ Chí Minh',
    type: 'LOCATION',
    aliases: ['TP.HCM', 'TPHCM'],
  },
  'loc_binh_dinh': {
    entityId: 'loc_binh_dinh',
    canonicalName: 'Bình Định',
    type: 'LOCATION',
    aliases: ['tỉnh Bình Định'],
  },
  'loc_thanh_hoa': {
    entityId: 'loc_thanh_hoa',
    canonicalName: 'Thanh Hóa',
    type: 'LOCATION',
    aliases: ['tỉnh Thanh Hóa'],
  },
  'loc_nghe_an': {
    entityId: 'loc_nghe_an',
    canonicalName: 'Nghệ An',
    type: 'LOCATION',
    aliases: ['tỉnh Nghệ An'],
  },
  'loc_bac_kinh': {
    entityId: 'loc_bac_kinh',
    canonicalName: 'Bắc Kinh',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_ninh_binh': {
    entityId: 'loc_ninh_binh',
    canonicalName: 'Ninh Bình',
    type: 'LOCATION',
    aliases: ['tỉnh Ninh Bình'],
  },
  'loc_duong_lam': {
    entityId: 'loc_duong_lam',
    canonicalName: 'Đường Lâm',
    type: 'LOCATION',
    aliases: ['làng Đường Lâm', 'đất hai vua Đường Lâm'],
  },
  'loc_phu_dien': {
    entityId: 'loc_phu_dien',
    canonicalName: 'Phú Điền',
    type: 'LOCATION',
    aliases: ['Căn Cứ Phú Điền', 'căn cứ Phú Điền'],
  },
  'loc_tan_so': {
    entityId: 'loc_tan_so',
    canonicalName: 'Tân Sở',
    type: 'LOCATION',
    aliases: ['căn cứ Tân Sở', 'Căn cứ Tân Sở'],
  },
  'loc_dong_anh': {
    entityId: 'loc_dong_anh',
    canonicalName: 'Đông Anh',
    type: 'LOCATION',
    aliases: ['huyện Đông Anh'],
  },
  'loc_giao_chau': {
    entityId: 'loc_giao_chau',
    canonicalName: 'Giao Châu',
    type: 'LOCATION',
    aliases: ['quận Giao Châu'],
  },
  'loc_hoan_chau': {
    entityId: 'loc_hoan_chau',
    canonicalName: 'Hoan Châu',
    type: 'LOCATION',
    aliases: ['châu Hoan'],
  },
  'loc_mo_cay': {
    entityId: 'loc_mo_cay',
    canonicalName: 'Mỏ Cày',
    type: 'LOCATION',
    aliases: ['huyện Mỏ Cày'],
  },
  'loc_dinh_doc_lap': {
    entityId: 'loc_dinh_doc_lap',
    canonicalName: 'Dinh Độc Lập',
    type: 'LOCATION',
    aliases: ['Hội trường Thống Nhất'],
  },
  'loc_thuy_dien_hoa_binh': {
    entityId: 'loc_thuy_dien_hoa_binh',
    canonicalName: 'Nhà máy Thủy điện Hòa Bình',
    type: 'LOCATION',
    aliases: ['Thủy điện Hòa Bình'],
  },
  'loc_song_da': {
    entityId: 'loc_song_da',
    canonicalName: 'sông Đà',
    type: 'LOCATION',
    aliases: ['Sông Đà'],
  },
  'loc_truong_sa': {
    entityId: 'loc_truong_sa',
    canonicalName: 'quần đảo Trường Sa',
    type: 'LOCATION',
    aliases: ['Trường Sa'],
  },
  'loc_quang_truong_ba_dinh': {
    entityId: 'loc_quang_truong_ba_dinh',
    canonicalName: 'Quảng trường Ba Đình',
    type: 'LOCATION',
    aliases: ['Ba Đình'],
  },
  'loc_duong_truong_son': {
    entityId: 'loc_duong_truong_son',
    canonicalName: 'Đường mòn Hồ Chí Minh',
    type: 'LOCATION',
    aliases: ['Đường Trường Sơn', 'đường Trường Sơn'],
  },
  'loc_viet_bac': {
    entityId: 'loc_viet_bac',
    canonicalName: 'Việt Bắc',
    type: 'LOCATION',
    aliases: ['chiến khu Việt Bắc'],
  },
  'loc_quang_chau': {
    entityId: 'loc_quang_chau',
    canonicalName: 'Quảng Châu',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_phu_thua_thien': {
    entityId: 'loc_phu_thua_thien',
    canonicalName: 'phủ Thừa Thiên',
    type: 'LOCATION',
    aliases: ['Thừa Thiên'],
  },
  'loc_nui_ban': {
    entityId: 'loc_nui_ban',
    canonicalName: 'núi Bân',
    type: 'LOCATION',
    aliases: ['Núi Bân'],
  },
  'loc_song_tien': {
    entityId: 'loc_song_tien',
    canonicalName: 'sông Tiền',
    type: 'LOCATION',
    aliases: ['Sông Tiền'],
  },
  'loc_thuan_hoa': {
    entityId: 'loc_thuan_hoa',
    canonicalName: 'Thuận Hóa',
    type: 'LOCATION',
    aliases: ['xứ Thuận Hóa'],
  },
  'loc_ha_dong': {
    entityId: 'loc_ha_dong',
    canonicalName: 'Hà Đông',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_tan_an': {
    entityId: 'loc_tan_an',
    canonicalName: 'Tân An',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_ai_chi_lang': {
    entityId: 'loc_ai_chi_lang',
    canonicalName: 'ải Chi Lăng',
    type: 'LOCATION',
    aliases: ['Ải Chi Lăng', 'Chi Lăng'],
  },
  'loc_van_mieu_quoc_tu_giam': {
    entityId: 'loc_van_mieu_quoc_tu_giam',
    canonicalName: 'Văn Miếu Quốc Tử Giám',
    type: 'LOCATION',
    aliases: ['Văn Miếu - Quốc Tử Giám', 'Văn Miếu'],
  },
  'loc_thanh_co_loa': {
    entityId: 'loc_thanh_co_loa',
    canonicalName: 'thành Cổ Loa',
    type: 'LOCATION',
    aliases: ['Cổ Loa'],
  },
  'loc_thanh_nha_ho': {
    entityId: 'loc_thanh_nha_ho',
    canonicalName: 'Thành nhà Hồ',
    type: 'LOCATION',
    aliases: ['Thành Tây Đô', 'thành Tây Đô', 'Tây Đô', 'thành nhà Hồ'],
  },
  'loc_tay_do': {
    entityId: 'loc_tay_do',
    canonicalName: 'Tây Đô',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_dien_bien_phu': {
    entityId: 'loc_dien_bien_phu',
    canonicalName: 'Điện Biên Phủ',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_song_bach_dang': {
    entityId: 'loc_song_bach_dang',
    canonicalName: 'sông Bạch Đằng',
    type: 'LOCATION',
    aliases: ['Bạch Đằng'],
  },
  'loc_song_nhu_nguyet': {
    entityId: 'loc_song_nhu_nguyet',
    canonicalName: 'sông Như Nguyệt',
    type: 'LOCATION',
    aliases: ['Như Nguyệt'],
  },
  'loc_song_gianh': {
    entityId: 'loc_song_gianh',
    canonicalName: 'sông Gianh',
    type: 'LOCATION',
    aliases: ['Sông Gianh'],
  },
  'loc_quang_tri': {
    entityId: 'loc_quang_tri',
    canonicalName: 'Quảng Trị',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_quang_binh': {
    entityId: 'loc_quang_binh',
    canonicalName: 'Quảng Bình',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_da_nang': {
    entityId: 'loc_da_nang',
    canonicalName: 'Đà Nẵng',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_go_cong': {
    entityId: 'loc_go_cong',
    canonicalName: 'Gò Công',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_ben_tre': {
    entityId: 'loc_ben_tre',
    canonicalName: 'Bến Tre',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_yen_bai': {
    entityId: 'loc_yen_bai',
    canonicalName: 'Yên Bái',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_yen_tu': {
    entityId: 'loc_yen_tu',
    canonicalName: 'Yên Tử',
    type: 'LOCATION',
    aliases: ['núi Yên Tử', 'Núi Yên Tử'],
  },
  'loc_lam_son': {
    entityId: 'loc_lam_son',
    canonicalName: 'Lam Sơn',
    type: 'LOCATION',
    aliases: ['đất Lam Sơn'],
  },
  'loc_vinh_loc': {
    entityId: 'loc_vinh_loc',
    canonicalName: 'Vĩnh Lộc',
    type: 'LOCATION',
    aliases: ['huyện Vĩnh Lộc'],
  },
  'loc_vinh_an': {
    entityId: 'loc_vinh_an',
    canonicalName: 'Vĩnh An',
    type: 'LOCATION',
    aliases: ['châu Vĩnh An'],
  },
  'loc_bac_ha': {
    entityId: 'loc_bac_ha',
    canonicalName: 'Bắc Hà',
    type: 'LOCATION',
    aliases: ['đất Bắc Hà'],
  },
  'loc_dien_bien': {
    entityId: 'loc_dien_bien',
    canonicalName: 'Điện Biên',
    type: 'LOCATION',
    aliases: ['tỉnh Điện Biên', 'thung lũng Mường Thanh', 'Mường Thanh'],
  },
  'loc_son_tra': {
    entityId: 'loc_son_tra',
    canonicalName: 'bán đảo Sơn Trà',
    type: 'LOCATION',
    aliases: ['Bán đảo Sơn Trà', 'Sơn Trà'],
  },
  'loc_song_ben_hai': {
    entityId: 'loc_song_ben_hai',
    canonicalName: 'sông Bến Hải',
    type: 'LOCATION',
    aliases: ['Sông Bến Hải', 'Bến Hải'],
  },
  'loc_trung_ky': {
    entityId: 'loc_trung_ky',
    canonicalName: 'Trung Kỳ',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_dang_trong': {
    entityId: 'loc_dang_trong',
    canonicalName: 'Đàng Trong',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_dang_ngoai': {
    entityId: 'loc_dang_ngoai',
    canonicalName: 'Đàng Ngoài',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_tay_son': {
    entityId: 'loc_tay_son',
    canonicalName: 'ấp Tây Sơn',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_me_linh': {
    entityId: 'loc_me_linh',
    canonicalName: 'Mê Linh',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_soc_son': {
    entityId: 'loc_soc_son',
    canonicalName: 'núi Sóc Sơn',
    type: 'LOCATION',
    aliases: ['Sóc Sơn', 'núi Sóc'],
  },
  'loc_xu_doai': {
    entityId: 'loc_xu_doai',
    canonicalName: 'xứ Đoài',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_thanh_luy_lau': {
    entityId: 'loc_thanh_luy_lau',
    canonicalName: 'Thành cổ Luy Lâu',
    type: 'LOCATION',
    aliases: ['Luy Lâu', 'thành Luy Lâu'],
  },
  'loc_giao_chi': {
    entityId: 'loc_giao_chi',
    canonicalName: 'Giao Chỉ',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_long_bien': {
    entityId: 'loc_long_bien',
    canonicalName: 'Long Biên',
    type: 'LOCATION',
    aliases: ['thành Long Biên', 'Thành Long Biên'],
  },
  'loc_hat_mon': {
    entityId: 'loc_hat_mon',
    canonicalName: 'cửa sông Hát Môn',
    type: 'LOCATION',
    aliases: ['Hát Môn', 'sông Hát'],
  },
  'loc_dam_da_trach': {
    entityId: 'loc_dam_da_trach',
    canonicalName: 'đầm Dạ Trạch',
    type: 'LOCATION',
    aliases: ['Dạ Trạch'],
  },
  'loc_chua_mot_cot': {
    entityId: 'loc_chua_mot_cot',
    canonicalName: 'Chùa Một Cột',
    type: 'LOCATION',
    aliases: ['chùa Diên Hựu', 'Diên Hựu tự'],
  },
  'loc_ung_chau': {
    entityId: 'loc_ung_chau',
    canonicalName: 'thành Ung Châu',
    type: 'LOCATION',
    aliases: ['Ung Châu'],
  },
  'loc_dong_bo_dau': {
    entityId: 'loc_dong_bo_dau',
    canonicalName: 'Đông Bộ Đầu',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_chuong_duong': {
    entityId: 'loc_chuong_duong',
    canonicalName: 'Chương Dương',
    type: 'LOCATION',
    aliases: ['bến Chương Dương'],
  },
  'loc_thanh_da_bang': {
    entityId: 'loc_thanh_da_bang',
    canonicalName: 'Thành Đa Bang',
    type: 'LOCATION',
    aliases: ['Đa Bang', 'thành Đa Bang'],
  },
  'loc_ba_vi': {
    entityId: 'loc_ba_vi',
    canonicalName: 'Ba Vì',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_lung_nhai': {
    entityId: 'loc_lung_nhai',
    canonicalName: 'Lũng Nhai',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_nui_chi_linh': {
    entityId: 'loc_nui_chi_linh',
    canonicalName: 'núi Chí Linh',
    type: 'LOCATION',
    aliases: ['Chí Linh'],
  },
  'loc_le_chi_vien': {
    entityId: 'loc_le_chi_vien',
    canonicalName: 'Lệ Chi Viên',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_gia_binh': {
    entityId: 'loc_gia_binh',
    canonicalName: 'Gia Bình',
    type: 'LOCATION',
    aliases: ['huyện Gia Bình'],
  },
  'loc_luy_thay': {
    entityId: 'loc_luy_thay',
    canonicalName: 'Lũy Thầy',
    type: 'LOCATION',
    aliases: ['Lũy Đào Duy Từ'],
  },
  'loc_hoi_an': {
    entityId: 'loc_hoi_an',
    canonicalName: 'Hội An',
    type: 'LOCATION',
    aliases: ['đô thị cổ Hội An', 'phố cổ Hội An'],
  },
  'loc_pho_hien': {
    entityId: 'loc_pho_hien',
    canonicalName: 'Phố Hiến',
    type: 'LOCATION',
    aliases: ['thương cảng Phố Hiến'],
  },
  'loc_tam_diep': {
    entityId: 'loc_tam_diep',
    canonicalName: 'Tam Điệp',
    type: 'LOCATION',
    aliases: ['phòng tuyến Tam Điệp'],
  },
  'loc_kinh_thanh_hue': {
    entityId: 'loc_kinh_thanh_hue',
    canonicalName: 'Kinh thành Huế',
    type: 'LOCATION',
    aliases: ['Hoàng thành Huế'],
  },
  'loc_song_huong': {
    entityId: 'loc_song_huong',
    canonicalName: 'sông Hương',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_hoang_sa': {
    entityId: 'loc_hoang_sa',
    canonicalName: 'quần đảo Hoàng Sa',
    type: 'LOCATION',
    aliases: ['Hoàng Sa'],
  },
  'loc_song_vam_co_dong': {
    entityId: 'loc_song_vam_co_dong',
    canonicalName: 'sông Vàm Cỏ Đông',
    type: 'LOCATION',
    aliases: ['Vàm Cỏ Đông'],
  },
  'loc_bac_giang': {
    entityId: 'loc_bac_giang',
    canonicalName: 'Bắc Giang',
    type: 'LOCATION',
    aliases: ['Yên Thế'],
  },
  'loc_buon_ma_thuot': {
    entityId: 'loc_buon_ma_thuot',
    canonicalName: 'Buôn Ma Thuột',
    type: 'LOCATION',
    aliases: ['thị xã Buôn Ma Thuột'],
  },
  'loc_cau_my_thuan': {
    entityId: 'loc_cau_my_thuan',
    canonicalName: 'Cầu Mỹ Thuận',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_thanh_dia_my_son': {
    entityId: 'loc_thanh_dia_my_son',
    canonicalName: 'Thánh địa Mỹ Sơn',
    type: 'LOCATION',
    aliases: ['Mỹ Sơn'],
  },
  'loc_thap_ba_po_nagar': {
    entityId: 'loc_thap_ba_po_nagar',
    canonicalName: 'Tháp Bà Po Nagar',
    type: 'LOCATION',
    aliases: ['tháp Po Nagar', 'Po Nagar'],
  },
  'loc_nha_trang': {
    entityId: 'loc_nha_trang',
    canonicalName: 'Nha Trang',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_khanh_hoa': {
    entityId: 'loc_khanh_hoa',
    canonicalName: 'Khánh Hòa',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_di_chi_oc_eo': {
    entityId: 'loc_di_chi_oc_eo',
    canonicalName: 'Di chỉ Văn hóa Óc Eo',
    type: 'LOCATION',
    aliases: ['Óc Eo', 'Văn hóa Óc Eo'],
  },
  'loc_ba_the': {
    entityId: 'loc_ba_the',
    canonicalName: 'Ba Thê',
    type: 'LOCATION',
    aliases: ['núi Ba Thê'],
  },
  'loc_an_giang': {
    entityId: 'loc_an_giang',
    canonicalName: 'An Giang',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_quang_nam': {
    entityId: 'loc_quang_nam',
    canonicalName: 'Quảng Nam',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_ha_tinh': {
    entityId: 'loc_ha_tinh',
    canonicalName: 'Hà Tĩnh',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_hung_yen': {
    entityId: 'loc_hung_yen',
    canonicalName: 'Hưng Yên',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_bac_ninh': {
    entityId: 'loc_bac_ninh',
    canonicalName: 'Bắc Ninh',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_cao_bang': {
    entityId: 'loc_cao_bang',
    canonicalName: 'Cao Bằng',
    type: 'LOCATION',
    aliases: [],
  },
  'loc_linh_nam': {
    entityId: 'loc_linh_nam',
    canonicalName: 'Lĩnh Nam',
    type: 'LOCATION',
    aliases: ['đất Lĩnh Nam'],
  },
  'loc_mien_nam': {
    entityId: 'loc_mien_nam',
    canonicalName: 'miền Nam',
    type: 'LOCATION',
    aliases: ['phía Nam', 'miền Nam Việt Nam'],
  },
  'loc_lam_kinh': {
    entityId: 'loc_lam_kinh',
    canonicalName: 'Lam Kinh',
    type: 'LOCATION',
    aliases: ['Tây Kinh Lam Kinh'],
  },
  'loc_dai_la': {
    entityId: 'loc_thang_long',
    canonicalName: 'thành Đại La',
    type: 'LOCATION',
    aliases: ['Đại La', 'thành Đại La'],
  },
  'loc_hang_xom_trai': {
    entityId: 'loc_hang_xom_trai',
    canonicalName: 'Hang Xóm Trại',
    type: 'LOCATION',
    aliases: ['di chỉ Hang Xóm Trại'],
  },
  'loc_mai_da_lang_vanh': {
    entityId: 'loc_mai_da_lang_vanh',
    canonicalName: 'Mái đá Làng Vành',
    type: 'LOCATION',
    aliases: ['di chỉ Mái đá Làng Vành'],
  },
  'loc_sa_huynh': {
    entityId: 'loc_sa_huynh',
    canonicalName: 'Sa Huỳnh',
    type: 'LOCATION',
    aliases: ['Khu mộ chum Sa Huỳnh', 'di chỉ Sa Huỳnh'],
  },
  'loc_ai_nam_quan': {
    entityId: 'loc_ai_nam_quan',
    canonicalName: 'ải Nam Quan',
    type: 'LOCATION',
    aliases: ['Ải Nam Quan'],
  },
  'loc_yen_kinh': {
    entityId: 'loc_yen_kinh',
    canonicalName: 'Yên Kinh',
    type: 'LOCATION',
    aliases: ['kinh đô Yên Kinh'],
  },
  'loc_thi_nai': {
    entityId: 'loc_thi_nai',
    canonicalName: 'đầm Thị Nại',
    type: 'LOCATION',
    aliases: ['cửa Thị Nại', 'Thị Nại'],
  },
  'loc_phung_nguyen': {
    entityId: 'loc_phung_nguyen',
    canonicalName: 'Phùng Nguyên',
    type: 'LOCATION',
    aliases: ['di chỉ Phùng Nguyên', 'Văn hóa Phùng Nguyên', 'văn hoá Phùng Nguyên'],
  },
  'loc_dong_dau': {
    entityId: 'loc_dong_dau',
    canonicalName: 'Đồng Đậu',
    type: 'LOCATION',
    aliases: ['di chỉ Đồng Đậu', 'Văn hóa Đồng Đậu', 'văn hoá Đồng Đậu'],
  },
  'loc_go_mun': {
    entityId: 'loc_go_mun',
    canonicalName: 'Gò Mun',
    type: 'LOCATION',
    aliases: ['di chỉ Gò Mun', 'Văn hóa Gò Mun', 'văn hoá Gò Mun'],
  },
  'loc_ba_dinh': {
    entityId: 'loc_ba_dinh',
    canonicalName: 'Ba Đình',
    type: 'LOCATION',
    aliases: ['Quảng trường Ba Đình', 'quảng trường Ba Đình'],
  },
  'loc_da_trach': {
    entityId: 'loc_da_trach',
    canonicalName: 'Dạ Trạch',
    type: 'LOCATION',
    aliases: ['đầm Dạ Trạch', 'Đầm Dạ Trạch'],
  },
  'loc_can_tho': {
    entityId: 'loc_can_tho',
    canonicalName: 'Cần Thơ',
    type: 'LOCATION',
    aliases: ['thành phố Cần Thơ'],
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
export function inferEntityTypeFromName(name: string): EntityType {
  const norm = name.toLowerCase().trim();
  if (/(?:^|\s)(trận|chiến dịch|cuộc khởi nghĩa|khởi nghĩa|biến cố|hội nghị|hội thề|sáng lập|dựng nước|chiến thắng|đại thắng|dẹp loạn|phong trào|tổng tiến công)(?:$|\s)/i.test(norm)) {
    return 'EVENT_BATTLE';
  }
  // Archaeology / Historical Sites / Culture / Locations (Check BEFORE generic surnames)
  if (/(?:^|\s)(văn hóa|di chỉ|khu di tích|di tích|khu mộ|mái đá|hang|sông|núi|ải|thành|đô|trấn|phủ|huyện|tỉnh|làng|xã|đàng|đông kinh|đông quan|thăng long|hà nội|phong châu|mê linh|hát môn|luy lâu|phú xuân|mường thanh|ngọc hồi|đống đa|chi lăng|xương giang|bạch đằng|như nguyệt|cổ loa|tây đô|hoa lư|huế|sài gòn|gia định|điện|lầu|các|cửa|cầu|cung|đồn|bến|cảng|đèo|hồ|lăng|miếu|đền|chùa|quảng trường|dinh|hoàng thành|kinh thành|cố đô|quần đảo|bán đảo|địa đạo|đường mòn|đoài|xứ|kinh bắc|sơn nam|ái châu|hoan châu|trấn man|bắc hà|nam hà|trung kỳ|bắc kỳ|nam kỳ|thanh hóa|thái bình|quảng ninh|nghệ an|hải phòng|nam định|hải dương|bắc ninh|bắc giang|lạng sơn|cao bằng|hà giang|yên bái|tuyên quang|phú thọ|vĩnh phúc|hà nam|ninh bình|hà tĩnh|quảng bình|quảng trị|quảng nam|đà nẵng|quảng ngãi|bình định|phú yên|khánh hòa|ninh thuận|bình thuận|kon tum|gia lai|đắk lắk|đắk nông|lâm đồng|bình phước|tây ninh|bình dương|đồng nai|bà rịa|long an|tiền giang|bến tre|trà vinh|vĩnh long|đồng tháp|an giang|kiên giang|cần thơ|hậu giang|sóc trăng|bạc liêu|cà mau|điện biên|lai châu|sơn la|hòa bình|lào cai|đông anh|phú điền|đường lâm|tân sở|giao châu|mỏ cày|dinh độc lập|thủy điện|phùng nguyên|đồng đậu|gò mun|sa huỳnh|óc eo|hang xóm trại|mái đá làng vành|mỹ sơn|ba thê|việt nam)(?:$|\s)/i.test(norm)) {
    return 'LOCATION';
  }
  if (/(?:^|\s)(ngọc ấn|kim ấn|quốc ấn|ấn tín|văn bia|tấm bia|sắc phong|trống đồng|vũ khí|bảo vật|thần khí|nỏ thần|nỏ|xe tăng|thông bảo|súng thần cơ)(?:$|\s)/i.test(norm)) {
    return 'ARTIFACT';
  }
  if (/(?:^|\s)(bình ngô|hịch tướng sĩ|hịch|chiếu|đại cáo|tuyên ngôn|bản kỷ|tác phẩm|bộ luật|luật hồng đức|hình luật|hiệp định|toàn thư|cương mục|thực lục|tiêu án|chí lược|văn tập|bài thơ|hòa ước|sớ|lời kêu gọi)(?:$|\s)/i.test(norm)) {
    return 'DOCUMENT_CULTURE';
  }
  if (/(?:^|\s)(triều|nhà|thời|kỷ|kỷ nguyên|hồng bàng|văn lang|âu lạc|vạn xuân|đại cồ việt|đại việt|đại nam|đông sơn|xiêm la|đông ngô|đông hán|tiền lý|lê sơ|việt nam dân chủ cộng hòa)(?:$|\s)/i.test(norm)) {
    return 'DYNASTY_ERA';
  }
  // 5. Person checks (Feudal honorifics, deity titles, historical founders, ranks)
  if (/(?:^|\s)(vua|hoàng\s+đế|thái\s+tử|thái\s+thượng\s+hoàng|chúa|đại\s+vương|vương|lạc\s+long\s+quân|kinh\s+dương\s+vương|hùng\s+vương|thánh\s+gióng|an\s+dương\s+vương|thục\s+phán|cao\s+lỗ|bà\s+triệu|triệu\s+thị\s+trinh|hai\s+bà\s+trưng|trưng\s+trắc|trưng\s+nhị|thái\s+sư|thái\s+úy|tiết\s+chế|quốc\s+công|đại\s+tướng|tướng|đô\s+đốc|nữ\s+tướng|trạng\s+trình|trạng\s+nguyên|sử\s+quan|chủ\s+tịch|thủ\s+tướng|bác|thiền\s+sư|trưởng\s+lão|đại\s+sư|quốc\s+sư|cư\s+sĩ|thượng\s+tọa|hòa\s+thượng|đạo\s+sĩ|công\s+chúa|hoàng\s+hậu|quốc\s+mẫu|thứ\s+phi|ái\s+phi|thái\s+phi|hưng\s+đạo|bắc\s+bình|bình\s+định|vạn\s+thắng|tiền\s+ngô|triệu\s+việt|bố\s+cái|mai\s+hắc\s+đế|lý\s+nam\s+đế|đức\s+thánh)(?:$|\s)/i.test(norm)) {
    return 'HISTORICAL_PERSON';
  }
  const words = norm.split(/\s+/);
  const firstWord = words[0];
  const viSurnames = ['nguyễn', 'trần', 'lê', 'phạm', 'hoàng', 'huỳnh', 'phan', 'vũ', 'võ', 'đặng', 'bùi', 'đỗ', 'hồ', 'ngô', 'dương', 'lý', 'đinh', 'đoàn', 'lâm', 'trịnh', 'mai', 'đào', 'cao', 'hà', 'lưu', 'lương', 'thái', 'châu', 'tạ', 'phùng', 'tô', 'vương', 'quách', 'nhâm', 'tôn', 'trương', 'khuất'];
  if (words.length >= 2 && words.length <= 6 && viSurnames.includes(firstWord)) {
    return 'HISTORICAL_PERSON';
  }
  // 6. Organization checks (Strict multi-word or explicit institution keywords)
  if (/(?:^|\s)(nghĩa\s+quân|quân\s+đội|thủy\s+quân|liên\s+quân|quân\s+đoàn|quân\s+khu|quân\s+chủng|hội|viện|quán|đoàn|tập\s+đoàn|triều\s+đình|nghĩa\s+sĩ|đảng|thiền\s+phái|quốc\s+sử\s+quán|đội\s+hoàng\s+sa|hải\s+đội)(?:$|\s)/i.test(norm)) {
    return 'ORGANIZATION';
  }
  return 'UNKNOWN';
}

export const DYNASTY_DICTIONARY: Record<string, { entityId: string; canonicalName: string; aliases: string[] }> = {
  'dynasty_nam_han': { entityId: 'dynasty_nam_han', canonicalName: 'Nam Hán', aliases: ['quân Nam Hán', 'Nam Hán'] },
  'dynasty_tong': { entityId: 'dynasty_tong', canonicalName: 'Nhà Tống', aliases: ['quân Tống', 'nhà Tống', 'triều Tống'] },
  'dynasty_minh': { entityId: 'dynasty_minh', canonicalName: 'Nhà Minh', aliases: ['quân Minh', 'nhà Minh', 'triều Minh'] },
  'dynasty_thanh': { entityId: 'dynasty_thanh', canonicalName: 'Nhà Thanh', aliases: ['quân Mãn Thanh', 'quân Thanh', 'nhà Thanh', 'triều Thanh'] },
  'dynasty_nguyen_mong': { entityId: 'dynasty_nguyen_mong', canonicalName: 'Quân Nguyên Mông', aliases: ['quân Nguyên Mông', 'quân Mông Cổ', 'quân Nguyên', 'nhà Nguyên', 'triều Nguyên'] },
  'dynasty_van_lang': { entityId: 'dynasty_van_lang', canonicalName: 'Văn Lang', aliases: ['nhà nước Văn Lang', 'Văn Lang'] },
  'dynasty_au_lac': { entityId: 'dynasty_au_lac', canonicalName: 'Âu Lạc', aliases: ['nhà nước Âu Lạc', 'Âu Lạc'] },
  'dynasty_van_xuan': { entityId: 'dynasty_van_xuan', canonicalName: 'Vạn Xuân', aliases: ['nhà nước Vạn Xuân', 'Vạn Xuân'] },
  'dynasty_dai_co_viet': { entityId: 'dynasty_dai_co_viet', canonicalName: 'Đại Cồ Việt', aliases: ['nhà nước Đại Cồ Việt', 'Đại Cồ Việt'] },
  'dynasty_dai_viet': { entityId: 'dynasty_dai_viet', canonicalName: 'Đại Việt', aliases: ['nước Đại Việt', 'Đại Việt'] },
  'dynasty_dai_nam': { entityId: 'dynasty_dai_nam', canonicalName: 'Đại Nam', aliases: ['nước Đại Nam', 'Đại Nam'] },
  'dynasty_tay_son': { entityId: 'dynasty_tay_son', canonicalName: 'Nhà Tây Sơn', aliases: ['Tây Sơn', 'nhà Tây Sơn', 'triều Tây Sơn'] },
  'dynasty_xiem_la': { entityId: 'dynasty_xiem_la', canonicalName: 'Xiêm La', aliases: ['quân Xiêm', 'Xiêm'] },
  'dynasty_dong_han': { entityId: 'dynasty_dong_han', canonicalName: 'nhà Đông Hán', aliases: ['Đông Hán', 'quân Đông Hán', 'triều Đông Hán'] },
  'dynasty_nha_dong_han': { entityId: 'dynasty_dong_han', canonicalName: 'nhà Đông Hán', aliases: ['Đông Hán', 'quân Đông Hán', 'triều Đông Hán'] },
  'dynasty_dong_ngo': { entityId: 'dynasty_dong_ngo', canonicalName: 'Đông Ngô', aliases: ['quân Đông Ngô', 'nhà Đông Ngô', 'triều Đông Ngô'] },
  'dynasty_nha_tien_ly': { entityId: 'dynasty_nha_tien_ly', canonicalName: 'nhà Tiền Lý', aliases: ['triều Tiền Lý', 'Tiền Lý'] },
  'dynasty_nha_le_so': { entityId: 'dynasty_nha_le_so', canonicalName: 'nhà Lê Sơ', aliases: ['triều Lê Sơ', 'Lê Sơ'] },
  'dynasty_viet_nam_dan_chu_cong_hoa': { entityId: 'dynasty_viet_nam_dan_chu_cong_hoa', canonicalName: 'Việt Nam Dân chủ Cộng hòa', aliases: [] },
  'dynasty_nha_duong': { entityId: 'dynasty_nha_duong', canonicalName: 'nhà Đường', aliases: ['triều Đường', 'Đường'] },
  'dynasty_nha_dinh': { entityId: 'dynasty_nha_dinh', canonicalName: 'nhà Đinh', aliases: ['triều Đinh', 'thời Đinh', 'Nhà Đinh', 'triều đại nhà Đinh'] },
  'dynasty_nha_tien_le': { entityId: 'dynasty_nha_tien_le', canonicalName: 'nhà Tiền Lê', aliases: ['triều Tiền Lê', 'thời Tiền Lê', 'Nhà Tiền Lê'] },
  'dynasty_nha_ly': { entityId: 'dynasty_nha_ly', canonicalName: 'nhà Lý', aliases: ['triều Lý', 'thời Lý'] },
  'dynasty_nha_tran': { entityId: 'dynasty_nha_tran', canonicalName: 'nhà Trần', aliases: ['triều Trần', 'thời Trần'] },
  'dynasty_nha_ho': { entityId: 'dynasty_nha_ho', canonicalName: 'nhà Hồ', aliases: ['triều Hồ', 'thời Hồ'] },
  'dynasty_nha_nguyen': { entityId: 'dynasty_nha_nguyen', canonicalName: 'nhà Nguyễn', aliases: ['triều Nguyễn', 'thời Nguyễn'] },
  'dynasty_nha_tong': { entityId: 'dynasty_tong', canonicalName: 'quân Tống', aliases: ['nhà Tống', 'triều Tống'] },
  'dynasty_nha_minh': { entityId: 'dynasty_minh', canonicalName: 'nhà Minh', aliases: ['quân Minh', 'triều Minh'] },
  'dynasty_nha_mac': { entityId: 'dynasty_nha_mac', canonicalName: 'nhà Mạc', aliases: ['triều Mạc', 'thời Mạc'] },
  'dynasty_nha_ngo': { entityId: 'dynasty_nha_ngo', canonicalName: 'nhà Ngô', aliases: ['Nhà Ngô', 'triều Ngô', 'thời Ngô'] },
  'dynasty_bac_thuoc': { entityId: 'dynasty_bac_thuoc', canonicalName: 'thời kỳ Bắc thuộc', aliases: ['Bắc thuộc', 'thời Bắc thuộc', 'nghìn năm Bắc thuộc'] },
  'dynasty_cham_pa': { entityId: 'dynasty_cham_pa', canonicalName: 'Vương quốc Chăm-pa', aliases: ['Chăm-pa', 'Champa', 'Chăm', 'Chăm Pa', 'Chiêm Thành'] },
  'dynasty_phu_nam': { entityId: 'dynasty_phu_nam', canonicalName: 'Vương quốc Phù Nam', aliases: ['Phù Nam'] },
  'culture_hoa_binh': { entityId: 'culture_hoa_binh', canonicalName: 'Văn hóa Hòa Bình', aliases: ['Văn hoá Hòa Bình', 'Văn hóa Hoà Bình'] },
  'culture_sa_huynh': { entityId: 'culture_sa_huynh', canonicalName: 'Văn hóa Sa Huỳnh', aliases: ['Văn hoá Sa Huỳnh'] },
};

export const CORE_ORGS: Array<{ id: string; name: string; aliases: string[] }> = [
  { id: 'org_quan_man_thanh', name: 'quân Mãn Thanh', aliases: ['quân Thanh', 'Mãn Thanh', 'quân nhà Thanh'] },
  { id: 'org_quan_nguyen_mong', name: 'quân Nguyên Mông', aliases: ['quân Mông Cổ', 'quân Nguyên', 'giặc Nguyên'] },
  { id: 'org_nghia_quan_lam_son', name: 'nghĩa quân Lam Sơn', aliases: ['quân Lam Sơn'] },
  { id: 'org_thien_phai_truc_lam', name: 'Thiền phái Trúc Lâm Yên Tử', aliases: ['Trúc Lâm Yên Tử', 'Thiền phái Trúc Lâm'] },
  { id: 'org_hoi_tao_dan', name: 'Hội Tao Đàn', aliases: ['Tao Đàn'] },
  { id: 'org_viet_nam_thanh_nien', name: 'Hội Việt Nam Cách mạng Thanh niên', aliases: ['Việt Nam Thanh niên Cách mạng Đồng chí Hội'] },
  { id: 'org_viet_nam_quoc_dan_dang', name: 'Việt Nam Quốc dân Đảng', aliases: [] },
  { id: 'org_quoc_su_quan', name: 'Quốc sử quán', aliases: ['Quốc sử quán triều Nguyễn', 'Quốc Sử Quán triều Nguyễn', 'Quốc Sử Quán', 'org_quoc_su_quan_trieu_nguyen'] },
  { id: 'org_hoi_duy_tan', name: 'Hội Duy Tân', aliases: ['Hội Duy tân', 'phong trào Duy Tân', 'Phong trào Duy Tân'] },
  { id: 'org_dong_du', name: 'Phong trào Đông Du', aliases: ['phong trào Đông Du', 'Đông Du'] },
  { id: 'org_dang_cong_san_vn', name: 'Đảng Cộng sản Việt Nam', aliases: ['Đảng Cộng sản', 'Đảng', 'ĐCSVN', 'org_dang_cong_san_viet_nam'] },
  { id: 'org_qdndvn', name: 'Quân đội Nhân dân Việt Nam', aliases: ['Quân đội nhân dân Việt Nam', 'quân đội nhân dân Việt Nam', 'QĐNDVN', 'quân đội ta'] },
  { id: 'org_doan_559', name: 'Đoàn 559', aliases: ['Bộ đội Trường Sơn', 'đoàn 559'] },
  { id: 'org_wto', name: 'Tổ chức Thương mại Thế giới', aliases: ['WTO', 'Tổ chức Thương mại Thế giới WTO', 'Tổ chức Thương mại Thế giới (WTO)'] },
  { id: 'org_chua_nguyen', name: 'chúa Nguyễn', aliases: [] },
  { id: 'org_chua_trinh', name: 'chúa Trịnh', aliases: [] },
  { id: 'org_tay_son', name: 'nghĩa quân Tây Sơn', aliases: ['quân Tây Sơn', 'thủy quân Tây Sơn', 'phong trào Tây Sơn'] },
  { id: 'org_doi_hoang_sa', name: 'Đội Hoàng Sa', aliases: ['Hải đội Hoàng Sa', 'hải đội Hoàng Sa', 'org_hai_doi_hoang_sa', 'đội Hoàng Sa'] },
  { id: 'org_dong_kinh_nghia_thuc', name: 'Đông Kinh Nghĩa Thục', aliases: ['trường Đông Kinh Nghĩa Thục'] },
  { id: 'org_viet_nam_tuyen_truyen_giai_phong_quan', name: 'Đội Việt Nam Tuyên truyền Giải phóng quân', aliases: [] },
  { id: 'org_tay_ban_nha', name: 'Tây Ban Nha', aliases: ['liên quân Tây Ban Nha', 'quân Tây Ban Nha'] },
  { id: 'org_chinh_phu_cach_mang_lam_thoi', name: 'Chính phủ Cách mạng lâm thời Cộng hòa miền Nam Việt Nam', aliases: ['Chính phủ Cách mạng lâm thời', 'Chính phủ Cách mạng Lâm thời Cộng hòa miền Nam Việt Nam', 'Chính phủ lâm thời'] },
];

export const CORE_EVENTS: Array<{ id: string; name: string; aliases: string[] }> = [
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
  { id: 'event_dien_bien_phu', name: 'Chiến dịch Điện Biên Phủ', aliases: ['Trận Điện Biên Phủ', 'chiến dịch Điện Biên Phủ', 'Điện Biên Phủ 1954', 'Chiến dịch Điện Biên Phủ 1954'] },
  { id: 'event_bien_gioi_1950', name: 'Chiến dịch Biên giới Thu Đông 1950', aliases: ['Chiến dịch Biên giới 1950', 'Chiến dịch Biên giới', 'Chiến dịch Biên Giới Thu Đông 1950'] },
  { id: 'event_chien_dich_ho_chi_minh', name: 'Chiến dịch Hồ Chí Minh', aliases: ['Chiến dịch Hồ Chí Minh 1975'] },
  { id: 'event_30_thang_4_1975', name: 'Sự kiện 30 tháng 4 năm 1975', aliases: ['30 tháng 4 năm 1975', 'Ngày Giải phóng miền Nam 30/4/1975'] },
  { id: 'event_hoi_nghi_dien_hong', name: 'Hội nghị Diên Hồng', aliases: ['Hội nghị Diên Hồng 1284', 'Diên Hồng'] },
  { id: 'event_hoi_nghi_binh_than', name: 'Hội nghị Bình Than', aliases: ['Hội nghị Bình Than 1282', 'Bình Than'] },
  { id: 'event_phong_tuyen_nhu_nguyet', name: 'Trận phòng tuyến sông Như Nguyệt', aliases: ['phòng tuyến sông Như Nguyệt'] },
  { id: 'event_tot_dong_chuc_dong', name: 'Trận Tốt Động - Chúc Động', aliases: ['Tốt Động - Chúc Động'] },
  { id: 'event_rach_gam_xoai_mut', name: 'Trận Rạch Gầm - Xoài Mút', aliases: ['Rạch Gầm - Xoài Mút'] },
  { id: 'event_ban_dao_son_tra', name: 'Trận bán đảo Sơn Trà', aliases: ['Bán đảo Sơn Trà'] },
  { id: 'event_phong_trao_can_vuong', name: 'Phong trào Cần Vương', aliases: ['Cần Vương'] },
  { id: 'event_dong_du', name: 'Phong trào Đông Du', aliases: ['Đông Du'] },
  { id: 'event_duy_tan_phan_chu_trinh', name: 'Phong trào Duy Tân', aliases: ['Duy Tân'] },
  { id: 'event_khoi_nghia_yen_bai', name: 'Khởi nghĩa Yên Bái', aliases: ['cuộc Khởi nghĩa Yên Bái'] },
  { id: 'event_dong_khoi', name: 'Phong trào Đồng Khởi', aliases: ['Đồng khởi', 'Đồng Khởi', 'Phong trào Đồng Khởi năm 1960', 'phong trào Đồng khởi năm 1960', 'phong trào Đồng khởi', 'Đồng khởi 1960', 'event_dong_khoi_1960'] },
  { id: 'event_linebacker_2', name: 'Trận Điện Biên Phủ trên không', aliases: ['Điện Biên Phủ trên không', 'Trận Điện Biên Phủ trên không năm 1972', 'Điện Biên Phủ trên không 1972', 'event_dien_bien_phu_tren_khong_1972', 'Linebacker II'] },
  { id: 'event_gac_ma_1988', name: 'Trận Gạc Ma', aliases: ['Gạc Ma'] },
  { id: 'event_dong_bo_dau_1258', name: 'Chiến thắng Đông Bộ Đầu năm 1258', aliases: ['Trận Đông Bộ Đầu', 'Đông Bộ Đầu 1258'] },
  { id: 'event_khoi_nghia_ba_dinh', name: 'Khởi nghĩa Ba Đình', aliases: ['căn cứ Ba Đình'] },
  { id: 'event_khoi_nghia_huong_khe', name: 'Khởi nghĩa Hương Khê', aliases: ['khởi nghĩa Hương Khê', 'cuộc khởi nghĩa Hương Khê'] },
  { id: 'event_khoi_nghia_yen_the', name: 'Khởi nghĩa Yên Thế', aliases: ['khởi nghĩa Yên Thế', 'cuộc khởi nghĩa Yên Thế'] },
  { id: 'event_viet_bac_1947', name: 'Chiến dịch Việt Bắc Thu Đông 1947', aliases: ['Chiến dịch Việt Bắc'] },
  { id: 'event_mau_than_1968', name: 'Tổng tiến công và nổi dậy Tết Mậu Thân 1968', aliases: ['Tết Mậu Thân 1968', 'Tết Mậu Thân', 'event_tet_mau_than_1968'] },
  { id: 'event_chien_dich_tay_nguyen_1975', name: 'Chiến dịch Tây Nguyên', aliases: ['Chiến dịch Tây Nguyên 1975'] },
  { id: 'event_dai_hoi_vi', name: 'Đại hội VI', aliases: ['Đại hội Đảng VI', 'Đại hội VI Đảng Cộng sản Việt Nam', 'Đại hội 6'] },
  { id: 'event_van_don', name: 'Trận Vân Đồn', aliases: ['Trận Vân Đồn năm 1288', 'Vân Đồn', 'event_tran_van_don'] },
  { id: 'event_bo_co', name: 'Trận Bô Cô', aliases: ['Trận Bô Cô năm 1408', 'Bô Cô', 'event_tran_bo_co'] },
  { id: 'event_bien_gioi_1979', name: 'Chiến tranh biên giới phía Bắc', aliases: ['chiến tranh biên giới phía Bắc', 'Chiến tranh biên giới 1979', 'Cuộc chiến đấu bảo vệ biên giới phía Bắc', 'biên giới 1979'] },
  { id: 'event_bien_gioi_tay_nam', name: 'Chiến tranh biên giới Tây Nam', aliases: ['chiến tranh biên giới Tây Nam', 'chiến dịch phản công bảo vệ biên giới Tây Nam'] },
  { id: 'event_30_thang_4_1975', name: 'Ngày 30 tháng 4 năm 1975', aliases: ['30 tháng 4 năm 1975', '30/4/1975', 'ngày 30 tháng 4 năm 1975'] },
  { id: 'event_duong_day_500kv', name: 'Đường dây 500kV Bắc - Nam', aliases: ['Đường dây 500 kV Bắc - Nam', 'Đường dây 500kV', 'đường dây 500kV Bắc - Nam', 'đường dây 500kV'] },
  { id: 'event_doi_moi', name: 'Công cuộc Đổi mới', aliases: ['Đổi mới', 'thời kỳ Đổi mới', 'công cuộc Đổi mới'] },
];

export const CORE_ARTIFACTS: Array<{ id: string; name: string; aliases: string[] }> = [
  { id: 'artifact_trong_dong_dong_son', name: 'Trống đồng Đông Sơn', aliases: ['Trống đồng Ngọc Lũ', 'Trống đồng Sông Đà', 'Trống đồng Hoàng Hạ'] },
  { id: 'artifact_no_lien_chau', name: 'Nỏ Liên Châu', aliases: ['Nỏ thần', 'Nỏ thần Liên Châu'] },
  { id: 'artifact_thong_bao_hoi_sao', name: 'Thông Bảo Hội Sao', aliases: ['tiền Thông Bảo Hội Sao'] },
  { id: 'artifact_xe_tang_390', name: 'Xe tăng 390', aliases: [] },
  { id: 'artifact_thai_binh_hung_bao', name: 'Thái Bình Hưng Bảo', aliases: ['tiền Thái Bình Hưng Bảo', 'tiền Thái Bình', 'Thái Bình hưng bảo', 'artifact_tien_thai_binh'] },
  { id: 'artifact_sung_than_co', name: 'súng Thần cơ Thương pháo', aliases: ['Súng Thần Cơ', 'súng Thần cơ'] },
  { id: 'artifact_cuu_dinh', name: 'Cửu Đỉnh', aliases: ['Cửu đỉnh', 'Cửu Đỉnh Huế'] },
];

export const CORE_DOCS: Array<{ id: string; name: string; aliases: string[] }> = [
  { id: 'doc_chieu_doi_do', name: 'Chiếu dời đô', aliases: [] },
  { id: 'doc_hich_tuong_si', name: 'Hịch tướng sĩ', aliases: [] },
  { id: 'doc_binh_ngo_dai_cao', name: 'Bình Ngô đại cáo', aliases: [] },
  { id: 'doc_tuyen_ngon_doc_lap', name: 'Tuyên ngôn Độc lập', aliases: ['Bản Tuyên ngôn Độc lập', 'Bản Tuyên ngôn độc lập'] },
  { id: 'doc_nam_quoc_son_ha', name: 'Nam quốc sơn hà', aliases: [] },
  { id: 'doc_luat_hong_duc', name: 'Luật Hồng Đức', aliases: ['Quốc triều hình luật', 'doc_quoc_trieu_hinh_luat'] },
  { id: 'doc_dai_viet_su_ky', name: 'Đại Việt Sử Ký', aliases: ['Đại Việt sử ký', 'sách Đại Việt Sử Ký', 'bộ Đại Việt sử ký', 'doc_dai_viet_su_ky'] },
  { id: 'doc_dai_viet_su_ky_toan_thu', name: 'Đại Việt sử ký toàn thư', aliases: ['Toàn Thư', 'Đại Việt Sử Ký Toàn Thư'] },
  { id: 'doc_dai_nam_thuc_luc', name: 'Đại Nam thực lục', aliases: [] },
  { id: 'doc_kham_dinh_viet_su_thong_giam_cuong_muc', name: 'Khâm định Việt sử thông giám cương mục', aliases: ['Khâm định Việt sử', 'Cương Mục', 'Việt sử thông giám cương mục'] },
  { id: 'doc_hiep_dinh_geneve_1954', name: 'Hiệp định Genève', aliases: ['Hiệp định Geneva', 'Hiệp định Giơ-ne-vơ', 'doc_hiep_dinh_geneve'] },
  { id: 'doc_that_tram_so', name: 'Thất trảm sớ', aliases: [] },
  { id: 'doc_hong_duc_ban_do', name: 'Hồng Đức bản đồ', aliases: ['bản đồ Hồng Đức'] },
  { id: 'doc_chieu_cau_hien', name: 'Chiếu Cầu Hiền', aliases: ['Chiếu cầu hiền', 'Chiếu khuyến học'] },
  { id: 'doc_chieu_can_vuong', name: 'Chiếu Cần Vương', aliases: ['chiếu Cần Vương', 'Dụ Cần Vương'] },
  { id: 'doc_hoang_trieu_luat_le', name: 'Hoàng triều luật lệ', aliases: ['Luật Gia Long', 'bộ luật Gia Long', 'doc_luat_gia_long', 'Hoàng Việt luật lệ', 'bộ luật Hoàng Việt luật lệ'] },
  { id: 'doc_hoa_uoc_harmand', name: 'Hòa ước Quý Mùi', aliases: ['Hòa ước Harmand', 'Hòa ước Harmand 1883', 'Hòa ước Quý Mùi 1883'] },
  { id: 'doc_hiep_dinh_paris_1973', name: 'Hiệp định Paris năm 1973', aliases: ['Hiệp định Paris', 'Hiệp định Paris 1973'] },
  { id: 'doc_bia_tien_si_1442', name: 'Bia Tiến sĩ khoa Nhâm Tuất 1442', aliases: ['Bia Tiến sĩ', 'Bia Tiến sĩ khoa Nhâm Tuất'] },
  { id: 'doc_phu_bien_tap_luc', name: 'Phủ biên tạp lục', aliases: ['Phủ Biên Tạp Lục', 'sách Phủ biên tạp lục'] },
  { id: 'doc_loi_keu_goi_toan_quoc_khang_chien', name: 'Lời kêu gọi Toàn quốc kháng chiến', aliases: ['Lời kêu gọi toàn quốc kháng chiến', 'Lời kêu gọi kháng chiến', 'doc_loi_keu_goi_khang_chien'] },
  { id: 'doc_hai_ngoai_huyet_thu', name: 'Hải ngoại huyết thư', aliases: ['hải ngoại huyết thư'] },
  { id: 'doc_di_chuc_ho_chi_minh', name: 'Di chúc Hồ Chí Minh', aliases: ['Di chúc của Chủ tịch Hồ Chí Minh', 'Di chúc'] },
  { id: 'doc_hiep_dinh_bta', name: 'Hiệp định Thương mại Việt - Mỹ BTA', aliases: ['Hiệp định Thương mại Việt - Mỹ', 'BTA', 'Hiệp định BTA', 'doc_hiep_dinh_bta'] },
  { id: 'doc_linh_nam_chich_quai', name: 'Lĩnh Nam Chích Quái', aliases: ['Lĩnh Nam chích quái', 'sách Lĩnh Nam Chích Quái', 'Sách Lĩnh Nam Chích Quái', 'doc_linh_nam_chich_quai'] },
  { id: 'doc_binh_thu_yeu_luoc', name: 'Bình thư yếu lược', aliases: ['Binh thư yếu lược', 'sách Bình thư yếu lược', 'doc_binh_thu_yeu_luoc'] },
  { id: 'doc_viet_nam_su_luoc', name: 'Việt Nam Sử Lược', aliases: ['Việt Nam sử lược', 'sách Việt Nam sử lược', 'doc_viet_nam_su_luoc'] },
  { id: 'doc_thien_uyen_tap_anh', name: 'Thiền Uyển Tập Anh', aliases: ['Thiền uyển tập anh', 'sách Thiền Uyển Tập Anh', 'doc_thien_uyen_tap_anh'] },
];

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

  for (const org of CORE_ORGS) {
    register(org.name, org.id, org.name);
    for (const alias of org.aliases) {
      register(alias, org.id, org.name);
    }
  }

  for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    register(loc.canonicalName, loc.entityId, loc.canonicalName);
    const stripped = loc.canonicalName.replace(/^(thành|sông|núi|ải|phủ|đồn|xứ|cố đô|kinh đô|kinh thành|tỉnh|huyện|làng|căn cứ)\s+/i, '');
    if (stripped !== loc.canonicalName && stripped.toLowerCase() !== 'nhà hồ' && stripped.toLowerCase() !== 'huế') {
      register(stripped, loc.entityId, loc.canonicalName);
    }
    for (const alias of loc.aliases) {
      register(alias, loc.entityId, loc.canonicalName);
      const strippedAlias = alias.replace(/^(thành|sông|núi|ải|phủ|đồn|xứ|cố đô|kinh đô|kinh thành|tỉnh|huyện|làng|căn cứ)\s+/i, '');
      if (strippedAlias !== alias && strippedAlias.toLowerCase() !== 'nhà hồ' && strippedAlias.toLowerCase() !== 'huế') {
        register(strippedAlias, loc.entityId, loc.canonicalName);
      }
    }
  }

  for (const ev of CORE_EVENTS) {
    register(ev.name, ev.id, ev.name);
    const unhyphenated = ev.name.replace(/\s*[-–—]\s*/g, ' ');
    if (unhyphenated !== ev.name) {
      register(unhyphenated, ev.id, ev.name);
    }
    const stripped = ev.name.replace(/^(Trận|Chiến dịch|Khởi nghĩa|Chiến thắng|Đại thắng|Hội thề|Hội nghị)\s+/i, '');
    const strippedKey = `loc_${removeVietnameseAccents(stripped).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
    if (stripped !== ev.name && !HISTORICAL_LOCATION_DICTIONARY[strippedKey] && !FAST_ENTITY_MAP.has(normalizeKey(stripped))) {
      register(stripped, ev.id, ev.name);
      register(stripped.replace(/\s*[-–—]\s*/g, ' '), ev.id, ev.name);
    }
    for (const al of ev.aliases) {
      register(al, ev.id, ev.name);
      const unhyphenatedAl = al.replace(/\s*[-–—]\s*/g, ' ');
      if (unhyphenatedAl !== al) {
        register(unhyphenatedAl, ev.id, ev.name);
      }
      const strippedAl = al.replace(/^(Trận|Chiến dịch|Khởi nghĩa|Chiến thắng|Đại thắng|Hội thề|Hội nghị)\s+/i, '');
      const strippedAlKey = `loc_${removeVietnameseAccents(strippedAl).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
      if (strippedAl !== al && !HISTORICAL_LOCATION_DICTIONARY[strippedAlKey] && !FAST_ENTITY_MAP.has(normalizeKey(strippedAl))) {
        register(strippedAl, ev.id, ev.name);
        register(strippedAl.replace(/\s*[-–—]\s*/g, ' '), ev.id, ev.name);
      }
    }
  }

  for (const art of CORE_ARTIFACTS) {
    register(art.name, art.id, art.name);
    for (const al of art.aliases) {
      register(al, art.id, art.name);
    }
  }

  for (const d of CORE_DOCS) {
    register(d.name, d.id, d.name);
    for (const al of d.aliases) {
      register(al, d.id, d.name);
    }
  }

  // Deity Title & Epithet Mappings
  for (const [alias, info] of Object.entries(DEITY_TITLE_MAPPINGS)) {
    register(alias, info.canonicalId, info.canonicalName);
  }

  // Reign Eras (only register if not already mapped to a specific person/dynasty)
  for (const [reignKey, info] of Object.entries(REIGN_ERA_DICTIONARY)) {
    const norm = normalizeKey(info.reignName);
    if (!FAST_ENTITY_MAP.has(norm)) {
      const dynId = `dynasty_${removeVietnameseAccents(info.dynasty).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
      register(info.reignName, dynId, info.reignName);
    }
  }

  // Provinces & Admin Units (only register if not already mapped to an existing canonical location)
  for (const loc of VIETNAMESE_PROVINCES_AND_ADMIN_UNITS) {
    const norm = normalizeKey(loc);
    if (!FAST_ENTITY_MAP.has(norm)) {
      const locId = `loc_${removeVietnameseAccents(loc).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
      register(loc, locId, loc);
    }
  }

  // Explicit Special Guards & Canonical ID Bridges
  register('Tây Sơn Vương', 'person_nguyen_nhac', 'Nguyễn Nhạc');
  register('Tay Son Vuong', 'person_nguyen_nhac', 'Nguyễn Nhạc');
  register('VNDCCH', 'dynasty_viet_nam_dan_chu_cong_hoa', 'Việt Nam Dân chủ Cộng hòa');
  register('dynasty_vndcch', 'dynasty_viet_nam_dan_chu_cong_hoa', 'Việt Nam Dân chủ Cộng hòa');
  register('doc_quoc_trieu_hinh_luat', 'doc_luat_hong_duc', 'Luật Hồng Đức');
  register('Quốc triều hình luật', 'doc_luat_hong_duc', 'Luật Hồng Đức');
  register('event_dien_bien_phu_1954', 'event_dien_bien_phu', 'Chiến dịch Điện Biên Phủ');
  register('event_dien_bien_phu_tren_khong_1972', 'event_linebacker_2', 'Trận Điện Biên Phủ trên không');
  register('event_dong_khoi_1960', 'event_dong_khoi', 'Phong trào Đồng Khởi');
  register('event_tet_mau_than_1968', 'event_mau_than_1968', 'Tổng tiến công và nổi dậy Tết Mậu Thân 1968');
  register('org_quoc_su_quan_trieu_nguyen', 'org_quoc_su_quan', 'Quốc sử quán');
  register('org_hai_doi_hoang_sa', 'org_doi_hoang_sa', 'Đội Hoàng Sa');
  register('loc_quang_truong_ba_dinh', 'loc_ba_dinh', 'Ba Đình');
  register('doc_loi_keu_goi_khang_chien', 'doc_loi_keu_goi_toan_quoc_khang_chien', 'Lời kêu gọi Toàn quốc kháng chiến');
  register('doc_luat_gia_long', 'doc_hoang_trieu_luat_le', 'Hoàng triều luật lệ');
  register('loc_dam_da_trach', 'loc_da_trach', 'Dạ Trạch');
  register('event_tran_van_don', 'event_van_don', 'Trận Vân Đồn');
  register('event_tran_bo_co', 'event_bo_co', 'Trận Bô Cô');
  register('org_dang_cong_san_viet_nam', 'org_dang_cong_san_vn', 'Đảng Cộng sản Việt Nam');
  register('Việt Nam', 'dynasty_viet_nam', 'Việt Nam');
  register('Triều Tiên', 'loc_trieu_tien', 'Triều Tiên');
  register('thành Đại La', 'loc_thang_long', 'Thăng Long');
  register('Đại La', 'loc_thang_long', 'Thăng Long');
  register('loc_dai_la', 'loc_thang_long', 'Thăng Long');
  register('phủ Thừa Thiên', 'loc_thua_thien', 'Thừa Thiên');
  register('Thừa Thiên', 'loc_thua_thien', 'Thừa Thiên');
  register('loc_phu_thua_thien', 'loc_thua_thien', 'Thừa Thiên');
  register('Thủy điện Hòa Bình', 'loc_hoa_binh', 'Hòa Bình');
  register('loc_thuy_dien_hoa_binh', 'loc_hoa_binh', 'Hòa Bình');
  register('Phong trào Đông Du', 'org_dong_du', 'Phong trào Đông Du');
  register('phong trào Đông Du', 'org_dong_du', 'Phong trào Đông Du');
  register('Đông Du', 'org_dong_du', 'Phong trào Đông Du');
  register('event_dong_du', 'org_dong_du', 'Phong trào Đông Du');
  register('Phong trào Duy Tân', 'org_hoi_duy_tan', 'Hội Duy Tân');
  register('phong trào Duy Tân', 'org_hoi_duy_tan', 'Hội Duy Tân');
  register('Duy Tân', 'org_hoi_duy_tan', 'Hội Duy Tân');
  register('org_duy_tan', 'org_hoi_duy_tan', 'Hội Duy Tân');
  register('event_duy_tan_phan_chu_trinh', 'org_hoi_duy_tan', 'Hội Duy Tân');
  register('nghĩa quân Tây Sơn', 'org_tay_son', 'Tây Sơn');
  register('quân Tây Sơn', 'org_tay_son', 'Tây Sơn');
  register('phong trào Tây Sơn', 'org_tay_son', 'Tây Sơn');
  register('quân đội ta', 'org_qdndvn', 'Quân đội Nhân dân Việt Nam');
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

  // 2. Honorific & Title Stripping
  const strippedHonorific = normInput.replace(/^(bắc\s*bình\s*vương|doanh\s*điền\s*sứ|tổng\s*bí\s*thư|chí\s*sĩ|quân\s*sư|thầy\s*giáo|bình\s*tây\s*đại\s*nguyên\s*soái|thiền\s*sư|nguyên\s*phi|thái\s*hậu|nhân\s*huệ\s*vương|chiêu\s*minh\s*đại\s*vương|chiêu\s*văn\s*vương|bình\s*định\s*vương|bố\s*cái\s*đại\s*vương|tiền\s*ngô\s*vương|vạn\s*thắng\s*vương|hưng\s*đạo\s*đại\s*vương|hưng\s*đạo\s*vương|đức\s*thánh\s*trần|đức\s*thánh|vua|hoàng\s*đế|thái\s*sư|tướng\s*quân|tướng|đại\s*vương|chúa|thượng\s*hoàng|thái\s*úy|tổng\s*binh|đại\s*tướng|thủ\s*tướng|anh\s*hùng|sứ\s*thần|sử\s*gia|sử\s*thần|tăng\s*thống|trạng\s*nguyên|bảng\s*nhãn|danh\s*sĩ|nữ\s*tướng)\s+/, '');
  const unaccentedStrippedHonorific = strippedHonorific.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
  const honorificMatch = FAST_ENTITY_MAP.get(strippedHonorific) || FAST_ENTITY_MAP.get(unaccentedStrippedHonorific);
  if (honorificMatch) {
    return honorificMatch;
  }

  // Fallback for unknown entity with canonical prefix & ASCII slug
  let cleanNameForSlug = aliasOrName.trim();
  if (effectiveType === 'HISTORICAL_PERSON') {
    cleanNameForSlug = cleanNameForSlug.replace(/^(?:Bắc\s+Bình\s+Vương|Doanh\s+điền\s+sứ|Tổng\s+Bí\s+thư|Chí\s+sĩ|Quân\s+sư|Thầy\s+giáo|Bình\s+Tây\s+Đại\s+nguyên\s+soái|Thiền\s+sư|Nguyên\s+phi|Thái\s+hậu|Nhân\s+Huệ\s+Vương|Chiêu\s+Minh\s+Đại\s+Vương|Chiêu\s+Văn\s+Vương|Bình\s+Định\s+Vương|Bố\s+Cái\s+Đại\s+Vương|Tiền\s+Ngô\s+Vương|Vạn\s+Thắng\s+Vương|Hưng\s+Đạo\s+Đại\s+Vương|Hưng\s+Đạo\s+Vương|Đức\s+Thánh\s+Trần|Đức\s+Thánh|Vua|Hoàng\s+đế|Thái\s+sư|Tướng\s+quân|Tướng|Đại\s+vương|Chúa|Thượng\s+hoàng|Thái\s+úy|Tổng\s+binh|Đại\s+tướng|Thủ\s+tướng|Anh\s+hùng|Sứ\s+thần|Sử\s+gia|Sử\s+thần|Tăng\s+thống|Trạng\s+nguyên|Bảng\s+nhãn|Danh\s+sĩ|Nữ\s+tướng)\s+/i, '');
  }

  const slug = cleanNameForSlug
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
    canonicalName: cleanNameForSlug,
  };
}

/**
 * Maps a Gregorian or BCE year interval to matching ChronoViet Canonical Epoch IDs
 * Uses exact interval overlap against HISTORICAL_CHRONOLOGY and enforces Dual-Axis Overlap for 1771 - 1777 (EPOCH_09 and EPOCH_10)
 */
export function resolveHistoricalEpochs(timeStart?: number, timeEnd?: number): string[] {
  if (timeStart === undefined && timeEnd === undefined) return [];
  const start = timeStart ?? timeEnd!;
  const end = timeEnd ?? timeStart!;
  const minYear = Math.min(start, end);
  const maxYear = Math.max(start, end);

  const epochSet = new Set<string>();

  // Dual-Axis Overlap Protocol (Spec 2.1): 1771 - 1777 must have BOTH EPOCH_09 and EPOCH_10
  if ((minYear <= 1777 && maxYear >= 1771)) {
    epochSet.add('EPOCH_09');
    epochSet.add('EPOCH_10');
  }

  for (const epoch of HISTORICAL_CHRONOLOGY) {
    if (epoch.startYear <= maxYear && epoch.endYear >= minYear) {
      epochSet.add(epoch.epochId);
    }
  }

  return Array.from(epochSet);
}

/**
 * Validates whether a candidate string or canonical ID exists in the Master Historical Knowledge Base
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

  return false;
}

/**
 * Resolves any name variant/alias to its Canonical Historical Entity representation
 */
export function resolveCanonicalEntity(inputName: string): HistoricalEntityInfo {
  const inferredType = inferEntityTypeFromName(inputName);
  const aliasMapping = resolveEntityAlias(inputName, inferredType);

  const allDicts = [
    HISTORICAL_PERSON_DICTIONARY,
    HISTORICAL_LOCATION_DICTIONARY,
  ];
  for (const dict of allDicts) {
    if (dict[aliasMapping.canonicalId]) {
      return dict[aliasMapping.canonicalId];
    }
  }

  const foundDyn = DYNASTY_DICTIONARY[aliasMapping.canonicalId];
  if (foundDyn) return { entityId: foundDyn.entityId, canonicalName: foundDyn.canonicalName, type: 'DYNASTY_ERA', aliases: foundDyn.aliases };

  const foundOrg = CORE_ORGS.find((o) => o.id === aliasMapping.canonicalId);
  if (foundOrg) return { entityId: foundOrg.id, canonicalName: foundOrg.name, type: 'ORGANIZATION', aliases: foundOrg.aliases };

  const foundEvent = CORE_EVENTS.find((e) => e.id === aliasMapping.canonicalId);
  if (foundEvent) return { entityId: foundEvent.id, canonicalName: foundEvent.name, type: 'EVENT_BATTLE', aliases: foundEvent.aliases };

  const foundArt = CORE_ARTIFACTS.find((a) => a.id === aliasMapping.canonicalId);
  if (foundArt) return { entityId: foundArt.id, canonicalName: foundArt.name, type: 'ARTIFACT', aliases: foundArt.aliases };

  const foundDoc = CORE_DOCS.find((d) => d.id === aliasMapping.canonicalId);
  if (foundDoc) return { entityId: foundDoc.id, canonicalName: foundDoc.name, type: 'DOCUMENT_CULTURE', aliases: foundDoc.aliases };

  return {
    entityId: aliasMapping.canonicalId,
    canonicalName: aliasMapping.canonicalName,
    type: inferredType,
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

