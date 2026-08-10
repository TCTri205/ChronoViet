const fs = require('fs');
const path = require('path');
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

const files = getAllFiles(publicDir);
console.log('--- CHECKING MAGIC BYTES OF ALL ASSETS ---');

let corruptedCount = 0;
const corruptedFiles = [];

for (const file of files) {
  if (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png') || file.endsWith('.webp')) {
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(file, 'r');
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);

    const rel = path.relative(publicDir, file).replace(/\\/g, '/');
    const hex = buf.toString('hex');
    const ascii = buf.toString('ascii');

    let isValid = false;
    let format = 'UNKNOWN';

    if (hex.startsWith('ffd8ff')) {
      isValid = true;
      format = 'JPEG';
    } else if (hex.startsWith('89504e47')) {
      isValid = true;
      format = 'PNG';
    } else if (ascii.startsWith('RIFF') && buf.toString('ascii', 8, 12) === 'WEBP') {
      isValid = true;
      format = 'WEBP';
    } else if (ascii.startsWith('%PDF')) {
      format = 'PDF Document (Cannot render as image!)';
    } else if (ascii.includes('<svg') || ascii.includes('<?xml')) {
      format = 'SVG/XML Text (Cannot render as JPG/PNG image!)';
    } else if (ascii.includes('<!DOCTYPE') || ascii.includes('<html')) {
      format = 'HTML Page (HTTP Error / 404 / 302 redirected to HTML!)';
    }

    if (!isValid) {
      console.log(`❌ CORRUPTED IMAGE: ${rel} -> Format: ${format}`);
      corruptedFiles.push({ file, rel, format });
      corruptedCount++;
    }
  }
}

console.log(`\n--- TOTAL CORRUPTED / NON-IMAGE FILES: ${corruptedCount} ---`);
