const fs = require('fs');
const path = require('path');
const https = require('https');

const baseAssetsDir = path.join(__dirname, '../public/assets');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          'User-Agent': 'ChronoVietApp/1.0 (historical.research@chronoviet.org)',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    ).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const file = fs.createWriteStream(destPath);
    const request = (targetUrl) => {
      https
        .get(
          targetUrl,
          {
            headers: {
              'User-Agent': 'ChronoVietApp/1.0 (historical.research@chronoviet.org)',
            },
          },
          (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
              return request(response.headers.location);
            }
            if (response.statusCode !== 200) {
              file.close();
              fs.unlink(destPath, () => {});
              return reject(new Error(`HTTP status ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => {
              file.close(() => resolve(destPath));
            });
          }
        )
        .on('error', (err) => {
          file.close();
          fs.unlink(destPath, () => {});
          reject(err);
        });
    };
    request(url);
  });
}

async function searchAndDownloadWikimedia(queries, destRelativePath) {
  const destPath = path.join(baseAssetsDir, destRelativePath);

  // Skip if already exists
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
    console.log(`✓ File already exists: ${destRelativePath}`);
    return true;
  }

  for (const query of queries) {
    try {
      console.log(`Searching Wikimedia Commons for: "${query}"...`);
      const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        query
      )}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|size&format=json`;

      const searchData = await fetchJson(searchUrl);
      if (searchData && searchData.query && searchData.query.pages) {
        const pages = searchData.query.pages;
        for (const id of Object.keys(pages)) {
          const page = pages[id];
          if (page.imageinfo && page.imageinfo[0] && page.imageinfo[0].url) {
            const imgUrl = page.imageinfo[0].url;
            console.log(`Found image: ${imgUrl}`);
            console.log(`Downloading to ${destPath}...`);
            await downloadFile(imgUrl, destPath);
            console.log(`✓ Successfully downloaded: ${destRelativePath}`);
            return true;
          }
        }
      }
    } catch (err) {
      console.error(`Error searching query "${query}":`, err.message);
    }
  }
  return false;
}

async function main() {
  console.log('=== STARTING ALL DOCUMENTARY MEDIA RESEARCH & DOWNLOAD ===\n');

  const tasks = [
    // BIOGRAPHY
    { domain: 'BIOGRAPHY', relativePath: 'biography/tran_hung_dao_statue.jpg', queries: ['Tran Hung Dao statue', 'Tượng Trần Quốc Tuấn'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/nam_dinh_tuc_mac.jpg', queries: ['Đền Trần Nam Định', 'Tức Mặc Nam Định'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/tran_hung_dao_portrait.jpg', queries: ['Trần Hưng Đạo portrait', 'Tranh Trần Hưng Đạo'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/binh_than_conference.jpg', queries: ['Bình Than Trần Hưng Đạo', 'Hội nghị Bình Than'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/hich_tuong_si.jpg', queries: ['Hịch tướng sĩ', 'Chữ Hán Nôm cổ'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/sat_that_army.jpg', queries: ['Quân đội nhà Trần', 'Sát Thát'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/van_kiep_base.jpg', queries: ['Vạn Kiếp Hải Dương', 'Đền Kiếp Bạc'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/pham_ngu_lao.jpg', queries: ['Phạm Ngũ Lão statue', 'Tượng Phạm Ngũ Lão'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/bach_dang_1288.jpg', queries: ['Trận Bạch Đằng 1288', 'Cọc gỗ Bạch Đằng 1288'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/bach_dang_victory.jpg', queries: ['Bạch Đằng giang', 'Sông Bạch Đằng'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/tran_anh_tong.jpg', queries: ['Vua Trần Anh Tông', 'Vương triều nhà Trần'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/den_tran_nam_dinh.jpg', queries: ['Đền Trần Nam Định', 'Kiến trúc nhà Trần'] },
    { domain: 'BIOGRAPHY', relativePath: 'biography/duc_st_tran.jpg', queries: ['Đức Thánh Trần', 'Lễ hội Đền Kiếp Bạc'] },

    // BATTLE
    { domain: 'BATTLE', relativePath: 'battle/ngo_quyen_statue.jpg', queries: ['Ngo Quyen statue', 'Tượng Ngô Quyền'] },
    { domain: 'BATTLE', relativePath: 'battle/duong_lam_village.jpg', queries: ['Làng cổ Đường Lâm', 'Đường Lâm Sơn Tây'] },
    { domain: 'BATTLE', relativePath: 'battle/kieu_cong_tien.jpg', queries: ['Thành Đại La', 'Hoàng thành Hà Nội cổ'] },
    { domain: 'BATTLE', relativePath: 'battle/nam_han_ships.jpg', queries: ['Thuyền chiến cổ', 'Ancient Chinese warship'] },
    { domain: 'BATTLE', relativePath: 'battle/bach_dang_river.jpg', queries: ['Sông Bạch Đằng', 'Bach Dang river'] },
    { domain: 'BATTLE', relativePath: 'battle/wooden_stakes_discovery.jpg', queries: ['Cọc gỗ Bạch Đằng', 'Bach Dang wooden stakes'] },
    { domain: 'BATTLE', relativePath: 'battle/bach_dang_battle_map.jpg', queries: ['Bản đồ Trận Bạch Đằng', 'Trận Bạch Đằng 938'] },
    { domain: 'BATTLE', relativePath: 'battle/tide_bach_dang.jpg', queries: ['Thủy triều sông Bạch Đằng', 'Sông Bạch Đằng Hải Phòng'] },
    { domain: 'BATTLE', relativePath: 'battle/ngo_quyen_command.jpg', queries: ['Ngô Quyền', 'Tượng Ngô Quyền Đường Lâm'] },
    { domain: 'BATTLE', relativePath: 'battle/nam_han_defeat.jpg', queries: ['Bảo tàng Quảng Ninh cọc gỗ', 'Bãi cọc Yên Giang'] },
    { domain: 'BATTLE', relativePath: 'battle/co_loa_citadel.jpg', queries: ['Thành Cổ Loa', 'Co Loa citadel'] },
    { domain: 'BATTLE', relativePath: 'battle/dai_viet_su_ky.jpg', queries: ['Đại Việt sử ký toàn thư', 'Mộc bản triều Nguyễn'] },
    { domain: 'BATTLE', relativePath: 'battle/ngo_quyen_temple.jpg', queries: ['Đền thờ Ngô Quyền', 'Đền Ngô Quyền Hải Phòng'] },

    // DYNASTY
    { domain: 'DYNASTY', relativePath: 'dynasty/tran_dynasty_court.jpg', queries: ['Hoàng thành Thăng Long', 'Thang Long Imperial Citadel'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/ly_chieu_hoang.jpg', queries: ['Đền Đô Bắc Ninh', 'Lý Chiêu Hoàng'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/thang_long_citadel.jpg', queries: ['Hoàng thành Thăng Long Hà Nội', 'Kinh đô Thăng Long'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/dong_bo_dau.jpg', queries: ['Sông Hồng Hà Nội', 'Đông Bộ Đầu'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/dien_hong_hall.jpg', queries: ['Hội nghị Diên Hồng', 'Điện Diên Hồng'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/thai_thuong_hoang.jpg', queries: ['Thái miếu nhà Trần', 'Đền Trần Nam Định'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/truc_lam_yen_tu.jpg', queries: ['Yen Tu pagoda', 'Trúc Lâm Yên Tử'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/chu_nom_manuscript.jpg', queries: ['Chữ Nôm cổ', 'Văn bản Hán Nôm'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/van_don_port.jpg', queries: ['Vân Đồn Quảng Ninh', 'Thương cảng Vân Đồn'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/tran_dynasty_army.jpg', queries: ['Binh khí nhà Trần', 'Bảo tàng Lịch sử Quân sự'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/tran_nhan_tong.jpg', queries: ['Tượng Phật Hoàng Trần Nhân Tông', 'Trần Nhân Tông Yên Tử'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/ho_quy_ly_citadel.jpg', queries: ['Thành nhà Hồ', 'Citadel of Ho Dynasty'] },
    { domain: 'DYNASTY', relativePath: 'dynasty/thien_truong_citadel.jpg', queries: ['Hành cung Thiên Trường', 'Nam Định di tích nhà Trần'] },

    // MYSTERY
    { domain: 'MYSTERY', relativePath: 'mystery/nguyen_trai_portrait.jpg', queries: ['Nguyen Trai portrait', 'Nguyễn Trãi'] },
    { domain: 'MYSTERY', relativePath: 'mystery/con_son_pagoda.jpg', queries: ['Chùa Côn Sơn', 'Con Son pagoda Hai Duong'] },
    { domain: 'MYSTERY', relativePath: 'mystery/le_thai_tong.jpg', queries: ['Vua Lê Thái Tông', 'Tượng Vua Lê Thái Tông'] },
    { domain: 'MYSTERY', relativePath: 'mystery/le_chi_vien_garden.jpg', queries: ['Lệ Chi Viên Gia Bình', 'Đền thờ Nguyễn Trãi Lệ Chi Viên'] },
    { domain: 'MYSTERY', relativePath: 'mystery/nguyen_thi_lo.jpg', queries: ['Nguyễn Thị Lộ', 'Lệ Chi Viên'] },
    { domain: 'MYSTERY', relativePath: 'mystery/le_nhan_tong.jpg', queries: ['Vua Lê Nhân Tông', 'Di tích nhà Lê Sơ'] },
    { domain: 'MYSTERY', relativePath: 'mystery/nguyen_trai_shrine.jpg', queries: ['Đền thờ Nguyễn Trãi Côn Sơn', 'Den tho Nguyen Trai'] },
    { domain: 'MYSTERY', relativePath: 'mystery/le_thanh_tong.jpg', queries: ['Vua Lê Thánh Tông', 'Le Thanh Tong statue'] },
    { domain: 'MYSTERY', relativePath: 'mystery/binh_ngo_dai_cao.jpg', queries: ['Bình Ngô đại cáo', 'Bản gỗ Bình Ngô Đại Cáo'] },
    { domain: 'MYSTERY', relativePath: 'mystery/uc_trai_tap.jpg', queries: ['Ức Trai thi tập', 'Sách cổ Hán Nôm'] },
    { domain: 'MYSTERY', relativePath: 'mystery/dinh_bang_temple.jpg', queries: ['Đình Bảng Bắc Ninh', 'Di tích lịch sử nhà Lê'] },
    { domain: 'MYSTERY', relativePath: 'mystery/thang_long_palace.jpg', queries: ['Điện Kính Thiên', 'Hoàng thành Thăng Long Kính Thiên'] },
    { domain: 'MYSTERY', relativePath: 'mystery/unesco_nguyen_trai.jpg', queries: ['Bia Nguyễn Trãi UNESCO', 'Nguyễn Trãi Côn Sơn'] },

    // ARTIFACT
    { domain: 'ARTIFACT', relativePath: 'artifact/ngoc_lu_drum.jpg', queries: ['Trống đồng Ngọc Lũ I', 'Ngoc Lu bronze drum'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/dong_son_drum.jpg', queries: ['Dong Son drum', 'Trống đồng Đông Sơn'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/bronze_mold.jpg', queries: ['Khuôn đúc đồng cổ', 'Khuôn đúc Đông Sơn'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/bronze_alloy.jpg', queries: ['Hợp kim đồng thau cổ', 'Đúc đồng Đông Sơn'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/chim_lac_pattern.jpg', queries: ['Chim Lạc', 'Hoa văn Chim Lạc'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/ngoc_lu_star.jpg', queries: ['Mặt trống đồng Ngọc Lũ', 'Ngôi sao 14 cánh trống đồng'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/stilt_house_pattern.jpg', queries: ['Nhà sàn trống đồng', 'Hoa văn nhà sàn Đông Sơn'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/pounding_rice_pattern.jpg', queries: ['Cảnh giã gạo trống đồng', 'Hoa văn người giã gạo'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/dong_son_site.jpg', queries: ['Di chỉ Đông Sơn Thanh Hóa', 'Sông Mã Thanh Hóa'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/hung_kings_temple.jpg', queries: ['Đền Hùng Phú Thọ', 'Khu di tích Đền Hùng'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/national_history_museum.jpg', queries: ['Bảo tàng Lịch sử Quốc gia', 'National Museum of Vietnamese History'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/national_treasure_seal.jpg', queries: ['Bảo vật quốc gia Việt Nam', 'Trống đồng Ngọc Lũ bảo vật'] },
    { domain: 'ARTIFACT', relativePath: 'artifact/vietnam_heritage.jpg', queries: ['Trống đồng Việt Nam', 'Biểu trưng trống đồng'] }
  ];

  for (const task of tasks) {
    await searchAndDownloadWikimedia(task.queries, task.relativePath);
  }

  console.log('\n=== DOWNLOAD COMPLETE ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
