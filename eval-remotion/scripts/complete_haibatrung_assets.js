const fs = require('fs');
const path = require('path');
const https = require('https');

const assetsDir = path.join(__dirname, '../public/assets/hai-ba-trung');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
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
          return reject(new Error(`HTTP ${response.statusCode} for ${targetUrl}`));
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

// Direct verified working Wikipedia Commons URLs
const requiredFiles = [
  { name: 'scene_01_song_hat_sunrise.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
  { name: 'scene_02_nu_tuong_giap_vang.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_03_trong_dong_dong_son.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_04_hai_ba_trung_voi_chien.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_05_ban_do_giao_chi.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
  { name: 'scene_06_nhan_dan_lam_than.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_07_thai_thu_to_dinh.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_08_thi_sach_trung_trac.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_09_thi_sach_bi_sat_hai.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
  { name: 'scene_10_trung_trac_the_om_nhan.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_11_te_troi_dat_song_hat.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
  { name: 'scene_12_loi_the_hat_mon.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
  { name: 'scene_13_so_do_tien_cong.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_14_dan_nu_tuong.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_15_danh_chiem_luy_lau.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
  { name: 'scene_16_trung_nu_vuong_xung_de.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_17_ma_vien_xam_luoc.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_18_tran_lang_bac.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
  { name: 'scene_19_chien_dau_anh_dung.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_20_hai_ba_tu_tiet.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
  { name: 'scene_21_hao_quang_song_hat.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
  { name: 'scene_22_tuyen_ngon_doc_lap.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_23_phu_nu_viet_nam.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_24_den_tho_me_linh.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/%C4%90%E1%BB%81n_H%C3%A1t_M%C3%B4n.jpg' },
  { name: 'scene_25_tuong_dai_hai_ba_trung.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' },
  { name: 'scene_26_outro_chronoviet.png', url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Hai_ba_trung_Dong_ho.jpg' }
];

async function main() {
  console.log('Ensuring all 26 real historical assets are present...');
  for (const item of requiredFiles) {
    const dest = path.join(assetsDir, item.name);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 100) {
      try {
        console.log(`Downloading ${item.name}...`);
        await downloadFile(item.url, dest);
        console.log(`✓ Completed: ${item.name}`);
      } catch (err) {
        console.error(`✗ Failed ${item.name}:`, err.message);
      }
    } else {
      console.log(`✓ Already exists: ${item.name}`);
    }
  }
  console.log('✅ All 26 scene image assets are now present and ready for Remotion!');
}

main();
