/**
 * ChronoViet - Historical Dictionaries, Reign Eras, Can Chi & Canonical Taxonomy
 *
 * Single Source of Truth (SSOT) for:
 * - 60 Can Chi Hoa Giáp (Spaced and Hyphenated)
 * - Historical Reign Eras (Niên hiệu) with start/end years and epoch mapping
 * - 63 Provinces and Classical Feudal Administrative Units
 * - Imperial Deity Titles and Alias Mappings
 * - Feudal Ranks, Civil Positions & Monastic Titles
 */

export interface ReignEraInfo {
  reignName: string;
  dynasty: string;
  startYear: number;
  endYear: number;
  monarch: string;
  canonicalEpochId: string;
}

/**
 * 60 Can Chi Hoa Giáp
 */
export const CAN_CHI_60: string[] = [
  'Giáp Tý', 'Ất Sửu', 'Bính Dần', 'Đinh Mão', 'Mậu Thìn', 'Kỷ Tỵ', 'Canh Ngọ', 'Tân Mùi', 'Nhâm Thân', 'Quý Dậu',
  'Giáp Tuất', 'Ất Hợi', 'Bính Tý', 'Đinh Sửu', 'Mậu Dần', 'Kỷ Mão', 'Canh Thìn', 'Tân Tỵ', 'Nhâm Ngọ', 'Quý Mùi',
  'Giáp Thân', 'Ất Dậu', 'Bính Tuất', 'Đinh Hợi', 'Mậu Tý', 'Kỷ Sửu', 'Canh Dần', 'Tân Mão', 'Nhâm Thìn', 'Quý Tỵ',
  'Giáp Ngọ', 'Ất Mùi', 'Bính Thân', 'Đinh Dậu', 'Mậu Tuất', 'Kỷ Hợi', 'Canh Tý', 'Tân Sửu', 'Nhâm Dần', 'Quý Mão',
  'Giáp Thìn', 'Ất Tỵ', 'Bính Ngọ', 'Đinh Mùi', 'Mậu Thân', 'Kỷ Dậu', 'Canh Tuất', 'Tân Hợi', 'Nhâm Tý', 'Quý Sửu',
  'Giáp Dần', 'Ất Mão', 'Bính Thìn', 'Đinh Tỵ', 'Mậu Ngọ', 'Kỷ Mùi', 'Canh Thân', 'Tân Dậu', 'Nhâm Tuất', 'Quý Hợi',
];

export const CAN_CHI_SET = new Set<string>();
for (const cc of CAN_CHI_60) {
  CAN_CHI_SET.add(cc.toLowerCase().normalize('NFC'));
  CAN_CHI_SET.add(cc.toLowerCase().normalize('NFC').replace(/\s+/g, '-'));
}

/**
 * Historical Reign Eras Dictionary (Niên hiệu)
 */
export const REIGN_ERA_DICTIONARY: Record<string, ReignEraInfo> = {
  // Tiền Lý
  'thiên đức': { reignName: 'Thiên Đức', dynasty: 'Nhà Tiền Lý', startYear: 544, endYear: 548, monarch: 'Lý Nam Đế', canonicalEpochId: 'EPOCH_02' },
  // Đinh
  'thái bình': { reignName: 'Thái Bình', dynasty: 'Nhà Đinh', startYear: 970, endYear: 980, monarch: 'Đinh Tiên Hoàng', canonicalEpochId: 'EPOCH_03' },
  // Tiền Lê
  'thiên phúc': { reignName: 'Thiên Phúc', dynasty: 'Nhà Tiền Lê', startYear: 980, endYear: 988, monarch: 'Lê Đại Hành', canonicalEpochId: 'EPOCH_03' },
  'hưng thống': { reignName: 'Hưng Thống', dynasty: 'Nhà Tiền Lê', startYear: 989, endYear: 993, monarch: 'Lê Đại Hành', canonicalEpochId: 'EPOCH_03' },
  'ứng thiên': { reignName: 'Ứng Thiên', dynasty: 'Nhà Tiền Lê', startYear: 994, endYear: 1007, monarch: 'Lê Đại Hành', canonicalEpochId: 'EPOCH_03' },
  'cảnh thụy': { reignName: 'Cảnh Thụy', dynasty: 'Nhà Tiền Lê', startYear: 1008, endYear: 1009, monarch: 'Lê Long Đĩnh', canonicalEpochId: 'EPOCH_03' },
  // Lý
  'thuận thiên ly': { reignName: 'Thuận Thiên', dynasty: 'Nhà Lý', startYear: 1010, endYear: 1028, monarch: 'Lý Thái Tổ', canonicalEpochId: 'EPOCH_04' },
  'thông thụy': { reignName: 'Thông Thụy', dynasty: 'Nhà Lý', startYear: 1034, endYear: 1038, monarch: 'Lý Thái Tông', canonicalEpochId: 'EPOCH_04' },
  'càn phù hữu đạo': { reignName: 'Càn Phù Hữu Đạo', dynasty: 'Nhà Lý', startYear: 1039, endYear: 1041, monarch: 'Lý Thái Tông', canonicalEpochId: 'EPOCH_04' },
  'minh đạo': { reignName: 'Minh Đạo', dynasty: 'Nhà Lý', startYear: 1042, endYear: 1043, monarch: 'Lý Thái Tông', canonicalEpochId: 'EPOCH_04' },
  'long thụy thái bình': { reignName: 'Long Thụy Thái Bình', dynasty: 'Nhà Lý', startYear: 1054, endYear: 1058, monarch: 'Lý Thánh Tông', canonicalEpochId: 'EPOCH_04' },
  'chương thánh gia khánh': { reignName: 'Chương Thánh Gia Khánh', dynasty: 'Nhà Lý', startYear: 1059, endYear: 1065, monarch: 'Lý Thánh Tông', canonicalEpochId: 'EPOCH_04' },
  'long chương thiên tự': { reignName: 'Long Chương Thiên Tự', dynasty: 'Nhà Lý', startYear: 1066, endYear: 1068, monarch: 'Lý Thánh Tông', canonicalEpochId: 'EPOCH_04' },
  'thần vũ': { reignName: 'Thần Vũ', dynasty: 'Nhà Lý', startYear: 1069, endYear: 1072, monarch: 'Lý Thánh Tông', canonicalEpochId: 'EPOCH_04' },
  'thái ninh': { reignName: 'Thái Ninh', dynasty: 'Nhà Lý', startYear: 1072, endYear: 1076, monarch: 'Lý Nhân Tông', canonicalEpochId: 'EPOCH_04' },
  'anh vũ chiêu thắng': { reignName: 'Anh Vũ Chiêu Thắng', dynasty: 'Nhà Lý', startYear: 1076, endYear: 1084, monarch: 'Lý Nhân Tông', canonicalEpochId: 'EPOCH_04' },
  'quảng hựu': { reignName: 'Quảng Hựu', dynasty: 'Nhà Lý', startYear: 1085, endYear: 1092, monarch: 'Lý Nhân Tông', canonicalEpochId: 'EPOCH_04' },
  'hội phong': { reignName: 'Hội Phong', dynasty: 'Nhà Lý', startYear: 1092, endYear: 1100, monarch: 'Lý Nhân Tông', canonicalEpochId: 'EPOCH_04' },
  'long phù': { reignName: 'Long Phù', dynasty: 'Nhà Lý', startYear: 1101, endYear: 1109, monarch: 'Lý Nhân Tông', canonicalEpochId: 'EPOCH_04' },
  'hội tường đại khánh': { reignName: 'Hội Tường Đại Khánh', dynasty: 'Nhà Lý', startYear: 1110, endYear: 1119, monarch: 'Lý Nhân Tông', canonicalEpochId: 'EPOCH_04' },
  'thiên phù duệ vũ': { reignName: 'Thiên Phù Duệ Vũ', dynasty: 'Nhà Lý', startYear: 1120, endYear: 1126, monarch: 'Lý Nhân Tông', canonicalEpochId: 'EPOCH_04' },
  'thiên phù khánh thọ': { reignName: 'Thiên Phù Khánh Thọ', dynasty: 'Nhà Lý', startYear: 1127, endYear: 1127, monarch: 'Lý Nhân Tông', canonicalEpochId: 'EPOCH_04' },
  'thiên chương bảo tự': { reignName: 'Thiên Chương Bảo Tự', dynasty: 'Nhà Lý', startYear: 1133, endYear: 1137, monarch: 'Lý Thần Tông', canonicalEpochId: 'EPOCH_04' },
  'đại định ly': { reignName: 'Đại Định', dynasty: 'Nhà Lý', startYear: 1140, endYear: 1162, monarch: 'Lý Anh Tông', canonicalEpochId: 'EPOCH_04' },
  'chính long bảo ứng': { reignName: 'Chính Long Bảo Ứng', dynasty: 'Nhà Lý', startYear: 1163, endYear: 1173, monarch: 'Lý Anh Tông', canonicalEpochId: 'EPOCH_04' },
  'trinh phù': { reignName: 'Trinh Phù', dynasty: 'Nhà Lý', startYear: 1176, endYear: 1186, monarch: 'Lý Cao Tông', canonicalEpochId: 'EPOCH_04' },
  'thiên tư gia thụy': { reignName: 'Thiên Tư Gia Thụy', dynasty: 'Nhà Lý', startYear: 1186, endYear: 1202, monarch: 'Lý Cao Tông', canonicalEpochId: 'EPOCH_04' },
  'trị bình long ứng': { reignName: 'Trị Bình Long Ứng', dynasty: 'Nhà Lý', startYear: 1205, endYear: 1210, monarch: 'Lý Cao Tông', canonicalEpochId: 'EPOCH_04' },
  'kiến gia': { reignName: 'Kiến Gia', dynasty: 'Nhà Lý', startYear: 1211, endYear: 1224, monarch: 'Lý Huệ Tông', canonicalEpochId: 'EPOCH_04' },
  'thiên chương hữu đạo': { reignName: 'Thiên Chương Hữu Đạo', dynasty: 'Nhà Lý', startYear: 1224, endYear: 1225, monarch: 'Lý Chiêu Hoàng', canonicalEpochId: 'EPOCH_04' },
  // Trần
  'kiến trung': { reignName: 'Kiến Trung', dynasty: 'Nhà Trần', startYear: 1225, endYear: 1232, monarch: 'Trần Thái Tông', canonicalEpochId: 'EPOCH_05' },
  'thiên ứng chính bình': { reignName: 'Thiên Ứng Chính Bình', dynasty: 'Nhà Trần', startYear: 1232, endYear: 1251, monarch: 'Trần Thái Tông', canonicalEpochId: 'EPOCH_05' },
  'nguyên phong': { reignName: 'Nguyên Phong', dynasty: 'Nhà Trần', startYear: 1251, endYear: 1258, monarch: 'Trần Thái Tông', canonicalEpochId: 'EPOCH_05' },
  'thiệu long': { reignName: 'Thiệu Long', dynasty: 'Nhà Trần', startYear: 1258, endYear: 1272, monarch: 'Trần Thánh Tông', canonicalEpochId: 'EPOCH_05' },
  'bảo phù': { reignName: 'Bảo Phù', dynasty: 'Nhà Trần', startYear: 1273, endYear: 1278, monarch: 'Trần Thánh Tông', canonicalEpochId: 'EPOCH_05' },
  'thiệu bảo': { reignName: 'Thiệu Bảo', dynasty: 'Nhà Trần', startYear: 1279, endYear: 1285, monarch: 'Trần Nhân Tông', canonicalEpochId: 'EPOCH_05' },
  'trùng hưng': { reignName: 'Trùng Hưng', dynasty: 'Nhà Trần', startYear: 1285, endYear: 1293, monarch: 'Trần Nhân Tông', canonicalEpochId: 'EPOCH_05' },
  'hưng long': { reignName: 'Hưng Long', dynasty: 'Nhà Trần', startYear: 1293, endYear: 1314, monarch: 'Trần Anh Tông', canonicalEpochId: 'EPOCH_05' },
  'đại khánh': { reignName: 'Đại Khánh', dynasty: 'Nhà Trần', startYear: 1314, endYear: 1323, monarch: 'Trần Minh Tông', canonicalEpochId: 'EPOCH_05' },
  'khai thái': { reignName: 'Khai Thái', dynasty: 'Nhà Trần', startYear: 1324, endYear: 1329, monarch: 'Trần Minh Tông', canonicalEpochId: 'EPOCH_05' },
  'khai hựu': { reignName: 'Khai Hựu', dynasty: 'Nhà Trần', startYear: 1329, endYear: 1341, monarch: 'Trần Hiến Tông', canonicalEpochId: 'EPOCH_05' },
  'thiệu phong': { reignName: 'Thiệu Phong', dynasty: 'Nhà Trần', startYear: 1341, endYear: 1357, monarch: 'Trần Dụ Tông', canonicalEpochId: 'EPOCH_05' },
  'đại trị': { reignName: 'Đại Trị', dynasty: 'Nhà Trần', startYear: 1358, endYear: 1369, monarch: 'Trần Dụ Tông', canonicalEpochId: 'EPOCH_05' },
  'thiệu khánh': { reignName: 'Thiệu Khánh', dynasty: 'Nhà Trần', startYear: 1370, endYear: 1372, monarch: 'Trần Nghệ Tông', canonicalEpochId: 'EPOCH_05' },
  'long khánh': { reignName: 'Long Khánh', dynasty: 'Nhà Trần', startYear: 1373, endYear: 1377, monarch: 'Trần Duệ Tông', canonicalEpochId: 'EPOCH_05' },
  'xương phù': { reignName: 'Xương Phù', dynasty: 'Nhà Trần', startYear: 1377, endYear: 1388, monarch: 'Trần Phế Đế', canonicalEpochId: 'EPOCH_05' },
  'quang thái': { reignName: 'Quang Thái', dynasty: 'Nhà Trần', startYear: 1388, endYear: 1398, monarch: 'Trần Thuận Tông', canonicalEpochId: 'EPOCH_05' },
  'kiến tân': { reignName: 'Kiến Tân', dynasty: 'Nhà Trần', startYear: 1398, endYear: 1400, monarch: 'Trần Thiếu Đế', canonicalEpochId: 'EPOCH_05' },
  // Hồ
  'thánh nguyên': { reignName: 'Thánh Nguyên', dynasty: 'Nhà Hồ', startYear: 1400, endYear: 1400, monarch: 'Hồ Quý Ly', canonicalEpochId: 'EPOCH_06' },
  'thiệu thành': { reignName: 'Thiệu Thành', dynasty: 'Nhà Hồ', startYear: 1401, endYear: 1402, monarch: 'Hồ Hán Thương', canonicalEpochId: 'EPOCH_06' },
  'khai đại': { reignName: 'Khai Đại', dynasty: 'Nhà Hồ', startYear: 1403, endYear: 1407, monarch: 'Hồ Hán Thương', canonicalEpochId: 'EPOCH_06' },
  // Hậu Lê
  'thuận thiên': { reignName: 'Thuận Thiên', dynasty: 'Nhà Hậu Lê', startYear: 1428, endYear: 1433, monarch: 'Lê Thái Tổ', canonicalEpochId: 'EPOCH_08' },
  'thiệu bình': { reignName: 'Thiệu Bình', dynasty: 'Nhà Hậu Lê', startYear: 1434, endYear: 1439, monarch: 'Lê Thái Tông', canonicalEpochId: 'EPOCH_08' },
  'đại bảo': { reignName: 'Đại Bảo', dynasty: 'Nhà Hậu Lê', startYear: 1440, endYear: 1442, monarch: 'Lê Thái Tông', canonicalEpochId: 'EPOCH_08' },
  'thái hòa': { reignName: 'Thái Hòa', dynasty: 'Nhà Hậu Lê', startYear: 1443, endYear: 1453, monarch: 'Lê Nhân Tông', canonicalEpochId: 'EPOCH_08' },
  'diên ninh': { reignName: 'Diên Ninh', dynasty: 'Nhà Hậu Lê', startYear: 1454, endYear: 1459, monarch: 'Lê Nhân Tông', canonicalEpochId: 'EPOCH_08' },
  'quang thuận': { reignName: 'Quang Thuận', dynasty: 'Nhà Hậu Lê', startYear: 1460, endYear: 1469, monarch: 'Lê Thánh Tông', canonicalEpochId: 'EPOCH_08' },
  'hồng đức': { reignName: 'Hồng Đức', dynasty: 'Nhà Hậu Lê', startYear: 1470, endYear: 1497, monarch: 'Lê Thánh Tông', canonicalEpochId: 'EPOCH_08' },
  'cảnh thống': { reignName: 'Cảnh Thống', dynasty: 'Nhà Hậu Lê', startYear: 1498, endYear: 1504, monarch: 'Lê Hiến Tông', canonicalEpochId: 'EPOCH_08' },
  'đoan khánh': { reignName: 'Đoan Khánh', dynasty: 'Nhà Hậu Lê', startYear: 1505, endYear: 1509, monarch: 'Lê Uy Mục', canonicalEpochId: 'EPOCH_08' },
  'hồng thuận': { reignName: 'Hồng Thuận', dynasty: 'Nhà Hậu Lê', startYear: 1509, endYear: 1516, monarch: 'Lê Tương Dực', canonicalEpochId: 'EPOCH_08' },
  'quang thiệu': { reignName: 'Quang Thiệu', dynasty: 'Nhà Hậu Lê', startYear: 1516, endYear: 1522, monarch: 'Lê Chiêu Tông', canonicalEpochId: 'EPOCH_08' },
  'chính hòa': { reignName: 'Chính Hòa', dynasty: 'Lê Trung Hưng', startYear: 1680, endYear: 1705, monarch: 'Lê Hy Tông', canonicalEpochId: 'EPOCH_09' },
  'vĩnh thịnh': { reignName: 'Vĩnh Thịnh', dynasty: 'Lê Trung Hưng', startYear: 1705, endYear: 1720, monarch: 'Lê Dụ Tông', canonicalEpochId: 'EPOCH_09' },
  'cảnh hưng': { reignName: 'Cảnh Hưng', dynasty: 'Lê Trung Hưng', startYear: 1740, endYear: 1786, monarch: 'Lê Hiển Tông', canonicalEpochId: 'EPOCH_09' },
  'chiêu thống': { reignName: 'Chiêu Thống', dynasty: 'Lê Trung Hưng', startYear: 1787, endYear: 1789, monarch: 'Lê Chiêu Thống', canonicalEpochId: 'EPOCH_10' },
  // Tây Sơn
  'thái đức': { reignName: 'Thái Đức', dynasty: 'Nhà Tây Sơn', startYear: 1778, endYear: 1793, monarch: 'Nguyễn Nhạc', canonicalEpochId: 'EPOCH_10' },
  'quang trung': { reignName: 'Quang Trung', dynasty: 'Nhà Tây Sơn', startYear: 1788, endYear: 1792, monarch: 'Quang Trung', canonicalEpochId: 'EPOCH_10' },
  'cảnh thịnh': { reignName: 'Cảnh Thịnh', dynasty: 'Nhà Tây Sơn', startYear: 1792, endYear: 1801, monarch: 'Nguyễn Quang Toản', canonicalEpochId: 'EPOCH_10' },
  'bảo hưng': { reignName: 'Bảo Hưng', dynasty: 'Nhà Tây Sơn', startYear: 1801, endYear: 1802, monarch: 'Nguyễn Quang Toản', canonicalEpochId: 'EPOCH_10' },
  // Nguyễn
  'gia long': { reignName: 'Gia Long', dynasty: 'Nhà Nguyễn', startYear: 1802, endYear: 1820, monarch: 'Gia Long', canonicalEpochId: 'EPOCH_11' },
  'minh mạng': { reignName: 'Minh Mạng', dynasty: 'Nhà Nguyễn', startYear: 1820, endYear: 1841, monarch: 'Minh Mạng', canonicalEpochId: 'EPOCH_11' },
  'thiệu trị': { reignName: 'Thiệu Trị', dynasty: 'Nhà Nguyễn', startYear: 1841, endYear: 1847, monarch: 'Thiệu Trị', canonicalEpochId: 'EPOCH_11' },
  'tự đức': { reignName: 'Tự Đức', dynasty: 'Nhà Nguyễn', startYear: 1847, endYear: 1883, monarch: 'Tự Đức', canonicalEpochId: 'EPOCH_11' },
  'hàm nghi': { reignName: 'Hàm Nghi', dynasty: 'Nhà Nguyễn', startYear: 1884, endYear: 1885, monarch: 'Hàm Nghi', canonicalEpochId: 'EPOCH_12' },
  'đồng khánh': { reignName: 'Đồng Khánh', dynasty: 'Nhà Nguyễn', startYear: 1885, endYear: 1889, monarch: 'Đồng Khánh', canonicalEpochId: 'EPOCH_12' },
  'thành thái': { reignName: 'Thành Thái', dynasty: 'Nhà Nguyễn', startYear: 1889, endYear: 1907, monarch: 'Thành Thái', canonicalEpochId: 'EPOCH_12' },
  'duy tân': { reignName: 'Duy Tân', dynasty: 'Nhà Nguyễn', startYear: 1907, endYear: 1916, monarch: 'Duy Tân', canonicalEpochId: 'EPOCH_12' },
  'khải định': { reignName: 'Khải Định', dynasty: 'Nhà Nguyễn', startYear: 1916, endYear: 1925, monarch: 'Khải Định', canonicalEpochId: 'EPOCH_12' },
  'bảo đại': { reignName: 'Bảo Đại', dynasty: 'Nhà Nguyễn', startYear: 1926, endYear: 1945, monarch: 'Bảo Đại', canonicalEpochId: 'EPOCH_12' },
};

/**
 * 63 Modern Provinces and Historical Administrative Units
 */
export const VIETNAMESE_PROVINCES_AND_ADMIN_UNITS: string[] = [
  'Hà Nội', 'Hải Phòng', 'Thanh Hóa', 'Nghệ An', 'Quảng Ninh', 'Thừa Thiên Huế', 'Huế', 'Quảng Nam',
  'Đà Nẵng', 'Bình Định', 'Khánh Hòa', 'Lâm Đồng', 'Bình Dương', 'Đồng Nai', 'Bà Rịa - Vũng Tàu',
  'Thành phố Hồ Chí Minh', 'Sài Gòn', 'Gia Định', 'Long An', 'Tiền Giang', 'Cần Thơ', 'Cà Mau', 'Kiên Giang',
  'Bắc Ninh', 'Bắc Giang', 'Hà Giang', 'Cao Bằng', 'Lạng Sơn', 'Yên Bái', 'Tuyên Quang', 'Thái Nguyên',
  'Phú Thọ', 'Vĩnh Phúc', 'Hải Dương', 'Hưng Yên', 'Thái Bình', 'Hà Nam', 'Nam Định', 'Ninh Bình',
  'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị', 'Quảng Ngãi', 'Phú Yên', 'Ninh Thuận', 'Bình Thuận', 'Kon Tum',
  'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Bình Phước', 'Tây Ninh', 'Bến Tre', 'Trà Vinh', 'Vĩnh Long',
  'Đồng Tháp', 'An Giang', 'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu', 'Điện Biên', 'Lai Châu', 'Sơn La',
  'Hòa Bình', 'Lào Cai',
  // Historical administrative units & ancient citadels
  'Kinh Bắc', 'Sơn Nam', 'Sơn Tây', 'Hải Dương', 'Ái Châu', 'Hoan Châu', 'Châu Ái', 'Châu Hoan',
  'Xứ Đông', 'Xứ Đoài', 'Xứ Nam', 'Xứ Bắc', 'Thuận Quảng', 'Trấn Man', 'Bắc Hà', 'Nam Hà',
  'Trung Kỳ', 'Bắc Kỳ', 'Nam Kỳ', 'Đàng Trong', 'Đàng Ngoài', 'Luy Lâu', 'Mê Linh', 'Phong Châu',
  'Hoa Lư', 'Thăng Long', 'Đông Đô', 'Đông Kinh', 'Đông Quan', 'Tây Đô', 'Phú Xuân', 'Thuận Hóa',
  'Bạch Đằng', 'Chi Lăng', 'Xương Giang', 'Ngọc Hồi', 'Đống Đa', 'Như Nguyệt', 'Hàm Tử', 'Chương Dương',
  'Vạn Kiếp', 'Cổ Loa', 'Điện Cần Chánh', 'Điện Dưỡng Tâm', 'Ngọ Môn', 'Cửa Hiển Nhơn', 'Thành Hà Nội',
  'Thành Thăng Long', 'Thành Cổ Loa', 'Thành Nhà Hồ', 'Hoàng Thành Thăng Long', 'Kinh Thành Huế'
];

/**
 * Imperial Deity Titles & Epithets Mapping to Canonical Historical Persons
 */
export const DEITY_TITLE_MAPPINGS: Record<string, { canonicalId: string; canonicalName: string }> = {
  'bố cái đại vương': { canonicalId: 'person_phung_hung', canonicalName: 'Phùng Hưng' },
  'phùng hưng': { canonicalId: 'person_phung_hung', canonicalName: 'Phùng Hưng' },
  'hưng đạo đại vương': { canonicalId: 'person_tran_hung_dao', canonicalName: 'Trần Hưng Đạo' },
  'hưng đạo vương': { canonicalId: 'person_tran_hung_dao', canonicalName: 'Trần Hưng Đạo' },
  'đức thánh trần': { canonicalId: 'person_tran_hung_dao', canonicalName: 'Trần Hưng Đạo' },
  'quốc sư khuông việt': { canonicalId: 'person_khuong_viet', canonicalName: 'Khuông Việt' },
  'khuông việt đại sư': { canonicalId: 'person_khuong_viet', canonicalName: 'Khuông Việt' },
  'lý triều quốc sư': { canonicalId: 'person_nguyen_minh_khong', canonicalName: 'Nguyễn Minh Không' },
  'vạn thắng vương': { canonicalId: 'person_dinh_tien_hoang', canonicalName: 'Đinh Tiên Hoàng' },
  'bình định vương': { canonicalId: 'person_le_loi', canonicalName: 'Lê Lợi' },
  'bắc bình vương': { canonicalId: 'person_quang_trung', canonicalName: 'Quang Trung' },
  'tây sơn vương': { canonicalId: 'person_nguyen_nhac', canonicalName: 'Nguyễn Nhạc' },
  'tiền ngô vương': { canonicalId: 'person_ngo_quyen', canonicalName: 'Ngô Quyền' },
  'triệu việt vương': { canonicalId: 'person_trieu_quang_phuc', canonicalName: 'Triệu Quang Phục' },
  'mai hắc đế': { canonicalId: 'person_mai_thuc_loan', canonicalName: 'Mai Thúc Loan' },
  'lý nam đế': { canonicalId: 'person_ly_nam_de', canonicalName: 'Lý Nam Đế' },
  'tản viên sơn thánh': { canonicalId: 'person_son_tinh', canonicalName: 'Sơn Tinh' },
  'phù đổng thiên vương': { canonicalId: 'person_thanh_giong', canonicalName: 'Thánh Gióng' },
  'chúa tiên': { canonicalId: 'person_nguyen_hoang', canonicalName: 'Nguyễn Hoàng' },
};

/**
 * Feudal Honorifics, Military Ranks & Monastic Titles (Canonical list, sorted by length desc)
 */
export const PERSON_HONORIFICS_AND_RANKS: string[] = [
  'Hưng Đạo Đại Vương',
  'Triều liệt đại phu',
  'Sử quan tu soạn',
  'Thái thượng hoàng',
  'Đại nguyên soái',
  'Bố Cái Đại Vương',
  'Hưng Đạo Vương',
  'Bắc Bình Vương',
  'Bình Định Vương',
  'Vạn Thắng Vương',
  'Tiền Ngô Vương',
  'Triệu Việt Vương',
  'Đức Thánh Trần',
  'Trạng nguyên',
  'Trạng Trình',
  'Hoàng đế',
  'Đại tướng',
  'Trung tướng',
  'Thiếu tướng',
  'Tiết chế',
  'Đại tư đồ',
  'Thái sư',
  'Thái úy',
  'Quốc công',
  'Đô đốc',
  'Nữ tướng',
  'Tổng binh',
  'Sử quan',
  'Chủ tịch',
  'Thủ tướng',
  'Đại vương',
  'Mai Hắc Đế',
  'Lý Nam Đế',
  'Thiền sư',
  'Trưởng lão',
  'Đại sư',
  'Quốc sư',
  'Thượng tọa',
  'Hòa thượng',
  'Đạo sĩ',
  'Cư sĩ',
  'Tướng',
  'Chúa',
  'Vua',
  'Bác',
];

/**
 * Vietnamese Historical Epoch & Dynasty Chronology Specification
 */
export interface HistoricalEpochRange {
  epochId: string;
  dynastyId: string;
  name: string;
  dynastyName: string;
  startYear: number;
  endYear: number;
  isBCE?: boolean;
}

export const HISTORICAL_CHRONOLOGY: HistoricalEpochRange[] = [
  { epochId: 'EPOCH_01', dynastyId: 'dynasty_van_lang', name: 'Thời kỳ Hùng Vương (Văn Lang)', dynastyName: 'Văn Lang', startYear: -2879, endYear: -258, isBCE: true },
  { epochId: 'EPOCH_01', dynastyId: 'dynasty_au_lac', name: 'Nhà nước Âu Lạc (An Dương Vương)', dynastyName: 'Âu Lạc', startYear: -257, endYear: -180, isBCE: true },
  { epochId: 'EPOCH_02', dynastyId: 'epoch_bac_thuoc', name: 'Thời kỳ Bắc thuộc lần 1', dynastyName: 'Thời kỳ Bắc thuộc', startYear: -179, endYear: 39, isBCE: true },
  { epochId: 'EPOCH_02', dynastyId: 'dynasty_hai_ba_trung', name: 'Trưng Nữ Vương', dynastyName: 'Trưng Nữ Vương', startYear: 40, endYear: 43 },
  { epochId: 'EPOCH_02', dynastyId: 'epoch_bac_thuoc', name: 'Thời kỳ Bắc thuộc lần 2', dynastyName: 'Thời kỳ Bắc thuộc', startYear: 44, endYear: 543 },
  { epochId: 'EPOCH_02', dynastyId: 'dynasty_tien_ly', name: 'Nhà Tiền Lý & Nhà nước Vạn Xuân', dynastyName: 'Nhà Tiền Lý', startYear: 544, endYear: 602 },
  { epochId: 'EPOCH_02', dynastyId: 'epoch_bac_thuoc', name: 'Thời kỳ Bắc thuộc lần 3 & Tự chủ sơ kỳ', dynastyName: 'Thời kỳ Bắc thuộc / Tự chủ', startYear: 603, endYear: 938 },
  { epochId: 'EPOCH_03', dynastyId: 'dynasty_ngo', name: 'Nhà Ngô', dynastyName: 'Nhà Ngô', startYear: 939, endYear: 965 },
  { epochId: 'EPOCH_03', dynastyId: 'dynasty_12_su_quan', name: 'Thời kỳ 12 Sứ quân', dynastyName: 'Thời kỳ 12 Sứ quân', startYear: 966, endYear: 967 },
  { epochId: 'EPOCH_03', dynastyId: 'dynasty_dinh', name: 'Nhà Đinh', dynastyName: 'Nhà Đinh', startYear: 968, endYear: 979 },
  { epochId: 'EPOCH_03', dynastyId: 'dynasty_tien_le', name: 'Nhà Tiền Lê', dynastyName: 'Nhà Tiền Lê', startYear: 980, endYear: 1009 },
  { epochId: 'EPOCH_04', dynastyId: 'dynasty_ly', name: 'Nhà Lý', dynastyName: 'Nhà Lý', startYear: 1010, endYear: 1225 },
  { epochId: 'EPOCH_05', dynastyId: 'dynasty_tran', name: 'Nhà Trần', dynastyName: 'Nhà Trần', startYear: 1226, endYear: 1399 },
  { epochId: 'EPOCH_06', dynastyId: 'dynasty_ho', name: 'Nhà Hồ', dynastyName: 'Nhà Hồ', startYear: 1400, endYear: 1406 },
  { epochId: 'EPOCH_07', dynastyId: 'epoch_minh_thuoc', name: 'Thời kỳ thuộc Minh & Hậu Trần', dynastyName: 'Thời kỳ thuộc Minh / Hậu Trần', startYear: 1407, endYear: 1427 },
  { epochId: 'EPOCH_08', dynastyId: 'dynasty_le_so', name: 'Nhà Lê Sơ', dynastyName: 'Nhà Lê Sơ', startYear: 1428, endYear: 1527 },
  { epochId: 'EPOCH_09', dynastyId: 'dynasty_mac', name: 'Nhà Mạc & Nam Bắc Triều', dynastyName: 'Nhà Mạc / Nam Bắc Triều', startYear: 1528, endYear: 1592 },
  { epochId: 'EPOCH_09', dynastyId: 'dynasty_le_trung_hung', name: 'Thời kỳ Lê Trung Hưng & Trịnh - Nguyễn', dynastyName: 'Lê Trung Hưng / Trịnh - Nguyễn', startYear: 1593, endYear: 1777 },
  { epochId: 'EPOCH_10', dynastyId: 'dynasty_tay_son', name: 'Nhà Tây Sơn', dynastyName: 'Nhà Tây Sơn', startYear: 1778, endYear: 1801 },
  { epochId: 'EPOCH_11', dynastyId: 'dynasty_nguyen', name: 'Nhà Nguyễn (Độc lập)', dynastyName: 'Nhà Nguyễn', startYear: 1802, endYear: 1883 },
  { epochId: 'EPOCH_12', dynastyId: 'epoch_phap_thuoc', name: 'Thời kỳ Pháp thuộc / Triều đình Huế', dynastyName: 'Thời kỳ Pháp thuộc', startYear: 1884, endYear: 1944 },
  { epochId: 'EPOCH_13', dynastyId: 'epoch_hien_dai', name: 'Thời kỳ Hiện đại (1945 - Nay)', dynastyName: 'Thời kỳ Hiện đại', startYear: 1945, endYear: 2026 },
];

/**
 * Finds the historical epoch & dynasty for a given Gregorian / BCE year
 */
export function findHistoricalEpoch(year: number): HistoricalEpochRange | undefined {
  if (isNaN(year)) return undefined;
  for (const epoch of HISTORICAL_CHRONOLOGY) {
    if (year >= epoch.startYear && year <= epoch.endYear) {
      return epoch;
    }
  }
  if (year < -2879) return HISTORICAL_CHRONOLOGY[0];
  if (year > 2026) return HISTORICAL_CHRONOLOGY[HISTORICAL_CHRONOLOGY.length - 1];
  return undefined;
}

/**
 * Normalized lookup helper for Reign Eras (Niên hiệu), resolving collisions via context
 */
export function resolveReignEra(
  reignName: string,
  context?: { year?: number; dynasty?: string }
): ReignEraInfo | undefined {
  if (!reignName || typeof reignName !== 'string') return undefined;
  const clean = reignName.trim().toLowerCase().normalize('NFC');
  
  // 1. Direct match by reignName across all entries
  const matched = Object.values(REIGN_ERA_DICTIONARY).filter(
    (info) => info.reignName.toLowerCase().normalize('NFC') === clean
  );
  if (matched.length === 0) return undefined;
  if (matched.length === 1) return matched[0];

  // 2. Disambiguate by year context
  if (context?.year !== undefined && !isNaN(context.year)) {
    const byYear = matched.find((m) => context.year! >= m.startYear && context.year! <= m.endYear);
    if (byYear) return byYear;
  }

  // 3. Disambiguate by dynasty context
  if (context?.dynasty) {
    const cleanDyn = context.dynasty.toLowerCase().normalize('NFC');
    const byDyn = matched.find((m) => m.dynasty.toLowerCase().normalize('NFC').includes(cleanDyn));
    if (byDyn) return byDyn;
  }

  return matched[0];
}

