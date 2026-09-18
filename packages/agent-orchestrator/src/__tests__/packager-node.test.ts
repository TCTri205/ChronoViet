import { describe, it, expect } from 'vitest';
import { resolveDynamicVersusSides, packagerNode } from '../graph/nodes/packager-node.js';
import { ChronoGraphState } from '../graph/state.js';

describe('Packager Node & Dynamic Versus Resolver', () => {
  describe('resolveDynamicVersusSides Domain & Entity Guardrails', () => {
    it('returns undefined for BIOGRAPHY domain regardless of keywords', () => {
      const sides = resolveDynamicVersusSides(
        'Cuộc đối đầu hai bên trên bàn đàm phán ngoại giao.',
        [],
        'Chủ tịch Hồ Chí Minh',
        'BIOGRAPHY',
        'Chủ tịch Hồ Chí Minh'
      );
      expect(sides).toBeUndefined();
    });

    it('returns undefined for ARTIFACT domain', () => {
      const sides = resolveDynamicVersusSides(
        'Bảo vật đối đầu với thời gian hai bên.',
        [],
        'Trống đồng Ngọc Lũ',
        'ARTIFACT',
        'Trống đồng Ngọc Lũ'
      );
      expect(sides).toBeUndefined();
    });

    it('resolves valid opposing sides for BATTLE with verified forces', () => {
      const sides = resolveDynamicVersusSides(
        'Vua Quang Trung tiến quân thần tốc đại phá 29 vạn quân Mãn Thanh.',
        [],
        'Quang Trung',
        'BATTLE',
        'Trận Ngọc Hồi Đống Đa'
      );
      expect(sides).toBeDefined();
      expect(sides?.leftSide.name).toBe('Quang Trung');
      expect(sides?.rightSide.name).toContain('Mãn Thanh');
    });

    it('never misidentifies modern leaders as opposing feudal generals', () => {
      // "Minh" in "Hồ Chí Minh" should NOT pair with Liễu Thăng or Vương Thông
      const sides = resolveDynamicVersusSides(
        'Hồ Chí Minh thành lập Mặt trận Việt Minh.',
        [],
        'Hồ Chí Minh',
        'BATTLE',
        'Chủ tịch Hồ Chí Minh'
      );
      // Because there is no verified imperialist enemy (like Pháp/Mỹ) mentioned here, sides should be undefined
      expect(sides).toBeUndefined();
    });

    it('resolves adversary from Knowledge Graph triples when available', () => {
      const triples = [
        {
          source: 'person_tran_hung_dao',
          relation: 'LED_BY',
          target: 'org_quan_nguyen_mong',
          confidence: 0.95,
        },
      ];
      const sides = resolveDynamicVersusSides(
        'Trần Hưng Đạo lãnh đạo quân dân chặn đứng vó ngựa xâm lăng.',
        triples,
        'Trần Hưng Đạo',
        'BATTLE',
        'Kháng chiến chống quân Nguyên Mông'
      );
      expect(sides).toBeDefined();
      expect(sides?.leftSide.name).toBe('Trần Hưng Đạo');
      expect(sides?.rightSide.name).toContain('Nguyên Mông');
    });
  });

  describe('packagerNode Auto-Demotion & Neutral Overlays', () => {
    it('auto-demotes VERSUS_CARD to HISTORICAL_FRAME when asset exists but opposing sides are invalid', async () => {
      const mockState: Partial<ChronoGraphState> = {
        projectId: 'test_packager_demote_001',
        videoType: 'BIOGRAPHY',
        userPrompt: 'Chủ tịch Hồ Chí Minh',
        scenes: [
          {
            sceneId: 'sc_demote_01',
            sceneIndex: 0,
            chapterIndex: 0,
            voiceoverText: 'Chủ tịch Hồ Chí Minh sinh năm 1890 tại làng Sen quê cha.',
            layoutMode: 'VERSUS_CARD',
            contentType: 'IMAGE',
            targetDurationSeconds: 5,
            searchKeywords: ['Hồ Chí Minh'],
            selectedAsset: {
              candidateId: 'c1',
              imageUrl: 'https://example.com/asset.jpg',
              localPath: '/tmp/asset.jpg',
              license: 'PUBLIC_DOMAIN',
              candidateBatch: 1,
            },
            candidates: [],
            usePureCodeFallback: false,
          },
        ],
        chapters: [
          {
            chapterIndex: 0,
            title: 'Thời Niên Thiếu',
            summary: 'Bác Hồ sinh ra tại quê hương Nghệ An.',
            targetDurationSeconds: 30,
            keyEvents: ['Sinh năm 1890'],
            introducedEntities: ['Chủ tịch Hồ Chí Minh'],
          },
        ],
      };

      const result = await packagerNode(mockState as ChronoGraphState);
      expect(result.status).toBe('COMPLETED');
      expect(result.videoProps).toBeDefined();
      const scene = result.videoProps?.timeline[0];
      expect(scene?.layoutMode).toBe('HISTORICAL_FRAME');
      expect(scene?.overlayData?.leftSide).toBeUndefined();
      expect(scene?.overlayData?.rightSide).toBeUndefined();
    });

    it('generates neutral dignified milestones without military clichés for biography', async () => {
      const mockState: Partial<ChronoGraphState> = {
        projectId: 'test_packager_milestones_001',
        videoType: 'BIOGRAPHY',
        userPrompt: 'Chủ tịch Hồ Chí Minh',
        scenes: [
          {
            sceneId: 'sc_milestone_01',
            sceneIndex: 0,
            chapterIndex: 0,
            voiceoverText: 'Năm 1890 đánh dấu sự ra đời của Chủ tịch Hồ Chí Minh tại Nghệ An.',
            layoutMode: 'TIMELINE_CHRONO',
            contentType: 'PURE_CODE',
            targetDurationSeconds: 5,
            searchKeywords: ['Hồ Chí Minh', '1890'],
            candidates: [],
            usePureCodeFallback: true,
          },
        ],
        chapters: [
          {
            chapterIndex: 0,
            title: 'Xuất Thân & Niên Thiếu',
            summary: 'Chủ tịch Hồ Chí Minh sinh ra trong một gia đình nhà nho yêu nước.',
            targetDurationSeconds: 30,
            keyEvents: ['Sinh năm 1890'],
            introducedEntities: ['Chủ tịch Hồ Chí Minh'],
          },
        ],
      };

      const result = await packagerNode(mockState as ChronoGraphState);
      const scene = result.videoProps?.timeline[0];
      expect(scene?.layoutMode).toBe('TIMELINE_CHRONO');
      const milestones = scene?.overlayData?.milestones;
      expect(milestones).toBeDefined();
      expect(milestones!.length).toBeGreaterThan(0);

      // Verify no military clichés exist in milestones
      const allMilestoneText = milestones!.map((m) => `${m.title} ${m.desc || ''}`).join(' ');
      expect(allMilestoneText).not.toContain('Quét sạch quân xâm lược');
      expect(allMilestoneText).not.toContain('Đập tan đồn lũy');
      expect(allMilestoneText).not.toContain('Toàn thắng');
      expect(allMilestoneText).toContain('Cột mốc lịch sử');
    });

    it('resolves quote author from canonical entities rather than naive regexes', async () => {
      const mockState: Partial<ChronoGraphState> = {
        projectId: 'test_packager_quote_author_001',
        videoType: 'DYNASTY',
        userPrompt: 'Bình Ngô Đại Cáo',
        scenes: [
          {
            sceneId: 'sc_quote_01',
            sceneIndex: 0,
            chapterIndex: 0,
            voiceoverText: 'Áng thiên cổ hùng văn: “Việc nhân nghĩa cốt ở yên dân, quân điếu phạt trước lo trừ bạo”.',
            layoutMode: 'QUOTE_SLIDE',
            contentType: 'PURE_CODE',
            targetDurationSeconds: 5,
            searchKeywords: ['Bình Ngô đại cáo'],
            candidates: [],
            usePureCodeFallback: true,
          },
        ],
        chapters: [
          {
            chapterIndex: 0,
            title: 'Bình Ngô Đại Cáo',
            summary: 'Tác phẩm bất hủ của Nguyễn Trãi.',
            targetDurationSeconds: 30,
            keyEvents: ['Bình Ngô đại cáo'],
            introducedEntities: ['Bình Ngô đại cáo'],
          },
        ],
      };

      const result = await packagerNode(mockState as ChronoGraphState);
      const scene = result.videoProps?.timeline[0];
      expect(scene?.overlayData?.author).toContain('Nguyễn Trãi');
    });
  });
});
