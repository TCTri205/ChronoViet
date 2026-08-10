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
  console.log('=== STARTING ENRICHED HISTORICAL MEDIA RESEARCH & DOWNLOAD ===\n');

  const tasks = [
    // BIOGRAPHY
    {
      domain: 'BIOGRAPHY',
      relativePath: 'biography/tran_hung_dao_statue.jpg',
      queries: ['Tran Hung Dao statue', 'Tượng Trần Quốc Tuấn', 'Trần Hưng Đạo Nam Định'],
    },
    {
      domain: 'BIOGRAPHY',
      relativePath: 'biography/bach_dang_1288.jpg',
      queries: ['Trận Bạch Đằng 1288', 'Trận Bạch Đằng nhà Trần', 'Bach Dang river Vietnam'],
    },

    // BATTLE
    {
      domain: 'BATTLE',
      relativePath: 'battle/bach_dang_battle_map.jpg',
      queries: ['Bach Dang wooden stakes', 'Cọc gỗ Bạch Đằng', 'Sông Bạch Đằng'],
    },
    {
      domain: 'BATTLE',
      relativePath: 'battle/ngo_quyen_command.jpg',
      queries: ['Ngo Quyen statue', 'Tượng Ngô Quyền', 'Ngô Quyền Đường Lâm'],
    },

    // DYNASTY
    {
      domain: 'DYNASTY',
      relativePath: 'dynasty/tran_dynasty_court.jpg',
      queries: ['Thang Long Imperial Citadel', 'Hoàng thành Thăng Long'],
    },
    {
      domain: 'DYNASTY',
      relativePath: 'dynasty/truc_lam_yen_tu.jpg',
      queries: ['Yen Tu pagoda', 'Trúc Lâm Yên Tử', 'Chùa Đồng Yên Tử'],
    },

    // MYSTERY
    {
      domain: 'MYSTERY',
      relativePath: 'mystery/le_chi_vien_garden.jpg',
      queries: ['Nguyen Trai portrait', 'Đền thờ Nguyễn Trãi', 'Nguyen Trai statue'],
    },
    {
      domain: 'MYSTERY',
      relativePath: 'mystery/le_thanh_tong.jpg',
      queries: ['Le Thanh Tong statue', 'Vua Lê Thánh Tông', 'Tượng Lê Thánh Tông'],
    },

    // ARTIFACT
    {
      domain: 'ARTIFACT',
      relativePath: 'artifact/dong_son_drum.jpg',
      queries: ['Dong Son drum', 'Ngoc Lu bronze drum', 'Trống đồng Ngọc Lũ I'],
    },
    {
      domain: 'ARTIFACT',
      relativePath: 'artifact/chim_lac_pattern.jpg',
      queries: ['Chim Lạc', 'Dong Son cultural artifact', 'Trống đồng Đông Sơn hoa văn'],
    },
  ];

  for (const task of tasks) {
    console.log(`\n--- Fetching asset for ${task.domain}: ${task.relativePath} ---`);
    const success = await searchAndDownloadWikimedia(task.queries, task.relativePath);
    if (!success) {
      console.error(`❌ Could not fetch image for ${task.relativePath}`);
    }
  }

  console.log('\n=== DOWNLOAD COMPLETE ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
