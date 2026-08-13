/**
 * CLI Command: Extract Raw Text from PDFs and Save as Clean Markdown Files
 * Usage: node packages/rag-engine/dist/cli/extract-pdf-md.js
 */

import path from 'path';
import { promises as fs } from 'fs';
import { PdfExtractor } from '../pdf/pdf-extractor.js';
import { findMonorepoRoot } from '../utils/path-utils.js';

async function main() {
  const root = findMonorepoRoot();
  const pdfDir = path.resolve(root, 'data', 'raw_corpus', 'pdf');
  const outputDir = path.resolve(root, 'data', 'raw_corpus', 'pdf_extracted');

  console.log('📚 Starting Primary PDF Text Extraction & Clean Markdown Export...');
  console.log(`📁 Source PDF Directory: ${pdfDir}`);
  console.log(`📁 Target Output Directory: ${outputDir}\n`);

  await fs.mkdir(outputDir, { recursive: true });

  const entries = await fs.readdir(pdfDir);
  const pdfFiles = entries.filter((e) => e.endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.warn('⚠️ No PDF files found in directory!');
    process.exit(0);
  }

  const extractor = new PdfExtractor();
  let count = 0;

  for (const pdfFile of pdfFiles) {
    count++;
    const fullPath = path.join(pdfDir, pdfFile);
    const baseName = path.basename(pdfFile, '.pdf');
    const pdfBuf = await fs.readFile(fullPath);

    console.log(`[${count}/${pdfFiles.length}] Extracting: ${pdfFile} (${Math.round(pdfBuf.length / 1024)} KB)...`);

    const result = extractor.extract(pdfBuf, fullPath);
    const outFileName = `${baseName}.md`;
    const outPath = path.join(outputDir, outFileName);

    const docTypeLabel = result.isScannedPdf ? 'Bitmap Scanned Document (Bản scan hình ảnh)' : 'Digital Text Document (Văn bản số)';

    // Build Markdown content with YAML-style metadata header
    const mdContent = `---
title: "${result.title}"
author: "${result.author || 'Tác giả Lịch sử'}"
source_reliability: "${result.sourceReliability}"
document_type: "${docTypeLabel}"
total_pages: ${result.totalPageCount}
extracted_at: "${new Date().toISOString()}"
original_file: "${pdfFile}"
---

# ${result.title}

> **Tác giả:** ${result.author || 'Chưa rõ'}  
> **Cấp độ Tin cậy Sử liệu:** ${result.sourceReliability} (Chính sử / Tư liệu gốc Level 1)  
> **Loại tài liệu:** ${docTypeLabel}  
> **Số trang trích xuất:** ${result.totalPageCount} trang  

---

${result.text}
`;

    await fs.writeFile(outPath, mdContent, 'utf-8');
    const wordCount = result.text.split(/\s+/).filter(Boolean).length;
    console.log(`   ✅ Exported Clean Markdown: ${outPath} (${wordCount} words, type: ${docTypeLabel})\n`);
  }

  console.log('======================================================');
  console.log('🎉 All Historical PDF Files Successfully Extracted to Clean Markdown!');
  console.log(`📁 Output Folder: ${outputDir}`);
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('❌ Fatal Extraction Error:', err);
  process.exit(1);
});
