import {
  resolveCanonicalEntity,
  CandidateEntitySpan,
  getCanonicalEntityIdPrefix,
  HistoricalRelationType,
} from '@chronoviet/shared-spec';
import {
  envConfig,
  generateLLMCompletion,
  logFallbackAlert,
  createLogger,
  formatConciseError,
} from '@chronoviet/infra';
import {
  extractHistoricalCandidateSpans,
  slugify,
  buildCanonicalId,
} from '../../text/vietnamese-ner.js';
import { extractionCache } from '../../cache/extraction-cache.js';
import { ExtractedTriple, ExtractionOptions, VALID_RELATIONS } from '../types.js';
import { normalizeHistoricalMention, snapMentionToCandidate } from '../helpers/mention-resolver.js';
import { validateAndCanonicalizeTriple } from '../canonicalizer/validator.js';
import { extractSyntacticParentheticalTriples } from '../heuristics/parenthetical.js';
import { extractRoyalLineageTriples } from '../heuristics/royal-lineage.js';
import { extractSpatialHierarchyTriples } from '../heuristics/spatial.js';
import { extractSyntacticDocumentTriples } from '../heuristics/document.js';
import { extractSyntacticDynasticTriples } from '../heuristics/dynastic.js';
import { extractTriplesFromText } from '../rules/rule-extractor.js';

const log = createLogger({ service: 'data-ingestion' });
let warnedLlmOffline = false;

export const MAX_CANDIDATE_SPANS_IN_PROMPT = 30;

/**
 * Stage 2 Lightweight LLM Extraction with Disk Cache & Exponential Backoff
 */
export async function extractTriplesWithLLMDetailed(
  text: string,
  options?: ExtractionOptions
): Promise<{ triples: ExtractedTriple[]; candidateSpans: CandidateEntitySpan[]; res?: any; error?: string }> {
  const candidateSpans = extractHistoricalCandidateSpans(text);

  // 1. Check Disk Cache first (unless skipCache is requested)
  if (!options?.skipCache) {
    try {
      const cached = await extractionCache.get(text);
      if (cached !== null && Array.isArray(cached)) {
        return {
          triples: cached,
          candidateSpans,
          res: {
            provider: (cached as any)?._meta?.provider || 'LOCAL_CACHE',
            model: (cached as any)?._meta?.model || 'disk_cache',
            cached: true,
          },
        };
      }
    } catch {
      // Non-fatal cache lookup failure
    }
  }

  // Standalone person IDs that have at least one un-enclosed occurrence
  const standalonePersonIds = new Set(
    candidateSpans
      .filter((c) => c.type === 'HISTORICAL_PERSON' && !c.isEnclosedModifier)
      .map((c) => c.suggestedCanonicalId || slugify(c.text))
  );

  // Deduplicate unique candidate entities for compact prompt while preserving natural reading order
  const seenCandidateKeys = new Set<string>();
  const uniqueCandidateSpans = candidateSpans.filter((c) => {
    // If a person is merely an enclosed modifier inside an event/org/location and doesn't occur standalone, omit from prompt
    if (c.type === 'HISTORICAL_PERSON' && c.isEnclosedModifier) {
      const id = c.suggestedCanonicalId || slugify(c.text);
      if (!standalonePersonIds.has(id)) return false;
    }
    const key = `${c.type}:${c.text.trim().toLowerCase()}`;
    if (seenCandidateKeys.has(key)) return false;
    seenCandidateKeys.add(key);
    return true;
  });

  const promptCandidateSpans = uniqueCandidateSpans.slice(0, MAX_CANDIDATE_SPANS_IN_PROMPT);

  // Pure Geographic Distractor Guard: If text has only locations and no historical events/actions/sites/toponyms, return 0 triples
  const hasHistoricalTypes = promptCandidateSpans.some((c) => c.type !== 'LOCATION');
  const locSpans = promptCandidateSpans.filter((s) => s.type === 'LOCATION');
  const HISTORICAL_ACTION_KEYWORDS = /\b(chiến thắng|đại thắng|đánh tan|đánh đuổi|khởi nghĩa|dấy binh|đóng đô|dời đô|lên ngôi|sáng lập|thành lập|trị vì|xây dựng|khánh thành|chiếm|giải phóng|ký kết|ban hành|soạn thảo|tác phẩm|tiêu biểu|đối đầu|phò tá|tu hành|được tôn|sáng chế|lập ra|lập nên|khẩn hoang|đúc|phong cho|họp|hội nghị|vương triều|triều đại|công cuộc|thuộc|tọa lạc|nằm tại|trên dòng|thương cảng|kinh thành|đô thành|di tích|thành trì|cổ thành|thành cổ|đồn|bến|cửa biển|chiến dịch|trận|bùng nổ|xâm lược|phản công|gia nhập|gọi là|còn gọi|đổi tên|tên là|mang tên|tên gọi|tên cũ|huyết mạch|tuyến đường|tuyến|địa giới|hành chính|xưa nay|tương ứng|vốn là|trước đây)\b/i;
  if (!hasHistoricalTypes && !HISTORICAL_ACTION_KEYWORDS.test(text) && locSpans.length < 2) {
    return {
      triples: [],
      candidateSpans,
      res: { provider: 'DISTRACTOR_GUARD', model: 'rule_guard' },
    };
  }

  // Build categorized representation for clean LLM context
  const enumMap = new Map<string, CandidateEntitySpan>();
  const personSpans = promptCandidateSpans.filter((s) => s.type === 'HISTORICAL_PERSON');
  const dynSpans = promptCandidateSpans.filter((s) => s.type === 'DYNASTY_ERA');
  const evSpans = promptCandidateSpans.filter((s) => s.type === 'EVENT_BATTLE');
  const orgSpans = promptCandidateSpans.filter((s) => s.type === 'ORGANIZATION');
  const artSpans = promptCandidateSpans.filter((s) => s.type === 'ARTIFACT');
  const docSpans = promptCandidateSpans.filter((s) => s.type === 'DOCUMENT_CULTURE');

  const buildDistinctSpanId = (span: CandidateEntitySpan): string => {
    // If multiple candidate spans share the same suggestedCanonicalId, disambiguate using text slug
    const sameCanonicalCount = promptCandidateSpans.filter(
      (c) => c.suggestedCanonicalId && c.suggestedCanonicalId === span.suggestedCanonicalId
    ).length;
    if (sameCanonicalCount > 1) {
      const prefix = getCanonicalEntityIdPrefix(span.type);
      return `${prefix}${slugify(span.text)}`;
    }
    return span.suggestedCanonicalId || buildCanonicalId(span.text, span.type);
  };

  // Register specific historical honorifics and epithets to their canonical person if present in spans
  const EPITHET_PERSON_MAP: Record<string, string> = {
    'hưng đạo đại vương': 'person_tran_hung_dao',
    'hưng đạo vương': 'person_tran_hung_dao',
    'đức thánh trần': 'person_tran_hung_dao',
    'vạn thắng vương': 'person_dinh_tien_hoang',
    'bình định vương': 'person_le_loi',
    'chúa tiên': 'person_nguyen_hoang',
    'anh hùng áo vải': 'person_quang_trung',
    'vị anh hùng áo vải': 'person_quang_trung',
    'người anh hùng áo vải': 'person_quang_trung',
  };

  for (const [epithet, canonId] of Object.entries(EPITHET_PERSON_MAP)) {
    const matchedPerson = personSpans.find(
      (p) => p.suggestedCanonicalId === canonId || buildCanonicalId(p.text, 'HISTORICAL_PERSON') === canonId
    );
    if (matchedPerson) {
      enumMap.set(epithet, matchedPerson);
    }
  }

  // Sentential Discourse Anaphora Resolution:
  // Split text into sentences and map generic pronouns in sentence S_i to the main subject of S_{i-1}
  const sentences = text.split(/(?<=[.!?])\s+/);
  const GENERIC_ANAPHORA_PRONOUNS = [
    'người đứng đầu chính phủ',
    'người đứng đầu',
    'vị tư lệnh',
    'tư lệnh',
    'tổng tư lệnh',
    'vị tổng tư lệnh',
    'vị thủ lĩnh',
    'vị thủ lĩnh cần vương',
    'thủ lĩnh cần vương',
    'vị danh tướng',
    'vị tướng lĩnh',
    'vị lãnh tụ',
    'lãnh tụ',
    'nhà vua',
    'vị hoàng đế',
    'quân vương',
  ];

  const leadPerson = personSpans[0];
  const personAnaphoraAliases = new Map<string, Set<string>>();

  for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
    const sent = sentences[sIdx];
    const sentLower = sent.toLowerCase();
    const prevSentencePersons = sIdx > 0
      ? personSpans.filter((p) => sentences[sIdx - 1].includes(p.text))
      : [];
    const prevPerson = prevSentencePersons[0] || leadPerson;
    const personsInSent = personSpans.filter((p) => sent.includes(p.text));

    for (const pronoun of GENERIC_ANAPHORA_PRONOUNS) {
      if (sentLower.includes(pronoun) && !enumMap.has(pronoun)) {
        const pronounPos = sentLower.indexOf(pronoun);
        const personAfterPronoun = personsInSent.find((p) => {
          const pPos = sent.indexOf(p.text);
          return pPos > pronounPos;
        });

        const isInterpersonalAction = personAfterPronoun && /(?:hạ\s+lệnh\s+cho|ra\s+lệnh\s+cho|phái|cử|truyền\s+cho|truyền\s+ngôi\s+cho|sai|giao\s+cho|cho\s+con|cho)/i.test(
          sent.substring(pronounPos, sent.indexOf(personAfterPronoun.text))
        );

        const targetPerson = (isInterpersonalAction && prevPerson)
          ? prevPerson
          : (personsInSent[0] || prevPerson || leadPerson);

        if (targetPerson) {
          enumMap.set(pronoun, targetPerson);
          const pKey = targetPerson.suggestedCanonicalId || targetPerson.text;
          if (!personAnaphoraAliases.has(pKey)) personAnaphoraAliases.set(pKey, new Set());
          personAnaphoraAliases.get(pKey)!.add(pronoun);
        }
      }
    }
  }

  // Fallback generic anaphora to first person if still unassigned
  if (leadPerson) {
    for (const pronoun of GENERIC_ANAPHORA_PRONOUNS) {
      if (!enumMap.has(pronoun)) {
        enumMap.set(pronoun, leadPerson);
      }
    }
  }

  const formatSpanWithSlot = (s: CandidateEntitySpan) => {
    const idx = promptCandidateSpans.indexOf(s);
    const code = `E${idx + 1}`;
    const distinctId = buildDistinctSpanId(s);
    const pKey = s.suggestedCanonicalId || s.text;
    const aliases = personAnaphoraAliases.get(pKey);
    const aliasInfo = aliases && aliases.size > 0 ? ` (đại từ/danh xưng: "${Array.from(aliases).join('", "')}")` : '';
    return `[${code}] "${s.text}" [ID: ${distinctId}]${aliasInfo}`;
  };

  const categorizedLines: string[] = [];
  if (personSpans.length > 0) {
    categorizedLines.push(`- NHÂN VẬT & LÃNH ĐẠO (HISTORICAL PERSON / LEADER): ${personSpans.map(formatSpanWithSlot).join(', ')}`);
  }
  const geoEventOrgSpans = [...locSpans, ...dynSpans, ...evSpans, ...orgSpans];
  if (geoEventOrgSpans.length > 0) {
    categorizedLines.push(`- ĐỊA BÀN, CHIẾN TRẬN, TỔ CHỨC & TRIỀU ĐẠI (LOCATION / EVENT / DYNASTY / ORG): ${geoEventOrgSpans.map(formatSpanWithSlot).join(', ')}`);
  }
  const docArtSpans = [...artSpans, ...docSpans];
  if (docArtSpans.length > 0) {
    categorizedLines.push(`- VĂN KIỆN, HIỆP ĐỊNH & CỔ VẬT (DOCUMENT / ARTIFACT): ${docArtSpans.map(formatSpanWithSlot).join(', ')}`);
  }

  promptCandidateSpans.forEach((span, idx) => {
    const code = `E${idx + 1}`;
    const distinctId = buildDistinctSpanId(span);
    enumMap.set(code.toLowerCase(), span);
    enumMap.set(distinctId.toLowerCase(), span);
    if (span.suggestedCanonicalId) {
      enumMap.set(span.suggestedCanonicalId.toLowerCase(), span);
    }
    enumMap.set(span.text.toLowerCase(), span);
    enumMap.set(normalizeHistoricalMention(span.text).toLowerCase(), span);
  });

  try {
    const systemPrompt = `Bạn là Trợ lý Trích xuất Đồ thị Tri thức Lịch sử Việt Nam (ChronoViet Knowledge Graph).
Nhiệm vụ: Trích xuất ĐẦY ĐỦ các bộ ba quan hệ ngữ nghĩa (s -> r -> o) giữa các thực thể có trong danh sách dựa trên văn bản.
Bạn có thể điền s và o bằng Mã Slot [E1, E2...] HOẶC bằng trực tiếp Tên thực thể ("An Dương Vương", "thành Cổ Loa").

8 LOẠI QUAN HỆ & VAI TRÒ NGỮ NGHĨA (SEMANTIC ROLES):
1. LED_BY: [Trận đánh / Khởi nghĩa / Chiến dịch / Tổ chức / Khoa thi / Phong trào] -> LED_BY -> [Người chỉ huy / Lãnh đạo / Chủ trì / Khởi xướng / Sáng lập]
2. HAPPENED_AT: [Nhân vật / Sự kiện / Địa danh con / Di tích / Công trình / Văn kiện / Cổ vật] -> HAPPENED_AT -> [Địa danh / Tỉnh / Huyện / Núi / Sông]
3. HAPPENED_IN: [Sự kiện / Di tích / Văn kiện / Bộ luật / Cổ vật / Tác phẩm] -> HAPPENED_IN -> [Triều đại / Thời kỳ / Kỷ nguyên]
4. PART_OF: [Nhân vật / Tướng sĩ / Thành viên / Đại diện / Sĩ tử / Tổ chức con / Quốc gia] -> PART_OF -> [Triều đại / Tổ chức / Nghĩa quân / Phe phái / Hội đoàn / Khoa thi / Tổ chức quốc tế]
5. SAME_AS_LOCATION: [Địa danh cổ / Cố danh / Tên cũ] -> SAME_AS_LOCATION -> [Địa danh hiện đại / Tên mới]
6. ALIAS_OF: [Tên khác / Tên húy / Tự hiệu / Danh hiệu / Tuyến đường khác] -> ALIAS_OF -> [Tên chuẩn chính thức]
7. ROYAL_LINEAGE: [Người kế vị / Con nối nghiệp] -> ROYAL_LINEAGE -> [Người tiền nhiệm / Người truyền ngôi]
8. MENTIONED_IN: [Tác giả / Người ban hành / Soạn thảo / Ký kết / Quốc gia / Người tiếp nhận / Nhân vật được khen ngợi / Nhân vật ghi danh] -> MENTIONED_IN -> [Tác phẩm / Bộ luật / Chiếu / Hịch / Văn kiện / Hiệp định / Di chúc / Bia tiến sĩ]

VÍ DỤ MẪU (FEW-SHOT EXAMPLES):
Ví dụ 1:
Văn bản: "Vua An Dương Vương xây thành Cổ Loa tại Đông Anh để củng cố phòng thủ nhà nước Âu Lạc."
Thực thể: [E1] "An Dương Vương", [E2] "thành Cổ Loa", [E3] "Đông Anh", [E4] "nhà nước Âu Lạc"
Output:
{"triples": [
  {"s": "An Dương Vương", "r": "PART_OF", "o": "nhà nước Âu Lạc"},
  {"s": "An Dương Vương", "r": "HAPPENED_AT", "o": "thành Cổ Loa"},
  {"s": "An Dương Vương", "r": "HAPPENED_AT", "o": "Đông Anh"},
  {"s": "thành Cổ Loa", "r": "HAPPENED_AT", "o": "Đông Anh"},
  {"s": "thành Cổ Loa", "r": "HAPPENED_IN", "o": "nhà nước Âu Lạc"}
]}

Ví dụ 2:
Văn bản: "Ngô Quyền lãnh đạo Chiến thắng Bạch Đằng năm 938 trên sông Bạch Đằng, đánh tan quân Nam Hán."
Thực thể: [E1] "Ngô Quyền", [E2] "Chiến thắng Bạch Đằng", [E3] "sông Bạch Đằng"
Output:
{"triples": [
  {"s": "Chiến thắng Bạch Đằng", "r": "LED_BY", "o": "Ngô Quyền"},
  {"s": "Chiến thắng Bạch Đằng", "r": "HAPPENED_AT", "o": "sông Bạch Đằng"},
  {"s": "Ngô Quyền", "r": "HAPPENED_AT", "o": "sông Bạch Đằng"}
]}

Ví dụ 3:
Văn bản: "Vùng đất Ái Châu thời Bắc thuộc nay thuộc tỉnh Thanh Hóa. Vua Lý Thái Tổ truyền ngôi báu cho con trai là thái tử Lý Phật Mã tức vua Lý Thái Tông."
Thực thể: [E1] "Ái Châu", [E2] "thời Bắc thuộc", [E3] "tỉnh Thanh Hóa", [E4] "Lý Thái Tổ", [E5] "Lý Phật Mã", [E6] "Lý Thái Tông"
Output:
{"triples": [
  {"s": "Ái Châu", "r": "SAME_AS_LOCATION", "o": "tỉnh Thanh Hóa"},
  {"s": "Lý Phật Mã", "r": "ALIAS_OF", "o": "Lý Thái Tông"},
  {"s": "Lý Phật Mã", "r": "ROYAL_LINEAGE", "o": "Lý Thái Tổ"},
  {"s": "Lý Thái Tông", "r": "ROYAL_LINEAGE", "o": "Lý Thái Tổ"}
]}

QUY TẮC RÀ SOÁT VÉT CẠN THEO VAI TRÒ NGỮ NGHĨA (GENERIC SEMANTIC FRAMES):
- Quản hạt & Phụng mệnh: [Nhân vật] (trấn thủ / phụ chính / kinh lược / mở cõi / vâng mệnh / lập phủ / xây dựng nền) [Triều đại / Chúa / Đàng Trong / Đàng Ngoài] -> [Nhân vật] PART_OF [Triều đại/Chúa/Xứ], [Nhân vật] HAPPENED_AT [Địa bàn].
- Đại diện & Thành viên: [Nhân vật] (đại diện / thay mặt / phò tá / giúp / tham gia / gia nhập / sát cánh) [Tổ chức / Chính phủ / Nghĩa quân / Hội đoàn] -> [Nhân vật] PART_OF [Tổ chức/Nghĩa quân/Hội đoàn].
- Tiếp nhận & Tán tụng Văn kiện: [Nhân vật A] (dâng / dâng lên / trình) [Tác phẩm B] lên [Nhân vật C] -> [A] MENTIONED_IN [B] VÀ [C] MENTIONED_IN [B].
- Bình sử & Sử gia trần thuật: [Sử gia A] trong [Sách B] (khen ngợi / khảo tả / luận bàn / chép về) [Nhân vật C] -> [A] MENTIONED_IN [B], [C] MENTIONED_IN [B].
- Sáng chế & Vũ khí / Cổ vật: [Nhân vật A] (sáng chế / chế tạo / đúc) [Cổ vật B] thời [Triều đại C] -> [A] PART_OF [C], [B] HAPPENED_IN [C].
- Khoa thi & Sĩ tử: [Vua A] mở khoa thi [B] -> [B] LED_BY [A]. [Sĩ tử C] (đỗ / trúng tuyển / thủ khoa) khoa thi [B] -> [C] PART_OF [B].
- Xây dựng công trình & Lăng tẩm: [Vua/Nhân vật A] (xây / đắp / xây dựng / khởi công) [Công trình / Di tích / Lăng / Thành B] tại [Địa danh C] -> [A] HAPPENED_AT [B], [B] HAPPENED_AT [C].
- Đặt cổ vật tại di tích: [Vua/Nhân vật A] cho đúc/đặt [Cổ vật B] tại/trước [Di tích/Công trình C] -> [A] HAPPENED_AT [C], [B] HAPPENED_AT [C].
- Hoạt động / Cầu học ở xứ người: [Nhân vật A] (sang / đến / tới / lưu vong tại) [Địa danh B] -> [A] HAPPENED_AT [B].
- Ban chiếu dời đô: [Vua A] ban [Chiếu dời đô B] từ [Địa danh C] về [Địa danh D] -> [B] HAPPENED_AT [C], [B] HAPPENED_AT [D], [A] HAPPENED_AT [D].
- Truyền ngôi / Nhường ngôi: [Vua A] nhường/truyền ngôi cho [Con/Thái tử B] -> [B] ROYAL_LINEAGE [A].
- Sáng lập & Khởi xướng: [Nhân vật A] (sáng lập / mở / thành lập / khởi xướng / lập ra) [Tổ chức / Khoa thi / Phong trào B] -> [B] LED_BY [A].
- Đồng tham chiếu qua nhiều câu: Đại từ/tôn danh/chức vụ (Vị danh tướng, Vị tư lệnh, Tổng Tư lệnh, Nhà vua, Hoàng đế, Người anh hùng áo vải...) trỏ về thực thể tương ứng của nhân vật đã xuất hiện trước đó (đã ghi chú đại từ cạnh thực thể ở danh sách). Hãy trích xuất quan hệ cho Nhân vật tương ứng khi họ hành động tại địa bàn hoặc với nhân vật/tổ chức khác ở câu sau (ví dụ: "Tổng Tư lệnh tại Mường Phăng" -> Võ Nguyên Giáp HAPPENED_AT Mường Phăng; "sáng lập Hội Tao Đàn" -> Hội Tao Đàn LED_BY Lê Thánh Tông).

RÀNG BUỘC PHỦ ĐỊNH (ANTI-PATTERNS):
- CHỈ sử dụng các thực thể có trong danh sách được cấp hoặc có trong văn bản. TUYỆT ĐỐI KHÔNG tự bịa thực thể mới.
- KHÔNG BAO GIỜ sinh quan hệ tự trỏ (s và o là cùng một thực thể, ví dụ: E1 -> LED_BY -> E1 là SAI).
- Triều đại KHÔNG BAO GIỜ là PART_OF của Địa danh.
- Không gán tướng lĩnh/nhân vật PART_OF hoặc LED_BY quân xâm lược / kẻ thù đối đầu.
- TUYỆT ĐỐI KHÔNG gán Nhân vật HAPPENED_AT cả Tỉnh/Thành cha khi đã có Di tích/Công trình con (chỉ gán [Công trình con] HAPPENED_AT [Tỉnh/Thành cha]).
- TUYỆT ĐỐI KHÔNG gán Sử gia hay Sách là PART_OF hoặc HAPPENED_IN Triều đại được luận bàn/khảo cứu.

ĐẦU RA DUY NHẤT (JSON):
{"triples": [{"s": "Tên_Thực_Thể_1", "r": "TÊN_QUAN_HỆ", "o": "Tên_Thực_Thể_2"}]}`;

    const userPrompt = `DANH SÁCH THỰC THỂ CÓ TRONG VĂN BẢN:
${categorizedLines.join('\n')}

VĂN BẢN (TEXT):
"""
${text}
"""

Hãy rà soát kỹ từng thực thể (Địa bàn HAPPENED_AT, Lãnh đạo LED_BY, Quy thuộc PART_OF/HAPPENED_IN/MENTIONED_IN, Kế vị ROYAL_LINEAGE, Tên hiệu ALIAS_OF/SAME_AS_LOCATION) để trích xuất JSON mảng ĐẦY ĐỦ toàn bộ các quan hệ chính xác:`;

    const callLlm = async (prompt: string, initialTemperature: number, maxTokens: number) => {
      let attempt = 0;
      let lastErr: any;
      const maxRetries = 4;

      while (attempt < maxRetries) {
        try {
          return await generateLLMCompletion(
            [
              { role: 'system', content: prompt },
              { role: 'user', content: userPrompt },
            ],
            {
              task: 'extraction',
              temperature: initialTemperature,
              max_tokens: maxTokens,
              response_format: { type: 'json_object' },
              timeoutMs:
                options?.timeoutMs ??
                (envConfig.USE_LOCAL_LLM ? (envConfig.LOCAL_LLM_TIMEOUT_MS || 15000) : envConfig.REMOTE_FALLBACK_TIMEOUT_MS),
            }
          );
        } catch (err: any) {
          lastErr = err;
          attempt++;
          if (attempt < maxRetries) {
            const backoffMs = 500 * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, backoffMs));
          }
        }
      }
      throw lastErr;
    };

    const resolveEntityFromRaw = (
      rawName?: string,
      rawId?: string
    ): { id: string; name: string; type?: string } | null => {
      const raw = (rawId || rawName || '').trim();
      if (!raw) return null;
      const s = raw.replace(/^(?:\[?id[:_\s-]*|entity[:_\s-]*)/i, '').replace(/[\])]+$/, '').trim();
      if (!s) return null;
      const sLower = s.toLowerCase();
      const rawLower = raw.toLowerCase();
      const textLower = text.toLowerCase();

      // 1. Direct slot code or distinct ID lookup in enumMap
      if (enumMap.has(sLower)) {
        const matched = enumMap.get(sLower)!;
        return {
          id: buildDistinctSpanId(matched),
          name: matched.text,
          type: matched.type,
        };
      }
      if (enumMap.has(rawLower)) {
        const matched = enumMap.get(rawLower)!;
        return {
          id: buildDistinctSpanId(matched),
          name: matched.text,
          type: matched.type,
        };
      }

      const codeMatch = s.match(/^(?:\[|\()?E(\d+)(?:\]|\))?(?::|\s*[-–—]\s*|\s+.*)?$/i) || s.match(/\bE(\d+)\b/i);
      if (codeMatch) {
        const code = `E${codeMatch[1]}`;
        if (enumMap.has(code)) {
          const matched = enumMap.get(code)!;
          return {
            id: buildDistinctSpanId(matched),
            name: matched.text,
            type: matched.type,
          };
        }
      }

      // 2. Direct ID lookup in Candidate Spans by distinctId or suggestedCanonicalId
      const candidateById = candidateSpans.find(
        (c) => buildDistinctSpanId(c).toLowerCase() === sLower || c.suggestedCanonicalId?.toLowerCase() === sLower
      );
      if (candidateById) {
        return {
          id: buildDistinctSpanId(candidateById),
          name: candidateById.text,
          type: candidateById.type,
        };
      }

      // 3. Direct Name lookup in Candidate Spans
      const candidateByText = candidateSpans.find(
        (c) => c.text.toLowerCase() === sLower || normalizeHistoricalMention(c.text).toLowerCase() === sLower
      );
      if (candidateByText) {
        return {
          id: buildDistinctSpanId(candidateByText),
          name: candidateByText.text,
          type: candidateByText.type,
        };
      }

      // 4. Mention snapping fallback
      const snapped = snapMentionToCandidate(s, candidateSpans);
      if (snapped) {
        return { id: snapped.id, name: snapped.name, type: snapped.type };
      }

      const directCanon = resolveCanonicalEntity(s) || resolveCanonicalEntity(normalizeHistoricalMention(s));
      if (directCanon && directCanon.entityId && !directCanon.entityId.startsWith('unknown_')) {
        const sClean = sLower.replace(/^(?:person|loc|doc|event|dynasty|org|artifact)_/, '').replace(/_/g, ' ');
        const canonNameLower = directCanon.canonicalName.toLowerCase();
        const isInText = textLower.includes(sLower) || textLower.includes(sClean) || textLower.includes(canonNameLower);
        if (isInText) {
          const isPrimary = slugify(directCanon.canonicalName) === slugify(s);
          return {
            id: isPrimary ? directCanon.entityId : buildCanonicalId(s, directCanon.type),
            name: directCanon.canonicalName || s,
            type: directCanon.type,
          };
        }
      }

      return null;
    };

    const NEGATION_PATTERNS = /\b(không|chẳng|chưa|chưa từng|bác bỏ|phản đối|bất thành|thất bại|không thể|không phải|không được|bất phân|không phục)\b/i;

    const parseContentToRawTriples = (content: string): { rawTriples: any[]; parseFailed: boolean } => {
      let jsonStr = content.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/^[\s\S]*?```json\s*/i, '').replace(/\s*```[\s\S]*$/, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/^[\s\S]*?```\s*/, '').replace(/\s*```[\s\S]*$/, '');
      }

      let rawTriples: any[] = [];
      let parseFailed = false;

      // Pre-heal common JSON syntax flaws from quantized models (e.g. "o": "E4} -> "o": "E4"})
      const healedJsonStr = jsonStr
        .replace(/"(E\d+)(?=[,}])/g, '"$1"')
        .replace(/"([a-zA-Z0-9_-]+)(?=[,}])/g, '"$1"');

      try {
        const parsed = JSON.parse(healedJsonStr);
        if (parsed && Array.isArray(parsed.triples)) {
          rawTriples = parsed.triples;
        } else if (Array.isArray(parsed)) {
          rawTriples = parsed;
        }
      } catch {
        parseFailed = true;
        const cleanVal = (v?: string) => (v ? v.trim().replace(/^["']|["']$/g, '') : undefined);
        const objectRegex = /\{\s*"(?:s|source(?:Entity)?)"\s*:\s*(?:"([^"]+)"|([^,}\s]+))\s*,\s*(?:"source(?:Entity)?Id"\s*:\s*(?:"([^"]+)"|([^,}\s]+))\s*,\s*)?"(?:r|rel|relation(?:Type)?)"\s*:\s*(?:"([^"]+)"|([^,}\s]+))\s*,\s*"(?:o|target(?:Entity)?)"\s*:\s*(?:"([^"]+)"|([^,}\s]+))(?:,\s*"(?:target(?:Entity)?Id)"\s*:\s*(?:"([^"]+)"|([^,}\s]+)))?(?:,\s*"(?:evidence)"\s*:\s*"([^"]+)")?(?:,\s*"(?:confidence)"\s*:\s*([0-9.]+))?\s*\}/g;
        let match;
        while ((match = objectRegex.exec(jsonStr)) !== null) {
          rawTriples.push({
            s: cleanVal(match[1] || match[2]),
            sourceEntityId: cleanVal(match[3] || match[4]),
            rel: cleanVal(match[5] || match[6]),
            o: cleanVal(match[7] || match[8]),
            targetEntityId: cleanVal(match[9] || match[10]),
            evidence: cleanVal(match[11]),
            confidence: match[12] ? parseFloat(match[12]) : 0.95,
          });
        }
      }
      return { rawTriples, parseFailed };
    };

    const parseAndValidateResult = (content: string): { triples: ExtractedTriple[]; parseFailed: boolean } => {
      const p = parseContentToRawTriples(content);
      const allRaw = p.rawTriples;
      const parseFailed = p.parseFailed && allRaw.length === 0;

      const validatedTriples: ExtractedTriple[] = [];
      const seenKeys = new Set<string>();
      const textLower = text.toLowerCase();

      for (const raw of allRaw) {
        if (process.env.DEBUG_EXTRACTION) {
          console.log('[DEBUG_EXTRACTION] Raw item:', raw);
        }
        const sRaw = raw.s || raw.sourceEntity || raw.source;
        const sRawId = raw.sourceEntityId || raw.sourceId;
        const tRaw = raw.o || raw.targetEntity || raw.target;
        const tRawId = raw.targetEntityId || raw.targetId;
        const relRaw = (raw.r || raw.rel || raw.relationType || raw.relation || '').trim().toUpperCase() as HistoricalRelationType;

        if (!relRaw || !VALID_RELATIONS.has(relRaw)) continue;

        if (raw.evidence && typeof raw.evidence === 'string' && NEGATION_PATTERNS.test(raw.evidence)) {
          continue;
        }

        const resolvedS = resolveEntityFromRaw(sRaw, sRawId);
        const resolvedT = resolveEntityFromRaw(tRaw, tRawId);

        if (!resolvedS || !resolvedT) continue;

        // Grounding guard for hallucination-prone relations from quantized LLMs
        if (relRaw === 'ALIAS_OF') {
          const ALIAS_KEYWORDS = /\b(tức\s+là|tức|tên\s+thật\s+là|hiệu\s+là|húy\s+là|tự\s+là|danh\s+xưng|khai\s+sinh|mang\s+tên|còn\s+gọi\s+là|nguyên\s+danh)\b/i;
          const hasKeyword = ALIAS_KEYWORDS.test(text);
          const directCanonS = resolveCanonicalEntity(resolvedS.name);
          const directCanonT = resolveCanonicalEntity(resolvedT.name);
          const hasKnownAlias = (directCanonS?.entityId && directCanonS.entityId === resolvedT.id) ||
            (directCanonT?.entityId && directCanonT.entityId === resolvedS.id);
          if (!hasKeyword && !hasKnownAlias) continue;
        }

        if (relRaw === 'ROYAL_LINEAGE') {
          const LINEAGE_KEYWORDS = /\b(con|thái\s+tử|hoàng\s+tử|cha|mẹ|truyền\s+ngôi|nhường\s+ngôi|dòng\s+dõi|hậu\s+duệ|kế\s+vị|sinh\s+ra|cha\s+con)\b/i;
          if (!LINEAGE_KEYWORDS.test(text)) continue;
        }

        let conf = raw.confidence ?? 0.95;
        if (raw.evidence && typeof raw.evidence === 'string') {
          const evClean = raw.evidence.trim().toLowerCase();
          if (evClean.length >= 3 && textLower.includes(evClean)) {
            conf = Math.min(1.0, conf + 0.03);
          }
        }

        const validated = validateAndCanonicalizeTriple(
          resolvedS,
          relRaw,
          resolvedT,
          conf,
          options?.headingAnchorYear
        );

        if (validated) {
          const key = `${validated.sourceEntityId}:${validated.relationType}:${validated.targetEntityId}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            validatedTriples.push(validated);
          }
        }
      }

      const hasPair = (idA: string, idB: string) => {
        const a = idA.toLowerCase();
        const b = idB.toLowerCase();
        return validatedTriples.some((vt) => {
          const va = vt.sourceEntityId.toLowerCase();
          const vb = vt.targetEntityId.toLowerCase();
          return (va === a && vb === b) || (va === b && vb === a);
        });
      };

      // 1. Add deterministic syntactic parenthetical triples
      const syntacticTriples = extractSyntacticParentheticalTriples(text, candidateSpans);
      for (const st of syntacticTriples) {
        const key = `${st.sourceEntityId}:${st.relationType}:${st.targetEntityId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          validatedTriples.push(st);
        }
      }

      // 2. Add deterministic royal lineage triples
      const lineageTriples = extractRoyalLineageTriples(text, candidateSpans);
      for (const lt of lineageTriples) {
        const key = `${lt.sourceEntityId}:${lt.relationType}:${lt.targetEntityId}`;
        if (!seenKeys.has(key) && !hasPair(lt.sourceEntityId, lt.targetEntityId)) {
          seenKeys.add(key);
          validatedTriples.push(lt);
        }
      }

      // 3. Complementary Residual Extraction
      const spatialTriples = extractSpatialHierarchyTriples(text, candidateSpans);
      for (const spt of spatialTriples) {
        const key = `${spt.sourceEntityId}:${spt.relationType}:${spt.targetEntityId}`;
        if (!seenKeys.has(key) && !hasPair(spt.sourceEntityId, spt.targetEntityId)) {
          seenKeys.add(key);
          validatedTriples.push(spt);
        }
      }

      const docTriples = extractSyntacticDocumentTriples(text, candidateSpans);
      for (const dt of docTriples) {
        const key = `${dt.sourceEntityId}:${dt.relationType}:${dt.targetEntityId}`;
        if (!seenKeys.has(key) && !hasPair(dt.sourceEntityId, dt.targetEntityId)) {
          seenKeys.add(key);
          validatedTriples.push(dt);
        }
      }

      const dynTriples = extractSyntacticDynasticTriples(text, candidateSpans);
      for (const dynt of dynTriples) {
        const key = `${dynt.sourceEntityId}:${dynt.relationType}:${dynt.targetEntityId}`;
        const hasExistingDynasty = validatedTriples.some(
          (vt) =>
            vt.sourceEntityId.toLowerCase() === dynt.sourceEntityId.toLowerCase() &&
            (vt.relationType === 'PART_OF' || vt.relationType === 'HAPPENED_IN')
        );
        if (!seenKeys.has(key) && !hasPair(dynt.sourceEntityId, dynt.targetEntityId) && !hasExistingDynasty) {
          seenKeys.add(key);
          validatedTriples.push(dynt);
        }
      }

      // Refine redundant derivative Person HAPPENED_AT Location when Person is already leader of Event at Location
      const battleEventsAtLoc = new Set<string>();
      for (const t of validatedTriples) {
        if (t.relationType === 'LED_BY' && t.sourceEntityId.startsWith('event_')) {
          const evId = t.sourceEntityId;
          const leaderId = t.targetEntityId;
          for (const other of validatedTriples) {
            if (other.relationType === 'HAPPENED_AT' && other.sourceEntityId === evId) {
              battleEventsAtLoc.add(`${leaderId}::${other.targetEntityId}`);
            }
          }
        }
      }
      const finalTriples = validatedTriples.filter((t) => {
        if (t.relationType === 'HAPPENED_AT' && t.sourceEntityId.startsWith('person_')) {
          const key = `${t.sourceEntityId}::${t.targetEntityId}`;
          if (battleEventsAtLoc.has(key)) {
            const hasPersonalResidence = /(quê|sinh|mất|hy\s+sinh|đóng\s+đô|dời\s+đô|an\s+táng|tu\s+hành|lập\s+căn\s+cứ|tọa\s+lạc)/i.test(text);
            if (!hasPersonalResidence) {
              return false;
            }
          }
        }
        return true;
      });

      return { triples: finalTriples, parseFailed };
    };

    // Execute Unified Single-Pass Extraction with LLM
    const res = await callLlm(systemPrompt, 0.0, 800);
    const parsedResult = parseAndValidateResult(res.content || '');

    // Persist to Disk Cache
    if (!options?.skipCache && !parsedResult.parseFailed) {
      await extractionCache.set(
        text,
        options?.chunkId || `chunk_${Date.now()}`,
        parsedResult.triples,
        { provider: res?.provider, model: res?.model }
      ).catch(() => {});
    }

    return {
      triples: parsedResult.triples,
      candidateSpans,
      res,
    };
  } catch (err) {
    const errMsg = formatConciseError(err);
    const isStrict = options?.strict !== false && (options?.strict === true || envConfig.EVAL_STRICT || !options?.allowFallback);

    if (isStrict) {
      throw new Error(`Stage 2 LLM Triple Extraction failed: ${errMsg}. Pass allowFallback=true for offline fallback.`);
    }

    if (!warnedLlmOffline) {
      log.warn('triple_extract.llm_offline', 'LLM extraction offline; using Stage 1 guided fallback', { reason: errMsg });
      logFallbackAlert({
        subsystem: 'LLM_GATEWAY',
        primaryTarget: `Local LLM Extraction (Port 8094) [qwen3.5-4b-instruct-q4_k_m]`,
        fallbackTarget: 'Stage 1 Candidate-Guided Rule Extractor',
        reason: errMsg,
        actionRequired: 'Start extraction server on port 8094 with: pnpm ai:extract or pnpm ai:lite',
      });
      warnedLlmOffline = true;
    }

    const fallbackTriples = extractTriplesFromText(text, options);
    return {
      triples: fallbackTriples,
      candidateSpans,
      error: errMsg,
    };
  }
}
