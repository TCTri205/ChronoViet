/**
 * Dynamic Hierarchical Temporal Chunking Engine for Historical Texts
 */

export interface ChunkMetadata {
  title: string;
  dynasty?: string;
  sourceReliability: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  timeStart?: number;
  timeEnd?: number;
  keyFigures: string[];
  location?: string;
  pageNumber?: number;
  parentChunkId?: string;
}

export interface ProcessedChunk {
  id: string;
  title: string;
  textContent: string;
  isParent: boolean;
  metadata: ChunkMetadata;
}

const HISTORICAL_YEAR_REGEX = /\b(năm|vào năm|thời gian)\s+(\d{3,4})\b/gi;
const DYNASTY_KEYWORDS: Record<string, string> = {
  'tây sơn': 'Nhà Tây Sơn',
  'lê sơ': 'Nhà Lê',
  'lê trung hưng': 'Nhà Lê',
  'nhà nguyễn': 'Triều Nguyễn',
  'nhà trần': 'Nhà Trần',
  'nhà lý': 'Nhà Lý',
  'nhà ngô': 'Nhà Ngô',
  'nhà đinh': 'Nhà Đinh',
  'tiền lê': 'Nhà Tiền Lê',
  'kháng chiến chống pháp': 'Thời kỳ Hiện đại',
  'kháng chiến chống mỹ': 'Thời kỳ Hiện đại',
};

/**
 * Extracts approximate start and end years from chunk text content
 */
export function extractTimeBounds(text: string): { timeStart?: number; timeEnd?: number } {
  const years: number[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(HISTORICAL_YEAR_REGEX);
  while ((match = regex.exec(text)) !== null) {
    const yr = parseInt(match[2], 10);
    if (yr >= 100 && yr <= 2026) {
      years.push(yr);
    }
  }
  if (years.length === 0) return {};
  years.sort((a, b) => a - b);
  return {
    timeStart: years[0],
    timeEnd: years[years.length - 1],
  };
}

/**
 * Detects Dynasty from document content
 */
export function detectDynasty(text: string): string | undefined {
  const norm = text.toLowerCase();
  for (const [key, dynastyName] of Object.entries(DYNASTY_KEYWORDS)) {
    if (norm.includes(key)) {
      return dynastyName;
    }
  }
  return undefined;
}

/**
 * Splits text into paragraphs/sections
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Chunks a historical document into Parent (2000-3000 words) and Child (300-500 words) chunks
 */
export function chunkDocument(
  text: string,
  docMetadata: {
    title: string;
    dynasty?: string;
    sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
    pageNumber?: number;
    keyFigures?: string[];
    location?: string;
  }
): { parentChunks: ProcessedChunk[]; childChunks: ProcessedChunk[] } {
  const paragraphs = splitParagraphs(text);
  const parentChunks: ProcessedChunk[] = [];
  const childChunks: ProcessedChunk[] = [];

  let currentParentParagraphs: string[] = [];
  let currentParentWordCount = 0;
  let parentIndex = 1;

  const docDynasty = docMetadata.dynasty || detectDynasty(text) || 'Chưa xác định';
  const reliability = docMetadata.sourceReliability || 'LEVEL_1';

  // Step 1: Create Parent Chunks (~1500-2500 words)
  const flushParent = () => {
    if (currentParentParagraphs.length === 0) return;
    const parentContent = currentParentParagraphs.join('\n\n');
    const parentId = `parent_chunk_${Date.now()}_${parentIndex}`;
    const bounds = extractTimeBounds(parentContent);

    const parentChunk: ProcessedChunk = {
      id: parentId,
      title: `${docMetadata.title} (Phần ${parentIndex})`,
      textContent: parentContent,
      isParent: true,
      metadata: {
        title: docMetadata.title,
        dynasty: docDynasty,
        sourceReliability: reliability,
        timeStart: bounds.timeStart,
        timeEnd: bounds.timeEnd,
        keyFigures: docMetadata.keyFigures || [],
        location: docMetadata.location,
        pageNumber: docMetadata.pageNumber,
      },
    };
    parentChunks.push(parentChunk);

    // Step 2: Split Parent Chunk into Child Chunks (~200-400 words)
    const words = parentContent.split(/\s+/);
    const childTargetWords = 350;
    let childIndex = 1;

    for (let i = 0; i < words.length; i += childTargetWords) {
      const childWords = words.slice(i, i + childTargetWords);
      const childText = childWords.join(' ');
      const childBounds = extractTimeBounds(childText);
      const childId = `${parentId}_child_${childIndex}`;

      childChunks.push({
        id: childId,
        title: `${docMetadata.title} - Đoạn ${parentIndex}.${childIndex}`,
        textContent: childText,
        isParent: false,
        metadata: {
          title: docMetadata.title,
          dynasty: docDynasty,
          sourceReliability: reliability,
          timeStart: childBounds.timeStart || bounds.timeStart,
          timeEnd: childBounds.timeEnd || bounds.timeEnd,
          keyFigures: docMetadata.keyFigures || [],
          location: docMetadata.location,
          pageNumber: docMetadata.pageNumber,
          parentChunkId: parentId,
        },
      });
      childIndex++;
    }

    parentIndex++;
    currentParentParagraphs = [];
    currentParentWordCount = 0;
  };

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;
    if (currentParentWordCount + words > 2000 && currentParentParagraphs.length > 0) {
      flushParent();
    }
    currentParentParagraphs.push(para);
    currentParentWordCount += words;
  }
  flushParent();

  return { parentChunks, childChunks };
}
