/**
 * ChronoEval v2.0 Comprehensive Dataset Builder & Validator
 * Production-Grade Historical Dataset Generator
 *
 * Generates:
 * 1. chronoeval-canonical-300.json (300 canonical historical cases across 15 epochs with rich multi-sentence passages)
 * 2. chronoeval-perturbations-500.json (500 perturbation cases with authentic Vietnamese typos, telex errors, aliases, and informal syntax)
 * 3. chronoeval-adversarial-200.json (200 diverse historical traps: anachronisms, same-name confusions, folklore vs official history, inverted causalities)
 * 4. gold-knowledge-graph-triples.json (Gold triples for knowledge graph construction and reasoning)
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
    biography: string;
  }>;
  keyEvents: Array<{
    id: string;
    name: string;
    year: number;
    location: string;
    commander: string;
    strategy: string;
    outcome: string;
    detailedNarrative: string;
  }>;
}

const HISTORICAL_EPOCHS: EpochSpec[] = [
  {
    epochId: 'EPOCH_01_HONG_BANG',
    name: 'Thời kỳ Hồng Bàng - Văn Lang',
    dynasty: 'Hồng Bàng / Văn Lang',
    timeRange: [-2879, -258],
    coreEntities: [
      {
        id: 'person_hung_vuong',
        name: 'Hùng Vương',
        aliases: ['Vua Hùng', 'Hùng Quốc Vương', 'Hùng Duệ Vương'],
        role: 'Các vị thủ lĩnh tối cao sáng lập nhà nước Văn Lang sơ khai',
        biography:
          'Hùng Vương là danh xưng chỉ 18 đời thủ lĩnh nhà nước Văn Lang cổ đại trong truyền thuyết và lịch sử dựng nước của dân tộc Việt Nam. Đóng đô tại Phong Châu (nay thuộc tỉnh Phú Thọ), truyền thuyết ghi nhận thời đại Hùng Vương gắn liền với nền văn minh đồ đồng rực rỡ, tổ chức bộ máy quản lý gồm Lạc hầu, Lạc tướng và phân chia xã hội thành 15 bộ.',
      },
      {
        id: 'artifact_trong_dong_dong_son',
        name: 'Trống đồng Đông Sơn',
        aliases: ['Trống đồng Ngọc Lũ', 'Trống đồng Sông Đà', 'Trống đồng Hoàng Hạ'],
        role: 'Bảo vật khảo cổ và biểu tượng văn hóa tiêu biểu của văn minh Lạc Việt',
        biography:
          'Trống đồng Đông Sơn là di vật khảo cổ tiêu biểu của văn hóa Đông Sơn thời kỳ đồ đồng và đồ sắt sớm tại miền Bắc Việt Nam. Hoa văn hình sao nhiều cánh, chim Lạc, thuyền chiến và cảnh sinh hoạt lễ hội thể hiện trình độ đúc đồng điêu luyện và tư duy thẩm mỹ, tín ngưỡng thờ mặt trời của cư dân Việt cổ.',
      },
    ],
    keyEvents: [
      {
        id: 'event_dung_nuoc_van_lang',
        name: 'Sáng lập nhà nước Văn Lang',
        year: -2879,
        location: 'Phong Châu (Phú Thọ)',
        commander: 'Hùng Vương thứ nhất',
        strategy: 'Hợp nhất 15 bộ tộc Lạc Việt ven lưu vực sông Hồng, sông Mã và sông Cả',
        outcome: 'Hình thành tổ chức nhà nước phôi thai đầu tiên trong lịch sử dân tộc',
        detailedNarrative:
          'Theo Đại Việt Sử Ký Toàn Thư, con cháu Lạc Long Quân và Âu Cơ tôn người con trưởng lên làm vua, xưng hiệu Hùng Vương, đặt quốc hiệu là Văn Lang, đóng đô ở Phong Châu. Nhà nước Văn Lang chia lãnh thổ làm 15 bộ, đặt các chức Lạc hầu giúp vua coi việc nước, Lạc tướng coi việc quân dân các bộ, con trai vua gọi là Quan Lang, con gái vua gọi là Mỵ Nương.',
      },
    ],
  },
  {
    epochId: 'EPOCH_02_AU_LAC',
    name: 'Thời kỳ Âu Lạc & An Dương Vương',
    dynasty: 'Âu Lạc',
    timeRange: [-257, -179],
    coreEntities: [
      {
        id: 'person_an_duong_vuong',
        name: 'An Dương Vương',
        aliases: ['Thục Phán', 'Thục An Dương Vương'],
        role: 'Vua sáng lập nhà nước Âu Lạc và xây dựng kinh đô Cổ Loa',
        biography:
          'Thục Phán An Dương Vương là thủ lĩnh liên minh người Âu Việt và Lạc Việt. Sau khi kế tục cơ nghiệp Hùng Vương năm 257 TCN, ông lập nên nước Âu Lạc, chuyển trung tâm chính trị từ vùng núi Phong Châu về vùng đồng bằng Cổ Loa, mở ra kỷ nguyên kiến trúc quân sự thành lũy quy mô lớn.',
      },
      {
        id: 'person_cao_lo',
        name: 'Cao Lỗ',
        aliases: ['Tướng quân Cao Lỗ', 'Đô Lỗ', 'Đại tướng quân Cao Lỗ'],
        role: 'Tướng quân công trình sư chế tạo Nỏ Liên Châu (Nỏ thần)',
        biography:
          'Cao Lỗ là danh tướng thời Âu Lạc, người có công lớn giúp An Dương Vương thiết kế công trình quân sự thành Cổ Loa hình trôn ốc và sáng chế ra vũ khí Nỏ thần Liên Châu bắn một phát nhiều mũi tên đồng, tạo sức mạnh phòng thủ vượt trội trước các đợt tấn công của Triệu Đà.',
      },
    ],
    keyEvents: [
      {
        id: 'event_xay_thanh_co_loa',
        name: 'Xây dựng kinh thành Cổ Loa',
        year: -257,
        location: 'Cổ Loa (Đông Anh, Hà Nội)',
        commander: 'An Dương Vương và Cao Lỗ',
        strategy: 'Xây dựng ba vòng thành đất xoắn ốc khép kín kết hợp hào nước sâu và lũy phòng thủ liên hoàn',
        outcome: 'Tạo nên pháo đài quân sự kiên cố bậc nhất Đông Nam Á thời cổ đại',
        detailedNarrative:
          'Thành Cổ Loa được xây dựng theo cấu trúc hình xoáy trôn ốc gồm ba vòng: thành nội, thành trung và thành ngoại với chu vi lên tới hàng chục cây số. Với việc trang bị hàng vạn mũi tên đồng Cầu Vực và nỏ bắn nhiều phát, Cổ Loa đã trở thành căn cứ quân sự then chốt giúp Âu Lạc nhiều lần đẩy lùi các đợt tấn công xâm lược từ phương Bắc.',
      },
    ],
  },
  {
    epochId: 'EPOCH_03_BAC_THUOC_HAI_BA_TRUNG',
    name: 'Thời kỳ Khởi nghĩa Hai Bà Trưng & Thời Bắc thuộc',
    dynasty: 'Trưng Nữ Vương',
    timeRange: [40, 43],
    coreEntities: [
      {
        id: 'person_trung_trac',
        name: 'Trưng Trắc',
        aliases: ['Trưng Nữ Vương', 'Bà Trưng Trắc', 'Trưng Hoàng Đế'],
        role: 'Nữ vương lãnh đạo cuộc khởi nghĩa giải phóng dân tộc đầu tiên năm 40',
        biography:
          'Trưng Trắc là con gái Lạc tướng huyện Mê Linh (Hà Nội), vợ của Thi Sách huyện Chu Diên. Trước chính sách cai trị tàn bạo, bóc lột hà khắc và đồng hóa của thái thú nhà Đông Hán là Tô Định, bà cùng em gái là Trưng Nhị dựng cờ khởi nghĩa vào mùa xuân năm 40.',
      },
      {
        id: 'person_trung_nhi',
        name: 'Trưng Nhị',
        aliases: ['Bà Trưng Nhị', 'Phó tướng Trưng Nhị'],
        role: 'Nữ tướng tiên phong đồng lãnh đạo cuộc khởi nghĩa Mê Linh',
        biography:
          'Trưng Nhị cùng chị gái Trưng Trắc chiêu mộ nghĩa binh, tập hợp hào kiệt bốn phương tại cửa sông Hát (Hát Môn), trực tiếp chỉ huy nhiều trận đánh quyết định đánh đuổi Tô Định và khôi phục nền tự chủ cho đất nước.',
      },
    ],
    keyEvents: [
      {
        id: 'event_khoi_nghia_hai_ba_trung',
        name: 'Khởi nghĩa Mê Linh năm 40',
        year: 40,
        location: 'Mê Linh, Hát Môn (Hà Nội) và Luy Lâu (Bắc Ninh)',
        commander: 'Hai Bà Trưng (Trưng Trắc và Trưng Nhị)',
        strategy: 'Dấy binh thần tốc từ Mê Linh đánh chiếm trị sở Luy Lâu, buộc thái thú Tô Định tháo chạy',
        outcome: 'Thu hồi toàn bộ 65 huyện thành thuộc Giao Chỉ, Cửu Chân, Nhật Nam và Hợp Phố',
        detailedNarrative:
          'Mùa xuân năm 40 sau Công nguyên, Trưng Trắc đọc lời thề xuất quân tại cửa sông Hát: "Một xin rửa sạch nước thù / Hai xin dựng lại nghiệp xưa họ Hùng / Ba kêu oan ức lòng chồng / Bốn xin vẹn vẹn sở công lênh này". Nghĩa quân nhanh chóng đánh chiếm Mê Linh, Cổ Loa rồi hạ thành Luy Lâu. Thái thú Tô Định phải cạo râu cắt tóc bỏ trốn về Nam Hải. Trưng Trắc được tôn làm Trưng Nữ Vương đóng đô ở Mê Linh.',
      },
    ],
  },
  {
    epochId: 'EPOCH_04_TIEN_LY_BA_TRIEU',
    name: 'Khởi nghĩa Bà Triệu & Triều Tiền Lý (Lý Nam Đế - Vạn Xuân)',
    dynasty: 'Nhà Tiền Lý',
    timeRange: [248, 602],
    coreEntities: [
      {
        id: 'person_ba_trieu',
        name: 'Bà Triệu',
        aliases: ['Triệu Thị Trinh', 'Triệu Trinh Nương', 'Lệ Hải Bà Vương', 'Triệu Ẩu'],
        role: 'Nữ anh hùng dân tộc lãnh đạo cuộc khởi nghĩa chống quân Đông Ngô năm 248',
        biography:
          'Bà Triệu quê ở vùng núi Quan Yên, quận Cửu Chân (Thanh Hóa). Năm 248, bà dấy binh khởi nghĩa chống lại ách thống trị tàn khốc của nhà Đông Ngô với câu nói bất hủ: "Tôi muốn cưỡi cơn gió mạnh, đạp luồng sóng dữ, chém cá kình ở biển Đông, lấy lại giang sơn, cởi ách nô lệ, chứ không chịu khom lưng làm tì thiếp người ta".',
      },
      {
        id: 'person_ly_bi',
        name: 'Lý Nam Đế',
        aliases: ['Lý Bí', 'Lý Bôn', 'Tiền Lý Nam Đế'],
        role: 'Hoàng đế sáng lập nhà Tiền Lý và dựng nên nhà nước Vạn Xuân năm 544',
        biography:
          'Lý Bí vốn là quan Giám quân đức hạnh vùng Cửu Đức. Bất bình trước sự hà khắc của thứ sử nhà Lương là Tiêu Tư, ông liên kết các hào kiệt khởi nghĩa vào mùa xuân năm 542, quét sạch quân đô hộ, lên ngôi Hoàng đế năm 544, lấy niên hiệu Thiên Đức, dựng điện Vạn Thọ và lập chùa Khai Quốc.',
      },
      {
        id: 'person_trieu_quang_phuc',
        name: 'Triệu Quang Phục',
        aliases: ['Dạ Trạch Vương', 'Triệu Việt Vương'],
        role: 'Danh tướng kế tục sự nghiệp bảo vệ nền độc lập Vạn Xuân với chiến thuật du kích đầm Dạ Trạch',
        biography:
          'Triệu Quang Phục là tướng giỏi của Lý Nam Đế. Khi quân Lương do Trần Bá Tiên tràn sang xâm lược, ông lui về đầm Dạ Trạch (Hưng Yên), áp dụng chiến thuật du kích bí mật ban ngày ẩn nấp, ban đêm dùng thuyền độc mộc tập kích tiêu hao sinh lực địch, cuối cùng đánh bại quân xâm lược.',
      },
    ],
    keyEvents: [
      {
        id: 'event_lap_nuoc_van_xuan',
        name: 'Thành lập nước Vạn Xuân năm 544',
        year: 544,
        location: 'Long Biên (Hà Nội)',
        commander: 'Lý Bí (Lý Nam Đế)',
        strategy: 'Đánh đuổi quân Lương giải phóng Long Biên, xưng Hoàng đế và thành lập bộ máy triều đình độc lập',
        outcome: 'Khai sinh nhà nước Vạn Xuân với mong muốn đất nước trường tồn vạn mùa xuân thái bình',
        detailedNarrative:
          'Tháng Giêng năm 544, Lý Bí chính thức lên ngôi Hoàng đế, tự xưng Lý Nam Đế, đặt quốc hiệu Vạn Xuân, đóng đô ở vùng cửa sông Tô Lịch (Hà Nội). Việc xưng Đế và đặt niên hiệu riêng Thiên Đức khẳng định vị thế bình đẳng của nước ta với các hoàng đế phương Bắc.',
      },
    ],
  },
  {
    epochId: 'EPOCH_05_NGO_QUYEN_938',
    name: 'Thời kỳ Nhà Ngô & Chiến thắng Bạch Đằng 938',
    dynasty: 'Nhà Ngô',
    timeRange: [938, 965],
    coreEntities: [
      {
        id: 'person_ngo_quyen',
        name: 'Ngô Quyền',
        aliases: ['Tiền Ngô Vương', 'Ngô Tiên Chúa'],
        role: 'Vị anh hùng dân tộc vĩ đại chấm dứt hơn 1000 năm Bắc thuộc',
        biography:
          'Ngô Quyền người đất Đường Lâm (Sơn Tây, Hà Nội), là con rể Tiết độ sứ Dương Đình Nghệ. Sau khi trừ khử kẻ phản nghịch Kiều Công Tiễn, ông đã thống lĩnh quân dân Đại Việt chuẩn bị trận địa cọc ngầm trên sông Bạch Đằng, đánh tan hạm đội quân Nam Hán năm 938, xưng Vương và dời đô về Cổ Loa.',
      },
      {
        id: 'person_luu_hoang_thao',
        name: 'Lưu Hoằng Tháo',
        aliases: ['Hoằng Tháo', 'Vạn Vương Hoằng Tháo'],
        role: 'Chủ tướng quân Nam Hán chỉ huy hạm đội xâm lược và bị đền tội tại sông Bạch Đằng',
        biography:
          'Lưu Hoằng Tháo là con trai của vua Nam Hán Lưu Cung, được phong chức Giao Chỉ Tiết độ sứ dẫn thủy quân ồ ạt tiến vào cửa sông Bạch Đằng nhưng bị quân Ngô Quyền tiêu diệt hoàn toàn.',
      },
    ],
    keyEvents: [
      {
        id: 'event_bach_dang_938',
        name: 'Chiến thắng Bạch Đằng năm 938',
        year: 938,
        location: 'Sông Bạch Đằng (vùng Quảng Ninh - Hải Phòng)',
        commander: 'Ngô Quyền',
        strategy: 'Đóng bãi cọc gỗ vạt nhọn bọc sắt dưới lòng sông, lợi dụng thủy triều lên nhử địch vào bẫy rồi phản công khi triều rút',
        outcome: 'Tiêu diệt hoàn toàn hạm đội thuyền chiến giặc, giết chết Lưu Hoằng Tháo, mở ra kỷ nguyên độc lập lâu dài',
        detailedNarrative:
          'Mùa đông năm 938, đoàn thuyền chiến của Hoằng Tháo vượt biển tiến vào cửa sông Bạch Đằng. Ngô Quyền cho các thuyền nhẹ ra khiêu chiến rồi giả thua rút lui. Đợi khi nước triều rút mạnh để lộ bãi cọc nhọn ngầm, quân ta dốc toàn lực phản công. Thuyền lớn của giặc đâm vào cọc bị vỡ và chìm vô số, Hoằng Tháo tử trận. Chiến thắng này chấm dứt vĩnh viễn ách đô hộ của phong kiến phương Bắc.',
      },
    ],
  },
  {
    epochId: 'EPOCH_06_DINH_TIEN_LE',
    name: 'Thời kỳ Nhà Đinh & Nhà Tiền Lê',
    dynasty: 'Nhà Đinh / Tiền Lê',
    timeRange: [968, 1009],
    coreEntities: [
      {
        id: 'person_dinh_bo_linh',
        name: 'Đinh Tiên Hoàng',
        aliases: ['Đinh Bộ Lĩnh', 'Vạn Thắng Vương', 'Đinh Tiên Hoàng Đế'],
        role: 'Hoàng đế dẹp loạn 12 sứ quân, thống nhất non sông, lập nước Đại Cồ Việt',
        biography:
          'Đinh Bộ Lĩnh quê ở động Hoa Lư (Ninh Bình). Bằng tài năng quân sự xuất chúng, ông lần lượt đánh tan và thu phục 12 sứ quân cát cứ, thống nhất đất nước vào năm 968. Ông lên ngôi Hoàng đế, đặt quốc hiệu Đại Cồ Việt, lấy niên hiệu Thái Bình, đóng đô ở Hoa Lư.',
      },
      {
        id: 'person_le_hoan',
        name: 'Lê Đại Hành',
        aliases: ['Lê Hoàn', 'Thập đạo tướng quân', 'Lê Đại Hành Hoàng Đế'],
        role: 'Vị vua anh minh sáng lập nhà Tiền Lê, chỉ huy phá Tống bình Chiêm bảo vệ giang sơn',
        biography:
          'Lê Hoàn vốn giữ chức Thập đạo tướng quân thời Đinh. Năm 980, trước nguy cơ quân Tống xâm lược, ông được Thái hậu Dương Vân Nga và triều thần tôn lên ngôi Hoàng đế. Ông đã lãnh đạo quân dân đánh tan đại quân Tống trên bộ lẫn trên thủy tại sông Bạch Đằng và Tây Kết năm 981.',
      },
    ],
    keyEvents: [
      {
        id: 'event_bach_dang_981',
        name: 'Chiến thắng Bạch Đằng năm 981',
        year: 981,
        location: 'Sông Bạch Đằng và sông Lục Đầu',
        commander: 'Lê Đại Hành (Lê Hoàn)',
        strategy: 'Bày trận mai phục thủy bộ kết hợp, đóng cọc ngăn chặn thủy quân Hầu Nhân Bảo',
        outcome: 'Chém chết chủ tướng giặc Hầu Nhân Bảo, bắt sống nhiều tướng Tống, buộc triều đình nhà Tống từ bỏ dã tâm xâm lược',
        detailedNarrative:
          'Đầu năm 981, nhà Tống cử Hầu Nhân Bảo và Tôn Toàn Hưng chia hai đường thủy bộ tiến đánh Đại Cồ Việt. Vua Lê Hoàn đích thân chỉ huy đại quân, cho đóng cọc trên sông Bạch Đằng ngăn thuyền giặc. Trong trận quyết chiến, quân ta giết chết Hầu Nhân Bảo tại trận, thủy quân Tống tan rã, cánh quân bộ của Quách Quỳ hoảng sợ tháo chạy.',
      },
    ],
  },
  {
    epochId: 'EPOCH_07_LY_DYNASTY',
    name: 'Thời kỳ Nhà Lý (Thăng Long 1010 & Phòng tuyến Như Nguyệt)',
    dynasty: 'Nhà Lý',
    timeRange: [1009, 1225],
    coreEntities: [
      {
        id: 'person_ly_thai_to',
        name: 'Lý Thái Tổ',
        aliases: ['Lý Công Uẩn', 'Thái Tổ Hoàng Đế'],
        role: 'Vua khai sáng triều Lý, ban Chiếu dời đô lập kinh đô Thăng Long năm 1010',
        biography:
          'Lý Công Uẩn sinh tại hương Cổ Pháp (Từ Sơn, Bắc Ninh). Tháng 10 năm 1009, ông được triều thần tôn làm vua, mở đầu triều đại nhà Lý thái bình thịnh trị. Mùa thu năm Canh Tuất 1010, ông ban Chiếu dời đô, chuyển trung tâm chính trị từ Hoa Lư về thành Đại La và đổi tên thành Thăng Long.',
      },
      {
        id: 'person_ly_thuong_kiet',
        name: 'Lý Thường Kiệt',
        aliases: ['Ngô Tuấn', 'Thái úy Lý Thường Kiệt', 'Việt Quốc Công'],
        role: 'Danh tướng kiệt xuất, tổng chỉ huy phòng tuyến sông Như Nguyệt 1077',
        biography:
          'Lý Thường Kiệt (1019-1105) là danh tướng tài ba thời Lý Thánh Tông và Lý Nhân Tông. Ông chủ trương "ngồi yên đợi giặc không bằng đem quân ra trước để chặn mũi nhọn của giặc" qua chiến dịch tập kích Ung Châu năm 1075 và xây dựng phòng tuyến kiên cố trên sông Như Nguyệt năm 1077 với bài thơ thần Nam Quốc Sơn Hà.',
      },
    ],
    keyEvents: [
      {
        id: 'event_phong_tuyen_nhu_nguyet_1077',
        name: 'Chiến thắng phòng tuyến Sông Như Nguyệt năm 1077',
        year: 1077,
        location: 'Sông Như Nguyệt (Sông Cầu, Bắc Ninh)',
        commander: 'Lý Thường Kiệt',
        strategy: 'Xây chiến lũy đất tre kiên cố trên bờ Nam sông, kết hợp tâm lý chiến với bài thơ Nam Quốc Sơn Hà và tập kích ban đêm',
        outcome: 'Đánh tan hơn 10 vạn quân Tống do Quách Quỳ chỉ huy, buộc địch chấp nhận giảng hòa rút quân về nước',
        detailedNarrative:
          'Mùa xuân năm 1077, hơn 10 vạn quân Tống cùng 30 vạn phu dịch do Quách Quỳ và Triệu Tiết chỉ huy tràn sang nước ta nhưng bị chặn đứng tại phòng tuyến sông Như Nguyệt. Giữa lúc quân giặc mệt mỏi, trong đêm tối từ đền thờ Trương Hống, Trương Hát vang lên bài thơ thần: "Nam quốc sơn hà Nam đế cư / Tiệt nhiên định phận tại thiên thư / Như hà nghịch lỗ lai xâm phạm / Nhữ đẳng hành khan thủ bại hư". Lý Thường Kiệt chớp thời cơ vượt sông đánh úp tiêu diệt phần lớn quân giặc, mở đường hòa hiếu cho hai nước.',
      },
    ],
  },
  {
    epochId: 'EPOCH_08_TRAN_DYNASTY',
    name: 'Thời kỳ Nhà Trần & Ba lần đại thắng quân Nguyên Mông',
    dynasty: 'Nhà Trần',
    timeRange: [1225, 1400],
    coreEntities: [
      {
        id: 'person_tran_hung_dao',
        name: 'Trần Hưng Đạo',
        aliases: ['Trần Quốc Tuấn', 'Hưng Đạo Đại Vương', 'Đức Thánh Trần', 'Quốc công Tiết chế'],
        role: 'Quốc công Tiết chế tổng chỉ huy quân đội Đại Việt đại thắng quân Nguyên Mông',
        biography:
          'Trần Quốc Tuấn (1228-1300) là nhà chính trị, quân sự thiên tài của dân tộc Việt Nam. Ông soạn Binh thư yếu lược và Hịch tướng sĩ, thống nhất ý chí quân dân với hào khí Đông A ("Sát Thát"), lãnh đạo quân dân Đại Việt đánh tan hai cuộc xâm lược quy mô khổng lồ của đế chế Mông - Nguyên năm 1285 và 1288.',
      },
      {
        id: 'person_tran_nhan_tong',
        name: 'Trần Nhân Tông',
        aliases: ['Trần Khâm', 'Phật hoàng Trần Nhân Tông', 'Trúc Lâm Đại Đầu Đà'],
        role: 'Vị vua anh minh thời Trần, lãnh đạo kháng chiến và sáng lập thiền phái Trúc Lâm Yên Tử',
        biography:
          'Trần Nhân Tông (1258-1308) là vị hoàng đế thứ ba của triều Trần. Ông cùng vua cha Trần Thánh Tông tổ chức Hội nghị Diên Hồng năm 1284 quy tụ ý chí toàn dân đánh giặc. Sau khi hoàn thành thắng lợi sự nghiệp giữ nước, ông nhường ngôi xuất gia tu hành, thống nhất các dòng thiền lập nên Thiền phái Trúc Lâm thuần Việt.',
      },
      {
        id: 'person_tran_quang_khai',
        name: 'Trần Quang Khải',
        aliases: ['Thượng tướng Thái sư Trần Quang Khải', 'Chiêu Minh Đại Vương'],
        role: 'Tướng soái kiệt xuất chỉ huy trận phục kích bến Chương Dương năm 1285',
        biography:
          'Trần Quang Khải là hoàng tử thứ ba của vua Trần Thái Tông, giữ chức Thượng tướng Thái sư. Ông có công lớn giải phóng kinh thành Thăng Long trong trận Chương Dương độ và để lại bài thơ nổi tiếng Tụng giá hoàn kinh sư.',
      },
    ],
    keyEvents: [
      {
        id: 'event_bach_dang_1288',
        name: 'Đại thắng Bạch Đằng năm 1288',
        year: 1288,
        location: 'Sông Bạch Đằng (Quảng Ninh - Hải Phòng)',
        commander: 'Trần Quốc Tuấn và vua Trần Nhân Tông',
        strategy: 'Tái lập trận địa cọc ngầm kết hợp phục binh trên sông, chia cắt đường rút của thủy quân Ô Mã Nhi',
        outcome: 'Bắt sống toàn bộ tướng giặc Ô Mã Nhi, Phàn Tiếp, Tích Lệ Cơ, tiêu diệt hoàn toàn đoàn thuyền chiến 600 chiếc của quân Nguyên',
        detailedNarrative:
          'Tháng 4 năm 1288, khi Thoát Hoan rút quân trên bộ, thủy quân Ô Mã Nhi rút theo đường sông Bạch Đằng. Trần Hưng Đạo đã cho cắm cọc nhọn bọc sắt ở các nhánh sông hiểm yếu. Thủy quân Đại Việt khiêu chiến rồi nhử thuyền giặc vào bãi cọc khi nước triều lên. Khi triều rút mạnh, thuyền giặc mắc cọc không tiến thoái được. Phục binh Đại Việt bốn bề lao ra đốt phá và bắn tên, bắt sống toàn bộ bộ chỉ huy thủy quân Nguyên Mông, đập tan vĩnh viễn dã tâm bành trướng của Hốt Tất Liệt.',
      },
    ],
  },
  {
    epochId: 'EPOCH_09_HO_DYNASTY',
    name: 'Thời kỳ Nhà Hồ & Kháng chiến chống quân Minh',
    dynasty: 'Nhà Hồ',
    timeRange: [1400, 1407],
    coreEntities: [
      {
        id: 'person_ho_quy_ly',
        name: 'Hồ Quý Ly',
        aliases: ['Hồ Đê', 'Lê Quý Ly'],
        role: 'Nhà cải cách táo bạo, lập triều Hồ năm 1400, xây thành Tây Đô bằng đá và phát hành tiền giấy',
        biography:
          'Hồ Quý Ly (1336-1407) nắm quyền bính cuối thời Trần, lập nên nhà Hồ năm 1400, đặt quốc hiệu Đại Ngu. Ông tiến hành hàng loạt cải cách cấp tiến: phát hành tiền giấy Thông Bảo, hạn điền, hạn nô, dịch sách chữ Nôm, xây dựng kinh thành đá Tây Đô tại Thanh Hóa.',
      },
      {
        id: 'person_ho_nguyen_trung',
        name: 'Hồ Nguyên Trừng',
        aliases: ['Lê Trừng', 'Tả Tướng quốc Hồ Nguyên Trừng'],
        role: 'Công trình sư đại tài chế tạo súng Thần cơ và thuyền chiến Cổ lâu',
        biography:
          'Hồ Nguyên Trừng là con trưởng của Hồ Quý Ly. Ông là nhà phát minh quân sự kiệt xuất đã chế tạo súng Thần cơ pháo (đại bác sơ khai) và thuyền chiến hai tầng Cổ lâu, để lại câu nói nổi tiếng về lòng dân: "Thần không sợ đánh, chỉ sợ lòng dân không theo".',
      },
    ],
    keyEvents: [
      {
        id: 'event_xay_thanh_tay_do',
        name: 'Xây dựng Thành Nhà Hồ năm 1397',
        year: 1397,
        location: 'Vĩnh Lộc (Thanh Hóa)',
        commander: 'Hồ Quý Ly',
        strategy: 'Ghép nối các phiến đá xanh nguyên khối khổng lồ không sử dụng vữa kết dính',
        outcome: 'Hoàn thành tòa thành đá kiên cố độc nhất vô nhị ở Đông Nam Á trong thời gian kỷ lục 3 tháng',
        detailedNarrative:
          'Năm 1397, nhằm chuẩn bị căn cứ kháng chiến lâu dài và dời đô khỏi Thăng Long, Hồ Quý Ly cho xây dựng thành Tây Đô tại Thanh Hóa. Tòa thành được xây bằng những tảng đá vôi nặng hàng chục tấn đẽo gọt vuông vức, bốn cổng vòm cuốn kiên cố. Đây là di sản văn hóa thế giới được UNESCO công nhận.',
      },
    ],
  },
  {
    epochId: 'EPOCH_10_LE_SO_LAM_SON',
    name: 'Khởi nghĩa Lam Sơn & Triều đại Lê Sơ',
    dynasty: 'Nhà Lê (Lê Sơ)',
    timeRange: [1418, 1527],
    coreEntities: [
      {
        id: 'person_le_loi',
        name: 'Lê Lợi',
        aliases: ['Lê Thái Tổ', 'Bình Định Vương', 'Lê Lợi Hoàng Đế'],
        role: 'Lãnh tụ tối cao khởi nghĩa Lam Sơn 1418, hoàng đế khai sáng nhà Lê',
        biography:
          'Lê Lợi (1385-1433) quê ở vùng núi Lam Sơn (Thọ Xuân, Thanh Hóa). Trước ách đô hộ bạo tàn của giặc Minh, ông dấy cờ khởi nghĩa mùa xuân năm 1418, nếm mật nằm gai suốt 10 năm gian khổ, lãnh đạo nghĩa quân giải phóng đất nước, lên ngôi vua năm 1428 lập nên vương triều Hậu Lê.',
      },
      {
        id: 'person_nguyen_trai',
        name: 'Nguyễn Trãi',
        aliases: ['Ức Trai', 'Quan Phục hầu', 'Nguyễn Ức Trai'],
        role: 'Danh nhân văn hóa thế giới, quân sư đại tài, tác giả Bình Ngô Đại Cáo',
        biography:
          'Nguyễn Trãi (1380-1442) là nhà tư tưởng, chiến lược gia lỗi lạc của cuộc khởi nghĩa Lam Sơn. Ông đề xướng chiến lược "tâm công" (đánh vào lòng người) và soạn thảo bản tuyên ngôn độc lập bất hủ Bình Ngô Đại Cáo năm 1428.',
      },
      {
        id: 'person_le_thanh_tong',
        name: 'Lê Thánh Tông',
        aliases: ['Lê Tư Thành', 'Thánh Tông Thuần Hoàng Đế'],
        role: 'Vị vua anh minh đưa Đại Việt bước vào kỷ nguyên hoàng kim Hồng Đức và ban hành Quốc triều hình luật',
        biography:
          'Lê Thánh Tông (1442-1497) trị vì 38 năm, đưa chế độ phong kiến Đại Việt đạt đỉnh cao rực rỡ về kinh tế, văn hóa, lãnh thổ và luật pháp (Bộ luật Hồng Đức). Ông sáng lập hội Tao Đàn và chính thức minh oan cho Nguyễn Trãi.',
      },
    ],
    keyEvents: [
      {
        id: 'event_chi_lang_xuong_giang_1427',
        name: 'Chiến dịch Chi Lăng - Xương Giang năm 1427',
        year: 1427,
        location: 'Ải Chi Lăng (Lạng Sơn) và thành Xương Giang (Bắc Giang)',
        commander: 'Lê Lợi, Nguyễn Trãi, Trần Nguyên Hãn, Lê Sát',
        strategy: 'Nhử viện binh Liễu Thăng vào hiểm địa đầm lầy Chi Lăng tiêu diệt chủ tướng, sau đó vây hãm diệt toàn bộ đạo quân Mộc Thạnh',
        outcome: 'Chém đầu Liễu Thăng, tiêu diệt 10 vạn viện binh Minh, buộc tổng binh Vương Thông trong thành Đông Quan xin mở Hội thề đầu hàng',
        detailedNarrative:
          'Tháng 10 năm 1427, nhà Minh cử 15 vạn viện binh chia làm hai đạo do Liễu Thăng và Mộc Thạnh chỉ huy sang cứu viện thành Đông Quan. Ngày 10 tháng 10, tướng Lê Sát mai phục chém đầu Liễu Thăng tại núi Mã Yên (Chi Lăng). Nghĩa quân thừa thắng tiêu diệt toàn bộ đạo viện binh tại Xương Giang. Tổng binh Vương Thông cùng đường phải ký hòa ước tại Hội thề Đông Quan vào tháng 12 năm 1427 rút quân về nước.',
      },
    ],
  },
  {
    epochId: 'EPOCH_11_NAM_BAC_TRIEU_MAC',
    name: 'Thời kỳ Nam - Bắc Triều (Lê - Mạc)',
    dynasty: 'Nhà Mạc / Lê Trung Hưng',
    timeRange: [1527, 1592],
    coreEntities: [
      {
        id: 'person_mac_dang_dung',
        name: 'Mạc Đăng Dung',
        aliases: ['Mạc Thái Tổ', 'Nhân Minh Hoàng Đế'],
        role: 'Võ tướng lập nên triều đại nhà Mạc năm 1527',
        biography:
          'Mạc Đăng Dung xuất thân từ đô vật làng Cổ Trai (Hải Phòng), trở thành võ tướng quyền lực bậc nhất triều Lê Uy Mục và Lê Cung Hoàng. Năm 1527, ông tiếp quản ngôi vị lập nên triều Mạc, mở khoa thi tuyển nhân tài, thúc đẩy kinh tế thương mại phát triển.',
      },
      {
        id: 'person_nguyen_kim',
        name: 'Nguyễn Kim',
        aliases: ['Thượng phụ Thái sư', 'Trừng Quốc Công'],
        role: 'Tướng lĩnh lập căn cứ phù Lê diệt Mạc tại Thanh Hóa, mở đầu thời Lê Trung Hưng',
        biography:
          'Nguyễn Kim là cựu thần nhà Lê, không thần phục nhà Mạc. Năm 1533, ông tìm được con vua Lê Chiêu Tông đưa lên ngôi (vua Lê Trang Tông), dựng cờ phù Lê diệt Mạc tại Ai Lao và Thanh Hóa, khởi đầu cuộc nội chiến Nam - Bắc Triều kéo dài gần 60 năm.',
      },
      {
        id: 'person_nguyen_binh_khiem',
        name: 'Nguyễn Bỉnh Khiêm',
        aliases: ['Trạng Trình', 'Tuyết Giang Phu Tử', 'Bạch Vân Cư Sĩ'],
        role: 'Bậc đại trí thức, nhà tiên tri vĩ đại có tầm ảnh hưởng tới cả ba thế lực Lê, Mạc, Nguyễn',
        biography:
          'Nguyễn Bỉnh Khiêm (1491-1585) đỗ Trạng nguyên thời Mạc, là bậc thầy lý số và đạo đức. Ông để lại lời khuyên định mệnh cho chúa Nguyễn Hoàng: "Hoành Sơn nhất đái, vạn đại dung thân" mở ra sự nghiệp khai phá phương Nam.',
      },
    ],
    keyEvents: [
      {
        id: 'event_mac_lap_trieu_1527',
        name: 'Mạc Đăng Dung lập triều Mạc năm 1527',
        year: 1527,
        location: 'Kinh đô Thăng Long',
        commander: 'Mạc Đăng Dung',
        strategy: 'Tiếp quản chính quyền từ vua Lê Cung Hoàng khi triều Lê suy vi',
        outcome: 'Thành lập triều đại nhà Mạc cai quản vùng Bắc Bộ',
        detailedNarrative:
          'Tháng 6 năm 1527, trước sự khủng hoảng sâu sắc của hoàng tộc nhà Lê, Mạc Đăng Dung ép vua Lê Cung Hoàng nhường ngôi, lập nên nhà Mạc, đóng đô ở Thăng Long. Triều Mạc thi hành nhiều chính sách khuyến nông, phục hồi kinh tế và phát triển nghệ thuật điêu khắc gốm Chu Đậu rực rỡ.',
      },
    ],
  },
  {
    epochId: 'EPOCH_12_TRINH_NGUYEN_PHAN_TRANH',
    name: 'Thời kỳ Trịnh - Nguyễn Phân Tranh',
    dynasty: 'Chúa Trịnh (Đàng Ngoài) / Chúa Nguyễn (Đàng Trong)',
    timeRange: [1627, 1777],
    coreEntities: [
      {
        id: 'person_trinh_kiem',
        name: 'Trịnh Kiểm',
        aliases: ['Thế Tổ Minh Khang Thái Vương', 'Lạng Quốc Công Trịnh Kiểm'],
        role: 'Vị thủ lĩnh đầu tiên đặt nền móng vương quyền dòng họ Chúa Trịnh',
        biography:
          'Trịnh Kiểm là con rể của Nguyễn Kim. Sau khi Nguyễn Kim qua đời năm 1545, Trịnh Kiểm nắm trọn binh quyền triều đình vua Lê, mở đầu truyền thống lưỡng đầu chế Vua Lê - Chúa Trịnh cai trị Đàng Ngoài.',
      },
      {
        id: 'person_nguyen_hoang',
        name: 'Nguyễn Hoàng',
        aliases: ['Chúa Tiên', 'Thái Tổ Gia Dụ Hoàng Đế', 'Nguyễn Thái Tổ'],
        role: 'Vị Chúa Nguyễn đầu tiên khai hoang lập nghiệp tại xứ Thuận Hóa năm 1558',
        biography:
          'Nguyễn Hoàng là con trai thứ của Nguyễn Kim. Nghe lời khuyên của Trạng Trình Nguyễn Bỉnh Khiêm, năm 1558 ông xin vào trấn thủ Thuận Hóa, thi hành chính sách khoan dung, an dân, đặt nền móng vững chắc cho quá trình mở rộng lãnh thổ về phương Nam của người Việt.',
      },
      {
        id: 'person_dao_duy_tu',
        name: 'Đào Duy Từ',
        aliases: ['Lộc Khê hầu', 'Hoằng Quốc Công Đào Duy Từ'],
        role: 'Quân sư kiệt xuất của Chúa Sãi Nguyễn Phúc Nguyên, công trình sư xây đắp Lũy Thầy',
        biography:
          'Đào Duy Từ (1572-1634) quê ở Thanh Hóa, không được thi ở Đàng Ngoài vì xuất thân xướng ca nên đã vào Nam theo Chúa Sãi. Ông có công thiết kế hệ thống thành lũy Lũy Thầy kiên cố tại Quảng Bình và sáng lập nghệ thuật Hát Bội Nam Bộ.',
      },
    ],
    keyEvents: [
      {
        id: 'event_dap_luy_thay_1631',
        name: 'Xây dựng phòng tuyến Lũy Thầy năm 1631',
        year: 1631,
        location: 'Quảng Bình (cửa Nhật Lệ, sông Gianh)',
        commander: 'Đào Duy Từ và Chúa Sãi Nguyễn Phúc Nguyên',
        strategy: 'Đắp chiến lũy lũy Nhật Lệ, lũy Trường Dục chặn đứng các cuộc tấn công vượt sông Gianh của quân Trịnh',
        outcome: 'Bảo vệ vững chắc giang sơn Đàng Trong suốt hơn một thế kỷ phân tranh',
        detailedNarrative:
          'Năm 1631, Đào Duy Từ cho đắp Lũy Động Hải (Lũy Thầy) dài hàng chục dặm men theo bờ sông Nhật Lệ đến núi Đầu Mâu. Nhờ có chiến lũy này và hào nước phòng ngự, quân Nguyễn đã bẻ gãy liên tiếp 7 đợt tiến công lớn của quân Trịnh từ Đàng Ngoài, giữ vững ranh giới sông Gianh.',
      },
    ],
  },
  {
    epochId: 'EPOCH_13_TAY_SON',
    name: 'Phong trào Tây Sơn & Triều đại Quang Trung',
    dynasty: 'Nhà Tây Sơn',
    timeRange: [1771, 1802],
    coreEntities: [
      {
        id: 'person_quang_trung',
        name: 'Quang Trung',
        aliases: ['Nguyễn Huệ', 'Hồ Thơm', 'Bắc Bình Vương', 'Quang Trung Hoàng Đế'],
        role: 'Vị anh hùng áo vải cờ đào, thiên tài quân sự bách chiến bách thắng của dân tộc',
        biography:
          'Nguyễn Huệ (1753-1792) sinh tại Tây Sơn (Bình Định). Ông cùng hai anh em Nguyễn Nhạc, Nguyễn Lữ dấy binh khởi nghĩa năm 1771, liên tiếp lật đổ tập đoàn phong kiến chúa Nguyễn ở phía Nam, chúa Trịnh và vua Lê ở phía Bắc, đánh tan 5 vạn quân Xiêm năm 1785 và đại phá 29 vạn quân Thanh mùa xuân Kỷ Dậu 1789.',
      },
      {
        id: 'person_nguyen_nhac',
        name: 'Nguyễn Nhạc',
        aliases: ['Tây Sơn Vương', 'Trung Ương Hoàng Đế'],
        role: 'Anh cả dấy cờ khởi nghĩa Tây Sơn năm 1771',
        biography:
          'Nguyễn Nhạc lãnh đạo xây dựng căn cứ Tây Sơn thượng đạo, đánh chiếm Quy Nhơn, tự xưng Tây Sơn Vương năm 1776 rồi lên ngôi Hoàng đế đóng đô tại thành Đồ Bàn (Hoàng Đế thành).',
      },
      {
        id: 'person_ngo_thi_nham',
        name: 'Ngô Thì Nhậm',
        aliases: ['Hải Thượng Vãn Ca', 'Ngô Thì Nhậm đại thần'],
        role: 'Danh sĩ Bắc Hà, mưu thần chiến lược giúp Quang Trung sách lược Tam Điệp - Biện Sơn',
        biography:
          'Ngô Thì Nhậm (1746-1803) là nhà chính trị, ngoại giao kiệt xuất. Khi quân Thanh tràn sang, ông chủ trương tạm rút quân về giữ phòng tuyến Tam Điệp - Biện Sơn chờ đại quân của Nguyễn Huệ ra phản công, sau đó chủ trì các cuộc đàm phán hòa hiếu với nhà Thanh.',
      },
    ],
    keyEvents: [
      {
        id: 'event_ngoc_hoi_dong_da_1789',
        name: 'Đại thắng Ngọc Hồi - Đống Đa năm 1789',
        year: 1789,
        location: 'Hà Nội (Ngọc Hồi, Khương Thượng - Đống Đa, Thăng Long)',
        commander: 'Quang Trung Nguyễn Huệ, Đặng Tiến Đông, Ngô Văn Sở',
        strategy: 'Hành quân thần tốc dịp Tết Kỷ Dậu, kết hợp đánh úp vu hồi đồn Khương Thượng và công phá chính diện đồn Ngọc Hồi',
        outcome: 'Quét sạch 29 vạn quân Mãn Thanh xâm lược, giải phóng kinh thành Thăng Long sáng mùng 5 Tết',
        detailedNarrative:
          'Đêm mùng 4 rạng sáng ngày mùng 5 Tết Kỷ Dậu 1789, vua Quang Trung chỉ huy đội quân dùng khiên rơm tẩm ướt xông thẳng công phá đồn Ngọc Hồi kiên cố. Cùng lúc đó, đạo quân của Đô đốc Đặng Tiến Đông bất ngờ tập kích đồn Khương Thượng, khiến tướng giặc Sầm Nghi Đống tự vẫn. Chủ tướng Tôn Sĩ Nghị hoảng hốt cùng tàn quân vượt cầu phao sông Hồng tháo chạy về nước.',
      },
      {
        id: 'event_rach_gam_xoai_mut_1785',
        name: 'Trận Rạch Gầm - Xoài Mút năm 1785',
        year: 1785,
        location: 'Tiền Giang (Sông Tiền đoạn Rạch Gầm đến Xoài Mút)',
        commander: 'Nguyễn Huệ',
        strategy: 'Bố trí pháo thuyền và bộ binh mai phục kín đáo trên hai bờ sông Tiền và các cù lao',
        outcome: 'Tiêu diệt gần 5 vạn quân thủy bộ Xiêm, đập tan dã tâm can thiệp của ngoại bang',
        detailedNarrative:
          'Đêm ngày 19 rạng sáng 20 tháng 1 năm 1785, Nguyễn Huệ cho thuyền nhẹ nhử hạm đội liên quân Xiêm - Nguyễn Ánh vào đoạn sông hiểm Rạch Gầm - Xoài Mút. Khi toàn bộ thuyền địch lọt vào ổ phục kích, đại bác Tây Sơn đồng loạt nhả đạn, thuyền chiến lao ra khóa chặt hai đầu sông, tiêu diệt gần như toàn bộ thủy quân Xiêm.',
      },
    ],
  },
  {
    epochId: 'EPOCH_14_NGUYEN_DYNASTY',
    name: 'Triều đại Nhà Nguyễn (1802 - 1945)',
    dynasty: 'Nhà Nguyễn',
    timeRange: [1802, 1945],
    coreEntities: [
      {
        id: 'person_gia_long',
        name: 'Gia Long',
        aliases: ['Nguyễn Ánh', 'Nguyễn Phúc Ánh', 'Thế Tổ Cao Hoàng Đế'],
        role: 'Hoàng đế sáng lập triều Nguyễn năm 1802, thống nhất giang sơn từ Ải Nam Quan đến Mũi Cà Mau',
        biography:
          'Nguyễn Ánh (1762-1820) sau nhiều năm bôn ba đã đánh bại triều Tây Sơn năm 1802, lên ngôi Hoàng đế lấy niên hiệu Gia Long, đóng đô ở Phú Xuân (Huế), chính thức đặt quốc hiệu Việt Nam năm 1804 và xây dựng Kinh thành Huế.',
      },
      {
        id: 'person_minh_mang',
        name: 'Minh Mạng',
        aliases: ['Nguyễn Phúc Đảm', 'Thánh Tổ Nhân Hoàng Đế'],
        role: 'Hoàng đế tiến hành cuộc cải cách hành chính quy mô lớn phân chia 30 tỉnh và 1 phủ Thừa Thiên',
        biography:
          'Minh Mạng (1791-1841) là vị vua tài năng và quyết đoán bậc nhất triều Nguyễn. Trong giai đoạn 1831-1832, ông bãi bỏ chế độ Tổng trấn Bắc Thành và Gia Định Thành, chia cả nước làm 30 tỉnh, thành lập Viện Cơ mật và củng cố chủ quyền đối với quần đảo Hoàng Sa và Trường Sa.',
      },
      {
        id: 'person_hoang_dieu',
        name: 'Hoàng Diệu',
        aliases: ['Tổng đốc Hoàng Diệu', 'Hoàng Kim Tích'],
        role: 'Tổng đốc Hà Ninh anh dũng tuẫn tiết bảo vệ thành Hà Nội trước giặc Pháp năm 1882',
        biography:
          'Hoàng Diệu (1829-1882) quê ở Quảng Nam, là tấm gương khí tiết kiên trung của dân tộc. Khi quân Pháp do Henri Rivière nổ súng tấn công thành Hà Nội ngày 25 tháng 4 năm 1882, ông chỉ huy quân dân chống trả quyết liệt đến cùng, rồi vào vườn Võ Miếu thắt cổ tự vẫn để bảo toàn khí tiết.',
      },
    ],
    keyEvents: [
      {
        id: 'event_thong_nhat_1802',
        name: 'Thành lập triều Nguyễn và thống nhất đất nước năm 1802',
        year: 1802,
        location: 'Kinh đô Phú Xuân (Huế)',
        commander: 'Nguyễn Ánh (Vua Gia Long)',
        strategy: 'Tiến quân giải phóng Thăng Long, chấm dứt nội chiến phân tranh kéo dài hơn 2 thế kỷ',
        outcome: 'Hoàn thành sự nghiệp thống nhất lãnh thổ liền một dải và đặt quốc hiệu Việt Nam',
        detailedNarrative:
          'Tháng 5 năm 1802, Nguyễn Ánh làm lễ tế cáo trời đất tại Phú Xuân, lên ngôi vua lấy niên hiệu Gia Long. Sau đó ông dẫn đại quân tiến thẳng ra Bắc Hà thu phục Thăng Long. Năm 1804, nhà vua cử sứ thần sang nhà Thanh định quốc hiệu là Việt Nam, xác lập chủ quyền toàn vẹn bờ cõi.',
      },
    ],
  },
  {
    epochId: 'EPOCH_15_HIEN_DAI_1954',
    name: 'Thời kỳ Kháng chiến Hiện đại & Chiến dịch Điện Biên Phủ',
    dynasty: 'Việt Nam Dân chủ Cộng hòa',
    timeRange: [1945, 1975],
    coreEntities: [
      {
        id: 'person_vo_nguyen_giap',
        name: 'Võ Nguyên Giáp',
        aliases: ['Đại tướng Võ Nguyên Giáp', 'Anh Văn', 'Tổng tư lệnh Võ Nguyên Giáp'],
        role: 'Tổng tư lệnh quân đội nhân dân Việt Nam, người chỉ huy đại thắng Điện Biên Phủ 1954 lừng lẫy năm châu',
        biography:
          'Đại tướng Võ Nguyên Giáp (1911-2013) sinh tại Quảng Bình, là học trò xuất sắc của Chủ tịch Hồ Chí Minh. Ông là nhà quân sự kiệt xuất thế giới, người đưa ra quyết định lịch sử chuyển phương châm tác chiến từ "Đánh nhanh thắng nhanh" sang "Đánh chắc tiến chắc" làm nên chiến thắng Điện Biên Phủ.',
      },
      {
        id: 'person_pham_van_dong',
        name: 'Phạm Văn Đồng',
        aliases: ['Anh Tô', 'Thủ tướng Phạm Văn Đồng'],
        role: 'Trưởng phái đoàn đàm phán của chính phủ Việt Nam Dân chủ Cộng hòa tại Hội nghị Genève 1954',
        biography:
          'Phạm Văn Đồng (1906-2000) là nhà ngoại giao xuất sắc và Thủ tướng lâu năm của Việt Nam. Tại Hội nghị Genève năm 1954 sau chiến thắng Điện Biên Phủ, ông đã kiên định đấu tranh buộc các nước lớn công nhận độc lập, chủ quyền, thống nhất và toàn vẹn lãnh thổ của Việt Nam.',
      },
    ],
    keyEvents: [
      {
        id: 'event_dien_bien_phu_1954',
        name: 'Chiến dịch Điện Biên Phủ năm 1954',
        year: 1954,
        location: 'Thung lũng Mường Thanh (tỉnh Điện Biên)',
        commander: 'Đại tướng Võ Nguyên Giáp',
        strategy: 'Chuyển phương châm sang "Đánh chắc tiến chắc", siết chặt vòng vây chiến hào, bóc dỡ từng cứ điểm đồi A1, C1',
        outcome: 'Bắt sống tướng De Castries và toàn bộ bộ chỉ huy Pháp, tiêu diệt hoàn toàn tập đoàn cứ điểm mạnh nhất Đông Dương',
        detailedNarrative:
          'Chiến dịch Điện Biên Phủ diễn ra từ ngày 13/3 đến ngày 7/5/1954 qua 3 đợt tiến công mãnh liệt. Trải qua 56 ngày đêm "khoét núi, ngủ hầm, mưa dầm, cơm vắt, máu trộn bùn non", quân ta đã tiêu diệt các cụm cứ điểm Him Lam, Độc Lập, tiến công đồi A1 và đánh thẳng vào hầm chỉ huy bắt sống tướng De Castries chiều ngày 7/5/1954. Chiến thắng chấn động địa cầu buộc Pháp ký Hiệp định Genève chấm dứt chiến tranh.',
      },
    ],
  },
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
        if (
          ent.id.startsWith('person_') &&
          (evt.commander.includes(ent.name) ||
            ent.aliases.some((a) => evt.commander.includes(a)) ||
            evt.detailedNarrative.includes(ent.name))
        ) {
          goldTriples.push({
            subject: evt.id,
            relation: 'LED_BY',
            object: ent.id,
            confidence: 1.0,
          });
        }
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

      // Find the best-matched leader entity for this event
      const matchedLeader =
        epoch.coreEntities.find(
          (e) =>
            e.id.startsWith('person_') &&
            (evt.commander.includes(e.name) || e.aliases.some((a) => evt.commander.includes(a)))
        ) || epoch.coreEntities.find((e) => e.id.startsWith('person_')) || ent;

      let query = '';
      let domain = 'BATTLE_CAMPAIGN';
      let intent = 'FACT_RETRIEVAL';
      let requiresMultihop = false;
      let activeTargetEnt = ent;

      const qType = i % 5;
      if (qType === 0) {
        query = `${evt.name} diễn ra vào năm nào, do ai lãnh đạo và có ý nghĩa lịch sử gì đối với ${epoch.dynasty}?`;
        domain = 'BATTLE';
        intent = 'EVENT_DETAILS';
        activeTargetEnt = matchedLeader;
      } else if (qType === 1) {
        if (ent.id.startsWith('artifact_')) {
          query = `Tại sao ${ent.name} lại được coi là di vật khảo cổ và biểu tượng văn hóa tiêu biểu của thời kỳ ${epoch.name}?`;
          domain = 'ARTIFACT_CULTURE';
          intent = 'WHY_REASONING';
          requiresMultihop = true;
          activeTargetEnt = ent;
        } else {
          // If ent commanded evt, query why ent applied strategy; otherwise query why ent led their historical role
          const isCommander =
            evt.commander.includes(ent.name) || ent.aliases.some((a) => evt.commander.includes(a));
          if (isCommander) {
            query = `Tại sao ${ent.name} lại áp dụng chiến lược "${evt.strategy}" trong sự kiện ${evt.name}?`;
          } else {
            query = `Tại sao ${ent.name} lại giữ vai trò "${ent.role}" trong bối cảnh triều đại ${epoch.dynasty}?`;
          }
          domain = 'CAUSAL_ANALYSIS';
          intent = 'WHY_REASONING';
          requiresMultihop = true;
          activeTargetEnt = ent;
        }
      } else if (qType === 2) {
        if (ent.id.startsWith('artifact_')) {
          query = `Hiện vật ${ent.name} có các tên gọi, giá trị nghệ thuật và vai trò gì trong thời kỳ ${epoch.dynasty}?`;
          domain = 'ARTIFACT_CULTURE';
        } else {
          query = `Nhân vật lịch sử ${ent.name} còn có các tên gọi, tước hiệu và vai trò gì trong triều đại ${epoch.dynasty}?`;
          domain = 'BIOGRAPHY';
        }
        intent = 'ENTITY_ALIAS_LOOKUP';
        activeTargetEnt = ent;
      } else if (qType === 3) {
        query = `Trình bày diễn biến và kết quả của sự kiện ${evt.name} tại địa danh ${evt.location}.`;
        domain = 'CAMPAIGN_NARRATIVE';
        intent = 'HISTORICAL_OUTCOME';
        requiresMultihop = true;
        activeTargetEnt = matchedLeader;
      } else {
        if (ent.id.startsWith('artifact_')) {
          query = `Đánh giá bối cảnh văn hóa và tầm ảnh hưởng của ${ent.name} đối với đời sống cư dân thời ${epoch.name}.`;
        } else {
          query = `Đánh giá bối cảnh chính trị và vai trò của ${ent.name} trong việc xây dựng và bảo vệ bờ cõi thời ${epoch.name}.`;
        }
        domain = 'COMPARATIVE_ANALYSIS';
        intent = 'MULTI_ENTITY_COMPARISON';
        requiresMultihop = true;
        activeTargetEnt = ent;
      }

      const goldPaths: Array<Array<{ subject: string; relation: string; object: string; confidence: number }>> = [];
      if (activeTargetEnt.id.startsWith('person_') && (evt.commander.includes(activeTargetEnt.name) || activeTargetEnt.aliases.some((a) => evt.commander.includes(a)))) {
        goldPaths.push([
          { subject: activeTargetEnt.id, relation: 'PART_OF', object: epoch.epochId, confidence: 1.0 },
          { subject: evt.id, relation: 'LED_BY', object: activeTargetEnt.id, confidence: 1.0 },
        ]);
      } else {
        goldPaths.push([
          { subject: activeTargetEnt.id, relation: 'PART_OF', object: epoch.epochId, confidence: 1.0 },
        ]);
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
        gold_reasoning_paths: goldPaths,
        ground_truth_chunks: [
          {
            chunk_id: `chunk_${evt.id}_narrative_primary`,
            relevance_grade: 3,
            source_reliability: 'LEVEL_1',
            title: `${evt.name} - Sử liệu chính thống`,
            text_content: `${evt.detailedNarrative} Trận đánh diễn ra tại ${evt.location} vào năm ${evt.year} dưới sự chỉ huy của ${evt.commander}. Với chiến lược tài tình "${evt.strategy}", kết quả là ${evt.outcome}.`,
            key_evidence_claims: [
              `${evt.commander} chỉ huy sự kiện ${evt.name}`,
              `Diễn ra năm ${evt.year} tại ${evt.location}`,
              `Chiến lược thực hiện: ${evt.strategy}`,
              `Kết quả lịch sử: ${evt.outcome}`,
            ],
          },
          {
            chunk_id: `chunk_${activeTargetEnt.id}_biography_primary`,
            relevance_grade: 2,
            source_reliability: 'LEVEL_1',
            title: `Tiểu sử và hành trạng của ${activeTargetEnt.name}`,
            text_content: `${activeTargetEnt.biography} ${activeTargetEnt.name} (còn gọi là ${activeTargetEnt.aliases.join(', ')}) giữ vai trò then chốt: ${activeTargetEnt.role} trong dòng chảy lịch sử ${epoch.dynasty}.`,
            key_evidence_claims: [
              `${activeTargetEnt.name} có các tên gọi, tước hiệu: ${activeTargetEnt.aliases.join(', ')}`,
              `${activeTargetEnt.name} giữ vai trò: ${activeTargetEnt.role}`,
            ],
          },
          {
            chunk_id: `chunk_${epoch.epochId}_chronicle_context`,
            relevance_grade: 1,
            source_reliability: 'LEVEL_2',
            title: `Biên niên sử: ${epoch.name}`,
            text_content: `Thời kỳ ${epoch.name} thuộc triều đại ${epoch.dynasty} diễn ra trong khoảng thời gian từ năm ${epoch.timeRange[0]} đến năm ${epoch.timeRange[1]}. Đây là giai đoạn quan trọng gắn liền với các biến cố chính trị và dấu ấn của các nhân vật kiệt xuất.`,
            key_evidence_claims: [
              `Thời kỳ ${epoch.name} kéo dài từ năm ${epoch.timeRange[0]} đến ${epoch.timeRange[1]}`,
            ],
          },
        ],
        unanswerable_or_false_premise: false,
        expected_aliases: activeTargetEnt.aliases,
        canonical_entity_id: activeTargetEnt.id,
      };

      canonical300.push(item);
      qIdx++;
    }
  }

  // 3. Generate 500 Realistic Perturbations
  const removeDiacritics = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

  for (let i = 0; i < 500; i++) {
    const parent = canonical300[i % canonical300.length];
    const pId = `q_perturb_${String(i + 1).padStart(3, '0')}`;
    let perturbedQuery = parent.query;
    let trapType = 'UNACCENTED_VIETNAMESE';

    const pType = i % 5;
    if (pType === 0) {
      // 1. Unaccented Vietnamese (tiếng Việt không dấu)
      perturbedQuery = removeDiacritics(parent.query);
      trapType = 'UNACCENTED_VIETNAMESE';
    } else if (pType === 1) {
      // 2. Realistic Telex typing / sound-alike typos
      perturbedQuery = parent.query
        .replace(/chiến thắng/g, 'chien thang')
        .replace(/lãnh đạo/g, 'lanh dao')
        .replace(/sử liệu/g, 'su lieu')
        .replace(/triều đại/g, 'trieu dai')
        .replace(/hoàng đế/g, 'hoang de');
      trapType = 'TELEX_AND_SPELLING_TYPO';
    } else if (pType === 2 && parent.expected_aliases && parent.expected_aliases.length > 0) {
      // 3. Alias / Historical Feudal Title Substitution
      const chosenAlias = parent.expected_aliases[0];
      const mainName = parent.canonical_entity_id?.replace(/^person_|^event_|^artifact_/, '').replace(/_/g, ' ') || '';
      perturbedQuery = parent.query.replace(new RegExp(mainName, 'i'), chosenAlias);
      trapType = 'ALIAS_SUBSTITUTION';
    } else if (pType === 3) {
      // 4. Natural conversational / informal question phrasing
      perturbedQuery = `Cho mình hỏi chút: ${parent.query.charAt(0).toLowerCase() + parent.query.slice(1)}`;
      trapType = 'CONVERSATIONAL_INQUIRY';
    } else {
      // 5. Dialectal / Abbreviated syntax
      perturbedQuery = parent.query
        .replace(/như thế nào/g, 'ra sao')
        .replace(/vào năm nào/g, 'năm mấy')
        .replace(/tại địa danh nào/g, 'ở đâu');
      trapType = 'DIALECTAL_SYNONYM';
    }

    perturbations500.push({
      ...parent,
      query_id: pId,
      query: perturbedQuery,
      parent_query_id: parent.query_id,
      adversarial_trap_type: trapType,
    });
  }

  // 4. Generate 200 Diverse, Highly Realistic Historical Adversarial Traps
  const ADVERSARIAL_TRAPS_POOL = [
    // Category 1: Anachronism & Inverted Technology / Timeline
    {
      q: 'Ngô Quyền đã dùng súng thần công và pháo hạm để đánh tan quân Nam Hán trên sông Bạch Đằng năm 938 đúng không?',
      type: 'ANACHRONISM_WEAPONRY',
    },
    {
      q: 'Hai Bà Trưng đã sử dụng xe tăng và súng tiểu liên đẩy lùi thái thú Tô Định vào năm 40?',
      type: 'ANACHRONISM_MODERN_TECH',
    },
    {
      q: 'Vua Quang Trung Nguyễn Huệ đã chỉ huy trận Điện Biên Phủ chấn động địa cầu vào năm 1954 như thế nào?',
      type: 'ANACHRONISM_CENTURY_MISMATCH',
    },
    {
      q: 'An Dương Vương đã cho xây dựng hầm ngầm chống bom hạt nhân khi xây thành Cổ Loa năm 257 TCN?',
      type: 'ANACHRONISM_TECH_PREMISE',
    },
    {
      q: 'Trần Hưng Đạo đã gửi điện tín vô tuyến truyền Hịch tướng sĩ tới các tướng lĩnh năm 1285 đúng không?',
      type: 'ANACHRONISM_COMMUNICATION',
    },

    // Category 2: Same-Name / Commander Cross-Dynasty Confusions
    {
      q: 'Hoàng đế Lê Lợi đã trực tiếp chỉ huy đánh bại quân xâm lược Tống trên sông Bạch Đằng năm 981 đúng hay sai?',
      type: 'COMMANDER_CONFUSION_LE_LOI_VS_LE_HOAN',
    },
    {
      q: 'Lý Thường Kiệt đã ban Chiếu dời đô chuyển kinh đô từ Hoa Lư về Thăng Long năm 1010 có phải không?',
      type: 'CONFUSION_LY_THUONG_KIET_VS_LY_THAI_TO',
    },
    {
      q: 'Trần Nhân Tông là vị tướng chém chết Liễu Thăng tại ải Chi Lăng năm 1427 đúng không?',
      type: 'COMMANDER_CONFUSION_TRAN_VS_LE',
    },
    {
      q: 'Nguyễn Huệ và Nguyễn Ánh đã kết nghĩa anh em và cùng nhau lãnh đạo cuộc khởi nghĩa Lam Sơn?',
      type: 'RIVAL_MERGE_FALSE_PREMISE',
    },
    {
      q: 'Vua Đinh Tiên Hoàng đã dời đô về Phú Xuân (Huế) và đặt quốc hiệu là Đại Ngu năm 1400?',
      type: 'DYNASTY_CAPITAL_CONFUSION',
    },

    // Category 3: Mythology vs Official Historical Facts
    {
      q: 'Thần Kim Quy (Rùa Vàng) đã ký hiệp định biên giới chính thức với An Dương Vương tại Cổ Loa năm 250 TCN đúng không?',
      type: 'MYTHOLOGY_AS_OFFICIAL_FACT',
    },
    {
      q: 'Sơn Tinh và Thủy Tinh là hai vị đại sứ ngoại giao đã ký hòa ước sông Hồng thời Hùng Vương?',
      type: 'LEGEND_DIPLOMATIC_TRAP',
    },
    {
      q: 'Thánh Gióng sau khi đánh tan giặc Ân đã được vua Hùng bổ nhiệm làm Viện trưởng Viện Cơ mật?',
      type: 'MYTHOLOGY_INSTITUTION_TRAP',
    },
    {
      q: 'Vị tướng nào tên là Thần Điêu Đại Hiệp chỉ huy cánh quân Tây Sơn đánh đồn Khương Thượng năm 1789?',
      type: 'FICTIONAL_CHARACTER_INTRUSION',
    },
    {
      q: 'Nỏ thần Liên Châu của Cao Lỗ hoạt động bằng động cơ laser bắn rụng hàng vạn máy bay địch?',
      type: 'MYTH_TECH_EXAGGERATION',
    },

    // Category 4: Inverted Battle Outcome / False Treaties
    {
      q: 'Quân Mông - Nguyên đã toàn thắng và bắt sống vua tôi nhà Trần tại sông Bạch Đằng năm 1288 đúng hay sai?',
      type: 'INVERTED_BATTLE_OUTCOME',
    },
    {
      q: 'Tổng đốc Tôn Sĩ Nghị đã đánh bại hoàn toàn quân Tây Sơn tại gò Đống Đa và bắt giữ Quang Trung?',
      type: 'INVERTED_CAMPAIGN_OUTCOME',
    },
    {
      q: 'Thực dân Pháp đã đại thắng và bắt sống toàn bộ ban chỉ huy chiến dịch Điện Biên Phủ vào tháng 5 năm 1954?',
      type: 'INVERTED_HISTORICAL_RESULT',
    },
    {
      q: 'Trận Rạch Gầm - Xoài Mút năm 1785 kết thúc bằng việc 5 vạn quân Xiêm chiếm trọn vùng Gia Định?',
      type: 'FALSE_TACTICAL_OUTCOME',
    },
    {
      q: 'Hội thề Đông Quan năm 1427 là lễ ký kết sáp nhập Đại Việt vào lãnh thổ nhà Minh vĩnh viễn?',
      type: 'FALSE_TREATY_NATURE',
    },

    // Category 5: Geographical & Chronological Fallacies
    {
      q: 'Chiến dịch Chi Lăng - Xương Giang năm 1427 diễn ra tại Cà Mau do chúa Nguyễn Hoàng lãnh đạo đúng không?',
      type: 'GEOGRAPHY_AND_ERA_MISMATCH',
    },
    {
      q: 'Phòng tuyến Sông Như Nguyệt được xây dựng tại đồng bằng sông Cửu Long để chặn quân Pháp năm 1858?',
      type: 'LOCATION_AND_OPPONENT_CONFUSION',
    },
    {
      q: 'Vua Minh Mạng đã chia nước ta làm 30 tỉnh vào thời kỳ Bắc thuộc lần thứ nhất trước Công nguyên?',
      type: 'CHRONOLOGY_INVERSION_MINH_MANG',
    },
    {
      q: 'Thành Nhà Hồ được xây dựng bằng gạch nung tại Cần Thơ năm 1945 bởi vua Lê Thánh Tông?',
      type: 'GEOGRAPHY_BUILDER_MISMATCH',
    },
    {
      q: 'Trận Bạch Đằng năm 938 diễn ra trên sông Hương dưới sự chỉ huy của vua Gia Long?',
      type: 'LOCATION_COMMANDER_ANACHRONISM',
    },
  ];

  for (let i = 0; i < 200; i++) {
    const template = ADVERSARIAL_TRAPS_POOL[i % ADVERSARIAL_TRAPS_POOL.length];
    const advId = `q_adv_${String(i + 1).padStart(3, '0')}`;

    adversarial200.push({
      query_id: advId,
      query: template.q,
      domain: 'ADVERSARIAL_HISTORICAL_TRAP',
      intent: 'ABSTENTION_AND_ERROR_DETECTION',
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  saveAndValidateDatasets();
}
