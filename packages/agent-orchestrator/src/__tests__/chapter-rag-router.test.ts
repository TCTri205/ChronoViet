import { describe, it, expect } from 'vitest';
import {
  extractYearsFromText,
  extractTimeRangeFromChapter,
  scoreChunkForChapter,
  routeChunksToChapters,
  ChapterRAGRouter,
} from '../research/chapter-rag-router.js';
import { ChapterPlan, HistoricalContextEntity } from '@chronoviet/shared-spec';

describe('Chapter RAG Router & Temporal Evidence Partitioning', () => {
  it('should extract historical years accurately from text', () => {
    const text = 'Từ năm 1890 đến 1911 tại làng Sen và Huế, sau đó năm 1945 đọc Tuyên ngôn Độc lập.';
    const years = extractYearsFromText(text);
    expect(years).toEqual([1890, 1911, 1945]);
  });

  it('should extract time range from chapter metadata', () => {
    const chapter1: ChapterPlan = {
      chapterIndex: 0,
      title: 'Hồi 1: Tuổi trẻ và Quê hương (1890 - 1911)',
      summary: 'Thời niên thiếu của Nguyễn Sinh Cung tại Nam Đàn, Nghệ An.',
      targetDurationSeconds: 60,
      keyEvents: ['Năm 1890 sinh ra tại làng Sen', 'Năm 1911 rời bến Nhà Rồng'],
      introducedEntities: [],
    };

    const range = extractTimeRangeFromChapter(chapter1);
    expect(range.startYear).toBe(1890);
    expect(range.endYear).toBe(1911);
  });

  it('should partition RAG chunks strictly by chronological and semantic relevance', () => {
    const chapters: ChapterPlan[] = [
      {
        chapterIndex: 0,
        title: 'Hồi 1: Thuở Thiếu Thời (1890 - 1911)',
        summary: 'Thời niên thiếu và quê hương làng Sen của Nguyễn Sinh Cung.',
        targetDurationSeconds: 60,
        keyEvents: ['Sinh năm 1890', 'Rời bến Nhà Rồng 1911'],
        introducedEntities: ['Nguyễn Sinh Cung', 'Nguyễn Sinh Sắc'],
      },
      {
        chapterIndex: 1,
        title: 'Hồi 2: Bôn Ba Hải Ngoại (1911 - 1941)',
        summary: 'Hành trình 30 năm tìm đường cứu nước qua Pháp, Anh, Mỹ, Liên Xô.',
        targetDurationSeconds: 60,
        keyEvents: ['Năm 1911 lên tàu Đô đốc Latouche-Tréville', 'Năm 1920 đọc Sơ thảo Luận cương', 'Năm 1941 về Pác Bó'],
        introducedEntities: ['Văn Ba', 'Nguyễn Ái Quốc'],
      },
      {
        chapterIndex: 2,
        title: 'Hồi 3: Kháng Chiến và Lãnh Đạo (1941 - 1954)',
        summary: 'Cách mạng Tháng Tám 1945 và Chiến thắng Điện Biên Phủ 1954.',
        targetDurationSeconds: 60,
        keyEvents: ['Năm 1945 Tuyên ngôn Độc lập', 'Năm 1954 Chiến dịch Điện Biên Phủ'],
        introducedEntities: ['Chủ tịch Hồ Chí Minh', 'Võ Nguyên Giáp'],
      },
    ];

    const mockChunks: HistoricalContextEntity[] = [
      {
        entityId: 'chunk_early_life',
        canonicalName: 'Tuổi thơ làng Sen 1890-1911',
        aliases: ['Nguyễn Sinh Cung', 'Nguyễn Sinh Sắc'],
        summary: 'Nguyễn Sinh Cung sinh năm 1890 tại làng Sen, Nam Đàn, Nghệ An. Thân sinh là cụ Phó bảng Nguyễn Sinh Sắc. Năm 1911 người lấy tên Văn Ba.',
        citations: ['Đại Nam Thực Lục'],
        confidenceScore: 1.0,
      },
      {
        entityId: 'chunk_journey_abroad',
        canonicalName: 'Hành trình 30 năm cứu nước 1911-1941',
        aliases: ['Văn Ba', 'Nguyễn Ái Quốc'],
        summary: 'Từ năm 1911 đến 1941, Văn Ba mang tên Nguyễn Ái Quốc hoạt động tại Pháp, Anh, Liên Xô. Năm 1941 trở về Pác Bó.',
        citations: ['Hồ Chí Minh Toàn Tập'],
        confidenceScore: 1.0,
      },
      {
        entityId: 'chunk_revolution_1945_1954',
        canonicalName: 'Cách mạng tháng Tám và Điện Biên Phủ 1945-1954',
        aliases: ['Chủ tịch Hồ Chí Minh', 'Võ Nguyên Giáp'],
        summary: 'Năm 1945, Hồ Chí Minh đọc Tuyên ngôn Độc lập tại Ba Đình. Năm 1954 chỉ đạo chiến dịch Điện Biên Phủ toàn thắng.',
        citations: ['Lịch sử Quân sự Việt Nam'],
        confidenceScore: 1.0,
      },
    ];

    const router = new ChapterRAGRouter();
    const routedChapters = router.route(chapters, mockChunks);

    expect(routedChapters.length).toBe(3);

    // Chapter 0 should get chunk_early_life as top chunk
    expect(routedChapters[0].chapterChunks?.[0].entityId).toBe('chunk_early_life');

    // Chapter 1 should get chunk_journey_abroad as top chunk
    expect(routedChapters[1].chapterChunks?.[0].entityId).toBe('chunk_journey_abroad');

    // Chapter 2 should get chunk_revolution_1945_1954 as top chunk
    expect(routedChapters[2].chapterChunks?.[0].entityId).toBe('chunk_revolution_1945_1954');
  });

  it('should penalize out-of-order prior phase chunks in monotonic routing', () => {
    const chapterFinal: ChapterPlan = {
      chapterIndex: 3,
      title: 'Hồi 4: Đại thắng Mùa xuân Kỷ Dậu (1789)',
      summary: 'Quang Trung chỉ huy đại phá quân Mãn Thanh tại Thăng Long năm 1789.',
      targetDurationSeconds: 60,
      keyEvents: ['Năm 1789 đại thắng Kỷ Dậu'],
      introducedEntities: ['Quang Trung'],
    };

    const priorRecruitmentChunk: HistoricalContextEntity = {
      entityId: 'chunk_recruitment_1786',
      canonicalName: 'Tuyển quân Tây Sơn năm 1786',
      aliases: [],
      citations: [],
      summary: 'Năm 1786 Nguyễn Huệ tiến hành tuyển quân và xây dựng lực lượng tại Phú Xuân.',
      confidenceScore: 1.0,
    };

    const battleClimaxChunk: HistoricalContextEntity = {
      entityId: 'chunk_battle_1789',
      canonicalName: 'Đại phá quân Thanh 1789',
      aliases: [],
      citations: [],
      summary: 'Mùa xuân năm 1789 nghĩa quân Tây Sơn đánh tan 29 vạn quân Mãn Thanh tại Ngọc Hồi Đống Đa.',
      confidenceScore: 1.0,
    };

    const timeRange = extractTimeRangeFromChapter(chapterFinal);
    const scorePrior = scoreChunkForChapter(priorRecruitmentChunk, chapterFinal, timeRange, 1789);
    const scoreClimax = scoreChunkForChapter(battleClimaxChunk, chapterFinal, timeRange, 1789);

    expect(scoreClimax).toBeGreaterThan(scorePrior);
    expect(scorePrior).toBeLessThan(0);
  });
});
