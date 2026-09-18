/**
 * Micro-Step 0: Chaptering & Outline Agent Node
 * Divides topic and RAG context into N Chapters (2-3 minutes each) and initializes runningNarrativeState
 */

import {
  ChapterPlan,
  HISTORICAL_PERSON_DICTIONARY,
  HISTORICAL_LOCATION_DICTIONARY,
  CORE_EVENTS,
  CORE_DOCS,
  CORE_ORGS,
  CORE_ARTIFACTS,
  CANONICAL_DYNASTY_BOUNDS,
  sanitizeSentenceBoundaries,
  resolveCanonicalEntity,
  getTargetWpm,
} from '@chronoviet/shared-spec';
import { callLlm, envConfig, parseLlmJson } from '@chronoviet/infra';
import { ChronoGraphState, getNodeLogger, TelemetryAuditEntry } from '../state.js';
import { routeChunksToChapters } from '../../research/chapter-rag-router.js';

import {
  cleanCrawlerText,
  isValidHistoricalEntity,
  canonicalizeEntityList,
  extractHistoricalEntitiesFromRag,
  getEntityVariants,
} from '../helpers/entity-sanitizer.js';

export {
  cleanCrawlerText,
  isValidHistoricalEntity,
  canonicalizeEntityList,
  extractHistoricalEntitiesFromRag,
  getEntityVariants,
};



export interface ChapterMacroBeat {
  chapterIndex: number;
  title: string;
  timeAnchor?: string;
  mainEvent?: string;
  // Backward compatibility fields if passed from legacy format
  summary?: string;
  targetDurationSeconds?: number;
  keyEvents?: string[];
  introducedEntities?: string[];
  entryHook?: string;
  exitHook?: string;
  climaxFocus?: string;
  transitionHook?: string;
  establishedTone?: string;
}

export interface EnrichMacroBeatsOptions {
  userPrompt: string;
  videoType: string;
  totalTargetSec: number;
  secPerChapter: number;
  allHistoricalEntities: string[];
  userPromptEntities: string[];
  verifiedChunks: any[];
  ragContext?: ChronoGraphState['ragContext'];
}

/**
 * Phase 2: Deterministic RAG Mapping & Chapter Enricher
 * Associates macro-beats with verified RAG evidence, cleans crawler artifacts,
 * deterministically distributes userPromptEntities, and validates all introduced entities.
 */
export function enrichMacroBeatsToChapterPlans(
  beats: ChapterMacroBeat[],
  options: EnrichMacroBeatsOptions
): ChapterPlan[] {
  const {
    userPrompt,
    totalTargetSec,
    secPerChapter,
    allHistoricalEntities,
    userPromptEntities,
    verifiedChunks,
    ragContext,
  } = options;

  const numChapters = beats.length;
  if (numChapters === 0) return [];

  // Climax chapter index: e.g. for 2 chapters -> 1; 3 chapters -> 1; 4 chapters -> 2; 5 chapters -> 3
  const climaxChapterIdx = numChapters <= 2 ? numChapters - 1 : Math.max(1, Math.min(numChapters - 2, Math.floor((numChapters - 1) * 0.6)));

  let chapters: ChapterPlan[] = beats.map((beat, idx) => {
    let rawTitle = (beat.title || '').trim()
      .replace(/^(?:Hồi|Chương|Phần)\s*\d*\s*[:\-–—]\s*/i, '')
      .replace(/^(?:Bối cảnh(?: lịch sử)?|Trận quyết chiến|Quyết chiến|Sách lược(?: và thế trận)?|Kết cục(?: thắng lợi)?|Di sản(?: và dư âm)?|Ý nghĩa(?: lịch sử)?)\s*[:\-–—]\s*/i, '')
      .trim();

    const isGeneric = !rawTitle || /^(?:Bối cảnh(?:\s*lịch sử)?(?:\s*v[àa]\s*nguy cơ(?:\s*non sông)?)?|Sách lược(?:\s*v[àa]\s*chuẩn bị thế trận)?|Trận quyết chiến(?:\s*v[àa]\s*bước ngoặt)?|Quyết chiến(?:\s*v[àa]\s*di sản)?|Di sản(?:\s*v[àa]\s*dư âm)?)$/i.test(rawTitle);
    const isVerbatimTopic = rawTitle.toLowerCase() === userPrompt.trim().toLowerCase();

    let title: string;
    if (isGeneric || isVerbatimTopic) {
      const anchor = beat.mainEvent && beat.mainEvent.length > 5
        ? beat.mainEvent
        : (beat.timeAnchor ? `${userPrompt} (${beat.timeAnchor})` : `Giai đoạn ${idx + 1}`);
      title = `Hồi ${idx + 1}: ${anchor}`;
    } else {
      title = `Hồi ${idx + 1}: ${rawTitle}`;
    }

    const targetDurationSeconds = Number(beat.targetDurationSeconds) ||
      (idx === numChapters - 1 ? totalTargetSec - secPerChapter * (numChapters - 1) : secPerChapter);

    const mainEventText = beat.mainEvent || (Array.isArray(beat.keyEvents) && beat.keyEvents[0]) || title;
    const keyEvents = Array.isArray(beat.keyEvents) && beat.keyEvents.length > 0
      ? beat.keyEvents
      : [mainEventText];

    const climaxFocus = beat.climaxFocus || mainEventText;

    const cleanUserTopic = userPrompt.replace(/^(?:kể lại|hãy kể|trình bày|hãy trình bày|tóm tắt|phân tích|viết về|hãy viết về|thuyết minh về)\s+/iu, '').trim();
    const entryHook = beat.entryHook || (idx === 0
      ? (beat.mainEvent && beat.mainEvent.length > 5
          ? `Bối cảnh ${beat.timeAnchor ? `năm ${beat.timeAnchor}` : 'thời cuộc'} và khởi đầu của ${beat.mainEvent}`
          : `Bối cảnh lịch sử ${beat.timeAnchor ? `năm ${beat.timeAnchor}` : ''} gắn liền với ${cleanUserTopic}`)
      : (beat.mainEvent && beat.mainEvent.length > 5
          ? `Diễn biến tiếp theo chuyển sang ${beat.mainEvent}`
          : `Bước ngoặt tiếp theo trong tiến trình lịch sử`));

    const exitHook = beat.exitHook || (idx < numChapters - 1
      ? `Mở ra bước ngoặt tiếp theo trong tiến trình lịch sử`
      : `Khắc sâu bài học lịch sử và di sản muôn đời`);

    const transitionHook = beat.transitionHook || exitHook;
    const establishedTone = beat.establishedTone || (idx === numChapters - 1 ? 'Hào hùng, lắng đọng' : 'Hào hùng, trang trọng');

    // RAG Chunk Semantic & Temporal Matching for Summary
    let summary = cleanCrawlerText(beat.summary || '');
    const placeholderPattern = /tóm tắt sự kiện|nội dung phần|sự kiện chính|phần \d+|placeholder/i;
    const isPlaceholderSummary = !summary || summary.trim().length < 25 || placeholderPattern.test(summary);

    if (isPlaceholderSummary) {
      const timeAnchorYears: number[] = [];
      const yrMatches = (beat.timeAnchor || '').match(/-?\b\d{1,4}\b/g);
      if (yrMatches) {
        for (const ym of yrMatches) {
          const y = parseInt(ym, 10);
          if (!isNaN(y)) timeAnchorYears.push(y);
        }
      }

      let bestChunk: any = null;
      let bestScore = -1;

      for (let cIdx = 0; cIdx < verifiedChunks.length; cIdx++) {
        const chunk = verifiedChunks[cIdx];
        let score = 0;
        const cleanChunkSummary = cleanCrawlerText(chunk.summary || '');
        const cleanCanonical = (chunk.canonicalName || '').toLowerCase();
        const cleanChunkTitle = (chunk.title || '').toLowerCase();
        const chunkText = `${cleanCanonical} ${cleanChunkTitle} ${cleanChunkSummary}`.toLowerCase();

        // Temporal match
        if (timeAnchorYears.length > 0 && (chunk.timeStart !== undefined || chunk.timeEnd !== undefined)) {
          const cStart = chunk.timeStart ?? chunk.timeEnd;
          const cEnd = chunk.timeEnd ?? chunk.timeStart;
          if (timeAnchorYears.some((y) => y >= cStart - 15 && y <= cEnd + 15)) {
            score += 10;
          }
        }

        // Entity / Keyword match
        const searchWords = `${title} ${mainEventText}`.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
        for (const kw of searchWords) {
          if (chunkText.includes(kw)) score += 2;
        }

        // Index relative alignment
        const relativeChunk = cIdx / Math.max(1, verifiedChunks.length);
        const relativeChapter = idx / Math.max(1, numChapters);
        if (Math.abs(relativeChunk - relativeChapter) < 0.25) {
          score += 3;
        }

        if (score > bestScore) {
          bestScore = score;
          bestChunk = chunk;
        }
      }

      if (!bestChunk && verifiedChunks.length > 0) {
        bestChunk = verifiedChunks[idx % verifiedChunks.length];
      }

      const cleanBestChunkSummary = cleanCrawlerText(bestChunk?.summary);
      if (cleanBestChunkSummary && cleanBestChunkSummary.length >= 25) {
        summary = cleanBestChunkSummary;
      } else {
        summary = `${beat.timeAnchor ? `Vào ${beat.timeAnchor}, ` : ''}${mainEventText}, ghi dấu ấn lịch sử quan trọng trong tiến trình ${userPrompt}.`;
      }
    }

    // Incomplete Summary Guardrail: Sanitize incomplete or truncated sentence boundaries
    summary = sanitizeSentenceBoundaries(summary);
    if (!summary || summary.trim().length < 15) {
      summary = `${beat.timeAnchor ? `Vào ${beat.timeAnchor}, ` : ''}${mainEventText}, ghi dấu ấn lịch sử quan trọng trong tiến trình ${userPrompt}.`;
      summary = sanitizeSentenceBoundaries(summary);
    }

    const introducedEntities = Array.isArray(beat.introducedEntities) && beat.introducedEntities.length > 0
      ? beat.introducedEntities.filter(isValidHistoricalEntity)
      : [];

    return {
      chapterIndex: idx,
      title,
      summary,
      targetDurationSeconds,
      keyEvents,
      introducedEntities,
      entryHook,
      exitHook,
      climaxFocus,
      transitionHook,
      establishedTone,
    };
  });

  // ADR-2: Deterministic User Prompt Entity Priority
  if (userPromptEntities.length > 0 && chapters.length > 0) {
    for (const uEnt of userPromptEntities) {
      if (!isValidHistoricalEntity(uEnt)) continue;
      // Anchor in Chapter 0 (Opening hook)
      if (!chapters[0].introducedEntities.includes(uEnt)) {
        chapters[0].introducedEntities.unshift(uEnt);
      }
      // Anchor in Climax chapter
      if (climaxChapterIdx < chapters.length && !chapters[climaxChapterIdx].introducedEntities.includes(uEnt)) {
        chapters[climaxChapterIdx].introducedEntities.push(uEnt);
      }
      // Anchor in Resolution chapter
      const lastIdx = chapters.length - 1;
      if (lastIdx > 0 && !chapters[lastIdx].introducedEntities.includes(uEnt)) {
        chapters[lastIdx].introducedEntities.push(uEnt);
      }
    }
  }

  // Distribute allHistoricalEntities across chapters
  const maxEntitiesPerChapter = Math.max(6, Math.min(10, Math.ceil(allHistoricalEntities.length / Math.max(1, chapters.length))));
  const assignedEntities = new Set<string>();
  for (const c of chapters) {
    for (const e of c.introducedEntities) {
      assignedEntities.add(e.toLowerCase().trim());
    }
  }

  const unassignedEntities = allHistoricalEntities.filter(
    (e) => !assignedEntities.has(e.toLowerCase().trim())
  );

  for (const unassigned of unassignedEntities) {
    if (!isValidHistoricalEntity(unassigned)) continue;
    const uLower = unassigned.toLowerCase().trim();
    const variants = getEntityVariants(unassigned, ragContext);
    let targetChapterIdx = -1;

    // First pass: direct semantic match with chapter title, summary, key events
    for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
      const c = chapters[cIdx];
      if (c.introducedEntities.length >= maxEntitiesPerChapter + 2) continue;
      const text = `${c.title} ${c.summary} ${(c.keyEvents || []).join(' ')}`.toLowerCase();
      if (text.includes(uLower) || variants.some((v) => text.includes(v))) {
        targetChapterIdx = cIdx;
        break;
      }
    }

    // Second pass: match with verified chunks
    if (targetChapterIdx === -1) {
      for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
        const c = chapters[cIdx];
        if (c.introducedEntities.length >= maxEntitiesPerChapter) continue;
        const matchingChunk = verifiedChunks[cIdx] || verifiedChunks[cIdx % verifiedChunks.length];
        const chunkText = `${matchingChunk?.canonicalName || ''} ${matchingChunk?.summary || ''}`.toLowerCase();
        if (chunkText.includes(uLower) || variants.some((v) => chunkText.includes(v))) {
          targetChapterIdx = cIdx;
          break;
        }
      }
    }

    // Third pass: heuristic narrative role matching & entity metadata
    if (targetChapterIdx === -1 && chapters.length >= 3) {
      const resolvedUnassigned = resolveCanonicalEntity(unassigned);
      const isAdversaryEntity =
        (resolvedUnassigned as any).role === 'ADVERSARY' ||
        (resolvedUnassigned as any).entityType === 'INVADING_FORCE' ||
        /man_thanh|nguyen_mong|nam_han|tong|phap|my|xiem|minh/i.test(resolvedUnassigned.entityId || '') ||
        /tướng giặc|chủ tướng địch|tổng đốc|thực dân|quân xâm lược/i.test((resolvedUnassigned as any).role || '') ||
        /de castries|đờ cát|tô định|lưu hoàng tháo|hầu nhân bảo|quách quỳ|thoát hoan|ô mã nhi|liễu thăng|vương thông|tôn sĩ nghị|sầm nghi đống|navarre|garnier|rivière|leclerc/i.test(uLower);
      const isTreatyOrResolution = /hiệp định|hòa ước|hiệp ước|đình chiến|giảng hòa|tuyên ngôn|di chúc|bình ngô đại cáo/i.test(uLower);
      const isTacticsOrPreparation = /kéo pháo|vườn không|tiên phát|đánh chắc|cọc ngầm|chiếu cần vương|hịch tướng sĩ/i.test(uLower);
      const isStrongholdBattle = /đồi|cứ điểm|cao điểm|đồn|phòng tuyến/i.test(uLower);

      if (isTreatyOrResolution) {
        targetChapterIdx = chapters.length - 1;
      } else if (isTacticsOrPreparation) {
        targetChapterIdx = Math.min(1, chapters.length - 1);
      } else if (isAdversaryEntity) {
        targetChapterIdx = climaxChapterIdx;
      } else if (isStrongholdBattle) {
        targetChapterIdx = Math.floor(chapters.length / 2);
      }
    }

    // Fourth pass: distribute to chapter with fewest entities
    if (targetChapterIdx === -1) {
      let minEntities = maxEntitiesPerChapter;
      for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
        const count = chapters[cIdx].introducedEntities.length;
        if (count < minEntities) {
          minEntities = count;
          targetChapterIdx = cIdx;
        }
      }
    }

    if (targetChapterIdx !== -1 && targetChapterIdx < chapters.length) {
      if (!chapters[targetChapterIdx].introducedEntities.includes(unassigned)) {
        chapters[targetChapterIdx].introducedEntities.push(unassigned);
      }
    }
  }

  // Safety check: ensure every chapter has at least 2 entities using safe prompt & chapter title entities
  chapters.forEach((c) => {
    if (!c.introducedEntities || c.introducedEntities.length < 2) {
      const titleEntities = extractHistoricalEntitiesFromRag(
        { verifiedContext: [], aliasTable: {}, citations: [] },
        `${c.title} ${c.summary}`
      );
      const safeEntities = Array.from(new Set([...userPromptEntities, ...titleEntities])).filter(isValidHistoricalEntity);
      c.introducedEntities = Array.from(new Set([...(c.introducedEntities || []), ...safeEntities])).slice(0, 5);
    }
  });

  // Verify total duration
  const allocatedTotal = chapters.reduce((sum, c) => sum + (c.targetDurationSeconds || 0), 0);
  if (allocatedTotal === 0 || Math.abs(allocatedTotal - totalTargetSec) / totalTargetSec > 0.05) {
    chapters.forEach((c, idx) => {
      c.targetDurationSeconds =
        idx === chapters.length - 1
          ? totalTargetSec - secPerChapter * (chapters.length - 1)
          : secPerChapter;
    });
  }

  // Phase 3: Route verified RAG chunks temporally to chapters
  const effectiveChunks = (verifiedChunks && verifiedChunks.length > 0)
    ? verifiedChunks
    : (ragContext?.verifiedContext || []);

  if (effectiveChunks.length > 0) {
    chapters = routeChunksToChapters(chapters, effectiveChunks);
  }

  return chapters;
}

export async function chapteringNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'chaptering');
  nodeLog.info('orchestrator.chaptering_started', `Starting Chaptering & Outline for topic "${state.userPrompt}"`, {
    projectId: state.projectId,
    videoType: state.videoType,
  });

  const totalTargetSec = Math.max(60, Math.round((state.targetDurationMinutes || 2) * 60));
  // Dynamic chapter count according to cinematic pacing:
  // Short videos (<90s): 2 chapters (~35-45s each)
  // 2-minute videos (90-149s): 3 chapters (~40-50s each)
  // 3-minute videos (150-239s): 4 chapters (~45-55s each)
  // Long-form videos (>=240s): 5-6 chapters (~50-60s each)
  const numChapters = totalTargetSec < 90
    ? 2
    : (totalTargetSec < 150
      ? 3
      : (totalTargetSec < 240
        ? 4
        : Math.min(6, Math.round(totalTargetSec / 50))));
  const secPerChapter = Math.round(totalTargetSec / numChapters);

  // Extract core entities and summary from RAG context
  const ragSummary = state.ragContext?.verifiedContext
    ?.slice(0, 8)
    ?.map((c) => {
      const cleanSummary = cleanCrawlerText(c.summary || '');
      return `- ${c.canonicalName} (${c.title || 'Thời kỳ lịch sử'}): ${cleanSummary}`;
    })
    ?.join('\n') || 'Không có tư liệu tóm tắt';

  const allHistoricalEntities = extractHistoricalEntitiesFromRag(state.ragContext, state.userPrompt);
  const userPromptEntities = extractHistoricalEntitiesFromRag(
    { verifiedContext: [], aliasTable: {}, citations: [] },
    state.userPrompt
  );

  const domainChapteringGuidance = state.videoType === 'BIOGRAPHY'
    ? `      + Hồi 1 (Thân thế, Xuất thân & Hoài bão): Nguồn cội gia đình, quê hương, bối cảnh thời cuộc thời niên thiếu, những bước ngoặt đầu đời định hình nhân cách và lý tưởng. (TUYỆT ĐỐI KHÔNG kể trước sự nghiệp đỉnh cao hay sự ra đi ở cuối đời).
      + Các Hồi giữa (Hành trình, Biến cố & Cống hiến kiệt xuất): Quá trình hoạt động, dấn thân vượt qua gian nan thử thách, các quyết sách/tác phẩm/chiến công và đóng góp lớn lao nhất.
      + Hồi cuối (Chặng đường cuối đời, Sự ra đi & Di sản bất tử): Những năm tháng cuối đời, sự ra đi/tuẫn tiết vì đại nghĩa của nhân vật, đúc kết tầm vóc lịch sử, nhân cách và di sản trường tồn trong lòng dân tộc.`
    : state.videoType === 'ARTIFACT'
    ? `      + Hồi 1 (Nguồn gốc ra đời & Đỉnh cao chế tác): Niên đại xuất hiện, bối cảnh nền văn minh lịch sử, kỹ thuật đúc/chế tác tinh xảo độc nhất vô nhị. (TUYỆT ĐỐI KHÔNG kể trước việc phát hiện khảo cổ thời hiện đại ở Hồi 1).
      + Các Hồi giữa (Giải mã biểu tượng & Đời sống đương thời): Phân tích chi tiết hoa văn, ý nghĩa biểu tượng tâm linh, nghi lễ và đời sống xã hội phản ánh qua hiện vật.
      + Hồi cuối (Hành trình lưu lạc, Khảo cổ & Biểu tượng trường tồn): Biến cố thăng trầm theo thời gian, phát hiện khảo cổ học thời hiện đại, giá trị Bảo vật Quốc gia và niềm tự hào bản sắc dân tộc.`
    : state.videoType === 'DYNASTY'
    ? `      + Hồi 1 (Lập triều, Định đô & Khai mở vận nước): Tiền đề lịch sử, sự chuyển giao quyền lực hoặc cuộc dời đô mở ra trang sử mới. (TUYỆT ĐỐI KHÔNG kể trước sự suy vong của triều đại).
      + Các Hồi giữa (Thịnh trị, Cải cách & Biến cố vương triều): Phát triển văn hóa, kinh tế, thể chế, các cải cách trọng yếu và đương đầu với thử thách đối nội/đối ngoại.
      + Hồi cuối (Khủng hoảng, Chuyển giao & Bài học trị quốc): Giai đoạn thoái trào, chuyển giao vương triều và bài học lịch sử để lại cho hậu thế.`
    : state.videoType === 'MYSTERY'
    ? `      + Hồi 1 (Khởi nguồn vụ việc & Bối cảnh then chốt): Biến cố bất ngờ, hiện trường, các nhân vật trung tâm và mâu thuẫn châm ngòi bí ẩn. (TUYỆT ĐỐI KHÔNG tiết lộ kết luận/lời giải ở Hồi 1).
      + Các Hồi giữa (Manh mối, Giả thuyết & Tranh luận sử học): Những uẩn khúc cung đình, mâu thuẫn giữa các nguồn sử liệu và các luồng kiến giải đối lập.
      + Hồi cuối (Sự thật minh oan, Đánh giá lịch sử & Bài học nhân tâm): Soi chiếu của sử học hiện đại, bài học đắt giá về quyền lực, nhân tâm và sự công minh của lịch sử.`
    : `      + Hồi 1 (Khởi nguồn & Căn nguyên): Bối cảnh thời cuộc, nguy cơ xâm lăng/ách áp bức, biến cố trực tiếp châm ngòi và quyết tâm đứng lên. (TUYỆT ĐỐI KHÔNG kể kết quả chiến thắng, việc hạ thành hay giải phóng ở Hồi 1).
      + Các Hồi giữa (Tụ nghĩa, Chuyển quân & Các trận chiến bản lề): Lời hiệu triệu, hội tụ lực lượng, mưu lược tác chiến, các mũi tiến công và bước ngoặt chuyển biến của chiến trường.
      + Hồi cuối (Trận quyết chiến, Toàn thắng & Di sản trường tồn): Quét sạch quân thù, khôi phục giang sơn, định đô/xây dựng nền tự chủ và đúc kết ý nghĩa lịch sử vĩnh cửu.`;

  const systemMessage = `Bạn là Chaptering & Narrative Planning Agent của hệ thống ChronoViet.
Nhiệm vụ: Phân chia chủ đề lịch sử và tư liệu Chrono-RAG thành ĐÚNG ${numChapters} HỒI (Chapters), mỗi hồi tương ứng ~${secPerChapter} giây (${Math.round((secPerChapter / 60) * getTargetWpm(state.templateId))} từ) để tạo thành một video tài liệu hoàn chỉnh, liền mạch, cuốn hút.

QUY TẮC BẮT BUỘC:
1. Xuất duy nhất 1 JSON object:
{
  "chapterBeats": [
    {
      "chapterIndex": 0,
      "title": "Hồi 1: Tiêu đề Hồi ngắn gọn, cuốn hút",
      "timeAnchor": "Mốc thời gian cụ thể (ví dụ: 'Năm [YYYY]' hoặc 'Giai đoạn [YYYY-YYYY]' tương ứng của Hồi)",
      "mainEvent": "Sự kiện lịch sử trung tâm của Hồi này",
      "entryHook": "Câu mở đầu hấp dẫn, tạo sự tò mò",
      "climaxFocus": "Điểm nhấn kịch tính/cao trào của Hồi",
      "exitHook": "Câu kết nối chuyển tiếp mượt mà sang Hồi tiếp theo",
      "establishedTone": "Hào hùng / Trầm lắng / Bi tráng / Trang trọng"
    }
  ]
}
2. Không thêm bất kỳ văn bản nào ngoài JSON.
3. TIÊU ĐỀ CHƯƠNG BẮT BUỘC GẮN VỚI SỰ KIỆN LỊCH SỬ CỤ THỂ (HISTORICAL EVENT ANCHORS):
   - TIÊU ĐỀ MỖI HỒI BẮT BUỘC PHẢI KHÁC NHAU HOÀN TOÀN, phản ánh sự phát triển tuyến tính của dòng lịch sử (TUYỆT ĐỐI KHÔNG dùng cùng một tiêu đề cho nhiều hồi).
   - TUYỆT ĐỐI KHÔNG đặt tiêu đề chung chung như: 'Bối cảnh và Nguy cơ', 'Sách lược và chuẩn bị', 'Trận quyết chiến', 'Di sản và Dư âm'.
   - Tiêu đề BẮT BUỘC chứa tên nhân vật, chiến dịch, địa danh hoặc sự kiện lịch sử cụ thể theo từng giai đoạn.
4. QUY TẮC MẠCH TRUYỆN THEO THỂ LOẠI (TOPIC & HISTORICAL ARC FIDELITY - ${state.videoType}):
   - Phân chia ${numChapters} hồi theo tiến trình niên đại TUYẾN TÍNH KHÔNG TRÙNG LẶP. Mỗi hồi đại diện cho một chặng đường lịch sử riêng biệt:
${domainChapteringGuidance}
   - QUY TẮC ĐẶT TIÊU ĐỀ HỒI (CHƯƠNG):
     + Tiêu đề BẮT BUỘC phải sáng tạo, hấp dẫn và gắn chặt với sự kiện lịch sử CỦA CHỦ ĐỀ HIỆN TẠI theo cấu trúc: 'Hồi [N]: [Hành động/Biến cố lịch sử then chốt] và [Địa danh/Nhân vật/Chiến dịch tương ứng của giai đoạn đó]'.
     + TUYỆT ĐỐI KHÔNG đưa tên nhân vật, địa danh hoặc sự kiện của thời kỳ lịch sử khác vào tiêu đề.
     + TUYỆT ĐỐI KHÔNG đặt tiêu đề rỗng hoặc nhãn khuôn mẫu chung chung như 'Hồi [N]: Diễn biến giai đoạn [N]', 'Bối cảnh và Nguy cơ', 'Trận quyết chiến', 'Di sản và Dư âm'.
   - BẢO TOÀN PHÂN VÙNG THỜI GIAN & SỰ KIỆN (TEMPORAL BOUNDARY INTEGRITY):
     + Mỗi Hồi có một phạm vi sự kiện RIÊNG BIỆT.
     + Hồi trước TUYỆT ĐỐI KHÔNG được kể lấn sang các sự kiện, chiến thắng hoặc kết cục thuộc về các Hồi sau!
   - Trật tự thời gian tuyến tính từ sớm đến muộn. Đúng vai trò chính nghĩa (Đại Việt/Việt Nam) và quân xâm lược.`;

  const userContent = `Chủ đề: "${state.userPrompt}"
Thể loại: ${state.videoType}
Số lượng hồi yêu cầu: BẮT BUỘC đúng ${numChapters} hồi.
Thời lượng mục tiêu: ${totalTargetSec} giây (~${secPerChapter} giây/hồi).

Thực thể lịch sử trọng tâm từ Chrono-RAG:
${allHistoricalEntities.slice(0, 12).join(', ')}

Tư liệu lịch sử tóm lược:
${ragSummary}

Hãy xuất JSON { "chapterBeats": [...] } gồm ĐỦ ${numChapters} hồi:`;

  let chapters: ChapterPlan[] = [];
  const telemetryAudit: TelemetryAuditEntry[] = [];
  const verifiedChunks = state.ragContext?.verifiedContext || [];

  try {
    let rawContent = '';
    let parsed: any;
    try {
      const res = await callLlm({
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        maxTokens: 1024,
        responseFormat: 'json_object',
        timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
      });
      rawContent = res.content || '';
      parsed = parseLlmJson(rawContent);
    } catch (llmParseErr: any) {
      nodeLog.warn('orchestrator.chaptering_parse_retry', `Primary chaptering JSON parse failed (${llmParseErr.message}). Attempting 1-pass repair retry at temp=0.0.`);
      telemetryAudit.push({
        timestamp: new Date().toISOString(),
        node: 'chaptering',
        level: 'WARN',
        category: 'RETRY',
        message: `Primary chaptering JSON parse failed (${llmParseErr.message}). Attempting 1-pass repair retry.`,
        metadata: { error: llmParseErr.message },
      });
      try {
        const retryRes = await callLlm({
          messages: [
            { role: 'system', content: 'Bạn là chuyên gia định dạng JSON hợp lệ theo schema. Trả về DUY NHẤT 1 JSON object { "chapterBeats": [...] } theo đúng cấu trúc yêu cầu, không có bất kỳ văn bản nào ngoài JSON.' },
            { role: 'user', content: `Hãy sửa lỗi cú pháp và chuyển đổi nội dung sau thành JSON hợp lệ với đúng ${numChapters} hồi:\n\n${rawContent || userContent}` },
          ],
          temperature: 0.0,
          maxTokens: 1024,
          responseFormat: 'json_object',
          timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
        });
        parsed = parseLlmJson(retryRes.content || '');
      } catch {
        throw llmParseErr;
      }
    }

    // Support both chapterBeats (Phase 1) and legacy chapters format for backwards compatibility
    let beats: ChapterMacroBeat[] = [];
    if (parsed && Array.isArray(parsed.chapterBeats)) {
      beats = parsed.chapterBeats;
    } else if (parsed && Array.isArray(parsed.chapters)) {
      beats = parsed.chapters.map((c: any, idx: number) => ({
        chapterIndex: typeof c.chapterIndex === 'number' ? c.chapterIndex : idx,
        title: c.title || `Hồi ${idx + 1}`,
        timeAnchor: c.timeAnchor || '',
        mainEvent: c.climaxFocus || (Array.isArray(c.keyEvents) && c.keyEvents[0]) || c.summary || c.title || state.userPrompt,
        summary: c.summary,
        targetDurationSeconds: c.targetDurationSeconds,
        keyEvents: c.keyEvents,
        introducedEntities: c.introducedEntities,
        entryHook: c.entryHook,
        exitHook: c.exitHook,
        climaxFocus: c.climaxFocus,
        transitionHook: c.transitionHook,
        establishedTone: c.establishedTone,
      }));
    } else if (Array.isArray(parsed)) {
      beats = parsed.map((c: any, idx: number) => ({
        chapterIndex: typeof c.chapterIndex === 'number' ? c.chapterIndex : idx,
        title: c.title || `Hồi ${idx + 1}`,
        timeAnchor: c.timeAnchor || '',
        mainEvent: c.climaxFocus || (Array.isArray(c.keyEvents) && c.keyEvents[0]) || c.summary || c.title || state.userPrompt,
        summary: c.summary,
        targetDurationSeconds: c.targetDurationSeconds,
        keyEvents: c.keyEvents,
        introducedEntities: c.introducedEntities,
        entryHook: c.entryHook,
        exitHook: c.exitHook,
        climaxFocus: c.climaxFocus,
        transitionHook: c.transitionHook,
        establishedTone: c.establishedTone,
      }));
    }

    // Supplement missing beats if fewer than numChapters
    if (beats.length < numChapters) {
      nodeLog.warn('orchestrator.chaptering_incomplete_detected', `LLM generated ${beats.length}/${numChapters} beats. Supplementing remaining beats.`);
      telemetryAudit.push({
        timestamp: new Date().toISOString(),
        node: 'chaptering',
        level: 'WARN',
        category: 'RECONCILIATION',
        message: `Macro beats incomplete: ${beats.length}/${numChapters}. Supplementing remaining beats.`,
        metadata: { existingBeats: beats.length, numChapters },
      });
      for (let i = beats.length; i < numChapters; i++) {
        const candidateChunk = verifiedChunks[i % Math.max(1, verifiedChunks.length)];
        const chunkTitle = candidateChunk?.title || candidateChunk?.canonicalName;
        const fallbackTitle = chunkTitle && chunkTitle !== state.userPrompt
          ? `Hồi ${i + 1}: ${chunkTitle}`
          : `Hồi ${i + 1}: Bước ngoặt then chốt (${state.userPrompt})`;
        beats.push({
          chapterIndex: i,
          title: fallbackTitle,
          timeAnchor: candidateChunk?.timeStart ? `Năm ${candidateChunk.timeStart}` : '',
          mainEvent: candidateChunk?.summary
            ? cleanCrawlerText(candidateChunk.summary).slice(0, 150)
            : `Diễn biến và quyết sách then chốt giai đoạn ${i + 1} của ${state.userPrompt}`,
        });
      }
    }

    // Epoch Consistency Gatekeeper: Detect and re-anchor beats containing alien entities from wrong epochs
    const promptYears = (state.userPrompt.match(/\b(1?\d{3,4})\b/g) || [])
      .map((y) => parseInt(y, 10))
      .filter((y) => y >= 100 && y <= 2050);
    const minPromptYear = promptYears.length > 0 ? Math.min(...promptYears) : undefined;
    const maxPromptYear = promptYears.length > 0 ? Math.max(...promptYears) : undefined;

    if (minPromptYear !== undefined && maxPromptYear !== undefined) {
      for (let bIdx = 0; bIdx < beats.length; bIdx++) {
        const beat = beats[bIdx];
        const beatText = `${beat.title} ${beat.mainEvent}`.toLowerCase();
        let alienFound = '';

        for (const dyn of CANONICAL_DYNASTY_BOUNDS) {
          if (dyn.endYear < minPromptYear - 50 || dyn.startYear > maxPromptYear + 50) {
            for (const alias of dyn.aliases) {
              if (alias.length >= 4 && beatText.includes(alias.toLowerCase())) {
                alienFound = alias;
                break;
              }
            }
            if (alienFound) break;
          }
        }

        if (alienFound) {
          nodeLog.warn('orchestrator.chapter_alien_epoch_filtered', `Detected alien entity '${alienFound}' in chapter beat ${bIdx}: '${beat.title}'. Re-anchoring with verified RAG context.`);
          const candidateChunk = verifiedChunks[bIdx % Math.max(1, verifiedChunks.length)];
          const chunkTitle = candidateChunk?.title || candidateChunk?.canonicalName;
          beat.title = chunkTitle && chunkTitle !== state.userPrompt
            ? `Hồi ${bIdx + 1}: ${chunkTitle}`
            : `Hồi ${bIdx + 1}: Bước ngoặt then chốt (${state.userPrompt})`;
          if (candidateChunk?.summary) {
            beat.mainEvent = cleanCrawlerText(candidateChunk.summary).slice(0, 150);
          }
        }
      }
    }

    // Phase 2: Deterministic RAG Mapping & Micro Enrichment
    chapters = enrichMacroBeatsToChapterPlans(beats.slice(0, numChapters), {
      userPrompt: state.userPrompt,
      videoType: state.videoType,
      totalTargetSec,
      secPerChapter,
      allHistoricalEntities,
      userPromptEntities,
      verifiedChunks,
      ragContext: state.ragContext,
    });
  } catch (err: any) {
    // Eval Integrity: strict mode must not substitute deterministic template chapters
    if (envConfig.EVAL_STRICT) {
      throw err;
    }
    nodeLog.warn('orchestrator.chaptering_llm_fallback', `LLM call fallback for chaptering: ${err.message}`);
    telemetryAudit.push({
      timestamp: new Date().toISOString(),
      node: 'chaptering',
      level: 'WARN',
      category: 'FALLBACK',
      message: `LLM call fallback for chaptering: ${err.message}`,
      metadata: { error: err.message },
    });

    // Deterministic fallback macro-beats across all 5 domains
    const fallbackBeats: ChapterMacroBeat[] = [];
    if (state.videoType === 'BATTLE') {
      const battleBeats = [
        {
          title: `Hồi 1: Nguy biến Lịch sử & Thế trận Hiểm nghèo (${state.userPrompt})`,
          mainEvent: `Quân xâm lược tràn sang tạo nên bối cảnh nguy biến buộc nghĩa quân phải hành động khẩn cấp trong ${state.userPrompt}.`,
        },
        {
          title: `Hồi 2: Hiệu triệu Binh sĩ & Hành quân Thần tốc (${state.userPrompt})`,
          mainEvent: `Tập hợp lực lượng, củng cố phòng tuyến và hành quân chớp nhoáng thần tốc tiến về tiền tuyến trong ${state.userPrompt}.`,
        },
        {
          title: `Hồi 3: Mưu lược Giáp công & Hịch Xuất quân (${state.userPrompt})`,
          mainEvent: `Hoạch định phương án tác chiến then chốt, củng cố thế trận và hạ lệnh xuất quân chia lửa quyết chiến tiêu diệt giặc.`,
        },
        {
          title: `Hồi 4: Bão lửa Quyết chiến Phá tan Cứ điểm (${state.userPrompt})`,
          mainEvent: `Đột kích công phá dũng mãnh các cứ điểm then chốt, tiêu diệt sào huyệt quân địch, tiến thẳng vào giải phóng chiến trường.`,
        },
        {
          title: `Hồi 5: Đại thắng Khải hoàn & Tầm vóc Lịch sử (${state.userPrompt})`,
          mainEvent: `Toàn thắng rực rỡ, quét sạch bóng thù, khẳng định đỉnh cao nghệ thuật quân sự và di sản trường tồn của ${state.userPrompt}.`,
        },
      ];
      for (let i = 0; i < numChapters; i++) {
        const beatTemplate = battleBeats[Math.min(i, battleBeats.length - 1)];
        fallbackBeats.push({
          chapterIndex: i,
          title: numChapters === 5 ? beatTemplate.title : `Hồi ${i + 1}: ${beatTemplate.title}`,
          timeAnchor: '',
          mainEvent: beatTemplate.mainEvent,
        });
      }
    } else if (state.videoType === 'BIOGRAPHY') {
      const bioBeats = [
        {
          title: `Hồi 1: Bối cảnh Quê hương & Thời Niên thiếu (${state.userPrompt})`,
          mainEvent: `Xuất thân, quê hương và những năm tháng ấu thơ hun đúc chí lớn của ${state.userPrompt}.`,
        },
        {
          title: `Hồi 2: Hành trình Thử thách & Nuôi dưỡng Lý tưởng (${state.userPrompt})`,
          mainEvent: `Dấn thân vào phong trào yêu nước, vượt qua muôn vàn gian khổ thử thách để rèn luyện chí hướng.`,
        },
        {
          title: `Hồi 3: Quyết sách Bước ngoặt & Trọng trách Lịch sử (${state.userPrompt})`,
          mainEvent: `Đưa ra những quyết sách lịch sử mang tính bước ngoặt xoay chuyển cục diện của ${state.userPrompt}.`,
        },
        {
          title: `Hồi 4: Đỉnh cao Cống hiến & Sự nghiệp Vĩ đại (${state.userPrompt})`,
          mainEvent: `Những cống hiến hiển hách và dấu ấn vĩ đại nhất trong sự nghiệp của ${state.userPrompt}.`,
        },
        {
          title: `Hồi 5: Tầm vóc Bất tử & Di sản Tri ân (${state.userPrompt})`,
          mainEvent: `Tấm gương sáng ngời, di sản trường tồn và lòng tri ân sâu sắc của toàn thể non sông dân tộc.`,
        },
      ];
      for (let i = 0; i < numChapters; i++) {
        const beatTemplate = bioBeats[Math.min(i, bioBeats.length - 1)];
        fallbackBeats.push({
          chapterIndex: i,
          title: numChapters === 5 ? beatTemplate.title : `Hồi ${i + 1}: ${beatTemplate.title}`,
          timeAnchor: '',
          mainEvent: beatTemplate.mainEvent,
        });
      }
    } else if (state.videoType === 'DYNASTY') {
      const dynastyBeats = [
        {
          title: `Hồi 1: Khởi lập Vương triều & Quyết sách Định đô (${state.userPrompt})`,
          mainEvent: `Bối cảnh lập quốc, khai mở triều đại và quyết sách định đô trọng đại của ${state.userPrompt}.`,
        },
        {
          title: `Hồi 2: Võ công Oanh liệt & Củng cố Biên cương (${state.userPrompt})`,
          mainEvent: `Chinh phục thử thách, đánh tan thù trong giặc ngoài và củng cố chủ quyền quốc gia vững chắc.`,
        },
        {
          title: `Hồi 3: Văn trị Đỉnh cao & Thành tựu Kỷ nguyên (${state.userPrompt})`,
          mainEvent: `Thời kỳ hưng thịnh rực rỡ về văn hóa, giáo dục, pháp luật và kinh tế của ${state.userPrompt}.`,
        },
        {
          title: `Hồi 4: Biến cố Lịch sử & Thách thức Chuyển giao (${state.userPrompt})`,
          mainEvent: `Những biến động thời cuộc, chính sách cải cách và bước ngoặt chuyển giao quyền lực.`,
        },
        {
          title: `Hồi 5: Dấu ấn Thời đại & Di sản Trường tồn (${state.userPrompt})`,
          mainEvent: `Tổng kết những giá trị văn minh cốt lõi và di sản ngàn năm để lại cho hậu thế.`,
        },
      ];
      for (let i = 0; i < numChapters; i++) {
        const beatTemplate = dynastyBeats[Math.min(i, dynastyBeats.length - 1)];
        fallbackBeats.push({
          chapterIndex: i,
          title: numChapters === 5 ? beatTemplate.title : `Hồi ${i + 1}: ${beatTemplate.title}`,
          timeAnchor: '',
          mainEvent: beatTemplate.mainEvent,
        });
      }
    } else if (state.videoType === 'MYSTERY') {
      const mysteryBeats = [
        {
          title: `Hồi 1: Biến cố Bất ngờ & Hiện trường Uẩn khúc (${state.userPrompt})`,
          mainEvent: `Sự kiện chấn động, bối cảnh hiện trường và những uẩn khúc lịch sử ban đầu của ${state.userPrompt}.`,
        },
        {
          title: `Hồi 2: Mâu thuẫn Thời cuộc & Những Động cơ Tiềm ẩn (${state.userPrompt})`,
          mainEvent: `Phân tích bối cảnh chính trị phức tạp, xung đột quyền lực và các mối quan hệ then chốt.`,
        },
        {
          title: `Hồi 3: Giả thuyết Sử học & Những Manh mối Đầu tiên (${state.userPrompt})`,
          mainEvent: `Phân tích luận điểm, chứng cứ và lời đồn đại được sử sách ghi chép qua các thời kỳ.`,
        },
        {
          title: `Hồi 4: Giả thuyết Đối lập & Luận cứ Sử liệu Hiện đại (${state.userPrompt})`,
          mainEvent: `So sánh đối chiếu các quan điểm phản biện của giới nghiên cứu sử học hiện đại.`,
        },
        {
          title: `Hồi 5: Giải mã Lịch sử & Bài học Cho Muôn Đời (${state.userPrompt})`,
          mainEvent: `Đúc kết sự thật lịch sử, giải tỏa oan khuất và bài học chiêm nghiệm cho mai sau.`,
        },
      ];
      for (let i = 0; i < numChapters; i++) {
        const beatTemplate = mysteryBeats[Math.min(i, mysteryBeats.length - 1)];
        fallbackBeats.push({
          chapterIndex: i,
          title: numChapters === 5 ? beatTemplate.title : `Hồi ${i + 1}: ${beatTemplate.title}`,
          timeAnchor: '',
          mainEvent: beatTemplate.mainEvent,
        });
      }
    } else if (state.videoType === 'ARTIFACT') {
      const artifactBeats = [
        {
          title: `Hồi 1: Phát lộ Khảo cổ & Vị trí Khai quật (${state.userPrompt})`,
          mainEvent: `Hoàn cảnh phát hiện, vị trí địa lý và dấu tích khảo cổ đầu tiên của ${state.userPrompt}.`,
        },
        {
          title: `Hồi 2: Niên đại Lịch sử & Tinh hoa Đúc chế (${state.userPrompt})`,
          mainEvent: `Xác định niên đại, chất liệu kim khí/gốm đá và kỹ thuật chế tác đỉnh cao của cổ nhân.`,
        },
        {
          title: `Hồi 3: Giải mã Hoa văn & Biểu tượng Văn hóa (${state.userPrompt})`,
          mainEvent: `Ý nghĩa hoa văn, hình tượng con người, sinh hoạt và thế giới quan thời cổ đại.`,
        },
        {
          title: `Hồi 4: Công năng Lịch sử & Đời sống Xã hội (${state.userPrompt})`,
          mainEvent: `Vai trò của bảo vật trong đời sống tâm linh, quyền lực quân sự và cấu trúc xã hội thời kỳ đó.`,
        },
        {
          title: `Hồi 5: Giá trị Bảo tồn & Tầm vóc Bảo vật Quốc gia (${state.userPrompt})`,
          mainEvent: `Vị thế bảo vật quốc gia, niềm tự hào văn minh và công tác bảo tồn di sản cho tương lai.`,
        },
      ];
      for (let i = 0; i < numChapters; i++) {
        const beatTemplate = artifactBeats[Math.min(i, artifactBeats.length - 1)];
        fallbackBeats.push({
          chapterIndex: i,
          title: numChapters === 5 ? beatTemplate.title : `Hồi ${i + 1}: ${beatTemplate.title}`,
          timeAnchor: '',
          mainEvent: beatTemplate.mainEvent,
        });
      }
    } else {
      for (let i = 0; i < numChapters; i++) {
        fallbackBeats.push({
          chapterIndex: i,
          title: `Hồi ${i + 1}: ${i === 0 ? 'Khởi nguồn và Bối cảnh' : i === numChapters - 1 ? 'Quyết chiến và Di sản' : `Diễn biến giai đoạn ${i + 1}`} (${state.userPrompt})`,
          timeAnchor: '',
          mainEvent: `Diễn biến lịch sử phần ${i + 1} của ${state.userPrompt}`,
        });
      }
    }

    chapters = enrichMacroBeatsToChapterPlans(fallbackBeats, {
      userPrompt: state.userPrompt,
      videoType: state.videoType,
      totalTargetSec,
      secPerChapter,
      allHistoricalEntities,
      userPromptEntities,
      verifiedChunks,
      ragContext: state.ragContext,
    });
  }

  return {
    status: 'OUTLINE_CHAPTERED',
    currentStep: 3,
    chapters,
    currentChapterIndex: 0,
    runningNarrativeState: {
      previousChapterSummary: chapters[0]?.summary || '',
      establishedTone: chapters[0]?.establishedTone || 'Hùng tráng',
      introducedEntities: chapters[0]?.introducedEntities || [],
      transitionHook: chapters[0]?.transitionHook || '',
    },
    telemetryAudit,
  };
}
