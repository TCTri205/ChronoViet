const fs = require('fs');
const path = require('path');
const https = require('https');

const assetsDir = path.join(__dirname, '../public/assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const request = (targetUrl) => {
      https.get(targetUrl, {
        headers: {
          'User-Agent': 'ChronoViet-History-Research/1.0 (contact@chronoviet.org)'
        }
      }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return request(response.headers.location);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`HTTP status ${response.statusCode} for ${targetUrl}`));
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

// Wikimedia Commons / Wikipedia Public Domain Historic Images for Quang Trung & Tay Son Era
const imageSources = [
  {
    filename: '01_quang_trung_portrait.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Quang_Trung.jpg',
    desc: 'Chân dung Hoàng đế Quang Trung (Nguyễn Huệ)'
  },
  {
    filename: '02_tay_son_horsemen.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Tay_Son_cavalry.jpg/800px-Tay_Son_cavalry.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Tay_Son_cavalry.jpg',
    desc: 'Kỵ binh Tây Sơn 18 năm trên lưng ngựa'
  },
  {
    filename: '03_tay_son_war_elephants.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Tay_Son_elephants.jpg/800px-Tay_Son_elephants.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Tay_Son_elephants.jpg',
    desc: 'Đội Tượng Binh Tây Sơn dũng mãnh'
  },
  {
    filename: '04_sac_than_tay_son.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Tay_Son_decree.jpg/800px-Tay_Son_decree.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/18/Tay_Son_decree.jpg',
    desc: 'Sắc thần & Lệnh chỉ thời Tây Sơn'
  },
  {
    filename: '05_rach_gam_xoai_mut.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Battle_of_Rach_Gam_-_Xoai_Mut.jpg/800px-Battle_of_Rach_Gam_-_Xoai_Mut.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Battle_of_Rach_Gam_-_Xoai_Mut.jpg',
    desc: 'Chiến thắng Rạch Gầm - Xoài Mút 1785'
  },
  {
    filename: '06_ngo_thi_nham.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Ngo_Thi_Nham.jpg/600px-Ngo_Thi_Nham.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Ngo_Thi_Nham.jpg',
    desc: 'Danh sĩ Ngô Thì Nhậm'
  },
  {
    filename: '07_nui_ban_hue.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Nui_Ban_Hue.jpg/800px-Nui_Ban_Hue.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Nui_Ban_Hue.jpg',
    desc: 'Di tích Núi Bân - Huế nơi Quang Trung lên ngôi 1788'
  },
  {
    filename: '08_tay_son_weapons.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Tay_Son_weapons.jpg/800px-Tay_Son_weapons.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Tay_Son_weapons.jpg',
    desc: 'Binh khí quân Tây Sơn tại Bảo tàng'
  },
  {
    filename: '09_ngoc_hoi_dong_da.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Battle_of_Ngoc_Hoi_-_Dong_Da.jpg/800px-Battle_of_Ngoc_Hoi_-_Dong_Da.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Battle_of_Ngoc_Hoi_-_Dong_Da.jpg',
    desc: 'Trận Ngọc Hồi - Đống Đa đại phá 29 vạn quân Thanh'
  },
  {
    filename: '10_quang_trung_thang_long.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Quang_Trung_enters_Thang_Long.jpg/800px-Quang_Trung_enters_Thang_Long.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Quang_Trung_enters_Thang_Long.jpg',
    desc: 'Quang Trung tiến vào Thăng Long ngày Mùng 5 Tết Kỷ Dậu 1789'
  },
  {
    filename: '11_quang_trung_coin.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Quang_Trung_Thong_Bao.jpg/600px-Quang_Trung_Thong_Bao.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Quang_Trung_Thong_Bao.jpg',
    desc: 'Tiền đồng Quang Trung Thông Bảo'
  },
  {
    filename: '12_quang_trung_statue.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Quang_Trung_statue_Binh_Dinh.jpg/800px-Quang_Trung_statue_Binh_Dinh.jpg',
    fallbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Quang_Trung_statue_Binh_Dinh.jpg',
    desc: 'Tượng đài Hoàng đế Quang Trung tại Bình Định'
  }
];

async function main() {
  console.log('🔍 Researching & downloading authentic historical images for Emperor Quang Trung...');
  for (const item of imageSources) {
    const dest = path.join(assetsDir, item.filename);
    try {
      console.log(`Downloading: ${item.filename} (${item.desc})...`);
      await downloadFile(item.url, dest);
      console.log(`✓ Saved: ${item.filename}`);
    } catch (err) {
      if (item.fallbackUrl) {
        try {
          console.log(`Trying fallback URL for ${item.filename}...`);
          await downloadFile(item.fallbackUrl, dest);
          console.log(`✓ Saved fallback: ${item.filename}`);
          continue;
        } catch (fErr) {
          console.error(`✗ Fallback failed for ${item.filename}:`, fErr.message);
        }
      } else {
        console.error(`✗ Failed ${item.filename}:`, err.message);
      }
    }
  }
  console.log('✅ Image download task completed.');
}

main();
