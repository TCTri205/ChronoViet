/**
 * ChronoViet - Real-Corpus Stratified Extraction Tool
 * Extracts 60 production child chunks (30 classical chronicles + 30 modern wiki articles)
 * covering all 15 historical epochs (EPOCH_01 -> EPOCH_15) with word count [300, 500].
 */

import fs from 'fs';
import path from 'path';
import { chunkDocumentHierarchical, countWords } from '../../src/chunking/hierarchical-chunker.js';
import { findMonorepoRoot } from '../../src/utils/path-utils.js';
import { findHistoricalEpoch } from '@chronoviet/shared-spec';

const root = findMonorepoRoot(process.cwd());
const corpusDir = path.resolve(root, 'data/processed_corpus');
const chroniclesDir = path.resolve(corpusDir, 'chronicles');
const wikiDir = path.resolve(corpusDir, 'wiki');
const outputJsonPath = path.resolve(root, 'packages/data-ingestion/eval/datasets/real-corpus-chunks-raw.json');

export const EPOCHS = [
  { id: 'EPOCH_01', nameVi: 'Thời kỳ Hùng Vương - Văn Lang & Âu Lạc' },
  { id: 'EPOCH_02', nameVi: 'Thời kỳ Bắc thuộc & Khởi nghĩa Giành Độc lập' },
  { id: 'EPOCH_03', nameVi: 'Thời kỳ Khởi đầu Tự chủ (Ngô - Đinh - Tiền Lê)' },
  { id: 'EPOCH_04', nameVi: 'Thời kỳ Nhà Lý (1009 - 1225)' },
  { id: 'EPOCH_05', nameVi: 'Thời kỳ Nhà Trần (1225 - 1400)' },
  { id: 'EPOCH_06', nameVi: 'Thời kỳ Nhà Hồ (1400 - 1407)' },
  { id: 'EPOCH_07', nameVi: 'Thời kỳ Thuộc Minh & Khởi nghĩa Lam Sơn' },
  { id: 'EPOCH_08', nameVi: 'Thời kỳ Nhà Lê Sơ (1428 - 1527)' },
  { id: 'EPOCH_09', nameVi: 'Thời kỳ Nam Bắc Triều & Trịnh - Nguyễn Phân Tranh' },
  { id: 'EPOCH_10', nameVi: 'Thời kỳ Nhà Tây Sơn (1778 - 1802)' },
  { id: 'EPOCH_11', nameVi: 'Thời kỳ Nhà Nguyễn Độc lập (1802 - 1883)' },
  { id: 'EPOCH_12', nameVi: 'Thời kỳ Kháng Pháp Cận đại (1858 - 1945)' },
  { id: 'EPOCH_13', nameVi: 'Thời kỳ Kháng chiến Chống Pháp (1945 - 1954)' },
  { id: 'EPOCH_14', nameVi: 'Thời kỳ Kháng chiến Chống Mỹ (1954 - 1975)' },
  { id: 'EPOCH_15', nameVi: 'Thời kỳ Đổi Mới & Hiện đại (1975 - Nay)' },
];

export interface ExtractedCorpusChunk {
  id: string;
  epochId: string;
  sourceType: 'CHRONICLE' | 'WIKI';
  sourceDocument: string;
  dynasty: string;
  sectionTitle: string;
  wordCount: number;
  banner: string;
  rawText: string;
  textContent: string;
}

function detectEpochFromChunk(child: any): string {
  const sourceName = (child.metadata?.sourceName || '').toLowerCase();
  const title = (child.metadata?.title || child.title || '').toLowerCase();
  const yrMatch = sourceName.match(/\b(19\d\d|20\d\d)\b/) || title.match(/\b(19\d\d|20\d\d)\b/);
  if (yrMatch) {
    const y = parseInt(yrMatch[1], 10);
    if (y >= 1976 && y <= 2026) return 'EPOCH_15';
    if (y >= 1954 && y <= 1975) return 'EPOCH_14';
    if (y >= 1945 && y <= 1953) return 'EPOCH_13';
    if (y >= 1858 && y <= 1944) return 'EPOCH_12';
    if (y >= 1802 && y <= 1883) return 'EPOCH_11';
  }

  if (child.metadata?.epochIds && child.metadata.epochIds.length > 0) {
    return child.metadata.epochIds[0];
  }
  if (child.metadata?.timeStart) {
    const ep = findHistoricalEpoch(child.metadata.timeStart);
    if (ep) return ep.epochId;
  }
  const dyn = (child.metadata?.dynasty || '').toLowerCase();
  const text = (child.textContent || '').toLowerCase();

  if (/đổi mới|1986|2000|2020|hội nhập|500kv|asean|wto|hiện đại|bình thường hóa|kinh tế thị trường/i.test(dyn) || /đổi mới.*1986|nguyễn văn linh|võ văn kiệt|500kv|bta|wto/i.test(text)) return 'EPOCH_15';
  if (/kháng chiến chống mỹ|đường trường sơn|mậu thân|chiến dịch hồ chí minh|30 tháng 4|sài gòn.*1975|văn tiến dũng|đoàn 559|dương văn minh/i.test(dyn) || /đường trường sơn|dinh độc lập|giải phóng miền nam|mậu thân|văn tiến dũng/i.test(text)) return 'EPOCH_14';
  if (/1945|cách mạng tháng tám|hồ chí minh|ba đình|điện biên phủ|1954|việt minh|kháng chiến chống pháp|võ nguyên giáp/i.test(dyn) || /tuyên ngôn độc lập|điện biên phủ|võ nguyên giáp|ba đình.*1945/i.test(text)) return 'EPOCH_13';
  if (/pháp thuộc|cần vương|trương định|phan đình phùng|hàm nghi|hoàng hoa thám|yên thế|duy tân|đông du|phan bội châu|phan châu trinh/i.test(dyn) || /chống pháp|cần vương|yên thế|phan bội châu|hương khê/i.test(text)) return 'EPOCH_12';
  if (/nhà nguyễn|gia long|minh mạng|thiệu trị|tự đức|triều đình huế/i.test(dyn) || /vua gia long|minh mạng|kinh thành huế|hoàng triều/i.test(text)) return 'EPOCH_11';
  if (/tây sơn|nguyễn huệ|quang trung|nguyễn nhạc|nguyễn lữ|đại phá quân thanh|ngọc hồi|đống đa/i.test(dyn) || /quang trung|nguyễn huệ|ngọc hồi/i.test(text)) return 'EPOCH_10';
  if (/nhà mạc|mạc đăng dung|nam bắc triều|lê trung hưng|chúa trịnh|chúa nguyễn|đàng trong|đàng ngoài/i.test(dyn) || /chúa trịnh|chúa nguyễn|nam hà|bắc hà/i.test(text)) return 'EPOCH_09';
  if (/nhà lê sơ|lê sơ|lê thái tổ|lê thánh tông|hồng đức|đại việt sử ký toàn thư/i.test(dyn) || /lê thái tổ|lê thánh tông|hội tao đàn/i.test(text)) return 'EPOCH_08';
  if (/thuộc minh|hậu trần|khởi nghĩa lam sơn|bình ngô|nguyễn trãi.*lam sơn/i.test(dyn) || /khởi nghĩa lam sơn|vương thông|liễu thăng/i.test(text)) return 'EPOCH_07';
  if (/nhà hồ|hồ quý ly|thành tây đô|hồ hán thương/i.test(dyn) || /hồ quý ly|thành tây đô|đại ngu/i.test(text)) return 'EPOCH_06';
  if (/nhà trần|triều trần|trần hưng đạo|trần thái tông|trần thánh tông|trần nhân tông|bạch đằng 1288|nguyên mông/i.test(dyn) || /trần hưng đạo|hội nghị diên hồng|bình than/i.test(text)) return 'EPOCH_05';
  if (/nhà lý|triều lý|lý thái tổ|lý thường kiệt|lý thái tông|lý thánh tông|lý nhân tông/i.test(dyn) || /lý công uẩn|thăng long.*1010|như nguyệt/i.test(text)) return 'EPOCH_04';
  if (/nhà ngô|ngô quyền|12 sứ quân|nhà đinh|đinh tiên hoàng|đinh bộ lĩnh|nhà tiền lê|lê đại hành|lê hoàn/i.test(dyn) || /ngô quyền|đinh bộ lĩnh|lê hoàn|hoa lư/i.test(text)) return 'EPOCH_03';
  if (/bắc thuộc|trưng nữ vương|hai bà trưng|bà triệu|lý nam đế|vạn xuân|mai hắc đế|phùng hưng|khúc thừa dụ/i.test(dyn) || /hai bà trưng|triệu ẩu|lý bí|vạn xuân|mai thúc loan/i.test(text)) return 'EPOCH_02';
  if (/hùng vương|văn lang|âu lạc|an dương vương|cổ loa|đông sơn/i.test(dyn) || /hùng vương|văn lang|âu lạc|an dương vương/i.test(text)) return 'EPOCH_01';

  return 'EPOCH_01';
}

export function extractStratifiedCorpusChunks(): ExtractedCorpusChunk[] {
  console.log('===============================================================');
  console.log(' CHRONOVIET REAL-CORPUS STRATIFIED CHUNK EXTRACTOR');
  console.log(' Target: 60 Production Chunks | 15 Epochs (30 Chronicle + 30 Wiki)');
  console.log(' Word Bounds: [300, 500] Words per Child Chunk');
  console.log('===============================================================\n');

  if (!fs.existsSync(corpusDir)) {
    throw new Error(`Corpus directory not found: ${corpusDir}`);
  }

  const chronicleFiles = fs.existsSync(chroniclesDir)
    ? fs.readdirSync(chroniclesDir).filter((f) => f.endsWith('.md')).map((f) => path.join(chroniclesDir, f))
    : [];

  const wikiFiles = fs.existsSync(wikiDir)
    ? fs.readdirSync(wikiDir).filter((f) => f.endsWith('.md')).map((f) => path.join(wikiDir, f))
    : [];

  console.log(`[*] Found ${chronicleFiles.length} classical chronicle files and ${wikiFiles.length} wiki files.`);

  // Process all files and group candidate child chunks by epoch and source type
  const chunksByEpoch: Record<string, { chronicle: ExtractedCorpusChunk[]; wiki: ExtractedCorpusChunk[] }> = {};
  for (const ep of EPOCHS) {
    chunksByEpoch[ep.id] = { chronicle: [], wiki: [] };
  }

  function processFileList(files: string[], sourceType: 'CHRONICLE' | 'WIKI') {
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const filename = path.basename(filePath);
      const docTitle = filename.replace(/\.md$/, '').replace(/-/g, ' ');

      const reliability = sourceType === 'CHRONICLE' ? 'LEVEL_1' : 'LEVEL_2';
      const chunkResult = chunkDocumentHierarchical(content, {
        title: docTitle,
        sourceName: filename,
        sourceReliability: reliability,
      });

      for (const child of chunkResult.childChunks) {
        const wCount = child.wordCount;
        if (wCount < 280 || wCount > 520) continue;

        const epochId = detectEpochFromChunk({ ...child, metadata: { ...child.metadata, sourceName: filename } });
        if (!chunksByEpoch[epochId]) continue;

        // Split macro-banner and raw text
        const bannerMatch = child.textContent.match(/^(\[[^\]]+\](?:\s+\[[^\]]+\])*)\n\n([\s\S]+)$/);
        const banner = bannerMatch ? bannerMatch[1] : `[Sử Liệu: ${docTitle}] [Kỷ/Triều Đại: ${child.metadata?.dynasty || 'Lịch Sử Việt Nam'}]`;
        const rawBody = bannerMatch ? bannerMatch[2] : child.textContent;

        const item: ExtractedCorpusChunk = {
          id: `CHUNK_${epochId}_${sourceType}_${child.id}`,
          epochId,
          sourceType,
          sourceDocument: docTitle,
          dynasty: child.metadata?.dynasty || 'Việt Nam',
          sectionTitle: child.title || docTitle,
          wordCount: countWords(rawBody),
          banner,
          rawText: rawBody,
          textContent: child.textContent,
        };

        if (sourceType === 'CHRONICLE') {
          chunksByEpoch[epochId].chronicle.push(item);
        } else {
          chunksByEpoch[epochId].wiki.push(item);
        }
      }
    }
  }

  processFileList(chronicleFiles, 'CHRONICLE');
  processFileList(wikiFiles, 'WIKI');

  const selectedChunks: ExtractedCorpusChunk[] = [];

  for (const ep of EPOCHS) {
    const pool = chunksByEpoch[ep.id];
    console.log(` • ${ep.id} (${ep.nameVi}): ${pool.chronicle.length} Chronicle chunks, ${pool.wiki.length} Wiki chunks available`);

    // Target 4 chunks per epoch
    const selectedChron = pool.chronicle.slice(0, 2);
    const selectedWiki = pool.wiki.slice(0, 2);

    if (selectedChron.length < 2 && pool.wiki.length > 2) {
      selectedWiki.push(...pool.wiki.slice(2, 4 - selectedChron.length));
    } else if (selectedWiki.length < 2 && pool.chronicle.length > 2) {
      selectedChron.push(...pool.chronicle.slice(2, 4 - selectedWiki.length));
    }

    const epochSelected = [...selectedChron, ...selectedWiki].slice(0, 4);
    selectedChunks.push(...epochSelected);
  }

  console.log(`\n[+] Successfully extracted ${selectedChunks.length} stratified production chunks!`);
  const avgWords = Math.round(selectedChunks.reduce((acc, c) => acc + c.wordCount, 0) / (selectedChunks.length || 1));
  console.log(`[+] Average word count: ${avgWords} words (Target: [300, 500])\n`);

  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.writeFileSync(outputJsonPath, JSON.stringify(selectedChunks, null, 2), 'utf-8');
  console.log(`[+] Saved raw production chunks to: ${outputJsonPath}\n`);

  return selectedChunks;
}

if (process.argv[1]?.includes('extract-real-corpus-chunks')) {
  extractStratifiedCorpusChunks();
}
