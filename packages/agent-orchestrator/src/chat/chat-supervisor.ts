/**
 * ChronoViet Chat Supervisor & Stream Coordinator
 * Coordinates Multi-tier Intent Routing, Multi-turn Query Rewriting, Graph Triples Injection,
 * Folklore & Citation Guardrails, and SSE Realtime Streaming.
 */

import {
  IRagEngine,
  ChatStreamResponse,
  GraphTripleItem,
  HistoricalCitationItem,
  isKnownMasterEntity,
  HISTORICAL_PERSON_DICTIONARY,
  resolveCanonicalEntity,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  generateLLMCompletion,
  generateLLMCompletionStream,
  ChatMessage,
  envConfig,
  ragTimeoutsTotal,
} from '@chronoviet/infra';
import { ChronoRagEngine } from '@chronoviet/rag-engine';
import {
  classifyChatIntent,
  ChatIntent,
  IntentClassificationResult,
} from './intent-classifier.js';
import {
  rewriteMultiTurnQuery,
  extractDialogueState,
  isContinuationOrCoreferenceQuery,
  isTopicShiftQuery,
  ChatTurnContext,
} from './query-rewriter.js';
import {
  pruneConversationHistory,
  pruneRagContext,
  pruneGraphTriples,
  clampTotalPromptMessages,
} from './context-pruner.js';
import { validateFolkloreHypothesisTone } from '../guardrails/folklore-validator.js';
import { analyzePremiseAndLeadingIntent, verifyCoReferenceInvariant } from '../guardrails/anti-sycophancy.js';
import {
  createStreamLoopDetector,
  deduplicateRepetitiveText,
  sanitizePromptDirectivesLeakage,
  normalizeMarkdownListBreaks,
} from '../guardrails/stream-dedup.js';
import { normalizeResilientText } from './text-normalizer.js';

const log = createLogger({ service: 'agent-orchestrator' });

export function escapePromptXml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/<\/?(?:historical_context|user_query|premise_directives|verified_rag_evidence|knowledge_graph_triples|verified_master_entities|dialogue_context_banner)[^>]*>/gi, '');
}

export function buildDynamicEntityKnowledgeCards(entityNamesOrIds: string[]): string {
  const cards: string[] = [];
  const seen = new Set<string>();

  for (const item of entityNamesOrIds) {
    if (!item || item.trim().length <= 2) continue;
    const clean = item.trim();
    const resolved = resolveCanonicalEntity(clean);
    const entId = resolved.entityId;
    const person = entId ? HISTORICAL_PERSON_DICTIONARY[entId] : undefined;

    const matchedPerson =
      person ||
      Object.values(HISTORICAL_PERSON_DICTIONARY).find(
        (p) =>
          p.canonicalName.toLowerCase() === clean.toLowerCase() ||
          p.aliases?.some((a) => a.toLowerCase() === clean.toLowerCase())
      );

    const target = matchedPerson || (resolved.entityId && !resolved.entityId.startsWith('ent_') ? resolved : undefined);
    if (!target) continue;

    if (!seen.has(target.entityId)) {
      seen.add(target.entityId);
      const lines: string[] = [];
      const label =
        target.type === 'DOCUMENT_CULTURE'
          ? 'Văn kiện / Tác phẩm'
          : target.type === 'LOCATION'
          ? 'Địa danh lịch sử'
          : target.type === 'EVENT_BATTLE'
          ? 'Sự kiện / Chiến dịch'
          : target.type === 'DYNASTY_ERA'
          ? 'Triều đại / Thời kỳ'
          : 'Nhân vật lịch sử';

      lines.push(`- ${label}: ${target.canonicalName}`);
      if (target.namingMetadata) {
        const meta = target.namingMetadata;
        if (meta.totalAliasesEstimated) {
          lines.push(`  + Tổng số lượng tên gọi / bút danh / bí danh ước tính: ${meta.totalAliasesEstimated}`);
        }
        if (meta.archetype === 'MODERN_FIGURE' || (meta.periodAliases && meta.periodAliases.length > 0)) {
          if (meta.birthName) {
            lines.push(`  + Tên khai sinh / Tên thuở nhỏ: ${meta.birthName}`);
          }
          if (meta.periodAliases && meta.periodAliases.length > 0) {
            lines.push(`  + Tên gọi và bí danh theo các thời kỳ hoạt động cách mạng:`);
            for (const pa of meta.periodAliases) {
              lines.push(`    * ${pa.period}: "${pa.name}"${pa.context ? ` (${pa.context})` : ''}`);
            }
          }
          if (meta.courtesyOrCommonName) {
            lines.push(`  + Danh xưng và tên thường gọi: ${meta.courtesyOrCommonName}`);
          }
        } else {
          if (meta.birthName) {
            lines.push(`  + Tên khai sinh / Tên húy: ${meta.birthName}`);
          }
          if (meta.courtesyOrCommonName) {
            lines.push(`  + Tên thường gọi / Tên tự: ${meta.courtesyOrCommonName}`);
          }
          if (meta.preReignTitles && meta.preReignTitles.length > 0) {
            lines.push(`  + Tước vị trước khi lên ngôi: ${meta.preReignTitles.join(', ')}`);
          }
          if (meta.reignEra) {
            let periodStr = '';
            if (typeof meta.reignPeriod === 'string') {
              periodStr = meta.reignPeriod;
            } else if (meta.reignPeriod && typeof meta.reignPeriod === 'object' && meta.reignPeriod.start != null) {
              const s = meta.reignPeriod.start < 0 ? `${Math.abs(meta.reignPeriod.start)} TCN` : `${meta.reignPeriod.start}`;
              const e = meta.reignPeriod.end != null ? (meta.reignPeriod.end < 0 ? `${Math.abs(meta.reignPeriod.end)} TCN` : `${meta.reignPeriod.end}`) : '';
              periodStr = e ? `${s} - ${e}` : s;
            }
            lines.push(`  + Niên hiệu khi lên ngôi Hoàng đế: ${meta.reignEra}${periodStr ? ` (${periodStr})` : ''}`);
          }
          if (meta.templeName) {
            lines.push(`  + Miếu hiệu: ${meta.templeName}`);
          }
          if (meta.posthumousName) {
            lines.push(`  + Thụy hiệu: ${meta.posthumousName}`);
          }
          if (meta.familyLineage) {
            const fam = meta.familyLineage;
            const famParts: string[] = [];
            if (fam.father) famParts.push(`Thân phụ: ${fam.father}`);
            if (fam.mother) famParts.push(`Thân mẫu: ${fam.mother}`);
            if (fam.siblings && fam.siblings.length > 0) famParts.push(`Anh/em ruột: ${fam.siblings.join(', ')}`);
            if (fam.spouses && fam.spouses.length > 0) famParts.push(`Phu thê: ${fam.spouses.join(', ')}`);
            if (fam.children && fam.children.length > 0) famParts.push(`Con cái: ${fam.children.join(', ')}`);
            if (famParts.length > 0) {
              lines.push(`  + Thân tộc chính sử: ${famParts.join('; ')}`);
            }
          }
        }
      } else if (target.aliases && target.aliases.length > 0) {
        lines.push(`  + Danh xưng / Tên gọi khác: ${target.aliases.slice(0, 6).join(', ')}`);
      }
      if (target.dynasty) {
        lines.push(`  + Triều đại: ${target.dynasty}`);
      }
      if (target.timeRange && target.timeRange.start != null && target.timeRange.end != null) {
        const start = target.timeRange.start;
        const end = target.timeRange.end;
        const startStr = start < 0 ? `${Math.abs(start)} TCN` : `${start}`;
        const endStr = end < 0 ? `${Math.abs(end)} TCN` : `${end}`;
        lines.push(`  + Niên đại chính sử: ${startStr} - ${endStr}`);
        if (start > 0) {
          lines.push(`  + Kỷ nguyên: Công Nguyên / Dương lịch (TUYỆT ĐỐI KHÔNG ghi nhầm thành TCN).`);
        }
      }
      cards.push(lines.join('\n'));
    }
  }

  if (cards.length === 0) return '';
  return `THẺ TRI THỨC LỊCH SỬ CHÍNH SỬ (GROUND TRUTH ENTITY CARDS):\n${cards.join('\n\n')}`;
}

export interface ChatSupervisorRequest {
  query: string;
  conversationId?: string;
  history?: ChatTurnContext[];
  signal?: AbortSignal;
  ragEngine?: IRagEngine;
}

export interface ChatExecutionResult {
  fullText: string;
  intent: ChatIntent;
  citations: (string | HistoricalCitationItem)[];
  triples: GraphTripleItem[];
  conversationId?: string;
}

/**
 * 100% Static System Persona Prompt for KV-Cache Preservation across all conversation turns.
 */
export const STATIC_SYSTEM_PERSONA_PROMPT = `Bạn là ChronoViet AI — Chuyên gia Nghiên cứu Lịch sử Việt Nam chuẩn mực, thông thái và khách quan.

NGUYÊN TẮC BẮT BUỘC:
1. NGUYÊN TẮC TOÀN DIỆN LỊCH SỬ & RÀNG BUỘC SỬ LIỆU TUYỆT ĐỐI (STRICT IN-CONTEXT GROUNDING):
   - Mọi mốc thời gian (niên đại chính xác), địa danh, kinh đô, nhân vật, tác phẩm và diễn biến cốt lõi BẮT BUỘC phải trích xuất và đối chiếu trực tiếp từ phần <verified_master_entities>, <verified_rag_evidence> và <knowledge_graph_triples>.
   - Đối với các triều đại ngoại bang phương Bắc xâm lược: Nêu chính xác triều đại cụ thể (Ví dụ: nhà Đông Hán, nhà Đường, nhà Tống, nhà Nguyên/Mông Cổ, nhà Minh, nhà Thanh), không gọi chung chung là "nhà Hán" nếu ngữ cảnh xác định rõ là Đông Hán.
   - Quy tắc niên đại: Các năm từ năm 1 trở đi thuộc kỷ nguyên Công Nguyên / Dương lịch (viết tự nhiên: "năm 1385", "năm 1941", "1965", TUYỆT ĐỐI KHÔNG thêm hậu tố "SCN" một cách máy móc vào các năm thông thường; chỉ dùng tiền tố/hậu tố "TCN" cho thời kỳ Trước Công Nguyên, và chỉ ghi "SCN" khi cần đối chiếu phân biệt đặc thù cho các năm nhỏ dưới 100 như năm 40 SCN).
   - NGUYÊN TẮC GÁN ĐÚNG THUỘC TÍNH NHÂN VẬT (ENTITY ATTRIBUTION INVARIANT): Khi câu hỏi hoặc ngữ cảnh liên quan đến nhiều nhân vật, BẮT BUỘC phải gán đúng niên đại, thân thế, chức vị và sự kiện cho từng nhân vật. TUYỆT ĐỐI KHÔNG nhầm lẫn hoặc hoán đổi sự kiện giữa các nhân vật (ví dụ: Lê Lợi chính là vua Lê Thái Tổ, tuyệt đối không viết Lê Lợi là con của Lê Thái Tổ; Lê Thái Tông mới là con thứ hai của Lê Thái Tổ).
   - NGUYÊN TẮC RÀNG BUỘC SỬ LIỆU & CHỐNG TỰ BỊA TIỂU SỬ (NEGATIVE GROUNDING & NO CAREER FABRICATION): TUYỆT ĐỐI KHÔNG tự suy đoán hoặc bịa đặt thêm chức vụ, sự nghiệp sau này cho nhân vật (ví dụ: không tự ý bịa đặt một chiến sĩ hay liệt sĩ hy sinh trẻ tuổi 'sau này trở thành lãnh đạo chính trị' hay 'tham gia các cuộc kháng chiến khác' nếu sử liệu không ghi nhận).
   - TUYỆT ĐỐI KHÔNG tự suy đoán, bịa đặt tên tuổi tướng lĩnh hoặc nhân vật không có trong sử liệu được cung cấp. Nếu ngữ cảnh thiếu thông tin chi tiết, BẮT BUỘC phải thông báo khách quan: "Sử liệu hiện có trong hệ thống chưa ghi nhận chi tiết này".
   - Luôn trích dẫn danh xưng chính thức, tên tác phẩm cụ thể, áng văn hoặc văn kiện lịch sử xuất hiện trong ngữ cảnh thay vì dùng từ ngữ khái quát ("ông ấy", "văn bản này").
   - Khi giải thích các áng văn kiện, chiếu cáo, lời thề xuất quân, hoặc bối cảnh địa thế/nguyên nhân sự kiện (như Chiếu dời đô, Lời thề Mê Linh, Hịch tướng sĩ, Bình Ngô đại cáo, v.v.): BẮT BUỘC trích dẫn các câu chữ, hình tượng kinh điển trong nguyên tác xuất hiện ở sử liệu (ví dụ: "rồng cuộn hổ ngồi", "Một xin rửa sạch nước thù...", "việc nhân nghĩa cốt ở yên dân"...) thay vì chỉ tóm tắt thuần túy.
   - Khi trình bày về một vụ án, biến cố hoặc bi kịch lịch sử: Luôn nêu đầy đủ cả nguyên nhân trực tiếp (nạn nhân, người bị liên đới, vị vua trị vì bấy giờ) và hậu quả / việc minh oan sau này dựa trên sử liệu.
   - Khi trình bày về trận đánh, chiến dịch hoặc cuộc kháng chiến: Trình bày mạch lạc bối cảnh, tướng lĩnh chủ chốt hai bên được ghi chép trong sử liệu, diễn biến chính, kế sách quân sự và ý nghĩa bước ngoặt lịch sử.

2. QUY TẮC ĐỒNG NHẤT DANH XƯNG & THÂN TỘC PHONG KIẾN (NOMENCLATURE & ROYALTY INVARIANT):
   - Trong lịch sử phong kiến Việt Nam, một nhân vật thường có nhiều tên gọi (tên húy/tên khai sinh, miếu hiệu, niên hiệu, tôn hiệu, tước vị). 
   - Khi câu hỏi đề cập các danh xưng của CÙNG MỘT NGƯỜI, BẮT BUỘC phải khẳng định ngay ở câu mở đầu rằng đây là cùng một nhân vật lịch sử (Ví dụ: Vua [Miếu hiệu] tên húy là [Tên húy]). Tuyệt đối không tách thành hai người riêng biệt hoặc mô tả như hai nhân vật có quan hệ huyết thống với nhau.
   - NGUYÊN LÝ BẤT BIẾN ĐỒNG NHẤT BẢN THỂ (CO-REFERENCE IDENTITY & KINSHIP INVARIANT): Một nhân vật lịch sử BẤT BIẾN không thể là cha, con, anh, em hay họ hàng của chính bản thân mình (Ví dụ: Đinh Tiên Hoàng và Đinh Bộ Lĩnh là cùng một người; Đinh Tiên Hoàng KHÔNG THỂ là con hay cha của Đinh Bộ Lĩnh. Thân phụ của Đinh Bộ Lĩnh là Đinh Công Trứ). BẮT BUỘC câu đầu tiên phải bác bỏ dứt khoát tiền đề sai lệch và khẳng định hai danh xưng là cùng một người.
   - CHỈ ĐƯỢC PHÉP ghi tên húy nếu tên đó xuất hiện trực tiếp trong sử liệu xác thực. Nếu không có tên húy trong ngữ cảnh, dùng miếu hiệu/danh xưng chính thức.
   - Khi sử liệu ghi miếu hiệu vắn tắt (như Thái Tông, Thánh Tông, Nhân Tông, Anh Tông...), BẮT BUỘC đối chiếu cẩn trọng với mốc thời gian (năm xảy ra sự kiện) và thứ tự trị vì trong văn bản để xác định đúng vị vua, TUYỆT ĐỐI KHÔNG nhầm lẫn giữa các vị vua kế tiếp nhau trong cùng triều đại (ví dụ: Lê Thái Tổ -> Lê Thái Tông mất năm 1442 tại Lệ Chi Viên -> Lê Nhân Tông -> Lê Nghi Dân -> Lê Thánh Tông lên ngôi năm 1460 và giải oan cho Nguyễn Trãi năm 1464).

3. QUY TẮC PHẢN BIỆN TIỀN ĐỀ SAI (UNIVERSAL ANTI-SYCOPHANCY & HISTORICAL REFUTATION):
   - Nếu câu hỏi chứa tiền đề sai lệch (sai niên đại, gán nhầm sự kiện/địa bàn, gán sai chiến công hoặc đưa công nghệ/vũ khí/khái niệm hiện đại vào thời kỳ phong kiến/cổ đại), bạn BẮT BUỘC phải bác bỏ rõ ràng NGAY Ở CÂU ĐẦU TIÊN (Ví dụ: "Không, vào thời kỳ [X] hoàn toàn chưa có [Y]...", "Không, thông tin này không chính xác..."). Đồng thời đính chính rõ sự thật lịch sử dựa trên sử liệu.
   - Khi câu hỏi hỏi về mối quan hệ thân tộc hoặc so sánh giữa hai nhân vật sống ở hai thời kỳ lịch sử hoàn toàn khác nhau (ví dụ: một nhân vật thời Hậu Lê thế kỷ 15 và một nhân vật thời Hiện đại thế kỷ 20), BẮT BUỘC phải bác bỏ rõ ràng ngay ở câu đầu tiên (ví dụ: "Không, [Nhân vật A] và [Nhân vật B] không phải là anh em và không có quan hệ thân tộc; họ sống ở hai thời kỳ lịch sử cách nhau hàng trăm năm."), sau đó trình bày vắn tắt niên đại, thân thế của từng người dựa trên sử liệu.
   - TUYỆT ĐỐI KHÔNG xu nịnh hoặc đồng tình ("Đúng rồi", "Đúng vậy") với tiền đề sai của người dùng.
   - Khi một nhân vật hoặc tên gọi KHÔNG CÓ trong chính sử Việt Nam (hoặc hư cấu, không xác định), BẮT BUỘC phải nói rõ: "Trong chính sử không có ghi chép về nhân vật mang tên [X]" thay vì suy đoán.

4. NGUYÊN TẮC BỐI CẢNH LỊCH SỬ & CHỐNG SUY DIỄN PHI THỜI ĐẠI (HISTORIOGRAPHICAL CONTEXT & ANTI-ANACHRONISM):
   - Mọi lý giải về nhân khẩu học, sự phân bố dòng họ, thứ bậc xã hội và phong tục tập quán cổ truyền BẮT BUỘC phải dựa trên hệ quy chiếu chế độ phong kiến Nho giáo (các biến cố đổi họ lánh nạn, kiêng húy, ban quốc tính, hoặc sổ đinh hộ tịch). Tuyệt đối không áp dụng tư duy tự do cá nhân hoặc góc nhìn đạo đức hiện đại.
   - Đối với tư liệu truyền thuyết hoặc dã sử (LEVEL_3): BẮT BUỘC dùng từ ngữ giả định: 'theo truyền thuyết', 'tương truyền', 'dân gian kể rằng'.

5. NGUYÊN TẮC TRÌNH BÀY & ĐỊNH DẠNG DANH SÁCH MARKDOWN (MARKDOWN LIST FORMATTING INTEGRITY):
   - Trình bày rõ ràng, mạch lạc với định dạng Markdown chuẩn (tiêu đề, danh sách, in đậm từ khóa quan trọng).
   - QUY TẮC BẮT BUỘC KHI VIẾT DANH SÁCH (STRICT LIST FORMATTING):
     * MỌI danh sách (dù dùng gạch đầu dòng '- ' hay đánh số thứ tự '1. ', '2. ', '3. ') BẮT BUỘC mỗi mục phải bắt đầu trên một dòng riêng biệt, có ký tự xuống dòng ngắt quãng (\n\n- hoặc \n\n1. ).
     * TUYỆT ĐỐI KHÔNG viết các mục danh sách nối tiếp dính liền nhau trên cùng một dòng hay trong cùng một đoạn văn (Ví dụ SAI: "1. Mục một. 2. Mục hai. 3. Mục ba.").
     * Ví dụ ĐÚNG:
       - **Mục 1**: Nội dung chi tiết...

       - **Mục 2**: Nội dung chi tiết...
   - TUYỆT ĐỐI KHÔNG lặp lại nguyên văn các câu, đoạn văn hoặc danh sách đã trình bày trong cùng một câu trả lời.

6. QUY TẮC DANH TÍNH & NĂNG LỰC TRỢ LÝ (SYSTEM IDENTITY & CAPABILITIES):
   - Bạn là ChronoViet AI — Trợ lý Nghiên cứu Lịch sử Việt Nam chuyên sâu và Sản xuất Video Lịch sử tự động.
   - Phạm vi tri thức: Toàn diện tiến trình lịch sử Việt Nam từ thời cổ đại (Hồng Bàng, Văn Lang - Âu Lạc), thời kỳ Bắc thuộc, các triều đại phong kiến độc lập đến thời cận - hiện đại.
   - Nguồn dữ liệu cốt lõi: Đồ thị tri thức (GraphRAG) được xây dựng từ các bộ chính sử kinh điển (Đại Việt Sử Ký Toàn Thư, Khâm Định Việt Sử Thông Giám Cương Mục, Đại Nam Thực Lục, v.v.).
   - Tính năng tiêu biểu: Tra cứu và phản biện sử liệu với trích dẫn minh bạch, phân tích chiến thuật, đồng nhất danh xưng, và tự động chuyển hóa câu chuyện lịch sử thành kịch bản phân cảnh kèm video hoạt họa (Video Studio).
   - Khi người dùng hỏi về danh tính, khả năng hỗ trợ, phạm vi tra cứu hoặc hướng dẫn sử dụng: Giới thiệu ngắn gọn, mạch lạc trong 1-2 câu ("Tôi là ChronoViet AI..."). ĐẶC BIỆT: Nếu câu hỏi có hỏi kèm một nhân vật, sự kiện hoặc chủ đề lịch sử cụ thể, CHỈ chào hỏi và giới thiệu tối đa 1 câu, sau đó tập trung toàn bộ phản hồi vào giải đáp chủ đề lịch sử được hỏi; TUYỆT ĐỐI KHÔNG liệt kê danh sách các triều đại để tối ưu tốc độ phản hồi.

7. NGUYÊN TẮC GIẢI ĐÁP CÂU HỎI ĐỊNH LƯỢNG & THỐNG KÊ (QUANTITATIVE & STATISTICAL PRECISION):
   - Khi người dùng hỏi về số lượng ("bao nhiêu", "tổng cộng bao nhiêu", "tất cả mấy cái tên/biệt danh/trận đánh/vị vua..."):
     * BẮT BUỘC trả lời TRỰC DIỆN con số tổng quan, số lượng xác thực hoặc khoảng ước tính được chính sử / tư liệu lịch sử công nhận NGAY Ở CÂU MỞ ĐẦU (ví dụ: tổng số đời vua, số năm trị vì, số lượng tướng lĩnh/thân tộc, hoặc tổng số danh xưng/bí danh được giới sử học ghi nhận).
     * TUYỆT ĐỐI KHÔNG bỏ qua câu hỏi số lượng để chỉ liệt kê danh sách vài ví dụ mà không nêu rõ con số tổng thể.
     * Sau khi nêu con số tổng quan ở câu đầu, mới trình bày bối cảnh và liệt kê chi tiết các mốc/danh xưng/sự kiện tiêu biểu nhất.`;

/**
 * Tier 2 Speculative Semantic Arbiter using the primary local model (Qwen 3.5 9B).
 * Only invoked for ambiguous queries where Tier 1 linguistic heuristic tagged needsSemanticArbitration: true.
 * Evaluates semantic domain, extracts implicit or fake entities, and refines sub-intent.
 * Guaranteed fast execution (< 4.5s timeout) with fail-safe fallback to RAG.
 */
async function arbitrateAmbiguousQueryWithLLM(
  query: string,
  classification: IntentClassificationResult,
  signal?: AbortSignal,
  recentHistoryContext?: string
): Promise<IntentClassificationResult> {
  const arbiterStartTime = Date.now();
  try {
    const historyBlock = recentHistoryContext
      ? `\nNgữ cảnh hội thoại trước đó:\n${recentHistoryContext}\n`
      : '';
    const prompt = `Bạn là bộ phân loại ý định ngữ nghĩa cho hệ thống ChronoViet AI (Trợ lý Lịch sử Việt Nam).
Hãy phân tích câu truy vấn sau của người dùng và trả về DUY NHẤT một JSON hợp lệ:
Câu truy vấn: "${query}"${historyBlock}

Yêu cầu phân loại:
1. is_historical: true nếu câu hỏi đề cập hoặc hướng đến lịch sử Việt Nam, nhân vật, sự kiện, triều đại, quan hệ họ hàng lịch sử (kể cả nhân vật hư cấu hoặc nghi vấn); false nếu là trò chuyện thông thường, tán gẫu đời sống hiện đại, hoặc ngoài phạm vi lịch sử.
2. intent: "HISTORICAL_QUERY" | "CHITCHAT" | "OUT_OF_DOMAIN" | "VIDEO_INTENT".
3. sub_intent: "GENEALOGY_RELATION" (nếu hỏi quan hệ dòng họ/anh em/cha con) | "FACTOID_LOOKUP" (ngày tháng/nơi chốn/danh tính) | "BATTLE_TACTICS" (trận đánh/kế sách) | "GENERAL_OVERVIEW".
4. suspected_fake_or_unverified_entities: danh sách tên các nhân vật trong câu hỏi có thể là hư cấu, không có trong chính sử, hoặc chưa được xác thực (ví dụ: ["Nguyễn Ảo Danh"]).
5. verified_or_implicit_entities: danh sách tên các nhân vật có thật hoặc ngầm định được suy ra từ câu hỏi.

Chỉ xuất JSON thuần theo cấu trúc sau, không kèm bất kỳ giải thích nào khác:
{
  "is_historical": boolean,
  "intent": "HISTORICAL_QUERY" | "CHITCHAT" | "OUT_OF_DOMAIN",
  "sub_intent": "GENEALOGY_RELATION" | "FACTOID_LOOKUP" | "BATTLE_TACTICS" | "GENERAL_OVERVIEW",
  "suspected_fake_or_unverified_entities": string[],
  "verified_or_implicit_entities": string[]
}`;

    const res = await generateLLMCompletion(
      [{ role: 'user', content: prompt }],
      {
        task: 'general', // Routes to Primary LLM (Qwen 3.5 9B, Port 8092)
        temperature: 0.1,
        max_tokens: 120,
        timeoutMs: 4500,
      }
    );

    const raw = res.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      log.info('chat.arbiter_success', `Tier 2 Arbiter completed in ${Date.now() - arbiterStartTime}ms`, {
        is_historical: parsed.is_historical,
        intent: parsed.intent,
        suspectedFake: parsed.suspected_fake_or_unverified_entities,
      });

      const updatedIntent: ChatIntent =
        parsed.intent === 'CHITCHAT' || parsed.intent === 'OUT_OF_DOMAIN' || parsed.intent === 'VIDEO_INTENT'
          ? parsed.intent
          : parsed.is_historical === false
          ? 'CHITCHAT'
          : 'HISTORICAL_QUERY';

      return {
        ...classification,
        intent: updatedIntent,
        subIntent: parsed.sub_intent || classification.subIntent,
        needsSemanticArbitration: false,
        arbitratedFakeEntities: Array.isArray(parsed.suspected_fake_or_unverified_entities)
          ? parsed.suspected_fake_or_unverified_entities
          : [],
        arbitratedEntities: Array.isArray(parsed.verified_or_implicit_entities)
          ? parsed.verified_or_implicit_entities
          : [],
      };
    }
  } catch (err: any) {
    log.warn('chat.arbiter_fallback', `Tier 2 Arbiter timed out or failed (${err.message}). Safe fallback to RAG.`, {
      latencyMs: Date.now() - arbiterStartTime,
    });
  }

  // Fail-safe to RAG
  return {
    ...classification,
    needsSemanticArbitration: false,
  };
}

export async function* handleChatQueryStream(
  request: ChatSupervisorRequest
): AsyncGenerator<ChatStreamResponse> {
  const { query, conversationId, history = [], signal, ragEngine } = request;
  const startTime = Date.now();

  const { normalized: normalizedQuery } = normalizeResilientText(query);
  const effectiveQuery = normalizedQuery.trim() || query.trim();

  log.info('chat.supervisor_started', `Chat query received: "${effectiveQuery.slice(0, 50)}..."`, {
    conversationId,
    historyTurns: history.length,
  });

  if (signal?.aborted) {
    yield { type: 'error', error: 'Yêu cầu đã bị hủy bởi người dùng' };
    return;
  }

  const prunedHistory = pruneConversationHistory(history);

  // 1. Intent Classification (< 1ms)
  let classification = classifyChatIntent(effectiveQuery);

  // Multi-turn Continuation Guard: If classified as CHITCHAT but is a follow-up continuation
  // with existing conversation history, elevate it to HISTORICAL_QUERY.
  if (
    classification.intent === 'CHITCHAT' &&
    history.length > 0 &&
    isContinuationOrCoreferenceQuery(effectiveQuery)
  ) {
    classification.intent = 'HISTORICAL_QUERY';
    classification.subIntent = classification.subIntent || 'GENERAL_OVERVIEW';
  }

  // Multi-turn Fast-Path Co-reference: If query is flagged for semantic arbitration
  // but is a clear follow-up continuation with conversation history, fast-path to HISTORICAL_QUERY
  // and resolve anaphora deterministically via Dialogue State Tracking instead of blocking on Tier 2 LLM Arbiter.
  if (
    classification.needsSemanticArbitration &&
    history.length > 0 &&
    isContinuationOrCoreferenceQuery(effectiveQuery)
  ) {
    classification.needsSemanticArbitration = false;
    classification.intent = 'HISTORICAL_QUERY';
    classification.subIntent = classification.subIntent || 'GENERAL_OVERVIEW';
  }

  // Tier 2 Speculative Semantic Arbiter (Single Qwen 3.5 9B instance on Port 8092)
  if (classification.needsSemanticArbitration && !signal?.aborted) {
    const recentHistoryText = history.length > 0
      ? history.slice(-2).map((t) => `${t.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${t.content.slice(0, 150)}`).join('\n')
      : undefined;
    classification = await arbitrateAmbiguousQueryWithLLM(effectiveQuery, classification, signal, recentHistoryText);
  }

  const compositeIntents = classification.compositeResult?.clauses.map((c) => c.intent) || [classification.intent];
  yield {
    type: 'intent',
    intent: classification.intent,
    content: classification.suggestedTopic || classification.matchedCanonicalName,
    compositeIntents,
    videoHandover: classification.videoHandover,
  };

  // 2. Out-of-Domain Route -> LLM Direct Persona Stream
  if (classification.intent === 'OUT_OF_DOMAIN') {
    log.info('chat.out_of_domain_llm', `Handling out-of-domain query via LLM: "${effectiveQuery.slice(0, 50)}"`, {
      conversationId,
    });

    const rawMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `${STATIC_SYSTEM_PERSONA_PROMPT}\n\nLƯU Ý QUAN TRỌNG: Câu hỏi này nằm ngoài phạm vi tri thức Lịch sử Việt Nam (ẩm thực thông thường, đầu tư tài chính/chứng khoán, lập trình công nghệ, v.v.). Hãy lịch sự, từ tốn từ chối trả lời nội dung ngoài phạm vi này theo đúng tư cách Trợ lý ChronoViet, đồng thời gợi ý người dùng các chủ đề lịch sử Việt Nam hấp dẫn có thể khám phá.`,
      },
      ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: effectiveQuery },
    ];
    const messages = clampTotalPromptMessages(rawMessages, 4000);

    let fullResponse = '';
    const loopDetector = createStreamLoopDetector();

    try {
      for await (const chunk of generateLLMCompletionStream(messages, {
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 800,
      })) {
        if (signal?.aborted) {
          yield { type: 'error', error: 'Yêu cầu đã bị hủy trong quá trình sinh phản hồi' };
          return;
        }

        const loopCheck = loopDetector.processChunk(chunk);
        if (loopCheck.shouldTerminate) break;
        if (loopCheck.shouldEmit && loopCheck.cleanChunk) {
          fullResponse += loopCheck.cleanChunk;
          yield { type: 'token', content: loopCheck.cleanChunk };
        }
      }
    } catch (llmErr: any) {
      log.error('chat.ood_llm_error', `LLM Stream error in out-of-domain mode: ${llmErr.message}`);
      const fallback = 'Xin lỗi bạn, tôi là ChronoViet AI — Trợ lý chuyên sâu về Nghiên cứu Lịch sử Việt Nam. Yêu cầu này nằm ngoài phạm vi tri thức lịch sử của hệ thống. Bạn có thể hỏi tôi về các triều đại, nhân vật, sự kiện hoặc trận đánh lịch sử Việt Nam!';
      yield { type: 'token', content: fallback };
      fullResponse = fallback;
    }

    fullResponse = normalizeMarkdownListBreaks(deduplicateRepetitiveText(fullResponse));
    yield { type: 'citation', citations: [] };
    yield {
      type: 'done',
      content: fullResponse,
      citations: [],
      conversationId,
      videoHandover: classification.videoHandover,
    };
    return;
  }

  // 3. Chitchat & Bot Capability Routing -> Direct LLM Stream (Tier 2 - No RAG search cost)
  if (classification.intent === 'CHITCHAT') {
    log.info('chat.persona_direct_llm', `Handling conversational/persona query directly via LLM: "${effectiveQuery.slice(0, 50)}"`, {
      conversationId,
    });

    const rawMessages: ChatMessage[] = [
      { role: 'system', content: STATIC_SYSTEM_PERSONA_PROMPT },
      ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: effectiveQuery },
    ];
    const messages = clampTotalPromptMessages(rawMessages, 4000);

    let fullResponse = '';
    const loopDetector = createStreamLoopDetector();

    try {
      for await (const chunk of generateLLMCompletionStream(messages, {
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 1200,
      })) {
        if (signal?.aborted) {
          yield { type: 'error', error: 'Yêu cầu đã bị hủy trong quá trình sinh phản hồi' };
          return;
        }

        const loopCheck = loopDetector.processChunk(chunk);
        if (loopCheck.shouldTerminate) {
          log.warn('chat.persona_loop_break', 'Repetition loop detected in persona stream, breaking early');
          break;
        }

        if (loopCheck.shouldEmit && loopCheck.cleanChunk) {
          fullResponse += loopCheck.cleanChunk;
          yield { type: 'token', content: loopCheck.cleanChunk };
        }
      }
    } catch (llmErr: any) {
      log.error('chat.persona_llm_error', `LLM Stream error in persona mode: ${llmErr.message}`);
      const fallback = 'Tôi là ChronoViet AI — Trợ lý chuyên sâu về Lịch sử Việt Nam và Sáng tạo Video tự động. Tôi có thể hỗ trợ bạn tra cứu các triều đại, nhân vật, sự kiện lịch sử hoặc tạo video!';
      yield { type: 'token', content: fallback };
      fullResponse = fallback;
    }

    fullResponse = normalizeMarkdownListBreaks(deduplicateRepetitiveText(fullResponse));

    yield { type: 'citation', citations: [] };
    yield {
      type: 'done',
      content: fullResponse,
      citations: [],
      conversationId,
      videoHandover: classification.videoHandover,
    };
    return;
  }

  // 4. Video Creation Intent -> Direct LLM Stream
  if (classification.intent === 'VIDEO_INTENT') {
    const topic = classification.suggestedTopic || effectiveQuery;
    log.info('chat.video_intent_llm', `Handling video intent query via LLM: "${topic.slice(0, 50)}"`, {
      conversationId,
    });

    const rawMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `${STATIC_SYSTEM_PERSONA_PROMPT}\n\nLƯU Ý QUAN TRỌNG: Người dùng đang muốn sản xuất video lịch sử về chủ đề: "${topic}". Hãy hào hứng xác nhận chủ đề, tóm tắt nhanh 2-3 phân cảnh lịch sử tiêu biểu/kịch tính nhất của chủ đề này, và hướng dẫn người dùng nhấn nút "Tạo Video" hoặc chuyển sang tab Video Studio để bắt đầu tạo kịch bản phân cảnh và render video tự động.`,
      },
      ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: effectiveQuery },
    ];
    const messages = clampTotalPromptMessages(rawMessages, 4000);

    let fullResponse = '';
    const loopDetector = createStreamLoopDetector();

    try {
      for await (const chunk of generateLLMCompletionStream(messages, {
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 1000,
      })) {
        if (signal?.aborted) {
          yield { type: 'error', error: 'Yêu cầu đã bị hủy trong quá trình sinh phản hồi' };
          return;
        }

        const loopCheck = loopDetector.processChunk(chunk);
        if (loopCheck.shouldTerminate) break;
        if (loopCheck.shouldEmit && loopCheck.cleanChunk) {
          fullResponse += loopCheck.cleanChunk;
          yield { type: 'token', content: loopCheck.cleanChunk };
        }
      }
    } catch (llmErr: any) {
      log.error('chat.video_llm_error', `LLM Stream error in video intent mode: ${llmErr.message}`);
      const fallback = `Tôi đã nhận diện yêu cầu sản xuất video về chủ đề: "${topic}". Bạn có thể chuyển trực tiếp sang tab Video Studio để bắt đầu quy trình tạo video tự động.`;
      yield { type: 'token', content: fallback };
      fullResponse = fallback;
    }

    fullResponse = normalizeMarkdownListBreaks(deduplicateRepetitiveText(fullResponse));
    yield { type: 'citation', citations: [] };
    yield {
      type: 'done',
      content: fullResponse,
      citations: [],
      conversationId,
      videoHandover: classification.videoHandover,
    };
    return;
  }

  // 5. Premise Analysis, Dialogue State Tracking & Query Rewriting
  const premiseAnalysis = analyzePremiseAndLeadingIntent(effectiveQuery);

  // Ingest arbitrated fake or unverified entities into premiseAnalysis.detectedEntities
  if (classification.arbitratedFakeEntities && classification.arbitratedFakeEntities.length > 0) {
    for (const fakeEnt of classification.arbitratedFakeEntities) {
      if (!premiseAnalysis.detectedEntities.includes(fakeEnt)) {
        premiseAnalysis.detectedEntities.push(fakeEnt);
      }
    }
  }

  const dialogueState = extractDialogueState(history, effectiveQuery);
  let searchTopic = classification.cleanSearchTopic || effectiveQuery;
  if (history.length > 0) {
    searchTopic = rewriteMultiTurnQuery(searchTopic, history, dialogueState);
    // Enrich videoHandover with multi-turn primary entity context if not specified explicitly
    if (dialogueState.primaryEntity && !classification.videoHandover?.canonicalName) {
      const canonical = dialogueState.primaryEntity;
      const resolved = resolveCanonicalEntity(canonical);
      classification.videoHandover = {
        topic: searchTopic,
        canonicalName: canonical,
        primaryEntityId: resolved?.entityId || classification.videoHandover?.primaryEntityId,
      };
    }
  }

  const currentKnownEntities = premiseAnalysis.detectedEntities.filter((e) => isKnownMasterEntity(e));
  if (
    classification.matchedCanonicalName &&
    isKnownMasterEntity(classification.matchedCanonicalName) &&
    !currentKnownEntities.includes(classification.matchedCanonicalName)
  ) {
    currentKnownEntities.push(classification.matchedCanonicalName);
  }
  if (classification.arbitratedEntities && classification.arbitratedEntities.length > 0) {
    for (const ent of classification.arbitratedEntities) {
      if (isKnownMasterEntity(ent) && !currentKnownEntities.includes(ent)) {
        currentKnownEntities.push(ent);
      }
    }
  }

  const isTopicShift = isTopicShiftQuery(effectiveQuery, history, currentKnownEntities);

  const entitiesToFilter = Array.from(new Set([
    ...premiseAnalysis.detectedEntities,
    ...(isTopicShift ? [] : (dialogueState.primaryEntity ? [dialogueState.primaryEntity] : [])),
    ...(isTopicShift ? [] : dialogueState.veneratedEntities),
    ...(isTopicShift ? [] : dialogueState.adversaryEntities),
    ...(isTopicShift ? [] : dialogueState.activeDocuments),
    ...(isTopicShift ? [] : dialogueState.activeLocations),
  ]));

  const resolvedFilterIds = entitiesToFilter
    .filter((e) => isKnownMasterEntity(e))
    .map((e) => resolveCanonicalEntity(e).entityId)
    .filter((id): id is string => Boolean(id) && !id.startsWith('ent_'));

  // If the query mentions multiple entities (e.g. A and B in kinship, comparative, or premise queries)
  // but not all of them could be resolved into known filter IDs, DO NOT restrict entityFilter to a subset.
  // Letting entityFilter = undefined enables open hybrid BM25 + vector search across the entire corpus.
  const hasUnresolvedEntityInMultiEntityQuery =
    premiseAnalysis.detectedEntities.length >= 2 &&
    resolvedFilterIds.length < premiseAnalysis.detectedEntities.length;

  const effectiveEntityFilter =
    hasUnresolvedEntityInMultiEntityQuery || resolvedFilterIds.length === 0
      ? undefined
      : resolvedFilterIds;

  // Adaptive Budgeting for ENTITY_IDENTITY vs standard HISTORICAL_QUERY
  const isEntityIdentity = classification.intent === 'ENTITY_IDENTITY';
  const isLeanIdentity =
    isEntityIdentity &&
    (Boolean(premiseAnalysis.isSameEntityCoReference) || Boolean(classification.signals?.isCoReferenceIdentity));

  const maxRagTokens = isLeanIdentity
    ? 600
    : isEntityIdentity
    ? 1000
    : classification.subIntent === 'FACTOID_LOOKUP'
    ? 800
    : classification.subIntent === 'GENEALOGY_RELATION'
    ? 1200
    : 3000;

  const rerankTopK = isLeanIdentity
    ? 2
    : classification.subIntent === 'FACTOID_LOOKUP' || isEntityIdentity
    ? 3
    : classification.subIntent === 'GENEALOGY_RELATION'
    ? 3
    : 5;

  const maxGenerationTokens = isLeanIdentity
    ? 500
    : classification.subIntent === 'FACTOID_LOOKUP'
    ? 500
    : classification.subIntent === 'GENEALOGY_RELATION' || isEntityIdentity
    ? 750
    : classification.subIntent === 'BATTLE_TACTICS'
    ? 1200
    : 1000;

  // 7. Deep Chrono-RAG Search with Graph Triples
  const engine = ragEngine || new ChronoRagEngine();
  let verifiedCitations: string[] = [];
  let graphTriples: GraphTripleItem[] = [];
  let contextSnippets = '';
  let isFolkloreSource = false;
  let isRagSystemError = false;
  let isZeroContextFound = false;

  const ragTimeoutMs = envConfig.RAG_SEARCH_TIMEOUT_MS || 20000;
  try {
    const ragResponse = await Promise.race([
      engine.search({
        query: searchTopic,
        subIntent: classification.subIntent,
        rerankTopK,
        maxTokens: maxRagTokens,
        entityFilter: effectiveEntityFilter,
      }),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('RAG search timeout')), ragTimeoutMs)
      ),
    ]);

    verifiedCitations = ragResponse.citations || [];
    graphTriples = (ragResponse.triples as GraphTripleItem[]) || [];

    contextSnippets = (ragResponse.verifiedContext || [])
      .map((v: any) => {
        const cleanSummary = (v.summary || '').replace(/^(?:\[[^\]\n]+\]\s*)+/gu, '').trim();
        return `### ${v.canonicalName}\n${cleanSummary}\n(Nguồn: ${v.citations.join(', ')})`;
      })
      .join('\n\n');

    isFolkloreSource = (ragResponse.verifiedContext || []).some((v: any) =>
      v.citations.some((c: any) => /LEVEL_3|dã sử|truyền thuyết/i.test(c))
    );

    if (!contextSnippets || contextSnippets.trim().length === 0) {
      isZeroContextFound = true;
      verifiedCitations = [];
    }

    // Emit triples and verified citations once context relevance is guaranteed
    if (graphTriples.length > 0) {
      yield { type: 'triples', triples: graphTriples };
    }
    if (verifiedCitations.length > 0 && !isZeroContextFound) {
      yield { type: 'citation', citations: verifiedCitations };
    } else {
      yield { type: 'citation', citations: [] };
    }
  } catch (ragErr: any) {
    isRagSystemError = true;
    if (ragErr.message?.includes('RAG search timeout')) {
      ragTimeoutsTotal.inc();
    }
    log.warn('chat.rag_retrieval_fallback', `RAG retrieval warning: ${ragErr.message}`, {
      query: searchTopic,
      timeoutMs: ragTimeoutMs,
    });
    yield { type: 'citation', citations: [] };
  }

  if (signal?.aborted) {
    yield { type: 'error', error: 'Yêu cầu đã bị hủy' };
    return;
  }

  // 6. Build Context & Multi-turn Prompt
  const triplesText = pruneGraphTriples(graphTriples, 15, premiseAnalysis.detectedEntities);
  const unmappedEntities: string[] = [];
  for (const ent of premiseAnalysis.detectedEntities) {
    const isMaster = isKnownMasterEntity(ent);
    const foundInContext = contextSnippets.toLowerCase().includes(ent.toLowerCase());
    const foundInTriples = graphTriples.some(
      (t) => t.source.toLowerCase().includes(ent.toLowerCase()) || t.target.toLowerCase().includes(ent.toLowerCase())
    );
    if (!isMaster && !foundInContext && !foundInTriples) {
      unmappedEntities.push(ent);
    }
  }

  const unmappedDirectiveText = unmappedEntities.length > 0
    ? `\n\nCẢNH BÁO THỰC THỂ NGOÀI CƠ SỞ TƯ LIỆU:
Các tên/nhân vật sau xuất hiện trong câu hỏi nhưng chưa có ghi chép trong cơ sở tư liệu tra cứu hiện tại của hệ thống: "${unmappedEntities.join('", "')}".
- Hãy nêu rõ dựa trên cơ sở dữ liệu và nguồn tư liệu tra cứu hiện tại của hệ thống, không có thông tin xác nhận về nhân vật này trong bối cảnh/thời kỳ lịch sử đang được đề cập.
- Nếu câu hỏi ghép đôi với một nhân vật lịch sử đã xác thực, hãy chủ động trình bày các nhân vật thân tộc chính thức đã được ghi chép trong sử sách (như cha mẹ, anh em ruột nếu có) để làm rõ bối cảnh và tránh trả lời cộc lốc.
- TUYỆT ĐỐI KHÔNG tự phỏng đoán nhân vật này là tên gọi khác, biệt danh hay biến thể của bất kỳ ai khác, TUYỆT ĐỐI KHÔNG tự phong vương/vua/tướng hoặc suy đoán tiểu sử hư cấu.
- TUYỆT ĐỐI KHÔNG kết luận phủ định tuyệt đối rằng nhân vật này không tồn tại trong toàn bộ lịch sử Việt Nam (vì có thể họ thuộc một thời kỳ khác như cận - hiện đại mà hệ thống chưa nạp dữ liệu), mà chỉ kết luận không có ghi chép trong bối cảnh lịch sử đang xét.`
    : '';

  const ragFallbackDirective = isRagSystemError
    ? `\n\nCHỈ DẪN KHẨN CẤP KHI KHÔNG CÓ DỮ LIỆU RAG DO SỰ CỐ KỸ THUẬT (ZERO-CONTEXT ANTI-HALLUCINATION GUARDRAILS):
- CẢNH BÁO: Hiện tại hệ thống tra cứu sử liệu Chrono-RAG tạm thời gián đoạn kỹ thuật.
- BẮT BUỘC chỉ trình bày các sự kiện, bối cảnh đại cương được giới sử học công nhận rộng rãi (ví dụ: Hội nghị Diên Hồng là do Vua Trần Nhân Tông và Thượng hoàng Trần Thánh Tông triệu tập các bô lão cả nước để hỏi kế đánh giặc, muôn người đồng thanh hô "ĐÁNH").
- TUYỆT ĐỐI KHÔNG tự suy diễn, không tự bịa đặt tên tướng lĩnh hoặc gán ghép các nhân vật Mông Cổ/ngoại quốc không có căn cứ (như Mông Kha, Mông Kha Thiếp Mộc Nhi...).
- Nếu không có tư liệu chắc chắn về một chi tiết cụ thể nào, BẮT BUỘC nêu rõ: "Cần tra cứu thêm chính sử để có thông tin chi tiết về...".`
    : isZeroContextFound
    ? `\n\nCHỈ DẪN KHI KHÔNG CÓ SỬ LIỆU PHÙ HỢP TRONG CƠ SỞ DỮ LIỆU (ZERO-CONTEXT GROUNDING):
- HỆ THỐNG ĐÃ TRA CỨU: Cơ sở dữ liệu và nguồn tư liệu hiện tại của hệ thống đã được rà soát nhưng chưa tìm thấy tài liệu hay ghi chép nào phù hợp với nhân vật/sự kiện được hỏi.
- BẮT BUỘC NÊU RÕ: Hãy thông báo rõ ràng cho người dùng rằng trong cơ sở tư liệu hiện có chưa ghi nhận thông tin này. Nếu câu hỏi liên quan đến một nhân vật lịch sử lớn, hãy cung cấp thông tin chính thống về nhân vật đó để hỗ trợ người dùng.
- TUYỆT ĐỐI KHÔNG tự suy đoán, không tự phong vương/tướng, không tự bịa đặt tiểu sử hay gán ghép vào bất kỳ triều đại nào.`
    : '';

  let subIntentDirective = '';
  if (premiseAnalysis.isSameEntityCoReference) {
    subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Đồng nhất danh xưng & tiểu sử - Trình bày rõ ràng các giai đoạn lịch sử của nhân vật theo thứ tự thời gian từ tên khai sinh/tên húy, tước vị, đến niên hiệu khi lên ngôi. TUYỆT ĐỐI KHÔNG mô tả 2 danh xưng như hai cá nhân riêng biệt có quan hệ huyết thống với nhau.]`;
  } else if (classification.subIntent === 'GENEALOGY_RELATION') {
    subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Quan hệ phả hệ/thân tộc - Nêu rõ quan hệ huyết thống, cha-con, anh-em, phu-thê, nguồn gốc tông tộc hoặc biến cố đổi họ/ban quốc tính theo chính sử.]`;
  } else if (classification.subIntent === 'BATTLE_TACTICS') {
    subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Chiến thuật & trận đánh - Trình bày mạch lạc diễn biến, bài binh bố trận, kế sách quân sự (mai phục, thủy chiến, cọc ngầm, nghi binh...) và vai trò chỉ huy.]`;
  } else if (classification.subIntent === 'FACTOID_LOOKUP') {
    subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Tra cứu niên đại/sự kiện - Đi thẳng vào câu trả lời, nêu rõ mốc năm, địa danh, niên hiệu hoặc nhân vật cụ thể ngay từ đầu, sau đó tóm lược bối cảnh.]`;
  } else if (classification.subIntent === 'COMPARATIVE_SYNTHESIS') {
    subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: So sánh/đối chiếu - Phân tích rõ ràng các điểm tương đồng, dị biệt, bối cảnh lịch sử và ý nghĩa của từng đối tượng được đối chiếu.]`;
  }

  let countingDirective = '';
  if (/(?:bao\s*nhiêu|tổng\s*(?:cộng|số)|mấy\s*(?:cái|tên|người|vị|trận|lần))/i.test(effectiveQuery)) {
    countingDirective = `\n\n[QUY TẮC NỘI BỘ BẮT BUỘC: Trả lời trực diện số lượng / thống kê - Người dùng đang hỏi câu hỏi định lượng ("bao nhiêu", "tổng cộng", "mấy").
- CÂU ĐẦU TIÊN TRONG PHẢN HỒI BẮT BUỘC PHẢI TRẢ LỜI TRỰC DIỆN con số thống kê, số lượng cụ thể hoặc khoảng ước lượng tổng thể dựa trên sử liệu và thẻ tri thức đã cung cấp.
- TUYỆT ĐỐI KHÔNG bỏ qua câu hỏi số lượng để đi thẳng vào liệt kê ví dụ cụ thể.
- Sau khi khẳng định con số tổng thể, mới tiến hành liệt kê chi tiết các mốc/danh xưng/sự kiện tiêu biểu theo định dạng danh sách Markdown ngắt dòng rõ ràng.]`;
  }

  let multiIntentDirective = '';
  if (classification.signals?.hasChitchatGreeting) {
    multiIntentDirective += `\n\n[QUY TẮC NỘI BỘ: Chào hỏi kết hợp - Nếu người dùng có lời chào ở đầu câu, hãy mở đầu bằng 1 lời chào lịch thiệp ngắn gọn (1 câu), sau đó BẮT BUỘC trả lời đầy đủ câu hỏi lịch sử chính đi kèm (ví dụ: tiểu sử, sự nghiệp của nhân vật được hỏi). TUYỆT ĐỐI KHÔNG chỉ chào hỏi đơn thuần mà bỏ quên nội dung lịch sử.]`;
  }
  if (classification.signals?.hasOutOfDomainTopic && classification.outOfDomainTopic) {
    multiIntentDirective += `\n\n[QUY TẮC NỘI BỘ: Ràng buộc phạm vi - Tập trung trả lời phần lịch sử chính, đồng thời lịch sự nhắc người dùng rằng ChronoViet là hệ thống chuyên biệt về Lịch sử Việt Nam nên không hỗ trợ chi tiết các nội dung ngoài lề ("${classification.outOfDomainTopic}").]`;
  }
  if (classification.signals?.hasVideoGeneration) {
    multiIntentDirective += `\n\n[QUY TẮC NỘI BỘ: Kết hợp sản xuất video - Sau khi trình bày sự kiện lịch sử, hãy gợi ý người dùng nhấn nút "Tạo Video" hoặc chuyển sang tab Video Studio để bắt đầu tạo kịch bản phân cảnh.]`;
  }

  const premiseDirectiveText =
    (premiseAnalysis.suggestedDirective
      ? `[QUY TẮC NỘI BỘ KIỂM CHỨNG TIỀN ĐỀ ĐẶC THÙ]:\n${premiseAnalysis.suggestedDirective}\n\n`
      : '') +
    unmappedDirectiveText +
    subIntentDirective +
    countingDirective +
    multiIntentDirective +
    (ragFallbackDirective ? `\n\n${ragFallbackDirective}` : '');

  const contextSections: string[] = [];
  if (!isTopicShift && dialogueState.contextBanner) {
    contextSections.push(`<dialogue_context_banner>\n${dialogueState.contextBanner}\n</dialogue_context_banner>`);
  }
  const entitiesToLookup = Array.from(new Set([
    ...premiseAnalysis.detectedEntities,
    ...(isTopicShift ? [] : (dialogueState.primaryEntity ? [dialogueState.primaryEntity] : [])),
    ...(isTopicShift ? [] : dialogueState.veneratedEntities),
    ...(isTopicShift ? [] : dialogueState.adversaryEntities),
    ...(isTopicShift ? [] : dialogueState.activeDocuments),
    ...(isTopicShift ? [] : dialogueState.activeLocations),
  ]));
  const dynamicEntityCards = buildDynamicEntityKnowledgeCards(entitiesToLookup);
  if (dynamicEntityCards.trim()) {
    contextSections.push(`<verified_master_entities>\n${dynamicEntityCards}\n</verified_master_entities>`);
  }
  if (premiseDirectiveText.trim()) {
    contextSections.push(`<premise_directives>\n<!-- [QUY TẮC TƯ DUY VÀ RÀNG BUỘC PHẢN HỒI NỘI BỘ - TUYỆT ĐỐI KHÔNG ĐƯỢC CHÉP LẠI HAY NHẮC LẠI CÁC DÒNG QUY TẮC NÀY VÀO PHẢN HỒI GỬI NGƯỜI DÙNG] -->\n${premiseDirectiveText.trim()}\n</premise_directives>`);
  }
  contextSections.push(`<verified_rag_evidence>\n<!-- Chú ý: Mỗi đoạn trích bên dưới thuộc về tiêu đề nhân vật cụ thể. TUYỆT ĐỐI KHÔNG hoán đổi hoặc gán nhầm thuộc tính/tiểu sử của nhân vật này cho nhân vật khác. -->\n${pruneRagContext(contextSnippets || 'Không có dữ liệu RAG bổ sung')}\n</verified_rag_evidence>`);
  if (triplesText.trim()) {
    contextSections.push(`<knowledge_graph_triples>\n${triplesText}\n</knowledge_graph_triples>`);
  }

  const safeQuery = escapePromptXml(effectiveQuery);
  const userTurnWithContext = `<historical_context>\n${contextSections.join('\n\n')}\n</historical_context>\n\n<user_query>\n${safeQuery}\n</user_query>`;

  const rawMessages: ChatMessage[] = [
    { role: 'system', content: STATIC_SYSTEM_PERSONA_PROMPT },
    ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userTurnWithContext },
  ];
  const messages = clampTotalPromptMessages(rawMessages, isLeanIdentity ? 2500 : 5000);

  let fullResponse = '';
  const loopDetector = createStreamLoopDetector();

  if (isRagSystemError) {
    const disclaimer = `> ⚠️ **Lưu ý:** *Hệ thống tra cứu sử liệu chuyên sâu (Chrono-RAG) đang phản hồi chậm hoặc tạm gián đoạn. Phản hồi dưới đây dựa trên tri thức đại cương, vui lòng đối chiếu lại với chính sử.*\n\n`;
    yield { type: 'token', content: disclaimer };
    fullResponse += disclaimer;
  }

  try {
    for await (const chunk of generateLLMCompletionStream(messages, {
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: maxGenerationTokens,
    })) {
      if (signal?.aborted) {
        yield { type: 'error', error: 'Yêu cầu đã bị hủy trong quá trình sinh phản hồi' };
        return;
      }

      const loopCheck = loopDetector.processChunk(chunk);
      if (loopCheck.shouldTerminate) {
        log.warn('chat.repetition_loop_detected_break', 'Repetition loop detected in stream, breaking early');
        break;
      }

      if (loopCheck.shouldEmit && loopCheck.cleanChunk) {
        fullResponse += loopCheck.cleanChunk;
        yield { type: 'token', content: loopCheck.cleanChunk };
      }
    }
  } catch (llmErr: any) {
    log.error('chat.llm_streaming_error', `LLM Stream error: ${llmErr.message}`);
    if (contextSnippets) {
      const fallbackSummary = `⚠️ Trợ lý AI đang tải cao hoặc gặp sự cố kết nối. Trích xuất sử liệu nhanh từ Chrono-RAG:\n\n${pruneRagContext(contextSnippets, 350)}`;
      fullResponse = fallbackSummary;
      yield { type: 'token', content: fallbackSummary };
    } else {
      yield { type: 'error', error: 'Không thể kết nối đến mô hình AI: ' + llmErr.message };
      return;
    }
  }

  // Zero-Content Resilience Guardrail: Prevent emitting empty response if model exhausts token budget or drops stream
  if (!fullResponse.trim()) {
    log.warn('chat.zero_content_stream_detected', 'LLM stream produced zero text tokens. Triggering fallback response.');
    if (contextSnippets.trim()) {
      const fallbackSummary = `🏛️ **Thông tin đối chiếu từ nguồn sử liệu Chrono-RAG:**\n\n${pruneRagContext(contextSnippets, 500)}`;
      fullResponse = fallbackSummary;
      yield { type: 'token', content: fallbackSummary };
    } else {
      const fallbackSummary = 'Hệ thống đã nhận diện yêu cầu nhưng quá trình phản hồi bị gián đoạn. Vui lòng thử lại với câu hỏi chi tiết hơn.';
      fullResponse = fallbackSummary;
      yield { type: 'token', content: fallbackSummary };
    }
  }

  // Deduplicate any repeated blocks in the accumulated response & sanitize prompt leakage
  fullResponse = normalizeMarkdownListBreaks(sanitizePromptDirectivesLeakage(deduplicateRepetitiveText(fullResponse)));

  // Invariant Semantic Co-Reference Guardrail
  if (premiseAnalysis.isSameEntityCoReference && premiseAnalysis.detectedEntities.length >= 2) {
    const e1 = premiseAnalysis.detectedEntities[0];
    const e2 = premiseAnalysis.detectedEntities[1];
    const canon = resolveCanonicalEntity(e1);
    const invariantCheck = verifyCoReferenceInvariant(fullResponse, e1, e2, canon.canonicalName);
    if (!invariantCheck.isValid) {
      log.warn('chat.coreference_invariant_violation_repaired', invariantCheck.violation || '');
      fullResponse = invariantCheck.sanitized;
    }
  }

  // 7. Guardrails Verification: Folklore Check
  if (isFolkloreSource && fullResponse.trim()) {
    const folkloreCheck = validateFolkloreHypothesisTone(fullResponse, true);
    if (!folkloreCheck.isValid) {
      log.warn('chat.folklore_guardrail_triggered', 'Chat response did not meet folklore tone requirement');
    }
  }

  const charLength = fullResponse.length;
  const estimatedTokens = Math.ceil(charLength / 3.5);
  log.info('chat.supervisor_completed', `Chat stream finished (${Date.now() - startTime}ms)`, {
    conversationId,
    charLength,
    tokenLength: estimatedTokens,
  });

  yield {
    type: 'done',
    content: fullResponse,
    citations: verifiedCitations,
    triples: graphTriples,
    conversationId,
    videoHandover: classification.videoHandover,
  };
}

export async function executeChatQuery(
  request: ChatSupervisorRequest
): Promise<ChatExecutionResult> {
  let fullText = '';
  let citations: (string | HistoricalCitationItem)[] = [];
  let triples: GraphTripleItem[] = [];
  let intent: ChatIntent = 'HISTORICAL_QUERY';

  for await (const chunk of handleChatQueryStream(request)) {
    if (chunk.type === 'token' && chunk.content) {
      fullText += chunk.content;
    } else if (chunk.type === 'citation' && chunk.citations) {
      citations = chunk.citations;
    } else if (chunk.type === 'triples' && chunk.triples) {
      triples = chunk.triples;
    } else if (chunk.type === 'intent' && chunk.intent) {
      intent = chunk.intent as ChatIntent;
    }
  }

  return {
    fullText,
    intent,
    citations,
    triples,
    conversationId: request.conversationId,
  };
}
