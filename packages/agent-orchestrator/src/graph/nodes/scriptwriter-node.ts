/**
 * Micro-Step 1A: Scriptwriter Agent Node
 * Generates compelling voiceover narration while preserving cross-chapter narrative flow
 */

import { callLlm, createLogger, envConfig } from '@chronoviet/shared-spec';
import { ChronoGraphState, RunningNarrativeState } from '../state.js';

const log = createLogger({ service: 'agent-orchestrator' });

function generateProportionalNarration(
  chapterTitle: string,
  chapterSummary: string,
  targetDurationSeconds: number,
  establishedTone: string,
  entities: string[]
): string {
  const targetWords = Math.round(targetDurationSeconds * 2.5);
  const paragraphs: string[] = [];

  // Opening paragraph
  paragraphs.push(
    `Vào thời kỳ lịch sử hào hùng của dân tộc Đại Việt, sự kiện ${chapterTitle} đã ghi dấu ấn sâu đậm trong dòng chảy nghìn năm dựng nước và giữ nước. ${chapterSummary}`
  );

  // Body paragraphs to fill duration accurately
  const entityList = entities.length > 0 ? entities.join(', ') : chapterTitle;
  paragraphs.push(
    `Khí thế quật cường và tinh thần đoàn kết của quân dân ta dưới sự lãnh đạo tài tình của các bậc tiền nhân như ${entityList} đã tạo nên sức mạnh vô song. Từng tấc đất, từng dòng sông quê hương đều thấm đượm lòng yêu nước và ý chí tự cường bất khuất trước mọi phong ba bão táp của thời đại.`
  );

  if (targetDurationSeconds >= 90) {
    paragraphs.push(
      `Sự mưu trí, dũng cảm trong từng sách lược chỉ huy và ý chí quyết chiến đã dẫn đến những chuyển biến mang tính bước ngoặt. Những chiến công oanh liệt nơi sa trường không chỉ đập tan mưu đồ xâm lăng mà còn khẳng định chủ quyền thiêng liêng, mở ra thời kỳ thái bình thịnh trị cho muôn dân trăm họ.`
    );
  }

  if (targetDurationSeconds >= 150) {
    paragraphs.push(
      `Nhìn lại trang sử vàng son ấy, thế hệ con cháu hôm nay càng thêm tự hào về truyền thống bất khuất của cha ông. Những bài học quý giá về tinh thần độc lập, tự chủ và đức hi sinh vì non sông xã tắc mãi là ngọn đuốc sáng soi đường cho các thế hệ tương lai vững bước.`
    );
  }

  // Closing
  paragraphs.push(
    `Khép lại giai đoạn đầy tự hào này, bức tranh lịch sử tiếp tục mở ra những trang mới rạng ngời của non sông gấm vóc Việt Nam.`
  );

  return paragraphs.join('\n\n');
}

export async function scriptwriterNode(state: ChronoGraphState): Promise<Partial<ChronoGraphState>> {
  log.info('orchestrator.scriptwriting_started', `Starting Scriptwriter Agent for ${state.chapters.length} chapters`, {
    projectId: state.projectId,
  });

  const chapterScripts: Record<number, string> = {};
  let currentNarrativeState: RunningNarrativeState = { ...state.runningNarrativeState };

  for (let i = 0; i < state.chapters.length; i++) {
    const chapter = state.chapters[i];
    const targetWords = Math.round(chapter.targetDurationSeconds * 2.5);

    const prompt = `Bạn là Nhà biên kịch Lịch sử Sử thi của ChronoViet.
Hãy viết lời bình dẫn truyện (Voiceover Narration) cho Chương ${i + 1}: "${chapter.title}".
Tóm tắt chương: ${chapter.summary}
Thời lượng mục tiêu: ${chapter.targetDurationSeconds} giây (~${targetWords} từ tiếng Việt).

QUY TẮC LIỀN MẠCH (NARRATIVE FLOW):
- Giọng văn đồng nhất: "${currentNarrativeState.establishedTone}".
- Nối tiếp chuyển cảnh từ chương trước: "${currentNarrativeState.transitionHook}".
- Các thực thể đã giới thiệu ở chương trước: [${currentNarrativeState.introducedEntities.join(', ')}] (KHÔNG cần giải thích lại từ đầu danh xưng/tiểu sử).

Hãy viết lời thoại liền mạch, hùng tráng, chuẩn xác lịch sử:`;

    try {
      const res = await callLlm({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });
      chapterScripts[i] = res.content.trim();
    } catch (err: any) {
      // Eval Integrity: strict mode must not substitute canned narration
      if (envConfig.EVAL_STRICT) {
        throw err;
      }
      log.warn('orchestrator.scriptwriter_llm_fallback', `LLM call fallback for chapter ${i}: ${err.message}`);
      chapterScripts[i] = generateProportionalNarration(
        chapter.title,
        chapter.summary,
        chapter.targetDurationSeconds,
        currentNarrativeState.establishedTone,
        chapter.introducedEntities
      );
    }

    // Update narrative state
    currentNarrativeState = {
      previousChapterSummary: chapter.summary,
      establishedTone: chapter.establishedTone || 'Hùng tráng',
      introducedEntities: Array.from(new Set([...currentNarrativeState.introducedEntities, ...chapter.introducedEntities])),
      transitionHook: chapter.transitionHook || `Chuyển tiếp sang diễn biến tiếp theo của ${chapter.title}`,
    };
  }

  return {
    status: 'CHAPTER_SCRIPT_GENERATED',
    currentStep: 4,
    chapterScripts,
    runningNarrativeState: currentNarrativeState,
  };
}
