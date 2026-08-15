import { describe, it, expect } from 'vitest';
import {
  ProjectWorkspaceConfigSchema,
  ChapterPlanSchema,
  VisualCandidateSchema,
  SceneGenerationSchema,
  MediaAssetRegistrySchema,
} from '../schema.js';

describe('Shared Schemas Validation (Phase 1 SSOT)', () => {
  it('should validate ProjectWorkspaceConfigSchema correctly', () => {
    const validConfig = {
      projectId: 'project_bach_dang_938',
      baseDir: '/media/projects',
      cleanupOnComplete: true,
      maxDiskUsageMb: 2048,
    };
    const parsed = ProjectWorkspaceConfigSchema.parse(validConfig);
    expect(parsed.projectId).toBe('project_bach_dang_938');
    expect(parsed.baseDir).toBe('/media/projects');

    expect(() => ProjectWorkspaceConfigSchema.parse({ projectId: '' })).toThrow();
  });

  it('should validate ChapterPlanSchema correctly', () => {
    const validChapter = {
      chapterIndex: 0,
      title: 'Hồi 1: Bối Cảnh Lịch Sử',
      summary: 'Khái quát thời kỳ Nam Hán xâm lược nước ta.',
      targetDurationSeconds: 120,
      keyEvents: ['Năm 938 Hoằng Tháo kéo quân sang'],
      introducedEntities: ['Ngô Quyền', 'Lưu Hoằng Tháo'],
      transitionHook: 'Tiếp theo là kế sách cọc ngầm...',
      establishedTone: 'Hùng tráng',
    };
    const parsed = ChapterPlanSchema.parse(validChapter);
    expect(parsed.chapterIndex).toBe(0);
    expect(parsed.targetDurationSeconds).toBe(120);

    expect(() => ChapterPlanSchema.parse({ chapterIndex: -1, title: '', targetDurationSeconds: -10 })).toThrow();
  });

  it('should validate VisualCandidateSchema with valid license and scores', () => {
    const validCandidate = {
      candidateId: 'cand_01',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/sample.jpg',
      title: 'Tượng đài Ngô Quyền',
      license: 'CC_BY_4_0',
      candidateBatch: 1,
      score: {
        historicalContextScore: 92,
        visualNoiseScore: 95,
        artisticFitScore: 88,
        overallScore: 91.5,
      },
      verdict: 'PASS',
    };
    const parsed = VisualCandidateSchema.parse(validCandidate);
    expect(parsed.candidateId).toBe('cand_01');
    expect(parsed.license).toBe('CC_BY_4_0');
    expect(parsed.score?.overallScore).toBe(91.5);

    // Invalid license should throw
    expect(() =>
      VisualCandidateSchema.parse({
        ...validCandidate,
        license: 'COPYRIGHTED_ALL_RIGHTS_RESERVED',
      })
    ).toThrow();
  });

  it('should validate SceneGenerationSchema correctly', () => {
    const validScene = {
      sceneId: 'scene_01',
      sceneIndex: 0,
      voiceoverText: 'Vào mùa đông năm 938, đoàn thuyền chiến Nam Hán tiến vào cửa sông Bạch Đằng.',
      layoutMode: 'HISTORICAL_FRAME',
      contentType: 'IMAGE',
      targetDurationSeconds: 12,
      searchKeywords: ['Bạch Đằng 938', 'thuyền chiến cổ'],
      usePureCodeFallback: false,
    };
    const parsed = SceneGenerationSchema.parse(validScene);
    expect(parsed.sceneId).toBe('scene_01');
    expect(parsed.layoutMode).toBe('HISTORICAL_FRAME');
  });

  it('should validate MediaAssetRegistrySchema correctly', () => {
    const validRegistry = {
      projectId: 'project_bach_dang_938',
      assets: [
        {
          assetId: 'asset_01',
          filePath: '/media/projects/project_bach_dang_938/assets/ngo_quyen.jpg',
          license: 'PUBLIC_DOMAIN',
          author: 'Wikimedia Commons',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ngo_Quyen.jpg',
          checksum: 'sha256_mock_hash_123',
          verifiedAt: '2026-08-14T12:00:00.000Z',
        },
      ],
      totalAssets: 1,
      allWhitelisted: true,
      createdAt: '2026-08-14T12:00:00.000Z',
      updatedAt: '2026-08-14T12:00:00.000Z',
    };
    const parsed = MediaAssetRegistrySchema.parse(validRegistry);
    expect(parsed.projectId).toBe('project_bach_dang_938');
    expect(parsed.assets.length).toBe(1);
    expect(parsed.allWhitelisted).toBe(true);
  });
});
