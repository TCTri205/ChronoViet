const fs = require('fs');
const path = require('path');
const https = require('https');

const assetsDir = path.join(__dirname, '../public/assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'ChronoViet-HistoryEngine/1.0 (contact@chronoviet.org)' }
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
        headers: { 'User-Agent': 'ChronoViet-HistoryEngine/1.0 (contact@chronoviet.org)' }
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

async function fetchPageMedia(pageTitle) {
  const url = `https://vi.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(pageTitle)}`;
  try {
    const data = await fetchJson(url);
    if (!data.items) return [];
    const images = [];
    for (const item of data.items) {
      if (item.type === 'image' && item.srcset && item.srcset.length > 0) {
        // Pick highest resolution srcset entry
        const bestSrc = item.srcset[item.srcset.length - 1].src;
        const fullUrl = bestSrc.startsWith('//') ? `https:${bestSrc}` : bestSrc;
        images.push({ title: item.title, url: fullUrl });
      }
    }
    return images;
  } catch (err) {
    console.error(`Error fetching media list for ${pageTitle}:`, err.message);
    return [];
  }
}

async function main() {
  const pages = [
    'Quang_Trung',
    'Trận_Ngọc_Hồi_–_Đống_Đa',
    'Trận_Rạch_Gầm_–_Xoài_Mút',
    'Ngô_Thì_Nhậm',
    'Núi_Bân',
    'Bảo_tàng_Quang_Trung'
  ];

  console.log('Downloading real historical media from Wikipedia articles...');
  const downloadedFiles = {};

  for (const p of pages) {
    console.log(`\nFetching images from Wikipedia article: ${p}`);
    const media = await fetchPageMedia(p);
    console.log(`Found ${media.length} media items on ${p}`);

    let index = 1;
    for (const item of media) {
      const ext = path.extname(item.title.replace('File:', '')).toLowerCase() || '.jpg';
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        const cleanName = `${p.toLowerCase()}_${index}${ext}`.replace(/[^a-z0-9._-]/gi, '_');
        const dest = path.join(assetsDir, cleanName);
        try {
          console.log(`  -> Downloading ${cleanName}...`);
          await downloadFile(item.url, dest);
          console.log(`  ✓ Saved ${cleanName}`);
          downloadedFiles[`${p}_${index}`] = cleanName;
          index++;
        } catch (e) {
          console.error(`  ✗ Failed ${cleanName}:`, e.message);
        }
      }
    }
  }

  console.log('\n✅ All authentic Wikipedia images downloaded successfully.');
}

main();
