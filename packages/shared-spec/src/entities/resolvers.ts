/**
 * Historical Entity Resolvers, Canonical Triples & Dynastic Taxonomies
 */
import type { EntityAliasMapping, HistoricalLocationMapping } from '../interfaces.js';
import { getCanonicalEntityIdPrefix, type EntityType } from '../schema.js';
import {
  DEITY_TITLE_MAPPINGS,
  REIGN_ERA_DICTIONARY,
  VIETNAMESE_PROVINCES_AND_ADMIN_UNITS,
  HISTORICAL_CHRONOLOGY,
} from '../dictionaries.js';
import type { HistoricalEntityInfo } from './types.js';
import { HISTORICAL_PERSON_DICTIONARY } from './persons.js';
import { HISTORICAL_LOCATION_MAPPINGS, HISTORICAL_LOCATION_DICTIONARY, resolveLocationMapping } from './locations.js';
import { removeVietnameseAccents } from '../text-utils.js';

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
    .trim();
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
  if (/(?:^|\s)(văn hóa|di chỉ|khu di tích|di tích|khu mộ|mái đá|hang|sông|núi|ải|thành|đô|trấn|phủ|huyện|tỉnh|làng|xã|đàng|đông kinh|đông quan|thăng long|hà nội|phong châu|mê linh|hát môn|luy lâu|phú xuân|mường thanh|ngọc hồi|đống đa|chi lăng|xương giang|bạch đằng|như nguyệt|cổ loa|tây đô|hoa lư|huế|sài gòn|gia định|điện|lầu|các|cửa|cầu|cung|đồn|bến|cảng|đèo|hồ\s+(?:hoàn\s+kiếm|tây|ba\s+bể|gươm|trúc\s+bạch|kẻ\s+gỗ|dầu\s+tiếng|trị\s+an|thủy\s+điện|nước)|lăng|miếu|đền|chùa|quảng trường|dinh|hoàng thành|kinh thành|cố đô|quần đảo|bán đảo|địa đạo|đường mòn|đoài|xứ|kinh bắc|sơn nam|ái châu|hoan châu|trấn man|bắc hà|nam hà|trung kỳ|bắc kỳ|nam kỳ|thanh hóa|thái bình|quảng ninh|nghệ an|hải phòng|nam định|hải dương|bắc ninh|bắc giang|lạng sơn|cao bằng|hà giang|yên bái|tuyên quang|phú thọ|vĩnh phúc|hà nam|ninh bình|hà tĩnh|quảng bình|quảng trị|quảng nam|đà nẵng|quảng ngãi|bình định|phú yên|khánh hòa|ninh thuận|bình thuận|kon tum|gia lai|đắk lắk|đắk nông|lâm đồng|bình phước|tây ninh|bình dương|đồng nai|bà rịa|long an|tiền giang|bến tre|trà vinh|vĩnh long|đồng tháp|an giang|kiên giang|cần thơ|hậu giang|sóc trăng|bạc liêu|cà mau|điện biên|lai châu|sơn la|hòa bình|lào cai|đông anh|phú điền|đường lâm|tân sở|giao châu|mỏ cày|dinh độc lập|thủy điện|phùng nguyên|đồng đậu|gò mun|sa huỳnh|óc eo|hang xóm trại|mái đá làng vành|mỹ sơn|ba thê|việt nam|nông cống)(?:$|\s)/i.test(norm)) {
    return 'LOCATION';
  }
  if (/(?:^|\s)(ngọc ấn|kim ấn|quốc ấn|ấn tín|văn bia|tấm bia|sắc phong|trống đồng|vũ khí|bảo vật|thần khí|nỏ thần|nỏ|xe tăng|thông bảo|súng thần cơ|thái bình hưng bảo)(?:$|\s)/i.test(norm)) {
    return 'ARTIFACT';
  }
  if (/(?:^|\s)(bình ngô|hịch tướng sĩ|hịch|chiếu|đại cáo|tuyên ngôn|bản kỷ|tác phẩm|bộ luật|luật hồng đức|hình luật|hình thư|hiệp định|toàn thư|cương mục|thực lục|tiêu án|chí lược|văn tập|bài thơ|hòa ước|sớ|lời kêu gọi|hoàng lê nhất thống chí|lĩnh nam chích quái|thiền uyển tập anh|truyện kiều|đề cương|thi nhân|tình già)(?:$|\s)/i.test(norm)) {
    return 'DOCUMENT_CULTURE';
  }
  if (/(?:^|\s)(triều|nhà|thời|kỷ|kỷ nguyên|hồng bàng|văn lang|âu lạc|vạn xuân|đại cồ việt|đại việt|đại nam|đại ngu|đông sơn|xiêm la|đông ngô|đông hán|tiền lý|lê sơ|việt nam dân chủ cộng hòa|đàng trong|đàng ngoài|chúa trịnh|chúa nguyễn)(?:$|\s)/i.test(norm)) {
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
  if (/(?:^|\s)(nghĩa\s+quân|quân\s+đội|thủy\s+quân|liên\s+quân|quân\s+đoàn|quân\s+khu|quân\s+chủng|hội|viện|quán|đoàn|tập\s+đoàn|triều\s+đình|nghĩa\s+sĩ|đảng|thiền\s+phái|quốc\s+sử\s+quán|đội\s+hoàng\s+sa|hải\s+đội|ngô\s+gia\s+văn\s+phái)(?:$|\s)/i.test(norm)) {
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
  'dynasty_tay_son': { entityId: 'dynasty_nha_tay_son', canonicalName: 'Nhà Tây Sơn', aliases: ['Tây Sơn', 'nhà Tây Sơn', 'triều Tây Sơn', 'triều đại Tây Sơn', 'thời Tây Sơn', 'thời kỳ Tây Sơn'] },
  'dynasty_nha_tay_son': { entityId: 'dynasty_nha_tay_son', canonicalName: 'Nhà Tây Sơn', aliases: ['Tây Sơn', 'nhà Tây Sơn', 'triều Tây Sơn', 'triều đại Tây Sơn', 'thời Tây Sơn', 'thời kỳ Tây Sơn'] },
  'dynasty_xiem_la': { entityId: 'dynasty_xiem_la', canonicalName: 'Xiêm La', aliases: ['quân Xiêm', 'Xiêm'] },
  'dynasty_dong_han': { entityId: 'dynasty_dong_han', canonicalName: 'nhà Đông Hán', aliases: ['Đông Hán', 'quân Đông Hán', 'triều Đông Hán'] },
  'dynasty_nha_dong_han': { entityId: 'dynasty_dong_han', canonicalName: 'nhà Đông Hán', aliases: ['Đông Hán', 'quân Đông Hán', 'triều Đông Hán'] },
  'dynasty_dong_ngo': { entityId: 'dynasty_dong_ngo', canonicalName: 'Đông Ngô', aliases: ['quân Đông Ngô', 'nhà Đông Ngô', 'triều Đông Ngô'] },
  'dynasty_nha_tien_ly': { entityId: 'dynasty_nha_tien_ly', canonicalName: 'nhà Tiền Lý', aliases: ['triều Tiền Lý', 'Tiền Lý'] },
  'dynasty_nha_le_so': { entityId: 'dynasty_nha_le_so', canonicalName: 'nhà Lê Sơ', aliases: ['triều Lê Sơ', 'Lê Sơ', 'triều Hậu Lê (Lê sơ)', 'Hậu Lê', 'nhà Hậu Lê'] },
  'dynasty_le_trung_hung': { entityId: 'dynasty_le_trung_hung', canonicalName: 'Lê Trung Hưng', aliases: ['thời Lê Trung Hưng', 'nhà Lê Trung Hưng', 'triều Lê Trung Hưng', 'triều đình Lê Trung Hưng', 'Lê Trung Hưng', 'thời kỳ Lê Trung Hưng'] },
  'dynasty_nha_hau_le': { entityId: 'dynasty_nha_le_so', canonicalName: 'nhà Hậu Lê', aliases: ['Hậu Lê', 'nhà Hậu Lê', 'triều Hậu Lê', 'thời Hậu Lê'] },
  'dynasty_nha_le': { entityId: 'dynasty_nha_le_so', canonicalName: 'nhà Lê', aliases: ['triều Lê', 'thời Lê', 'nhà Lê'] },
  'dynasty_viet_nam_dan_chu_cong_hoa': { entityId: 'dynasty_viet_nam_dan_chu_cong_hoa', canonicalName: 'Việt Nam Dân chủ Cộng hòa', aliases: [] },
  'dynasty_nha_duong': { entityId: 'dynasty_nha_duong', canonicalName: 'nhà Đường', aliases: ['triều Đường', 'Đường'] },
  'dynasty_nha_dinh': { entityId: 'dynasty_nha_dinh', canonicalName: 'nhà Đinh', aliases: ['triều Đinh', 'thời Đinh', 'Nhà Đinh', 'triều đại nhà Đinh'] },
  'dynasty_nha_tien_le': { entityId: 'dynasty_nha_tien_le', canonicalName: 'nhà Tiền Lê', aliases: ['triều Tiền Lê', 'thời Tiền Lê', 'Nhà Tiền Lê'] },
  'dynasty_nha_ly': { entityId: 'dynasty_nha_ly', canonicalName: 'nhà Lý', aliases: ['triều Lý', 'thời Lý', 'triều nhà Lý'] },
  'dynasty_nha_tran': { entityId: 'dynasty_nha_tran', canonicalName: 'nhà Trần', aliases: ['triều Trần', 'thời Trần', 'quân đội nhà Trần'] },
  'dynasty_nha_ho': { entityId: 'dynasty_nha_ho', canonicalName: 'nhà Hồ', aliases: ['triều Hồ', 'thời Hồ', 'Đại Ngu', 'quốc hiệu Đại Ngu'] },
  'dynasty_nha_nguyen': { entityId: 'dynasty_nha_nguyen', canonicalName: 'nhà Nguyễn', aliases: ['triều Nguyễn', 'thời Nguyễn', 'triều đại nhà Nguyễn'] },
  'dynasty_nha_tong': { entityId: 'dynasty_tong', canonicalName: 'quân Tống', aliases: ['nhà Tống', 'triều Tống'] },
  'dynasty_nha_minh': { entityId: 'dynasty_minh', canonicalName: 'nhà Minh', aliases: ['quân Minh', 'triều Minh'] },
  'dynasty_nha_mac': { entityId: 'dynasty_nha_mac', canonicalName: 'nhà Mạc', aliases: ['triều Mạc', 'thời Mạc'] },
  'dynasty_nha_ngo': { entityId: 'dynasty_nha_ngo', canonicalName: 'nhà Ngô', aliases: ['Nhà Ngô', 'triều Ngô', 'thời Ngô'] },
  'dynasty_bac_thuoc': { entityId: 'dynasty_bac_thuoc', canonicalName: 'thời kỳ Bắc thuộc', aliases: ['Bắc thuộc', 'thời Bắc thuộc', 'nghìn năm Bắc thuộc'] },
  'dynasty_cham_pa': { entityId: 'dynasty_cham_pa', canonicalName: 'Vương quốc Chăm-pa', aliases: ['Chăm-pa', 'Champa', 'Chăm', 'Chăm Pa', 'Chiêm Thành'] },
  'dynasty_phu_nam': { entityId: 'dynasty_phu_nam', canonicalName: 'Vương quốc Phù Nam', aliases: ['Phù Nam'] },
  'dynasty_hai_ba_trung': { entityId: 'dynasty_hai_ba_trung', canonicalName: 'Trưng Nữ Vương', aliases: ['Trưng Nữ Vương', 'Nữ Vương', 'thời kỳ Trưng Nữ Vương'] },
  'dynasty_dang_trong': { entityId: 'dynasty_dang_trong', canonicalName: 'Đàng Trong', aliases: ['xứ Đàng Trong', 'Đàng Trong'] },
  'dynasty_dang_ngoai': { entityId: 'dynasty_dang_ngoai', canonicalName: 'Đàng Ngoài', aliases: ['xứ Đàng Ngoài', 'Đàng Ngoài'] },
  'dynasty_chua_trinh': { entityId: 'dynasty_chua_trinh', canonicalName: 'Chúa Trịnh', aliases: ['chúa Trịnh', 'nhà Trịnh', 'họ Trịnh', 'cơ nghiệp Chúa Trịnh'] },
  'dynasty_chua_nguyen': { entityId: 'dynasty_chua_nguyen', canonicalName: 'Chúa Nguyễn', aliases: ['chúa Nguyễn', 'họ Nguyễn', 'cơ nghiệp Chúa Nguyễn'] },
  'dynasty_viet_nam': { entityId: 'dynasty_viet_nam', canonicalName: 'Việt Nam', aliases: ['nước Việt Nam', 'đất nước Việt Nam', 'Việt Nam'] },
  'culture_hoa_binh': { entityId: 'culture_hoa_binh', canonicalName: 'Văn hóa Hòa Bình', aliases: ['Văn hoá Hòa Bình', 'Văn hóa Hoà Bình'] },
  'culture_sa_huynh': { entityId: 'culture_sa_huynh', canonicalName: 'Văn hóa Sa Huỳnh', aliases: ['Văn hoá Sa Huỳnh'] },
};

export const CORE_ORGS: Array<{ id: string; name: string; aliases: string[] }> = [
  { id: 'org_quan_man_thanh', name: 'quân Mãn Thanh', aliases: ['quân Thanh', 'Mãn Thanh', 'quân nhà Thanh'] },
  { id: 'org_quan_nguyen_mong', name: 'quân Nguyên Mông', aliases: ['quân Mông Cổ', 'quân Nguyên', 'giặc Nguyên'] },
  { id: 'org_nghia_quan_lam_son', name: 'nghĩa quân Lam Sơn', aliases: ['quân Lam Sơn'] },
  { id: 'org_thien_phai_truc_lam', name: 'Thiền phái Trúc Lâm Yên Tử', aliases: ['Trúc Lâm Yên Tử', 'Thiền phái Trúc Lâm'] },
  { id: 'org_hoi_tao_dan', name: 'Hội Tao Đàn', aliases: ['Tao Đàn', 'Hội Tao Đàn', 'Tao Đàn nhị thập bát tú', 'hội Tao Đàn'] },
  { id: 'org_viet_nam_thanh_nien', name: 'Hội Việt Nam Cách mạng Thanh niên', aliases: ['Việt Nam Thanh niên Cách mạng Đồng chí Hội'] },
  { id: 'org_viet_nam_quoc_dan_dang', name: 'Việt Nam Quốc dân Đảng', aliases: [] },
  { id: 'org_quoc_su_quan', name: 'Quốc sử quán', aliases: ['Quốc sử quán triều Nguyễn', 'Quốc Sử Quán triều Nguyễn', 'Quốc Sử Quán', 'org_quoc_su_quan_trieu_nguyen'] },
  { id: 'org_hoi_duy_tan', name: 'Hội Duy Tân', aliases: ['Hội Duy tân', 'phong trào Duy Tân', 'Phong trào Duy Tân', 'Duy Tân'] },
  { id: 'org_dong_du', name: 'Phong trào Đông Du', aliases: ['phong trào Đông Du', 'Đông Du'] },
  { id: 'org_dang_cong_san_vn', name: 'Đảng Cộng sản Việt Nam', aliases: ['Đảng Cộng sản', 'Đảng', 'ĐCSVN', 'org_dang_cong_san_viet_nam', 'Đảng Cộng sản Việt Nam'] },
  { id: 'org_qdndvn', name: 'Quân đội Nhân dân Việt Nam', aliases: ['Quân đội nhân dân Việt Nam', 'quân đội nhân dân Việt Nam', 'QĐNDVN', 'quân đội ta'] },
  { id: 'org_doan_559', name: 'Đoàn 559', aliases: ['Bộ đội Trường Sơn', 'đoàn 559'] },
  { id: 'org_wto', name: 'Tổ chức Thương mại Thế giới', aliases: ['WTO', 'Tổ chức Thương mại Thế giới WTO', 'Tổ chức Thương mại Thế giới (WTO)'] },
  { id: 'org_tay_son', name: 'nghĩa quân Tây Sơn', aliases: ['quân Tây Sơn', 'thủy quân Tây Sơn', 'phong trào Tây Sơn', 'tượng binh Tây Sơn'] },
  { id: 'org_doi_hoang_sa', name: 'Đội Hoàng Sa', aliases: ['Hải đội Hoàng Sa', 'hải đội Hoàng Sa', 'org_hai_doi_hoang_sa', 'đội Hoàng Sa'] },
  { id: 'org_dong_kinh_nghia_thuc', name: 'Đông Kinh Nghĩa Thục', aliases: ['trường Đông Kinh Nghĩa Thục'] },
  { id: 'org_viet_nam_tuyen_truyen_giai_phong_quan', name: 'Đội Việt Nam Tuyên truyền Giải phóng quân', aliases: [] },
  { id: 'org_tay_ban_nha', name: 'Tây Ban Nha', aliases: ['liên quân Tây Ban Nha', 'quân Tây Ban Nha'] },
  { id: 'org_chinh_phu_cach_mang_lam_thoi', name: 'Chính phủ Cách mạng lâm thời Cộng hòa miền Nam Việt Nam', aliases: ['Chính phủ Cách mạng lâm thời', 'Chính phủ Cách mạng Lâm thời Cộng hòa miền Nam Việt Nam', 'Chính phủ lâm thời'] },
  { id: 'org_ngo_gia_van_phai', name: 'Ngô gia văn phái', aliases: ['Ngô Gia Văn Phái', 'nhóm Ngô gia văn phái'] },
  { id: 'org_hoi_van_hoa_cuu_quoc', name: 'Hội Văn hóa Cứu quốc Việt Nam', aliases: ['Hội Văn hóa Cứu quốc', 'Hội Văn Hóa Cứu Quốc', 'org_hoi_van_hoa_cuu_quoc_viet_nam'] },
  { id: 'org_tu_luc_van_doan', name: 'Tự Lực Văn Đoàn', aliases: ['Tự Lực văn đoàn', 'nhóm Tự Lực Văn Đoàn', 'Tự Lực Văn đoàn'] },
];

export const CORE_EVENTS: Array<{ id: string; name: string; aliases: string[]; timeRange?: { start?: number; end?: number } }> = [
  { id: 'event_dung_nuoc_van_lang', name: 'Sáng lập nhà nước Văn Lang', aliases: ['Dựng nước Văn Lang', 'Sáng lập Văn Lang'], timeRange: { start: -2879, end: -258 } },
  { id: 'event_khoi_nghia_hai_ba_trung', name: 'Khởi nghĩa Hai Bà Trưng', aliases: ['Khởi nghĩa Mê Linh'], timeRange: { start: 40, end: 43 } },
  { id: 'event_khoi_nghia_ba_trieu', name: 'Khởi nghĩa Bà Triệu', aliases: [], timeRange: { start: 248, end: 248 } },
  { id: 'event_khoi_nghia_ly_bi', name: 'Khởi nghĩa Lý Bí', aliases: ['Khởi nghĩa Vạn Xuân'], timeRange: { start: 542, end: 548 } },
  { id: 'event_bach_dang_938', name: 'Chiến thắng Bạch Đằng năm 938', aliases: ['Trận Bạch Đằng (938)', 'Trận Bạch Đằng năm 938', 'Chiến thắng Bạch Đằng 938', 'Trận Bạch Đằng 938', 'Bạch Đằng 938'], timeRange: { start: 938, end: 938 } },
  { id: 'event_bach_dang_981', name: 'Trận Bạch Đằng năm 981', aliases: ['Trận Bạch Đằng (981)', 'Chiến thắng Bạch Đằng 981', 'Trận Bạch Đằng 981', 'Bạch Đằng 981', 'Kháng chiến chống Tống lần thứ nhất', 'Kháng chiến chống Tống năm 981', 'Kháng chiến chống Tống (981)', 'Lê Hoàn phá Tống', 'Lê Đại Hành phá Tống'], timeRange: { start: 981, end: 981 } },
  { id: 'event_bach_dang_1288', name: 'Trận Bạch Đằng năm 1288', aliases: ['Trận Bạch Đằng (1288)', 'Chiến thắng Bạch Đằng 1288', 'Đại thắng Bạch Đằng 1288', 'Trận Bạch Đằng 1288', 'Bạch Đằng 1288'], timeRange: { start: 1288, end: 1288 } },
  { id: 'event_dep_loan_12_su_quan', name: 'Dẹp loạn 12 sứ quân', aliases: [], timeRange: { start: 966, end: 968 } },
  { id: 'event_khoi_nghia_lam_son', name: 'Khởi nghĩa Lam Sơn', aliases: [], timeRange: { start: 1418, end: 1427 } },
  { id: 'event_chi_lang_xuong_giang', name: 'Chiến dịch Chi Lăng - Xương Giang', aliases: ['Trận Chi Lăng - Xương Giang', 'Chi Lăng - Xương Giang'], timeRange: { start: 1427, end: 1427 } },
  { id: 'event_hoi_the_dong_quan', name: 'Hội thề Đông Quan', aliases: [], timeRange: { start: 1427, end: 1427 } },
  { id: 'event_ngoc_hoi_dong_da', name: 'Trận Ngọc Hồi - Đống Đa', aliases: ['Chiến thắng Ngọc Hồi - Đống Đa', 'Đại thắng Ngọc Hồi - Đống Đa', 'Ngọc Hồi - Đống Đa', 'Trận Đống Đa', 'trận Đống Đa'], timeRange: { start: 1789, end: 1789 } },
  { id: 'event_dien_bien_phu', name: 'Chiến dịch Điện Biên Phủ', aliases: ['Trận Điện Biên Phủ', 'chiến dịch Điện Biên Phủ', 'Điện Biên Phủ 1954', 'Chiến dịch Điện Biên Phủ 1954', 'Chiến thắng Điện Biên Phủ', 'chiến thắng Điện Biên Phủ', 'Kéo pháo', 'kéo pháo', 'hò kéo pháo', 'kéo pháo vào kéo pháo ra', 'kéo pháo vào', 'kéo pháo ra'], timeRange: { start: 1954, end: 1954 } },
  { id: 'event_keo_phao_dien_bien_phu', name: 'Kéo pháo vào kéo pháo ra', aliases: ['Kéo pháo', 'kéo pháo', 'hò kéo pháo', 'kéo pháo vào kéo pháo ra', 'kéo pháo vào', 'kéo pháo ra'], timeRange: { start: 1954, end: 1954 } },
  { id: 'event_bien_gioi_1950', name: 'Chiến dịch Biên giới Thu Đông 1950', aliases: ['Chiến dịch Biên giới 1950', 'Chiến dịch Biên giới', 'Chiến dịch Biên Giới Thu Đông 1950'], timeRange: { start: 1950, end: 1950 } },
  { id: 'event_chien_dich_ho_chi_minh', name: 'Chiến dịch Hồ Chí Minh', aliases: ['Chiến dịch Hồ Chí Minh 1975'], timeRange: { start: 1975, end: 1975 } },
  { id: 'event_30_thang_4_1975', name: 'Sự kiện 30 tháng 4 năm 1975', aliases: ['30 tháng 4 năm 1975', 'Ngày Giải phóng miền Nam 30/4/1975'], timeRange: { start: 1975, end: 1975 } },
  { id: 'event_hoi_nghi_dien_hong', name: 'Hội nghị Diên Hồng', aliases: ['Hội nghị Diên Hồng 1284', 'Diên Hồng'], timeRange: { start: 1284, end: 1284 } },
  { id: 'event_hoi_nghi_binh_than', name: 'Hội nghị Bình Than', aliases: ['Hội nghị Bình Than 1282', 'Bình Than'], timeRange: { start: 1282, end: 1282 } },
  { id: 'event_phong_tuyen_nhu_nguyet', name: 'Trận phòng tuyến sông Như Nguyệt', aliases: ['phòng tuyến sông Như Nguyệt'], timeRange: { start: 1077, end: 1077 } },
  { id: 'event_tot_dong_chuc_dong', name: 'Trận Tốt Động - Chúc Động', aliases: ['Tốt Động - Chúc Động'], timeRange: { start: 1426, end: 1426 } },
  { id: 'event_rach_gam_xoai_mut', name: 'Trận Rạch Gầm - Xoài Mút', aliases: ['Rạch Gầm - Xoài Mút'], timeRange: { start: 1785, end: 1785 } },
  { id: 'event_ban_dao_son_tra', name: 'Trận bán đảo Sơn Trà', aliases: ['Bán đảo Sơn Trà'], timeRange: { start: 1858, end: 1858 } },
  { id: 'event_khang_chien_nam_ky', name: 'Kháng chiến Nam Kỳ', aliases: ['Kháng chiến Nam Kỳ', 'kháng chiến Nam Kỳ', 'chống Pháp ở Nam Kỳ', 'phong trào chống Pháp ở Nam Kỳ', 'khởi nghĩa Nam Kỳ chống Pháp'], timeRange: { start: 1859, end: 1867 } },
  { id: 'event_khoi_nghia_truong_dinh', name: 'Khởi nghĩa Trương Định', aliases: ['Khởi nghĩa Trương Định', 'khởi nghĩa Trương Định', 'khởi nghĩa Gò Công'], timeRange: { start: 1859, end: 1864 } },
  { id: 'event_phong_trao_can_vuong', name: 'Phong trào Cần Vương', aliases: ['Cần Vương'], timeRange: { start: 1885, end: 1896 } },
  { id: 'event_dong_du', name: 'Phong trào Đông Du', aliases: ['Đông Du'], timeRange: { start: 1905, end: 1908 } },
  { id: 'event_duy_tan_phan_chu_trinh', name: 'Phong trào Duy Tân', aliases: ['Duy Tân'], timeRange: { start: 1906, end: 1908 } },
  { id: 'event_khoi_nghia_yen_bai', name: 'Khởi nghĩa Yên Bái', aliases: ['cuộc Khởi nghĩa Yên Bái'], timeRange: { start: 1930, end: 1930 } },
  { id: 'event_dong_khoi', name: 'Phong trào Đồng Khởi', aliases: ['Đồng khởi', 'Đồng Khởi', 'Phong trào Đồng Khởi năm 1960', 'phong trào Đồng khởi năm 1960', 'phong trào Đồng khởi', 'Đồng khởi 1960', 'event_dong_khoi_1960'], timeRange: { start: 1960, end: 1960 } },
  { id: 'event_linebacker_2', name: 'Trận Điện Biên Phủ trên không', aliases: ['Điện Biên Phủ trên không', 'Trận Điện Biên Phủ trên không năm 1972', 'Điện Biên Phủ trên không 1972', 'event_dien_bien_phu_tren_khong_1972', 'Linebacker II'], timeRange: { start: 1972, end: 1972 } },
  { id: 'event_gac_ma_1988', name: 'Trận Gạc Ma', aliases: ['Gạc Ma'], timeRange: { start: 1988, end: 1988 } },
  { id: 'event_dong_bo_dau_1258', name: 'Chiến thắng Đông Bộ Đầu năm 1258', aliases: ['Trận Đông Bộ Đầu', 'Đông Bộ Đầu 1258'], timeRange: { start: 1258, end: 1258 } },
  { id: 'event_khoi_nghia_ba_dinh', name: 'Khởi nghĩa Ba Đình', aliases: ['căn cứ Ba Đình'], timeRange: { start: 1886, end: 1887 } },
  { id: 'event_khoi_nghia_huong_khe', name: 'Khởi nghĩa Hương Khê', aliases: ['khởi nghĩa Hương Khê', 'cuộc khởi nghĩa Hương Khê'], timeRange: { start: 1885, end: 1896 } },
  { id: 'event_khoi_nghia_yen_the', name: 'Khởi nghĩa Yên Thế', aliases: ['khởi nghĩa Yên Thế', 'cuộc khởi nghĩa Yên Thế'], timeRange: { start: 1884, end: 1913 } },
  { id: 'event_viet_bac_1947', name: 'Chiến dịch Việt Bắc Thu Đông 1947', aliases: ['Chiến dịch Việt Bắc'], timeRange: { start: 1947, end: 1947 } },
  { id: 'event_mau_than_1968', name: 'Tổng tiến công và nổi dậy Tết Mậu Thân 1968', aliases: ['Tết Mậu Thân 1968', 'Tết Mậu Thân', 'event_tet_mau_than_1968'], timeRange: { start: 1968, end: 1968 } },
  { id: 'event_chien_dich_tay_nguyen_1975', name: 'Chiến dịch Tây Nguyên', aliases: ['Chiến dịch Tây Nguyên 1975'], timeRange: { start: 1975, end: 1975 } },
  { id: 'event_dai_hoi_vi', name: 'Đại hội VI', aliases: ['Đại hội Đảng VI', 'Đại hội VI Đảng Cộng sản Việt Nam', 'Đại hội 6'], timeRange: { start: 1986, end: 1986 } },
  { id: 'event_van_don', name: 'Trận Vân Đồn', aliases: ['Trận Vân Đồn năm 1288', 'Vân Đồn', 'event_tran_van_don'], timeRange: { start: 1288, end: 1288 } },
  { id: 'event_bo_co', name: 'Trận Bô Cô', aliases: ['Trận Bô Cô năm 1408', 'Bô Cô', 'event_tran_bo_co'], timeRange: { start: 1408, end: 1408 } },
  { id: 'event_bien_gioi_1979', name: 'Chiến tranh biên giới phía Bắc', aliases: ['chiến tranh biên giới phía Bắc', 'Chiến tranh biên giới 1979', 'Cuộc chiến đấu bảo vệ biên giới phía Bắc', 'biên giới 1979'] },
  { id: 'event_bien_gioi_tay_nam', name: 'Chiến tranh biên giới Tây Nam', aliases: ['chiến tranh biên giới Tây Nam', 'chiến dịch phản công bảo vệ biên giới Tây Nam'] },
  { id: 'event_30_thang_4_1975', name: 'Ngày 30 tháng 4 năm 1975', aliases: ['30 tháng 4 năm 1975', '30/4/1975', 'ngày 30 tháng 4 năm 1975'] },
  { id: 'event_duong_day_500kv', name: 'Đường dây 500kV Bắc - Nam', aliases: ['Đường dây 500 kV Bắc - Nam', 'Đường dây 500kV', 'đường dây 500kV Bắc - Nam', 'đường dây 500kV'] },
  { id: 'event_doi_moi', name: 'Công cuộc Đổi mới', aliases: ['Đổi mới', 'thời kỳ Đổi mới', 'công cuộc Đổi mới'] },
  { id: 'event_khoa_thi_tam_khoi', name: 'Khoa thi Tam khôi', aliases: ['khoa thi Tam khôi', 'Tam khôi', 'khoa thi Tam Khôi', 'event_tam_khoi'] },
  { id: 'event_khoa_thi_thai_hoc_sinh', name: 'Khoa thi Thái học sinh', aliases: ['khoa thi Thái học sinh'] },
  { id: 'event_khoa_thi_1075', name: 'Khoa thi Minh kinh bác học năm 1075', aliases: ['khoa thi Minh kinh bác học', 'khoa thi năm 1075'] },
  { id: 'concept_hao_khi_dong_a', name: 'Hào khí Đông A', aliases: ['hào khí Đông A', 'tinh thần Đông A', 'hào khí thời Trần', 'khí phách Đông A', 'concept_hao_khi_dong_a'], timeRange: { start: 1225, end: 1400 } },
  { id: 'concept_tam_giao_dong_nguyen', name: 'Tam giáo đồng nguyên', aliases: ['Tam giáo đồng nguyên', 'tam giáo đồng nguyên', 'tam giáo', 'Nho Phật Đạo song hành', 'concept_tam_giao_dong_nguyen'], timeRange: { start: 1009, end: 1400 } },
  { id: 'concept_khoa_cu', name: 'Khoa cử', aliases: ['khoa cử', 'chế độ khoa cử', 'khoa thi', 'khoa bảng', 'thi cử'], timeRange: { start: 1075, end: 1919 } },
];

export const CORE_ARTIFACTS: Array<{ id: string; name: string; aliases: string[] }> = [
  { id: 'artifact_trong_dong_dong_son', name: 'Trống đồng Đông Sơn', aliases: ['Trống đồng Ngọc Lũ', 'Trống đồng Sông Đà', 'Trống đồng Hoàng Hạ'] },
  { id: 'artifact_no_lien_chau', name: 'Nỏ Liên Châu', aliases: ['Nỏ thần', 'Nỏ thần Liên Châu'] },
  { id: 'artifact_thong_bao_hoi_sao', name: 'Thông Bảo Hội Sao', aliases: ['tiền Thông Bảo Hội Sao', 'Thông bảo hội sao', 'tiền giấy Thông bảo hội sao', 'tiền giấy'] },
  { id: 'artifact_xe_tang_390', name: 'Xe tăng 390', aliases: [] },
  { id: 'artifact_thai_binh_hung_bao', name: 'Thái Bình Hưng Bảo', aliases: ['tiền Thái Bình Hưng Bảo', 'tiền Thái Bình', 'Thái Bình hưng bảo', 'artifact_tien_thai_binh'] },
  { id: 'artifact_sung_than_co', name: 'súng Thần cơ Thương pháo', aliases: ['Súng Thần Cơ', 'súng Thần cơ'] },
  { id: 'artifact_cuu_dinh', name: 'Cửu Đỉnh', aliases: ['Cửu đỉnh', 'Cửu Đỉnh Huế'] },
  { id: 'artifact_sung_truong_cao_thang', name: 'Súng trường kiểu Pháp', aliases: ['súng trường kiểu Pháp', 'súng trường Cao Thắng', 'súng trường 1874', 'súng trường'] },
];

export const CORE_DOCS: Array<{
  id: string;
  name: string;
  aliases: string[];
  author?: string;
  dynasty?: string;
  year?: number;
  adversary?: string;
  context?: string;
}> = [
  {
    id: 'doc_chieu_doi_do',
    name: 'Chiếu dời đô',
    aliases: ['Thiên đô chiếu', 'doc_chieu_doi_do'],
    author: 'Lý Thái Tổ (Lý Công Uẩn)',
    dynasty: 'Nhà Lý',
    year: 1010,
    context: 'Vua Lý Thái Tổ quyết định dời đô từ cố đô Hoa Lư về thành Đại La (sau đổi là Thăng Long) mở ra thời kỳ hưng thịnh lâu dài của quốc gia Đại Việt.',
  },
  {
    id: 'doc_hich_tuong_si',
    name: 'Hịch tướng sĩ',
    aliases: ['Dụ chư tì tướng hịch văn', 'doc_hich_tuong_si'],
    author: 'Trần Hưng Đạo (Tiết chế Quốc công Trần Quốc Tuấn)',
    dynasty: 'Nhà Trần',
    year: 1285,
    adversary: 'Quân xâm lược Nguyên Mông (Nhà Nguyên)',
    context: 'Kêu gọi tinh thần yêu nước, lòng trung quân ái quốc và ý chí quyết chiến quyết thắng của các tướng sĩ trước cuộc kháng chiến chống quân Nguyên Mông lần thứ hai.',
  },
  {
    id: 'doc_binh_ngo_dai_cao',
    name: 'Bình Ngô đại cáo',
    aliases: ['Bình Ngô Đại Cáo', 'bài cáo Bình Ngô', 'doc_binh_ngo_dai_cao', 'doc_binh_ngo'],
    author: 'Nguyễn Trãi (thay lời Bình Định Vương Lê Lợi)',
    dynasty: 'Nhà Hậu Lê (Lê sơ)',
    year: 1428,
    adversary: 'Quân xâm lược Nhà Minh (giặc Minh)',
    context: 'Bản tuyên ngôn độc lập thứ hai, tổng kết thắng lợi oanh liệt của cuộc Khởi nghĩa Lam Sơn (1418 - 1427) đánh đuổi 15 vạn viện binh giặc Minh do Liễu Thăng, Mộc Thạnh chỉ huy, khôi phục nền độc lập thái bình cho Đại Việt.',
  },
  {
    id: 'doc_tuyen_ngon_doc_lap',
    name: 'Tuyên ngôn Độc lập',
    aliases: ['Bản Tuyên ngôn Độc lập', 'Bản Tuyên ngôn độc lập', 'doc_tuyen_ngon_doc_lap'],
    author: 'Chủ tịch Hồ Chí Minh',
    dynasty: 'Việt Nam Dân chủ Cộng hòa',
    year: 1945,
    adversary: 'Thực dân Pháp và Phát xít Nhật',
    context: 'Đọc ngày 2/9/1945 tại Quảng trường Ba Đình, Hà Nội, khai sinh ra nước Việt Nam Dân chủ Cộng hòa, chấm dứt hơn 80 năm ách thống trị của thực dân Pháp và xóa bỏ chế độ phong kiến.',
  },
  {
    id: 'doc_nam_quoc_son_ha',
    name: 'Nam quốc sơn hà',
    aliases: ['Bài thơ thần Nam quốc sơn hà', 'bài thơ thần Nam quốc sơn hà', 'Thơ thần', 'bài thơ thần', 'Sông núi nước Nam', 'bài thơ Sông núi nước Nam', 'doc_nam_quoc_son_ha'],
    author: 'Lý Thường Kiệt (tương truyền)',
    dynasty: 'Nhà Lý',
    year: 1077,
    adversary: 'Quân xâm lược Nhà Tống (Quách Quỳ, Triệu Tiết)',
    context: 'Bản tuyên ngôn độc lập đầu tiên của dân tộc, khẳng định chủ quyền lãnh thổ trên phòng tuyến sông Như Nguyệt trong cuộc kháng chiến chống Tống (1075 - 1077).',
  },
  { id: 'doc_hinh_thu', name: 'Hình thư', aliases: ['sách Hình thư', 'luật Hình thư', 'Hình thư thời Lý', 'doc_hinh_thu'] },
  { id: 'doc_luat_hong_duc', name: 'Luật Hồng Đức', aliases: ['Quốc triều hình luật', 'Bộ luật Quốc triều hình luật', 'Bộ Quốc triều hình luật', 'bộ luật Quốc triều hình luật', 'doc_quoc_trieu_hinh_luat', 'bộ luật Hồng Đức', 'Bộ luật Hồng Đức', 'Bộ Luật Hồng Đức'] },
  { id: 'doc_dai_viet_su_ky', name: 'Đại Việt Sử Ký', aliases: ['Đại Việt sử ký', 'sách Đại Việt Sử Ký', 'bộ Đại Việt sử ký', 'doc_dai_viet_su_ky'] },
  { id: 'doc_dai_viet_su_ky_toan_thu', name: 'Đại Việt sử ký toàn thư', aliases: ['sách Đại Việt Sử Ký Toàn Thư', 'Đại Việt Sử Ký Toàn Thư', 'bộ Đại Việt sử ký toàn thư', 'bộ Đại Việt Sử Ký Toàn Thư', 'doc_dai_viet_su_ky_toan_thu'] },
  { id: 'doc_dai_nam_thuc_luc', name: 'Đại Nam thực lục', aliases: [] },
  { id: 'doc_kham_dinh_viet_su_thong_giam_cuong_muc', name: 'Khâm định Việt sử thông giám cương mục', aliases: ['Khâm định Việt sử', 'Cương Mục', 'Việt sử thông giám cương mục'] },
  { id: 'doc_hiep_dinh_geneve_1954', name: 'Hiệp định Genève', year: 1954, aliases: ['Hiệp định Geneva', 'Hiệp định Giơ-ne-vơ', 'Giơ-ne-vơ', 'Genève', 'hội nghị Genève', 'doc_hiep_dinh_geneve'] },
  { id: 'doc_that_tram_so', name: 'Thất trảm sớ', aliases: [] },
  { id: 'doc_hong_duc_ban_do', name: 'Hồng Đức bản đồ', aliases: ['bản đồ Hồng Đức', 'Bản đồ Hồng Đức', 'Hồng Đức bản đồ'] },
  { id: 'doc_chieu_cau_hien', name: 'Chiếu Cầu Hiền', aliases: ['Chiếu cầu hiền', 'Chiếu khuyến học'] },
  { id: 'doc_chieu_can_vuong', name: 'Chiếu Cần Vương', aliases: ['chiếu Cần Vương', 'Dụ Cần Vương'] },
  { id: 'doc_hoang_trieu_luat_le', name: 'Hoàng triều luật lệ', aliases: ['Luật Gia Long', 'bộ luật Gia Long', 'doc_luat_gia_long', 'Hoàng Việt luật lệ', 'bộ luật Hoàng Việt luật lệ', 'doc_hoang_viet_luat_le'] },
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
  { id: 'doc_hoang_le_nhat_thong_chi', name: 'Hoàng Lê nhất thống chí', aliases: ['Hoàng Lê Nhất Thống Chí', 'sách Hoàng Lê nhất thống chí', 'Hoàng Lê nhất thống chí', 'doc_hoang_le_nhat_thong_chi'] },
  { id: 'doc_binh_ngo_sach', name: 'Bình Ngô sách', aliases: ['Bình Ngô Sách', 'doc_binh_ngo_sach'] },
  { id: 'doc_lam_son_thuc_luc', name: 'Lam Sơn thực lục', aliases: ['Lam Sơn Thực Lục', 'tác phẩm Lam Sơn thực lục', 'doc_lam_son_thuc_luc'] },
  { id: 'doc_truyen_kieu', name: 'Truyện Kiều', aliases: ['Đoạn trường tân thanh', 'truyện Kiều', 'doc_truyen_kieu'] },
  { id: 'doc_de_cuong_van_hoa_1943', name: 'Đề cương Văn hóa Việt Nam', aliases: ['Đề cương Văn hóa Việt Nam 1943', 'Đề cương Văn hóa', 'Đề cương văn hóa 1943', 'Đề cương văn hóa'] },
  { id: 'doc_thi_nhan_viet_nam', name: 'Thi nhân Việt Nam', aliases: ['cuốn Thi nhân Việt Nam', 'sách Thi nhân Việt Nam'] },
  { id: 'doc_tinh_gia', name: 'Tình già', aliases: ['bài thơ Tình già'] },
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
    register(person.entityId, person.entityId, person.canonicalName);
    register(person.canonicalName, person.entityId, person.canonicalName);
    for (const alias of person.aliases) {
      register(alias, person.entityId, person.canonicalName);
    }
  }

  for (const dyn of Object.values(DYNASTY_DICTIONARY)) {
    register(dyn.entityId, dyn.entityId, dyn.canonicalName);
    register(dyn.canonicalName, dyn.entityId, dyn.canonicalName);
    for (const alias of dyn.aliases) {
      register(alias, dyn.entityId, dyn.canonicalName);
    }
  }

  for (const org of CORE_ORGS) {
    register(org.id, org.id, org.name);
    register(org.name, org.id, org.name);
    for (const alias of org.aliases) {
      register(alias, org.id, org.name);
    }
  }

  const AMBIGUOUS_SINGLE_WORD_LOCS = new Set(['tiền', 'hậu', 'đà', 'hồng', 'mã', 'cả', 'lô', 'thao', 'đáy', 'hương', 'tranh', 'gianh', 'vệ', 'thầy']);
  for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    register(loc.entityId, loc.entityId, loc.canonicalName);
    register(loc.canonicalName, loc.entityId, loc.canonicalName);
    const stripped = loc.canonicalName.replace(/^(lũy|chiến lũy|thành|sông|núi|ải|phủ|đồn|xứ|cố đô|kinh đô|kinh thành|tỉnh|huyện|làng|căn cứ)\s+/i, '');
    if (stripped !== loc.canonicalName && stripped.toLowerCase() !== 'nhà hồ' && stripped.toLowerCase() !== 'huế' && !AMBIGUOUS_SINGLE_WORD_LOCS.has(stripped.toLowerCase())) {
      register(stripped, loc.entityId, loc.canonicalName);
    }
    for (const alias of loc.aliases) {
      register(alias, loc.entityId, loc.canonicalName);
      const strippedAlias = alias.replace(/^(lũy|chiến lũy|thành|sông|núi|ải|phủ|đồn|xứ|cố đô|kinh đô|kinh thành|tỉnh|huyện|làng|căn cứ)\s+/i, '');
      if (strippedAlias !== alias && strippedAlias.toLowerCase() !== 'nhà hồ' && strippedAlias.toLowerCase() !== 'huế' && !AMBIGUOUS_SINGLE_WORD_LOCS.has(strippedAlias.toLowerCase())) {
        register(strippedAlias, loc.entityId, loc.canonicalName);
      }
    }
  }

  for (const ev of CORE_EVENTS) {
    register(ev.id, ev.id, ev.name);
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
    register(art.id, art.id, art.name);
    register(art.name, art.id, art.name);
    for (const al of art.aliases) {
      register(al, art.id, art.name);
    }
  }

  for (const d of CORE_DOCS) {
    register(d.id, d.id, d.name);
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
  register('Lê Trung Hưng', 'dynasty_le_trung_hung', 'Lê Trung Hưng');
  register('triều đình Lê Trung Hưng', 'dynasty_le_trung_hung', 'Lê Trung Hưng');
  register('thời Lê Trung Hưng', 'dynasty_le_trung_hung', 'Lê Trung Hưng');
  register('dynasty_le_trung_hung', 'dynasty_le_trung_hung', 'Lê Trung Hưng');
  register('Hà Tây', 'loc_ha_tay', 'Hà Tây');
  register('tỉnh Hà Tây', 'loc_ha_tay', 'Hà Tây');
  register('loc_ha_tay', 'loc_ha_tay', 'Hà Tây');
  register('Ba Đình', 'loc_ba_dinh', 'Quảng trường Ba Đình');
  register('Quảng trường Ba Đình', 'loc_ba_dinh', 'Quảng trường Ba Đình');
  register('quảng trường Ba Đình', 'loc_ba_dinh', 'Quảng trường Ba Đình');
  register('loc_ba_dinh', 'loc_ba_dinh', 'Quảng trường Ba Đình');
  register('Phong Khê', 'loc_phong_khe', 'Phong Khê');
  register('đất Phong Khê', 'loc_phong_khe', 'Phong Khê');
  register('loc_phong_khe', 'loc_phong_khe', 'Phong Khê');
  register('Tây Đô', 'loc_tay_do', 'Tây Đô');
  register('đất Tây Đô', 'loc_tay_do', 'Tây Đô');
  register('loc_tay_do', 'loc_tay_do', 'Tây Đô');
  register('Cần Thơ', 'loc_can_tho', 'Cần Thơ');
  register('thành phố Cần Thơ', 'loc_can_tho', 'Cần Thơ');
  register('loc_can_tho', 'loc_can_tho', 'Cần Thơ');
  register('Văn Miếu', 'loc_van_mieu', 'Văn Miếu');
  register('Văn Miếu Thăng Long', 'loc_van_mieu', 'Văn Miếu');
  register('loc_van_mieu', 'loc_van_mieu', 'Văn Miếu');
  register('Thế Miếu', 'loc_the_mieu', 'Thế Miếu');
  register('sân Thế Miếu', 'loc_the_mieu', 'Thế Miếu');
  register('loc_the_mieu', 'loc_the_mieu', 'Thế Miếu');
  register('lũy Thầy', 'loc_luy_thay', 'lũy Thầy');
  register('Lũy Thầy', 'loc_luy_thay', 'lũy Thầy');
  register('loc_luy_thay', 'loc_luy_thay', 'lũy Thầy');
  register('lũy Đào Duy Từ', 'loc_luy_thay', 'lũy Thầy');
  register('Lũy Đào Duy Từ', 'loc_luy_thay', 'lũy Thầy');
  register('chiến lũy Thầy', 'loc_luy_thay', 'lũy Thầy');
  register('Chiến lũy Thầy', 'loc_luy_thay', 'lũy Thầy');
  register('Lũy Nhật Lệ', 'loc_luy_thay', 'lũy Thầy');
  register('lũy Nhật Lệ', 'loc_luy_thay', 'lũy Thầy');
  register('Lũy Trường Dục', 'loc_luy_thay', 'lũy Thầy');
  register('lũy Trường Dục', 'loc_luy_thay', 'lũy Thầy');
  register('person_bo_cai_dai_vuong', 'person_phung_hung', 'Phùng Hưng');
  register('Bố Cái Đại Vương', 'person_phung_hung', 'Phùng Hưng');
  register('Bình Ngô sách', 'doc_binh_ngo_sach', 'Bình Ngô sách');
  register('doc_binh_ngo_sach', 'doc_binh_ngo_sach', 'Bình Ngô sách');
  register('nghĩa quân Lam Sơn', 'org_nghia_quan_lam_son', 'nghĩa quân Lam Sơn');
  register('Nghĩa quân Lam Sơn', 'org_nghia_quan_lam_son', 'nghĩa quân Lam Sơn');
  register('org_nghia_quan_lam_son', 'org_nghia_quan_lam_son', 'nghĩa quân Lam Sơn');
  register('org_dang_cong_san_viet_nam', 'org_dang_cong_san_vn', 'Đảng Cộng sản Việt Nam');
  register('Việt Nam', 'dynasty_viet_nam', 'Việt Nam');
  register('Triều Tiên', 'loc_trieu_tien', 'Triều Tiên');
  register('thành Đại La', 'loc_thang_long', 'Thăng Long');
  register('Đại La', 'loc_thang_long', 'Thăng Long');
  register('loc_dai_la', 'loc_thang_long', 'Thăng Long');
  register('phủ Thừa Thiên', 'loc_thua_thien', 'Thừa Thiên');
  register('Thủy điện Hòa Bình', 'loc_thuy_dien_hoa_binh', 'Thủy điện Hòa Bình');
  register('loc_thuy_dien_hoa_binh', 'loc_thuy_dien_hoa_binh', 'Thủy điện Hòa Bình');
  register('Nhà máy Thủy điện Hòa Bình', 'loc_thuy_dien_hoa_binh', 'Thủy điện Hòa Bình');
  register('Nhà máy thủy điện Hòa Bình', 'loc_thuy_dien_hoa_binh', 'Thủy điện Hòa Bình');
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
  register('Đại Ngu', 'dynasty_nha_ho', 'nhà Hồ');
  register('dynasty_dai_ngu', 'dynasty_nha_ho', 'nhà Hồ');
  register('person_chua_tien', 'person_nguyen_hoang', 'Nguyễn Hoàng');
  register('Chúa Tiên', 'person_nguyen_hoang', 'Nguyễn Hoàng');
  register('chúa Tiên', 'person_nguyen_hoang', 'Nguyễn Hoàng');
  register('person_canh_thinh', 'person_nguyen_quang_toan', 'Nguyễn Quang Toản');
  register('Cảnh Thịnh', 'person_nguyen_quang_toan', 'Nguyễn Quang Toản');
  register('artifact_tien_thai_binh', 'artifact_thai_binh_hung_bao', 'Thái Bình Hưng Bảo');
  register('tiền Thái Bình Hưng Bảo', 'artifact_thai_binh_hung_bao', 'Thái Bình Hưng Bảo');
  register('tiền Thái Bình', 'artifact_thai_binh_hung_bao', 'Thái Bình Hưng Bảo');
  register('Thái Bình Hưng Bảo', 'artifact_thai_binh_hung_bao', 'Thái Bình Hưng Bảo');
  register('Nhà Rồng', 'loc_nha_rong', 'bến Nhà Rồng');
  register('bến Nhà Rồng', 'loc_nha_rong', 'bến Nhà Rồng');
  register('Bến Nhà Rồng', 'loc_nha_rong', 'bến Nhà Rồng');
  register('loc_ben_nha_rong', 'loc_nha_rong', 'bến Nhà Rồng');
  register('Vũ Quang', 'loc_vu_quang', 'Vũ Quang');
  register('căn cứ Vũ Quang', 'loc_vu_quang', 'Vũ Quang');
  register('Vụ Quang', 'loc_vu_quang', 'Vũ Quang');
  register('căn cứ Vụ Quang', 'loc_vu_quang', 'Vũ Quang');
  register('loc_can_cu_vu_quang', 'loc_vu_quang', 'Vũ Quang');
  register('Khoa cử', 'concept_khoa_cu', 'Khoa cử');
  register('khoa cử', 'concept_khoa_cu', 'Khoa cử');
  register('chế độ khoa cử', 'concept_khoa_cu', 'Khoa cử');
  register('Súng trường kiểu Pháp', 'artifact_sung_truong_cao_thang', 'Súng trường kiểu Pháp');
  register('súng trường kiểu Pháp', 'artifact_sung_truong_cao_thang', 'Súng trường kiểu Pháp');
  register('súng trường Cao Thắng', 'artifact_sung_truong_cao_thang', 'Súng trường kiểu Pháp');
  register('Đường Trường Sơn', 'loc_duong_truong_son', 'đường Trường Sơn');
  register('đường Trường Sơn', 'loc_duong_truong_son', 'đường Trường Sơn');
  register('loc_duong_truong_son', 'loc_duong_truong_son', 'đường Trường Sơn');
  register('Đường mòn Hồ Chí Minh', 'loc_duong_mon_ho_chi_minh', 'đường mòn Hồ Chí Minh');
  register('đường mòn Hồ Chí Minh', 'loc_duong_mon_ho_chi_minh', 'đường mòn Hồ Chí Minh');
  register('loc_duong_mon_ho_chi_minh', 'loc_duong_mon_ho_chi_minh', 'đường mòn Hồ Chí Minh');
  register('loc_thanh_tay_do', 'loc_thanh_nha_ho', 'Thành nhà Hồ');
  register('loc_co_do_hoa_lu', 'loc_hoa_lu', 'Hoa Lư');
  register('loc_thanh_hoa_lu', 'loc_hoa_lu', 'Hoa Lư');
  register('cố đô Hoa Lư', 'loc_hoa_lu', 'Hoa Lư');
  register('loc_ha_noi', 'loc_ha_noi', 'Hà Nội');
  register('Hà Nội', 'loc_ha_noi', 'Hà Nội');
  register('thành phố Hà Nội', 'loc_ha_noi', 'Hà Nội');
  register('Thành phố Hà Nội', 'loc_ha_noi', 'Hà Nội');
  register('loc_dong_kinh', 'loc_dong_kinh', 'Đông Kinh');
  register('loc_dong_do', 'loc_thang_long', 'Thăng Long');
  register('loc_co_loa', 'loc_thanh_co_loa', 'thành Cổ Loa');
  register('loc_thanh_co_loa', 'loc_thanh_co_loa', 'thành Cổ Loa');
  register('person_thuc_phan', 'person_an_duong_vuong', 'An Dương Vương');
  register('person_le_thai_to', 'person_le_loi', 'Lê Lợi');
  register('Lê Thái Tổ', 'person_le_loi', 'Lê Lợi');
  register('person_nguyen_hue', 'person_quang_trung', 'Quang Trung');
  register('person_nguyen_anh', 'person_gia_long', 'Gia Long');
  register('person_tran_quoc_tuan', 'person_tran_hung_dao', 'Trần Hưng Đạo');
  register('person_dinh_bo_linh', 'person_dinh_tien_hoang', 'Đinh Tiên Hoàng');
  register('person_le_hoan', 'person_le_dai_hanh', 'Lê Đại Hành');
  register('person_duong_van_nga', 'person_duong_van_nga', 'Dương Vân Nga');
  register('Dương Vân Nga', 'person_duong_van_nga', 'Dương Vân Nga');
  register('Thái hậu Dương Vân Nga', 'person_duong_van_nga', 'Dương Vân Nga');
  register('Dương Thái hậu', 'person_duong_van_nga', 'Dương Vân Nga');
  register('person_hau_nhan_bao', 'person_hau_nhan_bao', 'Hầu Nhân Bảo');
  register('Hầu Nhân Bảo', 'person_hau_nhan_bao', 'Hầu Nhân Bảo');
  register('tướng Hầu Nhân Bảo', 'person_hau_nhan_bao', 'Hầu Nhân Bảo');
  register('person_thoat_hoan', 'person_thoat_hoan', 'Thoát Hoan');
  register('Thoát Hoan', 'person_thoat_hoan', 'Thoát Hoan');
  register('Trấn Nam Vương Thoát Hoan', 'person_thoat_hoan', 'Thoát Hoan');
  register('person_quach_quy', 'person_quach_quy', 'Quách Quỳ');
  register('Quách Quỳ', 'person_quach_quy', 'Quách Quỳ');
  register('tướng Quách Quỳ', 'person_quach_quy', 'Quách Quỳ');
  register('person_ton_si_nghi', 'person_ton_si_nghi', 'Tôn Sĩ Nghị');
  register('Tôn Sĩ Nghị', 'person_ton_si_nghi', 'Tôn Sĩ Nghị');
  register('Tổng đốc Tôn Sĩ Nghị', 'person_ton_si_nghi', 'Tôn Sĩ Nghị');
  register('person_sam_nghi_dong', 'person_sam_nghi_dong', 'Sầm Nghi Đống');
  register('Sầm Nghi Đống', 'person_sam_nghi_dong', 'Sầm Nghi Đống');
  register('tướng Sầm Nghi Đống', 'person_sam_nghi_dong', 'Sầm Nghi Đống');
  register('person_luu_hoang_thao', 'person_luu_hoang_thao', 'Lưu Hoằng Thao');
  register('Lưu Hoằng Thao', 'person_luu_hoang_thao', 'Lưu Hoằng Thao');
  register('Lưu Hoằng Tháo', 'person_luu_hoang_thao', 'Lưu Hoằng Thao');
  register('person_tran_ba_tien', 'person_tran_ba_tien', 'Trần Bá Tiên');
  register('Trần Bá Tiên', 'person_tran_ba_tien', 'Trần Bá Tiên');
  register('person_tieu_tu', 'person_tieu_tu', 'Tiêu Tư');
  register('Tiêu Tư', 'person_tieu_tu', 'Tiêu Tư');
  register('person_luc_dan', 'person_luc_dan', 'Lục Dận');
  register('Lục Dận', 'person_luc_dan', 'Lục Dận');
  register('person_de_castries', 'person_de_castries', 'Tướng De Castries');
  register('Tướng De Castries', 'person_de_castries', 'Tướng De Castries');
  register('De Castries', 'person_de_castries', 'Tướng De Castries');
  register('Tướng Đờ Cát', 'person_de_castries', 'Tướng De Castries');
  register('loc_tan_hoa', 'loc_tan_hoa', 'Tân Hòa');
  register('Tân Hòa', 'loc_tan_hoa', 'Tân Hòa');
  register('căn cứ Tân Hòa', 'loc_tan_hoa', 'Tân Hòa');
  register('loc_doi_a1', 'loc_doi_a1', 'Đồi A1');
  register('Đồi A1', 'loc_doi_a1', 'Đồi A1');
  register('đồi A1', 'loc_doi_a1', 'Đồi A1');
  register('cứ điểm A1', 'loc_doi_a1', 'Đồi A1');
  register('loc_ngoc_hoi', 'loc_ngoc_hoi', 'Ngọc Hồi');
  register('Ngọc Hồi', 'loc_ngoc_hoi', 'Ngọc Hồi');
  register('đồn Ngọc Hồi', 'loc_ngoc_hoi', 'Ngọc Hồi');
  register('loc_dong_da', 'loc_dong_da', 'Đống Đa');
  register('Đống Đa', 'loc_dong_da', 'Đống Đa');
  register('gò Đống Đa', 'loc_dong_da', 'Đống Đa');
  register('Trận Đống Đa', 'event_ngoc_hoi_dong_da', 'Trận Ngọc Hồi - Đống Đa');
  register('trận Đống Đa', 'event_ngoc_hoi_dong_da', 'Trận Ngọc Hồi - Đống Đa');
  register('person_ly_cong_uan', 'person_ly_thai_to', 'Lý Thái Tổ');
  register('person_ly_phat_ma', 'person_ly_thai_tong', 'Lý Thái Tông');
  register('person_le_tu_thanh', 'person_le_thanh_tong', 'Lê Thánh Tông');
  register('person_nguyen_tat_thanh', 'person_ho_chi_minh', 'Hồ Chí Minh');
  register('person_nguyen_ai_quoc', 'person_ho_chi_minh', 'Hồ Chí Minh');
  register('person_nguyen_sinh_cung', 'person_ho_chi_minh', 'Hồ Chí Minh');
  register('person_nguyen_van_ba', 'person_ho_chi_minh', 'Hồ Chí Minh');
  register('event_chien_dich_dien_bien_phu', 'event_dien_bien_phu', 'Chiến dịch Điện Biên Phủ');
  register('event_keo_phao_dien_bien_phu', 'event_keo_phao_dien_bien_phu', 'Kéo pháo vào kéo pháo ra');
  register('Kéo pháo vào kéo pháo ra', 'event_keo_phao_dien_bien_phu', 'Kéo pháo vào kéo pháo ra');
  register('kéo pháo vào kéo pháo ra', 'event_keo_phao_dien_bien_phu', 'Kéo pháo vào kéo pháo ra');
  register('Kéo pháo', 'event_keo_phao_dien_bien_phu', 'Kéo pháo vào kéo pháo ra');
  register('kéo pháo', 'event_keo_phao_dien_bien_phu', 'Kéo pháo vào kéo pháo ra');
  register('event_khang_chien_nam_ky', 'event_khang_chien_nam_ky', 'Kháng chiến Nam Kỳ');
  register('Kháng chiến Nam Kỳ', 'event_khang_chien_nam_ky', 'Kháng chiến Nam Kỳ');
  register('kháng chiến Nam Kỳ', 'event_khang_chien_nam_ky', 'Kháng chiến Nam Kỳ');
  register('chống Pháp ở Nam Kỳ', 'event_khang_chien_nam_ky', 'Kháng chiến Nam Kỳ');
  register('event_khoi_nghia_truong_dinh', 'event_khoi_nghia_truong_dinh', 'Khởi nghĩa Trương Định');
  register('Khởi nghĩa Trương Định', 'event_khoi_nghia_truong_dinh', 'Khởi nghĩa Trương Định');
  register('Thục Vương', 'person_an_duong_vuong', 'An Dương Vương');
  register('person_thuc_vuong', 'person_an_duong_vuong', 'An Dương Vương');
  register('Loa Thành', 'loc_thanh_co_loa', 'thành Cổ Loa');
  register('loc_loa_thanh', 'loc_thanh_co_loa', 'thành Cổ Loa');
  register('Trưng Trắc', 'person_trung_trac', 'Trưng Trắc');
  register('Bà Trưng Trắc', 'person_trung_trac', 'Trưng Trắc');
  register('Trưng Nữ Vương', 'person_trung_trac', 'Trưng Trắc');
  register('Trưng Nhị', 'person_trung_nhi', 'Trưng Nhị');
  register('Bà Trưng Nhị', 'person_trung_nhi', 'Trưng Nhị');
  register('Hai Bà Trưng', 'person_hai_ba_trung', 'Hai Bà Trưng');
  register('Vạn Thắng Vương', 'person_dinh_tien_hoang', 'Đinh Tiên Hoàng');
  register('Hưng Đạo Đại Vương', 'person_tran_hung_dao', 'Trần Hưng Đạo');
  register('Bình Định Vương', 'person_le_loi', 'Lê Lợi');
  register('Bắc Bình Vương', 'person_quang_trung', 'Quang Trung');
  register('dynasty_tay_son', 'dynasty_nha_tay_son', 'Nhà Tây Sơn');
  register('Tây Sơn', 'dynasty_nha_tay_son', 'Nhà Tây Sơn');
  register('nhà Tây Sơn', 'dynasty_nha_tay_son', 'Nhà Tây Sơn');
  register('súng Thần cơ', 'artifact_sung_than_co', 'súng Thần cơ');
  register('sông Như Nguyệt', 'loc_song_nhu_nguyet', 'sông Như Nguyệt');
  register('Sông Như Nguyệt', 'loc_song_nhu_nguyet', 'sông Như Nguyệt');
  register('event_thanh_da_bang', 'event_tran_thanh_da_bang', 'Trận thành Đa Bang');
  register('event_tran_thanh_da_bang', 'event_tran_thanh_da_bang', 'Trận thành Đa Bang');
  register('thành Đa Bang', 'loc_thanh_da_bang', 'thành Đa Bang');
  register('Khiêm Lăng', 'loc_khiem_lang', 'Khiêm Lăng');
  register('loc_khiem_lang', 'loc_khiem_lang', 'Khiêm Lăng');
  register('Tự Đức', 'person_tu_duc', 'Tự Đức');
  register('Vua Tự Đức', 'person_tu_duc', 'Tự Đức');
  register('person_tu_duc', 'person_tu_duc', 'Tự Đức');
  register('Bộ luật Hồng Đức', 'doc_luat_hong_duc', 'Bộ luật Hồng Đức');
  register('núi Yên Tử', 'loc_yen_tu', 'Yên Tử');
  register('loc_nui_yen_tu', 'loc_yen_tu', 'Yên Tử');
  register('ải Chi Lăng', 'loc_chi_lang', 'Chi Lăng');
  register('loc_ai_chi_lang', 'loc_chi_lang', 'Chi Lăng');
  register('Chi Lăng', 'loc_chi_lang', 'Chi Lăng');
  register('loc_chi_lang', 'loc_chi_lang', 'Chi Lăng');
  register('event_chien_dich_bien_gioi', 'event_bien_gioi_1950', 'Chiến dịch Biên Giới');
  register('Chiến dịch Biên Giới', 'event_bien_gioi_1950', 'Chiến dịch Biên Giới');
  register('Chiến dịch Biên giới', 'event_bien_gioi_1950', 'Chiến dịch Biên Giới');
  register('event_bien_gioi_1950', 'event_bien_gioi_1950', 'Chiến dịch Biên Giới');
  register('Đảng Cộng sản Việt Nam', 'org_dang_cong_san_vn', 'Đảng Cộng sản Việt Nam');
  register('org_dang_cong_san_viet_nam', 'org_dang_cong_san_vn', 'Đảng Cộng sản Việt Nam');
  register('org_dang_cong_san_vn', 'org_dang_cong_san_vn', 'Đảng Cộng sản Việt Nam');
  register('doc_binh_ngo_dai_cao', 'doc_binh_ngo', 'Bình Ngô đại cáo');
  register('doc_binh_ngo', 'doc_binh_ngo', 'Bình Ngô đại cáo');
  register('Bình Ngô Đại Cáo', 'doc_binh_ngo', 'Bình Ngô đại cáo');
  register('bài cáo Bình Ngô', 'doc_binh_ngo', 'Bình Ngô đại cáo');
  register('doc_bo_luat_hong_duc', 'doc_luat_hong_duc', 'Bộ luật Hồng Đức');
  register('doc_luat_hong_duc', 'doc_luat_hong_duc', 'Bộ luật Hồng Đức');
  register('Hiệp định Geneva', 'doc_hiep_dinh_geneve_1954', 'Hiệp định Genève 1954');
  register('Hiệp định Genève', 'doc_hiep_dinh_geneve_1954', 'Hiệp định Genève 1954');
  register('Hiệp định Genève năm 1954', 'doc_hiep_dinh_geneve_1954', 'Hiệp định Genève 1954');
  register('doc_hiep_dinh_geneve_1954', 'doc_hiep_dinh_geneve_1954', 'Hiệp định Genève 1954');
  register('doc_hiep_dinh_paris_1973', 'doc_hiep_dinh_paris', 'Hiệp định Paris 1973');
  register('Hiệp định Paris năm 1973', 'doc_hiep_dinh_paris', 'Hiệp định Paris 1973');
  register('Hiệp định Paris', 'doc_hiep_dinh_paris', 'Hiệp định Paris 1973');
  register('doc_hiep_dinh_paris', 'doc_hiep_dinh_paris', 'Hiệp định Paris 1973');
  register('Cố đô Hoa Lư', 'loc_hoa_lu', 'Hoa Lư');
  register('loc_co_do_hoa_lu', 'loc_hoa_lu', 'Hoa Lư');
  register('loc_hoa_lu', 'loc_hoa_lu', 'Hoa Lư');
  register('Thành Tây Đô', 'loc_thanh_tay_do', 'Thành Tây Đô');
  register('loc_thanh_tay_do', 'loc_thanh_tay_do', 'Thành Tây Đô');
  register('loc_thanh_nha_ho', 'loc_thanh_tay_do', 'Thành Tây Đô');
  register('tiền Thái Bình Hưng Bảo', 'artifact_tien_thai_binh', 'tiền Thái Bình Hưng Bảo');
  register('artifact_tien_thai_binh', 'artifact_tien_thai_binh', 'tiền Thái Bình Hưng Bảo');
  register('súng Thần cơ', 'artifact_sung_than_co', 'súng Thần cơ');
  register('artifact_sung_than_co', 'artifact_sung_than_co', 'súng Thần cơ');
  register('Hội Tao Đàn', 'org_hoi_tao_dan', 'Hội Tao Đàn');
  register('org_hoi_tao_dan', 'org_hoi_tao_dan', 'Hội Tao Đàn');
  register('Thân Nhân Trung', 'person_than_nhan_trung', 'Thân Nhân Trung');
  register('person_than_nhan_trung', 'person_than_nhan_trung', 'Thân Nhân Trung');
  register('Võ Văn Kiệt', 'person_vo_van_kiet', 'Võ Văn Kiệt');
  register('Thủ tướng Võ Văn Kiệt', 'person_vo_van_kiet', 'Võ Văn Kiệt');
  register('person_vo_van_kiet', 'person_vo_van_kiet', 'Võ Văn Kiệt');
  register('Đường dây 500kV Bắc Nam', 'event_duong_day_500kv', 'Đường dây 500kV');
  register('Đường dây 500kV', 'event_duong_day_500kv', 'Đường dây 500kV');
  register('event_duong_day_500kv', 'event_duong_day_500kv', 'Đường dây 500kV');
  register('Binh Thư Yếu Lược', 'doc_binh_thu_yeu_luoc', 'Binh Thư Yếu Lược');
  register('doc_binh_thu_yeu_luoc', 'doc_binh_thu_yeu_luoc', 'Binh Thư Yếu Lược');
  register('Hiệp định Thương mại Việt - Mỹ', 'doc_hiep_dinh_bta', 'Hiệp định BTA');
  register('Hiệp định BTA', 'doc_hiep_dinh_bta', 'Hiệp định BTA');
  register('doc_hiep_dinh_bta', 'doc_hiep_dinh_bta', 'Hiệp định BTA');
  register('WTO', 'org_wto', 'Tổ chức Thương mại Thế giới');
  register('Tổ chức Thương mại Thế giới', 'org_wto', 'Tổ chức Thương mại Thế giới');
  register('Tổ chức Thương mại Thế giới WTO', 'org_wto', 'Tổ chức Thương mại Thế giới');
  register('org_wto', 'org_wto', 'Tổ chức Thương mại Thế giới');
  register('Việt Nam Dân chủ Cộng hòa', 'dynasty_viet_nam_dan_chu_cong_hoa', 'Việt Nam Dân chủ Cộng hòa');
  register('dynasty_viet_nam_dan_chu_cong_hoa', 'dynasty_viet_nam_dan_chu_cong_hoa', 'Việt Nam Dân chủ Cộng hòa');
  register('org_viet_nam_dan_chu_cong_hoa', 'dynasty_viet_nam_dan_chu_cong_hoa', 'Việt Nam Dân chủ Cộng hòa');
  register('Căn cứ Vụ Quang Hà Tĩnh', 'loc_ha_tinh', 'Hà Tĩnh');
  register('loc_can_cu_vu_quang_ha_tinh', 'loc_ha_tinh', 'Hà Tĩnh');
  register('Dinh Độc Lập', 'loc_dinh_doc_lap', 'Dinh Độc Lập');
  register('loc_dinh_doc_lap', 'loc_dinh_doc_lap', 'Dinh Độc Lập');
  register('Văn Tiến Dũng', 'person_van_tien_dung', 'Văn Tiến Dũng');
  register('Đại tướng Văn Tiến Dũng', 'person_van_tien_dung', 'Văn Tiến Dũng');
  register('person_van_tien_dung', 'person_van_tien_dung', 'Văn Tiến Dũng');
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

  const strippedNorm = normInput.replace(/^(lũy|chiến lũy|thành|sông|núi|ải|phủ|đồn|xứ|cố đô|kinh đô|kinh thành|tỉnh|thời kỳ|thời đại|thời|triều đại|triều|nhà)\s+/, '');
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
  if (HISTORICAL_PERSON_DICTIONARY[inputName]) return HISTORICAL_PERSON_DICTIONARY[inputName];
  if (HISTORICAL_LOCATION_DICTIONARY[inputName]) return HISTORICAL_LOCATION_DICTIONARY[inputName];
  if (DYNASTY_DICTIONARY[inputName]) {
    const d = DYNASTY_DICTIONARY[inputName];
    return { entityId: d.entityId, canonicalName: d.canonicalName, type: 'DYNASTY_ERA', aliases: d.aliases };
  }
  const directOrg = CORE_ORGS.find((o) => o.id === inputName || o.aliases.some((a) => a.toLowerCase() === inputName.toLowerCase()) || o.name.toLowerCase() === inputName.toLowerCase());
  if (directOrg) return { entityId: directOrg.id, canonicalName: directOrg.name, type: 'ORGANIZATION', aliases: directOrg.aliases };
  const directEv = CORE_EVENTS.find((e) => e.id === inputName || e.aliases.some((a) => a.toLowerCase() === inputName.toLowerCase()) || e.name.toLowerCase() === inputName.toLowerCase());
  if (directEv) return { entityId: directEv.id, canonicalName: directEv.name, type: 'EVENT_BATTLE', aliases: directEv.aliases, timeRange: directEv.timeRange };
  const directArt = CORE_ARTIFACTS.find((a) => a.id === inputName || a.aliases.some((a) => a.toLowerCase() === inputName.toLowerCase()) || a.name.toLowerCase() === inputName.toLowerCase());
  if (directArt) return { entityId: directArt.id, canonicalName: directArt.name, type: 'ARTIFACT', aliases: directArt.aliases };
  const directDoc = CORE_DOCS.find((d) => d.id === inputName || d.aliases.some((a) => a.toLowerCase() === inputName.toLowerCase()) || d.name.toLowerCase() === inputName.toLowerCase());
  if (directDoc) {
    return {
      entityId: directDoc.id,
      canonicalName: directDoc.name,
      type: 'DOCUMENT_CULTURE',
      aliases: directDoc.aliases,
      dynasty: directDoc.dynasty,
      timeRange: directDoc.year ? { start: directDoc.year, end: directDoc.year } : undefined,
      docMetadata: {
        author: directDoc.author,
        dynasty: directDoc.dynasty,
        year: directDoc.year,
        adversary: directDoc.adversary,
        context: directDoc.context,
      },
    };
  }

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

  const foundOrg = CORE_ORGS.find((o) => o.id === aliasMapping.canonicalId || o.aliases.includes(aliasMapping.canonicalId) || o.name.toLowerCase() === aliasMapping.canonicalName.toLowerCase());
  if (foundOrg) return { entityId: foundOrg.id, canonicalName: foundOrg.name, type: 'ORGANIZATION', aliases: foundOrg.aliases };

  const foundEvent = CORE_EVENTS.find((e) => e.id === aliasMapping.canonicalId || e.aliases.includes(aliasMapping.canonicalId) || e.name.toLowerCase() === aliasMapping.canonicalName.toLowerCase());
  if (foundEvent) return { entityId: foundEvent.id, canonicalName: foundEvent.name, type: 'EVENT_BATTLE', aliases: foundEvent.aliases, timeRange: foundEvent.timeRange };

  const foundArt = CORE_ARTIFACTS.find((a) => a.id === aliasMapping.canonicalId || a.aliases.includes(aliasMapping.canonicalId) || a.name.toLowerCase() === aliasMapping.canonicalName.toLowerCase());
  if (foundArt) return { entityId: foundArt.id, canonicalName: foundArt.name, type: 'ARTIFACT', aliases: foundArt.aliases };

  const foundDoc = CORE_DOCS.find((d) => d.id === aliasMapping.canonicalId || d.aliases.includes(aliasMapping.canonicalId) || d.name.toLowerCase() === aliasMapping.canonicalName.toLowerCase());
  if (foundDoc) {
    return {
      entityId: foundDoc.id,
      canonicalName: foundDoc.name,
      type: 'DOCUMENT_CULTURE',
      aliases: foundDoc.aliases,
      dynasty: foundDoc.dynasty,
      timeRange: foundDoc.year ? { start: foundDoc.year, end: foundDoc.year } : undefined,
      docMetadata: {
        author: foundDoc.author,
        dynasty: foundDoc.dynasty,
        year: foundDoc.year,
        adversary: foundDoc.adversary,
        context: foundDoc.context,
      },
    };
  }

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
        if (!/^(person|loc|event|doc|org|epoch|item|dynasty|group|unknown)_/i.test(dict[id].canonicalName)) {
          aliasTable[dict[id].canonicalName] = (dict[id].aliases || []).filter(
            (a) => a && !/^(person|loc|event|doc|org|epoch|item|dynasty|group|unknown)_/i.test(a) && a.length >= 2
          );
        }
        found = true;
        break;
      }
    }
    if (!found) {
      const resolved = resolveCanonicalEntity(id);
      if (
        resolved.canonicalName &&
        !/^(person|loc|event|doc|org|epoch|item|dynasty|group|unknown)_/i.test(resolved.canonicalName) &&
        resolved.canonicalName.length >= 2
      ) {
        const validAliases = (resolved.aliases || []).filter(
          (a) => a && !/^(person|loc|event|doc|org|epoch|item|dynasty|group|unknown)_/i.test(a) && a.length >= 2
        );
        if (validAliases.length > 0) {
          aliasTable[resolved.canonicalName] = validAliases;
        }
      }
    }
  }

  return aliasTable;
}

/**
 * Canonical mapping between collective historical entities and their constituent members.
 * Supports bidirectional expansion during knowledge graph traversal and entity retrieval.
 */
export const COLLECTIVE_ENTITY_MEMBERS: Record<string, string[]> = {
  person_hai_ba_trung: ['person_trung_trac', 'person_trung_nhi'],
  group_tay_son_tam_kiet: ['person_nguyen_hue', 'person_nguyen_nhac', 'person_nguyen_lu'],
  org_tay_son: ['person_nguyen_nhac', 'person_nguyen_hue', 'person_nguyen_lu'],
  dynasty_nha_tay_son: ['person_nguyen_nhac', 'person_nguyen_hue', 'person_nguyen_lu'],
  group_truc_lam_tam_to: ['person_tran_nhan_tong', 'person_phap_loa', 'person_huyen_quang'],
};

/**
 * Expands a list of entity IDs bidirectionally:
 * - If a collective entity ID is present, appends its member entity IDs.
 * - If any member entity ID is present, appends its parent collective entity ID.
 */
export function getExpandedCollectiveEntityIds(entityIds: string[]): string[] {
  if (!entityIds || entityIds.length === 0) return [];
  const result = new Set<string>(entityIds);

  for (const id of entityIds) {
    const members = COLLECTIVE_ENTITY_MEMBERS[id];
    if (members) {
      for (const m of members) result.add(m);
    }
    for (const [collectiveId, memberList] of Object.entries(COLLECTIVE_ENTITY_MEMBERS)) {
      if (memberList.includes(id)) {
        result.add(collectiveId);
      }
    }
  }

  return Array.from(result);
}
