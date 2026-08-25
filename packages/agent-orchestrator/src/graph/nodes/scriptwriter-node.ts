/**
 * Micro-Step 1A: Scriptwriter Agent Node
 * Generates compelling voiceover narration while preserving cross-chapter narrative flow
 */

import { callLlm, envConfig } from '@chronoviet/infra';
import { ChronoGraphState, getNodeLogger, RunningNarrativeState, TelemetryAuditEntry } from '../state.js';

function generateProportionalNarration(
  chapterTitle: string,
  chapterSummary: string,
  targetDurationSeconds: number,
  establishedTone: string,
  entities: string[],
  videoType: string = 'BIOGRAPHY'
): string {
  const paragraphs: string[] = [];
  const entityList = entities.length > 0 ? entities.join(', ') : chapterTitle;

  // Beat 1: Historical Context (~30%)
  if (videoType === 'BATTLE') {
    paragraphs.push(
      `Trong dòng chảy lịch sử hào hùng của dân tộc Việt Nam, sự kiện ${chapterTitle} mở ra một bước ngoặt oanh liệt. ${chapterSummary} Đây là thời khắc non sông đứng trước những thử thách sống còn, đòi hỏi tinh thần quật cường và sự đồng lòng của toàn thể nhân dân.`
    );
  } else if (videoType === 'ARTIFACT') {
    paragraphs.push(
      `Di sản và dấu tích thiêng liêng của ${chapterTitle} là chứng nhân vô giá cho bề dày văn hiến nước nhà. ${chapterSummary} Từng đường nét và giá trị cổ xưa phản ánh tầm vóc văn hóa đỉnh cao và trí tuệ ngàn đời của tiền nhân dựng nước.`
    );
  } else {
    paragraphs.push(
      `Trong tiến trình lịch sử ngàn năm dựng nước và giữ nước, dấu ấn của ${chapterTitle} đã ghi tạc đậm nét qua bao biến thiên của thời cuộc. ${chapterSummary} Bối cảnh thời đại đặt nền móng cho những chuyển biến sâu sắc trong lịch sử nước nhà.`
    );
  }

  // Beat 2: Action, Climax & Strategy (~50%)
  paragraphs.push(
    `Dưới sự dẫn dắt của các bậc tiền nhân tài ba như ${entityList}, toàn thể nghĩa binh và bách tính đã đồng lòng khắc phục muôn vàn gian nan. Từng sách lược mưu trí, từng trận đánh quyết liệt và quyết tâm sắt đá đã tôi luyện nên ý chí quật cường, xoay chuyển cục diện lịch sử một cách lừng lẫy và vang dội khắp bốn phương.`
  );

  if (targetDurationSeconds >= 90) {
    paragraphs.push(
      `Khí thế hào hùng ấy được tôi rèn qua từng thời khắc cam go nhất, nơi lòng quả cảm và tinh thần mưu trí tỏa sáng rực rỡ, kiến tạo nên chiến tích vẻ vang đi vào sử sách của non sông đất Việt.`
    );
  }

  if (targetDurationSeconds >= 150) {
    paragraphs.push(
      `Mỗi quyết sách mang tính chiến lược trong giai đoạn này không chỉ thể hiện tầm nhìn kiệt xuất mà còn khẳng định sức mạnh đại đoàn kết dân tộc trước mọi sóng gió thời đại.`
    );
  }

  // Beat 3: Legacy & Historical Lessons (~20%)
  paragraphs.push(
    `Nhìn lại trang sử vàng son ấy, các thế hệ mai sau càng thêm trân quý nền độc lập thái bình và những giá trị trường tồn mà cha ông đã dày công vun đắp. Di sản oanh liệt ấy mãi là nguồn sức mạnh bất diệt soi sáng cho tương lai đất nước.`
  );

  return paragraphs.join('\n\n');
}

export async function scriptwriterNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  const nodeLog = getNodeLogger(state, 'scriptwriter');
  nodeLog.info('orchestrator.scriptwriting_started', `Starting Scriptwriter Agent for ${state.chapters.length} chapters`, {
    projectId: state.projectId,
  });

  const chapterScripts: Record<number, string> = {};
  let currentNarrativeState: RunningNarrativeState = { ...state.runningNarrativeState };
  const telemetryAudit: TelemetryAuditEntry[] = [];

  const verifiedEntities = state.ragContext?.verifiedContext || [];

  for (let i = 0; i < state.chapters.length; i++) {
    const chapter = state.chapters[i];
    const chapterDurationSec = Math.max(15, chapter.targetDurationSeconds || 30);
    // 145 WPM calibration (2.4167 words/sec ~ 2.42 words/sec)
    const targetWords = Math.max(25, Math.round(chapterDurationSec * 2.42));
    const minWords = Math.round(targetWords * 0.92);
    const maxWords = Math.round(targetWords * 1.08);

    // 1. Extract RAG Grounding Facts relevant to this specific chapter
    const keyEventLower = (chapter.keyEvents || []).map((k) => k.toLowerCase().trim()).filter(Boolean);
    const chapterTitleLower = chapter.title.toLowerCase().trim();
    const chapterEntitiesLower = (chapter.introducedEntities || []).map((e) => e.toLowerCase().trim()).filter(Boolean);

    const relevantEntities = verifiedEntities.filter((e) => {
      const nameMatch = e.canonicalName?.toLowerCase().trim();
      if (!nameMatch || nameMatch.length < 2) return false;
      const inChapterEntities = chapterEntitiesLower.some((ce) => ce.includes(nameMatch) || nameMatch.includes(ce));
      const inTitle = chapterTitleLower.includes(nameMatch);
      const inEvents = keyEventLower.some((ev) => ev.includes(nameMatch) || nameMatch.includes(ev));
      const inSummary = chapter.summary.toLowerCase().includes(nameMatch);
      return inChapterEntities || inTitle || inEvents || inSummary;
    });

    // Unintroduced canonical entities not yet mentioned in prior chapters
    const unintroducedEntities = verifiedEntities.filter(
      (e) => e.canonicalName && !currentNarrativeState.introducedEntities.map((ie) => ie.toLowerCase()).includes(e.canonicalName.toLowerCase())
    );

    const selectedEntities = relevantEntities.length > 0
      ? relevantEntities.slice(0, 4)
      : (unintroducedEntities.length > 0 ? unintroducedEntities.slice(0, 3) : verifiedEntities.slice(0, 3));

    const ragGroundingText =
      selectedEntities.length > 0
        ? selectedEntities.map((e) => `- ${e.canonicalName}: ${e.summary}`).join('\n')
        : '- Dựa trên tóm tắt sự kiện của chương.';

    const systemMessage = `Bạn là Nhà biên kịch Lịch sử Chuyên nghiệp của nền tảng ChronoViet.
Nhiệm vụ: Viết lời bình dẫn chuyện (Voiceover Narration) cho từng chương video lịch sử đạt chuẩn nhịp độ 145 WPM (130–160 WPM).
QUY TẮC CẤU TRÚC 3 HỒI BẮT BUỘC (3-BEAT NARRATIVE STRUCTURE):
1. Hồi 1 - Mở cảnh (Bối cảnh lịch sử, ~30% số từ): Dẫn dắt không gian, thời gian, nguyên nhân và tiền đề lịch sử.
2. Hồi 2 - Diễn biến & Cao trào (Hành động & Sách lược, ~50% số từ): Miêu tả cụ thể biến cố, mưu lược chiến sự, nhân vật hành động và đỉnh điểm cao trào.
3. Hồi 3 - Dư âm & Bài học (Di sản ngàn đời, ~20% số từ): Đúc kết ý nghĩa thời đại, cảm xúc tự hào, bài học lịch sử và chuyển tiếp tự nhiên.

QUY TẮC BẮT BUỘC DÀNH CHO TTS:
1. TUYỆT ĐỐI KHÔNG chèn thẻ chỉ dẫn đạo diễn, âm thanh, hay sân khấu như: [Nhạc nền], (Giọng truyền cảm), (Cười), [Hình ảnh...].
2. TUYỆT ĐỐI KHÔNG chèn nhãn người nói như: "MC:", "Người dẫn chuyện:", "Lời bình:".
3. TUYỆT ĐỐI KHÔNG dùng định dạng tiêu đề Markdown như: #, ##, **, * ở đầu đoạn.
4. Chỉ xuất văn bản lời đọc thuần túy (Plain Text), liền mạch, giàu cảm xúc, chuẩn xác sử liệu.
5. Đối với sự kiện dã sử/truyền thuyết, hãy tự nhiên sử dụng các cụm từ 'theo truyền thuyết', 'tương truyền'.
6. CHUẨN XÁC SỬ LIỆU & THÂN TỘC: Tuyệt đối không tự suy diễn hoặc bịa đặt quan hệ thân tộc, năm sinh năm mất, chức tước hoặc sự kiện không có trong tư liệu sử liệu.
7. QUY TẮC ĐỌC SỐ & NIÊN HIỆU CHO GIỌNG ĐỌC AI (TTS PHONETICS):
   - Không dùng số La Mã viết tắt (ví dụ: viết "thế kỷ thứ mười" hoặc "thế kỷ mười" thay vì "thế kỷ X", "thế kỷ mười ba" thay vì "thế kỷ XIII").
   - Hạn chế chèn các chuỗi niên đại trong ngoặc đơn rườm rà như "(trị vì 1428 - 1433)" gây vấp cho giọng đọc; hãy viết thành câu văn xuôi mượt mà (ví dụ: "trị vì từ năm 1428 đến năm 1433").
   - Đảm bảo câu văn ngắt nghỉ tự nhiên, giàu âm hưởng hào hùng và trang trọng.`;

    const userMessage = `Hãy viết lời dẫn chuyện cho Chương ${i + 1}: "${chapter.title}".
Tóm tắt nội dung chương: ${chapter.summary}
Thời lượng mục tiêu: ${chapterDurationSec} giây.
MỤC TIÊU ĐỘ DÀI: BẮT BUỘC viết từ ${minWords} đến ${maxWords} từ tiếng Việt (mục tiêu chuẩn xác: ~${targetWords} từ) theo cấu trúc 3 hồi:
- Mở cảnh (~${Math.round(targetWords * 0.3)} từ): Khắc họa bối cảnh và nguyên nhân.
- Diễn biến (~${Math.round(targetWords * 0.5)} từ): Miêu tả chi tiết diễn biến, kế sách và cao trào.
- Dư âm (~${Math.round(targetWords * 0.2)} từ): Bài học lịch sử và ý nghĩa thời đại.
TUYỆT ĐỐI KHÔNG viết tóm tắt quá ngắn dưới ${minWords} từ hoặc quá dài vượt quá ${maxWords} từ.

TƯ LIỆU LỊCH SỬ XÁC THỰC TỪ CHRONO-RAG:
${ragGroundingText}

QUY TẮC LIỀN MẠCH & THỰC THỂ (NARRATIVE FLOW):
- Giọng văn chủ đạo: "${currentNarrativeState.establishedTone || 'Hùng tráng, trang trọng'}".
- Chuyển tiếp mượt mà từ câu nối trước: "${currentNarrativeState.transitionHook || 'Tiếp tục diễn biến lịch sử'}".
- Các thực thể xuất hiện trong chương này cần lồng ghép tự nhiên: [${(chapter.introducedEntities || []).join(', ') || 'Theo tóm tắt chương'}].
- Các thực thể đã giới thiệu ở chương trước: [${currentNarrativeState.introducedEntities.slice(-12).join(', ')}] (KHÔNG cần giải thích lại từ đầu danh xưng/tiểu sử).

NHẮC LẠI: Chỉ xuất văn xuôi lời bình để đọc TTS trực tiếp. Bắt đầu viết:`;

    const estimatedMaxTokens = Math.min(2048, Math.max(512, Math.round(targetWords * 2) + 256));
    let cleanedScript = '';

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

      // Sanitize any remaining stage markers or markdown noise
      cleanedScript = res.content
        .replace(/\[(?:Nhạc|Cảnh|Hình ảnh|Hiệu ứng|Âm thanh|Voiceover).*?\]/gi, '')
        .replace(/\((?:Giọng|Cười|Hào hùng|Trầm lắng|Thì thầm).*?\)/gi, '')
        .replace(/^(?:MC|Người dẫn chuyện|Lời bình|Host)\s*:\s*/gim, '')
        .replace(/^#{1,4}\s+.*$/gm, '')
        .trim();

      // Task 1.2: Selective Pacing Refinement Loop
      const words = cleanedScript.split(/\s+/).filter(Boolean);
      const wordCount = words.length;
      const durationMin = chapterDurationSec / 60;
      const actualWpm = Math.round(wordCount / durationMin);

      // Trigger single-pass delta refinement only if severe pacing deviation occurs (WPM < 125 or > 170)
      if (actualWpm < 125 || actualWpm > 170) {
        nodeLog.info('orchestrator.scriptwriter_pacing_refinement', `Pacing deviation detected for chapter ${i} (WPM=${actualWpm}, target=145, words=${wordCount}/${targetWords}). Triggering refinement pass.`, {
          chapterIndex: i,
          actualWpm,
          wordCount,
          targetWords,
        });

        const isTooShort = actualWpm < 125;
        const deltaInstruction = isTooShort
          ? `Văn bản hiện tại (${wordCount} từ) quá ngắn so với thời lượng ${chapterDurationSec}s (yêu cầu ${minWords} - ${maxWords} từ, chuẩn 145 WPM). Hãy mở rộng thêm chi tiết bối cảnh lịch sử, khắc họa sâu sắc hơn diễn biến/chiến lược và làm nổi bật dư âm ý nghĩa lịch sử để đạt đúng ~${targetWords} từ.`
          : `Văn bản hiện tại (${wordCount} từ) quá dài so với thời lượng ${chapterDurationSec}s (yêu cầu ${minWords} - ${maxWords} từ, chuẩn 145 WPM). Hãy cô đọng lại các câu văn rườm rà, lược bỏ từ ngữ dư thừa nhưng TUYỆT ĐỐI giữ nguyên toàn bộ sự kiện, nhân vật và niên đại lịch sử để đạt đúng ~${targetWords} từ.`;

        try {
          const refineRes = await callLlm({
            messages: [
              { role: 'system', content: systemMessage },
              {
                role: 'user',
                content: `Dưới đây là bản thảo lời bình hiện tại của Chương ${i + 1}:\n"""\n${cleanedScript}\n"""\n\nYÊU CẦU TINH CHỈNH TỐC ĐỘ ĐỌC (PACING CALIBRATION):\n${deltaInstruction}\nBắt buộc kết quả mới phải có độ dài từ ${minWords} đến ${maxWords} từ tiếng Việt để đọc vừa vặn trong ${chapterDurationSec} giây.\n\nChỉ xuất văn bản lời bình hoàn chỉnh sau khi tinh chỉnh:`,
              },
            ],
            temperature: 0.1,
            maxTokens: estimatedMaxTokens,
            timeoutMs: envConfig.LOCAL_LLM_TIMEOUT_MS || 60000,
          });

          const refinedCleaned = refineRes.content
            .replace(/\[(?:Nhạc|Cảnh|Hình ảnh|Hiệu ứng|Âm thanh|Voiceover).*?\]/gi, '')
            .replace(/\((?:Giọng|Cười|Hào hùng|Trầm lắng|Thì thầm).*?\)/gi, '')
            .replace(/^(?:MC|Người dẫn chuyện|Lời bình|Host)\s*:\s*/gim, '')
            .replace(/^#{1,4}\s+.*$/gm, '')
            .trim();

          if (refinedCleaned) {
            cleanedScript = refinedCleaned;
          }
        } catch (refineErr: any) {
          nodeLog.warn('orchestrator.scriptwriter_refine_failed', `Refinement pass skipped: ${refineErr.message}`);
        }
      }

      chapterScripts[i] = cleanedScript || res.content.trim();
    } catch (err: any) {
      // Eval Integrity: strict mode must not substitute canned narration
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
      chapterScripts[i] = generateProportionalNarration(
        chapter.title,
        chapter.summary,
        chapterDurationSec,
        currentNarrativeState.establishedTone,
        chapter.introducedEntities,
        state.videoType
      );
    }

    // Update narrative state (bounded to avoid token explosion)
    const combinedEntities = Array.from(
      new Set([...currentNarrativeState.introducedEntities, ...(chapter.introducedEntities || [])])
    );
    currentNarrativeState = {
      previousChapterSummary: chapter.summary,
      establishedTone: chapter.establishedTone || 'Hùng tráng',
      introducedEntities: combinedEntities.slice(-15),
      transitionHook: chapter.transitionHook || `Chuyển tiếp sang diễn biến tiếp theo của ${chapter.title}`,
    };
  }

  return {
    status: 'CHAPTER_SCRIPT_GENERATED',
    currentStep: 4,
    chapterScripts,
    runningNarrativeState: currentNarrativeState,
    telemetryAudit,
  };
}

