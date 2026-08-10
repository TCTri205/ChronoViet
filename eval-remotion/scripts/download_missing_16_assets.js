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

async function searchAndDownloadWikimedia(queries, destRelativePath, fallbackAsset) {
  const destPath = path.join(baseAssetsDir, destRelativePath);

  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
    console.log(`✓ Already exists: ${destRelativePath}`);
    return true;
  }

  for (const query of queries) {
    try {
      console.log(`Searching Wikimedia for: "${query}"...`);
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
            console.log(`Downloading to ${destRelativePath}...`);
            await downloadFile(imgUrl, destPath);
            console.log(`✓ Downloaded: ${destRelativePath} (${fs.statSync(destPath).size} bytes)`);
            return true;
          }
        }
      }
    } catch (err) {
      console.error(`Error searching query "${query}":`, err.message);
    }
  }

  // Fallback if Wikimedia search fails
  if (fallbackAsset) {
    const fallbackPath = path.join(baseAssetsDir, fallbackAsset);
    if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).size > 1000) {
      console.log(`⚠️ Copying fallback "${fallbackAsset}" to "${destRelativePath}"`);
      fs.copyFileSync(fallbackPath, destPath);
      return true;
    }
  }

  console.error(`❌ Failed to obtain asset for ${destRelativePath}`);
  return false;
}

async function main() {
  console.log('=== DOWNLOADING & RECOVERING ALL 16 MISSING ASSETS ===\n');

  const missingTasks = [
    // BATTLE (5)
    {
      relativePath: 'battle/bach_dang_ambush.jpg',
      queries: ['Bach Dang river ambush', 'Sông Bạch Đằng cọc gỗ', 'Trận Bạch Đằng 938'],
      fallback: 'battle/bach_dang_river.jpg'
    },
    {
      relativePath: 'battle/tide_receding.jpg',
      queries: ['Bach Dang tide', 'Sông Bạch Đằng Hải Phòng', 'Thủy triều sông Bạch Đằng'],
      fallback: 'battle/tide_bach_dang.jpg'
    },
    {
      relativePath: 'battle/bach_dang_climax.jpg',
      queries: ['Trận Bạch Đằng', 'Bach Dang stakes', 'Bãi cọc Yên Giang'],
      fallback: 'battle/nam_han_defeat.jpg'
    },
    {
      relativePath: 'battle/ngo_quyen_king.jpg',
      queries: ['Ngo Quyen statue', 'Ngô Quyền Đường Lâm', 'Tượng Ngô Quyền'],
      fallback: 'battle/ngo_quyen_statue.jpg'
    },
    {
      relativePath: 'battle/bach_dang_legacy.jpg',
      queries: ['Bach Dang river', 'Tượng đài Trận Bạch Đằng', 'Khu di tích Bạch Đằng'],
      fallback: 'battle/bach_dang_battle_map.jpg'
    },

    // DYNASTY (5)
    {
      relativePath: 'dynasty/chu_nom_script.jpg',
      queries: ['Nom script manuscript', 'Chữ Nôm', 'Văn bản Hán Nôm cổ'],
      fallback: 'dynasty/chu_nom_manuscript.jpg'
    },
    {
      relativePath: 'dynasty/thien_truong_palace.jpg',
      queries: ['Đền Trần Nam Định', 'Hành cung Thiên Trường', 'Nam Định nhà Trần'],
      fallback: 'dynasty/thien_truong_citadel.jpg'
    },
    {
      relativePath: 'dynasty/chu_van_an.jpg',
      queries: ['Chu Văn An statue', 'Tượng Chu Văn An', 'Văn Miếu Chu Văn An'],
      fallback: 'dynasty/tran_nhan_tong.jpg'
    },
    {
      relativePath: 'dynasty/ho_quy_ly.jpg',
      queries: ['Ho Dynasty Citadel', 'Thành nhà Hồ Thanh Hóa', 'Hồ Quý Ly'],
      fallback: 'dynasty/ho_quy_ly_citadel.jpg'
    },
    {
      relativePath: 'dynasty/hao_khi_dong_a.jpg',
      queries: ['Quân đội nhà Trần', 'Điện Diên Hồng', 'Trận Đông Bộ Đầu'],
      fallback: 'dynasty/tran_dynasty_court.jpg'
    },

    // MYSTERY (3)
    {
      relativePath: 'mystery/le_chi_vien_monument.jpg',
      queries: ['Den tho Nguyen Trai Le Chi Vien', 'Di tích Lệ Chi Viên', 'Lệ Chi Viên Gia Bình'],
      fallback: 'mystery/le_chi_vien_garden.jpg'
    },
    {
      relativePath: 'mystery/le_thanh_tong_statue.jpg',
      queries: ['Le Thanh Tong statue', 'Vua Lê Thánh Tông', 'Tượng Vua Lê Thánh Tông'],
      fallback: 'mystery/le_thanh_tong.jpg'
    },
    {
      relativePath: 'mystery/con_son_monument.jpg',
      queries: ['Chùa Côn Sơn Hải Dương', 'Đền thờ Nguyễn Trãi Côn Sơn', 'Côn Sơn Nguyễn Trãi'],
      fallback: 'mystery/con_son_pagoda.jpg'
    },

    // ARTIFACT (3)
    {
      relativePath: 'artifact/bronze_warrior.jpg',
      queries: ['Dong Son bronze dagger', 'Dao găm Đông Sơn', 'Tượng chiến binh Đông Sơn'],
      fallback: 'artifact/bronze_alloy.jpg'
    },
    {
      relativePath: 'artifact/bronze_drum_sound.jpg',
      queries: ['Dong Son bronze drum Ngoc Lu', 'Lễ hội Trống đồng', 'Trống đồng Ngọc Lũ I'],
      fallback: 'artifact/ngoc_lu_drum.jpg'
    },
    {
      relativePath: 'artifact/history_museum_display.jpg',
      queries: ['National Museum of Vietnamese History', 'Bảo tàng Lịch sử Quốc gia', 'Trưng bày trống đồng'],
      fallback: 'artifact/national_history_museum.jpg'
    }
  ];

  for (const task of missingTasks) {
    await searchAndDownloadWikimedia(task.queries, task.relativePath, task.fallback);
  }

  console.log('\n=== COMPLETED DOWNLOAD & RECOVERY ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
