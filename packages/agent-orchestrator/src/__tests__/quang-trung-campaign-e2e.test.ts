import { describe, it, expect, vi } from 'vitest';
import { classifyVideoDomain, isPureImageLayout } from '@chronoviet/shared-spec';
import { chapteringNode } from '../graph/nodes/chaptering-node.js';
import { scriptwriterNode, synthesizeDeterministicHistoricalScript } from '../graph/nodes/scriptwriter-node.js';
import { segmenterNode, splitScriptIntoSentences } from '../graph/nodes/segmenter-node.js';
import { ChronoGraphState } from '../graph/state.js';

// Mock infra callLlm for deterministic verification
vi.mock('@chronoviet/infra', async (importOriginal) => {
  const original = await importOriginal<typeof import('@chronoviet/infra')>();
  return {
    ...original,
    callLlm: vi.fn().mockImplementation(async ({ messages, responseFormat }) => {
      const prompt = messages[0]?.content || '';
      const userMsg = messages.find((m: any) => m.role === 'user')?.content || '';

      if (userMsg.includes('Quang Trung') || userMsg.includes('quân Thanh')) {
        if (responseFormat === 'json_object' || prompt.includes('JSON')) {
          return {
            content: JSON.stringify({
              chapterBeats: [
                {
                  chapterIndex: 0,
                  title: 'Hồi 1: Nguy biến Lịch sử & Hội quân Tam Điệp',
                  timeAnchor: 'Tháng 11/1788',
                  mainEvent: 'Tôn Sĩ Nghị xua 29 vạn quân Mãn Thanh tràn sang chiếm đóng Thăng Long; quân Tây Sơn chủ động lui về phòng tuyến Tam Điệp.',
                },
                {
                  chapterIndex: 1,
                  title: 'Hồi 2: Lên ngôi Hoàng đế & Tuyển mộ Binh sĩ',
                  timeAnchor: 'Tháng 12/1788',
                  mainEvent: 'Nguyễn Huệ lên ngôi Hoàng đế lấy niên hiệu Quang Trung tại Phú Xuân, thần tốc ra Nghệ An tuyển thêm mười vạn quân.',
                },
                {
                  chapterIndex: 2,
                  title: 'Hồi 3: Khao quân Ăn Tết Sớm & Kế sách 5 Đạo Binh',
                  timeAnchor: 'Cuối tháng Chạp 1788',
                  mainEvent: 'Quang Trung khao quân ăn Tết sớm tại Tam Điệp, đọc lời hịch đanh thép và chia quân làm 5 đạo áp sát sào huyệt giặc.',
                },
                {
                  chapterIndex: 3,
                  title: 'Hồi 4: Bão lửa Quyết chiến Ngọc Hồi - Đống Đa',
                  timeAnchor: 'Mùng 3 đến Mùng 5 Tết Kỷ Dậu 1789',
                  mainEvent: 'Đột kích công phá đồn Hà Hồi, hạ đồn Ngọc Hồi, tiêu diệt sầm Nghi Đống ở Đống Đa giải phóng kinh thành.',
                },
                {
                  chapterIndex: 4,
                  title: 'Hồi 5: Đại thắng Khải hoàn & Tầm vóc Lịch sử',
                  timeAnchor: 'Mùng 5 Tết Kỷ Dậu 1789',
                  mainEvent: 'Quang Trung tiến vào Thăng Long trong tấm áo bào sạm khói súng, kết thúc oanh liệt cuộc kháng chiến chống Mãn Thanh.',
                },
              ],
            }),
          };
        }
        return {
          content:
            'Hoàng đế Quang Trung chỉ huy cuộc hành quân thần tốc đánh tan 29 vạn quân Mãn Thanh mùa xuân Kỷ Dậu 1789. Nghĩa quân giải phóng Thăng Long trong niềm hân hoan tột cùng của muôn dân.',
        };
      }

      return {
        content: JSON.stringify({
          chapterBeats: [],
        }),
      };
    }),
  };
});

describe('Quang Trung 1789 Campaign E2E Pipeline Integration Test', () => {
  const userPrompt = 'Tóm tắt cuộc hành quân thần tốc của Hoàng đế Quang Trung đại phá 29 vạn quân Mãn Thanh vào mùa xuân Kỷ Dậu 1789';

  it('1. should dynamically classify user prompt into BATTLE domain', () => {
    const videoType = classifyVideoDomain(userPrompt);
    expect(videoType).toBe('BATTLE');
  });

  it('2. should generate 5-beat campaign arc without childhood biography tropes', async () => {
    const state: Partial<ChronoGraphState> = {
      projectId: 'proj_quang_trung_e2e',
      userPrompt,
      targetDurationMinutes: 4,
      videoType: 'BATTLE',
      templateId: 'HISTORICAL_DOCUMENTARY',
      ragContext: {
        verifiedContext: [
          {
            entityId: 'chunk_tam_diep',
            canonicalName: 'Phòng tuyến Tam Điệp Biện Sơn 1788',
            aliases: [],
            citations: [],
            summary: 'Ngô Thì Nhậm và Ngô Văn Sở tổ chức phòng tuyến Tam Điệp Biện Sơn chờ viện binh từ Phú Xuân.',
            confidenceScore: 1.0,
          },
          {
            entityId: 'chunk_ngoc_hoi_dong_da',
            canonicalName: 'Chiến thắng Ngọc Hồi Đống Đa 1789',
            aliases: [],
            citations: [],
            summary: 'Sáng mùng 5 Tết Kỷ Dậu 1789, nghĩa quân Tây Sơn đánh tan đồn Ngọc Hồi và Đống Đa, tiến vào Thăng Long.',
            confidenceScore: 1.0,
          },
        ],
        aliasTable: {},
        citations: [],
      },
    };

    const chapterRes = await chapteringNode(state as ChronoGraphState);
    expect(chapterRes.chapters).toBeDefined();
    expect(chapterRes.chapters?.length).toBe(5);

    const titles = chapterRes.chapters!.map((c) => c.title);
    for (const title of titles) {
      expect(title).not.toContain('Thời niên thiếu');
      expect(title).not.toContain('Thuở nhỏ');
      expect(title).not.toContain('Lý tưởng ban đầu');
    }

    expect(titles[0]).toContain('Tam Điệp');
    expect(titles[3]).toContain('Ngọc Hồi');
  });

  it('3. should generate zero-duplicate script and heal clause boundaries', async () => {
    const fragmentedScript = `Hoàng đế Quang Trung chia quân làm 5 đạo:\ntiền, hậu, tả, hữu và trung quân.\nTất cả đồng loạt tiến công tiêu diệt 29 vạn quân Mãn Thanh vào mùa xuân Kỷ Dậu 1789.`;
    const healedSentences = splitScriptIntoSentences(fragmentedScript);

    expect(healedSentences.length).toBe(2);
    expect(healedSentences[0]).toContain('chia quân làm 5 đạo: tiền, hậu, tả, hữu và trung quân.');

    const synthesized = synthesizeDeterministicHistoricalScript(
      'Bão lửa Ngọc Hồi',
      'Hoàng đế Quang Trung chia quân làm 5 đạo áp sát Ngọc Hồi.',
      [
        {
          summary: 'Hoàng đế Quang Trung chia quân làm 5 đạo áp sát Ngọc Hồi. Mờ sáng mùng 5 Tết quân ta san phẳng đồn giặc.',
        },
      ],
      60,
      145
    );

    const matches = synthesized.match(/Hoàng đế Quang Trung chia quân làm 5 đạo áp sát Ngọc Hồi/g);
    expect(matches?.length).toBe(1);
    expect(synthesized.endsWith('.')).toBe(true);
  });

  it('4. should enforce >= 80% image scenes and <= 20% pure code layouts in segmentation', async () => {
    const chapterScripts: Record<number, string> = {
      0: 'Tháng 11 năm 1788, Tôn Sĩ Nghị xua 29 vạn quân Mãn Thanh tràn sang chiếm đóng Thăng Long. Quân Tây Sơn lui về giữ phòng tuyến Tam Điệp Biện Sơn.',
      1: 'Nguyễn Huệ lên ngôi Hoàng đế tại Phú Xuân lấy niên hiệu Quang Trung. Sau đó người thần tốc hành quân ra Nghệ An tuyển thêm mười vạn quân tinh nhuệ.',
      2: 'Tại phòng tuyến Tam Điệp, Quang Trung mở tiệc khao quân đón Tết sớm. Người tuyên đọc lời hịch xuất quân đanh thép hiệu triệu tướng sĩ.',
      3: 'Mờ sáng mùng 5 Tết Kỷ Dậu, đại quân Tây Sơn đồng loạt công phá đồn Ngọc Hồi. Đô đốc Đặng Tiến Đông bất ngờ đột kích sào huyệt Đống Đa làm tướng giặc thắt cổ tự tử.',
      4: 'Trưa mùng 5 Tết, Hoàng đế Quang Trung ngự trên lưng voi tiến vào thành Thăng Long. Áo bào sạm đen khói súng, đất nước hoàn toàn sạch bóng quân xâm lược.',
    };

    const chapters = Object.keys(chapterScripts).map((k) => ({
      chapterIndex: Number(k),
      title: `Hồi ${Number(k) + 1}`,
      summary: chapterScripts[Number(k)],
      targetDurationSeconds: 60,
      keyEvents: [],
      introducedEntities: ['Quang Trung'],
    }));

    const mockState: Partial<ChronoGraphState> = {
      projectId: 'proj_quang_trung_scenes',
      userPrompt,
      videoType: 'BATTLE',
      templateId: 'HISTORICAL_DOCUMENTARY',
      chapters,
      chapterScripts,
    };

    const segResult = await segmenterNode(mockState as ChronoGraphState);
    expect(segResult.scenes).toBeDefined();
    expect(segResult.scenes!.length).toBeGreaterThan(0);

    const totalScenes = segResult.scenes!.length;
    const imageScenes = segResult.scenes!.filter((s) => isPureImageLayout(s.layoutMode));
    const pureCodeScenes = segResult.scenes!.filter((s) => !isPureImageLayout(s.layoutMode));

    const imageRatio = imageScenes.length / totalScenes;
    const pureCodeRatio = pureCodeScenes.length / totalScenes;

    // Must satisfy Visual-First Criteria: >= 80% images, <= 20% pure code
    expect(imageRatio).toBeGreaterThanOrEqual(0.80);
    expect(pureCodeRatio).toBeLessThanOrEqual(0.20);
  });
});
