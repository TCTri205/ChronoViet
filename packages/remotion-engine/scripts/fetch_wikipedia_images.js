const fs = require('fs');
const path = require('path');
const https = require('https');

const assetsDir = path.join(__dirname, '../public/assets');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'ChronoViet-Bot/1.0 (contact@chronoviet.org)' }
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
        headers: { 'User-Agent': 'ChronoViet-Bot/1.0 (contact@chronoviet.org)' }
      }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return request(response.headers.location);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`HTTP ${response.statusCode}`));
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

async function getPageImages(pageTitle) {
  const apiUrl = `https://vi.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages|images&pithumbsize=1000&format=json`;
  const data = await fetchJson(apiUrl);
  const pages = data.query.pages;
  const pageId = Object.keys(pages)[0];
  const page = pages[pageId];

  const imageUrls = [];
  if (page.thumbnail && page.thumbnail.source) {
    imageUrls.push(page.thumbnail.source);
  }

  if (page.images) {
    for (const img of page.images.slice(0, 10)) {
      if (img.title.endsWith('.png') || img.title.endsWith('.jpg') || img.title.endsWith('.jpeg')) {
        const infoUrl = `https://vi.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(img.title)}&prop=imageinfo&iiprop=url&format=json`;
        try {
          const infoData = await fetchJson(infoUrl);
          const iPages = infoData.query.pages;
          const iId = Object.keys(iPages)[0];
          const info = iPages[iId].imageinfo;
          if (info && info[0] && info[0].url) {
            imageUrls.push(info[0].url);
          }
        } catch (e) {}
      }
    }
  }
  return imageUrls;
}

async function main() {
  const topics = [
    { key: 'quang_trung', page: 'Quang_Trung' },
    { key: 'ngoc_hoi_dong_da', page: 'Trận_Ngọc_Hồi_–_Đống_Đa' },
    { key: 'rach_gam', page: 'Trận_Rạch_Gầm_–_Xoài_Mút' },
    { key: 'ngo_thi_nham', page: 'Ngô_Thì_Nhậm' },
    { key: 'nui_ban', page: 'Núi_Bân' }
  ];

  for (const t of topics) {
    console.log(`Searching Wikipedia for topic: ${t.page}...`);
    try {
      const urls = await getPageImages(t.page);
      console.log(`Found ${urls.length} images for ${t.key}`);
      let count = 1;
      for (const u of urls) {
        if (u.includes('commons') || u.includes('upload.wikimedia.org')) {
          const ext = u.substring(u.lastIndexOf('.')).split('?')[0].toLowerCase();
          if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            const fileName = `${t.key}_real_${count}${ext}`;
            const dest = path.join(assetsDir, fileName);
            try {
              console.log(`Downloading ${fileName} from ${u}...`);
              await downloadFile(u, dest);
              console.log(`✓ Saved ${fileName}`);
              count++;
            } catch (err) {
              console.error(`✗ Error downloading ${fileName}:`, err.message);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching page ${t.page}:`, err.message);
    }
  }
  console.log('Done Wikipedia real image download.');
}

main();
