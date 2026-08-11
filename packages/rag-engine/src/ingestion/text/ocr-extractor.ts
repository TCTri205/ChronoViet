/**
 * OCR Extractor Engine for Historical Scanned Documents & PDFs
 * Supports Primary MinerU CLI Adapter & Secondary Tesseract / Regex Fallback Adapter
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { OcrPageStructure } from '../types.js';

const execFileAsync = promisify(execFile);

export interface OcrExtractorOptions {
  preferredAdapter?: 'mineru' | 'tesseract' | 'auto';
  detectHeadings?: boolean;
}

/**
 * Primary MinerU CLI Adapter for complex multi-column historical scans
 */
async function extractWithMinerU(pdfPath: string): Promise<OcrPageStructure[]> {
  try {
    const { stdout } = await execFileAsync('mineru', ['--input', pdfPath, '--output-format', 'json']);
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((page: any, index: number) => ({
        pageNumber: page.page_number || index + 1,
        header: page.header || undefined,
        footer: page.footer || undefined,
        headings: page.headings || [],
        textContent: page.text || '',
        tables: page.tables || [],
        images: page.images || [],
      }));
    }
  } catch (error) {
    // MinerU CLI not installed or failed, fallback to secondary adapter
  }
  return [];
}

/**
 * Secondary Tesseract Node.js / CLI Fallback Adapter
 */
async function extractWithTesseract(pdfPath: string): Promise<OcrPageStructure[]> {
  try {
    const { stdout } = await execFileAsync('tesseract', [pdfPath, 'stdout', '-l', 'vie+eng', '--oem', '1']);
    if (stdout && stdout.trim().length > 0) {
      return parseRawTextToPages(stdout);
    }
  } catch (error) {
    // Tesseract CLI not installed or failed
  }
  return [];
}

/**
 * Parses raw unformatted text or PDF text stream into structured OcrPageStructure array
 */
export function parseRawTextToPages(rawText: string): OcrPageStructure[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  // Split by common page markers or form feed (\f)
  const rawPages = rawText.split(/\f|\n(?=Trang \d+|\bPage \d+\b)/gi);

  return rawPages.map((pageText, idx) => {
    const lines = pageText.split('\n').map((l) => l.trim()).filter(Boolean);
    const pageNum = idx + 1;

    let header: string | undefined;
    let footer: string | undefined;
    const headings: string[] = [];
    const contentLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check header on first line
      if (i === 0 && (line.toLowerCase().startsWith('trang') || line.toLowerCase().includes('đại việt sử ký'))) {
        header = line;
        continue;
      }

      // Check footer on last line
      if (i === lines.length - 1 && /^\d+$/.test(line)) {
        footer = line;
        continue;
      }

      // Check heading patterns (Chương X, Mục Y, Tiết Z, Roman numerals, All Caps)
      if (
        /^(Chương|Mục|Tiết|Phần|Quyển)\s+[0-9IVXLCDM]+/i.test(line) ||
        (/^[A-ZÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ\s]{4,60}$/.test(line) && line.length < 80)
      ) {
        headings.push(line);
      }

      contentLines.push(line);
    }

    return {
      pageNumber: pageNum,
      header,
      footer,
      headings,
      textContent: contentLines.join('\n'),
    };
  });
}

/**
 * Main OCR Extractor method with automatic adapter fallback
 */
export async function extractTextFromPdf(
  pdfPath: string,
  options: OcrExtractorOptions = { preferredAdapter: 'auto' }
): Promise<OcrPageStructure[]> {
  const adapter = options.preferredAdapter || 'auto';

  if (adapter === 'mineru' || adapter === 'auto') {
    const mineruResult = await extractWithMinerU(pdfPath);
    if (mineruResult.length > 0) {
      return mineruResult;
    }
  }

  if (adapter === 'tesseract' || adapter === 'auto') {
    const tesseractResult = await extractWithTesseract(pdfPath);
    if (tesseractResult.length > 0) {
      return tesseractResult;
    }
  }

  // Final fallback: empty pages if file cannot be read directly
  return [];
}

/**
 * Universal document text extractor handling PDF, raw text, and scanned content
 */
export async function extractTextFromDocument(
  filePath: string,
  rawContent?: string,
  options?: OcrExtractorOptions
): Promise<OcrPageStructure[]> {
  if (rawContent && rawContent.trim().length > 0) {
    return parseRawTextToPages(rawContent);
  }

  if (filePath.endsWith('.pdf')) {
    return extractTextFromPdf(filePath, options);
  }

  return [];
}
