/**
 * Master Historical Corpus Catalog (15 Standardized Epochs Specification)
 * Contains comprehensive Wikipedia topics, primary sources, battles, and key figures covering all 15 Epochs of Vietnamese History.
 */

export interface EpochCatalogEntry {
  epochId: string;
  epochName: string;
  dynastyTag: string;
  timeRange: string;
  topics: string[];
}

export const MASTER_HISTORICAL_CATALOG: EpochCatalogEntry[] = [
  {
    epochId: 'EPOCH_01',
    epochName: 'Thời Hùng Vương - Văn Lang & Âu Lạc',
    dynastyTag: 'Văn Lang / Âu Lạc',
    timeRange: 'Tự khởi đầu - 179 TCN',
    topics: [
      'Hùng Vương',
      'Văn Lang',
      'Âu Lạc',
      'An Dương Vương',
      'Thành Cổ Loa',
      'Trống đồng Đông Sơn',
      'Văn hóa Đông Sơn',
      'Sơn Tinh Thủy Tinh',
      'Thánh Gióng',
      'Nỏ thần',
    ],
  },
  {
    epochId: 'EPOCH_02',
    epochName: 'Thời Bắc Thuộc & Các Cuộc Khởi Nghĩa Giành Độc Lập',
    dynastyTag: 'Bắc Thuộc',
    timeRange: '179 TCN - 938',
    topics: [
      'Bắc Thuộc',
      'Hai Bà Trưng',
      'Bà Triệu',
      'Lý Nam Đế',
      'Nhà Tiền Lý',
      'Vạn Xuân',
      'Mai Thúc Loan',
      'Phùng Hưng',
      'Khúc Thừa Dụ',
      'Dương Đình Nghệ',
      'Ngô Quyền',
      'Trận Bạch Đằng (938)',
    ],
  },
  {
    epochId: 'EPOCH_03',
    epochName: 'Thời Ngô - Đinh - Tiền Lê',
    dynastyTag: 'Ngô / Đinh / Tiền Lê',
    timeRange: '938 - 1009',
    topics: [
      'Nhà Ngô',
      'Đinh Tiên Hoàng',
      'Đinh Bộ Lĩnh',
      'Nhà Đinh',
      'Cố đô Hoa Lư',
      'Loạn 12 sứ quân',
      'Lê Đại Hành',
      'Nhà Tiền Lê',
      'Trận sông Bạch Đằng (981)',
    ],
  },
  {
    epochId: 'EPOCH_04',
    epochName: 'Thời Lý',
    dynastyTag: 'Nhà Lý',
    timeRange: '1009 - 1225',
    topics: [
      'Lý Thái Tổ',
      'Lý Công Uẩn',
      'Chiếu dời đô',
      'Thăng Long',
      'Lý Thái Tông',
      'Lý Thánh Tông',
      'Lý Nhân Tông',
      'Lý Thường Kiệt',
      'Nam quốc sơn hà',
      'Trận Như Nguyệt',
      'Nhà Lý',
    ],
  },
  {
    epochId: 'EPOCH_05',
    epochName: 'Thời Trần',
    dynastyTag: 'Nhà Trần',
    timeRange: '1225 - 1400',
    topics: [
      'Nhà Trần',
      'Trần Thái Tông',
      'Trần Thủ Độ',
      'Trần Hưng Đạo',
      'Trần Quốc Tuấn',
      'Hịch tướng sĩ',
      'Hội nghị Diên Hồng',
      'Chiến tranh Mông-Nguyên – Đại Việt',
      'Trận Tây Kết',
      'Trận Chương Dương',
      'Trận Bạch Đằng (1288)',
      'Trần Nhân Tông',
      'Thiền phái Trúc Lâm',
      'Chu Văn An',
    ],
  },
  {
    epochId: 'EPOCH_06',
    epochName: 'Thời Nhà Hồ & Các Cuộc Canh Tân',
    dynastyTag: 'Nhà Hồ',
    timeRange: '1400 - 1407',
    topics: [
      'Hồ Quý Ly',
      'Nhà Hồ',
      'Thành nhà Hồ',
      'Nhà Hậu Trần',
      'Trận Cổ Lộng',
    ],
  },
  {
    epochId: 'EPOCH_07',
    epochName: 'Thời Kỳ Bắc Thuộc Lần 4 & Khởi Nghĩa Lam Sơn',
    dynastyTag: 'Lam Sơn',
    timeRange: '1407 - 1427',
    topics: [
      'Bắc thuộc lần 4',
      'Khởi nghĩa Lam Sơn',
      'Lê Lợi',
      'Nguyễn Trãi',
      'Bình Ngô đại cáo',
      'Trận Tốt Động – Chúc Động',
      'Trận Chi Lăng – Xương Giang',
      'Hội thề Đông Quan',
      'Nguyễn Chích',
      'Trần Nguyên Hãn',
    ],
  },
  {
    epochId: 'EPOCH_08',
    epochName: 'Thời Lê Sơ',
    dynastyTag: 'Nhà Lê Sơ',
    timeRange: '1428 - 1527',
    topics: [
      'Nhà Lê sơ',
      'Lê Thái Tổ',
      'Lê Thái Tông',
      'Lê Thánh Tông',
      'Hồng Đức bảo hình',
      'Quốc sử quán',
      'Bia Tiến sĩ Văn Miếu',
      'Thảm án Lệ Chi Viên',
      'Ngô Sĩ Liên',
      'Đại Việt sử ký toàn thư',
    ],
  },
  {
    epochId: 'EPOCH_09',
    epochName: 'Thời Nam - Bắc Triều & Trịnh - Nguyễn Phân Tranh',
    dynastyTag: 'Lê - Mạc / Trịnh - Nguyễn',
    timeRange: '1527 - 1777',
    topics: [
      'Chiến tranh Lê–Mạc',
      'Nhà Mạc',
      'Chúa Trịnh',
      'Chúa Nguyễn',
      'Trịnh - Nguyễn phân tranh',
      'Đàng Trong',
      'Đàng Ngoài',
      'Phú Xuân',
      'Nguyễn Hoàng',
      'Trịnh Kiểm',
    ],
  },
  {
    epochId: 'EPOCH_10',
    epochName: 'Thời Kỳ Tây Sơn & Phong Trào Khởi Nghĩa',
    dynastyTag: 'Nhà Tây Sơn',
    timeRange: '1771 - 1802',
    topics: [
      'Nhà Tây Sơn',
      'Nguyễn Huệ',
      'Quang Trung',
      'Nguyễn Nhạc',
      'Nguyễn Lữ',
      'Trận Rạch Gầm – Xoài Mút',
      'Trận Ngọc Hồi – Đống Đa',
      'Bùi Thị Xuân',
      'Trần Quang Diệu',
      'Ngô Thì Nhậm',
    ],
  },
  {
    epochId: 'EPOCH_11',
    epochName: 'Thời Nhà Nguyễn Độc Lập',
    dynastyTag: 'Nhà Nguyễn',
    timeRange: '1802 - 1858',
    topics: [
      'Nhà Nguyễn',
      'Gia Long',
      'Nguyễn Ánh',
      'Minh Mạng',
      'Thiệu Trị',
      'Tự Đức',
      'Đại Nam thực lục',
      'Hoàng thành Huế',
    ],
  },
  {
    epochId: 'EPOCH_12',
    epochName: 'Thời Kỳ Pháp Thuộc & Phong Trào Yêu Nước / Cách Mạng',
    dynastyTag: 'Pháp Thuộc / Cách Mạng',
    timeRange: '1858 - 1945',
    topics: [
      'Pháp thuộc',
      'Trận Đà Nẵng (1858)',
      'Trương Định',
      'Nguyễn Trung Trực',
      'Phong trào Cần Vương',
      'Phan Đình Phùng',
      'Phan Bội Châu',
      'Phong trào Đông Du',
      'Phan Châu Trinh',
      'Nguyễn Thái Học',
      'Cách mạng Tháng Tám',
      'Tuyên ngôn Độc lập (Việt Nam Dân chủ Cộng hòa)',
    ],
  },
  {
    epochId: 'EPOCH_13',
    epochName: 'Thời Kỳ Kháng Chiến Chống Thực Dân Pháp',
    dynastyTag: 'Kháng Chiến Chống Pháp',
    timeRange: '1945 - 1954',
    topics: [
      'Kháng chiến chống Pháp',
      'Chiến dịch Việt Bắc',
      'Chiến dịch Biên giới 1950',
      'Chiến dịch Điện Biên Phủ',
      'Võ Nguyên Giáp',
      'Hồ Chí Minh',
      'Hiệp định Giơ-ne-vơ 1954',
    ],
  },
  {
    epochId: 'EPOCH_14',
    epochName: 'Thời Kỳ Kháng Chiến Chống Đế Quốc Mỹ & Thống Nhất Đất Nước',
    dynastyTag: 'Kháng Chiến Chống Mỹ',
    timeRange: '1954 - 1975',
    topics: [
      'Chiến tranh Việt Nam',
      'Chiến dịch Tết Mậu Thân 1968',
      'Chiến dịch Điện Biên Phủ trên không',
      'Chiến dịch Hồ Chí Minh',
      'Đường Trường Sơn',
      'Sự kiện 30 tháng 4 năm 1975',
      'Hiệp định Pa-ri 1973',
    ],
  },
  {
    epochId: 'EPOCH_15',
    epochName: 'Thời Kỳ Bảo Vệ Tổ Quốc, Đổi Mới & Hiện Đại',
    dynastyTag: 'Hiện Đại',
    timeRange: '1975 - Nay',
    topics: [
      'Chiến tranh biên giới Việt–Trung 1979',
      'Chiến tranh biên giới Tây Nam',
      'Đổi Mới',
      'Lịch sử Việt Nam',
    ],
  },
];

/**
 * Gets a flat, deduplicated list of all topics across all 15 epochs
 */
export function getAllMasterTopics(): string[] {
  const topicSet = new Set<string>();
  for (const entry of MASTER_HISTORICAL_CATALOG) {
    for (const topic of entry.topics) {
      topicSet.add(topic.trim());
    }
  }
  return Array.from(topicSet);
}

/**
 * Gets topics for a specific historical epoch ID or numeric index (e.g., 'EPOCH_05' or '5')
 */
export function getTopicsByEpoch(epochIdentifier: string): EpochCatalogEntry | undefined {
  const normId = epochIdentifier.toUpperCase().trim();
  const num = parseInt(normId.replace(/\D/g, ''), 10);

  return MASTER_HISTORICAL_CATALOG.find((entry) => {
    if (entry.epochId === normId) return true;
    if (!isNaN(num)) {
      const entryNum = parseInt(entry.epochId.replace(/\D/g, ''), 10);
      return entryNum === num;
    }
    return false;
  });
}
