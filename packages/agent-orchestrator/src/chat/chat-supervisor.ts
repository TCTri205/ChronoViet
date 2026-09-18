/**
 * ChronoViet Chat Supervisor & Stream Coordinator
 * Coordinates Multi-tier Intent Routing, Multi-turn Query Rewriting, Graph Triples Injection,
 * Folklore & Citation Guardrails, and SSE Realtime Streaming.
 */

import {
  IRagEngine,
  ChatStreamResponse,
  GroundedClaimItem,
  GraphTripleItem,
  HistoricalCitationItem,
  isKnownMasterEntity,
  HISTORICAL_PERSON_DICTIONARY,
  resolveCanonicalEntity,
  CORE_DOCS,
  VisualAnchorSuggestion,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  generateLLMCompletion,
  generateLLMCompletionStream,
  ChatMessage,
  envConfig,
  ragTimeoutsTotal,
} from '@chronoviet/infra';
import { ChronoRagEngine, groundClaims, ChunkInfo } from '@chronoviet/rag-engine';
import {
  classifyChatIntent,
  ChatIntent,
  IntentClassificationResult,
  hasHistoricalDomainSignals,
  SUBSTANTIVE_QUESTION_REGEX,
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
  return text.replace(/<\/?(?:historical_context|user_query|premise_directives|verified_rag_evidence|knowledge_graph_triples|verified_master_entities|verified_chronology_anchors|critical_response_constraint|dialogue_context_banner)[^>]*>/gi, '');
}

/**
 * Structured Chronology & Anti-Conflation Anchor Builder (Task 3)
 * Maps matched persons, campaigns, and events to canonical dynasty, reign years, and sovereignty transitions.
 * Disambiguates known historical conflation pairs and provides verified chronological ground truths.
 */
export function buildChronologyAnchorBox(
  entityNamesOrIds: string[],
  activeYears: number[] = [],
  queryText: string = ''
): string {
  const anchors: string[] = [];
  const queryLower = (queryText || '').toLowerCase();
  const seenRules = new Set<string>();

  // 1. Resolve canonical entity IDs
  const resolvedIds = new Set<string>();
  for (const item of entityNamesOrIds) {
    if (!item) continue;
    const resolved = resolveCanonicalEntity(item.trim());
    if (resolved.entityId) {
      resolvedIds.add(resolved.entityId);
    }
  }

  const hasEntity = (id: string) => resolvedIds.has(id);
  const hasPhrase = (regex: RegExp) => regex.test(queryLower);
  const hasYear = (y: number) => activeYears.includes(y) || new RegExp(`\\b${y}\\b`).test(queryLower);

  // Rule A: Lê Hoàn & Triều Tiền Lê (980 - 1005) vs. Nhà Lý
  if (
    hasEntity('person_le_hoan') ||
    hasPhrase(/\b(lê\s+hoàn|lê\s+đại\s+hành)\b/i) ||
    (hasYear(981) && (hasPhrase(/bạch\s+đằng/i) || hasPhrase(/chống\s+tống/i) || hasPhrase(/nhà\s+lý/i))) ||
    hasPhrase(/(?:lê\s+hoàn|lê\s+đại\s+hành).*(?:nhà|triều)\s+lý/i)
  ) {
    if (!seenRules.has('LE_HOAN_TIEN_LE')) {
      seenRules.add('LE_HOAN_TIEN_LE');
      anchors.push(
        `• Lê Hoàn (Lê Đại Hành): Thuộc triều Tiền Lê (trị vì 980 - 1005). Lãnh đạo cuộc kháng chiến chống Tống lần thứ nhất thắng lợi rực rỡ năm 981 (chiến thắng Bạch Đằng năm 981). TUYỆT ĐỐI KHÔNG gán Lê Hoàn hoặc chiến thắng năm 981 vào nhà Lý (nhà Lý do Lý Thái Tổ sáng lập năm 1009, sau thời Tiền Lê).`
      );
    }
  }

  // Rule B: Hồ Quý Ly & Trần Thiếu Đế vs. Trần Thiêm Bình
  if (
    hasEntity('person_ho_quy_ly') ||
    hasEntity('person_tran_thieu_de') ||
    hasEntity('person_tran_thiem_binh') ||
    hasPhrase(/\b(hồ\s+quý\s+ly|trần\s+thiếu\s+đế|trần\s+thiêm\s+bình|nhà\s+hồ|đại\s+ngu)\b/i) ||
    (hasPhrase(/cướp\s+ngôi/i) && hasPhrase(/nhà\s+trần/i))
  ) {
    if (!seenRules.has('HO_QUY_LY_TRAN_THIEU_DE')) {
      seenRules.add('HO_QUY_LY_TRAN_THIEU_DE');
      anchors.push(
        `• Hồ Quý Ly & Sự chuyển giao vương triều Trần - Hồ (1400): Tháng 2 năm Canh Thìn (1400), Hồ Quý Ly phế truất vua Trần Thiếu Đế (vị vua cuối cùng của triều Trần, cháu ngoại Hồ Quý Ly) để lên ngôi, lập ra nhà Hồ (đổi quốc hiệu thành Đại Ngu). Trần Thiêm Bình (tên thật là Nguyễn Khang) là gia nô mạo xưng tôn thất nhà Trần chạy sang nhà Minh cầu viện, KHÔNG PHẢI là vua và KHÔNG PHẢI là người bị Hồ Quý Ly cướp ngôi.`
      );
    }
  }

  // Rule C: Ba trận thủy chiến sông Bạch Đằng (938, 981, 1288)
  const isBachDangQuery =
    hasPhrase(/bạch\s+đằng/i) ||
    [938, 981, 1288].filter((y) => hasYear(y)).length >= 2;
  if (isBachDangQuery) {
    if (!seenRules.has('BACH_DANG_THREE_BATTLES')) {
      seenRules.add('BACH_DANG_THREE_BATTLES');
      anchors.push(
        `• Ba trận thủy chiến sông Bạch Đằng tiêu biểu trong lịch sử:\n` +
        `  - Năm 938: Tiền Ngô Vương Ngô Quyền chỉ huy đánh tan quân Nam Hán (Lưu Hoằng Tháo tử trận), mở ra kỷ nguyên độc lập tự chủ.\n` +
        `  - Năm 981: Vua Lê Hoàn (triều Tiền Lê) chỉ huy đánh bại quân xâm lược nhà Tống, chém tướng Hầu Nhân Bảo.\n` +
        `  - Năm 1288: Hưng Đạo Đại Vương Trần Quốc Tuấn (nhà Trần) chỉ huy tiêu diệt hoàn toàn thủy quân Nguyên Mông do Ô Mã Nhi cầm đầu.\n` +
        `  -> Đây là ba trận đánh ở ba thời kỳ, ba triều đại hoàn toàn khác nhau do ba vị anh hùng độc lập lãnh đạo.`
      );
    }
  }

  // Rule D: Chiến tuyến Trịnh - Nguyễn phân tranh (Lũy Thầy & Sông Gianh)
  if (
    hasEntity('loc_luy_thay') ||
    hasEntity('loc_song_gianh') ||
    hasEntity('person_dao_duy_tu') ||
    hasPhrase(/\b(lũy\s+thầy|lũy\s+đào\s+duy\s+từ|lũy\s+nhật\s+lệ|lũy\s+trường\s+dục|sông\s+gianh|linh\s+giang|đào\s+duy\s+từ)\b/i) ||
    (hasPhrase(/trịnh\s*-\s*nguyễn/i) && hasPhrase(/phân\s+tranh/i))
  ) {
    if (!seenRules.has('LUY_THAY_SONG_GIANH')) {
      seenRules.add('LUY_THAY_SONG_GIANH');
      anchors.push(
        `• Chiến tuyến Trịnh - Nguyễn phân tranh (thế kỷ 17 - 18):\n` +
        `  - Lũy Thầy (Lũy Đào Duy Từ, bao gồm Lũy Nhật Lệ, Lũy Trường Dục, Lũy Đầu Mâu...) tại Quảng Bình là công trình phòng thủ quân sự do Đào Duy Từ chỉ huy đắp để giúp chúa Nguyễn (Đàng Trong) ngăn chặn các cuộc tiến công của quân Trịnh.\n` +
        `  - Sông Gianh (Linh Giang, Quảng Bình) là giới tuyến tự nhiên lịch sử phân định ranh giới giữa Đàng Ngoài và Đàng Trong.`
      );
    }
  }

  // Rule E: Chiến dịch 12 ngày đêm "Điện Biên Phủ trên không" (1972)
  if (
    hasPhrase(/\b(12\s+ngày\s+đêm|điện\s+biên\s+phủ\s+trên\s+không|linebacker|sam-2|xưởng\s+a31|nhà\s+máy\s+a31|b-52)\b/i) ||
    (hasYear(1972) && hasPhrase(/ném\s+bom|phòng\s+không|không\s+quân/i))
  ) {
    if (!seenRules.has('LINEBACKER_II_1972')) {
      seenRules.add('LINEBACKER_II_1972');
      anchors.push(
        `• Chiến dịch 12 ngày đêm "Điện Biên Phủ trên không" (18/12/1972 - 30/12/1972):\n` +
        `  - Thời gian: Diễn ra chính xác trong 12 ngày đêm từ đêm 18/12/1972 đến ngày 30/12/1972 (Mỹ tuyên bố ngừng ném bom phía bắc vĩ tuyến 20), dẫn đến việc ký Hiệp định Paris (27/01/1973).\n` +
        `  - Khí tài & Vũ khí: Tên lửa SAM-2 là vũ khí tiêu hao một lần, khi đã bắn ra thì không thể thu hồi để tái sử dụng; Xưởng/Nhà máy A31 là nơi bảo dưỡng đài radar, sửa chữa bệ phóng và hiệu chỉnh quả đạn trước khi phóng, không có việc thu hồi tên lửa đã bắn.`
      );
    }
  }

  // 2. Generic sovereign & dynasty chronology for matched persons
  const entityBullets: string[] = [];
  const seenEntities = new Set<string>();

  for (const item of entityNamesOrIds) {
    if (!item || item.trim().length <= 2) continue;
    const resolved = resolveCanonicalEntity(item.trim());
    const entId = resolved.entityId;
    if (!entId || entId.startsWith('ent_') || seenEntities.has(entId)) continue;
    seenEntities.add(entId);

    const person = HISTORICAL_PERSON_DICTIONARY[entId];
    const target = person || resolved;
    if (!target) continue;

    const parts: string[] = [];
    if (target.dynasty) {
      parts.push(`Triều đại: ${target.dynasty}`);
    }
    const meta = target.namingMetadata;
    if (meta?.reignEra) {
      let rPeriod = '';
      if (typeof meta.reignPeriod === 'string') {
        rPeriod = meta.reignPeriod;
      } else if (meta.reignPeriod && typeof meta.reignPeriod === 'object' && meta.reignPeriod.start != null) {
        const s = meta.reignPeriod.start < 0 ? `${Math.abs(meta.reignPeriod.start)} TCN` : `${meta.reignPeriod.start}`;
        const e = meta.reignPeriod.end != null ? (meta.reignPeriod.end < 0 ? `${Math.abs(meta.reignPeriod.end)} TCN` : `${meta.reignPeriod.end}`) : '';
        rPeriod = e ? `${s} - ${e}` : s;
      }
      parts.push(`Niên hiệu: ${meta.reignEra}${rPeriod ? ` (${rPeriod})` : ''}`);
    } else if (meta?.reignPeriod) {
      const s = typeof meta.reignPeriod === 'object' && meta.reignPeriod.start != null ? `${meta.reignPeriod.start}` : '';
      const e = typeof meta.reignPeriod === 'object' && meta.reignPeriod.end != null ? `${meta.reignPeriod.end}` : '';
      if (s || e) parts.push(`Thời gian trị vì: ${s}${e ? ` - ${e}` : ''}`);
    }
    if (target.timeRange && target.timeRange.start != null) {
      const start = target.timeRange.start;
      const end = target.timeRange.end;
      const startStr = start < 0 ? `${Math.abs(start)} TCN` : `${start}`;
      const endStr = end != null ? (end < 0 ? `${Math.abs(end)} TCN` : `${end}`) : '';
      parts.push(`Niên đại: ${startStr}${endStr ? ` - ${endStr}` : ''}`);
    }

    if (parts.length > 0) {
      entityBullets.push(`- ${target.canonicalName}: ${parts.join(' | ')}`);
    }
  }

  if (anchors.length === 0 && entityBullets.length === 0) {
    return '';
  }

  const sections: string[] = [];
  if (anchors.length > 0) {
    sections.push(anchors.join('\n\n'));
  }
  if (entityBullets.length > 0) {
    sections.push(`QUY THUỘC TRIỀU ĐẠI & NIÊN HIỆU CHÍNH SỬ:\n${entityBullets.join('\n')}`);
  }

  return sections.join('\n\n');
}

export function buildDynamicEntityKnowledgeCards(
  entityNamesOrIds: string[],
  isBroadAnalytical: boolean = false
): string {
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
          if (!isBroadAnalytical && meta.periodAliases && meta.periodAliases.length > 0) {
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
          if (!isBroadAnalytical && meta.preReignTitles && meta.preReignTitles.length > 0) {
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
          if (!isBroadAnalytical && meta.posthumousName) {
            lines.push(`  + Thụy hiệu: ${meta.posthumousName}`);
          }
          if (!isBroadAnalytical && meta.familyLineage) {
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
          if (!isBroadAnalytical && meta.famousQuote) {
            lines.push(`  + Câu nói / Tuyên ngôn sử sách ghi nhận: "${meta.famousQuote}"`);
          }
          if (meta.achievements && meta.achievements.length > 0) {
            const achList = isBroadAnalytical ? meta.achievements.slice(0, 2) : meta.achievements;
            lines.push(`  + Sự nghiệp / Công tích chính sử: ${achList.join('; ')}`);
          }
        }
      } else if (target.aliases && target.aliases.length > 0) {
        const aliasCount = isBroadAnalytical ? 3 : 6;
        lines.push(`  + Danh xưng / Tên gọi khác: ${target.aliases.slice(0, aliasCount).join(', ')}`);
      }
      if (target.type === 'DOCUMENT_CULTURE' || target.docMetadata) {
        const docMeta = target.docMetadata || CORE_DOCS.find((d) => d.id === target.entityId || d.name.toLowerCase() === target.canonicalName.toLowerCase());
        if (docMeta) {
          if (docMeta.author) {
            lines.push(`  + Tác giả / Người soạn thảo: ${docMeta.author}`);
          }
          if (docMeta.dynasty) {
            lines.push(`  + Triều đại / Bối cảnh lịch sử: ${docMeta.dynasty}`);
          }
          if (docMeta.year) {
            lines.push(`  + Năm ban bố / sáng tác: năm ${docMeta.year}`);
          }
          if (docMeta.adversary) {
            lines.push(`  + Đối tượng / Kẻ thù lịch sử: ${docMeta.adversary} (TUYỆT ĐỐI KHÔNG nhầm lẫn sang các triều đại hoặc ngoại bang khác)`);
          }
          if (!isBroadAnalytical && docMeta.context) {
            lines.push(`  + Bối cảnh lịch sử cốt lõi: ${docMeta.context}`);
          }
        }
      }
      if (target.dynasty && target.type !== 'DOCUMENT_CULTURE') {
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
  claims?: GroundedClaimItem[];
  visualAnchors?: VisualAnchorSuggestion[];
  faithfulnessScore?: number;
  citationCorrectnessScore?: number;
  isLowConfidence?: boolean;
  conversationId?: string;
}

/**
 * 100% Static System Persona Prompt for KV-Cache Preservation across all conversation turns.
 */
export const STATIC_SYSTEM_PERSONA_PROMPT = `Bạn là ChronoViet AI — Chuyên gia Nghiên cứu Lịch sử Việt Nam chuẩn mực, thông thái và khách quan.

NGUYÊN TẮC BẮT BUỘC:
1. NGUYÊN TẮC TOÀN DIỆN LỊCH SỬ & RÀNG BUỘC SỬ LIỆU TUYỆT ĐỐI (STRICT IN-CONTEXT GROUNDING):
   - Mọi mốc thời gian (niên đại chính xác), địa danh, kinh đô, nhân vật, tác phẩm và diễn biến cốt lõi BẮT BUỘC phải trích xuất và đối chiếu trực tiếp từ phần <verified_chronology_anchors>, <verified_master_entities>, <verified_rag_evidence> và <knowledge_graph_triples>.
   - Đối với các triều đại ngoại bang phương Bắc xâm lược: Nêu chính xác triều đại cụ thể (Ví dụ: nhà Đông Hán, nhà Đường, nhà Tống, nhà Nguyên/Mông Cổ, nhà Minh, nhà Thanh), không gọi chung chung là "nhà Hán" nếu ngữ cảnh xác định rõ là Đông Hán.
   - Quy tắc niên đại: Các năm từ năm 1 trở đi thuộc kỷ nguyên Công Nguyên / Dương lịch (viết tự nhiên: "năm 1385", "năm 1941", "1965", TUYỆT ĐỐI KHÔNG thêm hậu tố "SCN" một cách máy móc vào các năm thông thường; chỉ dùng tiền tố/hậu tố "TCN" cho thời kỳ Trước Công Nguyên, và chỉ ghi "SCN" khi cần đối chiếu phân biệt đặc thù cho các năm nhỏ dưới 100).
   - NGUYÊN TẮC GÁN ĐÚNG THUỘC TÍNH NHÂN VẬT (ENTITY ATTRIBUTION INVARIANT): Khi câu hỏi hoặc ngữ cảnh liên quan đến nhiều nhân vật, BẮT BUỘC phải gán đúng niên đại, thân thế, chức vị và sự kiện cho từng nhân vật căn cứ theo thẻ <verified_master_entities> và tài liệu lịch sử. TUYỆT ĐỐI KHÔNG hoán đổi hoặc nhầm lẫn sự kiện, danh xưng hay phả hệ giữa các nhân vật cùng triều đại hay giữa các thế hệ vua kế tiếp nhau.
   - NGUYÊN TẮC RÀNG BUỘC SỬ LIỆU & CHỐNG TỰ BỊA TIỂU SỬ (NEGATIVE GROUNDING & NO CAREER FABRICATION): TUYỆT ĐỐI KHÔNG tự suy đoán hoặc bịa đặt thêm chức vụ, sự nghiệp sau này cho nhân vật nếu sử liệu không ghi nhận.
   - TUYỆT ĐỐI KHÔNG tự suy đoán, bịa đặt tên tuổi tướng lĩnh hoặc nhân vật không có trong sử liệu được cung cấp. Nếu ngữ cảnh thiếu thông tin chi tiết, BẮT BUỘC phải thông báo khách quan: "Sử liệu hiện có trong hệ thống chưa ghi nhận chi tiết này".
   - Luôn trích dẫn danh xưng chính thức, tên tác phẩm cụ thể, áng văn hoặc văn kiện lịch sử xuất hiện trong ngữ cảnh thay vì dùng từ ngữ khái quát ("ông ấy", "văn bản này").
   - Khi giải thích các áng văn kiện, chiếu cáo, lời thề xuất quân, hoặc bối cảnh địa thế/nguyên nhân sự kiện: BẮT BUỘC trích dẫn trực tiếp các câu chữ, luận điểm kinh điển trong nguyên tác xuất hiện ở sử liệu được cung cấp thay vì chỉ tóm tắt thuần túy.
   - Khi trình bày về một vụ án, biến cố hoặc bi kịch lịch sử: Luôn nêu đầy đủ cả nguyên nhân trực tiếp (nạn nhân, người bị liên đới, vị vua trị vì bấy giờ) và hậu quả / việc minh oan sau này dựa trên sử liệu.
   - Khi trình bày về trận đánh, chiến dịch hoặc cuộc kháng chiến: Trình bày mạch lạc bối cảnh, tướng lĩnh chủ chốt hai bên được ghi chép trong sử liệu, diễn biến chính, kế sách quân sự và ý nghĩa bước ngoặt lịch sử.

2. QUY TẮC ĐỒNG NHẤT DANH XƯNG & THÂN TỘC PHONG KIẾN (NOMENCLATURE & ROYALTY INVARIANT):
   - Trong lịch sử phong kiến Việt Nam, một nhân vật thường có nhiều tên gọi (tên húy/tên khai sinh, miếu hiệu, niên hiệu, tôn hiệu, tước vị). 
   - Khi câu hỏi đề cập các danh xưng của CÙNG MỘT NGƯỜI, BẮT BUỘC phải khẳng định ngay ở câu mở đầu rằng đây là cùng một nhân vật lịch sử (Ví dụ: Vua [Miếu hiệu] tên húy là [Tên húy], hoặc [Tên A] và [Tên B] là cùng một người). Tuyệt đối không tách thành hai người riêng biệt hoặc mô tả như hai nhân vật có quan hệ huyết thống hay phân chia nhiệm vụ với nhau.
   - NGUYÊN LÝ BẤT BIẾN ĐỒNG NHẤT BẢN THỂ (CO-REFERENCE IDENTITY & KINSHIP INVARIANT): Một nhân vật lịch sử BẤT BIẾN không thể là cha, con, anh, em hay họ hàng của chính bản thân mình. Khi câu hỏi gán ghép quan hệ họ hàng hay chỉ huy song song giữa hai danh xưng của cùng một người, BẮT BUỘC câu đầu tiên phải bác bỏ dứt khoát tiền đề sai lệch và khẳng định hai danh xưng là cùng một người.
   - CHỈ ĐƯỢC PHÉP ghi tên húy nếu tên đó xuất hiện trực tiếp trong sử liệu xác thực. Nếu không có tên húy trong ngữ cảnh, dùng miếu hiệu/danh xưng chính thức.
   - Khi sử liệu ghi miếu hiệu vắn tắt (như Thái Tông, Thánh Tông, Nhân Tông, Anh Tông...), BẮT BUỘC đối chiếu cẩn trọng với mốc thời gian (năm xảy ra sự kiện) và thứ tự trị vì trong văn bản để xác định đúng vị vua, TUYỆT ĐỐI KHÔNG nhầm lẫn giữa các vị vua kế tiếp nhau trong cùng triều đại.

3. QUY TẮC PHẢN BIỆN TIỀN ĐỀ SAI (UNIVERSAL ANTI-SYCOPHANCY & HISTORICAL REFUTATION):
   - Nếu câu hỏi chứa tiền đề sai lệch (sai niên đại, gán nhầm sự kiện/địa bàn, gán sai chiến công hoặc đưa công nghệ/vũ khí/khái niệm hiện đại vào thời kỳ phong kiến/cổ đại), bạn BẮT BUỘC phải bác bỏ rõ ràng NGAY Ở CÂU ĐẦU TIÊN (Ví dụ: "Không, vào thời kỳ [X] hoàn toàn chưa có [Y]...", "Không, thông tin này không chính xác..."). Đồng thời đính chính rõ sự thật lịch sử dựa trên sử liệu.
   - BÁC BỎ QUAN HỆ THÂN TỘC XUYÊN THỜI ĐẠI (CROSS-ERA KINSHIP REFUTATION): Khi câu hỏi gán ghép quan hệ thân tộc hoặc huyết thống trực tiếp (như anh em, cha con, họ hàng) giữa hai nhân vật sống ở hai thời kỳ lịch sử hoàn toàn khác nhau (khoảng cách niên đại lớn), BẮT BUỘC phải bác bỏ rõ ràng ngay ở câu đầu tiên (ví dụ: "Không, [Nhân vật A] và [Nhân vật B] không phải là anh em và không có quan hệ thân tộc trực tiếp; họ sống ở hai thời kỳ lịch sử cách nhau hàng trăm năm."), sau đó làm rõ niên đại, thân thế của từng người dựa trên sử liệu.
   - CHO PHÉP & KHUYẾN KHÍCH SO SÁNH LỊCH SỬ HỌC THUẬT (COMPARATIVE HISTORIOGRAPHY): Khi người dùng yêu cầu so sánh, đối chiếu học thuật giữa các nhân vật, triều đại, tư tưởng trị quốc, chiến lược quân sự, hoặc chính sách văn hóa - xã hội ở các thời kỳ khác nhau (ví dụ: so sánh nghệ thuật quân sự thời Lý và thời Trần; so sánh tư tưởng cải cách của Hồ Quý Ly và vua Minh Mạng): TUYỆT ĐỐI KHÔNG từ chối hay xem đây là tiền đề sai. Hãy phân tích chuyên sâu, đa chiều, làm rõ điểm tương đồng, dị biệt và bối cảnh thời đại của từng đối tượng.
   - BÁC BỎ GIẢ THUYẾT PHI THỰC TẾ VỀ VŨ KHÍ & KHÍ TÀI: Bác bỏ dứt khoát các tiền đề phi lịch sử hoặc phi vật lý (ví dụ: thu hồi tên lửa phòng không đã bắn đem về dùng lại, hoặc chiến dịch 12 ngày đêm 1972 kéo dài sang năm 1973).
   - TUYỆT ĐỐI KHÔNG xu nịnh hoặc đồng tình ("Đúng rồi", "Đúng vậy") với tiền đề sai của người dùng.
   - Khi một nhân vật hoặc tên gọi KHÔNG CÓ trong chính sử Việt Nam (hoặc hư cấu, không xác định), BẮT BUỘC phải nói rõ: "Trong chính sử không có ghi chép về nhân vật mang tên [X]" thay vì suy đoán.

4. NGUYÊN TẮC BỐI CẢNH LỊCH SỬ & CHỐNG SUY DIỄN PHI THỜI ĐẠI (HISTORIOGRAPHICAL CONTEXT & ANTI-ANACHRONISM):
   - Mọi lý giải về nhân khẩu học, sự phân bố dòng họ, thứ bậc xã hội và phong tục tập quán cổ truyền BẮT BUỘC phải dựa trên hệ quy chiếu chế độ phong kiến Nho giáo (các biến cố đổi họ lánh nạn, kiêng húy, ban quốc tính, hoặc sổ đinh hộ tịch). Tuyệt đối không áp dụng tư duy tự do cá nhân hoặc góc nhìn đạo đức hiện đại.
   - Đối với tư liệu truyền thuyết hoặc dã sử (LEVEL_3): BẮT BUỘC dùng từ ngữ giả định: 'theo truyền thuyết', 'tương truyền', 'dân gian kể rằng'.

5. NGUYÊN TẮC TRÌNH BÀY & ĐỊNH DẠNG DANH SÁCH MARKDOWN (MARKDOWN LIST FORMATTING INTEGRITY):
   - Trình bày rõ ràng, mạch lạc với định dạng Markdown chuẩn (tiêu đề, danh sách, in đậm từ khóa quan trọng).
   - QUY TẮC BẮT BUỘC KHI VIẾT DANH SÁCH (STRICT LIST FORMATTING):
     * MỌI danh sách (dù dùng gạch đầu dòng '- ' hay đánh số thứ tự '1. ', '2. ', '3. ') BẮT BUỘC mỗi mục phải bắt đầu trên một dòng riêng biệt, có ký tự xuống dòng ngắt quãng (\\n\\n- hoặc \\n\\n1. ).
     * TUYỆT ĐỐI KHÔNG viết các mục danh sách nối tiếp dính liền nhau trên cùng một dòng hay trong cùng một đoạn văn.
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
     * Sau khi nêu con số tổng quan ở câu đầu, mới trình bày bối cảnh và liệt kê chi tiết các mốc/danh xưng/sự kiện tiêu biểu nhất.

8. NGUYÊN TẮC BÁM SÁT TOÀN DIỆN THUẬT NGỮ CỦA NGƯỜI DÙNG & CHỐNG TỰ BỊA LỜI THOẠI (COMPREHENSIVE COVERAGE & ANTI-CONFABULATION):
   - BÁM SÁT MỌI THUẬT NGỮ TRONG ĐỀ BÀI: Khi người dùng nêu rõ các thuật ngữ, khái niệm, câu hỏi phụ hay sự kiện cụ thể trong câu hỏi (ví dụ: "Hào khí Đông A", "Hội nghị Diên Hồng", "Súng thần cơ", "câu nói của Hồ Nguyên Trừng", "chủ quyền Hoàng Sa - Trường Sa", "quốc hiệu Việt Nam", "12 ngày đêm", "B-52"):
     * Câu trả lời BẮT BUỘC phải trực tiếp phân tích, giải thích và làm sáng tỏ từng thuật ngữ/khái niệm đó, tuyệt đối không được bỏ sót bất kỳ yêu cầu hay thuật ngữ nào mà người dùng đã nêu.
   - NGHIÊM CẤM TỰ BỊA ĐẶT LỜI THOẠI HOẶC PHẢ HỆ HƯ CẤU:
     * Tuyệt đối không tự sáng tác lời thoại hư cấu mang phong cách tiểu thuyết hay kịch nghệ cho các nhân vật lịch sử. Nếu sử liệu hoặc ngữ cảnh cung cấp không có ghi nhận nguyên văn câu nói hoặc chi tiết phả hệ đó, hãy nêu rõ ràng: "Sử liệu chính thức không ghi chép câu nói này" hoặc chỉ trích dẫn câu nói kinh điển có trong sử liệu (ví dụ: lời Hồ Nguyên Trừng: 'Thần không sợ đánh, chỉ sợ lòng dân không theo').

9. NGUYÊN TẮC HỌC THUYẾT KHÍ TÀI QUÂN SỰ & RÀNG BUỘC CHIẾN DỊCH (MILITARY DOCTRINE & CAMPAIGN INVARIANTS):
   - ĐẶC TÍNH KHÍ TÀI & ĐẠN DƯỢC PHÒNG KHÔNG:
     * Tên lửa phòng không (như SAM-2 / SAM-3) và các loại đạn pháo hạng nặng là vũ khí tiêu hao một lần (single-use disposable ordnance). Khi đã phóng đi hoặc phát nổ trên không tiêu diệt mục tiêu, TUYỆT ĐỐI KHÔNG THỂ thu hồi để tái sử dụng hay bắn lại.
     * Hoạt động bảo dưỡng, sửa chữa, cải tiến khí tài (như tại Nhà máy / Xưởng A31) là công tác kỹ thuật sửa chữa đài radar dẫn đường (như radar Fan Song / P-12), bệ phóng và kiểm tra, lắp ráp, hiệu chỉnh tham số kỹ thuật quả đạn trước khi phóng; TUYỆT ĐỐI KHÔNG PHẢI là "thu hồi tên lửa đã bắn đem về dùng lại". Nếu người dùng hỏi hoặc ám chỉ việc thu hồi tên lửa đã bắn, BẮT BUỘC câu mở đầu phải bác bỏ dứt khoát.
   - KHỐNG CHẾ CHÍNH XÁC THỜI GIAN CHIẾN DỊCH "ĐIỆN BIÊN PHỦ TRÊN KHÔNG" (LINEBACKER II):
     * Chiến dịch 12 ngày đêm phòng không Hà Nội - Hải Phòng diễn ra chính xác từ đêm 18/12/1972 đến ngày 30/12/1972 (ngày 30/12/1972 Tổng thống Mỹ Nixon tuyên bố ngừng ném bom từ vĩ tuyến 20 trở ra Bắc).
     * Thắng lợi vẻ vang của chiến dịch buộc Mỹ phải ký kết Hiệp định Paris về chấm dứt chiến tranh, lập lại hòa bình ở Việt Nam vào tháng 1 năm 1973 (ngày 27/01/1973).`;

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
        temperature: 0.35,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
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
        temperature: 0.35,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
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

  // 4. Video Creation Intent -> Direct LLM Stream (Only for pure video creation requests)
  // If the query contains substantive historical inquiry (questions about dates, events, numbers, causes, etc.),
  // do NOT bypass RAG! Route through the full GraphRAG pipeline so that historical facts, chronology anchors,
  // and campaign boundaries are rigorously grounded, followed by the video handover recommendation.
  const hasSubstantiveHistoricalContent =
    classification.compositeResult?.hasHistoricalInquiry ||
    SUBSTANTIVE_QUESTION_REGEX.test(effectiveQuery) ||
    hasHistoricalDomainSignals(effectiveQuery) ||
    Boolean(classification.matchedEntityId);

  if (classification.intent === 'VIDEO_INTENT' && !hasSubstantiveHistoricalContent) {
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
        temperature: 0.35,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
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
  // Also, for open, comprehensive historiographical, thematic, or multi-faceted evaluation queries
  // (e.g. asking about overall achievements, territory, sovereignty, reforms, comparisons, impacts),
  // restricting entityFilter strictly to a single person entity starves RAG from retrieving thematic chunks
  // (such as national naming, treaties, island sovereignty, or administrative reforms).
  // In those cases, setting entityFilter = undefined allows open hybrid BM25 + Vector retrieval across the full corpus.
  const hasUnresolvedEntityInMultiEntityQuery =
    premiseAnalysis.detectedEntities.length >= 2 &&
    resolvedFilterIds.length < premiseAnalysis.detectedEntities.length;

  const isBroadAnalyticalQuery =
    /(?:đánh\s+giá|toàn\s+diện|khách\s+quan|công\s+lao|hạn\s+chế|tổng\s+quan|ý\s+nghĩa|tác\s+động|chủ\s+quyền|cương\s+thổ|biển\s+đảo|quốc\s+hiệu|nguyên\s+nhân\s+sâu\s+xa|bối\s+cảnh)/i.test(
      effectiveQuery
    );

  const effectiveEntityFilter =
    hasUnresolvedEntityInMultiEntityQuery || resolvedFilterIds.length === 0 || isBroadAnalyticalQuery
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
  let ragChunkList: ChunkInfo[] = [];

  const ragTimeoutMs = envConfig.RAG_SEARCH_TIMEOUT_MS || 20000;
  try {
    const ragResponse = await Promise.race([
      engine.search({
        query: searchTopic,
        subIntent: classification.subIntent,
        rerankTopK,
        maxTokens: maxRagTokens,
        entityFilter: effectiveEntityFilter,
        targetYear: dialogueState.activeTemporalYears?.[0],
      }),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('RAG search timeout')), ragTimeoutMs)
      ),
    ]);

    verifiedCitations = ragResponse.citations || [];
    graphTriples = (ragResponse.triples as GraphTripleItem[]) || [];

    ragChunkList = (ragResponse.verifiedContext || []).map((v: any) => ({
      id: v.chunkId || v.entityId || 'chunk_0',
      title: v.title || v.canonicalName || 'Sử liệu',
      content: v.textContent || v.summary || '',
      reliability: v.sourceReliability || 'LEVEL_1',
    }));

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
  const DIAGNOSTIC_CATEGORY_LABELS = new Set([
    'Công nghệ vũ khí',
    'Gia phả tư nhân',
    'Truyền thuyết thần thoại',
    'Tiền đề hỗn hợp',
  ]);
  const unmappedEntities: string[] = [];
  if (premiseAnalysis.isLeadingQuestion || premiseAnalysis.questionType === 'KINSHIP' || premiseAnalysis.questionType === 'IDENTITY') {
    for (const ent of premiseAnalysis.detectedEntities) {
      if (DIAGNOSTIC_CATEGORY_LABELS.has(ent) || (premiseAnalysis.categoryLabel && ent === premiseAnalysis.categoryLabel)) {
        continue;
      }
      const isMaster = isKnownMasterEntity(ent);
      const foundInContext = contextSnippets.toLowerCase().includes(ent.toLowerCase());
      const foundInTriples = graphTriples.some(
        (t) => t.source.toLowerCase().includes(ent.toLowerCase()) || t.target.toLowerCase().includes(ent.toLowerCase())
      );
      if (!isMaster && !foundInContext && !foundInTriples) {
        unmappedEntities.push(ent);
      }
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
    if (premiseAnalysis.questionType === 'EVENT') {
      subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Đồng nhất danh xưng trong sự kiện lịch sử - Khẳng định rõ hai tên gọi là cùng một người lịch sử, sau đó tập trung làm rõ vai trò, diễn biến và ý nghĩa của sự kiện lịch sử mà người dùng đang hỏi, không chia tách làm hai người.]`;
    } else {
      subIntentDirective = `\n\n[QUY TẮC NỘI BỘ: Đồng nhất danh xưng & tiểu sử - Trình bày rõ ràng các giai đoạn lịch sử của nhân vật theo thứ tự thời gian từ tên khai sinh/tên húy, tước vị, đến niên hiệu khi lên ngôi. TUYỆT ĐỐI KHÔNG mô tả 2 danh xưng như hai cá nhân riêng biệt có quan hệ huyết thống với nhau.]`;
    }
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
    multiIntentDirective += `\n\n[QUY TẮC NỘI BỘ: Kết hợp sản xuất video - Trình bày sự kiện lịch sử dựa trên tài liệu đã cung cấp, tóm lược mạch lạc các phân cảnh chính (nếu có) bám sát 100% sử liệu xác thực, TUYỆT ĐỐI KHÔNG tự suy đoán hay thêm thắt giai thoại chiến thuật hư cấu ngoài tài liệu, sau đó gợi ý người dùng nhấn nút "Tạo Video" hoặc chuyển sang tab Video Studio để bắt đầu tạo kịch bản phân cảnh.]`;
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

  // Chronology & Anti-Conflation Anchor Injection (Task 3)
  const queryYearsMatch = effectiveQuery.match(/\b(\d{3,4})\b/g);
  const activeYears = queryYearsMatch
    ? Array.from(new Set(queryYearsMatch.map((y) => parseInt(y, 10)).filter((y) => y >= 100 && y <= 2100)))
    : [];
  const chronologyAnchors = buildChronologyAnchorBox(entitiesToLookup, activeYears, effectiveQuery);
  if (chronologyAnchors.trim()) {
    contextSections.push(`<verified_chronology_anchors>\n${chronologyAnchors}\n</verified_chronology_anchors>`);
  }

  const dynamicEntityCards = buildDynamicEntityKnowledgeCards(entitiesToLookup, isBroadAnalyticalQuery);
  if (dynamicEntityCards.trim()) {
    contextSections.push(`<verified_master_entities>\n${dynamicEntityCards}\n</verified_master_entities>`);
  }
  contextSections.push(`<verified_rag_evidence>\n<!-- Chú ý: Mỗi đoạn trích bên dưới thuộc về tiêu đề nhân vật cụ thể. TUYỆT ĐỐI KHÔNG hoán đổi hoặc gán nhầm thuộc tính/tiểu sử của nhân vật này cho nhân vật khác. -->\n${pruneRagContext(contextSnippets || 'Không có dữ liệu RAG bổ sung')}\n</verified_rag_evidence>`);
  if (triplesText.trim()) {
    contextSections.push(`<knowledge_graph_triples>\n${triplesText}\n</knowledge_graph_triples>`);
  }

  const safeQuery = escapePromptXml(effectiveQuery);
  let userTurnWithContext = `<historical_context>\n${contextSections.join('\n\n')}\n</historical_context>\n\n<user_query>\n${safeQuery}\n</user_query>`;

  // Anti-Echo Sycophancy & Recency Bias Mitigation: Place premise directives directly adjacent to user_query
  if (premiseDirectiveText.trim()) {
    userTurnWithContext += `\n\n<critical_response_constraint>\n<!-- [CHỈ DẪN NGHIỆP VỤ & CĂN CỨ SỬ LIỆU BẮT BUỘC]: Hãy tiếp thu và vận dụng các dữ kiện, luận điểm đính chính bên dưới để trả lời người dùng một cách tự nhiên, chuẩn xác. CÂU MỞ ĐẦU BẮT BUỘC TRẢ LỜI TRỰC DIỆN (KHẲNG ĐỊNH HOẶC BÁC BỎ RÕ RÀNG TIỀN ĐỀ); TUYỆT ĐỐI KHÔNG NHẠI LẠI CÂU HỎI HOẶC BẮT ĐẦU BẰNG CÂU DẪN DẮT ĐỒNG TÌNH VỚI TIỀN ĐỀ SAI. -->\n${premiseDirectiveText.trim()}\n</critical_response_constraint>`;
  }

  const rawMessages: ChatMessage[] = [
    { role: 'system', content: STATIC_SYSTEM_PERSONA_PROMPT },
    ...prunedHistory.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userTurnWithContext },
  ];
  const maxPromptBudget = isLeanIdentity ? 2500 : (isBroadAnalyticalQuery ? 3500 : 5000);
  const messages = clampTotalPromptMessages(rawMessages, maxPromptBudget);

  let fullResponse = '';
  const loopDetector = createStreamLoopDetector();

  if (isRagSystemError) {
    const disclaimer = `> ⚠️ **Lưu ý:** *Hệ thống tra cứu sử liệu chuyên sâu (Chrono-RAG) đang phản hồi chậm hoặc tạm gián đoạn. Phản hồi dưới đây dựa trên tri thức đại cương, vui lòng đối chiếu lại với chính sử.*\n\n`;
    yield { type: 'token', content: disclaimer };
    fullResponse += disclaimer;
  }

  // Buffered Opening Window: Accumulate opening tokens until terminal punctuation or ~100 chars
  // to run fast pre-flight guardrail checks before streaming to UI, preventing Content Morphing and hallucination leakage.
  let openingBuffer = '';
  let isOpeningFlushed = false;
  const PUNCTUATION_END = /[.!?\n]/;

  const flushOpeningBuffer = (): string => {
    let openingText = openingBuffer;
    if (premiseAnalysis.isSameEntityCoReference && premiseAnalysis.detectedEntities.length >= 2) {
      const e1 = premiseAnalysis.detectedEntities[0];
      const e2 = premiseAnalysis.detectedEntities[1];
      const canon = resolveCanonicalEntity(e1);
      const invariantCheck = verifyCoReferenceInvariant(openingText, e1, e2, canon.canonicalName);
      if (!invariantCheck.isValid) {
        log.warn('chat.coreference_invariant_opening_repaired', invariantCheck.violation || '');
        openingText = invariantCheck.sanitized;
      }
    }
    isOpeningFlushed = true;
    openingBuffer = '';
    return openingText;
  };

  try {
    for await (const chunk of generateLLMCompletionStream(messages, {
      temperature: 0.35,
      top_p: 0.9,
      frequency_penalty: 0.3,
      presence_penalty: 0.2,
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
        if (!isOpeningFlushed) {
          openingBuffer += loopCheck.cleanChunk;
          if (PUNCTUATION_END.test(openingBuffer) || openingBuffer.length >= 100) {
            const cleanOpening = flushOpeningBuffer();
            fullResponse += cleanOpening;
            yield { type: 'token', content: cleanOpening };
          }
        } else {
          fullResponse += loopCheck.cleanChunk;
          yield { type: 'token', content: loopCheck.cleanChunk };
        }
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

  // Flush any remaining buffered opening tokens if stream finished quickly
  if (!isOpeningFlushed && openingBuffer.length > 0) {
    const cleanOpening = flushOpeningBuffer();
    fullResponse += cleanOpening;
    yield { type: 'token', content: cleanOpening };
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

  // 8. Post-Generation Grounding & Sentence-Level Attribution
  let groundedClaims: GroundedClaimItem[] = [];
  let visualAnchors: VisualAnchorSuggestion[] = [];
  let faithfulnessScore: number | undefined;
  let citationCorrectnessScore: number | undefined;
  let isLowConfidence = false;

  if (ragChunkList.length > 0 && fullResponse.trim()) {
    try {
      const grounding = groundClaims(fullResponse, ragChunkList);
      groundedClaims = grounding.claims;
      visualAnchors = grounding.visualAnchors;
      faithfulnessScore = grounding.faithfulnessScore;
      citationCorrectnessScore = grounding.citationCorrectnessScore;
      isLowConfidence = grounding.isLowConfidence || false;

      if (grounding.hasContradiction) {
        log.warn('chat.grounding_contradiction_detected', 'Chat response has potential historical contradiction with evidence', {
          conversationId,
          faithfulnessScore,
        });
        const contradictionDisclaimer = `\n\n> ⚠️ **Lưu ý đối chiếu sử liệu:** *Một số nội dung trong phản hồi có dấu hiệu chưa đồng nhất với nguồn chính sử đã đối soát. Vui lòng đối chiếu kỹ với các tập sử liệu được dẫn chứng bên dưới.*`;
        fullResponse += contradictionDisclaimer;
        yield { type: 'token', content: contradictionDisclaimer };
      }
    } catch (groundErr: any) {
      log.warn('chat.grounding_analysis_failed', `Grounding analysis skipped due to error: ${groundErr.message}`);
    }
  }

  const charLength = fullResponse.length;
  const estimatedTokens = Math.ceil(charLength / 3.5);
  log.info('chat.supervisor_completed', `Chat stream finished (${Date.now() - startTime}ms)`, {
    conversationId,
    charLength,
    tokenLength: estimatedTokens,
    faithfulnessScore,
    claimsCount: groundedClaims.length,
  });

  yield {
    type: 'done',
    content: fullResponse,
    citations: verifiedCitations,
    triples: graphTriples,
    claims: groundedClaims.length > 0 ? groundedClaims : undefined,
    visualAnchors: visualAnchors.length > 0 ? visualAnchors : undefined,
    faithfulnessScore,
    citationCorrectnessScore,
    isLowConfidence: isLowConfidence || undefined,
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
  let claims: GroundedClaimItem[] | undefined;
  let visualAnchors: VisualAnchorSuggestion[] | undefined;
  let faithfulnessScore: number | undefined;
  let citationCorrectnessScore: number | undefined;
  let isLowConfidence: boolean | undefined;

  for await (const chunk of handleChatQueryStream(request)) {
    if (chunk.type === 'token' && chunk.content) {
      fullText += chunk.content;
    } else if (chunk.type === 'citation' && chunk.citations) {
      citations = chunk.citations;
    } else if (chunk.type === 'triples' && chunk.triples) {
      triples = chunk.triples;
    } else if (chunk.type === 'intent' && chunk.intent) {
      intent = chunk.intent as ChatIntent;
    } else if (chunk.type === 'done') {
      claims = chunk.claims;
      visualAnchors = chunk.visualAnchors;
      faithfulnessScore = chunk.faithfulnessScore;
      citationCorrectnessScore = chunk.citationCorrectnessScore;
      isLowConfidence = chunk.isLowConfidence;
    }
  }

  return {
    fullText,
    intent,
    citations,
    triples,
    claims,
    visualAnchors,
    faithfulnessScore,
    citationCorrectnessScore,
    isLowConfidence,
    conversationId: request.conversationId,
  };
}
