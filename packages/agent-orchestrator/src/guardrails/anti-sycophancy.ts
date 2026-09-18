/**
 * Anti-Sycophancy & False Premise Detection Guardrail
 * Detects leading questions with potential false premises (kinship, dynasty mismatch, fake relations)
 * and generates strict refusal & verification guidance for LLM prompts.
 */

import {
  resolveCanonicalEntity,
  isKnownMasterEntity,
  HistoricalEntityInfo,
  HISTORICAL_PERSON_DICTIONARY,
  extractHistoricalCandidateSpans,
} from '@chronoviet/shared-spec';

export interface PremiseAnalysisResult {
  isLeadingQuestion: boolean;
  isSameEntityCoReference?: boolean;
  questionType?: 'KINSHIP' | 'IDENTITY' | 'DYNASTY' | 'CHRONOLOGY' | 'GENERAL' | 'EVENT';
  categoryLabel?: string;
  detectedEntities: string[];
  suggestedDirective: string;
}

const KINSHIP_PATTERNS = [
  /(.+?)\s+và\s+(.+?)\s+(?:có\s+phải\s+(?:là\s+)?|là\s+có\s+phải\s+|là\s+|có\s+phải\s+)(?:2|hai)?\s*(?:anh\s+em|chị\s+em|cha\s+con|mẹ\s+con|vợ\s+chồng|ông\s+cháu)(?:\s+hả|\s+không|\s+hay\s+không|\s+phải\s+không|\s+đúng\s+không|\s*\?)?/i,
  /(.+?)\s+và\s+(.+?)\s+(?:có\s+quan\s+hệ|quan\s+hệ|mối\s+quan\s+hệ|có\s+liên\s+quan|liên\s+quan)\s+(?:gì|như\s+thế\s+nào|ra\s+sao|gì\s+với\s+nhau)(?:\s+với\s+nhau)?(?:\s+hả|\s+không|\s+hay\s+không|\s+phải\s+không|\s+đúng\s+không|\s*\?)?/i,
  /(?:mối\s+)?quan\s+hệ\s+(?:giữa\s+)?(.+?)\s+và\s+(.+?)(?:\s+là\s+gì|\s+như\s+thế\s+nào|\s*\?)?/i,
  /(.+?)\s+có\s+phải\s+(?:là\s+)?(?:con|cha|anh|em|vợ|chồng|cháu)\s+của\s+(.+?)(?:\s+không|\s+hay\s+không|\s+phải\s+không|\s+đúng\s+không|\s+hả|\s*\?)?/i,
  /(.+?)\s+là\s+(?:con|cha|anh|em|vợ|chồng|cháu|ông|bà|vợ|chồng)\s+của\s+(.+?)(?:\s+hả|\s+không|\s+hay\s+không|\s+phải\s+không|\s+đúng\s+không|\s*\?)?/i,
  /(.+?)\s+là\s+anh\s+em\s+ruột\s+với\s+(.+?)(?:\s+hả|\s+không|\s+hay\s+không|\s+phải\s+không|\s+đúng\s+không|\s*\?)?/i,
  /(.+?)\s+và\s+(.+?)\s+có\s+phải\s+(?:là\s+)?(?:cùng\s+một\s+người|là\s+một|2\s+người\s+khác\s+nhau|hai\s+người\s+khác\s+nhau)(?:\s+không|\s+hay\s+không|\s+phải\s+không|\s+đúng\s+không|\s+hả|\s*\?)?/i,
];

const DYNASTY_PATTERNS = [
  /(.+)\s+(?:có\s+phải\s+là\s+vua|lập\s+ra|thuộc)\s+(?:nhà|triều)\s+(.+)(?:\s+không|\s+hả|\s*\?)?/i,
];

const SYCOPHANCY_PATTERNS = [
  /(?:dòng\s*họ\s*(?:của\s*)?tôi|ông\s*cố\s*(?:của\s*)?tôi|tổ\s*tiên\s*(?:của\s*)?tôi|gia\s*phả\s*(?:nhà|của|dòng\s*họ)\s*tôi|khám\s*phá\s*của\s*tôi|bài\s*luận\s*của\s*tôi|đồng\s*ý\s*với\s*tôi|đồng\s*ý\s*rằng)/i,
  /(?:tôi\s+(?:là|chính\s+là)\s+hậu\s+duệ|tôi\s+là\s+cháu\s+(?:đích\s+tôn|đời\s+thứ)|nhà\s+tôi\s+có\s+gia\s+phả|nhận\s+vơ\s+hậu\s+duệ|nhận\s+làm\s+hậu\s+duệ)/i,
];

// Whitelist for authentic feudal Vietnamese weaponry and armor
const FEUDAL_WEAPONS_WHITELIST = /(?:súng\s*thần\s*cơ|súng\s*hỏa\s*mai|cửu\s*vị\s*thần\s*công|thần\s*cơ\s*doanh|thần\s*cơ\s*thương\s*pháo|thần\s*công|áo\s*giáp(?:\s*sắt|\s*đồng)?)/i;

// Digital / modern electronic tech that is strictly anachronistic for any pre-modern context
const MODERN_DIGITAL_ANACHRONISM_PATTERNS = [
  /(?:bộ\s*đàm|điện\s*thoại|facebook|youtube|kính\s*thiên\s*văn|đèn\s*led|camera|microsoft\s*word|máy\s*vi\s*tính|mã\s*qr|ví\s*điện\s*tử|boeing|email|sms|cano|4k|truyền\s*hình|pin\s*lithium|drone|hồng\s*ngoại|thương\s*mại\s*điện\s*tử|áo\s*giáp\s*kevlar|kevlar)/i,
];

// Modern military hardware (20th century) that is ONLY anachronistic if queried in ancient/feudal context
const MODERN_MILITARY_PATTERNS = [
  /(?:xe\s*tăng|máy\s*bay|tên\s*lửa|sam-2|bom\s*nguyên\s*tử|súng\s*bắn\s*tỉa|máy\s*kéo|máy\s*gặt)/i,
];

const ANCIENT_FEUDAL_CONTEXT_PATTERNS = /(?:thời(?:\s+kỳ)?\s+(?:phong\s*kiến|cổ\s*đại|bắc\s*thuộc|lý|trần|lê|nguyễn|đinh|ngô|tiền\s*lê|hồ|tây\s*sơn|mạc|hùng\s*vương|an\s*dương\s*vương)|nhà\s+(?:lý|trần|lê|nguyễn|đinh|ngô|tiền\s*lê|hồ|tây\s*sơn|mạc|hán|đường|tống|nguyên|minh|thanh)|triều\s+(?:lý|trần|lê|nguyễn|đinh|ngô|tiền\s*lê|hồ|tây\s*sơn|mạc)|quang\s*trung|nguyễn\s*huệ|trần\s*hưng\s*đạo|lê\s*lợi|lý\s*thường\s*kiệt|ngô\s*quyền|đinh\s*tiên\s*hoàng|an\s*dương\s*vương|thục\s*phán|trọng\s*thủy|mỵ\s*châu|bạch\s*đằng(?:\s*năm\s*(?:938|981|1288))?|ngọc\s*hồi|chi\s*lăng|xương\s*giang|như\s*nguyệt)/i;

const FOLKLORE_AS_FACT_PATTERNS = [
  /(?:thánh\s*gióng|bay\s*về\s*trời|nhổ\s*bụi\s*tre|nỏ\s*thần|rùa\s*vàng|thần\s*kim\s*quy|có\s*thật\s*100%|chính\s*sử.*thần\s*thoại|sơn\s*tinh|thủy\s*tinh|dưa\s*hấu|mai\s*an\s*tiêm|rùa\s*vàng.*hồ\s*gươm|chử\s*đồng\s*tử|tiên\s*dung|bánh\s*chưng|lang\s*liêu|thạch\s*sanh|thần\s*độc\s*cước|tre\s*trăm\s*đốt|trầu\s*cau|từ\s*thức|ông\s*táo|trạng\s*quỳnh|tấm\s*cám|mỵ\s*châu|ba\s*bể|thần\s*đồng\s*cổ|móng\s*rồng|cóc\s*kiện\s*trời|con\s*cóc\s*là\s*cậu)/i,
];

const MIXED_PREMISE_PATTERNS = [
  /(?:vừa\s+(?:lãnh\s*đạo|chỉ\s*huy|chiến\s*đấu)\s+.*nhưng\s+(?:lại\s+)?(?:ký|đầu\s*hàng|thỏa\s*hiệp))/i,
  /(?:năm\s+\d{3,4}.*(?:rồi\s+sau\s+đó|nhưng\s+lại).*năm\s+\d{3,4}.*(?:có\s+mâu\s+thuẫn|đúng\s+sai\s+thế\s+nào))/i,
];

export function cleanEntitySpan(span: string): string {
  return span
    .replace(/^(?:(?:cho\s+(?:mình|tôi|em)\s+hỏi|bạn\s+ơi|bot\s+ơi|làm\s+ơn\s+cho\s+biết|phiền\s+bạn)\s*,?\s*)?/i, '')
    .replace(/^(?:có\s+phải\s+(?:là\s+)?|phải\s+chăng\s+(?:là\s+)?|có\s+đúng\s+(?:là\s+)?|liệu\s+(?:rằng\s+)?|theo\s+(?:bạn|sử\s+sách)\s+thì\s+)/i, '')
    .replace(/\s+(?:có\s+phải\s+(?:là\s+)?|có\s+phải|là\s+có\s+phải|là)$/i, '')
    .replace(/\s+(?:hay\s+không|phải\s+không|không|hả|nhỉ|thế|ạ)$/i, '')
    .replace(/[?!.,;:]+$/g, '')
    .trim();
}

/**
 * Robustly extracts recognized historical master entities and capitalized proper noun candidates
 * without relying on brittle regex capture group boundaries.
 */
export function extractRecognizedOrProperNounEntities(query: string): string[] {
  const recognized: string[] = [];
  const clean = query.replace(/[,;!?.:~"'/()\\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = clean.split(' ').filter(Boolean);
  const n = tokens.length;
  const coveredIndices = new Set<number>();

  const STOPWORDS = new Set([
    'bạn', 'tôi', 'mình', 'cậu', 'em', 'anh', 'chị', 'bot', 'ad', 'admin',
    'ai', 'gì', 'nào', 'đâu', 'sao', 'thế', 'vậy', 'có', 'phải', 'là',
    'không', 'chăng', 'hả', 'nhỉ', 'và', 'với', 'cùng', 'hai', 'người',
  ]);

  // 1. First pass: recognized candidate spans from shared-spec NER (Gazetteer + honorifics + proper nouns)
  const candidateSpans = extractHistoricalCandidateSpans(query);
  for (const spanObj of candidateSpans) {
    const span = cleanEntitySpan(spanObj.text.trim());
    const lower = span.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    if (span.length < 3 || lower === 'bạn' || lower === 'ban') continue;

    if (!recognized.some((r) => r.toLowerCase() === lower)) {
      recognized.push(span);
      // Mark covered token indices
      const spanClean = span.replace(/[,;!?.:~"'/()\\-]+/g, ' ').replace(/\s+/g, ' ').trim();
      const spanTokens = spanClean.split(' ').filter(Boolean);
      for (let i = 0; i <= tokens.length - spanTokens.length; i++) {
        const slice = tokens.slice(i, i + spanTokens.length).join(' ').toLowerCase();
        if (slice === spanTokens.join(' ').toLowerCase()) {
          for (let k = 0; k < spanTokens.length; k++) coveredIndices.add(i + k);
          break;
        }
      }
    }
  }

  // Also check direct multi-word master entities
  for (let len = Math.min(8, n); len >= 1; len--) {
    for (let i = 0; i <= n - len; i++) {
      if (Array.from({ length: len }, (_, k) => i + k).some((idx) => coveredIndices.has(idx))) continue;
      const span = tokens.slice(i, i + len).join(' ');
      const lower = span.toLowerCase();
      if (STOPWORDS.has(lower)) continue;
      if (len === 1 && (span.length < 3 || lower === 'bạn' || lower === 'ban')) continue;

      if (isKnownMasterEntity(span) && !recognized.some((r) => r.toLowerCase() === lower)) {
        recognized.push(span);
        for (let k = 0; k < len; k++) coveredIndices.add(i + k);
      }
    }
  }

  // 2. Second pass: Capitalized Proper Noun candidate spans (2 to 4 words, e.g. "Lê Văn Tèo")
  const properNounMatches = query.match(/(?:(?<!\p{L})\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+){1,3}(?!\p{L}))/gu);
  if (properNounMatches) {
    for (const m of properNounMatches) {
      const cleaned = cleanEntitySpan(m);
      if (
        cleaned.length >= 3 &&
        !recognized.some((r) => r.toLowerCase().includes(cleaned.toLowerCase()) || cleaned.toLowerCase().includes(r.toLowerCase()))
      ) {
        if (!/^(?:có phải|phải chăng|cho tôi|cho mình|bạn ơi|xin chào)/i.test(cleaned)) {
          recognized.push(cleaned);
        }
      }
    }
  }

  // 3. Third pass: Lowercase / Informal Vietnamese surname candidate spans (2 to 4 words, e.g. "le van teo", "lê văn tèo")
  const VIETNAMESE_SURNAMES = new Set([
    'nguyễn', 'nguyen', 'trần', 'tran', 'lê', 'le', 'phạm', 'pham', 'hoàng', 'hoang',
    'huỳnh', 'huynh', 'phan', 'vũ', 'vu', 'võ', 'vo', 'đặng', 'dang', 'bùi', 'bui',
    'đỗ', 'do', 'hồ', 'ho', 'ngô', 'ngo', 'dương', 'duong', 'lý', 'ly', 'đinh', 'dinh',
    'đoàn', 'doan', 'lâm', 'lam', 'mai', 'trịnh', 'trinh', 'đào', 'dao', 'cao',
    'lưu', 'luu', 'lương', 'luong', 'thái', 'thai', 'châu', 'chau', 'tạ', 'ta',
    'phùng', 'phung', 'tô', 'to', 'vương', 'vuong', 'quách', 'quach', 'hà', 'ha',
  ]);
  for (let len = Math.min(4, n); len >= 2; len--) {
    for (let i = 0; i <= n - len; i++) {
      if (Array.from({ length: len }, (_, k) => i + k).some((idx) => coveredIndices.has(idx))) continue;
      const firstWord = tokens[i].toLowerCase();
      if (!VIETNAMESE_SURNAMES.has(firstWord)) continue;
      const spanTokens = tokens.slice(i, i + len);
      if (spanTokens.some((t) => STOPWORDS.has(t.toLowerCase()))) continue;
      const candidate = spanTokens.join(' ');
      const cleaned = cleanEntitySpan(candidate);
      if (/^(?:to lớn|to tát|to nhỏ|to cao|vương quyền|vương triều|vương quốc|vương vị|đối với)\b/i.test(cleaned)) continue;
      if (
        cleaned.length >= 3 &&
        !recognized.some((r) => r.toLowerCase().includes(cleaned.toLowerCase()) || cleaned.toLowerCase().includes(r.toLowerCase()))
      ) {
        recognized.push(cleaned);
        for (let k = 0; k < len; k++) coveredIndices.add(i + k);
      }
    }
  }

  return recognized;
}

function buildSameEntityEventDirective(
  e1: string,
  e2: string,
  canon: HistoricalEntityInfo,
  _query?: string
): string {
  const meta = canon.namingMetadata;
  const timeDetails: string[] = [];
  if (meta?.reignPeriod?.start) {
    timeDetails.push(`năm ${meta.reignPeriod.start} lên ngôi đổi niên hiệu`);
  }
  if (meta?.periodAliases && meta.periodAliases.length > 0) {
    for (const pa of meta.periodAliases) {
      timeDetails.push(`${pa.period}: ${pa.name}`);
    }
  }
  const timeContextStr = timeDetails.length > 0 ? ` (Dữ kiện sử liệu: ${timeDetails.join('; ')})` : '';

  return `[ĐÍNH CHÍNH DANH TÍNH CÙNG MỘT NGƯỜI TRONG SỰ KIỆN LỊCH SỬ]:
1. CÂU MỞ ĐẦU BẮT BUỘC: Khẳng định trực diện "${e1}" và "${e2}" không phải là hai người khác nhau mà là CÙNG MỘT NGƯỜI (CÙNG MỘT NHÂN VẬT LỊCH SỬ: ${canon.canonicalName}). Do đó tuyệt đối không có việc hai người cùng phối hợp hay chia tách nhiệm vụ chỉ huy.
2. BỐI CẢNH DANH XƯNG GẮN VỚI SỰ KIỆN: Nêu rõ bối cảnh lịch sử và mốc thời gian nhân vật mang danh xưng "${e1}" và "${e2}"${timeContextStr}.
3. VAI TRÒ THỐNG SOÁI DUY NHẤT: Khẳng định vai trò lãnh đạo / thống soái duy nhất của ${canon.canonicalName} trong sự kiện / chiến dịch này; bác bỏ tiền đề sai lệch cho rằng có hai cá nhân riêng biệt cùng chỉ huy hay phân chia công việc.`;
}

function buildSameEntityCoReferenceDirective(
  e1: string,
  e2: string,
  canon: HistoricalEntityInfo,
  query?: string
): string {
  const meta = canon.namingMetadata;
  const fam = meta?.familyLineage;

  let directive = `[ĐÍNH CHÍNH DANH TÍNH CÙNG MỘT NGƯỜI LỊCH SỬ (ANTI-CO-REFERENCE ERROR)]:
1. CÂU MỞ ĐẦU BẮT BUỘC: Khẳng định trực diện "${e1}" và "${e2}" không phải là hai người khác nhau mà là CÙNG MỘT NGƯỜI (CÙNG MỘT NHÂN VẬT LỊCH SỬ: ${canon.canonicalName}).
2. BỐI CẢNH DANH XƯNG: Giải thích bối cảnh tên gọi của ${canon.canonicalName}: "${e1}" và "${e2}" là các danh xưng khác nhau qua các giai đoạn lịch sử (tên khai sinh/tên húy vs niên hiệu hoàng đế/miếu hiệu/bí danh).
3. BÁC BỎ QUAN HỆ THÂN TỘC GIỮA HAI TÊN GỌI: Vì "${e1}" và "${e2}" là cùng một người, nên dứt khoát không có quan hệ họ hàng hay thân tộc giữa hai danh xưng này.`;

  if (fam) {
    const famDetails: string[] = [];
    if (fam.father || fam.mother) {
      famDetails.push(`Phụ mẫu: ${[fam.father, fam.mother].filter(Boolean).join(', ')}`);
    }
    if (fam.siblings && fam.siblings.length > 0) {
      famDetails.push(`Anh/em ruột: ${fam.siblings.join(', ')}`);
    }
    if (fam.children && fam.children.length > 0) {
      famDetails.push(`Con cái: ${fam.children.join(', ')}`);
    }
    if (famDetails.length > 0) {
      directive += `\n4. THÂN TỘC CHÍNH SỬ ĐỐI CHIẾU (TUYỆT ĐỐI KHÔNG GÁN GHÉP NHẦM LẪN THẾ HỆ HAY ĐẢO LỘN ANH EM VÀO CON CÁI):
   - ${famDetails.join('\n   - ')}`;
    }
  }

  const queryLower = (query || '').toLowerCase();
  const misconceptions = meta?.misconceptions;
  if (misconceptions && misconceptions.length > 0) {
    for (const misc of misconceptions) {
      const isTriggered =
        !query ||
        misc.triggerKeywords.length === 0 ||
        misc.triggerKeywords.some((kw) => queryLower.includes(kw.toLowerCase()));
      if (isTriggered) {
        directive += `\n5. GIẢI THÍCH NGUỒN GỐC NGỘ NHẬN LỊCH SỬ (BẮT BUỘC NÊU RÕ TRONG PHẢN HỒI):
   - ${misc.explanation}`;
      }
    }
  }

  return directive;
}

function buildKinshipDirective(
  e1: string,
  e2: string,
  canon1: HistoricalEntityInfo,
  canon2: HistoricalEntityInfo,
  isKnown1: boolean,
  isKnown2: boolean,
  trimmedQuery: string
): string {
  const isDirectKinshipPremise = /(?:anh\s+em|chị\s+em|cha\s+con|mẹ\s+con|vợ\s+chồng|ông\s+cháu|cột\s+chèo|con\s+trai|con\s+gái)/i.test(trimmedQuery);
  const isLineageOrClanAsked = /(?:huyết\s+thống|dòng\s+dõi|dòng\s+họ|tổ\s+tiên|hậu\s+duệ|thế\s+thứ|truyền\s+thừa)/i.test(trimmedQuery);
  const isOpenRelationAsked = /(?:quan\s+hệ|mối\s+quan\s+hệ|liên\s+quan)\s+(?:gì|như\s+thế\s+nào|ra\s+sao|với\s+nhau)/i.test(trimmedQuery);

  if (isKnown1 && isKnown2) {
    const t1 = canon1.timeRange;
    const t2 = canon2.timeRange;
    let isDifferentEras = false;
    let eraDiffDescription = '';
    let gap = 0;

    if (t1?.start !== undefined && t2?.start !== undefined) {
      const s1 = t1.start;
      const e1End = t1.end ?? t1.start;
      const s2 = t2.start;
      const e2End = t2.end ?? t2.start;

      gap = Math.max(0, s2 - e1End, s1 - e2End);
      if (gap >= 80) {
        isDifferentEras = true;
        const fmtYear = (y: number) => (y < 0 ? `${Math.abs(y)} TCN` : `${y}`);
        const timeDesc1 = t1.end ? `(khoảng ${fmtYear(s1)} - ${fmtYear(t1.end)})` : `(năm ${fmtYear(s1)})`;
        const timeDesc2 = t2.end ? `(khoảng ${fmtYear(s2)} - ${fmtYear(t2.end)})` : `(năm ${fmtYear(s2)})`;
        eraDiffDescription = `"${canon1.canonicalName}" ${timeDesc1} và "${canon2.canonicalName}" ${timeDesc2} sống cách nhau hơn ${Math.round(gap)} năm (thuộc hai thời kỳ lịch sử hoàn toàn khác nhau)`;
      }
    }

    if (isDifferentEras) {
      const isSameDynastyOrClan =
        Boolean(canon1.dynasty && canon2.dynasty && canon1.dynasty.toLowerCase() === canon2.dynasty.toLowerCase());

      if (isLineageOrClanAsked && isSameDynastyOrClan) {
        return `LÀM RÕ QUAN HỆ TỔ TIÊN - HẬU DUỆ & KHÁC BIỆT THẾ HỆ: Người dùng đang hỏi về quan hệ dòng tộc giữa "${e1}" và "${e2}". Cả hai nhân vật đều có thật trong lịch sử (${eraDiffDescription}). Do khoảng cách thời gian lớn (${Math.round(gap)} năm), dứt khoát KHÔNG THỂ có quan hệ thân tộc trực tiếp cùng thế hệ (như anh em, cha con). BẮT BUỘC:
- Làm rõ quan hệ thế hệ / tổ tiên - hậu duệ kế thừa hợp pháp trong hoàng tộc/vương triều ${canon1.dynasty}.
- Bác bỏ dứt khoát các tiền đề nhầm lẫn gán ghép hai người là anh em, cha con trực tiếp.`;
      }

      return `BẮT BUỘC BÁC BỎ TIỀN ĐỀ QUAN HỆ THÂN TỘC DO KHÁC BIỆT THỜI ĐẠI: Người dùng đang hỏi về quan hệ họ hàng giữa "${e1}" và "${e2}". Cả hai nhân vật đều có thật trong lịch sử, nhưng ${eraDiffDescription}, do đó dứt khoát KHÔNG THỂ có quan hệ anh em, cha con hay thân tộc trực tiếp. BẮT BUỘC phải bác bỏ rõ ràng ngay từ đầu (ví dụ: "${e1} và ${e2} không phải là anh em và không có quan hệ thân tộc trực tiếp..."), khẳng định niên đại, bối cảnh lịch sử thực tế của từng nhân vật và làm rõ sự trùng hợp về họ (nếu có).`;
    } else {
      return `KIỂM CHỨNG QUAN HỆ LỊCH SỬ KHÁCH QUAN: Người dùng đang hỏi về mối quan hệ giữa "${e1}" và "${e2}". Cả hai nhân vật đều có thật trong lịch sử và sống trong cùng thời kỳ. BẮT BUỘC đối chiếu kỹ thông tin trong <verified_master_entities> và <verified_rag_evidence> để xác định chính xác mối quan hệ:
- Nếu thực sự là anh em ruột/thân tộc (ví dụ Nguyễn Nhạc, Nguyễn Huệ, Nguyễn Lữ là anh em Tây Sơn Tam Kiệt, con của Hồ Phi Phúc; Trưng Trắc và Trưng Nhị là hai chị em ruột con Lạc tướng Mê Linh; Trần Liễu và Trần Cảnh là hai anh em ruột con Thái thượng hoàng Trần Thừa): BẮT BUỘC khẳng định rõ ràng mối quan hệ, nêu phụ mẫu và bối cảnh gia đình.
- Nếu là hai nhân vật cùng thời nhưng không có quan hệ họ hàng: giải thích rõ quan hệ thực tế giữa họ, không gán ghép sai lệch.
- TUYỆT ĐỐI KHÔNG bác bỏ khi chưa kiểm tra thẻ thực thể và chứng cứ lịch sử.`;
    }
  } else if (isKnown1 && !isKnown2) {
    if (isOpenRelationAsked && !isDirectKinshipPremise) {
      return `ĐỐI CHIẾU KIỂM CHỨNG TƯ LIỆU CHÍNH SỬ VỚI NHÂN VẬT THỨ HAI: Người dùng đang hỏi về mối quan hệ giữa "${e1}" và "${e2}". Trong đó, "${e1}" là nhân vật lịch sử đã được định danh chính thức (${canon1.canonicalName}), còn "${e2}" chưa nằm trong danh mục nhân vật cốt lõi. BẮT BUỘC:
- Đối chiếu kỹ lưỡng thông tin trong <verified_rag_evidence>: Nếu tài liệu RAG có ghi chép chính sử về "${e2}" (ví dụ danh tướng, chiến hữu, tướng lĩnh hoặc quý tộc cùng thời), hãy trình bày khách quan và chuẩn xác mối quan hệ thực tế giữa hai người.
- Nếu tài liệu RAG hoàn toàn không có ghi chép về "${e2}" hoặc không có bất kỳ liên hệ lịch sử nào với "${canon1.canonicalName}", hãy nêu rõ không có tư liệu chính sử ghi nhận về mối quan hệ này. TUYỆT ĐỐI KHÔNG tự phỏng đoán hay thêu dệt phả hệ hư cấu.`;
    }
    const realSiblings = canon1.namingMetadata?.familyLineage?.siblings;
    const siblingClarification = realSiblings && realSiblings.length > 0
      ? ` BẮT BUỘC nêu rõ thân tộc/anh em ruột thực sự được chính sử ghi chép của "${canon1.canonicalName}" là: ${realSiblings.join(', ')}.`
      : ` Chủ động trình bày thân tộc/anh em ruột thực sự của "${canon1.canonicalName}" đã được chính sử ghi chép để làm rõ bối cảnh.`;
    return `BẮT BUỘC BÁC BỎ QUAN HỆ VỚI NHÂN VẬT CHƯA XÁC MINH: Người dùng đang hỏi về quan hệ giữa "${e1}" và "${e2}". Trong đó, "${e1}" là nhân vật lịch sử có thật (${canon1.canonicalName}), còn "${e2}" KHÔNG CÓ trong chính sử Việt Nam với tư cách thân tộc của "${e1}".
- Bác bỏ dứt khoát quan hệ thân tộc giữa hai người.${siblingClarification}
- TUYỆT ĐỐI KHÔNG phỏng đoán "${e2}" là ai hay cho rằng "${e2}" là tên gọi khác/bí danh của bất kỳ ai khác, và TUYỆT ĐỐI KHÔNG kết luận phủ định rằng "${e2}" hoàn toàn không tồn tại trong toàn bộ lịch sử Việt Nam (chỉ kết luận không có quan hệ thân tộc với "${canon1.canonicalName}").`;
  } else if (!isKnown1 && isKnown2) {
    if (isOpenRelationAsked && !isDirectKinshipPremise) {
      return `ĐỐI CHIẾU KIỂM CHỨNG TƯ LIỆU CHÍNH SỬ VỚI NHÂN VẬT THỨ HAI: Người dùng đang hỏi về mối quan hệ giữa "${e1}" và "${e2}". Trong đó, "${e2}" là nhân vật lịch sử đã được định danh chính thức (${canon2.canonicalName}), còn "${e1}" chưa nằm trong danh mục nhân vật cốt lõi. BẮT BUỘC:
- Đối chiếu kỹ lưỡng thông tin trong <verified_rag_evidence>: Nếu tài liệu RAG có ghi chép chính sử về "${e1}" (ví dụ danh tướng, chiến hữu, tướng lĩnh hoặc quý tộc cùng thời), hãy trình bày khách quan và chuẩn xác mối quan hệ thực tế giữa hai người.
- Nếu tài liệu RAG hoàn toàn không có ghi chép về "${e1}" hoặc không có bất kỳ liên hệ lịch sử nào với "${canon2.canonicalName}", hãy nêu rõ không có tư liệu chính sử ghi nhận về mối quan hệ này. TUYỆT ĐỐI KHÔNG tự phỏng đoán hay thêu dệt phả hệ hư cấu.`;
    }
    const realSiblings = canon2.namingMetadata?.familyLineage?.siblings;
    const siblingClarification = realSiblings && realSiblings.length > 0
      ? ` BẮT BUỘC nêu rõ thân tộc/anh em ruột thực sự được chính sử ghi chép của "${canon2.canonicalName}" là: ${realSiblings.join(', ')}.`
      : ` Chủ động trình bày thân tộc/anh em ruột thực sự của "${canon2.canonicalName}" đã được chính sử ghi chép để làm rõ bối cảnh.`;
    return `BẮT BUỘC BÁC BỎ QUAN HỆ VỚI NHÂN VẬT CHƯA XÁC MINH: Người dùng đang hỏi về quan hệ giữa "${e1}" và "${e2}". Trong đó, "${e2}" là nhân vật lịch sử có thật (${canon2.canonicalName}), còn "${e1}" KHÔNG CÓ trong chính sử Việt Nam với tư cách thân tộc của "${e2}".
- Bác bỏ dứt khoát quan hệ thân tộc giữa hai người.${siblingClarification}
- TUYỆT ĐỐI KHÔNG phỏng đoán "${e1}" là ai hay cho rằng "${e1}" là tên gọi khác/bí danh của bất kỳ ai khác, và TUYỆT ĐỐI KHÔNG kết luận phủ định rằng "${e1}" hoàn toàn không tồn tại trong toàn bộ lịch sử Việt Nam (chỉ kết luận không có quan hệ thân tộc với "${canon2.canonicalName}").`;
  } else {
    return `BẮT BUỘC KIỂM TRA TƯ LIỆU LỊCH SỬ: Người dùng đang hỏi về quan hệ giữa "${e1}" và "${e2}". Cả hai tên gọi đều chưa rõ trong chính sử, hãy nêu rõ giới hạn tư liệu và không tự suy đoán phả hệ hư cấu.`;
  }
}

/**
 * Analyzes whether a query contains a leading question that might trick the LLM into sycophancy.
 */
export function analyzePremiseAndLeadingIntent(query: string): PremiseAnalysisResult {
  const trimmed = query.trim();

  // 1. Robust Multi-Entity Analysis (Invariant to leading interrogatives and phrase permutations)
  const spotted = extractRecognizedOrProperNounEntities(trimmed);
  if (spotted.length >= 2) {
    const resolvedList = spotted.map((name) => ({
      name,
      canon: resolveCanonicalEntity(name),
      isKnown: isKnownMasterEntity(name),
    }));

    // Filter person subjects (excluding locations, events, dynasties, artifacts, docs)
    const personItems = resolvedList.filter((item) => {
      const t = item.canon.type;
      return !(t === 'LOCATION' || t === 'EVENT_BATTLE' || t === 'DYNASTY_ERA' || t === 'ORGANIZATION' || t === 'ARTIFACT' || t === 'DOCUMENT_CULTURE');
    });

    const candidateItems = personItems.length >= 2 ? personItems : resolvedList;

    // Group mentions by canonical persona to condense co-referent alias pairs
    const personaMap = new Map<string, typeof resolvedList>();
    for (const item of candidateItems) {
      const isPerson = item.canon.type === 'HISTORICAL_PERSON' || item.canon.entityId.startsWith('person_') || Boolean(HISTORICAL_PERSON_DICTIONARY[item.canon.entityId]);
      const pKey = isPerson ? item.canon.entityId : item.name.toLowerCase();
      if (!personaMap.has(pKey)) {
        personaMap.set(pKey, []);
      }
      personaMap.get(pKey)!.push(item);
    }

    const distinctPersonaKeys = Array.from(personaMap.keys());
    const distinctKnownPersonaKeys = distinctPersonaKeys.filter((k) => k.startsWith('person_') || Boolean(HISTORICAL_PERSON_DICTIONARY[k]));

    // 1a. If ALL KNOWN candidate personas map to exactly ONE canonical persona (e.g. Quang Trung & Nguyễn Huệ, Nguyễn Tất Thành & Văn Ba)
    if (distinctKnownPersonaKeys.length === 1 && personaMap.get(distinctKnownPersonaKeys[0])!.length >= 2) {
      const mentions = personaMap.get(distinctKnownPersonaKeys[0])!;
      const itemA = mentions[0];
      const itemB = mentions.length > 1 ? mentions[1] : mentions[0];
      const isEventOrActionInquiry = /(?:chiến\s+dịch|trận|trận\s+đánh|đánh|đánh\s+đuổi|khởi\s+nghĩa|chỉ\s+huy|lãnh\s+đạo|tác\s+chiến|phối\s+hợp|phân\s+công|nhiệm\s+vụ|ra\s+đi|tìm\s+đường|lên\s+tàu|ký|hội\s+nghị|sáng\s+lập|định\s+đô|dời\s+đô|xây\s+dựng|cùng\s+(?:nhau\s+)?(?:làm|đánh|chỉ\s+huy|lãnh\s+đạo|chiến\s+đấu|khởi\s+nghĩa))/i.test(trimmed);

      const allEntities = Array.from(new Set([itemA.name, itemB.name, ...spotted]));

      if (isEventOrActionInquiry) {
        return {
          isLeadingQuestion: true,
          isSameEntityCoReference: true,
          questionType: 'EVENT',
          detectedEntities: allEntities,
          suggestedDirective: buildSameEntityEventDirective(itemA.name, itemB.name, itemA.canon, trimmed),
        };
      } else {
        const isKinshipAsked = /(?:anh\s+em|chị\s+em|cha\s+con|mẹ\s+con|vợ\s+chồng|ông\s+cháu|họ\s+hàng|thân\s+tộc|huyết\s+thống|cột\s+chèo|con\s+trai|con\s+gái|quan\s+hệ|liên\s+quan)/i.test(trimmed);
        return {
          isLeadingQuestion: true,
          isSameEntityCoReference: true,
          questionType: isKinshipAsked ? 'KINSHIP' : 'IDENTITY',
          detectedEntities: allEntities,
          suggestedDirective: buildSameEntityCoReferenceDirective(itemA.name, itemB.name, itemA.canon, trimmed),
        };
      }
    }

    // 1b. If there are 2 or more distinct personas (e.g. Trần Liễu vs Trần Thái Tông / Trần Cảnh)
    // Co-reference must NOT be true. Check for Kinship or comparative relation between the distinct personas.
    if (distinctPersonaKeys.length >= 2) {
      const personaA = personaMap.get(distinctPersonaKeys[0])![0];
      const personaB = personaMap.get(distinctPersonaKeys[1])![0];
      const isKinshipAsked = /(?:anh\s+em|chị\s+em|cha\s+con|mẹ\s+con|vợ\s+chồng|ông\s+cháu|họ\s+hàng|thân\s+tộc|huyết\s+thống|cột\s+chèo|con\s+trai|con\s+gái|quan\s+hệ|liên\s+quan)/i.test(trimmed);

      if (isKinshipAsked) {
        return {
          isLeadingQuestion: true,
          isSameEntityCoReference: undefined,
          questionType: 'KINSHIP',
          detectedEntities: spotted,
          suggestedDirective: buildKinshipDirective(
            personaA.name,
            personaB.name,
            personaA.canon,
            personaB.canon,
            personaA.isKnown,
            personaB.isKnown,
            trimmed
          ),
        };
      }
    }
  }

  // 2. Kinship regex patterns fallback (for queries with unconventional phrasing or pro-drop)
  for (const pattern of KINSHIP_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const e1 = cleanEntitySpan(match[1] || '');
      const e2 = cleanEntitySpan(match[2] || '');

      const canon1 = resolveCanonicalEntity(e1);
      const canon2 = resolveCanonicalEntity(e2);

      if (canon1.entityId && canon2.entityId && canon1.entityId === canon2.entityId) {
        return {
          isLeadingQuestion: true,
          isSameEntityCoReference: true,
          questionType: 'KINSHIP',
          detectedEntities: [e1, e2].filter(Boolean),
          suggestedDirective: buildSameEntityCoReferenceDirective(e1, e2, canon1, trimmed),
        };
      }

      const isKnown1 = isKnownMasterEntity(e1);
      const isKnown2 = isKnownMasterEntity(e2);

      return {
        isLeadingQuestion: true,
        questionType: 'KINSHIP',
        detectedEntities: [e1, e2].filter(Boolean),
        suggestedDirective: buildKinshipDirective(e1, e2, canon1, canon2, isKnown1, isKnown2, trimmed),
      };
    }
  }

  // 1b. Generic dual-entity co-reference check if query mentions two names separated by "và" / "với"
  const andMatch = trimmed.match(/(.+?)\s+(?:và|với)\s+(.+?)(?:\s+|$|\?)/i);
  if (andMatch) {
    const e1 = cleanEntitySpan(andMatch[1] || '');
    const e2 = cleanEntitySpan(andMatch[2] || '');
    const canon1 = resolveCanonicalEntity(e1);
    const canon2 = resolveCanonicalEntity(e2);
    if (canon1.entityId && canon2.entityId && canon1.entityId === canon2.entityId) {
      return {
        isLeadingQuestion: true,
        isSameEntityCoReference: true,
        questionType: 'IDENTITY',
        detectedEntities: [e1, e2].filter(Boolean),
        suggestedDirective: `BẮT BUỘC ĐÍNH CHÍNH CÙNG MỘT NGƯỜI (ANTI-CO-REFERENCE ERROR): "${e1}" và "${e2}" không phải là hai người khác nhau mà là CÙNG MỘT NGƯỜI (${canon1.canonicalName}). BẮT BUỘC phải khẳng định ngay ở câu đầu tiên rằng hai danh xưng này là cùng một người (${e1} và ${e2} là các tên gọi, tên húy, niên hiệu, tôn hiệu hoặc tước hiệu khác nhau của cùng một nhân vật qua các thời kỳ). TUYỆT ĐỐI KHÔNG tách thành hai nhân vật hay nhận định là quan hệ anh em/họ hàng/thân tộc.`,
      };
    }
  }

  // 2. Dynasty / Monarch leading question check
  for (const pattern of DYNASTY_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const e1 = cleanEntitySpan(match[1] || '');
      const e2 = cleanEntitySpan(match[2] || '');
      return {
        isLeadingQuestion: true,
        questionType: 'DYNASTY',
        detectedEntities: [e1, e2].filter(Boolean),
        suggestedDirective: `BẮT BUỘC KIỂM TRA TIỀN ĐỀ TRIỀU ĐẠI: Người dùng đang hỏi gán ghép nhân vật "${e1}" với triều đại "${e2}". Hãy kiểm tra chính xác triều đại lịch sử thực tế và đính chính ngay nếu tiền đề sai lệch. Tuyệt đối không suy đoán nếu không có trong chính sử.`,
      };
    }
  }

  // 3. Sycophancy / False lineage flattery check
  for (const pattern of SYCOPHANCY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isLeadingQuestion: true,
        questionType: 'IDENTITY',
        categoryLabel: 'Gia phả tư nhân',
        detectedEntities: spotted,
        suggestedDirective: 'BẮT BUỘC BÁC BỎ HOẶC GIỮ NGUYÊN TẮC HỌC THUẬT: Không phụ họa vào các tuyên bố gia phả tư nhân hoặc nguồn gốc chưa qua kiểm chứng học thuật.',
      };
    }
  }

  // 4. Anachronism weapon/era check
  const isWhitelistedFeudal = FEUDAL_WEAPONS_WHITELIST.test(trimmed);
  const hasDigitalAnachronism = MODERN_DIGITAL_ANACHRONISM_PATTERNS.some((p) => p.test(trimmed));
  const hasModernMilitary = MODERN_MILITARY_PATTERNS.some((p) => p.test(trimmed));
  const hasFeudalContext =
    ANCIENT_FEUDAL_CONTEXT_PATTERNS.test(trimmed) ||
    (/\b(4\d|5\d|[6-9]\d{2}|1[0-8]\d{2})\b/.test(trimmed) && !/\b(19\d{2}|20\d{2})\b/.test(trimmed));

  const isAnachronistic =
    (!isWhitelistedFeudal && hasDigitalAnachronism) ||
    (!isWhitelistedFeudal && hasModernMilitary && hasFeudalContext);

  if (isAnachronistic) {
    return {
      isLeadingQuestion: true,
      questionType: 'CHRONOLOGY',
      categoryLabel: 'Công nghệ vũ khí',
      detectedEntities: spotted,
      suggestedDirective: 'BẮT BUỘC BÁC BỎ SAI LỆCH NIÊN ĐẠI CÔNG NGHỆ: BẮT BUỘC phải bác bỏ rõ ràng ngay ở câu đầu tiên (ví dụ: "Không, vào thời kỳ [X] hoàn toàn chưa có [vũ khí/công nghệ Y]..."). Nêu rõ vũ khí và bối cảnh lịch sử thực tế thời đó. TUYỆT ĐỐI KHÔNG giải thích dông dài hay mô tả thông số các loại máy bay, súng đạn hiện đại không liên quan.',
    };
  }

  // 5. Folklore / Myth claim check
  for (const pattern of FOLKLORE_AS_FACT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isLeadingQuestion: true,
        questionType: 'GENERAL',
        categoryLabel: 'Truyền thuyết thần thoại',
        detectedEntities: spotted,
        suggestedDirective: 'BẮT BUỘC PHÂN ĐỊNH DÃ SỬ & CHÍNH SỬ: Phân định rõ ranh giới giữa biểu tượng truyền thuyết thần thoại dân gian và sự kiện thực chứng trong chính sử. Bác bỏ các chi tiết gán ghép sai lệch về địa danh, nhân vật hoặc niên đại; nêu rõ địa danh và tình tiết lịch sử/dân gian chính xác.',
      };
    }
  }

  // 6. Mixed Premise check
  for (const pattern of MIXED_PREMISE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isLeadingQuestion: true,
        questionType: 'GENERAL',
        categoryLabel: 'Tiền đề hỗn hợp',
        detectedEntities: spotted,
        suggestedDirective: 'BẮT BUỘC KIỂM TRA TỪNG MỆNH ĐỀ: Phân tách rõ phần đúng và phần sai trong câu hỏi.',
      };
    }
  }

  // 7. Military Ordnance Reuse / Field Repair Conflation Check (Task 4)
  const MISSILE_REUSE_PATTERN = /(?:thu\s*hồi.*tên\s*lửa|tái\s*sử\s*dụng.*tên\s*lửa|bắn\s+lại.*tên\s*lửa|tên\s*lửa.*bắn\s+xong.*thu\s*hồi|bắn\s+tên\s*lửa\s+giả)/i;
  if (MISSILE_REUSE_PATTERN.test(trimmed)) {
    return {
      isLeadingQuestion: true,
      questionType: 'EVENT',
      categoryLabel: 'Học thuyết khí tài quân sự',
      detectedEntities: spotted,
      suggestedDirective: 'BẮT BUỘC BÁC BỎ SAI LỆCH VỀ TÁI SỬ DỤNG VŨ KHÍ: BẮT BUỘC câu đầu tiên phải bác bỏ dứt khoát tiền đề sai lệch. Tên lửa phòng không (SAM-2) và đạn pháo hạng nặng là vũ khí tiêu hao một lần, khi đã bắn ra/phát nổ thì KHÔNG THỂ thu hồi để tái sử dụng hay bắn lại. Xưởng/Nhà máy A31 là nơi bảo dưỡng, nâng cấp khí tài radar dẫn đường (như đài Fan Song/P-12) và kiểm tra, lắp ráp, hiệu chỉnh tham số quả đạn trước khi phóng, hoàn toàn không có việc thu hồi tên lửa đã bắn.',
    };
  }

  // 8. Linebacker II Campaign Temporal Bounds Check (Task 4)
  const LINEBACKER_DATE_MISMATCH_PATTERN = /(?:12\s+ngày\s+đêm|điện\s+biên\s+phủ\s+trên\s+không|linebacker\s*(?:ii|2)).*(?:kéo\s+dài|diễn\s+ra|tháng\s+1|năm\s+1973|sang\s+năm\s+1973)/i;
  if (LINEBACKER_DATE_MISMATCH_PATTERN.test(trimmed)) {
    return {
      isLeadingQuestion: true,
      questionType: 'CHRONOLOGY',
      categoryLabel: 'Mốc thời gian chiến dịch',
      detectedEntities: spotted,
      suggestedDirective: 'BẮT BUỘC KHỐNG CHẾ MỐC THỜI GIAN CHIẾN DỊCH 12 NGÀY ĐÊM: Chiến dịch diễn ra chính xác từ ngày 18/12/1972 đến ngày 30/12/1972 (khi Tổng thống Nixon tuyên bố ngừng ném bom từ vĩ tuyến 20 trở ra Bắc). Chiến dịch kết thúc trọn vẹn trong năm 1972, không kéo dài sang năm 1973. Thắng lợi của chiến dịch buộc Mỹ phải ký kết Hiệp định Paris vào ngày 27/01/1973.',
    };
  }

  // 9. Trần Thiêm Bình false usurpation premise check (Task 3)
  const TRAN_THIEM_BINH_PATTERN = /(?:cướp\s+ngôi|phế\s+truất|thay\s+thế|lật\s+đổ).*Trần\s+Thiêm\s+Bình|Trần\s+Thiêm\s+Bình.*(?:cướp\s+ngôi|làm\s+vua|bị\s+phế|nhà\s+trần)/i;
  if (TRAN_THIEM_BINH_PATTERN.test(trimmed)) {
    return {
      isLeadingQuestion: true,
      questionType: 'DYNASTY',
      categoryLabel: 'Chính biến vương triều',
      detectedEntities: spotted,
      suggestedDirective: 'BẮT BUỘC BÁC BỎ TIỀN ĐỀ VỀ TRẦN THIÊM BÌNH: BẮT BUỘC câu đầu tiên phải bác bỏ dứt khoát. Người bị Hồ Quý Ly truất ngôi năm 1400 là vua Trần Thiếu Đế (vị vua cuối cùng của nhà Trần). Trần Thiêm Bình (tên thật là Nguyễn Khang) là gia nô mạo xưng tôn thất nhà Trần chạy sang cầu viện nhà Minh, KHÔNG PHẢI là vua và KHÔNG PHẢI người bị Hồ Quý Ly cướp ngôi.',
    };
  }

  // 10. Lê Hoàn vs Nhà Lý false dynasty premise check (Task 3)
  const LE_HOAN_LY_PATTERN = /(?:Lê\s+Hoàn|Lê\s+Đại\s+Hành).*(?:thuộc|của|vua)?\s*nhà\s+Lý|nhà\s+Lý.*(?:năm\s+981|Bạch\s+Đằng\s+981|Lê\s+Hoàn)/i;
  if (LE_HOAN_LY_PATTERN.test(trimmed)) {
    return {
      isLeadingQuestion: true,
      questionType: 'DYNASTY',
      categoryLabel: 'Quy thuộc triều đại',
      detectedEntities: spotted,
      suggestedDirective: 'BẮT BUỘC BÁC BỎ TIỀN ĐỀ VỀ LÊ HOÀN VÀ NHÀ LÝ: BẮT BUỘC câu đầu tiên khẳng định Lê Hoàn thuộc triều Tiền Lê (trị vì 980-1005). Chiến thắng Bạch Đằng năm 981 là chiến công oanh liệt của triều Tiền Lê. Nhà Lý thành lập năm 1009 bởi Lý Thái Tổ (Lý Công Uẩn), sau khi triều Tiền Lê kết thúc, nên không liên quan đến chiến thắng năm 981.',
    };
  }

  return {
    isLeadingQuestion: false,
    questionType: 'GENERAL',
    detectedEntities: spotted,
    suggestedDirective: '',
  };
}

export interface CoReferenceInvariantResult {
  isValid: boolean;
  sanitized: string;
  violation?: string;
}

/**
 * Invariant Semantic Verification for Co-Referent Historical Entities.
 * When entity1 and entity2 are aliases of the same canonical persona (e.g. Quang Trung and Nguyễn Huệ),
 * this guardrail ensures that the generated text does NOT contradict itself by asserting that entity1 and
 * entity2 are bilateral distinct subjects, two different people, or brothers with each other.
 * 
 * NOTE: Anti-overfitting principle: This does NOT ban phrases like "hai anh em" or "anh em cột chèo" globally,
 * preserving authentic historical facts (e.g. Nguyễn Nhạc and Nguyễn Huệ are brothers; Nguyễn Huệ and Nguyễn Ánh
 * are brothers-in-law).
 */
function isClauseNegatedOrRefuted(text: string, matchIndex: number, matchLength: number): boolean {
  const windowBefore = text.slice(Math.max(0, matchIndex - 80), matchIndex).toLowerCase();
  const windowAfter = text.slice(matchIndex + matchLength, Math.min(text.length, matchIndex + matchLength + 80)).toLowerCase();

  const negationBefore = /(?:không\s+phải|không\s+có\s+chuyện|lầm\s+tưởng|sai\s+lầm|ngộ\s+nhận|bác\s+bỏ|chưa\s+từng|không\s+thể|tuyệt\s+đối\s+không)\s*(?:rằng|là)?\s*$/i.test(windowBefore);
  const negationAfter = /^(?:\s*,\s*)?(?:là\s+(?:sai|không\s+đúng|lầm\s+tưởng|không\s+chính\s+xác|ngộ\s+nhận)|nhưng\s+(?:thực\s+tế\s+)?(?:không\s+phải|sai|không\s+đúng))/i.test(windowAfter);

  return negationBefore || negationAfter;
}

export function verifyCoReferenceInvariant(
  response: string,
  entity1: string,
  entity2: string,
  canonicalName: string
): CoReferenceInvariantResult {
  if (!response || !entity1 || !entity2) {
    return { isValid: true, sanitized: response };
  }

  const e1Escaped = entity1.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const e2Escaped = entity2.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Bilateral contradiction patterns between the two aliases:
  const contradictionRegex = new RegExp(
    `(?:${e1Escaped}\\s+và\\s+${e2Escaped}|${e2Escaped}\\s+và\\s+${e1Escaped})\\s+(?:là|thực\\s+chất\\s+là|vốn\\s+là)?\\s*(?:hai|2)?\\s*(?:người|vị\\s+vua|nhân\\s+vật)?\\s*(?:anh\\s+em(?:\\s+cột\\s+chèo|\\s+ruột)?|hai\\s+người\\s+khác\\s+nhau|2\\s+người\\s+khác\\s+nhau)`,
    'gi'
  );

  // Directional kinship contradiction patterns between the two aliases:
  const directionalKinshipRegex = new RegExp(
    `(?:(?:vì\\s+vậy|do\\s+đó|như\\s+vậy|bởi\\s+vậy|tóm\\s+lại)[,\\s]+)?(?:${e1Escaped}\\s+(?:chính\\s+)?(?:là|vốn\\s+là)\\s*(?:con(?:\\s+trai|\\s+gái|\\s+ruột|\\s+nuôi)?|cha|bố|thân\\s+phụ|mẹ|thân\\s+mẫu|anh(?:\\s+trai|\\s+ruột)?|chị(?:\\s+gái|\\s+ruột)?|em(?:\\s+trai|\\s+gái|\\s+ruột)?|họ\\s+hàng)\\s+(?:của\\s+)?${e2Escaped}|${e2Escaped}\\s+(?:chính\\s+)?(?:là|vốn\\s+là)\\s*(?:con(?:\\s+trai|\\s+gái|\\s+ruột|\\s+nuôi)?|cha|bố|thân\\s+phụ|mẹ|thân\\s+mẫu|anh(?:\\s+trai|\\s+ruột)?|chị(?:\\s+gái|\\s+ruột)?|em(?:\\s+trai|\\s+gái|\\s+ruột)?|họ\\s+hàng)\\s+(?:của\\s+)?${e1Escaped})`,
    'gi'
  );

  // Pronoun contradiction pattern
  const pronounContradictionRegex = /(?:họ|hai\s+người)\s+(?:là|thực\s+chất\s+là)\s+(?:cha\s+con|anh\s+em(?:\\s+cột\\s+chèo)?|vợ\s+chồng|mẹ\s+con|ông\s+cháu)(?:[.,\s]+(?:không\s+có|tuyệt\s+đối\s+không\s+có)\s+quan\s+hệ\s+huyết\s+thống(?:\\s+với\\s+nhau)?)?[.,]?/gi;

  let sanitized = response;
  let isViolated = false;
  const violations: string[] = [];

  // 1. Bilateral contradiction check (with negation preservation)
  let contraMatch: RegExpExecArray | null;
  while ((contraMatch = contradictionRegex.exec(sanitized)) !== null) {
    if (!isClauseNegatedOrRefuted(sanitized, contraMatch.index, contraMatch[0].length)) {
      isViolated = true;
      violations.push(`Contradictory bilateral relation detected asserting that co-referent aliases "${entity1}" and "${entity2}" are distinct subjects.`);
      sanitized = sanitized.slice(0, contraMatch.index) +
        `${entity1} và ${entity2} không phải là hai người khác nhau mà là cùng một nhân vật lịch sử (${canonicalName}) qua các thời kỳ khác nhau` +
        sanitized.slice(contraMatch.index + contraMatch[0].length);
      break;
    }
  }

  // 2. Directional kinship check (with negation preservation)
  let directMatch: RegExpExecArray | null;
  while ((directMatch = directionalKinshipRegex.exec(sanitized)) !== null) {
    if (!isClauseNegatedOrRefuted(sanitized, directMatch.index, directMatch[0].length)) {
      isViolated = true;
      violations.push(`Contradictory directional kinship detected asserting that co-referent alias "${entity1}" is a relative or descendant of "${entity2}".`);
      sanitized = sanitized.slice(0, directMatch.index) +
        `${entity1} chính là ${entity2} (${canonicalName}), là cùng một người chứ không phải có quan hệ họ hàng hay cha con` +
        sanitized.slice(directMatch.index + directMatch[0].length);
      break;
    }
  }

  // 3. Pronoun contradiction check
  let pronounMatch: RegExpExecArray | null;
  while ((pronounMatch = pronounContradictionRegex.exec(sanitized)) !== null) {
    if (!isClauseNegatedOrRefuted(sanitized, pronounMatch.index, pronounMatch[0].length)) {
      isViolated = true;
      violations.push(`Contradictory pronoun kinship assertion detected after identifying same entity.`);
      sanitized = (sanitized.slice(0, pronounMatch.index) + sanitized.slice(pronounMatch.index + pronounMatch[0].length))
        .replace(/\s+([.,;:!?])/g, '$1')
        .replace(/([.,;:!?])\s*[.,;:!?]+/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();
      break;
    }
  }

  // 4. Sibling misattributed as child (e.g. "Quang Trung là cha của Nguyễn Nhạc, Nguyễn Lữ")
  // BOUND TO SUBJECT: Only fires when the subject is the persona or alias, never an external parent figure (like Hồ Phi Phúc)
  const canon = resolveCanonicalEntity(entity1);
  const canonEscaped = canon.canonicalName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const siblings = canon.namingMetadata?.familyLineage?.siblings || [];
  const subjectPrefix = `(?:${e1Escaped}|${e2Escaped}|${canonEscaped}|ông(?:\\s+ấy)?|vua|vị\\s+vua(?:\\s+này)?)`;

  for (const sibWithTitle of siblings) {
    const sibClean = sibWithTitle.replace(/\s*\([^)]*\)/g, '').trim();
    if (sibClean.length >= 3) {
      const sibEscaped = sibClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const siblingAsChildRegex = new RegExp(`(${subjectPrefix}\\s+(?:chính\\s+)?)(?:là\\s+cha\\s+của|là\\s+mẹ\\s+của)(?=\\s+[^.]*?\\b${sibEscaped}\\b)`, 'gi');
      if (siblingAsChildRegex.test(sanitized)) {
        isViolated = true;
        violations.push(`Sibling "${sibClean}" was misattributed as child of "${canonicalName}".`);
        sanitized = sanitized.replace(siblingAsChildRegex, `$1có anh/em ruột được chính sử ghi nhận là`);
      }
    }
  }

  if (isViolated) {
    return {
      isValid: false,
      sanitized,
      violation: violations.join('; '),
    };
  }

  return {
    isValid: true,
    sanitized: response,
  };
}

