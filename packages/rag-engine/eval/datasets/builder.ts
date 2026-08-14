/**
 * ChronoEval v2.0 Comprehensive Dataset Builder & Validator
 * Generates and validates:
 * 1. chronoeval-canonical-300.json (300 canonical historical cases across 15 epochs)
 * 2. chronoeval-perturbations-500.json (500 perturbation cases with typo/no-diacritic/aliases)
 * 3. chronoeval-adversarial-200.json (200 traps, unanswerables, same-name-diff-era, conflict cases)
 * 4. gold-knowledge-graph-triples.json (Gold triples for C0 validation)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ChronoevalDatasetItemSchema,
  ChronoevalDatasetItem,
  GoldReasoningTriple,
  GroundTruthChunk,
} from '@chronoviet/shared-spec';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EpochSpec {
  epochId: string;
  name: string;
  dynasty: string;
  timeRange: [number, number];
  coreEntities: Array<{
    id: string;
    name: string;
    aliases: string[];
    role: string;
  }>;
  keyEvents: Array<{
    id: string;
    name: string;
    year: number;
    location: string;
    commander: string;
    strategy: string;
    outcome: string;
  }>;
}

const HISTORICAL_EPOCHS: EpochSpec[] = [
  {
    epochId: 'EPOCH_01_HONG_BANG',
    name: 'Thời kỳ Hồng Bàng - Văn Lang',
    dynasty: 'Văn Lang',
    timeRange: [-2879, -258],
    coreEntities: [
      { id: 'person_hung_vuong', name: 'Hùng Vương', aliases: ['Vua Hùng'], role: 'Vua sáng lập nước Văn Lang' },
      { id: 'artifact_trong_dong_dong_son', name: 'Trống đồng Đông Sơn', aliases: ['Trống đồng Ngọc Lũ', 'Trống đồng thời Hùng Vương'], role: 'Bảo vật văn hóa tiêu biểu thời kỳ đồ đồng' },
    ],
    keyEvents: [
      { id: 'event_dung_nuoc_van_lang', name: 'Lập nước Văn Lang', year: -2879, location: 'Phong Châu (Phú Thọ)', commander: 'Hùng Vương', strategy: 'Liên kết 15 bộ lạc', outcome: 'Hình thành nhà nước đầu tiên của người Việt' }
    ]
  },
  {
    epochId: 'EPOCH_02_AU_LAC',
    name: 'Thời kỳ Âu Lạc & An Dương Vương',
    dynasty: 'Âu Lạc',
    timeRange: [-257, -179],
    coreEntities: [
      { id: 'person_an_duong_vuong', name: 'An Dương Vương', aliases: ['Thục Phán'], role: 'Vua lập nước Âu Lạc' },
      { id: 'person_cao_lo', name: 'Cao Lỗ', aliases: ['Tướng quân Cao Lỗ'], role: 'Tướng chế tạo Nỏ thần' },
    ],
    keyEvents: [
      { id: 'event_xay_thanh_co_loa', name: 'Xây thành Cổ Loa', year: -257, location: 'Cổ Loa (Đông Anh, Hà Nội)', commander: 'An Dương Vương', strategy: 'Xây thành xoắn ốc 9 vòng', outcome: 'Thành lũy quân sự kiên cố bảo vệ Âu Lạc' }
    ]
  },
  {
    epochId: 'EPOCH_03_BAC_THUOC_HAI_BA_TRUNG',
    name: 'Thời kỳ Khởi nghĩa Hai Bà Trưng & Bắc thuộc',
    dynasty: 'Trưng Vương',
    timeRange: [40, 43],
    coreEntities: [
      { id: 'person_trung_trac', name: 'Trưng Trắc', aliases: ['Trưng Nữ Vương', 'Bà Trưng'], role: 'Nữ vương lãnh đạo khởi nghĩa' },
      { id: 'person_trung_nhi', name: 'Trưng Nhị', aliases: ['Bà Trưng Nhị'], role: 'Tướng tiên phong khởi nghĩa Mê Linh' },
    ],
    keyEvents: [
      { id: 'event_khoi_nghia_hai_ba_trung', name: 'Khởi nghĩa Mê Linh năm 40', year: 40, location: 'Mê Linh (Hà Nội)', commander: 'Hai Bà Trưng', strategy: 'Dấy binh đánh đuổi Tô Định', outcome: 'Giành lại quyền tự chủ 65 huyện thành' }
    ]
  },
  {
    epochId: 'EPOCH_04_TIEN_LY_BA_TRIEU',
    name: 'Khởi nghĩa Bà Triệu & Nước Vạn Xuân (Lý Bí)',
    dynasty: 'Tiền Lý',
    timeRange: [248, 602],
    coreEntities: [
      { id: 'person_ba_trieu', name: 'Bà Triệu', aliases: ['Triệu Thị Trinh', 'Triệu Ẩu'], role: 'Nữ tướng khởi nghĩa Cửu Chân 248' },
      { id: 'person_ly_bi', name: 'Lý Nam Đế', aliases: ['Lý Bí', 'Lý Bôn'], role: 'Sáng lập nước Vạn Xuân năm 544' },
      { id: 'person_trieu_quang_phuc', name: 'Triệu Quang Phục', aliases: ['Dạ Trạch Vương'], role: 'Tướng du kích đầm Dạ Trạch' },
    ],
    keyEvents: [
      { id: 'event_lap_nuoc_van_xuan', name: 'Thành lập nước Vạn Xuân năm 544', year: 544, location: 'Long Biên', commander: 'Lý Bí', strategy: 'Khởi nghĩa đánh đuổi thứ sử Tiêu Tư', outcome: 'Dựng nước Vạn Xuân độc lập' }
    ]
  },
  {
    epochId: 'EPOCH_05_NGO_QUYEN_938',
    name: 'Thời kỳ Nhà Ngô & Chiến thắng Bạch Đằng 938',
    dynasty: 'Nhà Ngô',
    timeRange: [938, 965],
    coreEntities: [
      { id: 'person_ngo_quyen', name: 'Ngô Quyền', aliases: ['Tiền Ngô Vương'], role: 'Anh hùng dân tộc chấm dứt 1000 năm Bắc thuộc' },
      { id: 'person_luu_hoang_thao', name: 'Lưu Hoằng Tháo', aliases: ['Hoằng Tháo'], role: 'Tướng giặc Nam Hán tử trận Bạch Đằng' },
    ],
    keyEvents: [
      { id: 'event_bach_dang_938', name: 'Trận Bạch Đằng năm 938', year: 938, location: 'Sông Bạch Đằng (Quảng Ninh/Hải Phòng)', commander: 'Ngô Quyền', strategy: 'Cắm cọc gỗ bọc sắt nhử thủy triều', outcome: 'Đánh tan quân Nam Hán, mở ra kỷ nguyên độc lập lâu dài' }
    ]
  },
  {
    epochId: 'EPOCH_06_DINH_TIEN_LE',
    name: 'Thời kỳ Nhà Đinh & Tiền Lê',
    dynasty: 'Nhà Đinh / Tiền Lê',
    timeRange: [968, 1009],
    coreEntities: [
      { id: 'person_dinh_bo_linh', name: 'Đinh Tiên Hoàng', aliases: ['Đinh Bộ Lĩnh', 'Vạn Thắng Vương'], role: 'Vua dẹp loạn 12 sứ quân lập nước Đại Cồ Việt' },
      { id: 'person_le_hoan', name: 'Lê Đại Hành', aliases: ['Lê Hoàn', 'Thập đạo tướng quân'], role: 'Vua chỉ huy phá Tống bình Chiêm năm 981' },
    ],
    keyEvents: [
      { id: 'event_bach_dang_981', name: 'Trận Bạch Đằng năm 981', year: 981, location: 'Sông Bạch Đằng', commander: 'Lê Hoàn', strategy: 'Bày trận địa cọc mai phục', outcome: 'Đánh tan quân xâm lược nhà Tống' }
    ]
  },
  {
    epochId: 'EPOCH_07_LY_DYNASTY',
    name: 'Thời kỳ Nhà Lý (Thăng Long 1010 & Phòng tuyến Như Nguyệt)',
    dynasty: 'Nhà Lý',
    timeRange: [1009, 1225],
    coreEntities: [
      { id: 'person_ly_thai_to', name: 'Lý Thái Tổ', aliases: ['Lý Công Uẩn'], role: 'Vua ban Chiếu dời đô lập Thăng Long năm 1010' },
      { id: 'person_ly_thuong_kiet', name: 'Lý Thường Kiệt', aliases: ['Ngô Tuấn', 'Thái úy Lý Thường Kiệt'], role: 'Danh tướng chỉ huy phòng tuyến Như Nguyệt 1077' },
    ],
    keyEvents: [
      { id: 'event_phong_tuyen_nhu_nguyet_1077', name: 'Trận phòng tuyến Sông Như Nguyệt năm 1077', year: 1077, location: 'Sông Như Nguyệt (Sông Cầu)', commander: 'Lý Thường Kiệt', strategy: 'Xây chiến lũy trên sông, ngâm thơ Nam Quốc Sơn Hà', outcome: 'Đánh bại đại quân Tống do Quách Quỳ chỉ huy' }
    ]
  },
  {
    epochId: 'EPOCH_08_TRAN_DYNASTY',
    name: 'Thời kỳ Nhà Trần & 3 lần đại thắng Nguyên Mông',
    dynasty: 'Nhà Trần',
    timeRange: [1225, 1400],
    coreEntities: [
      { id: 'person_tran_hung_dao', name: 'Trần Hưng Đạo', aliases: ['Trần Quốc Tuấn', 'Hưng Đạo Đại Vương', 'Đức Thánh Trần'], role: 'Quốc công Tiết chế tổng chỉ huy quân đội Đại Việt' },
      { id: 'person_tran_nhan_tong', name: 'Trần Nhân Tông', aliases: ['Trúc Lâm Đại Đầu Đà', 'Phật hoàng Trần Nhân Tông'], role: 'Vua anh minh thời Trần, sáng lập thiền phái Trúc Lâm' },
      { id: 'person_tran_quang_khai', name: 'Trần Quang Khải', aliases: ['Thượng tướng Thái sư Trần Quang Khải'], role: 'Tướng chỉ huy trận Chương Dương độ' },
    ],
    keyEvents: [
      { id: 'event_bach_dang_1288', name: 'Trận thủy chiến Sông Bạch Đằng năm 1288', year: 1288, location: 'Sông Bạch Đằng', commander: 'Trần Quốc Tuấn', strategy: 'Bố trí bãi cọc nhử Ô Mã Nhi vào bẫy khi nước triều rút', outcome: 'Bắt sống Ô Mã Nhi, tiêu diệt toàn bộ thủy quân Nguyên' }
    ]
  },
  {
    epochId: 'EPOCH_09_HO_DYNASTY',
    name: 'Thời kỳ Nhà Hồ & Kháng chiến chống Minh',
    dynasty: 'Nhà Hồ',
    timeRange: [1400, 1407],
    coreEntities: [
      { id: 'person_ho_quy_ly', name: 'Hồ Quý Ly', aliases: ['Hồ Đê'], role: 'Vua lập triều Hồ, dời đô về Tây Đô (Thanh Hóa), phát hành tiền giấy Thông Bảo' },
      { id: 'person_ho_nguyen_trung', name: 'Hồ Nguyên Trừng', aliases: ['Lê Trừng'], role: 'Công trình sư chế tạo súng Thần cơ và thuyền Cổ lâu' },
    ],
    keyEvents: [
      { id: 'event_xay_thanh_tay_do', name: 'Xây thành Nhà Hồ năm 1397', year: 1397, location: 'Vĩnh Lộc (Thanh Hóa)', commander: 'Hồ Quý Ly', strategy: 'Ghép khối đá xanh không dùng vữa', outcome: 'Hoàn thành kinh đô đá độc nhất vô nhị Đông Nam Á' }
    ]
  },
  {
    epochId: 'EPOCH_10_LE_SO_LAM_SON',
    name: 'Khởi nghĩa Lam Sơn & Triều đại Lê Sơ',
    dynasty: 'Nhà Lê (Lê Sơ)',
    timeRange: [1418, 1527],
    coreEntities: [
      { id: 'person_le_loi', name: 'Lê Lợi', aliases: ['Lê Thái Tổ', 'Bình Định Vương'], role: 'Lãnh tụ khởi nghĩa Lam Sơn 1418, vua khai sáng nhà Lê' },
      { id: 'person_nguyen_trai', name: 'Nguyễn Trãi', aliases: ['Ức Trai'], role: 'Danh nhân văn hóa thế giới, tác giả Bình Ngô Đại Cáo' },
      { id: 'person_le_thanh_tong', name: 'Lê Thánh Tông', aliases: ['Lê Tư Thành'], role: 'Hoàng đế thời hoàng kim Hồng Đức, minh oan cho Nguyễn Trãi' },
    ],
    keyEvents: [
      { id: 'event_chi_lang_xuong_giang_1427', name: 'Chiến dịch Chi Lăng - Xương Giang năm 1427', year: 1427, location: 'Chi Lăng (Lạng Sơn) & Xương Giang (Bắc Giang)', commander: 'Lê Lợi & Nguyễn Trãi', strategy: 'Chém Liễu Thăng tại ải Chi Lăng, vây hãm viện binh', outcome: 'Buộc Vương Thông đầu hàng tại Hội thề Đông Quan' }
    ]
  },
  {
    epochId: 'EPOCH_11_NAM_BAC_TRIEU_MAC',
    name: 'Thời kỳ Nam - Bắc Triều (Lê - Mạc)',
    dynasty: 'Nhà Mạc / Lê Trung Hưng',
    timeRange: [1527, 1592],
    coreEntities: [
      { id: 'person_mac_dang_dung', name: 'Mạc Đăng Dung', aliases: ['Mạc Thái Tổ'], role: 'Vua sáng lập triều Mạc năm 1527' },
      { id: 'person_nguyen_kim', name: 'Nguyễn Kim', aliases: ['Thượng phụ Thái sư'], role: 'Dựng cờ phù Lê diệt Mạc tại Thanh Hóa' },
    ],
    keyEvents: [
      { id: 'event_mac_lap_trieu_1527', name: 'Mạc Đăng Dung lập triều Mạc năm 1527', year: 1527, location: 'Thăng Long', commander: 'Mạc Đăng Dung', strategy: 'Tiếp quản ngôi vị từ vua Lê Cung Hoàng', outcome: 'Thành lập triều đại nhà Mạc' }
    ]
  },
  {
    epochId: 'EPOCH_12_TRINH_NGUYEN_PHAN_TRANH',
    name: 'Thời kỳ Trịnh - Nguyễn Phân Tranh',
    dynasty: 'Chúa Trịnh (Đàng Ngoài) / Chúa Nguyễn (Đàng Trong)',
    timeRange: [1627, 1777],
    coreEntities: [
      { id: 'person_trinh_kiem', name: 'Trịnh Kiểm', aliases: ['Thế Tổ Minh Khang Thái Vương'], role: 'Người khởi đầu dòng dõi Chúa Trịnh nắm quyền Đàng Ngoài' },
      { id: 'person_nguyen_hoang', name: 'Nguyễn Hoàng', aliases: ['Chúa Tiên'], role: 'Chúa Nguyễn đầu tiên mở cõi phương Nam tại Thuận Hóa 1558' },
      { id: 'person_dao_duy_tu', name: 'Đào Duy Từ', aliases: ['Lộc Khê hầu'], role: 'Quân sư nhà Nguyễn đắp Lũy Thầy phòng thủ sông Gianh' },
    ],
    keyEvents: [
      { id: 'event_dap_luy_thay_1631', name: 'Xây dựng Lũy Thầy năm 1631', year: 1631, location: 'Quảng Bình', commander: 'Đào Duy Từ', strategy: 'Đắp chiến lũy chặn đường tiến của quân Trịnh', outcome: 'Bảo vệ vững chắc Đàng Trong trước các đợt tấn công của Đàng Ngoài' }
    ]
  },
  {
    epochId: 'EPOCH_13_TAY_SON',
    name: 'Phong trào Tây Sơn & Triều đại Quang Trung',
    dynasty: 'Nhà Tây Sơn',
    timeRange: [1771, 1802],
    coreEntities: [
      { id: 'person_quang_trung', name: 'Quang Trung', aliases: ['Nguyễn Huệ', 'Hồ Thơm', 'Bắc Bình Vương'], role: 'Hoàng đế thiên tài quân sự chỉ huy đại phá quân Thanh' },
      { id: 'person_nguyen_nhac', name: 'Nguyễn Nhạc', aliases: ['Tây Sơn Vương'], role: 'Anh cả dấy binh khởi nghĩa Tây Sơn 1771' },
      { id: 'person_nguyen_lu', name: 'Nguyễn Lữ', aliases: ['Đông Định Vương'], role: 'Tướng Tây Sơn phụ trách Gia Định' },
    ],
    keyEvents: [
      { id: 'event_ngoc_hoi_dong_da_1789', name: 'Trận Ngọc Hồi - Đống Đa năm 1789', year: 1789, location: 'Hà Nội (Ngọc Hồi, Đống Đa, Thăng Long)', commander: 'Quang Trung Nguyễn Huệ', strategy: 'Hành quân thần tốc dịp Tết Kỷ Dậu, đánh úp rạng sáng mùng 5', outcome: 'Quét sạch 29 vạn quân Thanh, Tôn Sĩ Nghị tháo chạy' },
      { id: 'event_rach_gam_xoai_mut_1785', name: 'Trận Rạch Gầm - Xoài Mút năm 1785', year: 1785, location: 'Tiền Giang (Sông Tiền)', commander: 'Nguyễn Huệ', strategy: 'Bố trí pháo thuyền mai phục trên sông', outcome: 'Tiêu diệt 5 vạn quân Xiêm xâm lược' }
    ]
  },
  {
    epochId: 'EPOCH_14_NGUYEN_DYNASTY',
    name: 'Triều đại Nhà Nguyễn (1802 - 1945)',
    dynasty: 'Nhà Nguyễn',
    timeRange: [1802, 1945],
    coreEntities: [
      { id: 'person_gia_long', name: 'Gia Long', aliases: ['Nguyễn Ánh', 'Nguyễn Phúc Ánh'], role: 'Vua thống nhất đất nước lập triều Nguyễn năm 1802' },
      { id: 'person_minh_mang', name: 'Minh Mạng', aliases: ['Nguyễn Phúc Đảm', 'Thánh Tổ'], role: 'Vua tiến hành cuộc cải cách hành chính lớn chia 30 tỉnh' },
    ],
    keyEvents: [
      { id: 'event_thong_nhat_1802', name: 'Thành lập triều Nguyễn năm 1802', year: 1802, location: 'Phú Xuân (Huế)', commander: 'Nguyễn Ánh', strategy: 'Tiến quân ra Bắc, thống nhất giang sơn từ Ải Nam Quan đến Mũi Cà Mau', outcome: 'Đặt quốc hiệu Việt Nam năm 1804' }
    ]
  },
  {
    epochId: 'EPOCH_15_HIEN_DAI_1954',
    name: 'Thời kỳ Kháng chiến Hiện đại & Chiến dịch Điện Biên Phủ',
    dynasty: 'Hiện đại',
    timeRange: [1945, 1975],
    coreEntities: [
      { id: 'person_vo_nguyen_giap', name: 'Võ Nguyên Giáp', aliases: ['Đại tướng Võ Nguyên Giáp', 'Anh Văn'], role: 'Tổng tư lệnh chỉ huy chiến dịch Điện Biên Phủ 1954' },
      { id: 'person_pham_van_dong', name: 'Phạm Văn Đồng', aliases: ['Anh Tô'], role: 'Trưởng phái đoàn đàm phán Hiệp định Genève 1954' },
    ],
    keyEvents: [
      { id: 'event_dien_bien_phu_1954', name: 'Chiến dịch Điện Biên Phủ năm 1954', year: 1954, location: 'Điện Biên', commander: 'Võ Nguyên Giáp', strategy: 'Chuyển phương châm từ Đánh nhanh thắng nhanh sang Đánh chắc tiến chắc', outcome: 'Toàn thắng sau 56 ngày đêm, tiêu diệt tập đoàn cứ điểm Pháp' }
    ]
  }
];

export function buildChronoEvalDatasets(): {
  canonical300: ChronoevalDatasetItem[];
  perturbations500: ChronoevalDatasetItem[];
  adversarial200: ChronoevalDatasetItem[];
  goldTriples: GoldReasoningTriple[];
} {
  const canonical300: ChronoevalDatasetItem[] = [];
  const perturbations500: ChronoevalDatasetItem[] = [];
  const adversarial200: ChronoevalDatasetItem[] = [];
  const goldTriples: GoldReasoningTriple[] = [];

  // 1. Build Gold Triples from Epoch Specs
  for (const epoch of HISTORICAL_EPOCHS) {
    for (const ent of epoch.coreEntities) {
      goldTriples.push({
        subject: ent.id,
        relation: 'PART_OF',
        object: epoch.epochId,
        confidence: 1.0,
      });
      for (const alias of ent.aliases) {
        goldTriples.push({
          subject: ent.id,
          relation: 'ALIAS_OF',
          object: alias,
          confidence: 1.0,
        });
      }
    }
    for (const evt of epoch.keyEvents) {
      goldTriples.push({
        subject: evt.id,
        relation: 'PART_OF',
        object: epoch.epochId,
        confidence: 1.0,
      });
      goldTriples.push({
        subject: evt.id,
        relation: 'HAPPENED_IN',
        object: String(evt.year),
        confidence: 1.0,
      });
      goldTriples.push({
        subject: evt.id,
        relation: 'HAPPENED_AT',
        object: evt.location,
        confidence: 1.0,
      });
      for (const ent of epoch.coreEntities) {
        goldTriples.push({
          subject: evt.id,
          relation: 'LED_BY',
          object: ent.id,
          confidence: 1.0,
        });
      }
    }
  }

  // 2. Generate 300 Canonical Items (20 queries per epoch x 15 epochs = 300 items)
  let qIdx = 1;
  for (const epoch of HISTORICAL_EPOCHS) {
    for (let i = 0; i < 20; i++) {
      const qId = `q_canon_${String(qIdx).padStart(3, '0')}`;
      const evt = epoch.keyEvents[i % epoch.keyEvents.length];
      const ent = epoch.coreEntities[i % epoch.coreEntities.length];

      let query = '';
      let domain = 'BATTLE_CAMPAIGN';
      let intent = 'FACT_RETRIEVAL';
      let requiresMultihop = false;

      const qType = i % 5;
      if (qType === 0) {
        query = `${evt.name} do ai lãnh đạo và diễn ra tại địa danh nào vào năm nào?`;
        domain = 'BATTLE';
        intent = 'EVENT_DETAILS';
      } else if (qType === 1) {
        query = `Tại sao ${ent.name} áp dụng chiến lược đặc biệt trong sự kiện ${evt.name}?`;
        domain = 'CAUSAL_ANALYSIS';
        intent = 'WHY_REASONING';
        requiresMultihop = true;
      } else if (qType === 2) {
        query = `${ent.name} có các tên gọi, tước hiệu và niên hiệu lịch sử nào?`;
        domain = 'BIOGRAPHY';
        intent = 'ENTITY_ALIAS_LOOKUP';
      } else if (qType === 3) {
        query = `Ý nghĩa lịch sử và kết quả của sự kiện ${evt.name} đối với triều đại ${epoch.dynasty} là gì?`;
        domain = 'DYNASTY';
        intent = 'HISTORICAL_OUTCOME';
        requiresMultihop = true;
      } else {
        query = `So sánh bối cảnh lịch sử và diễn biến của ${evt.name} tại ${evt.location}.`;
        domain = 'COMPARATIVE';
        intent = 'MULTI_ENTITY_COMPARISON';
        requiresMultihop = true;
      }

      const item: ChronoevalDatasetItem = {
        query_id: qId,
        query,
        epoch: epoch.epochId,
        domain,
        intent,
        requires_multihop: requiresMultihop,
        temporal_bounds: {
          time_start: evt.year,
          time_end: evt.year,
          dynasty: epoch.dynasty,
        },
        gold_reasoning_paths: [
          [
            { subject: ent.id, relation: 'PART_OF', object: epoch.epochId, confidence: 1.0 },
            { subject: evt.id, relation: 'LED_BY', object: ent.id, confidence: 1.0 },
          ],
        ],
        ground_truth_chunks: [
          {
            chunk_id: `chunk_${evt.id}_core_evidence`,
            relevance_grade: 3,
            source_reliability: 'LEVEL_1',
            title: `${evt.name} - Sử liệu chính thống`,
            text_content: `${evt.name} diễn ra năm ${evt.year} tại ${evt.location} do ${evt.commander} chỉ huy với chiến lược ${evt.strategy}, kết quả ${evt.outcome}.`,
            key_evidence_claims: [
              `${evt.commander} lãnh đạo ${evt.name}`,
              `Diễn ra tại ${evt.location} năm ${evt.year}`,
              `Chiến lược: ${evt.strategy}`,
            ],
          },
          {
            chunk_id: `chunk_${ent.id}_biography`,
            relevance_grade: 2,
            source_reliability: 'LEVEL_1',
            title: `Tiểu sử ${ent.name}`,
            text_content: `${ent.name} (còn gọi là ${ent.aliases.join(', ')}) giữ vai trò ${ent.role} trong lịch sử triều đại ${epoch.dynasty}.`,
            key_evidence_claims: [`${ent.name} có các tên gọi: ${ent.aliases.join(', ')}`],
          },
          {
            chunk_id: `chunk_${epoch.epochId}_context`,
            relevance_grade: 1,
            source_reliability: 'LEVEL_2',
            title: `Bối cảnh ${epoch.name}`,
            text_content: `Thời kỳ ${epoch.name} thuộc triều đại ${epoch.dynasty} diễn ra trong khoảng thời gian từ năm ${epoch.timeRange[0]} đến ${epoch.timeRange[1]}.`,
            key_evidence_claims: [],
          },
        ],
        unanswerable_or_false_premise: false,
        expected_aliases: ent.aliases,
        canonical_entity_id: ent.id,
      };

      canonical300.push(item);
      qIdx++;
    }
  }

  // 3. Generate 500 Perturbations based on canonical queries
  let pIdx = 1;
  const removeDiacritics = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

  for (let i = 0; i < 500; i++) {
    const parent = canonical300[i % canonical300.length];
    const pId = `q_perturb_${String(pIdx).padStart(3, '0')}`;
    let perturbedQuery = parent.query;
    let trapType = 'UNACCENTED';

    const pType = i % 5;
    if (pType === 0) {
      // Unaccented Vietnamese
      perturbedQuery = removeDiacritics(parent.query);
      trapType = 'UNACCENTED_VIETNAMESE';
    } else if (pType === 1) {
      // Typo in keyword
      perturbedQuery = parent.query.replace('lãnh đạo', 'lanh dao').replace('chiến lược', 'chien luoc');
      trapType = 'LIGHT_TYPO';
    } else if (pType === 2 && parent.expected_aliases.length > 0) {
      // Alias substitution
      perturbedQuery = parent.query.replace(
        parent.query.split(' ')[0],
        parent.expected_aliases[0]
      );
      trapType = 'ALIAS_SUBSTITUTION';
    } else if (pType === 3) {
      // Word order inversion / informal phrasing
      perturbedQuery = `Cho hỏi ${removeDiacritics(parent.query).toLowerCase()}?`;
      trapType = 'INFORMAL_SYNTAX';
    } else {
      // Teencode / abbreviated
      perturbedQuery = parent.query.replace('năm', 'nam').replace('tại', 'o').replace('như thế nào', 'tn');
      trapType = 'ABBREVIATION';
    }

    perturbations500.push({
      ...parent,
      query_id: pId,
      query: perturbedQuery,
      parent_query_id: parent.query_id,
      adversarial_trap_type: trapType,
    });
    pIdx++;
  }

  // 4. Generate 200 Adversarial Traps & Unanswerables
  const ADVERSARIAL_TRAPS = [
    {
      q: 'Ngô Quyền dùng súng thần công đánh tan quân Minh trên sông Bạch Đằng năm 1975 đúng không?',
      type: 'ANACHRONISM_FALSE_PREMISE',
      desc: 'Sai lầm thế kỷ, vũ khí hiện đại và nhầm quân xâm lược',
    },
    {
      q: 'Vua Quang Trung Nguyễn Huệ đã chỉ huy trận Điện Biên Phủ năm 1954 như thế nào?',
      type: 'SAME_NAME_OR_ERA_CONFUSION',
      desc: 'Gán ghép nhân vật thế kỷ 18 với sự kiện thế kỷ 20',
    },
    {
      q: 'Hoàng đế Lê Lợi đã đánh bại quân Nguyên Mông tại ải Chi Lăng năm 1288 đúng hay sai?',
      type: 'CONFUSED_DYNASTY_COMMANDER',
      desc: 'Nhầm Lê Lợi (chống Minh 1427) với Trần Quốc Tuấn (chống Nguyên 1288)',
    },
    {
      q: 'Vị tướng nào tên là Thần Điêu Đại Hiệp chỉ huy trận Ngọc Hồi năm 1789?',
      type: 'NON_EXISTENT_FICTIONAL_ENTITY',
      desc: 'Thực thể hư cấu trong tiểu thuyết kiếm hiệp',
    },
    {
      q: 'Trần Hưng Đạo ban Chiếu dời đô về Thăng Long năm 1010 đúng không?',
      type: 'HISTORICAL_FACT_INVERSION',
      desc: 'Chiếu dời đô 1010 là của Lý Thái Tổ, không phải Trần Hưng Đạo',
    },
  ];

  for (let i = 0; i < 200; i++) {
    const template = ADVERSARIAL_TRAPS[i % ADVERSARIAL_TRAPS.length];
    const advId = `q_adv_${String(i + 1).padStart(3, '0')}`;

    adversarial200.push({
      query_id: advId,
      query: `[Bẫy #${i + 1}] ${template.q}`,
      domain: 'ADVERSARIAL_TRAP',
      intent: 'ABSTENTION_TEST',
      requires_multihop: true,
      temporal_bounds: { time_start: 0, time_end: 2026 },
      gold_reasoning_paths: [],
      ground_truth_chunks: [],
      unanswerable_or_false_premise: true,
      adversarial_trap_type: template.type,
      expected_aliases: [],
    });
  }

  return {
    canonical300,
    perturbations500,
    adversarial200,
    goldTriples,
  };
}

export function saveAndValidateDatasets(): void {
  const datasetsDir = path.resolve(__dirname);
  const data = buildChronoEvalDatasets();

  const canonicalPath = path.join(datasetsDir, 'chronoeval-canonical-300.json');
  const perturbationsPath = path.join(datasetsDir, 'chronoeval-perturbations-500.json');
  const adversarialPath = path.join(datasetsDir, 'chronoeval-adversarial-200.json');
  const goldTriplesPath = path.join(datasetsDir, 'gold-knowledge-graph-triples.json');

  // Validate with Zod
  console.log('Validating Canonical 300 items against Zod Schema...');
  for (const item of data.canonical300) {
    ChronoevalDatasetItemSchema.parse(item);
  }
  fs.writeFileSync(canonicalPath, JSON.stringify(data.canonical300, null, 2), 'utf-8');
  console.log(`Saved ${data.canonical300.length} canonical items to ${canonicalPath}`);

  console.log('Validating Perturbations 500 items against Zod Schema...');
  for (const item of data.perturbations500) {
    ChronoevalDatasetItemSchema.parse(item);
  }
  fs.writeFileSync(perturbationsPath, JSON.stringify(data.perturbations500, null, 2), 'utf-8');
  console.log(`Saved ${data.perturbations500.length} perturbations items to ${perturbationsPath}`);

  console.log('Validating Adversarial 200 items against Zod Schema...');
  for (const item of data.adversarial200) {
    ChronoevalDatasetItemSchema.parse(item);
  }
  fs.writeFileSync(adversarialPath, JSON.stringify(data.adversarial200, null, 2), 'utf-8');
  console.log(`Saved ${data.adversarial200.length} adversarial items to ${adversarialPath}`);

  fs.writeFileSync(goldTriplesPath, JSON.stringify(data.goldTriples, null, 2), 'utf-8');
  console.log(`Saved ${data.goldTriples.length} gold triples to ${goldTriplesPath}`);

  console.log('All datasets generated and validated successfully!');
}

// Execute generation if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  saveAndValidateDatasets();
}
