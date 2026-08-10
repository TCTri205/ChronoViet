const fs = require('fs');
const path = require('path');
const https = require('https');

const publicDir = path.join(__dirname, '../public');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function checkImageValidity(file) {
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);

  const hex = buf.toString('hex');
  const ascii = buf.toString('ascii');

  if (hex.startsWith('ffd8ff')) return { ok: true, format: 'JPEG' };
  if (hex.startsWith('89504e47')) return { ok: true, format: 'PNG' };
  if (ascii.startsWith('RIFF') && buf.toString('ascii', 8, 12) === 'WEBP') return { ok: true, format: 'WEBP' };

  let reason = 'UNKNOWN_MAGIC_BYTES';
  if (ascii.startsWith('%PDF')) reason = 'PDF_DOCUMENT';
  if (ascii.includes('<svg') || ascii.includes('<?xml')) reason = 'SVG_XML_TEXT';
  if (ascii.includes('<!DOCTYPE') || ascii.includes('<html')) reason = 'HTML_PAGE';
  if (ascii.startsWith('GIF8')) reason = 'GIF_ANIMATION';

  return { ok: false, reason };
}

function fetchWikimediaJpgOnly(query) {
  return new Promise((resolve) => {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime|size&format=json`;

    https.get(searchUrl, { headers: { 'User-Agent': 'ChronoVietApp/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.query && json.query.pages) {
            for (const key of Object.keys(json.query.pages)) {
              const page = json.query.pages[key];
              if (page.imageinfo && page.imageinfo[0]) {
                const info = page.imageinfo[0];
                const mime = info.mime || '';
                const url = info.url || '';
                if ((mime === 'image/jpeg' || mime === 'image/png') && (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png'))) {
                  return resolve(url);
                }
              }
            }
          }
          resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const request = (targetUrl) => {
      https.get(targetUrl, { headers: { 'User-Agent': 'ChronoVietApp/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(true)));
      }).on('error', err => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };
    request(url);
  });
}

async function main() {
  const allFiles = getAllFiles(publicDir);
  console.log(`Auditing total ${allFiles.length} files in public directory...`);

  const imageFiles = allFiles.filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp'));
  console.log(`Found ${imageFiles.length} image files.`);

  const invalidFiles = [];
  for (const f of imageFiles) {
    const res = checkImageValidity(f);
    if (!res.ok) {
      const rel = path.relative(publicDir, f).replace(/\\/g, '/');
      console.log(`❌ Invalid image found: ${rel} (${res.reason})`);
      invalidFiles.push({ fullPath: f, rel, reason: res.reason });
    }
  }

  console.log(`\nFound ${invalidFiles.length} invalid image files.`);

  // Map of domain fallbacks in case download fails
  const fallbackMap = {
    'battle': 'assets/battle/bach_dang_river.jpg',
    'dynasty': 'assets/dynasty/thang_long_citadel.jpg',
    'mystery': 'assets/mystery/con_son_pagoda.jpg',
    'artifact': 'assets/artifact/ngoc_lu_drum.jpg'
  };

  const queryMap = {
    'assets/battle/bach_dang_ambush.jpg': 'Bạch Đằng river Vietnam',
    'assets/dynasty/chu_nom_script.jpg': 'Han Nom Vietnamese document',
    'assets/mystery/le_chi_vien_monument.jpg': 'Nguyen Trai monument',
    'assets/artifact/bronze_drum_sound.jpg': 'Dong Son drum Ngoc Lu'
  };

  for (const item of invalidFiles) {
    console.log(`\n--- Fixing invalid image: ${item.rel} ---`);
    const query = queryMap[item.rel] || 'Vietnam history';
    const wikimediaUrl = await fetchWikimediaJpgOnly(query);

    let success = false;
    if (wikimediaUrl) {
      console.log(`Found valid JPEG/PNG URL on Wikimedia: ${wikimediaUrl}`);
      try {
        await downloadFile(wikimediaUrl, item.fullPath);
        const check = checkImageValidity(item.fullPath);
        if (check.ok) {
          console.log(`✅ Successfully replaced with valid ${check.format} (${fs.statSync(item.fullPath).size} bytes)`);
          success = true;
        }
      } catch (err) {
        console.error(`Download failed: ${err.message}`);
      }
    }

    if (!success) {
      const domain = item.rel.split('/')[1];
      const fbRel = fallbackMap[domain] || 'assets/battle/bach_dang_river.jpg';
      const fbPath = path.join(publicDir, fbRel);
      console.log(`⚠️ Copying fallback asset ${fbRel} to ${item.rel}...`);
      fs.copyFileSync(fbPath, item.fullPath);
      const check = checkImageValidity(item.fullPath);
      console.log(`✅ Fixed with fallback asset: ${check.format}`);
    }
  }

  console.log('\n=== AUDITING ALL IMAGES AGAIN ===');
  let finalInvalid = 0;
  for (const f of imageFiles) {
    const check = checkImageValidity(f);
    if (!check.ok) {
      finalInvalid++;
      console.error(`Still invalid: ${f}`);
    }
  }

  if (finalInvalid === 0) {
    console.log('🎉 ALL IMAGE ASSETS ARE NOW 100% VALID JPEG/PNG/WEBP FILES!');
  }
}

main();
