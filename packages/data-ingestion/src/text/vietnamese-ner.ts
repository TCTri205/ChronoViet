/**
 * Pure TypeScript Vietnamese Historical NER Engine (Stage 1 Candidate Extractor)
 *
 * Characteristics:
 * - 100% Pure TypeScript, zero external C++ / ONNX binary dependencies
 * - Ultra-low latency (< 1ms/sentence on CPU & Apple Silicon)
 * - 3-Layer Hybrid Extractor:
 *   1. Layer 1 (Gazetteer Fast-Path): Trie / Dictionary lookup of canonical characters, locations, eras.
 *   2. Layer 2 (Rule-Based Title & Prefix Matcher): Historical honorifics, titles, geographic & military prefixes.
 *   3. Layer 3 (Proper Noun Regex Span Extractor): Vietnamese capitalized multi-syllable noun phrase capture with Unicode word boundaries.
 * - Non-overlapping span resolution with exact character offsets.
 * - Automatic type classification across 7 ChronoViet Taxonomy Types.
 */

import {
  CandidateEntitySpan,
  HISTORICAL_PERSON_DICTIONARY,
  HISTORICAL_LOCATION_DICTIONARY,
  HISTORICAL_LOCATION_MAPPINGS,
  DYNASTY_DICTIONARY,
  CORE_ORGS,
  CORE_EVENTS,
  CORE_ARTIFACTS,
  CORE_DOCS,
  CAN_CHI_SET,
  PERSON_HONORIFICS_AND_RANKS,
  getCanonicalEntityIdPrefix,
  inferEntityTypeFromName,
  resolveCanonicalEntity,
} from '@chronoviet/shared-spec';

export interface GazetteerEntry {
  canonicalId: string;
  name: string;
  type: string;
  aliases: string[];
}

// Trie node structure for sub-millisecond multi-word keyword matching
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEnd: boolean = false;
  entry?: GazetteerEntry;
}

class GazetteerTrie {
  root: TrieNode = new TrieNode();

  insert(word: string, entry: GazetteerEntry) {
    let curr = this.root;
    const normalized = word.trim().toLowerCase();
    for (const char of normalized) {
      if (!curr.children.has(char)) {
        curr.children.set(char, new TrieNode());
      }
      curr = curr.children.get(char)!;
    }
    curr.isEnd = true;
    curr.entry = entry;
  }

  searchInText(text: string): Array<{ start: number; end: number; entry: GazetteerEntry; matchedText: string }> {
    const results: Array<{ start: number; end: number; entry: GazetteerEntry; matchedText: string }> = [];
    const lowerText = text.toLowerCase();
    const len = lowerText.length;

    for (let i = 0; i < len; i++) {
      // Check unicode word boundary at start
      if (i > 0 && /[\p{L}\p{N}]/u.test(lowerText[i - 1])) {
        continue;
      }

      let curr = this.root;
      let j = i;
      let lastMatch: { start: number; end: number; entry: GazetteerEntry; matchedText: string } | null = null;

      while (j < len) {
        const char = lowerText[j];
        if (!curr.children.has(char)) {
          break;
        }
        curr = curr.children.get(char)!;
        j++;

        if (curr.isEnd && curr.entry) {
          // Check trailing unicode word boundary
          const nextChar = j < len ? lowerText[j] : ' ';
          if (!/[\p{L}\p{N}]/u.test(nextChar)) {
            const start = i;
            const end = j;
            const matchedText = text.substring(start, end);

            const isSingleWord = !curr.entry.name.includes(' ');
            const isCapitalizedInText = /^[A-ZÀ-Ỹ]/u.test(matchedText);
            if (isSingleWord && !isCapitalizedInText && (curr.entry.type === 'DYNASTY_ERA' || curr.entry.type === 'HISTORICAL_PERSON')) {
              // Skip lowercase single-syllable common words (e.g. "đường", "ngô", "minh", "hồ")
            } else {
              const entryNameLower = curr.entry.name.toLowerCase();
              const isLordGeneric = entryNameLower === 'chúa trịnh' || entryNameLower === 'chúa nguyễn';
              const remainder = text.substring(j);
              const followedByCapitalized = /^\s+[A-ZÀ-Ỹ][a-zà-ỹ]+/u.test(remainder);

              if (!isLordGeneric || !followedByCapitalized) {
                lastMatch = {
                  start,
                  end,
                  entry: curr.entry,
                  matchedText,
                };
              }
            }
          }
        }
      }

      if (lastMatch) {
        results.push(lastMatch);
      }
    }

    return results;
  }
}

// Built-in Static Gazetteer Initialization
const gazetteerTrie = new GazetteerTrie();

function initializeGazetteer() {
  function insertWithUnaccented(word: string, entry: GazetteerEntry) {
    gazetteerTrie.insert(word, entry);
    const unaccented = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
    if (unaccented && unaccented.length >= 3 && unaccented.toLowerCase() !== word.toLowerCase()) {
      gazetteerTrie.insert(unaccented, entry);
    }
  }

  // 1. Person Dictionary
  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    const entry: GazetteerEntry = {
      canonicalId: person.entityId,
      name: person.canonicalName,
      type: 'HISTORICAL_PERSON',
      aliases: person.aliases || [],
    };
    insertWithUnaccented(person.canonicalName, entry);
    for (const alias of person.aliases) {
      insertWithUnaccented(alias, entry);
    }
  }

  // 2. Location Dictionary
  for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    const entry: GazetteerEntry = {
      canonicalId: loc.entityId,
      name: loc.canonicalName,
      type: 'LOCATION',
      aliases: loc.aliases || [],
    };
    insertWithUnaccented(loc.canonicalName, entry);
    for (const alias of loc.aliases) {
      insertWithUnaccented(alias, entry);
    }
  }

  // 3. Known Dynasties, Eras, Important Documents, Artifacts, Disambiguated Battles & Historic Locations
  for (const dyn of Object.values(DYNASTY_DICTIONARY)) {
    const entry: GazetteerEntry = {
      canonicalId: dyn.entityId,
      name: dyn.canonicalName,
      type: 'DYNASTY_ERA',
      aliases: dyn.aliases || [],
    };
    insertWithUnaccented(dyn.canonicalName, entry);
    for (const al of dyn.aliases || []) insertWithUnaccented(al, entry);
  }

  for (const org of CORE_ORGS) {
    const entry: GazetteerEntry = {
      canonicalId: org.id,
      name: org.name,
      type: 'ORGANIZATION',
      aliases: org.aliases || [],
    };
    insertWithUnaccented(org.name, entry);
    for (const al of org.aliases || []) insertWithUnaccented(al, entry);
  }

  for (const ev of CORE_EVENTS) {
    const entry: GazetteerEntry = {
      canonicalId: ev.id,
      name: ev.name,
      type: 'EVENT_BATTLE',
      aliases: ev.aliases || [],
    };
    insertWithUnaccented(ev.name, entry);
    for (const al of ev.aliases || []) insertWithUnaccented(al, entry);
  }

  for (const art of CORE_ARTIFACTS) {
    const entry: GazetteerEntry = {
      canonicalId: art.id,
      name: art.name,
      type: 'ARTIFACT',
      aliases: art.aliases || [],
    };
    insertWithUnaccented(art.name, entry);
    for (const al of art.aliases || []) insertWithUnaccented(al, entry);
  }

  for (const doc of CORE_DOCS) {
    const entry: GazetteerEntry = {
      canonicalId: doc.id,
      name: doc.name,
      type: 'DOCUMENT_CULTURE',
      aliases: doc.aliases || [],
    };
    insertWithUnaccented(doc.name, entry);
    for (const al of doc.aliases || []) insertWithUnaccented(al, entry);
  }

  const CORE_HISTORICAL_ENTITIES: Array<{ name: string; type: string; aliases?: string[] }> = [
    { name: 'Hồng Bàng', type: 'DYNASTY_ERA', aliases: ['Thời kỳ Hồng Bàng', 'Thời đại Hồng Bàng', 'Hồng Bàng / Văn Lang'] },
    { name: 'Đông Sơn', type: 'DYNASTY_ERA', aliases: ['Văn hóa Đông Sơn'] },
    { name: 'Đàng Trong', type: 'LOCATION' },
    { name: 'Đàng Ngoài', type: 'LOCATION' },
    { name: 'Đông Anh', type: 'LOCATION' },
    { name: 'Đà Nẵng', type: 'LOCATION' },
    { name: 'Quảng Trị', type: 'LOCATION' },
    { name: 'Trung Kỳ', type: 'LOCATION' },
    { name: 'Yên Bái', type: 'LOCATION' },
    { name: 'Yên Tử', type: 'LOCATION' },
    { name: 'Gò Công', type: 'LOCATION' },
    { name: 'Tân An', type: 'LOCATION' },
    { name: 'Thành nhà Hồ', type: 'LOCATION', aliases: ['Tây Đô', 'thành Tây Đô'] },
    { name: 'thành Cổ Loa', type: 'LOCATION', aliases: ['Cổ Loa'] },
    { name: 'Điện Biên Phủ', type: 'LOCATION' },
    { name: 'ấp Tây Sơn', type: 'LOCATION' },
    { name: 'sông Như Nguyệt', type: 'LOCATION', aliases: ['Như Nguyệt'] },
    { name: 'sông Gianh', type: 'LOCATION' },
    { name: 'sông Bạch Đằng', type: 'LOCATION', aliases: ['Bạch Đằng'] },
    { name: 'Phong Châu', type: 'LOCATION' },
    { name: 'Mê Linh', type: 'LOCATION' },
    { name: 'Hát Môn', type: 'LOCATION' },
    { name: 'Luy Lâu', type: 'LOCATION' },
    { name: 'Hoa Lư', type: 'LOCATION', aliases: ['cố đô Hoa Lư'] },
    { name: 'Thăng Long', type: 'LOCATION', aliases: ['kinh thành Thăng Long', 'Đông Đô', 'Đại La', 'thành Đại La'] },
    { name: 'Đông Quan', type: 'LOCATION', aliases: ['thành Đông Quan'] },
    { name: 'Phú Xuân', type: 'LOCATION', aliases: ['kinh đô Phú Xuân'] },
    { name: 'Chi Lăng', type: 'LOCATION', aliases: ['ải Chi Lăng'] },
    { name: 'Xương Giang', type: 'LOCATION', aliases: ['thành Xương Giang'] },
    { name: 'Ngọc Hồi', type: 'LOCATION', aliases: ['đồn Ngọc Hồi'] },
    { name: 'Đống Đa', type: 'LOCATION', aliases: ['gò Đống Đa'] },
    { name: 'Mường Thanh', type: 'LOCATION' },
    { name: 'Văn Miếu', type: 'LOCATION', aliases: ['Văn Miếu - Quốc Tử Giám'] },
    { name: 'Phùng Nguyên', type: 'LOCATION', aliases: ['di chỉ Phùng Nguyên', 'Văn hóa Phùng Nguyên', 'văn hoá Phùng Nguyên'] },
    { name: 'Đồng Đậu', type: 'LOCATION', aliases: ['di chỉ Đồng Đậu', 'Văn hóa Đồng Đậu', 'văn hoá Đồng Đậu'] },
    { name: 'Gò Mun', type: 'LOCATION', aliases: ['di chỉ Gò Mun', 'Văn hóa Gò Mun', 'văn hoá Gò Mun'] },
    { name: 'Sa Huỳnh', type: 'LOCATION', aliases: ['di chỉ Sa Huỳnh', 'Văn hóa Sa Huỳnh', 'văn hoá Sa Huỳnh'] },
    { name: 'Óc Eo', type: 'LOCATION', aliases: ['di chỉ Óc Eo', 'Văn hóa Óc Eo', 'văn hoá Óc Eo'] },
    { name: 'Quảng trường Ba Đình', type: 'LOCATION', aliases: ['Ba Đình', 'quảng trường Ba Đình'] },
    { name: 'đầm Dạ Trạch', type: 'LOCATION', aliases: ['Dạ Trạch', 'Đầm Dạ Trạch'] },
    { name: 'đầm Thị Nại', type: 'LOCATION', aliases: ['Thị Nại'] },
    { name: 'Mai Thúc Loan', type: 'HISTORICAL_PERSON', aliases: ['Mai Hắc Đế'] },
    { name: 'Hồ Nguyên Trừng', type: 'HISTORICAL_PERSON' },
    { name: 'đình Tây Đằng', type: 'LOCATION', aliases: ['đình làng Tây Đằng', 'Đình Tây Đằng'] },
  ];

  for (const ent of CORE_HISTORICAL_ENTITIES) {
    const resolved = resolveCanonicalEntity(ent.name);
    const prefix = getCanonicalEntityIdPrefix(ent.type);
    const canonicalId = (resolved && resolved.entityId) ? resolved.entityId : `${prefix}${slugify(ent.name)}`;
    const entry: GazetteerEntry = {
      canonicalId,
      name: ent.name,
      type: ent.type,
      aliases: ent.aliases || [],
    };
    insertWithUnaccented(ent.name, entry);
    if (ent.aliases) {
      for (const al of ent.aliases) {
        insertWithUnaccented(al, entry);
      }
    }
  }
}

initializeGazetteer();

/**
 * Stopwords & generic exclusion terms
 */
export const GENERIC_EXCLUSION_TERMS = new Set([
  'năm', 'tháng', 'ngày', 'giờ', 'vào', 'thời', 'thời kỳ', 'thời đại', 'giai đoạn',
  'khi', 'sau', 'trước', 'trong', 'giữa', 'cuối', 'đầu', 'sang', 'từ', 'đến', 'lúc',
  'người', 'những', 'các', 'một', 'được', 'có', 'tại', 'ở', 'về', 'đã', 'sẽ', 'cũng',
  'thì', 'là', 'sự', 'việc', 'đây', 'đó', 'ông', 'bà', 'cha', 'mẹ', 'con', 'cháu',
  'anh', 'em', 'tôi', 'ta', 'chúng ta', 'thần', 'bệ hạ', 'hoàng đế', 'quân lính',
  'bởi', 'do', 'và', 'hoặc', 'hay', 'nhưng', 'mà', 'cho', 'để', 'như', 'vì', 'theo',
  'bằng', 'với', 'cùng', 'nơi', 'chỗ', 'hễ', 'rồi', 'đang', 'toàn bộ', 'hết thảy',
  'tất cả', 'phần lớn', 'nhiều', 'rất', 'quá', 'nay', 'xưa', 'vùng', 'miền', 'xứ', 'đất',
  'tên', 'tên châu', 'tên huyện', 'chư hầu', 'quân', 'triều', 'nước', 'nhà', 'vua', 'tướng',
  'sông', 'núi', 'thành', 'huyện', 'tỉnh', 'châu', 'lộ', 'phủ', 'quận', 'trận', 'cuộc',
  'hoàng', 'đế', 'vương', 'tổng', 'chiến', 'biên', 'du', 'mới', 'bắc', 'nam', 'ngoài',
  'chủ', 'tư', 'tổ', 'thủy', 'khởi', 'phong', 'xe', 'hiệp', 'đại', 'tuyên', 'độc', 'quảng', 'quốc',
  'trình bày', 'diễn biến', 'kết quả', 'ý nghĩa', 'nguyên nhân', 'bối cảnh', 'chi tiết',
  'đặc điểm', 'sự kiện', 'địa danh', 'nhân vật', 'thảo luận', 'phân tích', 'đánh giá',
  'nội dung', 'vai trò', 'bài học'
]);

export const LEADING_STOPWORDS = new Set([
  'trong', 'đến', 'từ', 'vào', 'cuối', 'sang', 'trước', 'sau', 'giữa', 'đầu', 'ở', 'tại', 'theo', 'như', 'bằng', 'với', 'cùng', 'tên', 'hễ', 'do', 'bởi', 'và', 'khi'
]);

/**
 * Slugify helper for canonical ID construction: <prefix>_<slug>
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildCanonicalId(name: string, entityType: string): string {
  let cleanName = name.trim();
  const prefix = getCanonicalEntityIdPrefix(entityType);
  if (entityType === 'HISTORICAL_PERSON') {
    cleanName = cleanName.replace(/^(?:Nhân\s+Huệ\s+Vương|Chiêu\s+Minh\s+Đại\s+Vương|Chiêu\s+Văn\s+Vương|Bình\s+Định\s+Vương|Bố\s+Cái\s+Đại\s+Vương|Tiền\s+Ngô\s+Vương|Vạn\s+Thắng\s+Vương|Hưng\s+Đạo\s+Đại\s+Vương|Hưng\s+Đạo\s+Vương|Đức\s+Thánh\s+Trần|Đức\s+Thánh|Vua|Hoàng\s+đế|Thái\s+sư|Tướng\s+quân|Đại\s+vương|Chúa|Thượng\s+hoàng|Thái\s+úy|Tổng\s+binh|Đại\s+tướng|Thủ\s+tướng|Anh\s+hùng|Sứ\s+thần|Sử\s+gia|Sử\s+thần|Tăng\s+thống|Trạng\s+nguyên|Bảng\s+nhãn|Danh\s+sĩ|Nữ\s+tướng)\s+/i, '');
  }
  let slug = slugify(cleanName);
  if (prefix && slug.startsWith(prefix)) {
    slug = slug.substring(prefix.length);
  }
  return `${prefix}${slug}`;
}

/**
 * Rule-Based Historical Prefix & Title Patterns (Tier 2)
 */
const HISTORICAL_PREFIX_PATTERNS: Array<{
  regex: RegExp;
  type: 'HISTORICAL_PERSON' | 'LOCATION' | 'EVENT_BATTLE' | 'DYNASTY_ERA' | 'ORGANIZATION' | 'ARTIFACT' | 'DOCUMENT_CULTURE';
  includePrefixInText: boolean;
}> = [
  // Events / Battles / Movements / Conferences / Campaigns
  {
    regex: /(?<![\p{L}\p{N}])(?:[tT]rận\s+(?:đánh\s+)?|[cC]hiến\s+dịch\s+|[cC]hiến\s+thắng\s+|[đĐ]ại\s+thắng\s+|[cC]uộc\s+khởi\s+nghĩa\s+|[kK]hởi\s+nghĩa\s+|[cC]uộc\s+chiến\s+(?:đấu|tranh)\s+|[cC]hiến\s+(?:đấu|tranh)\s+|[hH]ội\s+nghị\s+|[đĐ]ại\s+hội\s+|[pP]hong\s+trào\s+)(?:(?:phòng\s+tuyến\s+|bán\s+đảo\s+|trên\s+không\s+|sông\s+|núi\s+|thành\s+|cửa\s+|đèo\s+|ải\s+|biên\s+giới\s+)?(?:[\p{Lu}]{2,}|[\p{Lu}][\p{Ll}]*|[\p{Lu}\d]+)(?:[\s\-–—]+(?:phòng\s+tuyến\s+|bán\s+đảo\s+|trên\s+không\s+|sông\s+|núi\s+|thành\s+|cửa\s+|đèo\s+|ải\s+|biên\s+giới\s+)?(?:[\p{Lu}]{2,}|[\p{Lu}][\p{Ll}]*|[\p{Lu}\d][\p{Ll}\d]*|[\p{Lu}\d]+)){0,4}(?:\s+trên\s+không)?)/gu,
    type: 'EVENT_BATTLE',
    includePrefixInText: true,
  },
  // Documents / Culture
  {
    regex: /(?<![\p{L}\p{N}])(?:[cC]hiếu\s+|[hH]ịch\s+|[tT]uyên\s+ngôn\s+|[hH]iệp\s+định\s+|[bB]ộ\s+luật\s+|[bB]ộ\s+Luật\s+|[lL]uật\s+|[đĐ]ại\s+cáo\s+|[bB]ài\s+thơ\s+|[tT]ác\s+phẩm\s+)([\p{Lu}][\p{Ll}]*(?:[\s\-–—]+(?:[\p{Lu}][\p{Ll}]*|luật\s+lệ|toàn\s+thư|thực\s+lục|cương\s+mục|kháng\s+chiến|hành\s+quân)){0,6})/gu,
    type: 'DOCUMENT_CULTURE',
    includePrefixInText: true,
  },
  // Artifacts
  {
    regex: /(?<![\p{L}\p{N}])(?:Trống\s+đồng\s+|Nỏ\s+thần\s+|Nỏ\s+|Xe\s+tăng\s+|Thông\s+Bảo\s+)([\p{Lu}\p{Ll}\d\s]+?)(?=[,\.;:\n\(\)]|\s+(?:do|năm|giúp|húc|được|là)|$)(?![\p{L}\p{N}])/gu,
    type: 'ARTIFACT',
    includePrefixInText: true,
  },
  // Person Titles & Honorifics
  {
    regex: /(?<![\p{L}\p{N}])(?:Tổng\s+Bí\s+thư\s+|Tổng\s+bí\s+thư\s+|Thủ\s+tướng\s+|Vua\s+|Hoàng\s+đế\s+|Thái\s+thượng\s+hoàng\s+|Chúa\s+|Đại\s+vương\s+|Vương\s+|Thái\s+sư\s+|Thái\s+úy\s+|Tiết\s+chế\s+|Quốc\s+công\s+|Đại\s+tướng\s+|Tướng\s+|Đô\s+đốc\s+|Nữ\s+tướng\s+|Trạng\s+Trình\s+|Trạng\s+nguyên\s+|Lưỡng\s+quốc\s+Trạng\s+nguyên\s+|Bảng\s+nhãn\s+|Trạng\s+Bùng\s+|Danh\s+sĩ\s+|Sử\s+thần\s+|Sử\s+gia\s+|Sử\s+quan\s+|Chủ\s+tịch\s+|Bác\s+|Chiêu\s+Minh\s+Đại\s+Vương\s+|Chiêu\s+Văn\s+Vương\s+|Bắc\s+Bình\s+Vương\s+|Hưng\s+Đạo\s+Đại\s+Vương\s+|Hưng\s+Đạo\s+Vương\s+|Bình\s+Định\s+Vương\s+|Vạn\s+Thắng\s+Vương\s+|Tiền\s+Ngô\s+Vương\s+|Triệu\s+Việt\s+Vương\s+|Bố\s+Cái\s+Đại\s+Vương\s+|Mai\s+Hắc\s+Đế\s+|Lý\s+Nam\s+Đế\s+|Đức\s+Thánh\s+Trần\s+|Đức\s+Thánh\s+)([\p{Lu}][\p{Ll}]*(?:\s+[\p{Lu}][\p{Ll}]*){0,4})(?![\p{L}\p{N}])/gu,
    type: 'HISTORICAL_PERSON',
    includePrefixInText: false,
  },
  // Physical Geographical Locations & Monuments (Keep prefix like "sông Bạch Đằng", "núi Sóc Sơn")
  {
    regex: /(?<![\p{L}\p{N}])(?:(?<![đĐ]ổi\s+tên\s+)(?:thành\s+|Thành\s+)(?!phố\s+)|căn\s+cứ\s+|Căn\s+cứ\s+|ải\s+|Ải\s+|núi\s+|Núi\s+|sông\s+|Sông\s+|bán\s+đảo\s+|Bán\s+đảo\s+|quần\s+đảo\s+|Quần\s+đảo\s+|địa\s+đạo\s+|Đường\s+mòn\s+|Đường\s+|Đền\s+|Chùa\s+|Văn\s+Miếu\s+|Quảng\s+trường\s+|Dinh\s+|Nhà\s+máy\s+Thủy\s+điện\s+|ấp\s+|Ấp\s+|đầm\s+|Đầm\s+|khu\s+mộ\s+chum\s+|di\s+chỉ\s+)([\p{Lu}][\p{Ll}]*(?:\s+[\p{Lu}][\p{Ll}]*){0,4})(?![\p{L}\p{N}])/gu,
    type: 'LOCATION',
    includePrefixInText: true,
  },
  // Administrative Regions (Strip prefix like "tỉnh Thanh Hóa" -> "Thanh Hóa")
  {
    regex: /(?<![\p{L}\p{N}])(?:thành\s+phố\s+|Thành\s+phố\s+|tỉnh\s+|Tỉnh\s+|huyện\s+|Huyện\s+|xứ\s+|Xứ\s+|đất\s+|Đất\s+|vùng\s+|Vùng\s+|(?<![cC]hính\s+)phủ\s+|(?<![cC]hính\s+)Phủ\s+|lộ\s+|Lộ\s+|châu\s+|Châu\s+)([\p{Lu}][\p{Ll}]*(?:\s+[\p{Lu}][\p{Ll}]*){0,4})(?![\p{L}\p{N}])/gu,
    type: 'LOCATION',
    includePrefixInText: false,
  },
];

/**
 * Proper Noun Regex (Tier 3) with Unicode Word Boundaries
 */
const VI_PROPER_NOUN_REGEX = /(?<![\p{L}\p{N}])([\p{Lu}][\p{Ll}]*(?:[\s\-–—]+[\p{Lu}][\p{Ll}]*){1,6})(?![\p{L}\p{N}])/gu;

const ALL_EXTENDED_HONORIFICS = [
  ...PERSON_HONORIFICS_AND_RANKS,
  'Tổng Bí thư', 'Tổng bí thư', 'Thủ tướng', 'Chủ tịch', 'Bà', 'Ông',
  'Lễ Thành Hầu', 'Chí sĩ', 'Bác học', 'Đại thi hào', 'Danh nhân',
  'Sử gia', 'Sử thần', 'Sử quan', 'Hào kiệt', 'Thái thú', 'Thứ sử',
  'Thượng thư', 'Tướng quốc', 'Đại tư đồ', 'Tiết độ sứ', 'Bác'
];

/**
 * Strict validity check for extracted entity span
 */
export function isValidCandidateSpan(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().replace(/^[\s,.;:!?\-–—"'\(\)\[\]{}]+|[\s,.;:!?\-–—"'\(\)\[\]{}]+$/g, '');
  if (clean.length < 2 || clean.length > 80) return false;
  if (/^\d+/.test(clean)) return false;
  if (/[\[\]\(\)=\/\\<>|#*]/.test(clean)) return false;
  const cleanLower = clean.toLowerCase();
  if (GENERIC_EXCLUSION_TERMS.has(cleanLower)) return false;
  if (CAN_CHI_SET.has(cleanLower)) return false;

  // Reject temporal phrases (e.g. "Năm Tân Dậu", "Mùa đông", "Tháng ba")
  if (/^(?:năm|mùa|tháng|ngày|thời kỳ|niên hiệu)\s+/i.test(cleanLower)) {
    return false;
  }

  const words = clean.split(/\s+/);
  if (words.length > 8) return false;

  const firstWordLower = words[0].toLowerCase();
  if (LEADING_STOPWORDS.has(firstWordLower) && words.length === 1) return false;

  return true;
}

/**
 * Extract all historical candidate entity spans from input text (Stage 1 Pure TS Engine)
 */
export function extractHistoricalCandidateSpans(text: string): CandidateEntitySpan[] {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }

  const rawSpans: Array<CandidateEntitySpan & { priority: number }> = [];

  // -------------------------------------------------------------
  // Layer 1: Gazetteer Fast-Path (Priority 30)
  // -------------------------------------------------------------
  const trieMatches = gazetteerTrie.searchInText(text);
  for (const m of trieMatches) {
    const rawSpanText = text.substring(m.start, m.end);
    if (!isValidCandidateSpan(rawSpanText)) continue;

    rawSpans.push({
      text: rawSpanText,
      type: m.entry.type,
      startOffset: m.start,
      endOffset: m.end,
      confidence: 0.99,
      sourceLayer: 'GAZETTEER',
      suggestedCanonicalId: m.entry.canonicalId,
      priority: 30,
    });
  }

  // -------------------------------------------------------------
  // Layer 2: Rule-Based Title & Prefix Matcher (Priority 20)
  // -------------------------------------------------------------
  for (const rule of HISTORICAL_PREFIX_PATTERNS) {
    rule.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const matchIndex = match.index;
      const leadingSpaces = fullMatch.length - fullMatch.trimStart().length;
      let spanText = fullMatch.trim();
      let startOffset = matchIndex + leadingSpaces;
      let endOffset = startOffset + spanText.length;

      // Adjust offsets if rule specifies extracting only the captured group
      if (!rule.includePrefixInText && match[1]) {
        const groupText = match[1].trim();
        const offsetInMatch = fullMatch.indexOf(groupText);
        startOffset = matchIndex + offsetInMatch;
        endOffset = startOffset + groupText.length;
        spanText = groupText;
      }

      // If span is a Document/Culture and starts with common generic nouns
      if (rule.type === 'DOCUMENT_CULTURE') {
        const docPrefixes = ['Bài thơ ', 'bài thơ ', 'Bộ luật ', 'bộ luật ', 'Tác phẩm ', 'tác phẩm ', 'Sách ', 'sách ', 'Tiểu thuyết lịch sử ', 'tiểu thuyết lịch sử '];
        for (const dp of docPrefixes) {
          if (spanText.startsWith(dp)) {
            const prefixLen = dp.length;
            spanText = spanText.substring(prefixLen).trim();
            startOffset += prefixLen;
            endOffset = startOffset + spanText.length;
            break;
          }
        }
      }

      // If span is an EVENT_BATTLE and starts with "cuộc " or "Cuộc "
      if (rule.type === 'EVENT_BATTLE' && (spanText.startsWith('cuộc ') || spanText.startsWith('Cuộc '))) {
        const prefixLen = 5;
        spanText = spanText.substring(prefixLen).trim();
        startOffset += prefixLen;
        endOffset = startOffset + spanText.length;
      }

      if (!isValidCandidateSpan(spanText)) continue;

      const canonicalInfo = resolveCanonicalEntity(spanText);
      const isPerson = (canonicalInfo?.type || rule.type) === 'HISTORICAL_PERSON';
      let cleanSpanName = spanText;
      if (isPerson) {
        cleanSpanName = spanText.replace(/^(?:quốc\s+sư|thiền\s+sư|sư|thầy\s+giáo|thầy|vua|hoàng\s+đế|thái\s+tử|hoàng\s+tử|chúa|đại\s+tướng|tướng|thái\s+úy|thái\s+sư|bình\s+định\s+vương|bắc\s+bình\s+vương|nam\s+việt\s+vương|vạn\s+thắng\s+vương)\s+/i, '').trim();
      }
      const isPersonAlias = isPerson && canonicalInfo && slugify(canonicalInfo.canonicalName) !== slugify(cleanSpanName);
      const canonicalId = (canonicalInfo && !isPersonAlias) ? canonicalInfo.entityId : buildCanonicalId(cleanSpanName, rule.type);
      rawSpans.push({
        text: spanText,
        type: rule.type,
        startOffset,
        endOffset,
        confidence: 0.92,
        sourceLayer: 'RULE_PREFIX',
        suggestedCanonicalId: canonicalId,
        priority: 20,
      });
    }
  }

  // Track existing Layer 1 & 2 spans to prevent Layer 3 proper noun over-extraction
  const higherLayerSpans = [...rawSpans];

  // -------------------------------------------------------------
  // Layer 3: Proper Noun Regex Span Extractor (Priority 10)
  // -------------------------------------------------------------
  VI_PROPER_NOUN_REGEX.lastIndex = 0;
  let pnMatch: RegExpExecArray | null;
  while ((pnMatch = VI_PROPER_NOUN_REGEX.exec(text)) !== null) {
    const spanText = pnMatch[0].trim();
    const startOffset = pnMatch.index;
    const endOffset = startOffset + pnMatch[0].length;

    if (!isValidCandidateSpan(spanText)) continue;

    // Skip if this span overlaps with any Layer 1/2 span
    const overlapsHigherLayer = higherLayerSpans.some(
      (h) => Math.max(startOffset, h.startOffset) < Math.min(endOffset, h.endOffset)
    );
    if (overlapsHigherLayer) continue;

    // Infer taxonomy type from text features
    const inferredType = inferEntityTypeFromName(spanText);
    const canonicalInfo = resolveCanonicalEntity(spanText);
    const effectiveType = canonicalInfo?.type || inferredType;
    const canonicalId = canonicalInfo ? canonicalInfo.entityId : buildCanonicalId(spanText, effectiveType);

    rawSpans.push({
      text: spanText,
      type: effectiveType,
      startOffset,
      endOffset,
      confidence: 0.85,
      sourceLayer: 'PROPER_NOUN_REGEX',
      suggestedCanonicalId: canonicalId,
      priority: 10,
    });
  }

  // -------------------------------------------------------------
  // Layer 4: Strip leading person honorifics from person spans
  // -------------------------------------------------------------
  for (const span of rawSpans) {
    if (span.type === 'HISTORICAL_PERSON' || span.type === 'UNKNOWN') {
      const spanNorm = span.text.normalize('NFC');
      const spanLower = spanNorm.toLowerCase();
      for (const h of ALL_EXTENDED_HONORIFICS) {
        const hLower = h.toLowerCase().normalize('NFC');
        if (spanLower.startsWith(`${hLower} `) && spanNorm.length > hLower.length + 2) {
          const stripped = spanNorm.substring(hLower.length + 1).trim();
          if (stripped.length >= 2) {
            span.startOffset += (span.text.length - stripped.length);
            span.text = stripped;
            span.type = 'HISTORICAL_PERSON';
            const reCanon = resolveCanonicalEntity(stripped);
            span.suggestedCanonicalId = reCanon ? reCanon.entityId : buildCanonicalId(stripped, 'HISTORICAL_PERSON');
            break;
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Non-Overlapping / Nested Span Resolution
  // -------------------------------------------------------------
  rawSpans.sort((a, b) => {
    if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
    if (b.priority !== a.priority) return b.priority - a.priority;
    const lenA = a.endOffset - a.startOffset;
    const lenB = b.endOffset - b.startOffset;
    return lenB - lenA;
  });

  const finalSpans: CandidateEntitySpan[] = [];

  for (const span of rawSpans) {
    const exactSlice = text.substring(span.startOffset, span.endOffset);
    if (exactSlice.trim() !== span.text.trim()) {
      span.text = exactSlice.trim();
    }

    if (!isValidCandidateSpan(span.text)) continue;

    // Check if an identical span already exists
    const duplicate = finalSpans.find(
      (s) => s.startOffset === span.startOffset && s.endOffset === span.endOffset
    );
    if (duplicate) continue;

    // Check for overlap with existing spans
    const overlapping = finalSpans.find(
      (s) => Math.max(s.startOffset, span.startOffset) < Math.min(s.endOffset, span.endOffset)
    );

    if (overlapping) {
      // If current span is nested inside existing longer span:
      const isSpanNestedInOverlapping = span.startOffset >= overlapping.startOffset && span.endOffset <= overlapping.endOffset;
      if (isSpanNestedInOverlapping) {
        // If outer is EVENT_BATTLE, ORGANIZATION, or DOCUMENT_CULTURE: allow nested sub-entities (HISTORICAL_PERSON, LOCATION, DYNASTY_ERA, ARTIFACT, DOCUMENT_CULTURE)
        if (
          (overlapping.type === 'EVENT_BATTLE' || overlapping.type === 'ORGANIZATION' || overlapping.type === 'DOCUMENT_CULTURE') &&
          (span.type === 'HISTORICAL_PERSON' || span.type === 'DYNASTY_ERA' || span.type === 'LOCATION' || span.type === 'ARTIFACT' || span.type === 'DOCUMENT_CULTURE')
        ) {
          finalSpans.push({
            text: span.text,
            type: span.type,
            startOffset: span.startOffset,
            endOffset: span.endOffset,
            confidence: span.confidence,
            sourceLayer: span.sourceLayer,
            suggestedCanonicalId: span.suggestedCanonicalId,
            priority: span.priority,
          });
        }
        continue;
      }

      // If existing span is nested inside current longer span:
      const isOverlappingNestedInSpan = overlapping.startOffset >= span.startOffset && overlapping.endOffset <= span.endOffset;
      if (isOverlappingNestedInSpan) {
        // If outer is EVENT_BATTLE or ORGANIZATION and inner has distinct type, keep both
        if (span.type !== overlapping.type && (span.type === 'EVENT_BATTLE' || span.type === 'ORGANIZATION')) {
          finalSpans.push({
            text: span.text,
            type: span.type,
            startOffset: span.startOffset,
            endOffset: span.endOffset,
            confidence: span.confidence,
            sourceLayer: span.sourceLayer,
            suggestedCanonicalId: span.suggestedCanonicalId,
          });
        } else {
          // If overlapping has higher priority than current span (e.g. Gazetteer vs Regex), keep overlapping
          if ((overlapping.priority ?? 0) > (span.priority ?? 0)) {
            continue;
          }

          // Replace shorter with longer
          const idx = finalSpans.indexOf(overlapping);
          if (idx !== -1) {
            finalSpans[idx] = {
              text: span.text,
              type: span.type,
              startOffset: span.startOffset,
              endOffset: span.endOffset,
              confidence: span.confidence,
              sourceLayer: span.sourceLayer,
              suggestedCanonicalId: span.suggestedCanonicalId,
              priority: span.priority,
            };
          }
        }
      }
      continue;
    }

    finalSpans.push({
      text: span.text,
      type: span.type,
      startOffset: span.startOffset,
      endOffset: span.endOffset,
      confidence: span.confidence,
      sourceLayer: span.sourceLayer,
      suggestedCanonicalId: span.suggestedCanonicalId,
      priority: span.priority,
    });
  }

  // Final sort by startOffset
  finalSpans.sort((a, b) => a.startOffset - b.startOffset);
  return finalSpans;
}
