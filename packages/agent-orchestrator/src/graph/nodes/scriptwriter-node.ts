/**
 * Micro-Step 1A: Scriptwriter Agent Node
 * Generates compelling voiceover narration while preserving cross-chapter narrative flow
 */

import { callLlm, envConfig } from '@chronoviet/infra';
import {
  HISTORICAL_CHRONOLOGY,
  removeVietnameseTones,
  sanitizeSentenceBoundaries,
  getTargetWpm,
  NarrativeLedger,
  VideoType,
} from '@chronoviet/shared-spec';
import { ChronoGraphState, getNodeLogger, RunningNarrativeState, TelemetryAuditEntry } from '../state.js';
import { deduplicateRepetitiveText } from '../../guardrails/stream-dedup.js';
import { extractHistoricalEntitiesFromRag, isValidHistoricalEntity, cleanCrawlerText, canonicalizeEntityList } from './chaptering-node.js';

export function sanitizeVoiceoverScript(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText
    // Remove markdown code fences (e.g. ```markdown ... ```)
    .replace(/^```[a-z]*\s*[\r\n]+/i, '')
    .replace(/[\r\n]+```\s*$/i, '')
    // Remove enclosing triple or double quotes
    .replace(/^"{1,3}\s*[\r\n]*/, '')
    .replace(/[\r\n]*"{1,3}\s*$/, '')
    // Remove direction / sound tags
    .replace(/\[(?:Nhạc|Cảnh|Hình ảnh|Hiệu ứng|Âm thanh|Voiceover).*?\]/gi, '')
    .replace(/\((?:Giọng|Cười|Hào hùng|Trầm lắng|Thì thầm|Bi tráng).*?\)/gi, '')
    // Remove speaker labels
    .replace(/^(?:MC|Người dẫn chuyện|Lời bình|Host)\s*:\s*/gim, '')
    // Remove markdown headers like #, ##, ###
    .replace(/^#{1,4}\s+.*$/gm, '')
    // Remove Wikipedia section headers like == Header == or === Subheader ===
    .replace(/={2,5}[^=\n]+={2,5}/g, '')
    // Remove Wikipedia citation and reference tags like [1], [2], [cần dẫn nguồn]
    .replace(/\[\d+\]/g, '')
    .replace(/\[(?:cần dẫn nguồn|nguồn|sđd|tr\.)[^\]]*\]/gi, '')
    // Remove bold/markdown section labels like **Hồi 1 - Mở cảnh:** or Hồi 1: or Mở cảnh:
    .replace(/(?:^|[ \t]+)(?:\*{1,3})?(?:Hồi|Phần|Chương|Đoạn)\s*\d+[^\n*:]*(?::[^\n*]*\*\*|\*\*:?|[:–—\-])\s*/gim, ' ')
    .replace(/^[ \t]*(?:\*{1,3})?(?:Hồi|Phần|Chương|Đoạn)\s*\d+[^\n]*$/gim, '')
    .replace(/(?:^|[ \t]+)(?:\*{1,3})?(?:Mở cảnh|Mở đầu|Diễn biến(?:\s*&\s*Cao trào)?|Cao trào|Đúc kết|Dư âm(?:\s*&\s*Bài học)?|Bài học)[^\n*:]*(?::[^\n*]*\*\*|\*\*:?|[:–—\-])\s*/gim, ' ')
    .replace(/^[ \t]*(?:\*{1,3})?(?:Mở cảnh|Mở đầu|Diễn biến(?:\s*&\s*Cao trào)?|Cao trào|Đúc kết|Dư âm(?:\s*&\s*Bài học)?|Bài học)[^\n]*$/gim, '')
    // Remove prompt artifact leakage (e.g. "(2 câu, 44 từ)", "(~50 từ)", "(đúng 3 câu, 50 từ)")
    .replace(/\([^)]*\d+\s*(?:câu|từ)[^)]*\)/gi, '')
    // Remove structural prompt tags (e.g. "(Entry Hook)", "(Climax Focus)", "(Exit Hook)", "(Mở cảnh)", "(Cao trào)", "(Dư âm)")
    .replace(/\((?:Entry Hook|Climax Focus|Exit Hook|Mở đầu|Mở cảnh|Diễn biến|Cao trào|Đúc kết|Dư âm|Bài học)[^)]*\)/gi, '')
    // Remove leaked meta-prompt instructions and prompt blueprint echoes
    .replace(/(?:^|[.!?\s]+)Khắc họa ý nghĩa thời đại[^\n.!?]*?(?:theo exit hook|bài học lịch sử)[^\n.!?]*[.!?]?/gi, ' ')
    .replace(/(?:^|[.!?\s]+)(?:Dẫn dắt không gian, thời gian|Miêu tả chi tiết mưu lược|Đoạn đúc kết & dư âm|chuyển tiếp mượt mà theo exit hook)[^\n.!?]*[.!?]?/gi, ' ')
    .replace(/\b(?:theo exit hook|theo entry hook|theo blueprint)\b/gi, '')
    // Remove leading standalone tone markers like "Hào hùng, trang trọng." or "Hào hùng."
    .replace(/^(?:\*{1,3})?(?:Hào hùng|Trang trọng|Hùng tráng|Trầm lắng|Bi tráng)(?:,\s*(?:trang trọng|hào hùng|sâu lắng))?[.:]?(?:\*{1,3})?\s*/gim, '')
    // Remove markdown bold/italic tags around remaining standalone section names
    .replace(/\*\*(?:Bối cảnh|Diễn biến|Chiến lược|Dư âm|Kết luận)\*\*:?\s*/gi, '')
    // Remove Chinese characters (Hanzi) that may leak from multilingual LLM outputs
    .replace(/[\u4e00-\u9fa5]+/g, '')
    // Remove accidental prompt instruction leakage at the very start
    .replace(/^(?:Khởi nguồn từ bối cảnh [^,.\n]+ của )?(?:Kể lại|Hãy kể|Trình bày|Hãy trình bày|Tóm tắt|Phân tích|Viết về|Hãy viết về)\s+[^,.\n]+(?:,\s*|[.:]\s*)/i, '')
    // Strip dangling enclosing quotes
    .replace(/^["“”'«»]+|["“”'«»]+$/g, '')
    .trim();

  // Remove trailing incomplete transition phrases or connector prompts
  cleaned = cleaned
    .replace(/(?:Tiếp theo là|Mối nối chuyển cảnh:?|Chuyển sang hồi tiếp theo:?|Tiếp tục diễn biến:?)\s*$/gi, '')
    .trim();

  // Remove dangling truncated date or preposition tails (e.g. "vào năm 1.", "vào năm 19.", "tại.")
  cleaned = cleaned
    .replace(/(?:,\s*|\s+)(?:vào\s+năm\s+\d{1,3}|năm\s+\d{1,2}|tháng\s+\d{1,2}|ngày\s+\d{1,2}|vào\s+|tại\s+|trong\s+|khi\s+|do\s+|vì\s+|bởi\s+|và\s+|hoặc\s+|nhưng\s+|rồi\s+|với\s+)[.!?]?\s*$/gi, '.')
    .trim();

  // Trim dangling incomplete sentence if truncated without terminal punctuation
  if (cleaned.length > 30 && !/[.!?]["”']?\s*$/.test(cleaned)) {
    const lastPunct = Math.max(
      cleaned.lastIndexOf('.'),
      cleaned.lastIndexOf('!'),
      cleaned.lastIndexOf('?')
    );
    if (lastPunct > 20) {
      cleaned = cleaned.slice(0, lastPunct + 1).trim();
    } else {
      cleaned = `${cleaned}.`;
    }
  }

  // Deduplicate repeated sentences and paragraphs
  cleaned = deduplicateRepetitiveText(cleaned);

  // Clean sentence boundaries (strips trailing cutoffs, ensures terminal punctuation)
  cleaned = sanitizeSentenceBoundaries(cleaned);

  return cleaned.trim();
}

export function stripChapterTitleEcho(text: string, title?: string): string {
  if (!text || !title) return text;
  let s = text.trim();
  const lowerTitle = title.toLowerCase().trim();
  if (s.toLowerCase().startsWith(lowerTitle)) {
    s = s.slice(title.length).replace(/^[:–—\-.\s]+/, '').trim();
  }
  const firstSentenceMatch = s.match(/^([^.!?\n]+[.!?\n]?)/);
  if (firstSentenceMatch) {
    const firstSentenceText = firstSentenceMatch[1].replace(/[.!?\n]/g, '').trim().toLowerCase();
    if (firstSentenceText === lowerTitle || (lowerTitle.includes(firstSentenceText) && firstSentenceText.length >= 10)) {
      s = s.slice(firstSentenceMatch[0].length).trim();
    }
  }
  return s;
}

export function normalizeHistoricalAnachronisms(text: string, epochKey?: string): string {
  if (!text) return text;
  // Anachronism correction is bounded to 18th century Tây Sơn era contexts
  // to avoid corrupting 20th century modern history (e.g. 1946, 1972)
  const isTaySonContext =
    epochKey === 'EPOCH_TAY_SON' ||
    /tây\s+sơn|quang\s+trung|nguyễn\s+huệ|ngọc\s+hồi|đống\s+đa|kỷ\s+dậu\s+1789|chiến\s+dịch\s+1789|xuân\s+1789/i.test(
      text
    );

  if (isTaySonContext) {
    return text
      .replace(/\bquân Hà Nội\b/gi, 'nghĩa quân Tây Sơn')
      .replace(/\bquân đội Hà Nội\b/gi, 'nghĩa quân Tây Sơn')
      .replace(/\bchính quyền Hà Nội\b/gi, 'triều đình Tây Sơn');
  }

  return text;
}

export function synthesizeDeterministicHistoricalScript(
  chapterTitle: string,
  chapterSummary: string,
  selectedChunks: any[],
  targetDurationSeconds: number,
  targetWpm = 205
): string {
  const sentences: string[] = [];
  const seenFingerprints = new Set<string>();

  function getFingerprint(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9à-ỹ]/g, '');
  }

  function addSentence(s: string): boolean {
    const cleanS = sanitizeSentenceBoundaries(normalizeHistoricalAnachronisms(s.trim()));
    if (!cleanS || cleanS.length < 15) return false;
    const fp = getFingerprint(cleanS);
    if (!fp || seenFingerprints.has(fp)) return false;

    // Check near-duplicate substring overlap with existing sentences
    for (const existingFp of seenFingerprints) {
      if (existingFp.includes(fp) || fp.includes(existingFp)) {
        return false;
      }
    }

    seenFingerprints.add(fp);
    sentences.push(cleanS);
    return true;
  }

  const targetWords = Math.max(20, Math.round((targetDurationSeconds / 60) * targetWpm));
  const maxWords = Math.round(targetWords * 1.12);

  // 1. Chapter context from verified outline summary
  if (chapterSummary && chapterSummary.trim()) {
    const cleanChapterSummary = sanitizeSentenceBoundaries(chapterSummary.trim());
    if (cleanChapterSummary) {
      // Strip any raw entity tag prefix (e.g. "Đảng Cộng sản Việt Nam: ...")
      const stripped = cleanChapterSummary.replace(/^[A-ZÀ-Ỹa-zà-ỹ0-9\s]{2,40}:\s*/, '');
      addSentence(stripped || cleanChapterSummary);
    }
  }

  // 2. Verified historical facts from RAG chunks, filtered to narrative prose and strictly length-bounded
  let currentWords = sentences.join(' ').split(/\s+/).filter(Boolean).length;

  for (const chunk of selectedChunks) {
    if (currentWords >= targetWords) break;
    const summary = cleanCrawlerText(chunk.summary || chunk.content || '');
    if (!summary) continue;

    const rawSentences = summary
      .replace(/["“”'‘’]/g, '')
      .replace(/Theo (?:Tập sử liệu|sách|bản ghi|tư liệu).*?:/gi, '')
      .split(/(?<=[.!?])\s+/)
      .map((s: string) => s.trim())
      .filter((s: string) => {
        if (s.length < 15 || s.startsWith('#') || /^(?:Than ôi|Nguyên trước|Bấy giờ|Sử thần)/i.test(s)) return false;
        const cleanedTail = s.replace(/(?:,\s*|\s+)(?:vào\s+năm\s+\d{1,3}|năm\s+\d{1,2}|tháng\s+\d{1,2}|vào|tại|trong|khi|do|vì|bởi|và|hoặc|nhưng|rồi|với)[.!?]?\s*$/gi, '');
        return /[.!?]$/.test(cleanedTail);
      })
      .map((s: string) => {
        return s
          .replace(/(?:,\s*|\s+)(?:vào\s+năm\s+\d{1,3}|năm\s+\d{1,2}|tháng\s+\d{1,2}|ngày\s+\d{1,2}|vào|tại|trong|khi|do|vì|bởi|và|hoặc|nhưng|rồi|với)[.!?]?\s*$/gi, '.')
          .trim();
      });

    for (const s of rawSentences) {
      const sWords = s.split(/\s+/).filter(Boolean).length;
      if (currentWords + sWords <= maxWords) {
        if (addSentence(s)) {
          currentWords += sWords;
        }
      }
      if (currentWords >= targetWords) break;
    }
  }

  // 3. Fallback narrative enrichment if still below target words
  if (sentences.length === 0 || currentWords < Math.round(targetWords * 0.75)) {
    const historicalEnrichment = `Giai đoạn này không chỉ khẳng định tầm vóc lịch sử của ${chapterTitle}, mà còn để lại bài học sâu sắc cho hậu thế trong sự nghiệp dựng nước và giữ nước.`;
    if (addSentence(historicalEnrichment)) {
      currentWords += historicalEnrichment.split(/\s+/).filter(Boolean).length;
    }
  }

  const combinedScript = deduplicateRepetitiveText(sentences.join(' '));
  return sanitizeSentenceBoundaries(normalizeHistoricalAnachronisms(combinedScript));
}

function computeEpochBounds(
  verifiedEntities: any[],
  userPrompt: string,
  stateEpoch?: string
): { epochDesc: string; minYear?: number; maxYear?: number } {
  function formatYear(y: number): string {
    return y < 0 ? `${Math.abs(y)} TCN` : `năm ${y}`;
  }

  // 1. If stateEpoch is provided, match against HISTORICAL_CHRONOLOGY using removeVietnameseTones
  let foundEpoch: any;
  if (stateEpoch) {
    const norm = removeVietnameseTones(stateEpoch).toLowerCase().replace(/[^a-z0-9]/g, '');
    foundEpoch = HISTORICAL_CHRONOLOGY.find((e) => {
      const eNorm = removeVietnameseTones(e.name).toLowerCase().replace(/[^a-z0-9]/g, '');
      const dNorm = removeVietnameseTones(e.dynastyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const idNorm = e.epochId.toLowerCase().replace(/[^a-z0-9]/g, '');
      const dynIdNorm = (e.dynastyId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        eNorm.includes(norm) ||
        dNorm.includes(norm) ||
        idNorm === norm ||
        dynIdNorm === norm ||
        dynIdNorm.includes(norm)
      );
    });
  }

  // 2. Also check if userPrompt matches any epoch name or dynasty name in HISTORICAL_CHRONOLOGY
  if (!foundEpoch) {
    const promptNorm = removeVietnameseTones(userPrompt).toLowerCase();
    foundEpoch = HISTORICAL_CHRONOLOGY.find((e) => {
      const eName = removeVietnameseTones(e.name).toLowerCase();
      const dName = removeVietnameseTones(e.dynastyName || '').toLowerCase();
      return promptNorm.includes(eName) || (dName && promptNorm.includes(dName));
    });
  }

  const timeStarts = (verifiedEntities || [])
    .map((e) => e.timeStart)
    .filter((t): t is number => typeof t === 'number' && t <= 2000);
  const timeEnds = (verifiedEntities || [])
    .map((e) => e.timeEnd)
    .filter((t): t is number => typeof t === 'number' && t <= 2000);
  const allYears = [...timeStarts, ...timeEnds];
  const dynasties = Array.from(
    new Set((verifiedEntities || []).map((e) => e.dynasty).filter((d) => d && !d.includes('-') && !d.includes('–')))
  );

  let minYear = allYears.length > 0 ? Math.min(...allYears) : undefined;
  let maxYear = allYears.length > 0 ? Math.max(...allYears) : undefined;

  // Fallback: extract year from userPrompt if present
  if (minYear === undefined) {
    const yearMatch = userPrompt.match(/\b(1?\d{3,4})\b/);
    if (yearMatch) {
      const yr = parseInt(yearMatch[1], 10);
      if (yr >= 100 && yr <= 2000) {
        minYear = yr;
        maxYear = yr;
      }
    }
  }

  let epochDesc = '';
  if (foundEpoch) {
    minYear = minYear !== undefined ? Math.min(minYear, foundEpoch.startYear) : foundEpoch.startYear;
    maxYear = maxYear !== undefined ? Math.max(maxYear, foundEpoch.endYear) : foundEpoch.endYear;
    epochDesc = `${foundEpoch.name} (${formatYear(foundEpoch.startYear)} – ${formatYear(foundEpoch.endYear)})`;
  } else if (minYear !== undefined && maxYear !== undefined) {
    epochDesc =
      minYear === maxYear
        ? minYear < 0
          ? `${Math.abs(minYear)} TCN`
          : `Năm ${minYear}`
        : `Giai đoạn ${formatYear(minYear)} – ${formatYear(maxYear)}`;
  }
  if (dynasties.length > 0 && !epochDesc.includes(dynasties[0])) {
    epochDesc += epochDesc
      ? ` (Triều đại: ${dynasties.join(', ')})`
      : `Triều đại: ${dynasties.join(', ')}`;
  }
  if (!epochDesc) {
    epochDesc = `Bối cảnh lịch sử chính thống của chủ đề "${userPrompt}"`;
  }

  return { epochDesc, minYear, maxYear };
}

export function getDomainChapterRoleGuidance(
  videoType: VideoType | string | undefined,
  isFirstChapter: boolean,
  isLastChapter: boolean,
  isMultiChapter: boolean
): string {
  if (!isMultiChapter) {
    if (videoType === 'BIOGRAPHY') {
      return `VAI TRÒ NGHỆ THUẬT: TOÀN BỘ CUỘC ĐỜI & SỰ NGHIỆP (CHƯƠNG ĐƠN)
- Đoạn mở đầu (~30% số từ): Nguồn cội gia đình, bối cảnh thời cuộc và lý tưởng ban đầu.
- Đoạn diễn biến (~50% số từ): Hành trình cống hiến, vượt qua gian nan và những dấu ấn, đóng góp lớn nhất.
- Đoạn đúc kết (~20% số từ): Tầm vóc lịch sử, nhân cách và di sản trường tồn.`;
    }
    if (videoType === 'ARTIFACT') {
      return `VAI TRÒ NGHỆ THUẬT: TOÀN BỘ HÀNH TRÌNH DI SẢN (CHƯƠNG ĐƠN)
- Đoạn mở đầu (~30% số từ): Nguồn gốc ra đời, niên đại khảo cổ và kỹ thuật chế tác.
- Đoạn diễn biến (~50% số từ): Ý nghĩa biểu tượng hoa văn, đời sống văn hóa - tâm linh đương thời.
- Đoạn đúc kết (~20% số từ): Phát hiện khảo cổ, giá trị bảo vật quốc gia và bản sắc dân tộc.`;
    }
    if (videoType === 'DYNASTY') {
      return `VAI TRÒ NGHỆ THUẬT: TOÀN CẢNH TRIỀU ĐẠI (CHƯƠNG ĐƠN)
- Đoạn mở đầu (~30% số từ): Tiền đề thành lập vương triều, định đô và khai mở vận nước.
- Đoạn diễn biến (~50% số từ): Thời kỳ thịnh trị, cải cách chính trị - văn hóa và chiến công giữ nước.
- Đoạn đúc kết (~20% số từ): Chuyển giao lịch sử và bài học trị quốc để lại cho ngàn đời.`;
    }
    if (videoType === 'MYSTERY') {
      return `VAI TRÒ NGHỆ THUẬT: TOÀN BỘ KỲ ÁN & BÍ ẨN (CHƯƠNG ĐƠN)
- Đoạn mở đầu (~30% số từ): Hiện trường vụ việc, bối cảnh và mâu thuẫn châm ngòi bí ẩn.
- Đoạn diễn biến (~50% số từ): Các manh mối, uẩn khúc cung đình và giả thuyết tranh luận.
- Đoạn đúc kết (~20% số từ): Sự thật sáng tỏ, bài học về nhân tâm và công lý lịch sử.`;
    }
    return `VAI TRÒ NGHỆ THUẬT: TOÀN BỘ MẠCH TRUYỆN (CHƯƠNG ĐƠN)
- Đoạn mở đầu (~30% số từ): Bối cảnh, nguyên nhân và phát động phong trào.
- Đoạn diễn biến & cao trào (~50% số từ): Các trận đánh khốc liệt, mưu lược và đòn quyết định.
- Đoạn đúc kết (~20% số từ): Thắng lợi, bài học lịch sử và di sản trường tồn.`;
  }

  if (isFirstChapter) {
    if (videoType === 'BIOGRAPHY') {
      return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG MỞ ĐẦU (THÂN THẾ, XUẤT THÂN & HOÀI BÃO)
- Đoạn mở đầu (~35% số từ): Nguồn cội gia đình, quê hương, bối cảnh thời cuộc thời niên thiếu theo entry hook.
- Đoạn diễn biến (~45% số từ): Những năm tháng trưởng thành, biến cố đầu đời định hình nhân cách và chí hướng.
- Đoạn chuyển tiếp (~20% số từ): Bước ngoặt dấn thân, mở ra chặng đường cống hiến đầy chông gai phía trước.
- QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG kể trước đỉnh cao sự nghiệp, thành tựu lớn hay sự ra đi ở cuối đời của nhân vật.`;
    }
    if (videoType === 'ARTIFACT') {
      return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG MỞ ĐẦU (NGUỒN GỐC & ĐỈNH CAO CHẾ TÁC)
- Đoạn mở đầu (~35% số từ): Không gian văn hóa, niên đại khảo cổ và bối cảnh xuất hiện của hiện vật theo entry hook.
- Đoạn diễn biến (~45% số từ): Kỹ thuật đúc/chế tác tinh xảo, tài hoa và trí tuệ của các nghệ nhân cổ xưa.
- Đoạn chuyển tiếp (~20% số từ): Vẻ đẹp hoàn mỹ của hiện vật, mở ra hành trình khám phá các tầng biểu tượng văn hóa.
- QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG kể trước việc khai quật/phát hiện khảo cổ thời hiện đại ở chương 1.`;
    }
    if (videoType === 'DYNASTY') {
      return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG MỞ ĐẦU (LẬP TRIỀU, ĐỊNH ĐÔ & KHAI MỞ VẬN NƯỚC)
- Đoạn mở đầu (~35% số từ): Bối cảnh thời thế, khủng hoảng tiền triều và tiền đề lập vương triều mới theo entry hook.
- Đoạn diễn biến (~45% số từ): Sự kiện định đô hoặc chuyển giao quyền lực lịch sử, đặt nền móng thể chế.
- Đoạn chuyển tiếp (~20% số từ): Khai mở vận nước mới, sẵn sàng cho công cuộc kiến thiết quốc gia.
- QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG kể trước sự suy vong của triều đại.`;
    }
    if (videoType === 'MYSTERY') {
      return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG MỞ ĐẦU (BIẾN CỐ BẤT NGỜ & HIỆN TRƯỜNG BÍ ẨN)
- Đoạn mở đầu (~35% số từ): Bối cảnh lịch sử, hiện trường vụ việc và sự kiện châm ngòi bí ẩn theo entry hook.
- Đoạn diễn biến (~45% số từ): Biến cố bất ngờ xảy ra, các nhân vật trung tâm và mâu thuẫn ban đầu.
- Đoạn chuyển tiếp (~20% số từ): Nỗi bàng hoàng của triều đình/dân chúng, mở ra những nghi vấn chưa có lời giải.
- QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG tiết lộ kết luận hay sự thật minh oan ở chương 1.`;
    }
    return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG MỞ ĐẦU (BỐI CẢNH & KHỞI PHÁT)
- Đoạn mở đầu (~35% số từ): Dẫn dắt không gian, thời gian, nguồn cơn áp bức, nguyên nhân phẫn uất và ý chí kiên cường theo entry hook.
- Đoạn diễn biến & bùng nổ (~45% số từ): Tụ nghĩa tập hợp lực lượng, truyền hịch/lời thề xuất quân, khí thế quật khởi sục sôi.
- Đoạn chuyển tiếp (~20% số từ): Toàn quân rầm rộ tiến binh, mở đầu trang sử hào hùng, sẵn sàng cho các trận đánh tiếp theo.
- QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG kể trước kết quả đại thắng chung cuộc, KHÔNG hạ thành chiếm ải tối hậu hay xưng vương của các chương sau. Kết thúc chương ở thế tiến công bừng bừng chí khí.`;
  }

  if (isLastChapter) {
    if (videoType === 'BIOGRAPHY') {
      return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG KẾT (CHẶNG ĐƯỜNG CUỐI ĐỜI, SỰ RA ĐI & DI SẢN BẤT TỬ)
- Đoạn mở đầu (~25% số từ): Bước vào những năm tháng cuối đời hoặc thử thách cam go nhất của cuộc đời nhân vật.
- Đoạn diễn biến & cao trào (~50% số từ): Tinh thần cống hiến trọn đời, sự ra đi/tuẫn tiết vì đại nghĩa của nhân vật.
- Đoạn đúc kết & dư âm (~25% số từ): Tầm vóc lịch sử, nhân cách cao cả và di sản bất tử trường tồn trong lòng dân tộc.
- QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG lặp lại nguồn cội xuất thân từ chương 1. Tập trung trọn vẹn vào tầm vóc và dư âm lịch sử.`;
    }
    if (videoType === 'ARTIFACT') {
      return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG KẾT (HÀNH TRÌNH LƯU LẠC, KHẢO CỔ & DI SẢN TRƯỜNG TỒN)
- Đoạn mở đầu (~25% số từ): Trải qua thăng trầm biến thiên qua hàng thế kỷ.
- Đoạn diễn biến & cao trào (~50% số từ): Hành trình lưu lạc, phát hiện khảo cổ học thời hiện đại và sự vinh danh Bảo vật Quốc gia.
- Đoạn đúc kết & dư âm (~25% số từ): Giá trị văn hóa trường tồn, niềm tự hào dân tộc và bài học bảo tồn di sản cho hậu thế.
- QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG lặp lại bối cảnh chế tác ban đầu từ chương 1.`;
    }
    if (videoType === 'DYNASTY') {
      return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG KẾT (BIẾN ĐỘNG VẬN NƯỚC, CHUYỂN GIAO & BÀI HỌC TRỊ QUỐC)
- Đoạn mở đầu (~25% số từ): Giai đoạn biến động cuối triều đại, thử thách vận mệnh non sông.
- Đoạn diễn biến & cao trào (~50% số từ): Sự chuyển giao quyền lực hoặc chuyển mình sang thời kỳ lịch sử mới.
- Đoạn đúc kết & dư âm (~25% số từ): Đúc kết đóng góp lịch sử của triều đại và bài học trị quốc để lại cho ngàn đời.
- QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG lặp lại bối cảnh lập triều ban đầu từ chương 1.`;
    }
    if (videoType === 'MYSTERY') {
      return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG KẾT (SỰ THẬT MINH OAN, NHẬN ĐỊNH SỬ HỌC & BÀI HỌC NHÂN TÂM)
- Đoạn mở đầu (~25% số từ): Những manh mối cuối cùng được đặt cạnh nhau dưới ánh sáng tư liệu.
- Đoạn diễn biến & cao trào (~50% số từ): Sự thật lịch sử được sáng tỏ, giải tỏa nỗi oan khuất hoặc nhận định công minh của sử học.
- Đoạn đúc kết & dư âm (~25% số từ): Bài học sâu sắc về nhân tâm, quyền lực và sự thật lịch sử vĩnh cửu.
- QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG lặp lại hiện trường ban đầu từ chương 1.`;
    }
    return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG KẾT (QUYẾT CHIẾN ĐỈNH ĐIỂM, ĐẠI THẮNG & DI SẢN)
- Đoạn mở đầu (~25% số từ): Khí thế hành quân dâng cao, thế trận quyết định đã cận kề.
- Đoạn diễn biến & cao trào (~50% số từ): Trận quyết chiến đỉnh điểm, mưu lược sấm sét tiêu diệt quân địch, quét sạch quân thù, khôi phục độc lập non sông.
- Đoạn đúc kết & dư âm (~25% số từ): Xưng vương/định đô hoặc kiến thiết thái bình, đúc kết tầm vóc lịch sử trường tồn và niềm tự hào muôn đời.
- QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG lặp lại nguyên nhân bộc phát từ chương 1. Tập trung trọn vẹn vào đòn sấm sét quyết định và dư âm hào hùng.`;
  }

  // Middle chapters:
  if (videoType === 'BIOGRAPHY') {
    return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG GIỮA (HÀNH TRÌNH, BIẾN CỐ & CỐNG HIẾN KIỆT XUẤT)
- Đoạn mở đầu (~30% số từ): Nối tiếp hành trình từ chương trước, dấn thân vào những chặng đường thử thách mới.
- Đoạn diễn biến & cao trào (~50% số từ): Những biến cố thăng trầm, mưu trí/bản lĩnh kiên cường, và các thành tựu hoặc cống hiến lớn lao.
- Đoạn chuyển tiếp (~20% số từ): Khẳng định uy tín và tầm ảnh hưởng lịch sử, mở ra chặng đường tiếp theo.
- QUY TẮC BẮT BUỘC: Nối tiếp mạch truyện tuyến tính. TUYỆT ĐỐI KHÔNG kể lại xuất thân ban đầu và KHÔNG kể trước sự ra đi ở cuối đời.`;
  }
  if (videoType === 'ARTIFACT') {
    return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG GIỮA (GIẢI MÃ HOA VĂN & ĐỜI SỐNG CỔ ĐẠI)
- Đoạn mở đầu (~30% số từ): Nối tiếp vẻ đẹp chế tác, đi sâu vào cấu trúc và bố cục hiện vật.
- Đoạn diễn biến & cao trào (~50% số từ): Giải mã các tầng hoa văn, biểu tượng nghệ thuật, nghi lễ tâm linh và đời sống xã hội cổ xưa.
- Đoạn chuyển tiếp (~20% số từ): Khẳng định đỉnh cao trí tuệ văn minh thời kỳ, mở ra giai đoạn tiếp theo.
- QUY TẮC BẮT BUỘC: Nối tiếp mạch câu chuyện. TUYỆT ĐỐI KHÔNG kể lại nguồn gốc ban đầu và KHÔNG kể trước việc khảo cổ thời hiện đại.`;
  }
  if (videoType === 'DYNASTY') {
    return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG GIỮA (THỊNH TRỊ, CẢI CÁCH & BIẾN CỐ VƯƠNG TRIỀU)
- Đoạn mở đầu (~30% số từ): Nối tiếp thế nước mới lập, triển khai các chính sách trị quốc.
- Đoạn diễn biến & cao trào (~50% số từ): Giai đoạn thịnh trị rực rỡ, các cải cách kinh tế - luật pháp - văn hóa hoặc chiến công giữ nước.
- Đoạn chuyển tiếp (~20% số từ): Vận nước chuyển biến, đón nhận những thử thách mới.
- QUY TẮC BẮT BUỘC: Nối tiếp mạch tuyến tính. TUYỆT ĐỐI KHÔNG kể lại bối cảnh lập triều và KHÔNG kết thúc vương triều sớm.`;
  }
  if (videoType === 'MYSTERY') {
    return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG GIỮA (MANH MỐI, UẨN KHÚC & TRANH LUẬN SỬ HỌC)
- Đoạn mở đầu (~30% số từ): Nối tiếp sau biến cố, lần theo các dấu vết và nhân chứng lịch sử.
- Đoạn diễn biến & cao trào (~50% số từ): Những mâu thuẫn đối lập, các giả thuyết tranh cãi gay gắt trong sử sách.
- Đoạn chuyển tiếp (~20% số từ): Căng thẳng dâng cao trước thời khắc sự thật dần hé lộ.
- QUY TẮC BẮT BUỘC: Nối tiếp mạch truyện. TUYỆT ĐỐI KHÔNG đưa ra kết luận chung cuộc khi câu chuyện chưa ngã ngũ.`;
  }
  return `VAI TRÒ NGHỆ THUẬT: CHƯƠNG GIỮA (HÀNH QUÂN, SÁCH LƯỢC & CHIẾN TRẬN)
- Đoạn mở đầu (~30% số từ): Nối tiếp đà tiến quân từ chương trước, triển khai binh lực và sách lược tiến công.
- Đoạn diễn biến & cao trào (~50% số từ): Các trận đụng độ dữ dội, mưu lược sắc bén, sự phối hợp chiến thuật và biến cố chiến trường ác liệt.
- Đoạn chuyển biến thế trận (~20% số từ): Quân giặc hoang mang lui bước, thế trận xoay chuyển nghiêng hẳn về phe ta, dọn đường cho trận quyết chiến.
- QUY TẮC BẮT BUỘC: Giữ vững tính tuyến tính lịch sử. TUYỆT ĐỐI KHÔNG kể lại nguyên nhân bộc phát ban đầu và TUYỆT ĐỐI KHÔNG đúc kết kết quả toàn cuộc.`;
}

export async function scriptwriterNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'scriptwriter');
  nodeLog.info('orchestrator.scriptwriting_started', `Starting Parallel Scriptwriter Agent for ${state.chapters.length} chapters`, {
    projectId: state.projectId,
  });

  if (!state.chapters || state.chapters.length === 0) {
    return {
      status: 'CHAPTER_SCRIPT_GENERATED',
      currentStep: 4,
      chapterScripts: {},
      runningNarrativeState: state.runningNarrativeState || {
        previousChapterSummary: '',
        establishedTone: 'Hùng tráng',
        introducedEntities: [],
        transitionHook: '',
      },
      telemetryAudit: [],
    };
  }

  const chapterScripts: Record<number, string> = { ...(state.chapterScripts || {}) };
  const telemetryAudit: TelemetryAuditEntry[] = [];

  const verifiedEntities = state.ragContext?.verifiedContext || [];
  const epochInfo = computeEpochBounds(verifiedEntities, state.userPrompt, (state as any).epoch);
  const targetWpm = getTargetWpm(state.templateId);

  const isLocalSingleSlot = envConfig.USE_LOCAL_LLM || (envConfig.LOCAL_LLM_MAX_CONCURRENCY || 1) <= 1;
  const maxLlmConcurrency = isLocalSingleSlot ? 1 : Math.max(1, envConfig.LOCAL_LLM_MAX_CONCURRENCY || 4);

  const generateSingleChapter = async (i: number, previousChapterActualExit?: string): Promise<string> => {
    // 0. Checkpoint-level idempotency: reuse completed script if valid
    if (chapterScripts[i] && chapterScripts[i].trim().length > 30) {
      nodeLog.debug('orchestrator.scriptwriter_reuse_checkpoint', `Reusing completed chapter ${i} script from state`, {
        chapterIndex: i,
      });
      return chapterScripts[i];
    }

    const chapter = state.chapters[i];
    const isFirstChapter = i === 0;
    const isLastChapter = i === state.chapters.length - 1;
    const isMultiChapter = state.chapters.length > 1;

    const chapterRoleGuidance = getDomainChapterRoleGuidance(
      state.videoType,
      isFirstChapter,
      isLastChapter,
      isMultiChapter
    );

    const chapterDurationSec = Math.max(15, chapter.targetDurationSeconds || 30);
    // Template-aware WPM word count calibration
    const targetWords = Math.max(25, Math.round(chapterDurationSec * (targetWpm / 60)));
    const minWords = Math.round(targetWords * 0.90);
    const maxWords = Math.round(targetWords * 1.10);

    const wordsContext = Math.round(targetWords * 0.30);
    const wordsClimax = Math.round(targetWords * 0.50);
    const wordsLegacy = Math.round(targetWords * 0.20);

    const targetSentences = Math.max(3, Math.round(targetWords / 18));
    const numOpeningSentences = Math.max(1, Math.round(wordsContext / 18));
    const numLegacySentences = Math.max(1, Math.round(wordsLegacy / 18));
    const numClimaxSentences = Math.max(1, targetSentences - numOpeningSentences - numLegacySentences);

    // 1. Extract RAG Grounding Facts relevant to this specific chapter
    const keyEventLower = (chapter.keyEvents || []).map((k) => k.toLowerCase().trim()).filter(Boolean);
    const chapterTitleLower = chapter.title.toLowerCase().trim();
    const chapterEntitiesLower = (chapter.introducedEntities || []).map((e) => e.toLowerCase().trim()).filter(Boolean);

    // Extract years mentioned in this chapter's context
    const chapterText = `${chapter.title} ${chapter.summary} ${chapter.entryHook || ''} ${(chapter.keyEvents || []).join(' ')}`;
    const chapterYears = Array.from(chapterText.matchAll(/\b(1?\d{3,4})\b/g))
      .map((m) => parseInt(m[1], 10))
      .filter((y) => y >= 100 && y <= 2100);

    // Rank verified chunks by relevance to chapter title, summary, key events, entities, and temporal alignment
    const scoredChunks = verifiedEntities.map((chunk) => {
      let score = 0;
      const summaryLower = (chunk.summary || '').toLowerCase();
      const titleLower = (chunk.title || '').toLowerCase();
      const nameLower = (chunk.canonicalName || '').toLowerCase();

      if (chapterEntitiesLower.some((ce) => summaryLower.includes(ce) || titleLower.includes(ce) || nameLower.includes(ce))) {
        score += 5;
      }
      if (chapterTitleLower.split(/\s+/).some((w) => w.length > 3 && summaryLower.includes(w))) {
        score += 3;
      }
      if (keyEventLower.some((ev) => summaryLower.includes(ev) || ev.includes(nameLower))) {
        score += 4;
      }
      if (chapter.summary && chapter.summary.toLowerCase().split(/\s+/).some((w) => w.length > 4 && summaryLower.includes(w))) {
        score += 3;
      }
      if (chapterYears.length > 0) {
        const cStart = chunk.timeStart ?? chunk.timeEnd;
        const cEnd = chunk.timeEnd ?? chunk.timeStart;
        if (cStart !== undefined && cEnd !== undefined) {
          if (chapterYears.some((cy) => cy >= cStart - 15 && cy <= cEnd + 15)) {
            score += 6;
          }
        } else if (chapterYears.some((cy) => summaryLower.includes(String(cy)))) {
          score += 4;
        }
      }
      return { chunk, score };
    });

    scoredChunks.sort((a, b) => b.score - a.score);
    const relevantChunks = scoredChunks.filter((sc) => sc.score > 0).map((sc) => sc.chunk);

    // 1. Prioritize chapter.chapterChunks if present (from ChapterRAGRouter)
    const baseChunks = (chapter.chapterChunks && chapter.chapterChunks.length > 0)
      ? chapter.chapterChunks
      : relevantChunks;

    // Combine relevant chunks. For early/middle chapters, avoid dumping all global verifiedEntities
    // to prevent spoiler leakage (e.g. concluding victory chunks into Chapter 1).
    const fallbackEntities = (isLastChapter || baseChunks.length < 3)
      ? (relevantChunks.length > 0 ? relevantChunks : verifiedEntities)
      : relevantChunks;

    const chunkCandidates = [
      ...baseChunks,
      ...fallbackEntities,
    ];
    const seenChunkKeys = new Set<string>();
    const selectedChunks = chunkCandidates.filter((chunk) => {
      const chunkKey = chunk.chunkId || chunk.summary?.slice(0, 80) || chunk.canonicalName;
      if (!chunkKey || seenChunkKeys.has(chunkKey)) return false;
      seenChunkKeys.add(chunkKey);
      return true;
    }).slice(0, 6);

    const ragGroundingText =
      selectedChunks.length > 0
        ? selectedChunks.map((e) => `- [${e.title || e.canonicalName}]: ${cleanCrawlerText(e.summary)}`).join('\n\n')
        : '- Dựa trên tóm tắt sự kiện của chương.';

    const systemMessage = `Bạn là Nhà biên kịch Lịch sử Chuyên nghiệp của nền tảng ChronoViet.
Nhiệm vụ: Viết lời bình dẫn chuyện (Voiceover Narration) cho từng chương video lịch sử đạt chuẩn nhịp độ ${targetWpm} WPM.
QUY TẮC CẤU TRÚC KỊCH BẢN THEO VỊ TRÍ MẠCH TRUYỆN:
${chapterRoleGuidance}
- TỔNG CỘNG: Viết chính xác khoảng ${targetSentences} câu văn xuôi trọn vẹn (khoảng 16-22 từ/câu) để tổng độ dài đạt đúng ${minWords} - ${maxWords} từ tiếng Việt.

QUY TẮC BẢO TOÀN NIÊN ĐẠI & TRÁNH HALLUCINATION:
- Niên đại trọng tâm của video: ${epochInfo.epochDesc}.
- TUYỆT ĐỐI KHÔNG tự ý đưa vào các nhân vật, tướng lĩnh hoặc triều đại thuộc các thế kỷ khác không thuộc bối cảnh này (ví dụ: không đưa nhân vật nhà Trần hay Hậu Lê vào bối cảnh thời Tiền Lê/Đinh/Lý).
- TUYỆT ĐỐI KHÔNG đưa thuật ngữ, tuyến đường hoặc chiến lược của thời kỳ chống Mỹ (như: 'đường mòn Hồ Chí Minh', 'ấp chiến lược', 'Việt Nam hóa chiến tranh') vào thời kỳ kháng chiến chống Pháp (1945–1954) hoặc các thời kỳ phong kiến.
- Cho phép đề cập bối cảnh tiền đề hoặc hệ quả trong phạm vi ±30 năm cùng dòng lịch sử, nhưng nghiêm cấm vượt thế kỷ hoặc đảo lộn diễn biến lịch sử.
- ĐỊNH DANH ĐÚNG VAI TRÒ LỊCH SỬ: Nhân vật/quân đội Đại Việt (Việt Nam) là phe kháng chiến/chính nghĩa; các chủ tướng xâm lược là quân địch bị tiêu diệt hoặc tháo chạy; các tướng giặc bị bắt làm tù binh TUYỆT ĐỐI KHÔNG viết thành tướng chỉ huy của phe ta.
- BẢO TOÀN KẾT CỤC LỊCH SỬ CHUẨN XÁC: Tôn trọng sự thật lịch sử về sự hy sinh anh dũng và tấm gương kiên trung, bất khuất của các anh hùng dân tộc tuẫn tiết vì nghĩa lớn. TUYỆT ĐỐI KHÔNG bịa đặt kết quả 'toàn thắng mở nền độc lập' sai lệch với tư liệu RAG.
- TUYỆT ĐỐI KHÔNG lặp lại các câu tụng ca sáo rỗng hoặc khuôn mẫu chung chung như: 'khẳng định vị thế độc lập', 'đánh dấu bước ngoặt lịch sử', 'bảo vệ non sông'. Hãy miêu tả trực tiếp HÀNH ĐỘNG, SỰ KIỆN, MƯU LƯỢC và BIẾN CỐ cụ thể gắn với các nhân vật và hiện vật.
- QUY TẮC BẢN THỂ & DANH XƯNG NHÂN VẬT (COREFERENCE & ALIAS DISAMBIGUATION):
  + Các danh xưng, tên khai sinh hoặc bí danh của cùng một nhân vật lịch sử qua từng thời kỳ (ví dụ: Nguyễn Sinh Cung thời niên thiếu, Nguyễn Tất Thành khi dạy học/ra đi tìm đường cứu nước, Văn Ba khi làm việc trên tàu, Nguyễn Ái Quốc khi hoạt động quốc tế, Hồ Chí Minh khi về nước lãnh đạo cách mạng) CHÍNH LÀ CÙNG MỘT NGƯỜI DUY NHẤT.
  + TUYỆT ĐỐI KHÔNG viết thành "học hỏi từ...", "kế thừa từ...", "gặp gỡ..." đối với các bí danh của chính nhân vật! Hãy sử dụng đúng danh xưng phù hợp với giai đoạn lịch sử của chương đó.

QUY TẮC BẮT BUỘC DÀNH CHO GIỌNG ĐỌC TTS (LOCAL LLM COMPLIANCE):
1. TUYỆT ĐỐI KHÔNG chèn tiêu đề đoạn, KHÔNG viết các nhãn cấu trúc như: "Hồi 1:", "Mở cảnh:", "Diễn biến:", "Cao trào:", "Dư âm:", "Bài học:", "Hào hùng, trang trọng." vào văn bản.
2. TUYỆT ĐỐI KHÔNG chèn thẻ chỉ dẫn sân khấu như: [Nhạc nền], (Giọng truyền cảm), (Cười), [Hình ảnh...].
3. TUYỆT ĐỐI KHÔNG chèn nhãn người nói như: "MC:", "Người dẫn chuyện:", "Lời bình:".
4. TUYỆT ĐỐI KHÔNG dùng định dạng tiêu đề Markdown như: #, ##, **, * ở đầu đoạn.
5. Chỉ xuất văn bản lời đọc thuần túy (Plain Text), liền mạch, giàu cảm xúc, chuẩn xác sử liệu.
6. BẮT BUỘC lồng ghép tự nhiên các tên nhân vật, tướng lĩnh, địa danh, niên đại, vũ khí và sự kiện lịch sử từ tư liệu RAG. Gọi đích danh bằng danh từ riêng chuẩn xác, tránh dùng đại từ thay thế mơ hồ.
7. QUY TẮC ĐỌC SỐ & NIÊN HIỆU:
   - Không dùng số La Mã viết tắt (viết "thế kỷ thứ mười" thay vì "thế kỷ X").
   - Viết thành câu văn xuôi mượt mà (ví dụ: "từ năm 1428 đến năm 1433" thay vì "(1428 - 1433)").
8. TUYỆT ĐỐI KHÔNG dùng chữ Hán (Chinese characters); toàn bộ nội dung phải là tiếng Việt chuẩn.`;

    // Extract entities from selected RAG chunks
    const chunkEntityNames: string[] = [];
    for (const sc of selectedChunks) {
      if (sc.canonicalName && isValidHistoricalEntity(sc.canonicalName)) chunkEntityNames.push(sc.canonicalName);
      if (Array.isArray(sc.aliases)) {
        for (const a of sc.aliases) {
          if (a && isValidHistoricalEntity(a)) chunkEntityNames.push(a);
        }
      }
    }

    const userPromptEntities = extractHistoricalEntitiesFromRag(
      { verifiedContext: [], aliasTable: {}, citations: [] },
      state.userPrompt
    );
    const chapterAssignedEntities = (chapter.introducedEntities || []).filter(isValidHistoricalEntity);
    const chunkEntities = chunkEntityNames.filter(isValidHistoricalEntity);
    const chapterEventEntities = (chapter.keyEvents || [])
      .flatMap((k) => k.split(/[,;]/))
      .map((s) => s.trim())
      .filter((s) => s.length >= 3 && isValidHistoricalEntity(s));

    const allHistoricalEntities = extractHistoricalEntitiesFromRag(state.ragContext, state.userPrompt);
    const entitiesPerChapter = Math.max(2, Math.ceil(allHistoricalEntities.length / Math.max(1, state.chapters.length)));
    const chapterEntitySlice = allHistoricalEntities.slice(i * entitiesPerChapter, (i + 1) * entitiesPerChapter);

    const chunkMentionedEntities = allHistoricalEntities.filter((e) =>
      selectedChunks.some((c) => (c.summary || '').includes(e) || (c.canonicalName || '').includes(e))
    );

    // Anchor userPromptEntities as highest priority for opening, climax, ending, short videos, or matching chapters
    const climaxIdx = state.chapters.length <= 2 ? state.chapters.length - 1 : Math.max(1, Math.min(state.chapters.length - 2, Math.floor((state.chapters.length - 1) * 0.6)));
    const isRelevantToPromptEntities =
      i === 0 ||
      i === climaxIdx ||
      i === state.chapters.length - 1 ||
      state.chapters.length <= 2 ||
      userPromptEntities.some((u) => `${chapter.title} ${chapter.summary} ${(chapter.keyEvents || []).join(' ')} ${(chapter.introducedEntities || []).join(' ')}`.toLowerCase().includes(u.toLowerCase()));
    const promptCoreEntities = isRelevantToPromptEntities ? userPromptEntities : [];

    const rawCoreList = Array.from(
      new Set([
        ...promptCoreEntities,
        ...chapterAssignedEntities,
        ...chapterEventEntities,
        ...chunkMentionedEntities.slice(0, 4),
        ...(chapterAssignedEntities.length < 3 ? chapterEntitySlice : []),
      ])
    ).filter(isValidHistoricalEntity).slice(0, 8);

    const { canonicalEntities: coreChapterEntities, aliasGroups } = canonicalizeEntityList(rawCoreList);

    const otherEntities = Array.from(
      new Set([
        ...userPromptEntities,
        ...chunkEntities,
        ...chunkMentionedEntities,
        ...allHistoricalEntities,
      ])
    ).filter((e) => isValidHistoricalEntity(e) && !coreChapterEntities.includes(e)).slice(0, 8);

    const aliasGuidanceLines = Object.entries(aliasGroups).map(
      ([cName, aliases]) => `- ${cName}: Các bí danh / danh xưng theo từng thời kỳ gồm [${aliases.join(', ')}]. Tất cả là một nhân vật duy nhất.`
    );
    const aliasGuidanceText = aliasGuidanceLines.length > 0 ? `\nLƯU Ý ĐỒNG NHẤT BẢN THỂ & BÍ DANH:\n${aliasGuidanceLines.join('\n')}` : '';

    const coreEntityText = coreChapterEntities.length > 0 ? coreChapterEntities.join(', ') : state.userPrompt;
    const otherEntityText = otherEntities.length > 0 ? otherEntities.join(', ') : '';

    const rawEntryHook = chapter.entryHook || (i === 0 ? 'Mở đầu bối cảnh lịch sử' : `Tiếp nối diễn biến phần trước`);
    const cleanEntryHook = /^(?:Tiếp tục dòng chảy|Tiếp nối diễn biến|Mở ra giai đoạn|Khép lại|Hồi \d)/i.test(rawEntryHook.trim())
      ? ((chapter.keyEvents && chapter.keyEvents[0]) || chapter.title)
      : rawEntryHook;
    const exitHook = chapter.exitHook || chapter.transitionHook || (i < state.chapters.length - 1 ? 'Chuyển sang hồi tiếp theo' : 'Khép lại trang sử hào hùng');
    const climaxFocus = chapter.climaxFocus || (chapter.keyEvents && chapter.keyEvents[0]) || chapter.title;

    let transitionDirective = '';
    if (i > 0 && previousChapterActualExit) {
      transitionDirective = `\nQUY TẮC CHUYỂN TIẾP VÀ KẾ THỪA MẠCH TRUYỆN:
NGỮ CẢNH CHUYỂN TIẾP (2 câu cuối của chương trước): "${previousChapterActualExit}".
QUY TẮC CHUYỂN TIẾP BẮT BUỘC: TUYỆT ĐỐI KHÔNG lặp lại nguyên văn câu chữ, KHÔNG mở đầu bằng việc tóm tắt lại các sự kiện vừa nêu trên. Bắt đầu ngay bằng hành động, tình thế hoặc quyết sách tiếp theo của nhân vật trong chương này. (LƯU Ý: Các nhân vật lịch sử, địa danh và niên đại trọng tâm vẫn tiếp tục xuất hiện tự nhiên xuyên suốt các chương).\n`;
    }

    const cleanChapterSummary = sanitizeSentenceBoundaries(chapter.summary || '');

    // Extract covered milestones from preceding chapters to prevent narrative degeneracy
    const coveredMilestones: string[] = [];
    for (let j = 0; j < i; j++) {
      if (state.chapters[j]) {
        coveredMilestones.push(`Chương ${j + 1} (${state.chapters[j].title}): ${state.chapters[j].summary}`);
        if (state.chapters[j].keyEvents && state.chapters[j].keyEvents.length > 0) {
          coveredMilestones.push(`Sự kiện đã kể: ${state.chapters[j].keyEvents.join(', ')}`);
        }
      }
      if (chapterScripts[j]) {
        const sentences = chapterScripts[j].split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
        if (sentences.length > 0) {
          coveredMilestones.push(`Mở đầu đã kể: "${sentences[0]}"`);
        }
      }
    }

    const antiDegeneracyNotice = coveredMilestones.length > 0
      ? `\n\n⚠️ QUY TẮC CHỐNG LẶP LẠI (CROSS-CHAPTER ANTI-DEGENERACY):
- CÁC MỐC SỰ KIỆN & THÔNG TIN ĐÃ ĐƯỢC KỂ Ở CÁC CHƯƠNG TRƯỚC:
${coveredMilestones.slice(-6).map((m) => `  * ${m}`).join('\n')}
- TUYỆT ĐỐI KHÔNG giới thiệu lại từ đầu quê quán, năm sinh, phụ mẫu hay hoàn cảnh ban đầu nếu đã được kể ở chương trước.
- BẮT BUỘC tiếp nối mạch truyện từ đúng mốc thời gian của chương ${i + 1} (${chapter.title}), giữ vững dòng chảy lịch sử tiến về phía trước.`
      : '';

    const keyEventsText = (Array.isArray(chapter.keyEvents) && chapter.keyEvents.length > 0)
      ? chapter.keyEvents.join(', ')
      : chapter.title;

    const userMessage = `Hãy viết lời dẫn chuyện cho Chương ${i + 1}: "${chapter.title}".
Chủ đề video chính: "${state.userPrompt}" (Thể loại: ${state.videoType})
Bối cảnh & Niên đại bắt buộc: ${epochInfo.epochDesc}
Tóm tắt nội dung chương: ${cleanChapterSummary || keyEventsText}
Sự kiện trọng tâm (Key Events): ${keyEventsText}
Thời lượng mục tiêu: ${chapterDurationSec} giây.
${transitionDirective}${antiDegeneracyNotice}
BLUEPRINT MẠCH TRUYỆN:
- Ý mở đầu (Entry Hook): "${cleanEntryHook}".
- Trọng tâm kịch tính (Climax Focus): "${climaxFocus}".
- Ý chuyển tiếp kết thúc (Exit Hook): "${exitHook}".
- Giọng văn chủ đạo: ${chapter.establishedTone || state.runningNarrativeState?.establishedTone || 'Hào hùng, trang trọng'}.

YÊU CẦU ĐỘ DÀI VÀ MẠCH TRUYỆN CHƯƠNG ${i + 1}/${state.chapters.length} (BẮT BUỘC ~${targetWords} từ, dải chuẩn ${targetWpm} WPM: ${minWords} - ${maxWords} từ, tổng cộng khoảng ${targetSentences} câu):
${chapterRoleGuidance}
Mỗi câu văn phải viết trọn vẹn (khoảng 16-22 từ/câu), giàu tính điện ảnh và chuẩn xác sử liệu.

DANH SÁCH THỰC THỂ CỐT LÕI CỦA CHƯƠNG NÀY:
${coreEntityText}
${aliasGuidanceText}
${otherEntityText ? `\nDANH SÁCH THỰC THỂ BỔ TRỢ CÓ THỂ KẾT HỢP:\n${otherEntityText}` : ''}

TƯ LIỆU LỊCH SỬ XÁC THỰC TỪ CHRONO-RAG:
${ragGroundingText}

QUY TẮC MẠCH TRUYỆN & RÀNG BUỘC THỰC THỂ:
- BẮT BUỘC GỌI ĐÍCH DANH THỰC THỂ: Lời bình BẮT BUỘC gọi đích danh các nhân vật, địa danh và sự kiện trọng tâm của chương bằng danh từ riêng chuẩn xác, tránh dùng đại từ thay thế mơ hồ.
- BẢO TOÀN DANH XƯNG & BÍ DANH: TUYỆT ĐỐI KHÔNG viết thành "học hỏi từ...", "kế thừa từ..." đối với các bí danh của chính nhân vật chính.
- TUYỆT ĐỐI KHÔNG cưỡng ép đưa các địa danh hoặc nhân vật không thuộc bối cảnh hoặc thời kỳ của chương vào kịch bản.
- BẮT BUỘC bám sát sự kiện trọng tâm của chương: "${keyEventsText}". Nêu chính xác niên đại, năm lịch sử diễn ra sự kiện theo tư liệu; TUYỆT ĐỐI KHÔNG nhầm lẫn sang năm hoặc sự kiện của thời kỳ khác.
- BẢO TOÀN PHÂN ĐOẠN LỊCH SỬ TUYẾN TÍNH: Lời bình của Chương ${i + 1} TUYỆT ĐỐI KHÔNG lặp lại các diễn biến, sự kiện hoặc mốc thời gian đã thuộc về các chương khác. Chỉ tập trung miêu tả đúng chặng đường lịch sử của chương này. ${
  isFirstChapter && isMultiChapter
    ? (state.videoType === 'BIOGRAPHY'
        ? 'ĐẶC BIỆT: Đây là Chương 1, TUYỆT ĐỐI KHÔNG kể trước đỉnh cao sự nghiệp hay sự ra đi ở cuối đời của nhân vật!'
        : state.videoType === 'ARTIFACT'
        ? 'ĐẶC BIỆT: Đây là Chương 1, TUYỆT ĐỐI KHÔNG kể trước việc phát hiện khảo cổ thời hiện đại!'
        : state.videoType === 'DYNASTY'
        ? 'ĐẶC BIỆT: Đây là Chương 1, TUYỆT ĐỐI KHÔNG kể trước sự suy vong của triều đại!'
        : state.videoType === 'MYSTERY'
        ? 'ĐẶC BIỆT: Đây là Chương 1, TUYỆT ĐỐI KHÔNG tiết lộ kết luận hay sự thật minh oan!'
        : 'ĐẶC BIỆT: Đây là Chương 1, TUYỆT ĐỐI KHÔNG kể trước chiến thắng cuối cùng, hạ thành, đuổi giặc hay lên ngôi của các chương sau!')
    : !isLastChapter && isMultiChapter
    ? 'ĐẶC BIỆT: Đây là chương giữa, TUYỆT ĐỐI KHÔNG kể lại bối cảnh khởi đầu và KHÔNG kết thúc câu chuyện!'
    : ''
}
- TUYỆT ĐỐI KHÔNG đưa vào các nhân vật hoặc triều đại lịch sử khác ngoài bối cảnh "${epochInfo.epochDesc}".
- TUYỆT ĐỐI KHÔNG đưa các thuật ngữ, chiến lược hoặc tuyến đường của các thời kỳ khác vào kịch bản (ví dụ: không đưa thuật ngữ thời chống Mỹ vào thời chống Pháp hoặc thời phong kiến).
- TUYỆT ĐỐI KHÔNG viết các câu tụng ca sáo rỗng hoặc khuôn mẫu chung chung ("khẳng định vị thế độc lập", "đánh dấu bước ngoặt lịch sử", "bảo vệ non sông"). Hãy miêu tả trực tiếp HÀNH ĐỘNG, SỰ KIỆN, MƯU LƯỢC và BIẾN CỐ cụ thể gắn với các nhân vật và hiện vật.

- GIỚI HẠN ĐỘ DÀI BẮT BUỘC: Lời bình chương này BẮT BUỘC có độ dài trong khoảng từ ${minWords} đến ${maxWords} từ tiếng Việt (mục tiêu chuẩn: ${targetWords} từ). TUYỆT ĐỐI KHÔNG viết dưới ${minWords} từ và TUYỆT ĐỐI KHÔNG viết quá ${maxWords} từ.

NHẮC LẠI: Chỉ xuất văn xuôi thuần túy để đọc TTS trực tiếp, KHÔNG viết bất kỳ tiêu đề hoặc nhãn cấu trúc nào. Bắt đầu viết:`;

    const estimatedMaxTokens = Math.min(2048, Math.max(512, Math.round(maxWords * 2.8)));
    let cleanedScript = '';

    try {
      let rawContent = '';
      try {
        const res = await callLlm({
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          maxTokens: estimatedMaxTokens,
          timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
        });
        rawContent = res.content || '';
      } catch (callErr: any) {
        // 1-pass Context-Reduction Retry on LLM timeout or error
        nodeLog.warn('orchestrator.scriptwriter_retry_reduced_context', `Primary LLM call failed for chapter ${i} (${callErr.message}). Retrying with reduced context at temp=0.0.`, {
          chapterIndex: i,
          error: callErr.message,
        });
        const reducedRagGrounding = selectedChunks.slice(0, 2).map((c) => `- ${c.canonicalName}: ${cleanCrawlerText(c.summary)}`).join('\n');
        const retryRes = await callLlm({
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: `${userMessage}\n\nLƯU Ý: Rút gọn tập trung vào 2 tư liệu cốt lõi:\n${reducedRagGrounding}` },
          ],
          temperature: 0.0,
          maxTokens: estimatedMaxTokens,
          timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
        });
        rawContent = retryRes.content || '';
      }

      cleanedScript = stripChapterTitleEcho(sanitizeVoiceoverScript(rawContent), chapter.title);

      let words = cleanedScript.split(/\s+/).filter(Boolean);
      let wordCount = words.length;
      const durationMin = chapterDurationSec / 60;
      let actualWpm = durationMin > 0 ? Math.round(wordCount / durationMin) : 0;
      const minWpmAllowed = Math.round(targetWpm * 0.88);
      const maxWpmAllowed = Math.round(targetWpm * 1.12);

      // If initial generation returned a tiny stub (< 20 words or severely starved), retry generation with full grounding
      if (!cleanedScript || wordCount < 20 || actualWpm < minWpmAllowed * 0.4) {
        nodeLog.warn('orchestrator.scriptwriter_stub_detected', `Initial script for chapter ${i} is a stub (${wordCount} words, actualWpm=${actualWpm}). Retrying full generation with reduced temperature.`, {
          chapterIndex: i,
          wordCount,
          actualWpm,
        });
        telemetryAudit.push({
          timestamp: new Date().toISOString(),
          node: 'scriptwriter',
          level: 'WARN',
          category: 'RETRY',
          message: `Initial script for chapter ${i} was a stub (${wordCount} words). Retrying generation.`,
          metadata: { chapterIndex: i, wordCount, actualWpm },
        });
        try {
          const retryRes = await callLlm({
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: `${userMessage}\n\nCHÚ Ý ĐẶC BIỆT: Bắt buộc viết đầy đủ ít nhất ${minWords} từ tiếng Việt, không được tóm tắt ngắn.` },
            ],
            temperature: 0.1,
            maxTokens: estimatedMaxTokens,
            timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
          });
          const retryCleaned = stripChapterTitleEcho(sanitizeVoiceoverScript(retryRes.content), chapter.title);
          if (retryCleaned && retryCleaned.split(/\s+/).filter(Boolean).length > wordCount) {
            cleanedScript = retryCleaned;
            words = cleanedScript.split(/\s+/).filter(Boolean);
            wordCount = words.length;
            actualWpm = durationMin > 0 ? Math.round(wordCount / durationMin) : 0;
          }
        } catch (retryErr: any) {
          nodeLog.warn('orchestrator.scriptwriter_stub_retry_failed', `Stub retry failed: ${retryErr.message}`);
        }
      }

      // Calibrated Pacing Refinement Loop: trigger when WPM deviates outside +-12% of template target WPM
      if (cleanedScript && (actualWpm < minWpmAllowed || actualWpm > maxWpmAllowed)) {
        nodeLog.info('orchestrator.scriptwriter_pacing_refinement', `Pacing deviation detected for chapter ${i} (WPM=${actualWpm}, target=${targetWpm}, band=${minWpmAllowed}-${maxWpmAllowed}). Triggering refinement pass.`, {
          chapterIndex: i,
          actualWpm,
          wordCount,
          targetWords,
        });

        const isTooShort = actualWpm < minWpmAllowed;
        const wordsDiff = Math.abs(wordCount - targetWords);
        const deltaInstruction = isTooShort
          ? `Văn bản hiện tại (${wordCount} từ) quá ngắn so với thời lượng ${chapterDurationSec}s (chuẩn ${targetWpm} WPM). Cần viết thêm khoảng ${wordsDiff} từ, khắc họa sâu sắc hơn không khí thời đại, bối cảnh chiến trường, cảm xúc và mưu lược nhân vật để đạt trong khoảng ${minWords} - ${maxWords} từ (mục tiêu: ~${targetWords} từ). TUYỆT ĐỐI KHÔNG lặp lại các sự kiện đã nói, KHÔNG kể nhảy cóc sang sự kiện của chương khác.`
          : `Văn bản hiện tại (${wordCount} từ) quá dài so với thời lượng ${chapterDurationSec}s (chuẩn ${targetWpm} WPM). Cần cắt giảm bớt khoảng ${wordsDiff} từ, cô đọng lời văn giàu sức gợi. QUY TẮC BẮT BUỘC: Bản sửa PHẢI có độ dài từ ${minWords} đến ${maxWords} từ (mục tiêu: ~${targetWords} từ). TUYỆT ĐỐI KHÔNG cắt ngắn dưới ${minWords} từ thành dạng tóm tắt đại ý. Giữ nguyên toàn bộ nhân vật, sự kiện và niên đại lịch sử cốt lõi.`;

        const compactGrounding = selectedChunks.slice(0, 3).map((c) => `- [${c.canonicalName}]: ${cleanCrawlerText(c.summary)}`).join('\n');
        const chapterEntitiesStr = (coreChapterEntities.slice(0, 5).length > 0 ? coreChapterEntities.slice(0, 5) : [state.userPrompt]).join(', ');

        try {
          const refineRes = await callLlm({
            messages: [
              { role: 'system', content: systemMessage },
              {
                role: 'user',
                content: `BỐI CẢNH SỬ LIỆU BẮT BUỘC (COMPACT INVARIANT FRAME):\n- Niên đại trọng tâm: ${epochInfo.epochDesc}\n- Chương ${i + 1}: "${chapter.title}"\n- Tóm tắt sự kiện chương: ${cleanChapterSummary || keyEventsText}\n- Thực thể cốt lõi bắt buộc bảo tồn: ${chapterEntitiesStr}\n- Tư liệu RAG xác thực:\n${compactGrounding}\n\nDưới đây là bản thảo lời bình hiện tại của Chương ${i + 1}:\n"""\n${cleanedScript}\n"""\n\nYÊU CẦU TINH CHỈNH TỐC ĐỘ ĐỌC (PACING CALIBRATION):\n${deltaInstruction}\nBắt buộc kết quả mới phải có độ dài từ ${minWords} đến ${maxWords} từ tiếng Việt (chính xác khoảng ${targetWords} từ) để đọc vừa vặn trong ${chapterDurationSec} giây. TUYỆT ĐỐI KHÔNG viết vượt quá ${maxWords} từ.\nTUYỆT ĐỐI KHÔNG đưa vào các nhân vật hoặc triều đại khác ngoài bối cảnh "${epochInfo.epochDesc}".\n\nChỉ xuất văn bản lời bình hoàn chỉnh (văn xuôi thuần túy, KHÔNG tiêu đề) sau khi tinh chỉnh:`,
              },
            ],
            temperature: 0.1,
            maxTokens: estimatedMaxTokens,
            timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
          });

          const refinedCleaned = sanitizeVoiceoverScript(refineRes.content);
          if (refinedCleaned && refinedCleaned.length > 30) {
            let processedRefined = refinedCleaned;
            let refinedWords = processedRefined.split(/\s+/).filter(Boolean).length;

            // If refined text is too long, bound it cleanly at sentence boundary
            if (refinedWords > maxWords * 1.08) {
              const sentences = processedRefined.split(/(?<=[.!?])\s+/);
              let curW = 0;
              const kept: string[] = [];
              for (const s of sentences) {
                const w = s.split(/\s+/).filter(Boolean).length;
                if (curW + w <= maxWords * 1.05 || kept.length === 0) {
                  kept.push(s);
                  curW += w;
                } else {
                  break;
                }
              }
              if (kept.length > 0 && curW >= minWords * 0.7) {
                processedRefined = kept.join(' ');
                refinedWords = curW;
              }
            }

            const refinedWpm = durationMin > 0 ? Math.round(refinedWords / durationMin) : 0;
            const originalDeviation = Math.abs(actualWpm - targetWpm);
            const refinedDeviation = Math.abs(refinedWpm - targetWpm);

            // Accept refinement if:
            // 1. Original was a stub (< 25 words or WPM < 50% target) and refinement is substantial (>= minWords * 0.6)
            // 2. Or refined WPM deviation improved over original deviation and is within reasonable floor
            const isOriginalStub = wordCount < 25 || actualWpm < minWpmAllowed * 0.5;
            const isRefinementSubstantial = refinedWords >= minWords * 0.6;
            const shouldAccept =
              (isOriginalStub && isRefinementSubstantial) ||
              (refinedDeviation < originalDeviation && refinedWords >= minWords * 0.75);

            if (shouldAccept) {
              cleanedScript = processedRefined;
              telemetryAudit.push({
                timestamp: new Date().toISOString(),
                node: 'scriptwriter',
                level: 'INFO',
                category: 'RECONCILIATION',
                message: `Pacing refined for chapter ${i}: ${actualWpm} -> ${refinedWpm} WPM (target: ${targetWpm})`,
                metadata: { chapterIndex: i, originalWpm: actualWpm, refinedWpm, targetWpm },
              });
              nodeLog.info('orchestrator.scriptwriter_refine_accepted', `Refinement accepted: deviation reduced from ${originalDeviation} to ${refinedDeviation} WPM`, {
                chapterIndex: i,
                originalWpm: actualWpm,
                refinedWpm,
                targetWpm,
              });
            } else {
              nodeLog.info('orchestrator.scriptwriter_refine_rejected', `Refinement rejected: deviation grew from ${originalDeviation} to ${refinedDeviation} WPM`, {
                chapterIndex: i,
                originalWpm: actualWpm,
                refinedWpm,
                targetWpm,
              });

              // Deterministic sentence-boundary pruning fallback:
              // If refinement was rejected or over-shortened, but original text was over-long,
              // deterministically bound original text down to maxWords at clean sentence boundaries.
              if (actualWpm > maxWpmAllowed) {
                const sentences = cleanedScript.split(/(?<=[.!?])\s+/);
                let curW = 0;
                const kept: string[] = [];
                for (const s of sentences) {
                  const w = s.split(/\s+/).filter(Boolean).length;
                  if (curW + w <= maxWords || kept.length === 0) {
                    kept.push(s);
                    curW += w;
                  } else {
                    break;
                  }
                }
                if (kept.length > 0 && curW >= minWords * 0.75) {
                  cleanedScript = kept.join(' ');
                  const prunedWpm = durationMin > 0 ? Math.round(curW / durationMin) : 0;
                  nodeLog.info('orchestrator.scriptwriter_deterministic_prune', `Applied sentence boundary pruning fallback for chapter ${i}: ${actualWpm} -> ${prunedWpm} WPM`, {
                    chapterIndex: i,
                    originalWpm: actualWpm,
                    prunedWpm,
                    targetWpm,
                  });
                }
              }
            }
          }
        } catch (refineErr: any) {
          nodeLog.warn('orchestrator.scriptwriter_refine_failed', `Refinement pass skipped: ${refineErr.message}`);
        }
      }

      let finalScript = stripChapterTitleEcho(cleanedScript || sanitizeVoiceoverScript(rawContent), chapter.title);
      finalScript = deduplicateRepetitiveText(finalScript);

      // Enforce hard word limit: Never let a chapter script exceed maxWords * 1.12
      const finalWords = finalScript.split(/\s+/).filter(Boolean);
      if (finalWords.length > maxWords * 1.12) {
        const sentences = finalScript.split(/(?<=[.!?])\s+/);
        let curW = 0;
        const kept: string[] = [];
        for (const s of sentences) {
          const w = s.split(/\s+/).filter(Boolean).length;
          if (curW + w <= maxWords || kept.length === 0) {
            kept.push(s);
            curW += w;
          } else {
            break;
          }
        }
        if (kept.length > 0 && curW >= minWords * 0.7) {
          finalScript = sanitizeSentenceBoundaries(kept.join(' '));
        }
      }

      if (finalScript) {
        finalScript = sanitizeSentenceBoundaries(finalScript);
      }

      // Cross-chapter verbatim sentence deduplication guardrail
      if (i > 0 && finalScript) {
        const prevSentencesSet = new Set<string>();
        for (let j = 0; j < i; j++) {
          if (chapterScripts[j]) {
            const sList = chapterScripts[j].split(/(?<=[.!?])\s+/).map((s) => s.trim().toLowerCase());
            for (const s of sList) {
              if (s.length > 25) prevSentencesSet.add(s);
            }
          }
        }

        if (prevSentencesSet.size > 0) {
          const curSentences = finalScript.split(/(?<=[.!?])\s+/);
          const filteredSentences = curSentences.filter((s) => {
            const sLower = s.trim().toLowerCase();
            return !prevSentencesSet.has(sLower);
          });
          if (filteredSentences.length >= 2) {
            finalScript = sanitizeSentenceBoundaries(filteredSentences.join(' '));
          }
        }
      }

      if (!finalScript || finalScript.split(/\s+/).filter(Boolean).length < 20) {
        if (envConfig.EVAL_STRICT) {
          throw new Error(`Scriptwriter failed to generate narration for chapter ${i} in EVAL_STRICT mode.`);
        }
        nodeLog.warn('orchestrator.scriptwriter_fallback_synthesized', `Final script for chapter ${i} is empty or stub (< 20 words). Synthesizing deterministic fallback.`, {
          chapterIndex: i,
          rawWordCount: finalScript ? finalScript.split(/\s+/).filter(Boolean).length : 0,
        });
        return synthesizeDeterministicHistoricalScript(
          chapter.title,
          cleanChapterSummary,
          selectedChunks,
          chapterDurationSec,
          targetWpm
        );
      }

      return finalScript;
    } catch (err: any) {
      if (envConfig.EVAL_STRICT) {
        throw err;
      }
      nodeLog.warn('orchestrator.scriptwriter_llm_fallback', `LLM call fallback for chapter ${i}: ${err.message}`);
      telemetryAudit.push({
        timestamp: new Date().toISOString(),
        node: 'scriptwriter',
        level: 'WARN',
        category: 'FALLBACK',
        message: `LLM call fallback for chapter ${i}: ${err.message}`,
        metadata: { chapterIndex: i, error: err.message },
      });
      return synthesizeDeterministicHistoricalScript(
        chapter.title,
        cleanChapterSummary,
        selectedChunks,
        chapterDurationSec,
        targetWpm
      );
    }
  };

  if (isLocalSingleSlot) {
    // Serial execution for single-slot local LLM with dynamic exit anchors
    for (let i = 0; i < state.chapters.length; i++) {
      let previousChapterActualExit = '';
      if (i > 0 && chapterScripts[i - 1]) {
        const prevSentences = chapterScripts[i - 1]
          .split(/(?<=[.!?\n])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 5);
        if (prevSentences.length >= 2) {
          previousChapterActualExit = prevSentences.slice(-2).join(' ');
        } else if (prevSentences.length === 1) {
          previousChapterActualExit = prevSentences[0];
        }
      }

      chapterScripts[i] = await generateSingleChapter(i, previousChapterActualExit);
    }
  } else {
    // Parallel batches for cloud / multi-slot LLM
    const chapterIndices = state.chapters.map((_, i) => i);
    for (let batchStart = 0; batchStart < chapterIndices.length; batchStart += maxLlmConcurrency) {
      const batch = chapterIndices.slice(batchStart, batchStart + maxLlmConcurrency);
      await Promise.all(
        batch.map(async (i) => {
          chapterScripts[i] = await generateSingleChapter(i);
        })
      );
    }
  }

  // Aggregate narrative state across chapters
  const allIntroduced = state.chapters.flatMap((c) => c.introducedEntities || []);
  const lastChapter = state.chapters[state.chapters.length - 1];
  const existingIntroduced = state.runningNarrativeState?.introducedEntities || [];
  const aggregatedNarrativeState: RunningNarrativeState = {
    previousChapterSummary: lastChapter?.summary || '',
    establishedTone: lastChapter?.establishedTone || state.runningNarrativeState?.establishedTone || 'Hùng tráng',
    introducedEntities: Array.from(new Set([...existingIntroduced, ...allIntroduced])).slice(-15),
    transitionHook: lastChapter?.transitionHook || lastChapter?.exitHook || '',
    coveredMilestones: state.chapters.map((c) => `${c.title}: ${c.summary}`),
    introducedKeyFacts: Array.from(new Set(state.chapters.flatMap((c) => c.keyEvents || []))),
  };

  const updatedNarrativeLedger: NarrativeLedger = {
    coveredMilestones: state.chapters.map((c) => `${c.title}: ${c.summary}`),
    introducedKeyFacts: Array.from(new Set(state.chapters.flatMap((c) => c.keyEvents || []))),
    resolvedAliases: Array.from(new Set(state.chapters.flatMap((c) => c.introducedEntities || []))),
  };

  return {
    status: 'CHAPTER_SCRIPT_GENERATED',
    currentStep: 4,
    chapterScripts,
    runningNarrativeState: aggregatedNarrativeState,
    narrativeLedger: updatedNarrativeLedger,
    telemetryAudit,
  };
}

