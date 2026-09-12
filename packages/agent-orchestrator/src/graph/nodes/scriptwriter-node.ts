/**
 * Micro-Step 1A: Scriptwriter Agent Node
 * Generates compelling voiceover narration while preserving cross-chapter narrative flow
 */

import { callLlm, envConfig } from '@chronoviet/infra';
import { ChronoGraphState, getNodeLogger, RunningNarrativeState, TelemetryAuditEntry } from '../state.js';
import { deduplicateRepetitiveText } from '../../guardrails/stream-dedup.js';
import { extractHistoricalEntitiesFromRag, isValidHistoricalEntity } from './chaptering-node.js';

function sanitizeVoiceoverScript(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText
    // Remove direction / sound tags
    .replace(/\[(?:Nhạc|Cảnh|Hình ảnh|Hiệu ứng|Âm thanh|Voiceover).*?\]/gi, '')
    .replace(/\((?:Giọng|Cười|Hào hùng|Trầm lắng|Thì thầm|Bi tráng).*?\)/gi, '')
    // Remove speaker labels
    .replace(/^(?:MC|Người dẫn chuyện|Lời bình|Host)\s*:\s*/gim, '')
    // Remove markdown headers like #, ##, ###
    .replace(/^#{1,4}\s+.*$/gm, '')
    // Remove bold/markdown section labels like **Hồi 1 - Mở cảnh:** or Hồi 1: or Mở cảnh:
    .replace(/(?:\*{1,3})?(?:Theo truyền thuyết,\s*)?(?:Hồi|Phần|Chương)\s*\d+[^:\n*]*(?:\*{1,3})?:?\s*/gim, '')
    .replace(/(?:\*{1,3})?(?:Mở cảnh|Diễn biến(?:\s*&\s*Cao trào)?|Cao trào|Dư âm(?:\s*&\s*Bài học)?|Bài học)[^:\n*]*(?:\*{1,3})?:?\s*/gim, '')
    .replace(/\(~?\d+\s*từ\)/gi, '')
    // Remove leading standalone tone markers like "Hào hùng, trang trọng." or "Hào hùng."
    .replace(/^(?:\*{1,3})?(?:Hào hùng|Trang trọng|Hùng tráng|Trầm lắng|Bi tráng)(?:,\s*(?:trang trọng|hào hùng|sâu lắng))?[.:]?(?:\*{1,3})?\s*/gim, '')
    // Remove markdown bold/italic tags around remaining standalone section names
    .replace(/\*\*(?:Bối cảnh|Diễn biến|Chiến lược|Dư âm|Kết luận)\*\*:?\s*/gi, '')
    .trim();

  // Remove trailing incomplete transition phrases or connector prompts
  cleaned = cleaned
    .replace(/(?:Tiếp theo là|Mối nối chuyển cảnh:?|Chuyển sang hồi tiếp theo:?|Tiếp tục diễn biến:?)\s*$/gi, '')
    .trim();

  // Deduplicate repeated sentences and paragraphs
  cleaned = deduplicateRepetitiveText(cleaned);

  return cleaned.trim();
}

function synthesizeDeterministicHistoricalScript(
  chapterTitle: string,
  chapterSummary: string,
  selectedChunks: any[],
  targetDurationSeconds: number
): string {
  const sentences: string[] = [];

  // 1. Chapter context from verified outline summary
  if (chapterSummary && chapterSummary.trim()) {
    sentences.push(chapterSummary.trim());
  }

  // 2. Verified historical facts from RAG chunks formatted with quotation syntax and citation
  for (const chunk of selectedChunks) {
    const canonical = chunk.canonicalName || 'Sử liệu';
    const summary = chunk.summary || chunk.content || '';
    const citation = (chunk.citations && chunk.citations[0]) || 'Chính sử';

    if (summary) {
      const cleanSummary = summary.replace(/["“”'‘’]/g, '').trim();
      sentences.push(`Theo ${citation}, ghi chép về ${canonical}: "${cleanSummary}".`);
    }
  }

  // 3. Fallback factual synthesis if no chunks present
  if (sentences.length === 0) {
    sentences.push(`Giai đoạn lịch sử ${chapterTitle} ghi nhận những chuyển biến trọng đại trong tiến trình dựng nước và giữ nước.`);
  }

  return sentences.join(' ');
}

function computeEpochBounds(
  verifiedEntities: any[],
  userPrompt: string
): { epochDesc: string; minYear?: number; maxYear?: number } {
  const timeStarts = (verifiedEntities || [])
    .map((e) => e.timeStart)
    .filter((t): t is number => typeof t === 'number');
  const timeEnds = (verifiedEntities || [])
    .map((e) => e.timeEnd)
    .filter((t): t is number => typeof t === 'number');
  const allYears = [...timeStarts, ...timeEnds];
  const dynasties = Array.from(
    new Set((verifiedEntities || []).map((e) => e.dynasty).filter(Boolean))
  );

  let minYear = allYears.length > 0 ? Math.min(...allYears) : undefined;
  let maxYear = allYears.length > 0 ? Math.max(...allYears) : undefined;

  // Fallback: extract year from userPrompt if present
  if (minYear === undefined) {
    const yearMatch = userPrompt.match(/\b(1?\d{3,4})\b/);
    if (yearMatch) {
      const yr = parseInt(yearMatch[1], 10);
      if (yr >= 100 && yr <= 2100) {
        minYear = yr;
        maxYear = yr;
      }
    }
  }

  function formatYear(y: number): string {
    return y < 0 ? `${Math.abs(y)} TCN` : `năm ${y}`;
  }

  let epochDesc = '';
  if (minYear !== undefined && maxYear !== undefined) {
    epochDesc =
      minYear === maxYear
        ? minYear < 0
          ? `${Math.abs(minYear)} TCN`
          : `Năm ${minYear}`
        : `Giai đoạn ${formatYear(minYear)} – ${formatYear(maxYear)}`;
  }
  if (dynasties.length > 0) {
    epochDesc += epochDesc
      ? ` (Triều đại / Bối cảnh: ${dynasties.join(', ')})`
      : `Triều đại: ${dynasties.join(', ')}`;
  }
  if (!epochDesc) {
    epochDesc = `Bối cảnh lịch sử chính thống của chủ đề "${userPrompt}"`;
  }

  return { epochDesc, minYear, maxYear };
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
  const epochInfo = computeEpochBounds(verifiedEntities, state.userPrompt);
  const targetWpm = state.templateId === 'QUICK_SHORTS' ? 160 : (state.templateId === 'MODERN_NEWS' ? 150 : 145);

  const isLocalSingleSlot = envConfig.USE_LOCAL_LLM && (envConfig.LOCAL_LLM_MAX_CONCURRENCY || 1) <= 1;
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

    // Rank verified chunks by relevance to chapter title, summary, key events, and entities
    const relevantChunks = verifiedEntities.filter((chunk) => {
      const summaryLower = (chunk.summary || '').toLowerCase();
      const titleLower = (chunk.title || '').toLowerCase();
      const nameLower = (chunk.canonicalName || '').toLowerCase();

      const inChapterEntities = chapterEntitiesLower.some((ce) => summaryLower.includes(ce) || titleLower.includes(ce) || nameLower.includes(ce));
      const inTitle = chapterTitleLower.split(/\s+/).some((w) => w.length > 3 && summaryLower.includes(w));
      const inEvents = keyEventLower.some((ev) => summaryLower.includes(ev) || ev.includes(nameLower));
      const inSummary = chapter.summary.toLowerCase().split(/\s+/).some((w) => w.length > 4 && summaryLower.includes(w));
      return inChapterEntities || inTitle || inEvents || inSummary;
    });

    // Combine relevant chunks and general verified chunks, deduplicating by chunkId / content snippet
    const chunkCandidates = [
      ...relevantChunks,
      ...verifiedEntities,
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
        ? selectedChunks.map((e) => `- [${e.title || e.canonicalName}]: ${e.summary}`).join('\n\n')
        : '- Dựa trên tóm tắt sự kiện của chương.';

    const systemMessage = `Bạn là Nhà biên kịch Lịch sử Chuyên nghiệp của nền tảng ChronoViet.
Nhiệm vụ: Viết lời bình dẫn chuyện (Voiceover Narration) cho từng chương video lịch sử đạt chuẩn nhịp độ ${targetWpm} WPM.
QUY TẮC CẤU TRÚC KỊCH BẢN 1-PASS CHUẨN XÁC:
- Đoạn mở đầu (~30% số từ, đúng ${numOpeningSentences} câu): Dẫn dắt không gian, thời gian, nguyên nhân và tiền đề lịch sử theo entry hook.
- Đoạn diễn biến & cao trào (~50% số từ, đúng ${numClimaxSentences} câu): Miêu tả chi tiết mưu lược, biến cố, hành động của các nhân vật và quyết sách lịch sử.
- Đoạn đúc kết & dư âm (~20% số từ, đúng ${numLegacySentences} câu): Khắc họa ý nghĩa thời đại, cảm xúc hào hùng, bài học lịch sử và chuyển tiếp mượt mà theo exit hook.
- TỔNG CỘNG: Viết chính xác ${targetSentences} câu văn xuôi trọn vẹn (khoảng 16-22 từ/câu) để tổng độ dài đạt đúng ${minWords} - ${maxWords} từ tiếng Việt.

QUY TẮC BẢO TOÀN NIÊN ĐẠI & TRÁNH HALLUCINATION:
- Niên đại trọng tâm của video: ${epochInfo.epochDesc}.
- TUYỆT ĐỐI KHÔNG tự ý đưa vào các nhân vật, tướng lĩnh hoặc triều đại thuộc các thế kỷ khác không thuộc bối cảnh này (ví dụ: không đưa nhân vật nhà Trần hay Hậu Lê vào bối cảnh thời Tiền Lê/Đinh/Lý).
- Cho phép đề cập bối cảnh tiền đề hoặc hệ quả trong phạm vi ±30 năm cùng dòng lịch sử, nhưng nghiêm cấm vượt thế kỷ hoặc đảo lộn diễn biến lịch sử.

QUY TẮC BẮT BUỘC DÀNH CHO GIỌNG ĐỌC TTS (LOCAL LLM COMPLIANCE):
1. TUYỆT ĐỐI KHÔNG chèn tiêu đề đoạn, KHÔNG viết các nhãn cấu trúc như: "Hồi 1:", "Mở cảnh:", "Diễn biến:", "Cao trào:", "Dư âm:", "Bài học:", "Hào hùng, trang trọng." vào văn bản.
2. TUYỆT ĐỐI KHÔNG chèn thẻ chỉ dẫn sân khấu như: [Nhạc nền], (Giọng truyền cảm), (Cười), [Hình ảnh...].
3. TUYỆT ĐỐI KHÔNG chèn nhãn người nói như: "MC:", "Người dẫn chuyện:", "Lời bình:".
4. TUYỆT ĐỐI KHÔNG dùng định dạng tiêu đề Markdown như: #, ##, **, * ở đầu đoạn.
5. Chỉ xuất văn bản lời đọc thuần túy (Plain Text), liền mạch, giàu cảm xúc, chuẩn xác sử liệu.
6. BẮT BUỘC lồng ghép tự nhiên các tên nhân vật, tướng lĩnh, địa danh, niên đại, vũ khí và sự kiện lịch sử từ tư liệu RAG.
7. QUY TẮC ĐỌC SỐ & NIÊN HIỆU:
   - Không dùng số La Mã viết tắt (viết "thế kỷ thứ mười" thay vì "thế kỷ X").
   - Viết thành câu văn xuôi mượt mà (ví dụ: "từ năm 1428 đến năm 1433" thay vì "(1428 - 1433)").`;

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

    const allHistoricalEntities = extractHistoricalEntitiesFromRag(state.ragContext, state.userPrompt);
    const targetChapterEntities = Array.from(
      new Set([
        ...(chapter.introducedEntities || []),
        ...chunkEntityNames,
        ...allHistoricalEntities,
      ])
    ).filter(isValidHistoricalEntity);

    const entryHook = chapter.entryHook || (i === 0 ? 'Mở đầu bối cảnh lịch sử' : `Tiếp nối diễn biến phần trước`);
    const exitHook = chapter.exitHook || chapter.transitionHook || (i < state.chapters.length - 1 ? 'Chuyển sang hồi tiếp theo' : 'Khép lại trang sử hào hùng');
    const climaxFocus = chapter.climaxFocus || (chapter.keyEvents && chapter.keyEvents[0]) || chapter.title;
    const entityList = targetChapterEntities.length > 0 ? targetChapterEntities.join(', ') : state.userPrompt;

    let transitionDirective = '';
    if (i > 0 && previousChapterActualExit) {
      transitionDirective = `\nQUY TẮC CHUYỂN TIẾP VÀ KẾ THỪA MẠCH TRUYỆN:
NGỮ CẢNH CHUYỂN TIẾP (2 câu cuối của chương trước): "${previousChapterActualExit}".
QUY TẮC CHUYỂN TIẾP BẮT BUỘC: TUYỆT ĐỐI KHÔNG lặp lại nguyên văn câu chữ, KHÔNG mở đầu bằng việc tóm tắt lại các sự kiện vừa nêu trên. Bắt đầu ngay bằng hành động, tình thế hoặc quyết sách tiếp theo của nhân vật trong chương này. (LƯU Ý: Các nhân vật lịch sử, địa danh và niên đại trọng tâm vẫn tiếp tục xuất hiện tự nhiên xuyên suốt các chương).\n`;
    }

    const userMessage = `Hãy viết lời dẫn chuyện cho Chương ${i + 1}: "${chapter.title}".
Chủ đề video chính: "${state.userPrompt}" (Thể loại: ${state.videoType})
Bối cảnh & Niên đại bắt buộc: ${epochInfo.epochDesc}
Tóm tắt nội dung chương: ${chapter.summary}
Thời lượng mục tiêu: ${chapterDurationSec} giây.
${transitionDirective}
BLUEPRINT MẠCH TRUYỆN:
- Ý mở đầu (Entry Hook): "${entryHook}".
- Trọng tâm kịch tính (Climax Focus): "${climaxFocus}".
- Ý chuyển tiếp kết thúc (Exit Hook): "${exitHook}".
- Giọng văn chủ đạo: ${chapter.establishedTone || state.runningNarrativeState?.establishedTone || 'Hào hùng, trang trọng'}.

YÊU CẦU ĐỘ DÀI VÀ CẤU TRÚC CÂU (BẮT BUỘC ~${targetWords} từ, dải chuẩn ${targetWpm} WPM: ${minWords} - ${maxWords} từ, tổng cộng khoảng ${targetSentences} câu):
- Đoạn 1: Mở đầu (Bối cảnh & Tiền đề): đúng ${numOpeningSentences} câu (~${wordsContext} từ).
- Đoạn 2: Diễn biến & Cao trào (Sách lược, biến cố, hành động): đúng ${numClimaxSentences} câu (~${wordsClimax} từ).
- Đoạn 3: Đúc kết & Dư âm (Ý nghĩa lịch sử, bài học): đúng ${numLegacySentences} câu (~${wordsLegacy} từ).
Mỗi câu văn phải viết trọn vẹn (khoảng 16-22 từ/câu), giàu tính điện ảnh và chuẩn xác sử liệu.

DANH SÁCH THỰC THỂ SỬ LIỆU BẮT BUỘC LỒNG GHÉP VÀO LỜI BÌNH (Tên nhân vật, tướng lĩnh, đối thủ, địa danh, trận đánh, vũ khí, mưu lược):
${entityList}

TƯ LIỆU LỊCH SỬ XÁC THỰC TỪ CHRONO-RAG:
${ragGroundingText}

QUY TẮC MẠCH TRUYỆN:
- BẮT BUỘC lồng ghép tự nhiên và chính xác các tên nhân vật, tướng lĩnh, địa danh được liệt kê ở trên.
- TUYỆT ĐỐI KHÔNG chuyển sang các nhân vật hoặc triều đại lịch sử khác ngoài bối cảnh "${epochInfo.epochDesc}".

NHẮC LẠI: Chỉ xuất văn xuôi thuần túy để đọc TTS trực tiếp, KHÔNG viết bất kỳ tiêu đề hoặc nhãn cấu trúc nào. Bắt đầu viết:`;

    const estimatedMaxTokens = Math.min(2048, Math.max(512, Math.round(targetWords * 3) + 512));
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
        const reducedRagGrounding = selectedChunks.slice(0, 2).map((c) => `- ${c.canonicalName}: ${c.summary}`).join('\n');
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

      cleanedScript = sanitizeVoiceoverScript(rawContent);

      // Calibrated Pacing Refinement Loop: trigger when WPM deviates outside +-12% of template target WPM
      const words = cleanedScript.split(/\s+/).filter(Boolean);
      const wordCount = words.length;
      const durationMin = chapterDurationSec / 60;
      const actualWpm = durationMin > 0 ? Math.round(wordCount / durationMin) : 0;
      const minWpmAllowed = Math.round(targetWpm * 0.88);
      const maxWpmAllowed = Math.round(targetWpm * 1.12);

      if (cleanedScript && (actualWpm < minWpmAllowed || actualWpm > maxWpmAllowed)) {
        nodeLog.info('orchestrator.scriptwriter_pacing_refinement', `Pacing deviation detected for chapter ${i} (WPM=${actualWpm}, target=${targetWpm}, band=${minWpmAllowed}-${maxWpmAllowed}). Triggering refinement pass.`, {
          chapterIndex: i,
          actualWpm,
          wordCount,
          targetWords,
        });

        const isTooShort = actualWpm < minWpmAllowed;
        const deltaInstruction = isTooShort
          ? `Văn bản hiện tại (${wordCount} từ) quá ngắn so với thời lượng ${chapterDurationSec}s (yêu cầu ${minWords} - ${maxWords} từ, chuẩn ${targetWpm} WPM). Hãy mở rộng thêm chi tiết bối cảnh lịch sử, khắc họa sâu sắc hơn diễn biến/chiến lược và làm nổi bật dư âm ý nghĩa lịch sử để đạt đúng ~${targetWords} từ.`
          : `Văn bản hiện tại (${wordCount} từ) quá dài so với thời lượng ${chapterDurationSec}s (yêu cầu ${minWords} - ${maxWords} từ, chuẩn ${targetWpm} WPM). Hãy cô đọng lại các câu văn rườm rà, lược bỏ từ ngữ dư thừa nhưng TUYỆT ĐỐI giữ nguyên toàn bộ sự kiện, nhân vật và niên đại lịch sử để đạt đúng ~${targetWords} từ.`;

        try {
          const refineRes = await callLlm({
            messages: [
              { role: 'system', content: systemMessage },
              {
                role: 'user',
                content: `Dưới đây là bản thảo lời bình hiện tại của Chương ${i + 1}:\n"""\n${cleanedScript}\n"""\n\nYÊU CẦU TINH CHỈNH TỐC ĐỘ ĐỌC (PACING CALIBRATION):\n${deltaInstruction}\nBắt buộc kết quả mới phải có độ dài từ ${minWords} đến ${maxWords} từ tiếng Việt để đọc vừa vặn trong ${chapterDurationSec} giây.\n\nChỉ xuất văn bản lời bình hoàn chỉnh (văn xuôi thuần túy, KHÔNG tiêu đề) sau khi tinh chỉnh:`,
              },
            ],
            temperature: 0.1,
            maxTokens: estimatedMaxTokens,
            timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
          });

          const refinedCleaned = sanitizeVoiceoverScript(refineRes.content);
          if (refinedCleaned && refinedCleaned.length > 30) {
            cleanedScript = refinedCleaned;
          }
        } catch (refineErr: any) {
          nodeLog.warn('orchestrator.scriptwriter_refine_failed', `Refinement pass skipped: ${refineErr.message}`);
        }
      }

      const finalScript = cleanedScript || sanitizeVoiceoverScript(rawContent);
      if (!finalScript) {
        if (envConfig.EVAL_STRICT) {
          throw new Error(`Scriptwriter failed to generate narration for chapter ${i} in EVAL_STRICT mode.`);
        }
        return synthesizeDeterministicHistoricalScript(
          chapter.title,
          chapter.summary,
          selectedChunks,
          chapterDurationSec
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
        chapter.summary,
        selectedChunks,
        chapterDurationSec
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
  };

  return {
    status: 'CHAPTER_SCRIPT_GENERATED',
    currentStep: 4,
    chapterScripts,
    runningNarrativeState: aggregatedNarrativeState,
    telemetryAudit,
  };
}

