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
            lastMatch = {
              start: i,
              end: j,
              entry: curr.entry,
              matchedText: text.substring(i, j),
            };
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
  // 1. Person Dictionary
  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    const entry: GazetteerEntry = {
      canonicalId: person.entityId,
      name: person.canonicalName,
      type: 'HISTORICAL_PERSON',
      aliases: person.aliases || [],
    };
    gazetteerTrie.insert(person.canonicalName, entry);
    for (const alias of person.aliases) {
      gazetteerTrie.insert(alias, entry);
    }
  }

  // 2. Location Dictionary & Mappings
  for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    const entry: GazetteerEntry = {
      canonicalId: loc.entityId,
      name: loc.canonicalName,
      type: 'LOCATION',
      aliases: loc.aliases || [],
    };
    gazetteerTrie.insert(loc.canonicalName, entry);
    for (const alias of loc.aliases) {
      gazetteerTrie.insert(alias, entry);
    }
  }

  for (const map of HISTORICAL_LOCATION_MAPPINGS) {
    const canonicalId = `loc_${slugify(map.canonicalModernName)}`;
    const entry: GazetteerEntry = {
      canonicalId,
      name: map.canonicalModernName,
      type: 'LOCATION',
      aliases: [map.historicalName],
    };
    gazetteerTrie.insert(map.historicalName, entry);
    gazetteerTrie.insert(map.canonicalModernName, entry);
  }

  // 3. Known Dynasties, Eras, Important Documents, Artifacts, Disambiguated Battles & Historic Locations
  const CORE_HISTORICAL_ENTITIES: Array<{ name: string; type: string; aliases?: string[] }> = [
    { name: 'Văn Lang', type: 'DYNASTY_ERA' },
    { name: 'Âu Lạc', type: 'DYNASTY_ERA' },
    { name: 'Vạn Xuân', type: 'DYNASTY_ERA' },
    { name: 'Đại Cồ Việt', type: 'DYNASTY_ERA' },
    { name: 'Đại Việt', type: 'DYNASTY_ERA' },
    { name: 'Đại Nam', type: 'DYNASTY_ERA' },
    { name: 'nhà Lý', type: 'DYNASTY_ERA' },
    { name: 'nhà Trần', type: 'DYNASTY_ERA' },
    { name: 'nhà Hồ', type: 'DYNASTY_ERA' },
    { name: 'nhà Lê', type: 'DYNASTY_ERA' },
    { name: 'nhà Lê Sơ', type: 'DYNASTY_ERA' },
    { name: 'nhà Mạc', type: 'DYNASTY_ERA' },
    { name: 'nhà Nguyễn', type: 'DYNASTY_ERA' },
    { name: 'nhà Tiền Lý', type: 'DYNASTY_ERA' },
    { name: 'nhà Đông Hán', type: 'DYNASTY_ERA' },
    { name: 'nhà Đường', type: 'DYNASTY_ERA' },
    { name: 'nhà Tống', type: 'DYNASTY_ERA' },
    { name: 'quân Tống', type: 'DYNASTY_ERA' },
    { name: 'nhà Minh', type: 'DYNASTY_ERA' },
    { name: 'Nam Hán', type: 'DYNASTY_ERA' },
    { name: 'Đông Ngô', type: 'DYNASTY_ERA' },
    { name: 'Xiêm La', type: 'DYNASTY_ERA' },
    { name: 'Việt Nam Dân chủ Cộng hòa', type: 'DYNASTY_ERA' },
    { name: 'Đảng Cộng sản Việt Nam', type: 'ORGANIZATION' },
    { name: 'Tây Sơn', type: 'ORGANIZATION' },
    { name: 'quân Tây Sơn', type: 'ORGANIZATION' },
    { name: 'nghĩa quân Tây Sơn', type: 'ORGANIZATION' },
    { name: 'nghĩa quân Lam Sơn', type: 'ORGANIZATION' },
    { name: 'quân Mãn Thanh', type: 'ORGANIZATION' },
    { name: 'quân Nguyên Mông', type: 'ORGANIZATION' },
    { name: 'Hội Duy Tân', type: 'ORGANIZATION' },
    { name: 'Hội Tao Đàn', type: 'ORGANIZATION' },
    { name: 'chúa Nguyễn', type: 'ORGANIZATION' },
    { name: 'Thiền phái Trúc Lâm Yên Tử', type: 'ORGANIZATION' },
    { name: 'Việt Nam Quốc dân Đảng', type: 'ORGANIZATION' },
    { name: 'Hội Việt Nam Cách mạng Thanh niên', type: 'ORGANIZATION' },
    { name: 'Quốc sử quán triều Nguyễn', type: 'ORGANIZATION' },
    { name: 'Chiếu dời đô', type: 'DOCUMENT_CULTURE' },
    { name: 'Hịch tướng sĩ', type: 'DOCUMENT_CULTURE' },
    { name: 'Bình Ngô đại cáo', type: 'DOCUMENT_CULTURE' },
    { name: 'Tuyên ngôn Độc lập', type: 'DOCUMENT_CULTURE' },
    { name: 'Nam quốc sơn hà', type: 'DOCUMENT_CULTURE' },
    { name: 'Luật Hồng Đức', type: 'DOCUMENT_CULTURE', aliases: ['Quốc triều hình luật'] },
    { name: 'Đại Việt sử ký toàn thư', type: 'DOCUMENT_CULTURE' },
    { name: 'Đại Nam thực lục', type: 'DOCUMENT_CULTURE' },
    { name: 'Hiệp định Genève', type: 'DOCUMENT_CULTURE' },
    { name: 'Trống đồng Đông Sơn', type: 'ARTIFACT' },
    { name: 'Nỏ Liên Châu', type: 'ARTIFACT', aliases: ['Nỏ thần'] },
    { name: 'Thông Bảo Hội Sao', type: 'ARTIFACT' },
    { name: 'Xe tăng 390', type: 'ARTIFACT' },
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
    { name: 'Thành nhà Hồ', type: 'LOCATION', aliases: ['Tây Đô'] },
    { name: 'thành Cổ Loa', type: 'LOCATION' },
    { name: 'Điện Biên Phủ', type: 'LOCATION' },
    { name: 'ấp Tây Sơn', type: 'LOCATION' },
    { name: 'sông Như Nguyệt', type: 'LOCATION' },
    { name: 'sông Gianh', type: 'LOCATION' },
    { name: 'Mai Thúc Loan', type: 'HISTORICAL_PERSON', aliases: ['Mai Hắc Đế'] },
    // Disambiguated Battles with Year in name
    { name: 'Trận Bạch Đằng năm 938', type: 'EVENT_BATTLE', aliases: ['Trận Bạch Đằng (938)'] },
    { name: 'Trận Bạch Đằng năm 981', type: 'EVENT_BATTLE', aliases: ['Trận Bạch Đằng (981)'] },
    { name: 'Trận Bạch Đằng năm 1288', type: 'EVENT_BATTLE', aliases: ['Trận Bạch Đằng (1288)'] },
    { name: 'Chiến dịch Biên giới Thu Đông 1950', type: 'EVENT_BATTLE', aliases: ['Chiến dịch Biên giới 1950'] },
  ];

  for (const ent of CORE_HISTORICAL_ENTITIES) {
    const prefix = getCanonicalEntityIdPrefix(ent.type);
    const canonicalId = `${prefix}${slugify(ent.name)}`;
    const entry: GazetteerEntry = {
      canonicalId,
      name: ent.name,
      type: ent.type,
      aliases: ent.aliases || [],
    };
    gazetteerTrie.insert(ent.name, entry);
    if (ent.aliases) {
      for (const al of ent.aliases) {
        gazetteerTrie.insert(al, entry);
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
  'pháp', 'trung quốc', 'nhật bản', 'thụy sĩ', 'đông dương', 'ba đình', 'đổi mới',
  'hoành sơn', 'tân an - gò công', 'lê - trịnh', 'trịnh - nguyễn', 'pháp - tây ban nha',
  'bình tây đại', 'tao đàn nhị thập bát'
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
  const prefix = getCanonicalEntityIdPrefix(entityType);
  const slug = slugify(name);
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
    regex: /(?<![\p{L}\p{N}])(?:Trận\s+(?:đánh\s+)?|Chiến\s+dịch\s+|Cuộc\s+khởi\s+nghĩa\s+|Khởi\s+nghĩa\s+|Hội\s+nghị\s+|Đại\s+hội\s+|Phong\s+trào\s+)(?:(?:phòng\s+tuyến\s+|bán\s+đảo\s+|trên\s+không\s+|sông\s+|núi\s+|thành\s+|cửa\s+|đèo\s+|ải\s+|biên\s+giới\s+)*[\p{Lu}][\p{Ll}]*(?:[\s\-–—]+(?:phòng\s+tuyến\s+|bán\s+đảo\s+|trên\s+không\s+|sông\s+|núi\s+|thành\s+|cửa\s+|đèo\s+|ải\s+|biên\s+giới\s+)*[\p{Lu}\d][\p{Ll}\d]*){0,6}(?:\s+trên\s+không)?)/gu,
    type: 'EVENT_BATTLE',
    includePrefixInText: true,
  },
  // Documents / Culture
  {
    regex: /(?<![\p{L}\p{N}])(?:Chiếu\s+|Hịch\s+|Tuyên\s+ngôn\s+|Hiệp\s+định\s+|Bộ\s+luật\s+|Luật\s+|Đại\s+cáo\s+|Bài\s+thơ\s+|Tác\s+phẩm\s+)([\p{Lu}][\p{Ll}]*(?:[\s\-–—]+[\p{Lu}][\p{Ll}]*){0,6})/gu,
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
    regex: /(?<![\p{L}\p{N}])(?:Vua\s+|Hoàng\s+đế\s+|Thái\s+thượng\s+hoàng\s+|Chúa\s+|Đại\s+vương\s+|Vương\s+|Thái\s+sư\s+|Thái\s+úy\s+|Tiết\s+chế\s+|Quốc\s+công\s+|Đại\s+tướng\s+|Tướng\s+|Đô\s+đốc\s+|Nữ\s+tướng\s+|Trạng\s+Trình\s+|Trạng\s+nguyên\s+|Sử\s+quan\s+|Chủ\s+tịch\s+|Bác\s+)([\p{Lu}][\p{Ll}]*(?:\s+[\p{Lu}][\p{Ll}]*){0,4})(?![\p{L}\p{N}])/gu,
    type: 'HISTORICAL_PERSON',
    includePrefixInText: false,
  },
  // Locations / Citadels / Rivers / Mountains
  {
    regex: /(?<![\p{L}\p{N}])(?:thành\s+|Thành\s+|căn\s+cứ\s+|Căn\s+cứ\s+|ải\s+|Ải\s+|núi\s+|Núi\s+|sông\s+|Sông\s+|bán\s+đảo\s+|Bán\s+đảo\s+|quần\s+đảo\s+|Quần\s+đảo\s+|phủ\s+|Phủ\s+|lộ\s+|Lộ\s+|châu\s+|Châu\s+|địa\s+đạo\s+|Đường\s+mòn\s+|Đường\s+|Đền\s+|Chùa\s+|Văn\s+Miếu\s+|Quảng\s+trường\s+|Dinh\s+|Nhà\s+máy\s+Thủy\s+điện\s+|ấp\s+|Ấp\s+)([\p{Lu}][\p{Ll}]*(?:\s+[\p{Lu}][\p{Ll}]*){0,4})(?![\p{L}\p{N}])/gu,
    type: 'LOCATION',
    includePrefixInText: true,
  },
];

/**
 * Proper Noun Regex (Tier 3) with Unicode Word Boundaries
 */
const VI_PROPER_NOUN_REGEX = /(?<![\p{L}\p{N}])([\p{Lu}][\p{Ll}]*(?:[\s\-–—]+[\p{Lu}][\p{Ll}]*){1,4})(?![\p{L}\p{N}])/gu;

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
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const matchIndex = match.index;
      let spanText = fullMatch.trim();
      let startOffset = matchIndex;
      let endOffset = matchIndex + fullMatch.length;

      // Adjust offsets if rule specifies extracting only the captured group
      if (!rule.includePrefixInText && match[1]) {
        const groupText = match[1].trim();
        const offsetInMatch = fullMatch.indexOf(groupText);
        startOffset = matchIndex + offsetInMatch;
        endOffset = startOffset + groupText.length;
        spanText = groupText;
      }

      // If span is a Document/Culture and starts with "Bài thơ " or "Bộ luật "
      if (rule.type === 'DOCUMENT_CULTURE' && (spanText.startsWith('Bài thơ ') || spanText.startsWith('Bộ luật '))) {
        const prefixLen = 8;
        spanText = spanText.substring(prefixLen).trim();
        startOffset += prefixLen;
      }

      if (!isValidCandidateSpan(spanText)) continue;

      const canonicalId = buildCanonicalId(spanText, rule.type);
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
  const properNounRegex = new RegExp(VI_PROPER_NOUN_REGEX.source, VI_PROPER_NOUN_REGEX.flags);
  let pnMatch: RegExpExecArray | null;
  while ((pnMatch = properNounRegex.exec(text)) !== null) {
    const spanText = pnMatch[0].trim();
    const startOffset = pnMatch.index;
    const endOffset = startOffset + pnMatch[0].length;

    if (!isValidCandidateSpan(spanText)) continue;

    // Skip if this span falls inside any Layer 1/2 span
    const insideHigherLayer = higherLayerSpans.some(
      (h) => startOffset >= h.startOffset && endOffset <= h.endOffset
    );
    if (insideHigherLayer) continue;

    // Infer taxonomy type from text features
    const inferredType = inferEntityTypeFromName(spanText);
    const canonicalInfo = resolveCanonicalEntity(spanText);
    const canonicalId = canonicalInfo ? canonicalInfo.entityId : buildCanonicalId(spanText, inferredType);

    rawSpans.push({
      text: spanText,
      type: inferredType,
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
  const PERSON_HONORIFICS = [
    'Thái thượng hoàng', 'thái thượng hoàng',
    'Hoàng đế', 'hoàng đế',
    'Đại tướng', 'đại tướng',
    'Tiết chế', 'tiết chế',
    'Thái sư', 'thái sư',
    'Thái úy', 'thái úy',
    'Quốc công', 'quốc công',
    'Đô đốc', 'đô đốc',
    'Nữ tướng', 'nữ tướng',
    'Trạng Trình', 'trạng Trình',
    'Trạng nguyên', 'trạng nguyên',
    'Sử quan', 'sử quan',
    'Chủ tịch', 'chủ tịch',
    'Đại vương', 'đại vương',
    'Vua', 'vua',
    'Chúa', 'chúa',
    'Tướng', 'tướng',
    'Bác', 'bác',
  ];

  for (const span of rawSpans) {
    if (span.type === 'HISTORICAL_PERSON') {
      for (const h of PERSON_HONORIFICS) {
        if (span.text.startsWith(`${h} `) && span.text.length > h.length + 2) {
          const stripped = span.text.substring(h.length + 1).trim();
          if (stripped.length >= 2) {
            span.startOffset += (span.text.length - stripped.length);
            span.text = stripped;
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
    if (exactSlice !== span.text) {
      span.text = exactSlice;
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
      // Suppress sub-span if same type or inside proper name like Thành nhà Hồ
      if (
        (span.type === overlapping.type && span.sourceLayer !== 'GAZETTEER') ||
        (overlapping.text === 'Thành nhà Hồ' && span.text === 'nhà Hồ')
      ) {
        continue;
      }

      // Allow nested entity if one contains the other and types are distinct
      // or if the sub-entity is from GAZETTEER
      const isNested =
        (span.startOffset >= overlapping.startOffset && span.endOffset <= overlapping.endOffset) ||
        (overlapping.startOffset >= span.startOffset && overlapping.endOffset <= span.endOffset);

      if (isNested && (span.type !== overlapping.type || span.sourceLayer === 'GAZETTEER')) {
        finalSpans.push({
          text: span.text,
          type: span.type,
          startOffset: span.startOffset,
          endOffset: span.endOffset,
          confidence: span.confidence,
          sourceLayer: span.sourceLayer,
          suggestedCanonicalId: span.suggestedCanonicalId,
        });
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
    });
  }

  // Final sort by startOffset
  finalSpans.sort((a, b) => a.startOffset - b.startOffset);
  return finalSpans;
}
