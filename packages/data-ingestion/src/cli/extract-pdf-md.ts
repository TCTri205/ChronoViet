/**
 * CLI Command: Extract Raw Text from PDFs and Save as Clean Markdown Files
 * Usage: node packages/rag-engine/dist/cli/extract-pdf-md.js
 */

import path from 'path';
import { promises as fs } from 'fs';
import { createLogger } from '@chronoviet/infra';
import { PdfExtractor } from '../pdf/pdf-extractor.js';
import { findMonorepoRoot } from '../utils/path-utils.js';

const log = createLogger({ service: 'data-ingestion' });

async function main() {
  const root = findMonorepoRoot();
  const pdfDir = path.resolve(root, 'data', 'raw_corpus', 'pdf');
  const outputDir = path.resolve(root, 'data', 'raw_corpus', 'pdf_extracted');

  log.info('pdf_extract.started', 'Starting Primary PDF Text Extraction & Clean Markdown Export', {
    pdfDir,
    outputDir,
  });

  await fs.mkdir(outputDir, { recursive: true });

  const entries = await fs.readdir(pdfDir);
  const pdfFiles = entries.filter((e) => e.endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    log.warn('pdf_extract.no_pdfs', 'No PDF files found in directory');
    process.exit(0);
  }

  const extractor = new PdfExtractor();
  let count = 0;

  for (const pdfFile of pdfFiles) {
    count++;
    const fullPath = path.join(pdfDir, pdfFile);
    const baseName = path.basename(pdfFile, '.pdf');
    const pdfBuf = await fs.readFile(fullPath);

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
    log.info('pdf_extract.item_done', 'PDF extracted and exported to clean Markdown', {
      pdfFile,
      index: count,
      total: pdfFiles.length,
      sizeKb: Math.round(pdfBuf.length / 1024),
      outPath,
      wordCount,
      docType: docTypeLabel,
    });
  }

  log.info('pdf_extract.completed', 'All historical PDF files successfully extracted', {
    total: pdfFiles.length,
    outputDir,
  });
}

main().catch((err) => {
  log.error('pdf_extract.fatal_error', 'Fatal Extraction Error', { error: err });
  process.exit(1);
});
