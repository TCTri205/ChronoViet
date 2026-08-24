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

  // Opening paragraph adapted by video type
  if (videoType === 'BATTLE') {
    paragraphs.push(
      `Trong dòng chảy lịch sử đầy tự hào của dân tộc, sự kiện ${chapterTitle} là một bước ngoặt oanh liệt. ${chapterSummary}`
    );
  } else if (videoType === 'ARTIFACT') {
    paragraphs.push(
      `Di sản và dấu tích của sự kiện ${chapterTitle} là chứng nhân vô giá cho bề dày văn hiến nước nhà. ${chapterSummary}`
    );
  } else {
    paragraphs.push(
      `Trong dòng chảy lịch sử Việt Nam, dấu ấn của ${chapterTitle} ghi đậm nét qua bao thăng trầm thời đại. ${chapterSummary}`
    );
  }

  // Body paragraphs
  const entityList = entities.length > 0 ? entities.join(', ') : chapterTitle;
  paragraphs.push(
    `Dưới sự dẫn dắt của các bậc tiền nhân như ${entityList}, mọi thử thách đều được khắc phục bằng ý chí kiên định và tinh thần đoàn kết sâu sắc của toàn thể nhân dân.`
  );

  if (targetDurationSeconds >= 90) {
    paragraphs.push(
      `Từng diễn biến và quyết sách trong giai đoạn này đều để lại những bài học sâu sắc cho các thế hệ mai sau, mở ra bước tiến quan trọng trong tiến trình dựng nước và giữ nước.`
    );
  }

  if (targetDurationSeconds >= 150) {
    paragraphs.push(
      `Nhìn lại trang sử ấy, chúng ta càng thêm trân trọng những giá trị trường tồn và công lao to lớn mà cha ông đã dày công vun đắp cho nền độc lập và thái bình của non sông.`
    );
  }

  // Closing
  paragraphs.push(
    `Bức tranh lịch sử tiếp tục mở ra những diễn biến đầy ý nghĩa trong chặng đường tiếp theo.`
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
    const targetWords = Math.round(chapter.targetDurationSeconds * 2.5);

    // 1. Extract RAG Grounding Facts relevant to this specific chapter
    const keyEventLower = (chapter.keyEvents || []).map((k) => k.toLowerCase());
    const chapterTitleLower = chapter.title.toLowerCase();

    const relevantEntities = verifiedEntities.filter((e) => {
      const nameMatch = e.canonicalName.toLowerCase();
      const inTitle = chapterTitleLower.includes(nameMatch);
      const inEvents = keyEventLower.some((ev) => ev.includes(nameMatch) || nameMatch.includes(ev));
      const inSummary = chapter.summary.toLowerCase().includes(nameMatch);
      return inTitle || inEvents || inSummary;
    });

    const selectedEntities = relevantEntities.length > 0 ? relevantEntities.slice(0, 4) : verifiedEntities.slice(0, 3);
    const ragGroundingText =
      selectedEntities.length > 0
        ? selectedEntities.map((e) => `- ${e.canonicalName}: ${e.summary}`).join('\n')
        : '- Dựa trên tóm tắt sự kiện của chương.';

    const systemMessage = `Bạn là Nhà biên kịch Lịch sử Chuyên nghiệp của nền tảng ChronoViet.
Nhiệm vụ: Viết lời bình dẫn chuyện (Voiceover Narration) cho từng chương video lịch sử.
QUY TẮC BẮT BUỘC DÀNH CHO TTS:
1. TUYỆT ĐỐI KHÔNG chèn thẻ chỉ dẫn đạo diễn, âm thanh, hay sân khấu như: [Nhạc nền], (Giọng truyền cảm), (Cười), [Hình ảnh...].
2. TUYỆT ĐỐI KHÔNG chèn nhãn người nói như: "MC:", "Người dẫn chuyện:", "Lời bình:".
3. TUYỆT ĐỐI KHÔNG dùng định dạng tiêu đề Markdown như: #, ##, **, * ở đầu đoạn.
4. Chỉ xuất văn bản lời đọc thuần túy (Plain Text), liền mạch, giàu cảm xúc, chuẩn xác sử liệu.
5. Đối với sự kiện dã sử/truyền thuyết, hãy tự nhiên sử dụng các cụm từ 'theo truyền thuyết', 'tương truyền'.
6. CHUẨN XÁC SỬ LIỆU & THÂN TỘC: Tuyệt đối không tự suy diễn hoặc bịa đặt quan hệ thân tộc, năm sinh năm mất, chức tước hoặc sự kiện không có trong tư liệu sử liệu.`;

    const userMessage = `Hãy viết lời dẫn chuyện cho Chương ${i + 1}: "${chapter.title}".
Tóm tắt nội dung chương: ${chapter.summary}
Thời lượng mục tiêu: ${chapter.targetDurationSeconds} giây (bắt buộc viết đầy đủ từ ${Math.round(targetWords * 0.85)} đến ${Math.round(targetWords * 1.15)} từ tiếng Việt để đọc vừa vặn trong ${chapter.targetDurationSeconds} giây, tuyệt đối không viết tóm tắt quá ngắn).

TƯ LIỆU LỊCH SỬ XÁC THỰC TỪ CHRONO-RAG:
${ragGroundingText}

QUY TẮC LIỀN MẠCH (NARRATIVE FLOW):
- Giọng văn chủ đạo: "${currentNarrativeState.establishedTone || 'Hùng tráng, trang trọng'}".
- Chuyển tiếp mượt mà từ câu nối trước: "${currentNarrativeState.transitionHook || 'Tiếp tục diễn biến lịch sử'}".
- Các thực thể đã giới thiệu ở chương trước: [${currentNarrativeState.introducedEntities.slice(-12).join(', ')}] (KHÔNG cần giải thích lại từ đầu danh xưng/tiểu sử).

NHẮC LẠI: Chỉ xuất văn xuôi lời bình để đọc TTS trực tiếp. Bắt đầu viết:`;

    const estimatedMaxTokens = Math.min(2048, Math.max(512, Math.round(targetWords * 2) + 256));

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
      let cleanedScript = res.content
        .replace(/\[(?:Nhạc|Cảnh|Hình ảnh|Hiệu ứng|Âm thanh|Voiceover).*?\]/gi, '')
        .replace(/\((?:Giọng|Cười|Hào hùng|Trầm lắng|Thì thầm).*?\)/gi, '')
        .replace(/^(?:MC|Người dẫn chuyện|Lời bình|Host)\s*:\s*/gim, '')
        .replace(/^#{1,4}\s+.*$/gm, '')
        .trim();

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
        chapter.targetDurationSeconds,
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
