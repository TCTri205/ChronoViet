/**
 * Micro-Step 0: Chaptering & Outline Agent Node
 * Divides topic and RAG context into N Chapters (2-3 minutes each) and initializes runningNarrativeState
 */

import { callLlm, ChapterPlan, createLogger, envConfig } from '@chronoviet/shared-spec';
import { ChronoGraphState } from '../state.js';

const log = createLogger({ service: 'agent-orchestrator' });

export async function chapteringNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  log.info('orchestrator.chaptering_started', `Starting Chaptering Agent for topic: ${state.userPrompt}`, {
    projectId: state.projectId,
    durationMin: state.targetDurationMinutes,
  });

  const totalTargetSec = state.targetDurationMinutes * 60;
  // Calculate number of chapters (each chapter 120-180 seconds, minimum 1 chapter)
  const numChapters = Math.max(1, Math.round(totalTargetSec / 150));
  const secPerChapter = Math.round(totalTargetSec / numChapters);

  const ragSummary = state.ragContext?.verifiedContext?.map((e) => `${e.canonicalName}: ${e.summary}`).join('\n') || '';

  const systemPrompt = `Bạn là Chaptering & Outline Agent chuyên nghiệp của ChronoViet.
Nhiệm vụ: Phân chia chủ đề lịch sử thành ${numChapters} chương kịch bản hấp dẫn, mạch lạc, giàu tính điện ảnh.
Chủ đề: "${state.userPrompt}"
Thể loại: ${state.videoType}
Thời lượng mỗi chương: ~${secPerChapter} giây.

Dữ liệu lịch sử đã kiểm chứng từ RAG:
${ragSummary}

Hãy xuất danh sách ${numChapters} chương theo cấu trúc JSON mảng:
[
  {
    "chapterIndex": 0,
    "title": "Tên chương ngắn gọn",
    "summary": "Tóm tắt sự kiện trong chương",
    "targetDurationSeconds": ${secPerChapter},
    "keyEvents": ["Sự kiện 1", "Sự kiện 2"],
    "introducedEntities": ["Nhân vật/Địa danh"],
    "transitionHook": "Mối nối chuyển cảnh sang chương sau",
    "establishedTone": "Hào hùng, trang trọng"
  }
]`;

  let chapters: ChapterPlan[] = [];

  try {
    const res = await callLlm({
      messages: [{ role: 'user', content: systemPrompt }],
      temperature: 0.2,
      responseFormat: 'json_object',
    });

    const parsed = JSON.parse(res.content);
    const chapterArray = Array.isArray(parsed) ? parsed : parsed.chapters || [parsed];
    chapters = chapterArray.map((c: any, idx: number) => ({
      chapterIndex: idx,
      title: c.title || `Hồi ${idx + 1}: ${state.userPrompt}`,
      summary: c.summary || `Nội dung phần ${idx + 1}`,
      targetDurationSeconds: Number(c.targetDurationSeconds) || secPerChapter,
      keyEvents: Array.isArray(c.keyEvents) ? c.keyEvents : [state.userPrompt],
      introducedEntities: Array.isArray(c.introducedEntities) ? c.introducedEntities : [],
      transitionHook: c.transitionHook || '',
      establishedTone: c.establishedTone || 'Hùng tráng',
    }));
  } catch (err: any) {
    // Eval Integrity: strict mode must not substitute deterministic template chapters
    if (envConfig.EVAL_STRICT) {
      throw err;
    }
    log.warn('orchestrator.chaptering_llm_fallback', `LLM call fallback for chaptering: ${err.message}`);
    // Deterministic fallback chapters
    for (let i = 0; i < numChapters; i++) {
      chapters.push({
        chapterIndex: i,
        title: `Hồi ${i + 1}: Khởi nguồn và Diễn biến (${state.userPrompt})`,
        summary: `Diễn biến chi tiết phần ${i + 1} của sự kiện lịch sử ${state.userPrompt}.`,
        targetDurationSeconds: secPerChapter,
        keyEvents: [`Giai đoạn ${i + 1} của ${state.userPrompt}`],
        introducedEntities: state.ragContext?.verifiedContext?.map((e) => e.canonicalName).slice(0, 3) || [],
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
  };
}
