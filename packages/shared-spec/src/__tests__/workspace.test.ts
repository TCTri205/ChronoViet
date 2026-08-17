import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  initProjectWorkspace,
  getProjectPath,
  cleanProjectWorkspace,
  sanitizeProjectId,
  saveProjectSchema,
  loadProjectSchema,
  ensureProjectAssetsReady,
} from '../workspace.js';

describe('ProjectWorkspaceManager', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronoviet-test-workspace-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should sanitize project IDs correctly', () => {
    expect(sanitizeProjectId('project_bach_dang_938')).toBe('project_bach_dang_938');
    expect(sanitizeProjectId('project-123')).toBe('project-123');
    expect(sanitizeProjectId('project.v1.0')).toBe('project.v1.0');

    expect(() => sanitizeProjectId('')).toThrow();
    expect(() => sanitizeProjectId('.hidden_project')).toThrow();
    expect(() => sanitizeProjectId('project..traversal')).toThrow();
    expect(() => sanitizeProjectId('../../../etc/passwd')).toThrow();
    expect(() => sanitizeProjectId('project/with/slashes')).toThrow();
    expect(() => sanitizeProjectId('project with spaces')).toThrow();
  });

  it('should initialize project workspace with all subdirectories', () => {
    const paths = initProjectWorkspace('test_proj_01', tempBaseDir);

    expect(fs.existsSync(paths.rootDir)).toBe(true);
    expect(fs.existsSync(paths.assetsDir)).toBe(true);
    expect(fs.existsSync(paths.audioDir)).toBe(true);
    expect(fs.existsSync(paths.captionsDir)).toBe(true);
    expect(fs.existsSync(paths.tempDir)).toBe(true);
    expect(fs.existsSync(paths.outputDir)).toBe(true);
  });

  it('should safely resolve sub-paths and block directory traversal attacks', () => {
    initProjectWorkspace('test_proj_02', tempBaseDir);

    const safeAssetPath = getProjectPath('test_proj_02', 'assets/image.jpg', tempBaseDir);
    expect(safeAssetPath).toContain('test_proj_02/assets/image.jpg');

    // Attempt directory traversal
    expect(() => {
      getProjectPath('test_proj_02', '../../etc/passwd', tempBaseDir);
    }).toThrow(/Directory traversal attempt detected/);

    expect(() => {
      getProjectPath('test_proj_02', '../other_project/secret.json', tempBaseDir);
    }).toThrow(/Directory traversal attempt detected/);
  });

  it('should clean temporary workspace and entire project workspace', () => {
    const paths = initProjectWorkspace('test_proj_03', tempBaseDir);
    const tempFile = path.join(paths.tempDir, 'scratch.tmp');
    fs.writeFileSync(tempFile, 'temporary data');

    // Clean temp only
    cleanProjectWorkspace('test_proj_03', { cleanTempOnly: true, customBaseDir: tempBaseDir });
    expect(fs.existsSync(tempFile)).toBe(false);
    expect(fs.existsSync(paths.rootDir)).toBe(true);

    // Clean entire workspace
    cleanProjectWorkspace('test_proj_03', { cleanTempOnly: false, customBaseDir: tempBaseDir });
    expect(fs.existsSync(paths.rootDir)).toBe(false);
  });

  it('should save and load project_schema.json correctly', () => {
    const mockSchema: any = {
      title: 'Trận Bạch Đằng 938',
      fps: 30,
      width: 1920,
      height: 1080,
      durationInFrames: 300,
      timeline: [
        {
          id: 'scene_1',
          durationInFrames: 300,
          layoutMode: 'HISTORICAL_FRAME',
          voiceover: {
            text: 'Vào năm 938...',
          },
        },
      ],
    };

    saveProjectSchema('test_proj_04', mockSchema, tempBaseDir);
    const loaded = loadProjectSchema('test_proj_04', tempBaseDir);

    expect(loaded.title).toBe('Trận Bạch Đằng 938');
    expect(loaded.timeline[0].durationInFrames).toBe(300);
    expect(loaded.timeline.length).toBe(1);
  });

  it('should pre-download remote audio and image assets in ensureProjectAssetsReady', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(128),
      };
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as any;

    try {
      const mockSchemaWithRemote: any = {
        title: 'Bạch Đằng Remote Assets',
        fps: 30,
        width: 1920,
        height: 1080,
        durationInFrames: 300,
        timeline: [
          {
            id: 'scene_remote_1',
            durationInFrames: 300,
            layoutMode: 'HISTORICAL_FRAME',
            voiceover: { text: 'Voiceover' },
            sceneAudioUrl: 'https://example.com/audio.mp3',
            assetUrl: 'https://example.com/image.png',
          },
        ],
      };

      const ready = await ensureProjectAssetsReady('test_proj_remote', mockSchemaWithRemote, {
        customBaseDir: tempBaseDir,
      });

      expect(ready.timeline[0].sceneAudioUrl).not.toContain('http');
      expect(ready.timeline[0].sceneAudioUrl).toContain('audio');
      expect(ready.timeline[0].assetUrl).not.toContain('http');
      expect(ready.timeline[0].assetUrl).toContain('assets');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

