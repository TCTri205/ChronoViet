/**
 * Zero-Dependency Primary Historical PDF Extractor Module
 * Extracts text, page numbers, titles, and maps canonical historical metadata for PDF documents in raw_corpus/pdf/
 */

import path from 'path';
import zlib from 'zlib';
import { SourceReliability } from '@chronoviet/shared-spec';
import { createLogger } from '@chronoviet/infra';

const log = createLogger({ service: 'data-ingestion' });

export interface PdfPageContent {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdfResult {
  title: string;
  author?: string;
  sourceReliability: SourceReliability;
  text: string;
  pages: PdfPageContent[];
  totalPageCount: number;
  isScannedPdf?: boolean;
}

export interface HistoricalPdfMetadata {
  title: string;
  author: string;
  sourceReliability: SourceReliability;
  dynasty?: string;
  description: string;
}

/**
 * Historical Master PDF Registry Mapping
 * Maps PDF filenames in data/raw_corpus/pdf/ to Ground-Truth Level 1 metadata
 */
export const HISTORICAL_PDF_REGISTRY: Record<string, HistoricalPdfMetadata> = {
  'annam-chiluoc': {
    title: 'An Nam Chí Lược',
    author: 'Lê Tắc',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Nhà Trần / Nguyên',
    description: 'Bộ sử địa lý, quan chế và biến cố chính trị thời Lý - Trần do Lê Tắc biên soạn.',
  },
  'dai-viet-su-ky-toan-thu-le-van-huu-phan-phu-tien-ngo-si-lien': {
    title: 'Đại Việt Sử Ký Toàn Thư',
    author: 'Lê Văn Hưu, Phan Phu Tiên, Ngô Sĩ Liên',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Hùng Vương - Nhà Lê Sơ',
    description: 'Bộ chính sử toàn thư quan trọng bậc nhất lịch sử Việt Nam từ thời Hùng Vương đến Lê Sơ.',
  },
  'dai-viet-su-luoc-khuyet-danh': {
    title: 'Đại Việt Sử Lược',
    author: 'Khuyết danh',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Hùng Vương - Nhà Lý',
    description: 'Bộ sử khuyết danh lâu đời nhất còn tồn tại, chép từ thời Hùng Vương đến cuối thời Lý.',
  },
  'dai-viet-thong-su-le-quy-don': {
    title: 'Đại Việt Thông Sử',
    author: 'Lê Quý Đôn',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Nhà Lê Sơ',
    description: 'Bộ sử ký dạng kỷ truyền do nhà bác học Lê Quý Đôn biên soạn chép triệt để thời Lê Sơ.',
  },
  'hoang-le-nhat-thong-chi-ngo-gia-van-phai': {
    title: 'Hoàng Lê Nhất Thống Chí',
    author: 'Ngô Gia Văn Phái (Ngô Thì Chí, Ngô Thì Du)',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Thời Kỳ Tây Sơn / Lê Mạt',
    description: 'Bộ tiểu thuyết lịch sử chương hồi ghi chép chân thực sự biến đổi triều Lê mạt và triều Tây Sơn.',
  },
  'kham-dinh-viet-su-thong-giam-cuong-muc-quoc-su-quan-trieu-nguyen': {
    title: 'Khâm Định Việt Sử Thông Giám Cương Mục',
    author: 'Quốc Sử Quán Triều Nguyễn',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Hùng Vương - Nhà Nguyễn',
    description: 'Bộ sử biên niên quy mô lớn nhất do Vua Tự Đức chỉ đạo Quốc Sử Quán biên soạn.',
  },
  'lam-son-thuc-luc-nguyen-trai-bien-soan-le-thai-to-de-tua': {
    title: 'Lam Sơn Thực Lục',
    author: 'Nguyễn Trãi (Vua Lê Thái Tổ đề tựa)',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Khởi nghĩa Lam Sơn (1407 - 1427)',
    description: 'Bộ thực lục chép toàn bộ diễn biến cuộc khởi nghĩa Lam Sơn của Vua Lê Lợi.',
  },
  'quoc-trieu-chanh-bien-toat-yeu-cao-xuan-duc': {
    title: 'Quốc Triều Chánh Biên Toát Yếu',
    author: 'Cao Xuân Dục',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Nhà Nguyễn (Gia Long - Đồng Khánh)',
    description: 'Bộ sử tóm lược các sự kiện chính yếu của Nhà Nguyễn độc lập.',
  },
  'thien-uyen-tap-anh-le-manh-that': {
    title: 'Thiền Uyển Tập Anh',
    author: 'Khuyết danh (Lê Mạnh Thát khảo cứu)',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Bắc Thuộc - Thời Lý / Trần',
    description: 'Tác phẩm lịch sử Phật giáo lâu đời nhất Việt Nam chép tiểu sử các thiền sư.',
  },
  'viet-dien-u-linh-tap-ly-te-xuyen': {
    title: 'Việt Điện U Linh Tập',
    author: 'Lý Tế Xuyên',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Hùng Vương - Thời Lý / Trần',
    description: 'Tập truyện thần tích, dã sử ghi chép về công tích các vị thần linh, danh tướng Việt Nam.',
  },
  'viet-nam-su-luoc-tran-trong-kim': {
    title: 'Việt Nam Sử Lược',
    author: 'Trần Trọng Kim',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Hùng Vương - Thời Pháp thuộc',
    description: 'Bộ thông sử Việt Nam đầu tiên viết bằng chữ Quốc ngữ hệ thống toàn bộ lịch sử Việt Nam.',
  },
  'viet-su-tieu-an-ngo-thoi-sy': {
    title: 'Việt Sử Tiêu Án',
    author: 'Ngô Thời Sĩ',
    sourceReliability: 'LEVEL_1',
    dynasty: 'Hùng Vương - Thời Nhà Hồ',
    description: 'Bộ sử luận phê bình và khảo cứu chi tiết các sự kiện lịch sử cổ trung đại Việt Nam.',
  },
};

/**
 * TCVN3 / Win1258 / Common Vietnamese PDF font encoding lookup table
 */
const VN_FONT_CHAR_MAP: Record<number, string> = {
  0x80: 'à', 0x81: 'á', 0x82: 'ả', 0x83: 'ã', 0x84: 'ạ',
  0x85: 'ằ', 0x86: 'ắ', 0x87: 'ẳ', 0x88: 'ẵ', 0x89: 'ặ',
  0x8a: 'ầ', 0x8b: 'ấ', 0x8c: 'ẩ', 0x8d: 'ẫ', 0x8e: 'ậ',
  0x8f: 'đ', 0x90: 'è', 0x91: 'é', 0x92: 'ẻ', 0x93: 'ẽ', 0x94: 'ẹ',
  0x95: 'ề', 0x96: 'ế', 0x97: 'ể', 0x98: 'ễ', 0x99: 'ệ',
  0x9a: 'ì', 0x9b: 'í', 0x9c: 'ỉ', 0x9d: 'ĩ', 0x9e: 'ị',
  0x9f: 'ò', 0xa1: 'ó', 0xa2: 'ỏ', 0xa3: 'õ', 0xa4: 'ọ',
  0xa5: 'ồ', 0xa6: 'ố', 0xa7: 'ổ', 0xa8: 'ỗ', 0xa9: 'ộ',
  0xaa: 'ờ', 0xab: 'ớ', 0xac: 'ở', 0xad: 'ỡ', 0xae: 'ợ',
  0xaf: 'ù', 0xb0: 'ú', 0xb1: 'ủ', 0xb2: 'ũ', 0xb3: 'ụ',
  0xb4: 'ừ', 0xb5: 'ứ', 0xb6: 'ử', 0xb7: 'ữ', 0xb8: 'ự',
  0xb9: 'ỳ', 0xba: 'ý', 0xbb: 'ỷ', 0xbc: 'ỹ', 0xbd: 'ỵ',
  0xc0: 'À', 0xc1: 'Á', 0xc2: 'Ả', 0xc3: 'Ã', 0xc4: 'Ạ',
  0xc5: 'Ằ', 0xc6: 'Ắ', 0xc7: 'Ẳ', 0xc8: 'Ẵ', 0xc9: 'Ặ',
  0xca: 'Ầ', 0xcb: 'Ấ', 0xcc: 'Ẩ', 0xcd: 'Ẫ', 0xce: 'Ậ',
  0xcf: 'Đ', 0xd0: 'È', 0xd1: 'É', 0xd2: 'Ẻ', 0xd3: 'Ẽ', 0xd4: 'Ẹ',
  0xd5: 'Ề', 0xd6: 'Ế', 0xd7: 'Ể', 0xd8: 'Ễ', 0xd9: 'Ệ',
  0xda: 'Ì', 0xdb: 'Í', 0xdc: 'Ỉ', 0xdd: 'Ĩ', 0xde: 'Ị',
  0xdf: 'Ò', 0xe0: 'Ó', 0xe1: 'Ỏ', 0xe2: 'Õ', 0xe3: 'Ọ',
  0xe4: 'Ồ', 0xe5: 'Ố', 0xe6: 'Ổ', 0xe7: 'Ỗ', 0xe8: 'Ộ',
  0xe9: 'Ờ', 0xea: 'Ớ', 0xeb: 'Ở', 0xec: 'Ỡ', 0xed: 'Ợ',
  0xee: 'Ù', 0xef: 'Ú', 0xf0: 'Ủ', 0xf1: 'Ũ', 0xf2: 'Ụ',
  0xf3: 'Ừ', 0xf4: 'Ứ', 0xf5: 'Ử', 0xf6: 'Ữ', 0xf7: 'Ự',
  0xf8: 'Ỳ', 0xf9: 'Ý', 0xfa: 'Ỷ', 0xfb: 'Ỹ', 0xfc: 'Ỵ',
};

/**
 * Decodes UTF-16BE hex string <0056006900650074...>
 */
function decodeHexUtf16BE(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length - 3; i += 4) {
    const code = parseInt(hex.substring(i, i + 4), 16);
    if (!isNaN(code) && code > 0 && code < 65534) {
      str += String.fromCharCode(code);
    }
  }
  return str;
}

/**
 * Decodes raw buffer with Vietnamese font character mapping
 */
function decodeVnBuffer(buf: Buffer): string {
  let res = '';
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (VN_FONT_CHAR_MAP[b]) {
      res += VN_FONT_CHAR_MAP[b];
    } else if (b >= 32 && b <= 126) {
      res += String.fromCharCode(b);
    } else if (b === 10 || b === 13 || b === 9) {
      res += ' ';
    }
  }
  return res;
}

/**
 * Collapses kerning spaces between individual letters in PDF text
 * e.g. "H o à n g L ê N h ấ t T h ố n g C h í" -> "Hoàng Lê Nhất Thống Chí"
 */
export function collapseKerningSpaces(text: string): string {
  let collapsed = text;
  for (let i = 0; i < 3; i++) {
    collapsed = collapsed.replace(
      /([a-zA-ZàáảãạăắằẳẵặâấầẩẫậđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ])\s+([a-zA-ZàáảãạăắằẳẵặâấầẩẫậđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ])\b/g,
      '$1$2'
    );
  }
  return collapsed.replace(/[ \t]+/g, ' ').trim();
}

/**
 * Validates whether an extracted string is high-quality human readable text or binary noise
 */
export function isValidHumanText(text: string): boolean {
  if (!text || text.trim().length < 15) return false;
  const words = text.match(/[a-zA-ZàáảãạăắằẳẵặâấầẩẫậđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ]{2,}/g) || [];
  return words.length >= 3;
}

/**
 * Extracts and decodes text operands from PDF stream content
 */
function parsePdfStreamText(decompressedBuf: Buffer): string {
  const textSegments: string[] = [];
  const latinStr = decompressedBuf.toString('latin1');

  // Match Tj operator: (string) Tj or <hex> Tj
  const tjRegex = /\((.*?)\)\s*Tj|<([0-9a-fA-F]+)>\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(latinStr)) !== null) {
    if (match[1]) {
      const decoded = decodeVnBuffer(Buffer.from(match[1], 'latin1'));
      if (decoded.trim().length > 0) textSegments.push(decoded);
    } else if (match[2]) {
      const decoded = decodeHexUtf16BE(match[2]);
      if (decoded.trim().length > 0) textSegments.push(decoded);
    }
  }

  // Match TJ operator: [(string1) -10 <hex>] TJ
  const tjArrayRegex = /\[\s*(.*?)\s*\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(latinStr)) !== null) {
    const inner = match[1];
    const elemRegex = /\((.*?)\)|<([0-9a-fA-F]+)>/g;
    let elem: RegExpExecArray | null;
    while ((elem = elemRegex.exec(inner)) !== null) {
      if (elem[1]) {
        const decoded = decodeVnBuffer(Buffer.from(elem[1], 'latin1'));
        if (decoded.trim().length > 0) textSegments.push(decoded);
      } else if (elem[2]) {
        const decoded = decodeHexUtf16BE(elem[2]);
        if (decoded.trim().length > 0) textSegments.push(decoded);
      }
    }
  }

  const rawJoined = textSegments.join(' ');
  return collapseKerningSpaces(rawJoined);
}

/**
 * Main Class: Primary Historical PDF Extractor
 */
export class PdfExtractor {
  /**
   * Resolves canonical metadata for a given PDF filename
   */
  public getMetadata(filePathOrName: string): HistoricalPdfMetadata {
    const baseName = path.basename(filePathOrName, path.extname(filePathOrName)).toLowerCase();

    for (const [key, meta] of Object.entries(HISTORICAL_PDF_REGISTRY)) {
      if (baseName.includes(key) || key.includes(baseName)) {
        return meta;
      }
    }

    const formattedTitle = baseName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      title: formattedTitle,
      author: 'Tác giả Lịch sử',
      sourceReliability: 'LEVEL_1',
      description: 'Tài liệu lịch sử dạng PDF',
    };
  }

  /**
   * Parses PDF buffer into structured page text and complete text
   */
  public extract(pdfBuffer: Buffer, filePathOrName: string): ExtractedPdfResult {
    const meta = this.getMetadata(filePathOrName);
    const pages: PdfPageContent[] = [];
    const textBlocks: string[] = [];

    // Scan stream blocks in PDF buffer
    let pos = 0;
    let pageCount = 0;
    const bufLen = pdfBuffer.length;

    while (pos < bufLen - 6) {
      if (
        pdfBuffer[pos] === 0x73 &&
        pdfBuffer[pos + 1] === 0x74 &&
        pdfBuffer[pos + 2] === 0x72 &&
        pdfBuffer[pos + 3] === 0x65 &&
        pdfBuffer[pos + 4] === 0x61 &&
        pdfBuffer[pos + 5] === 0x6d
      ) {
        let start = pos + 6;
        if (pdfBuffer[start] === 0x0d && pdfBuffer[start + 1] === 0x0a) start += 2;
        else if (pdfBuffer[start] === 0x0a || pdfBuffer[start] === 0x0d) start += 1;

        let end = -1;
        for (let j = start; j < Math.min(bufLen - 9, start + 2000000); j++) {
          if (
            pdfBuffer[j] === 0x65 &&
            pdfBuffer[j + 1] === 0x6e &&
            pdfBuffer[j + 2] === 0x64 &&
            pdfBuffer[j + 3] === 0x73 &&
            pdfBuffer[j + 4] === 0x74 &&
            pdfBuffer[j + 5] === 0x62 && // stream or endstream
            pdfBuffer[j + 6] === 0x65
          ) {
            end = j;
            break;
          }
          if (
            pdfBuffer[j] === 0x65 &&
            pdfBuffer[j + 1] === 0x6e &&
            pdfBuffer[j + 2] === 0x64 &&
            pdfBuffer[j + 3] === 0x73 &&
            pdfBuffer[j + 4] === 0x74 &&
            pdfBuffer[j + 5] === 0x72 &&
            pdfBuffer[j + 6] === 0x65 &&
            pdfBuffer[j + 7] === 0x61 &&
            pdfBuffer[j + 8] === 0x6d
          ) {
            end = j;
            break;
          }
        }

        if (end > start) {
          let realEnd = end;
          if (realEnd > start && pdfBuffer[realEnd - 1] === 0x0a) realEnd--;
          if (realEnd > start && pdfBuffer[realEnd - 1] === 0x0d) realEnd--;

          const rawStreamBuf = pdfBuffer.subarray(start, realEnd);
          let parsedText = '';
          try {
            const decompressed = zlib.inflateSync(rawStreamBuf);
            parsedText = parsePdfStreamText(decompressed);
          } catch (_e) {
            parsedText = parsePdfStreamText(rawStreamBuf);
          }

          if (isValidHumanText(parsedText)) {
            pageCount++;
            pages.push({
              pageNumber: pageCount,
              text: parsedText,
            });
            textBlocks.push(parsedText);
          }
          pos = end + 9;
          continue;
        }
      }
      pos++;
    }

    let fullText = textBlocks.join('\n\n');
    const isScannedPdf = textBlocks.length === 0;

    // If stream parsing yielded no valid text (e.g. Scanned Bitmap PDF or Encrypted PDF)
    if (isScannedPdf) {
      log.warn('pdf.scanned_bitmap_detected', `Detected scanned bitmap PDF for "${meta.title}"; fallback to metadata descriptor`, {
        filePathOrName,
        title: meta.title,
      });
      fullText = `> ⚠️ **Thông tin tệp PDF:** Bộ tác phẩm "${meta.title}" là bản PDF Scan hình ảnh (Bitmap Scanned PDF Document).  \n> **Trạng thái trích xuất:** Tệp chứa ${meta.description} (Cấp độ tin cậy: ${meta.sourceReliability}). Văn bản scan đã được đăng ký vào CSDL Tri thức ChronoViet để liên kết truy vấn GraphRAG. Để nâng cao chất lượng nhận dạng ở cấp toàn bộ từng trang văn bản thô, hệ thống khuyến nghị chạy luồng OCR (Tesseract / NomNaOCR).`;
      pages.push({
        pageNumber: 1,
        text: fullText,
      });
    } else {
      log.info('pdf.stream_extracted', `Extracted text from PDF "${meta.title}" (${pages.length} pages, ${fullText.length} chars)`, {
        filePathOrName,
        title: meta.title,
        pages: pages.length,
        charCount: fullText.length,
      });
    }

    return {
      title: meta.title,
      author: meta.author,
      sourceReliability: meta.sourceReliability,
      text: fullText,
      pages,
      totalPageCount: pages.length || 1,
      isScannedPdf,
    };
  }
}
