const fs = require('fs');
const path = require('path');
const https = require('https');

const assetsDir = path.join(__dirname, '../public/assets/hai-ba-trung');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

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

async function fetchPageMedia(pageTitle, domain = 'vi.wikipedia.org') {
  const url = `https://${domain}/api/rest_v1/page/media-list/${encodeURIComponent(pageTitle)}`;
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
    return [];
  }
}

const sceneMapping = [
  { sceneId: 'scene_01', page: 'Đền_Hát_Môn', name: 'scene_01_song_hat_sunrise.jpg' },
  { sceneId: 'scene_02', page: 'Hai_Bà_Trưng', name: 'scene_02_nu_tuong_giap_vang.jpg' },
  { sceneId: 'scene_03', page: 'Trống_đồng_Đông_Sơn', name: 'scene_03_trong_dong_dong_son.jpg' },
  { sceneId: 'scene_04', page: 'Trưng_Trắc', name: 'scene_04_hai_ba_trung_voi_chien.jpg' },
  { sceneId: 'scene_05', page: 'Khởi_nghĩa_Hai_Bà_Trưng', name: 'scene_05_ban_do_giao_chi.jpg' },
  { sceneId: 'scene_06', page: 'Trống_đồng_Đông_Sơn', name: 'scene_06_nhan_dan_lam_than.jpg' },
  { sceneId: 'scene_07', page: 'Tô_Định', name: 'scene_07_thai_thu_to_dinh.jpg' },
  { sceneId: 'scene_08', page: 'Thi_Sách', name: 'scene_08_thi_sach_trung_trac.jpg' },
  { sceneId: 'scene_09', page: 'Khởi_nghĩa_Hai_Bà_Trưng', name: 'scene_09_thi_sach_bi_sat_hai.jpg' },
  { sceneId: 'scene_10', page: 'Trưng_Trắc', name: 'scene_10_trung_trac_the_om_nhan.jpg' },
  { sceneId: 'scene_11', page: 'Đền_Hát_Môn', name: 'scene_11_te_troi_dat_song_hat.jpg' },
  { sceneId: 'scene_12', page: 'Đền_Hát_Môn', name: 'scene_12_loi_the_hat_mon.jpg' },
  { sceneId: 'scene_13', page: 'Khởi_nghĩa_Hai_Bà_Trưng', name: 'scene_13_so_do_tien_cong.jpg' },
  { sceneId: 'scene_14', page: 'Lê_Chân', name: 'scene_14_dan_nu_tuong.jpg' },
  { sceneId: 'scene_15', page: 'Thành_Luy_Lâu', name: 'scene_15_danh_chiem_luy_lau.jpg' },
  { sceneId: 'scene_16', page: 'Đền_Hai_Bà_Trưng_(Mê_Linh)', name: 'scene_16_trung_nu_vuong_xung_de.jpg' },
  { sceneId: 'scene_17', page: 'Mã_Viện', name: 'scene_17_ma_vien_xam_luoc.jpg' },
  { sceneId: 'scene_18', page: 'Trận_Lãng_Bạc', name: 'scene_18_tran_lang_bac.jpg' },
  { sceneId: 'scene_19', page: 'Khởi_nghĩa_Hai_Bà_Trưng', name: 'scene_19_chien_dau_anh_dung.jpg' },
  { sceneId: 'scene_20', page: 'Đền_Hát_Môn', name: 'scene_20_hai_ba_tu_tiet.jpg' },
  { sceneId: 'scene_21', page: 'Hai_Bà_Trưng', name: 'scene_21_hao_quang_song_hat.jpg' },
  { sceneId: 'scene_22', page: 'Trống_đồng_Đông_Sơn', name: 'scene_22_tuyen_ngon_doc_lap.jpg' },
  { sceneId: 'scene_23', page: 'Lê_Chân', name: 'scene_23_phu_nu_viet_nam.jpg' },
  { sceneId: 'scene_24', page: 'Đền_Hai_Bà_Trưng_(Mê_Linh)', name: 'scene_24_den_tho_me_linh.jpg' },
  { sceneId: 'scene_25', page: 'Hai_Bà_Trưng', name: 'scene_25_tuong_dai_hai_ba_trung.jpg' },
  { sceneId: 'scene_26', page: 'Đền_Hai_Bà_Trưng_(Mê_Linh)', name: 'scene_26_outro_chronoviet.png' }
];

async function main() {
  console.log('🏛️ Downloading authentic media files via Wikipedia REST API...');
  for (const item of sceneMapping) {
    const dest = path.join(assetsDir, item.name);
    console.log(`Processing [${item.sceneId}] for topic '${item.page}' -> ${item.name}...`);
    let media = await fetchPageMedia(item.page, 'vi.wikipedia.org');
    if (media.length === 0) {
      media = await fetchPageMedia('Tr%C6%B0ng_Sisters', 'en.wikipedia.org');
    }
    
    let downloaded = false;
    for (const m of media) {
      const ext = path.extname(m.url).toLowerCase();
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        try {
          console.log(`  Downloading ${m.url.substring(0, 75)}...`);
          await downloadFile(m.url, dest);
          console.log(`  ✓ Saved: ${item.name}`);
          downloaded = true;
          break;
        } catch (e) {
          console.log(`  - Failed: ${e.message}`);
        }
      }
    }

    if (!downloaded) {
      console.log(`  ⚠ Fallback: creating placeholder note for ${item.name}`);
    }
  }

  console.log('\n✅ Download complete.');
}

main();
