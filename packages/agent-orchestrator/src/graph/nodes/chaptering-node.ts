/**
 * Micro-Step 0: Chaptering & Outline Agent Node
 * Divides topic and RAG context into N Chapters (2-3 minutes each) and initializes runningNarrativeState
 */

import { ChapterPlan } from '@chronoviet/shared-spec';
import { callLlm, envConfig, parseLlmJson } from '@chronoviet/infra';
import { ChronoGraphState, getNodeLogger, TelemetryAuditEntry } from '../state.js';

/**
 * Centralized historical entity validator.
 * Filters out raw database token IDs, entity ID prefixes, ASCII slugs, pure numbers,
 * and strings without valid proper noun structure.
 */
export function isValidHistoricalEntity(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 3) return false;

  // Reject database entity ID prefixes
  if (/^(person|loc|event|doc|org|epoch|item)_/i.test(trimmed)) return false;

  // Reject pure numbers or year-only tokens (e.g. "981", "1428")
  if (/^\d+$/.test(trimmed)) return false;

  // Reject raw ASCII lowercase slugs with underscores (e.g. "le_hoan_pha_tong", "pha_tong_binh_chiem")
  if (/^[a-z0-9_]+$/.test(trimmed) && trimmed.includes('_')) return false;

  // Reject generic / structural stop phrases
  const genericStopPhrases = new Set([
    'việt nam', 'lịch sử', 'thế kỷ', 'trước công nguyên', 'công nguyên',
    'đông nam á', 'sau công nguyên', 'nhiệm vụ', 'mục tiêu', 'tư liệu',
    'chính thống', 'chrono viet', 'chrono-rag', 'chương trình', 'giai đoạn',
    'thời kỳ', 'đoạn văn', 'tổng quan', 'chi tiết', 'tóm tắt', 'nội dung',
  ]);
  if (genericStopPhrases.has(trimmed.toLowerCase())) return false;

  return true;
}

export function extractHistoricalEntitiesFromRag(ragContext?: ChronoGraphState['ragContext']): string[] {
  if (!ragContext?.verifiedContext) return [];
  const entitySet = new Set<string>();

  for (const chunk of ragContext.verifiedContext) {
    if (chunk.canonicalName && isValidHistoricalEntity(chunk.canonicalName)) {
      entitySet.add(chunk.canonicalName.trim());
    }
    if (chunk.title && isValidHistoricalEntity(chunk.title)) {
      const cleanTitle = chunk.title.replace(/\s*\(.*?\)/g, '').replace(/^(?:Tập sử liệu|Tập|Phần|Đoạn)\s*:\s*/i, '').trim();
      if (isValidHistoricalEntity(cleanTitle)) {
        entitySet.add(cleanTitle);
      }
    }
    if (Array.isArray(chunk.aliases)) {
      for (const alias of chunk.aliases) {
        if (alias && isValidHistoricalEntity(alias)) {
          entitySet.add(alias.trim());
        }
      }
    }

    // Extract capitalized Vietnamese proper nouns and historical multi-word terms from chunk summary
    if (chunk.summary) {
      // 1. Capitalized proper nouns (1-4 words)
      const nameRegex = /\b([A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ][a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+(?:\s+[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ0-9][a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ0-9]*){0,3})\b/g;
      const matches = chunk.summary.match(nameRegex);
      if (matches) {
        for (const m of matches) {
          if (isValidHistoricalEntity(m)) {
            entitySet.add(m.trim());
          }
        }
      }

      // 2. Quoted historical concepts/documents (e.g. "Bình Ngô Đại Cáo", "Hịch tướng sĩ", "Nam quốc sơn hà")
      const quoteRegex = /["“'‘]([^"”'’]{3,40})["”'’]/g;
      let qMatch: RegExpExecArray | null;
      while ((qMatch = quoteRegex.exec(chunk.summary)) !== null) {
        const qText = qMatch[1].trim();
        if (isValidHistoricalEntity(qText)) {
          entitySet.add(qText);
        }
      }
    }
  }

  if (ragContext.aliasTable) {
    for (const [key, aliases] of Object.entries(ragContext.aliasTable)) {
      if (key && isValidHistoricalEntity(key)) {
        entitySet.add(key.trim());
      }
      if (Array.isArray(aliases)) {
        for (const a of aliases) {
          if (a && isValidHistoricalEntity(a)) {
            entitySet.add(a.trim());
          }
        }
      }
    }
  }

  return Array.from(entitySet);
}


export async function chapteringNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'chaptering');
  nodeLog.info('orchestrator.chaptering_started', `Starting Chaptering Agent for topic: ${state.userPrompt}`, {
    projectId: state.projectId,
    durationMin: state.targetDurationMinutes,
  });

  const totalTargetSec = Math.max(60, Math.round((state.targetDurationMinutes || 2) * 60));
  // Calculate number of chapters according to cinematic narrative beats (each chapter ~50-75s)
  const numChapters = Math.max(2, Math.min(6, Math.round(totalTargetSec / 60)));
  const secPerChapter = Math.round(totalTargetSec / numChapters);

  const allHistoricalEntities = extractHistoricalEntitiesFromRag(state.ragContext);
  const ragSummary = state.ragContext?.verifiedContext?.map((e) => `- ${e.canonicalName}: ${e.summary}`).join('\n') || 'Không có dữ liệu chi tiết.';

  const systemMessage = `Bạn là Chaptering & Outline Agent chuyên nghiệp của nền tảng video lịch sử ChronoViet.
Nhiệm vụ: Phân chia chủ đề lịch sử thành cấu trúc CHÍNH XÁC ${numChapters} chương kịch bản hấp dẫn, mạch lạc, giàu tính điện ảnh và chuẩn xác sử liệu.
QUY TẮC BẮT BUỘC:
1. Xuất duy nhất 1 JSON object hợp lệ theo schema: { "chapters": [ ... ] } với ĐỦ ${numChapters} chương.
2. Không thêm bất kỳ văn bản giải thích nào ngoài JSON.
3. Mỗi chương BẮT BUỘC có trường "summary" viết cụ thể, súc tích (từ 25 đến 60 từ) thuật lại diễn biến lịch sử thực tế dựa trên Chrono-RAG. TUYỆT ĐỐI KHÔNG dùng câu văn mẫu hay placeholder như "Tóm tắt sự kiện...".
4. CẤU TRÚC KỊCH TÍNH & BLUEPRINT KẾT NỐI MẠCH TRUYỆN:
   - Phân bổ mạch kịch bản theo nhịp độ lịch sử điện ảnh:
     * Hồi 1 (Mở đầu): Bối cảnh lịch sử, tiền đề & nguyên nhân sâu xa.
     * Hồi 2 (Chuyển biến / Sách lược): Nguy cơ khủng hoảng, sách lược đối phó và chuẩn bị thế trận.
     * Hồi 3 (Cao trào / Quyết chiến): Trận quyết chiến, bước ngoặt mang tính định đoạt non sông.
     * Hồi kết (Di sản / Dư âm): Kết cục lịch sử, ý nghĩa thời đại, bài học và di sản ngàn đời.
   - BẮT BUỘC cung cấp "entryHook" (câu mở đầu kết nối), "climaxFocus" (trọng tâm kịch tính) và "exitHook" (câu kết gợi mở tiếp theo) cho từng chương để đảm bảo mạch truyện liền mạch khi viết kịch bản song song.
5. PHÂN BỔ TOÀN BỘ THỰC THỂ LỊCH SỬ (CHRONOLOGICAL ENTITY DISTRIBUTION):
   - Hãy phân bổ danh sách nhân vật, địa danh, trận đánh, hiện vật từ Chrono-RAG vào trường "introducedEntities" của tất cả ${numChapters} chương theo đúng diễn biến thời gian.
   - TUYỆT ĐỐI KHÔNG dồn toàn bộ thực thể vào Chương 1; các chương sau tiếp tục giới thiệu các nhân vật, tướng lĩnh, địa bàn chiến sự hoặc di sản tương ứng.
6. ĐỊNH DẠNG JSON AN TOÀN:
   - Dùng dấu nháy đơn '...' cho các câu trích dẫn bên trong chuỗi text.`;

  const userContent = `Chủ đề: "${state.userPrompt}"
Thể loại: ${state.videoType}
Số lượng chương yêu cầu: BẮT BUỘC đúng ${numChapters} chương.
Thời lượng mỗi chương: ~${secPerChapter} giây (Tổng thời lượng: ${totalTargetSec} giây).

Danh sách thực thể lịch sử từ Chrono-RAG cần phân bổ:
${allHistoricalEntities.join(', ')}

Dữ liệu lịch sử đã kiểm chứng từ Chrono-RAG:
${ragSummary}

CẤU TRÚC SCHEMA JSON BẮT BUỘC:
{
  "chapters": [
    {
      "chapterIndex": 0,
      "title": "Tên hồi kịch bản (ví dụ: Hồi 1: Bối cảnh và Nguy cơ non sông)",
      "summary": "Tóm tắt thực tế các sự kiện, bối cảnh diễn ra trong hồi này dựa trên tư liệu RAG (tối thiểu 25 ký tự, không dùng placeholder)",
      "targetDurationSeconds": ${secPerChapter},
      "keyEvents": ["Sự kiện lịch sử cụ thể 1", "Sự kiện lịch sử cụ thể 2"],
      "introducedEntities": ["Tên thực thể lịch sử tương ứng giai đoạn này"],
      "entryHook": "Ý tưởng hoặc câu mở đầu kết nối với bối cảnh thời cuộc",
      "climaxFocus": "Trọng tâm kịch tính hoặc quyết sách quan trọng nhất trong hồi này",
      "exitHook": "Ý tưởng hoặc câu chuyển tiếp mượt mà sang hồi kế tiếp",
      "transitionHook": "Câu nối gợi mở sang hồi tiếp theo",
      "establishedTone": "Hào hùng, trang trọng"
    }
  ]
}`;

  let chapters: ChapterPlan[] = [];
  const telemetryAudit: TelemetryAuditEntry[] = [];
  const verifiedChunks = state.ragContext?.verifiedContext || [];

  try {
    const res = await callLlm({
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      responseFormat: 'json_object',
      timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
    });

    const parsed = parseLlmJson(res.content);
    const chapterArray = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.chapters))
        ? parsed.chapters
        : (parsed ? [parsed] : []);
    chapters = chapterArray.map((c: any, idx: number) => ({
      chapterIndex: idx,
      title: c.title || `Hồi ${idx + 1}: ${state.userPrompt}`,
      summary: c.summary || '',
      targetDurationSeconds: Number(c.targetDurationSeconds) || secPerChapter,
      keyEvents: Array.isArray(c.keyEvents) && c.keyEvents.length > 0 ? c.keyEvents : [state.userPrompt],
      introducedEntities: Array.isArray(c.introducedEntities) && c.introducedEntities.length > 0
        ? c.introducedEntities.filter(isValidHistoricalEntity)
        : allHistoricalEntities.slice(idx * 2, (idx + 1) * 2),
      entryHook: c.entryHook || (idx === 0 ? `Khởi nguồn từ biến động thời cuộc của ${state.userPrompt}` : `Nối tiếp cục diện lịch sử`),
      exitHook: c.exitHook || c.transitionHook || (idx < numChapters - 1 ? `Mở ra bước ngoặt tiếp theo trong tiến trình lịch sử` : `Để lại di sản và bài học ngàn đời`),
      climaxFocus: c.climaxFocus || (Array.isArray(c.keyEvents) && c.keyEvents[0] ? c.keyEvents[0] : state.userPrompt),
      transitionHook: c.transitionHook || c.exitHook || '',
      establishedTone: c.establishedTone || 'Hùng tráng',
    }));

    // Post-generation validation & enrichment gate
    const placeholderPattern = /tóm tắt sự kiện|nội dung phần|sự kiện chính|phần \d+|placeholder/i;
    const entitiesPerChapter = Math.max(1, Math.ceil(allHistoricalEntities.length / Math.max(1, chapters.length)));

    chapters.forEach((c, idx) => {
      const isPlaceholderSummary =
        !c.summary ||
        c.summary.trim().length < 25 ||
        placeholderPattern.test(c.summary);

      if (isPlaceholderSummary) {
        const matchingChunk = verifiedChunks[idx] || verifiedChunks[idx % verifiedChunks.length];
        if (matchingChunk && matchingChunk.summary) {
          c.summary = `${matchingChunk.canonicalName}: ${matchingChunk.summary}`;
        } else {
          c.summary = `Bối cảnh và diễn biến lịch sử giai đoạn ${idx + 1} của chủ đề ${state.userPrompt}, khắc họa tinh thần quật cường và sách lược của tiền nhân.`;
        }
      }

      if (!c.introducedEntities || c.introducedEntities.length === 0) {
        c.introducedEntities = allHistoricalEntities.slice(idx * entitiesPerChapter, (idx + 1) * entitiesPerChapter);
      }

      // Filter any placeholder key events
      c.keyEvents = (c.keyEvents || []).filter(
        (k) => !placeholderPattern.test(k) && k.trim().length > 3
      );
      if (c.keyEvents.length === 0) {
        c.keyEvents = [c.title || state.userPrompt];
      }

      if (!c.entryHook) {
        c.entryHook = idx === 0 ? `Mở đầu dòng chảy lịch sử ${state.userPrompt}` : `Tiếp tục diễn biến hào hùng`;
      }
      if (!c.exitHook) {
        c.exitHook = idx < chapters.length - 1 ? `Chuyển sang hồi tiếp theo` : `Khép lại trang sử vẻ vang`;
      }
      if (!c.climaxFocus) {
        c.climaxFocus = c.keyEvents[0] || state.userPrompt;
      }
      c.transitionHook = c.exitHook;
    });

    // Ensure full chapter count coverage if LLM generated fewer than requested
    if (chapters.length < numChapters) {
      const needed = numChapters - chapters.length;
      const startIdx = chapters.length;
      for (let i = 0; i < needed; i++) {
        const idx = startIdx + i;
        const chapterEntities = allHistoricalEntities.slice(idx * entitiesPerChapter, (idx + 1) * entitiesPerChapter);
        const matchingChunk = verifiedChunks[idx] || verifiedChunks[idx % verifiedChunks.length];
        const fallbackSummary = matchingChunk?.summary
          ? `${matchingChunk.canonicalName}: ${matchingChunk.summary}`
          : `Diễn biến chi tiết và dấu ấn lịch sử phần ${idx + 1} của ${state.userPrompt}.`;

        chapters.push({
          chapterIndex: idx,
          title: `Hồi ${idx + 1}: Diễn biến và Quyết chiến (${state.userPrompt})`,
          summary: fallbackSummary,
          targetDurationSeconds: secPerChapter,
          keyEvents: [`Giai đoạn ${idx + 1} của ${state.userPrompt}`],
          introducedEntities: chapterEntities.length > 0 ? chapterEntities : allHistoricalEntities.slice(0, 3),
          entryHook: `Tiếp tục dòng chảy lịch sử phần ${idx + 1}`,
          exitHook: idx < numChapters - 1 ? `Mở ra diễn biến phần ${idx + 2}` : `Khắc sâu di sản muôn đời`,
          climaxFocus: `Quyết chiến tại giai đoạn ${idx + 1}`,
          transitionHook: `Tiếp tục diễn biến lịch sử...`,
          establishedTone: 'Hào hùng, trang trọng',
        });
      }
    }

    const allocatedTotal = chapters.reduce((sum, c) => sum + (c.targetDurationSeconds || 0), 0);
    if (allocatedTotal === 0 || Math.abs(allocatedTotal - totalTargetSec) / totalTargetSec > 0.05) {
      const perChapSec = Math.round(totalTargetSec / chapters.length);
      chapters.forEach((c, idx) => {
        c.targetDurationSeconds =
          idx === chapters.length - 1
            ? totalTargetSec - perChapSec * (chapters.length - 1)
            : perChapSec;
      });
    }
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
    // Deterministic fallback chapters enriched with real verified context
    const entitiesPerChapter = Math.max(1, Math.ceil(allHistoricalEntities.length / numChapters));
    for (let i = 0; i < numChapters; i++) {
      const chapterEntities = allHistoricalEntities.slice(i * entitiesPerChapter, (i + 1) * entitiesPerChapter);
      const matchingChunk = verifiedChunks[i] || verifiedChunks[i % verifiedChunks.length];
      const chapterSummary = matchingChunk?.summary
        ? `${matchingChunk.canonicalName}: ${matchingChunk.summary}`
        : `Diễn biến chi tiết phần ${i + 1} của sự kiện lịch sử ${state.userPrompt}.`;

      chapters.push({
        chapterIndex: i,
        title: `Hồi ${i + 1}: Khởi nguồn và Diễn biến (${state.userPrompt})`,
        summary: chapterSummary,
        targetDurationSeconds: secPerChapter,
        keyEvents: [`Giai đoạn ${i + 1} của ${state.userPrompt}`],
        introducedEntities: chapterEntities.length > 0 ? chapterEntities : allHistoricalEntities.slice(0, 3),
        transitionHook: `Tiếp theo là cao trào phần ${i + 2}...`,
        establishedTone: 'Hùng tráng và sâu lắng',
      });
    }
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
