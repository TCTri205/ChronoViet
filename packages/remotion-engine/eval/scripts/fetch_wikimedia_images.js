const fs = require('fs');
const path = require('path');
const https = require('https');

const assetsDir = path.join(__dirname, '../public/assets');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'ChronoVietApp/1.0 (historical.research@chronoviet.org)' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const request = (targetUrl) => {
      https.get(targetUrl, {
        headers: { 'User-Agent': 'ChronoVietApp/1.0 (historical.research@chronoviet.org)' }
      }, (response) => {
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
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };
    request(url);
  });
}

async function fetchWikimediaImage(searchQuery, destFilename) {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchQuery)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|size&format=json`;
    const searchData = await fetchJson(searchUrl);
    if (!searchData.query || !searchData.query.pages) {
      console.log(`No Wikimedia result for: ${searchQuery}`);
      return false;
    }
    const pages = searchData.query.pages;
    for (const id of Object.keys(pages)) {
      const page = pages[id];
      if (page.imageinfo && page.imageinfo[0] && page.imageinfo[0].url) {
        const imgUrl = page.imageinfo[0].url;
        const destPath = path.join(assetsDir, destFilename);
        console.log(`Downloading ${destFilename} from ${imgUrl}...`);
        await downloadFile(imgUrl, destPath);
        console.log(`✓ Successfully downloaded: ${destFilename}`);
        return true;
      }
    }
  } catch (err) {
    console.error(`Error fetching image for ${searchQuery}:`, err.message);
  }
  return false;
}

async function main() {
  const imagesToFetch = [
    { query: 'Quang Trung Nguyễn Huệ portrait', filename: 'real_quang_trung_portrait.jpg' },
    { query: 'Tây Sơn army cavalry', filename: 'real_tayson_army.jpg' },
    { query: 'Tây Sơn war elephants', filename: 'real_war_elephants.jpg' },
    { query: 'Trận Rạch Gầm Xoài Mút', filename: 'real_rach_gam_xoai_mut.jpg' },
    { query: 'Ngô Thì Nhậm', filename: 'real_ngo_thi_nham.jpg' },
    { query: 'Núi Bân Huế Quang Trung', filename: 'real_nui_ban_hue.jpg' },
    { query: 'Tây Sơn weapons museum', filename: 'real_tayson_weapons.jpg' },
    { query: 'Trận Ngọc Hồi Đống Đa', filename: 'real_ngoc_hoi_dong_da.jpg' },
    { query: 'Quang Trung tiến vào Thăng Long', filename: 'real_quang_trung_thang_long.jpg' },
    { query: 'Quang Trung Thông Bảo coin', filename: 'real_quang_trung_coin.jpg' },
    { query: 'Bảo tàng Quang Trung Bình Định statue', filename: 'real_quang_trung_statue.jpg' }
  ];

  console.log('Downloading real historical photos from Wikimedia Commons...');
  for (const item of imagesToFetch) {
    await fetchWikimediaImage(item.query, item.filename);
  }
  console.log('Done downloading real historical photos.');
}

main();
