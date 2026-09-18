/**
 * Administrative Hierarchy Dictionary & Regional Lookup
 */
import type { AdministrativeHierarchy } from './types.js';

export const ADMINISTRATIVE_HIERARCHY_DICTIONARY: Record<string, AdministrativeHierarchy> = {
  // --- Nghệ An & Ha Tinh ---
  'kim liên': { canonicalName: 'Kim Liên', unitType: 'COMMUNE', parentNames: ['Nam Đàn', 'Nghệ An'], modernProvince: 'Nghệ An', aliases: ['làng sen', 'sen', 'làng kim liên'] },
  'hoàng trù': { canonicalName: 'Hoàng Trù', unitType: 'VILLAGE', parentNames: ['Kim Liên', 'Nam Đàn', 'Nghệ An'], modernProvince: 'Nghệ An', aliases: ['làng chùa'] },
  'nam đàn': { canonicalName: 'Nam Đàn', unitType: 'DISTRICT', parentNames: ['Nghệ An'], modernProvince: 'Nghệ An', aliases: ['huyện nam đàn'] },
  'nghệ an': { canonicalName: 'Nghệ An', unitType: 'PROVINCE', parentNames: ['Nghệ Tĩnh', 'Bắc Trung Bộ'], modernProvince: 'Nghệ An', aliases: ['xứ nghệ', 'tỉnh nghệ an'] },
  'truông bồn': { canonicalName: 'Truông Bồn', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Đô Lương', 'Nghệ An'], modernProvince: 'Nghệ An' },
  'đô lương': { canonicalName: 'Đô Lương', unitType: 'DISTRICT', parentNames: ['Nghệ An'], modernProvince: 'Nghệ An' },
  'hà tĩnh': { canonicalName: 'Hà Tĩnh', unitType: 'PROVINCE', parentNames: ['Nghệ Tĩnh', 'Bắc Trung Bộ'], modernProvince: 'Hà Tĩnh', aliases: ['tỉnh hà tĩnh'] },
  'đồng lộc': { canonicalName: 'Đồng Lộc', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Can Lộc', 'Hà Tĩnh'], modernProvince: 'Hà Tĩnh', aliases: ['ngã ba đồng lộc'] },
  'can lộc': { canonicalName: 'Can Lộc', unitType: 'DISTRICT', parentNames: ['Hà Tĩnh'], modernProvince: 'Hà Tĩnh' },
  'hương khê': { canonicalName: 'Hương Khê', unitType: 'DISTRICT', parentNames: ['Hà Tĩnh'], modernProvince: 'Hà Tĩnh' },

  // --- Ninh Bình ---
  'hoa lư': { canonicalName: 'Hoa Lư', unitType: 'ANCIENT_CAPITAL', parentNames: ['Ninh Bình'], modernProvince: 'Ninh Bình', aliases: ['cố đô hoa lư', 'kinh đô hoa lư', 'huyện hoa lư'] },
  'ninh bình': { canonicalName: 'Ninh Bình', unitType: 'PROVINCE', parentNames: ['Đồng Bằng Sông Hồng'], modernProvince: 'Ninh Bình', aliases: ['tỉnh ninh bình'] },
  'tam điệp': { canonicalName: 'Tam Điệp', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Ninh Bình'], modernProvince: 'Ninh Bình', aliases: ['đèo ba dội'] },

  // --- Hà Nội & Ancient Capitals ---
  'cổ loa': { canonicalName: 'Cổ Loa', unitType: 'ANCIENT_CAPITAL', parentNames: ['Đông Anh', 'Hà Nội'], modernProvince: 'Hà Nội', aliases: ['thành cổ loa', 'kinh đô cổ loa'] },
  'đông anh': { canonicalName: 'Đông Anh', unitType: 'DISTRICT', parentNames: ['Hà Nội'], modernProvince: 'Hà Nội' },
  'thăng long': { canonicalName: 'Thăng Long', unitType: 'ANCIENT_CAPITAL', parentNames: ['Hà Nội'], modernProvince: 'Hà Nội', aliases: ['hoàng thành thăng long', 'kinh thành thăng long', 'đông đô', 'đông kinh', 'đông quan', 'kẻ chợ'] },
  'đông đô': { canonicalName: 'Đông Đô', unitType: 'ANCIENT_CAPITAL', parentNames: ['Hà Nội'], modernProvince: 'Hà Nội' },
  'đông kinh': { canonicalName: 'Đông Kinh', unitType: 'ANCIENT_CAPITAL', parentNames: ['Hà Nội'], modernProvince: 'Hà Nội' },
  'hà nội': { canonicalName: 'Hà Nội', unitType: 'PROVINCE', parentNames: ['Đồng Bằng Sông Hồng'], modernProvince: 'Hà Nội', aliases: ['thành phố hà nội', 'thủ đô hà nội'] },
  'đường lâm': { canonicalName: 'Đường Lâm', unitType: 'VILLAGE', parentNames: ['Sơn Tây', 'Hà Nội'], modernProvince: 'Hà Nội', aliases: ['làng đường lâm'] },
  'sơn tây': { canonicalName: 'Sơn Tây', unitType: 'DISTRICT', parentNames: ['Hà Nội'], modernProvince: 'Hà Nội', aliases: ['thị xã sơn tây', 'xứ đoài'] },
  'ngọc hồi': { canonicalName: 'Ngọc Hồi', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Thanh Trì', 'Hà Nội'], modernProvince: 'Hà Nội', aliases: ['đồn ngọc hồi'] },
  'đống đa': { canonicalName: 'Đống Đa', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Hà Nội'], modernProvince: 'Hà Nội', aliases: ['gò đống đa'] },
  'chương dương': { canonicalName: 'Chương Dương', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Thường Tín', 'Hà Nội'], modernProvince: 'Hà Nội', aliases: ['bến chương dương'] },
  'mê linh': { canonicalName: 'Mê Linh', unitType: 'ANCIENT_CAPITAL', parentNames: ['Hà Nội'], modernProvince: 'Hà Nội', aliases: ['huyện mê linh'] },

  // --- Thanh Hóa ---
  'lam sơn': { canonicalName: 'Lam Sơn', unitType: 'COMMUNE', parentNames: ['Thọ Xuân', 'Thanh Hóa'], modernProvince: 'Thanh Hóa', aliases: ['đất lam sơn', 'vùng lam sơn'] },
  'thọ xuân': { canonicalName: 'Thọ Xuân', unitType: 'DISTRICT', parentNames: ['Thanh Hóa'], modernProvince: 'Thanh Hóa', aliases: ['huyện thọ xuân'] },
  'lam kinh': { canonicalName: 'Lam Kinh', unitType: 'ANCIENT_CAPITAL', parentNames: ['Thọ Xuân', 'Thanh Hóa'], modernProvince: 'Thanh Hóa' },
  'tây đô': { canonicalName: 'Tây Đô', unitType: 'ANCIENT_CAPITAL', parentNames: ['Vĩnh Lộc', 'Thanh Hóa'], modernProvince: 'Thanh Hóa', aliases: ['thành nhà hồ', 'thành tây đô'] },
  'thanh hóa': { canonicalName: 'Thanh Hóa', unitType: 'PROVINCE', parentNames: ['Bắc Trung Bộ'], modernProvince: 'Thanh Hóa', aliases: ['xứ thanh', 'tỉnh thanh hóa'] },
  'ba đình thanh hóa': { canonicalName: 'Ba Đình', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Nga Sơn', 'Thanh Hóa'], modernProvince: 'Thanh Hóa', aliases: ['chiến khu ba đình'] },

  // --- Hải Dương & Hải Phòng & Quảng Ninh ---
  'vạn kiếp': { canonicalName: 'Vạn Kiếp', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Chí Linh', 'Hải Dương'], modernProvince: 'Hải Dương', aliases: ['lục đầu giang', 'kiếp bạc'] },
  'côn sơn': { canonicalName: 'Côn Sơn', unitType: 'REGION', parentNames: ['Chí Linh', 'Hải Dương'], modernProvince: 'Hải Dương' },
  'chí linh': { canonicalName: 'Chí Linh', unitType: 'DISTRICT', parentNames: ['Hải Dương'], modernProvince: 'Hải Dương', aliases: ['thành phố chí linh'] },
  'hải dương': { canonicalName: 'Hải Dương', unitType: 'PROVINCE', parentNames: ['Đồng Bằng Sông Hồng'], modernProvince: 'Hải Dương', aliases: ['tỉnh hải dương', 'xứ đông'] },
  'bạch đằng': { canonicalName: 'Bạch Đằng', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Quảng Ninh', 'Hải Phòng'], modernProvince: 'Quảng Ninh', aliases: ['sông bạch đằng'] },
  'vân đồn': { canonicalName: 'Vân Đồn', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Quảng Ninh'], modernProvince: 'Quảng Ninh', aliases: ['thương cảng vân đồn'] },
  'quảng ninh': { canonicalName: 'Quảng Ninh', unitType: 'PROVINCE', parentNames: ['Đông Bắc Bộ'], modernProvince: 'Quảng Ninh', aliases: ['tỉnh quảng ninh'] },
  'hải phòng': { canonicalName: 'Hải Phòng', unitType: 'PROVINCE', parentNames: ['Đồng Bằng Sông Hồng'], modernProvince: 'Hải Phòng', aliases: ['thành phố hải phòng'] },

  // --- Bắc Ninh & Bắc Giang & Hưng Yên & Nam Định ---
  'luy lâu': { canonicalName: 'Luy Lâu', unitType: 'ANCIENT_CAPITAL', parentNames: ['Thuận Thành', 'Bắc Ninh'], modernProvince: 'Bắc Ninh', aliases: ['thành luy lâu'] },
  'như nguyệt': { canonicalName: 'Như Nguyệt', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Yên Phong', 'Bắc Ninh', 'Bắc Giang'], modernProvince: 'Bắc Ninh', aliases: ['sông như nguyệt', 'phòng tuyến như nguyệt'] },
  'bình than': { canonicalName: 'Bình Than', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Gia Bình', 'Bắc Ninh'], modernProvince: 'Bắc Ninh', aliases: ['bến bình than'] },
  'bắc ninh': { canonicalName: 'Bắc Ninh', unitType: 'PROVINCE', parentNames: ['Đồng Bằng Sông Hồng'], modernProvince: 'Bắc Ninh', aliases: ['xứ kinh bắc', 'tỉnh bắc ninh'] },
  'yên thế': { canonicalName: 'Yên Thế', unitType: 'REGION', parentNames: ['Bắc Giang'], modernProvince: 'Bắc Giang', aliases: ['chiến khu yên thế', 'huyện yên thế'] },
  'bắc giang': { canonicalName: 'Bắc Giang', unitType: 'PROVINCE', parentNames: ['Đông Bắc Bộ'], modernProvince: 'Bắc Giang', aliases: ['tỉnh bắc giang'] },
  'hàm tử': { canonicalName: 'Hàm Tử', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Khoái Châu', 'Hưng Yên'], modernProvince: 'Hưng Yên', aliases: ['cửa hàm tử', 'bến hàm tử'] },
  'hưng yên': { canonicalName: 'Hưng Yên', unitType: 'PROVINCE', parentNames: ['Đồng Bằng Sông Hồng'], modernProvince: 'Hưng Yên', aliases: ['phố hiến', 'tỉnh hưng yên'] },
  'bảo lộc': { canonicalName: 'Bảo Lộc', unitType: 'VILLAGE', parentNames: ['Mỹ Lộc', 'Nam Định'], modernProvince: 'Nam Định', aliases: ['làng bảo lộc'] },
  'tức mặc': { canonicalName: 'Tức Mặc', unitType: 'VILLAGE', parentNames: ['Mỹ Lộc', 'Nam Định'], modernProvince: 'Nam Định', aliases: ['phủ thiên trường', 'làng tức mặc'] },
  'nam định': { canonicalName: 'Nam Định', unitType: 'PROVINCE', parentNames: ['Đồng Bằng Sông Hồng'], modernProvince: 'Nam Định', aliases: ['tỉnh nam định', 'xứ sơn nam'] },

  // --- Phú Thọ & Tây Bắc / Việt Bắc ---
  'phong châu': { canonicalName: 'Phong Châu', unitType: 'ANCIENT_CAPITAL', parentNames: ['Phú Thọ'], modernProvince: 'Phú Thọ', aliases: ['kinh đô phong châu'] },
  'phú thọ': { canonicalName: 'Phú Thọ', unitType: 'PROVINCE', parentNames: ['Trung Du Miền Núi Phía Bắc'], modernProvince: 'Phú Thọ', aliases: ['tỉnh phú thọ', 'đất tổ'] },
  'chi lăng': { canonicalName: 'Chi Lăng', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Lạng Sơn'], modernProvince: 'Lạng Sơn', aliases: ['ải chi lăng'] },
  'lạng sơn': { canonicalName: 'Lạng Sơn', unitType: 'PROVINCE', parentNames: ['Đông Bắc Bộ'], modernProvince: 'Lạng Sơn', aliases: ['tỉnh lạng sơn'] },
  'pác bó': { canonicalName: 'Pác Bó', unitType: 'COMMUNE', parentNames: ['Hà Quảng', 'Cao Bằng'], modernProvince: 'Cao Bằng', aliases: ['hang pác bó', 'suối lê nin'] },
  'cao bằng': { canonicalName: 'Cao Bằng', unitType: 'PROVINCE', parentNames: ['Đông Bắc Bộ'], modernProvince: 'Cao Bằng', aliases: ['tỉnh cao bằng'] },
  'tân trào': { canonicalName: 'Tân Trào', unitType: 'COMMUNE', parentNames: ['Sơn Dương', 'Tuyên Quang'], modernProvince: 'Tuyên Quang', aliases: ['chiến khu tân trào', 'cây đa tân trào'] },
  'tuyên quang': { canonicalName: 'Tuyên Quang', unitType: 'PROVINCE', parentNames: ['Đông Bắc Bộ'], modernProvince: 'Tuyên Quang', aliases: ['tỉnh tuyên quang', 'thủ đô kháng chiến'] },
  'định hóa': { canonicalName: 'Định Hóa', unitType: 'DISTRICT', parentNames: ['Thái Nguyên'], modernProvince: 'Thái Nguyên', aliases: ['an toàn khu định hóa', 'atk định hóa'] },
  'thái nguyên': { canonicalName: 'Thái Nguyên', unitType: 'PROVINCE', parentNames: ['Đông Bắc Bộ'], modernProvince: 'Thái Nguyên', aliases: ['tỉnh thái nguyên'] },
  'điện biên phủ': { canonicalName: 'Điện Biên Phủ', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Điện Biên'], modernProvince: 'Điện Biên', aliases: ['lòng chảo điện biên', 'tập đoàn cứ điểm điện biên phủ'] },
  'điện biên': { canonicalName: 'Điện Biên', unitType: 'PROVINCE', parentNames: ['Tây Bắc Bộ'], modernProvince: 'Điện Biên', aliases: ['tỉnh điện biên'] },

  // --- Quảng Bình & Quảng Trị & Thừa Thiên Huế ---
  'an xá': { canonicalName: 'An Xá', unitType: 'VILLAGE', parentNames: ['Lộc Thủy', 'Lệ Thủy', 'Quảng Bình'], modernProvince: 'Quảng Bình', aliases: ['làng an xá'] },
  'lệ thủy': { canonicalName: 'Lệ Thủy', unitType: 'DISTRICT', parentNames: ['Quảng Bình'], modernProvince: 'Quảng Bình', aliases: ['huyện lệ thủy'] },
  'lộc thủy': { canonicalName: 'Lộc Thủy', unitType: 'COMMUNE', parentNames: ['Lệ Thủy', 'Quảng Bình'], modernProvince: 'Quảng Bình', aliases: ['xã lộc thủy'] },
  'quảng bình': { canonicalName: 'Quảng Bình', unitType: 'PROVINCE', parentNames: ['Bắc Trung Bộ'], modernProvince: 'Quảng Bình', aliases: ['tỉnh quảng bình'] },
  'quảng trị': { canonicalName: 'Quảng Trị', unitType: 'PROVINCE', parentNames: ['Bắc Trung Bộ'], modernProvince: 'Quảng Trị', aliases: ['tỉnh quảng trị', 'thành cổ quảng trị'] },
  'khe sanh': { canonicalName: 'Khe Sanh', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Hướng Hóa', 'Quảng Trị'], modernProvince: 'Quảng Trị' },
  'phú xuân': { canonicalName: 'Phú Xuân', unitType: 'ANCIENT_CAPITAL', parentNames: ['Thừa Thiên Huế', 'Huế'], modernProvince: 'Thừa Thiên Huế', aliases: ['kinh đô phú xuân', 'kinh thành huế', 'cố đô huế'] },
  'thuận hóa': { canonicalName: 'Thuận Hóa', unitType: 'REGION', parentNames: ['Thừa Thiên Huế', 'Quảng Trị', 'Quảng Bình'], modernProvince: 'Thừa Thiên Huế', aliases: ['xứ thuận hóa'] },
  'thừa thiên huế': { canonicalName: 'Thừa Thiên Huế', unitType: 'PROVINCE', parentNames: ['Bắc Trung Bộ'], modernProvince: 'Thừa Thiên Huế', aliases: ['huế', 'tỉnh thừa thiên huế'] },
  'huế': { canonicalName: 'Huế', unitType: 'PROVINCE', parentNames: ['Thừa Thiên Huế'], modernProvince: 'Thừa Thiên Huế', aliases: ['thành phố huế'] },

  // --- Bình Định & Tây Sơn & Miền Nam ---
  'tây sơn': { canonicalName: 'Tây Sơn', unitType: 'DISTRICT', parentNames: ['Bình Định'], modernProvince: 'Bình Định', aliases: ['huyện tây sơn', 'vùng tây sơn'] },
  'bình định': { canonicalName: 'Bình Định', unitType: 'PROVINCE', parentNames: ['Duyên Hải Nam Trung Bộ'], modernProvince: 'Bình Định', aliases: ['tỉnh bình định', 'quy nhơn'] },
  'gia định': { canonicalName: 'Gia Định', unitType: 'REGION', parentNames: ['Thành phố Hồ Chí Minh', 'Sài Gòn'], modernProvince: 'Thành phố Hồ Chí Minh', aliases: ['thành gia định', 'phủ gia định'] },
  'sài gòn': { canonicalName: 'Sài Gòn', unitType: 'PROVINCE', parentNames: ['Đông Nam Bộ'], modernProvince: 'Thành phố Hồ Chí Minh', aliases: ['thành phố hồ chí minh', 'tp hcm', 'tp.hcm'] },
  'thành phố hồ chí minh': { canonicalName: 'Thành phố Hồ Chí Minh', unitType: 'PROVINCE', parentNames: ['Đông Nam Bộ'], modernProvince: 'Thành phố Hồ Chí Minh', aliases: ['sài gòn', 'tp.hcm', 'tphcm'] },
  'rạch gầm xoài mút': { canonicalName: 'Rạch Gầm - Xoài Mút', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Châu Thành', 'Tiền Giang', 'Mỹ Tho'], modernProvince: 'Tiền Giang', aliases: ['rạch gầm', 'xoài mút'] },
  'tiền giang': { canonicalName: 'Tiền Giang', unitType: 'PROVINCE', parentNames: ['Đồng Bằng Sông Cửu Long'], modernProvince: 'Tiền Giang', aliases: ['tỉnh tiền giang', 'mỹ tho'] },
  'ấp bắc': { canonicalName: 'Ấp Bắc', unitType: 'FORTRESS_OR_BATTLEFIELD', parentNames: ['Cai Lậy', 'Tiền Giang'], modernProvince: 'Tiền Giang' },
  'côn đảo': { canonicalName: 'Côn Đảo', unitType: 'REGION', parentNames: ['Bà Rịa - Vũng Tàu'], modernProvince: 'Bà Rịa - Vũng Tàu', aliases: ['huyện côn đảo', 'nhà tù côn đảo'] },
  'bà rịa vũng tàu': { canonicalName: 'Bà Rịa - Vũng Tàu', unitType: 'PROVINCE', parentNames: ['Đông Nam Bộ'], modernProvince: 'Bà Rịa - Vũng Tàu' },
};

/**
 * Normalizes place query string by stripping prefixes like "xã", "huyện", "tỉnh", "thành phố", "làng"
 */
export function normalizePlaceName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .normalize('NFC')
    .replace(/\b(tỉnh|thành phố|thị xã|huyện|quận|xã|phường|làng|thành|cố đô|kinh đô|phủ|sông|đồn|bến|gò|ải)\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Finds matching administrative entity in dictionary
 */
export function lookupAdministrativeHierarchy(name: string): AdministrativeHierarchy | undefined {
  if (!name || typeof name !== 'string') return undefined;
  const rawKey = name.toLowerCase().normalize('NFC').trim();
  if (ADMINISTRATIVE_HIERARCHY_DICTIONARY[rawKey]) {
    return ADMINISTRATIVE_HIERARCHY_DICTIONARY[rawKey];
  }
  const normKey = normalizePlaceName(name);
  if (ADMINISTRATIVE_HIERARCHY_DICTIONARY[normKey]) {
    return ADMINISTRATIVE_HIERARCHY_DICTIONARY[normKey];
  }

  // Scan aliases
  for (const [key, item] of Object.entries(ADMINISTRATIVE_HIERARCHY_DICTIONARY)) {
    if (item.canonicalName.toLowerCase() === rawKey || item.canonicalName.toLowerCase() === normKey) {
      return item;
    }
    if (item.aliases) {
      for (const a of item.aliases) {
        if (a.toLowerCase() === rawKey || a.toLowerCase() === normKey || normalizePlaceName(a) === normKey) {
          return item;
        }
      }
    }
  }
  return undefined;
}
