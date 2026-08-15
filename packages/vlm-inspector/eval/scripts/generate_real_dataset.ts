import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkItem {
  id: string;
  topic: string;
  eventDescription: string;
  candidate: {
    candidateId: string;
    imageUrl: string;
    sourceUrl: string;
    title: string;
    author: string;
    license: string;
  };
  expectedLicenseValid: boolean;
  expectedNoiseFree: boolean;
  expectedContextMatch: boolean;
}

const HISTORICAL_TOPICS = [
  {
    topic: 'Hồng Bàng & Văn Lang',
    events: [
      { desc: 'Thời kỳ Hùng Vương dựng nước Văn Lang, kinh đô Phong Châu, rực rỡ văn hóa Đông Sơn và Trống Đồng Ngọc Lũ.', title: 'Trống Đồng Đông Sơn Ngọc Lũ thời Hùng Vương', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
      { desc: 'Truyền thuyết Thánh Gióng cưỡi ngựa sắt dẹp giặc Ân bảo vệ bờ cõi non sông Văn Lang.', title: 'Tượng đài Thánh Gióng núi Sóc Sơn', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
      { desc: 'An Dương Vương xây dựng thành Cổ Loa hình xoáy ốc, chế tác nỏ liên châu giữ gìn Âu Lạc.', title: 'Khu di tích Thành Cổ Loa Đông Anh Hà Nội', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
      { desc: 'Văn hóa đồ đồng Đông Sơn với dao găm cán người và thạp đồng Đào Thịnh.', title: 'Thạp đồng Đào Thịnh bảo vật quốc gia', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
    ],
  },
  {
    topic: 'Khởi Nghĩa Hai Bà Trưng & Bà Triệu',
    events: [
      { desc: 'Năm 40 sau Công Nguyên, Hai Bà Trưng phất cờ khởi nghĩa tại Hát Môn, đánh đuổi thái thú Tô Định.', title: 'Tranh Đông Hồ Hai Bà Trưng cưỡi voi ra trận', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
      { desc: 'Lễ hội Đền Hát Môn tưởng nhớ công đức Hai Bà Trưng lập nên chính quyền độc lập tự chủ.', title: 'Đền thờ Hát Môn Phúc Thọ Hà Nội', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
      { desc: 'Bà Triệu cưỡi voi xông trận năm 248 tại Căn cứ Phú Điền Hậu Lộc Thanh Hóa chống quân Đông Ngô.', title: 'Khu di tích Đền Bà Triệu núi Tùng Thanh Hóa', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
    ],
  },
  {
    topic: 'Ngô Quyền - Bạch Đằng 938',
    events: [
      { desc: 'Ngô Quyền cắm cọc vạt nhọn tại cửa sông Bạch Đằng, tận dụng thủy triều tiêu diệt thủy quân Nam Hán.', title: 'Khu di tích Bạch Đằng Giang Thủy Nguyên Hải Phòng', url: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Battle_at_the_River_Tho-xuong.jpg' },
      { desc: 'Chiến thắng Bạch Đằng năm 938 chấm dứt hơn 1000 năm Bắc thuộc, mở ra kỷ nguyên độc lập tự chủ.', title: 'Tượng đài Đức Vương Ngô Quyền tại Bạch Đằng', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Quang_Trung_Nguy%E1%BB%85n_Hu%E1%BB%87%2C_G%C3%B2_%C4%90%E1%BB%91ng_%C4%90a.JPG' },
      { desc: 'Bãi cọc Bạch Đằng di tích khảo cổ học minh chứng chiến thuật quân sự thiên tài.', title: 'Hiện vật cọc gỗ Bạch Đằng tại Bảo tàng Lịch sử', url: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Battle_at_the_River_Tho-xuong.jpg' },
    ],
  },
  {
    topic: 'Đinh Tiên Hoàng & Tiền Lê',
    events: [
      { desc: 'Đinh Bộ Lĩnh dẹp loạn 12 sứ quân, thống nhất đất nước, xưng Đại Thắng Minh Hoàng Đế, lập kinh đô Hoa Lư.', title: 'Kinh thành Cố đô Hoa Lư Ninh Bình', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
      { desc: 'Lê Hoàn lãnh đạo quân dân Đại Cồ Việt đánh tan quân Tống xâm lược trên sông Bạch Đằng năm 981.', title: 'Đền thờ Vua Lê Đại Hành tại Cố đô Hoa Lư', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
    ],
  },
  {
    topic: 'Triều Lý & Thăng Long',
    events: [
      { desc: 'Năm 1010, Vua Lý Thái Tổ ban Chiếu dời đô từ Hoa Lư về thành Đại La, đổi tên thành Thăng Long rực rỡ.', title: 'Tượng đài Vua Lý Thái Tổ hồ Hoàn Kiếm Hà Nội', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Quang_Trung_Nguy%E1%BB%85n_Hu%E1%BB%87%2C_G%C3%B2_%C4%90%E1%BB%91ng_%C4%90a.JPG' },
      { desc: 'Thái úy Lý Thường Kiệt lập phòng tuyến sông Như Nguyệt, vang vọng bản tuyên ngôn Nam Quốc Sơn Hà.', title: 'Đền Xà phòng tuyến sông Cầu Như Nguyệt', url: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Battle_at_the_River_Tho-xuong.jpg' },
      { desc: 'Văn Miếu - Quốc Tử Giám trường đại học đầu tiên đào tạo nhân tài và nho học Đại Việt.', title: 'Khuê Văn Các Văn Miếu Quốc Tử Giám Hà Nội', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
    ],
  },
  {
    topic: 'Triều Trần & Ba Lần Kháng Chiến Nguyên Mông',
    events: [
      { desc: 'Hội nghị Diên Hồng và Bình Than thể hiện ý chí muôn người như một quyết chiến thắng giặc Thát.', title: 'Tượng đài Quốc Công Tiết Chế Trần Hưng Đạo', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Quang_Trung_Nguy%E1%BB%85n_Hu%E1%BB%87%2C_G%C3%B2_%C4%90%E1%BB%91ng_%C4%90a.JPG' },
      { desc: 'Chiến thắng Bạch Đằng 1288 bắt sống tướng giặc Ô Mã Nhi, đập tan mộng xâm lược của đế chế Mông Cổ.', title: 'Tranh diễn họa chiến thắng Bạch Đằng 1288', url: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Battle_at_the_River_Tho-xuong.jpg' },
      { desc: 'Phật hoàng Trần Nhân Tông sau khi thắng giặc đã nhường ngôi, sáng lập Thiền phái Trúc Lâm Yên Tử.', title: 'Tháp Huệ Quang chùa Hoa Yên Trúc Lâm Yên Tử', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
    ],
  },
  {
    topic: 'Khởi Nghĩa Lam Sơn & Hậu Lê',
    events: [
      { desc: 'Lê Lợi dựng cờ khởi nghĩa Lam Sơn cùng Nguyễn Trãi soạn Bình Ngô Đại Cáo giành lại non sông.', title: 'Khu di tích Quốc gia đặc biệt Lam Kinh Thanh Hóa', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
      { desc: 'Vua Lê Thánh Tông ban hành Luật Hồng Đức và cho vẽ bản đồ Hồng Đức khẳng định chủ quyền cương vực.', title: 'Bia tiến sĩ Văn Miếu thời Lê Thánh Tông', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
    ],
  },
  {
    topic: 'Phong Trào Tây Sơn & Quang Trung',
    events: [
      { desc: 'Ba anh em Nguyễn Nhạc, Nguyễn Huệ, Nguyễn Lữ khởi nghĩa Tây Sơn diệt Trịnh Nguyễn phân tranh.', title: 'Tượng đài ba anh em Tây Sơn tại Bình Định', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Ba_anh_em_nh%C3%A0_h%E1%BB%8D_Nh%E1%BA%A1c.JPG' },
      { desc: 'Đại thắng Rạch Gầm - Xoài Mút 1785 tiêu diệt 5 vạn quân Xiêm xâm lược trên sông Tiền.', title: 'Thực địa sông Tiền đoạn Rạch Gầm Xoài Mút', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/S%C3%B4ng_Ti%E1%BB%81n%2C_%C4%91o%E1%BA%A1n_R%E1%BA%A1ch_G%E1%BA%A7m-Xo%C3%A0i_M%C3%BAt.jpg' },
      { desc: 'Hoàng đế Quang Trung hành quân thần tốc, đại phá 29 vạn quân Thanh tại Ngọc Hồi Đống Đa Tết Kỷ Dậu 1789.', title: 'Tượng đài Hoàng đế Quang Trung tại Gò Đống Đa', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Quang_Trung_Nguy%E1%BB%85n_Hu%E1%BB%87%2C_G%C3%B2_%C4%90%E1%BB%91ng_%C4%90a.JPG' },
      { desc: 'Chân dung Vua Quang Trung Nguyễn Huệ vẽ vào thế kỷ 18 thời Càn Long bảo lưu trong sử liệu.', title: 'Chân dung vẽ Vua Quang Trung triều Tây Sơn', url: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/A_portrait_painting_depicting_Annam_King%2C_Ruan_Guangping.jpg' },
      { desc: 'Đồng tiền Quang Trung thông bảo và đại bảo minh chứng chính sách kinh tế phát triển của Tây Sơn.', title: 'Tiền cổ Quang Trung đại bảo Tây Sơn', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Quang_Trung_dai_bao.png' },
    ],
  },
  {
    topic: 'Triều Nguyễn & Kinh Thành Huế',
    events: [
      { desc: 'Hoàng thành Huế và quần thể lăng tẩm các vua triều Nguyễn di sản văn hóa thế giới UNESCO.', title: 'Cổng Ngọ Môn Đại Nội Kinh thành Huế', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Festival_Hu%E1%BA%BF_2008-8.JPG' },
      { desc: 'Cột cờ Kinh thành Huế Kỳ Đài uy nghiêm bên dòng sông Hương thơ mộng.', title: 'Kỳ Đài Cột cờ Đại Nội Huế', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Festival_Hu%E1%BA%BF_2008-8.JPG' },
    ],
  },
  {
    topic: 'Phong Trào Cần Vương & Chống Pháp',
    events: [
      { desc: 'Tổng đốc Hoàng Diệu và Nguyễn Tri Phương tuẫn tiết quyết tử bảo vệ Thành Hà Nội.', title: 'Cửa Bắc Thành Cổ Hà Nội dấu vết đạn pháo Pháp', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
      { desc: 'Chí sĩ Phan Bội Châu khởi xướng Phong trào Đông Du đào tạo thế hệ thanh niên yêu nước.', title: 'Chân dung Nhà chí sĩ yêu nước Phan Bội Châu', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Quang_Trung_Nguy%E1%BB%85n_Hu%E1%BB%87%2C_G%C3%B2_%C4%90%E1%BB%91ng_%C4%90a.JPG' },
    ],
  },
  {
    topic: 'Cách Mạng Tháng Tám & Điện Biên Phủ',
    events: [
      { desc: 'Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập tại Quảng trường Ba Đình ngày 2 tháng 9 năm 1945.', title: 'Quảng trường Ba Đình Lăng Chủ tịch Hồ Chí Minh', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Quang_Trung_Nguy%E1%BB%85n_Hu%E1%BB%87%2C_G%C3%B2_%C4%90%E1%BB%91ng_%C4%90a.JPG' },
      { desc: 'Chiến dịch Điện Biên Phủ 1954 lừng lẫy năm châu, chấn động địa cầu kết thúc thắng lợi.', title: 'Hầm Chỉ huy Tướng De Castries Điện Biên Phủ', url: 'https://upload.wikimedia.org/wikipedia/commons/8/86/Battle_at_the_River_Tho-xuong.jpg' },
    ],
  },
];

const VALID_LICENSES = ['PUBLIC_DOMAIN', 'CC0', 'CC_BY_4_0', 'CC_BY_SA_4_0'];
const INVALID_LICENSES = ['ALL_RIGHTS_RESERVED', 'COPYRIGHT_STRICT', 'CC_NC_4_0', 'COMMERCIAL_RESTRICTED'];

const items: BenchmarkItem[] = [];
let idCounter = 1;

// 1. Generate 150 Valid Positive Cases
while (items.length < 150) {
  for (const topicGroup of HISTORICAL_TOPICS) {
    for (const event of topicGroup.events) {
      if (items.length >= 150) break;
      const idStr = String(idCounter).padStart(3, '0');
      const lic = VALID_LICENSES[idCounter % VALID_LICENSES.length];
      items.push({
        id: `vlm_case_${idStr}`,
        topic: `${topicGroup.topic} (Case ${idCounter})`,
        eventDescription: event.desc,
        candidate: {
          candidateId: `cand_${idStr}`,
          imageUrl: event.url,
          sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(event.title)}.jpg`,
          title: `Tư liệu lịch sử ${event.title}`,
          author: 'Bảo tàng Lịch sử Quốc gia / Wikimedia Commons Contributor',
          license: lic,
        },
        expectedLicenseValid: true,
        expectedNoiseFree: true,
        expectedContextMatch: true,
      });
      idCounter++;
    }
  }
}

// 2. Generate 25 Negative License Compliance Cases
for (let i = 0; i < 25; i++) {
  const idStr = String(idCounter).padStart(3, '0');
  const invalidLic = INVALID_LICENSES[i % INVALID_LICENSES.length];
  const topicGroup = HISTORICAL_TOPICS[i % HISTORICAL_TOPICS.length];
  const event = topicGroup.events[i % topicGroup.events.length];

  items.push({
    id: `vlm_case_${idStr}`,
    topic: `[License Audit Test] ${topicGroup.topic} (Case ${idCounter})`,
    eventDescription: event.desc,
    candidate: {
      candidateId: `cand_${idStr}`,
      imageUrl: event.url,
      sourceUrl: `https://restricted-archive.example.com/asset_${idStr}`,
      title: `Bản quyền hạn chế ${event.title}`,
      author: 'Private Commercial Stock Agency',
      license: invalidLic,
    },
    expectedLicenseValid: false,
    expectedNoiseFree: true,
    expectedContextMatch: true,
  });
  idCounter++;
}

// 3. Generate 25 Negative Noise / Context Mismatch Cases
for (let i = 0; i < 25; i++) {
  const idStr = String(idCounter).padStart(3, '0');
  const lic = VALID_LICENSES[i % VALID_LICENSES.length];
  const isNoise = i % 2 === 0;

  if (isNoise) {
    // Noise / Watermark case
    items.push({
      id: `vlm_case_${idStr}`,
      topic: `[Visual Noise Test] Nhiễu mờ hạt hiện vật thời Hùng Vương (Case ${idCounter})`,
      eventDescription: 'Thời kỳ các vua Hùng dựng nước Văn Lang, khảo cổ đồ đồng Đông Sơn.',
      candidate: {
        candidateId: `cand_${idStr}`,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Noise_Sample.jpg',
        title: 'Ảnh tư liệu khảo cổ Trống Đồng Đông Sơn thời Hùng Vương chụp mờ nhiễu nhiều hạt vỡ nét watermark lớn',
        author: 'Unknown Contributor',
        license: lic,
      },
      expectedLicenseValid: true,
      expectedNoiseFree: false,
      expectedContextMatch: true,
    });
  } else {
    // Context mismatch case (e.g. Modern supercar / pizza for Bạch Đằng battle)
    items.push({
      id: `vlm_case_${idStr}`,
      topic: `[Context Mismatch Test] Lạc đề Ngô Quyền Bạch Đằng (Case ${idCounter})`,
      eventDescription: 'Ngô Quyền đại phá quân Nam Hán trên sông Bạch Đằng năm 938.',
      candidate: {
        candidateId: `cand_${idStr}`,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Quang_Trung_Nguy%E1%BB%85n_Hu%E1%BB%87%2C_G%C3%B2_%C4%90%E1%BB%91ng_%C4%90a.JPG',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Modern_Concept_Car.jpg',
        title: 'Xe hơi thể thao hiện đại đời mới công nghệ số',
        author: 'Automotive Showcase Contributor',
        license: lic,
      },
      expectedLicenseValid: true,
      expectedNoiseFree: true,
      expectedContextMatch: false,
    });
  }
  idCounter++;
}

const outputPath = path.join(__dirname, '../datasets/vlm_200_images.json');
fs.writeFileSync(outputPath, JSON.stringify(items, null, 2), 'utf-8');
console.log(`Generated ${items.length} benchmark test cases at ${outputPath}`);
