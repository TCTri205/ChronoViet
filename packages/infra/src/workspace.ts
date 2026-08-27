/**
 * Project Workspace Manager
 * Centralized, Idempotent, and Traversal-Protected Project Directory Management
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { ChronoVideoProps, VideoProjectSchema } from '@chronoviet/shared-spec';
import { envConfig } from './config.js';
import { createLogger } from './logger.js';

const log = createLogger({ service: 'infra-workspace' });

export interface ProjectWorkspacePaths {
  projectId: string;
  rootDir: string;
  assetsDir: string;
  audioDir: string;
  captionsDir: string;
  tempDir: string;
  outputDir: string;
  schemaFile: string;
  metadataFile: string;
}

/**
 * Finds the monorepo root directory by looking for pnpm-workspace.yaml or package.json with chronoviet-monorepo.
 */
export function findMonorepoRoot(startDir: string = process.cwd()): string {
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    if (
      fs.existsSync(path.join(current, 'pnpm-workspace.yaml')) ||
      (fs.existsSync(path.join(current, 'package.json')) &&
        fs.readFileSync(path.join(current, 'package.json'), 'utf-8').includes('chronoviet-monorepo'))
    ) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(startDir);
}

export function getDefaultProjectsBaseDir(): string {
  const root = findMonorepoRoot();
  if (envConfig.PROJECTS_MEDIA_ROOT) {
    if (path.isAbsolute(envConfig.PROJECTS_MEDIA_ROOT)) {
      return envConfig.PROJECTS_MEDIA_ROOT;
    }
    return path.resolve(root, envConfig.PROJECTS_MEDIA_ROOT);
  }
  // If running in Docker / Linux with /media/projects available and writable
  if (fs.existsSync('/media/projects')) {
    try {
      fs.accessSync('/media/projects', fs.constants.W_OK);
      return '/media/projects';
    } catch {
      // not writable, fallback to local workspace media
    }
  }

  if (envConfig.MEDIA_DIR) {
    if (path.isAbsolute(envConfig.MEDIA_DIR)) {
      return path.join(envConfig.MEDIA_DIR, 'projects');
    }
    return path.resolve(root, envConfig.MEDIA_DIR, 'projects');
  }

  return path.resolve(root, 'media/projects');
}

/**
 * Validates and sanitizes a projectId to prevent directory traversal or invalid characters.
 */
export function sanitizeProjectId(projectId: string): string {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('Invalid projectId: must be a non-empty string');
  }

  const trimmed = projectId.trim();
  // Disallow leading dot or slash
  if (trimmed.startsWith('.') || trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    throw new Error(`Invalid projectId: "${projectId}" cannot start with a dot or slash.`);
  }

  // Allow alphanumeric, underscores, hyphens, and dots (no consecutive dots to prevent traversal)
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed) || trimmed.includes('..')) {
    throw new Error(
      `Invalid projectId: "${projectId}" contains forbidden characters. Only alphanumeric, underscores, hyphens, and dots are allowed.`
    );
  }

  return trimmed;
}

/**
 * Resolves the root directory for a project workspace.
 */
export function getProjectRootDir(projectId: string, customBaseDir?: string): string {
  const safeId = sanitizeProjectId(projectId);
  const baseDir = path.resolve(customBaseDir || getDefaultProjectsBaseDir());
  return path.join(baseDir, safeId);
}


/**
 * Resolves the standard directory and file paths for a project workspace without creating them on disk.
 */
export function getProjectPaths(projectId: string, customBaseDir?: string): ProjectWorkspacePaths {
  const rootDir = getProjectRootDir(projectId, customBaseDir);
  const assetsDir = path.join(rootDir, 'assets');
  const audioDir = path.join(rootDir, 'audio');
  const captionsDir = path.join(rootDir, 'captions');
  const tempDir = path.join(rootDir, 'temp');
  const outputDir = path.join(rootDir, 'output');
  const schemaFile = path.join(rootDir, 'project_schema.json');
  const metadataFile = path.join(rootDir, 'metadata.json');

  return {
    projectId: sanitizeProjectId(projectId),
    rootDir,
    assetsDir,
    audioDir,
    captionsDir,
    tempDir,
    outputDir,
    schemaFile,
    metadataFile,
  };
}

/**
 * Initializes the project workspace directory structure.
 */
export function initProjectWorkspace(projectId: string, customBaseDir?: string): ProjectWorkspacePaths {
  const paths = getProjectPaths(projectId, customBaseDir);

  // Ensure all directories exist
  [paths.rootDir, paths.assetsDir, paths.audioDir, paths.captionsDir, paths.tempDir, paths.outputDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return paths;
}

/**
 * Safely resolves a sub-path within a project directory, strictly preventing directory traversal.
 */
export function getProjectPath(projectId: string, subPath: string, customBaseDir?: string): string {
  const rootDir = getProjectRootDir(projectId, customBaseDir);
  const resolved = path.resolve(rootDir, subPath);

  // Strict boundary check
  if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) {
    throw new Error(
      `Directory traversal attempt detected: resolved path "${resolved}" escapes project root "${rootDir}"`
    );
  }

  return resolved;
}

/**
 * Cleans temporary directory or entire project workspace.
 */
export function cleanProjectWorkspace(
  projectId: string,
  options: { cleanTempOnly?: boolean; customBaseDir?: string } = {}
): void {
  const rootDir = getProjectRootDir(projectId, options.customBaseDir);
  if (!fs.existsSync(rootDir)) {
    return;
  }

  if (options.cleanTempOnly) {
    const tempDir = path.join(rootDir, 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.mkdirSync(tempDir, { recursive: true });
    }
  } else {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

/**
 * Saves and validates project_schema.json in project workspace.
 */
export function saveProjectSchema(
  projectId: string,
  schema: ChronoVideoProps,
  customBaseDir?: string
): string {
  const paths = initProjectWorkspace(projectId, customBaseDir);
  const validated = VideoProjectSchema.parse(schema);
  fs.writeFileSync(paths.schemaFile, JSON.stringify(validated, null, 2), 'utf-8');
  return paths.schemaFile;
}

/**
 * Loads and validates project_schema.json from project workspace.
 */
export function loadProjectSchema(projectId: string, customBaseDir?: string): ChronoVideoProps {
  const paths = initProjectWorkspace(projectId, customBaseDir);
  if (fs.existsSync(paths.schemaFile)) {
    const raw = fs.readFileSync(paths.schemaFile, 'utf-8');
    return VideoProjectSchema.parse(JSON.parse(raw));
  }

  // Cross-app candidate discovery in Monorepo Dev (e.g. apps/web/media, media/projects, apps/render-worker/media)
  const root = findMonorepoRoot();
  const candidateDirs = [
    path.resolve(root, 'media/projects', projectId),
    path.resolve(root, 'apps/web/media/projects', projectId),
    path.resolve(root, 'apps/render-worker/media/projects', projectId),
    path.resolve(process.cwd(), 'media/projects', projectId),
  ];

  for (const dir of candidateDirs) {
    const candFile = path.join(dir, 'project_schema.json');
    if (fs.existsSync(candFile)) {
      const raw = fs.readFileSync(candFile, 'utf-8');
      return VideoProjectSchema.parse(JSON.parse(raw));
    }
  }

  throw new Error(`Project schema not found at: ${paths.schemaFile}`);
}

/**
 * Pre-downloads remote HTTP/HTTPS assets (audio, images) into the project workspace directory
 * before rendering, preventing network timeouts and flaky render runs.
 * Local filesystem paths are verified with fast non-blocking checks and preserved without alteration.
 */
export async function ensureProjectAssetsReady(
  projectId: string,
  schema: ChronoVideoProps,
  options: {
    timeoutMs?: number;
    maxFileSizeBytes?: number;
    customBaseDir?: string;
  } = {}
): Promise<ChronoVideoProps> {
  const paths = initProjectWorkspace(projectId, options.customBaseDir);
  const timeoutMs = options.timeoutMs ?? 30000;
  const maxBytes = options.maxFileSizeBytes ?? 50 * 1024 * 1024; // 50MB max per asset

  let modified = false;

  const downloadAsset = async (remoteUrl: string, destDir: string, prefix: string, defaultExt: string): Promise<string | null> => {
    try {
      const cleanUrl = remoteUrl.split('?')[0].split('#')[0].toLowerCase();
      const ext = path.extname(cleanUrl).slice(1) || defaultExt;
      const urlHash = createHash('sha256').update(remoteUrl).digest('hex').slice(0, 16);
      const localPath = path.join(destDir, `${prefix}_${urlHash}.${ext}`);

      // Fast non-blocking check: if cached asset already exists and is valid on disk, reuse immediately
      try {
        const existingStat = await fs.promises.stat(localPath);
        if (existingStat.isFile() && existingStat.size > 0) {
          return localPath;
        }
      } catch {}

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(remoteUrl, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > maxBytes) {
          throw new Error(`Remote asset exceeds size limit (${arrayBuf.byteLength} > ${maxBytes})`);
        }
        await fs.promises.writeFile(localPath, Buffer.from(arrayBuf));
        return localPath;
      }
    } catch (err: any) {
      log.warn('workspace.asset_download_failed', `Failed to pre-download remote asset "${remoteUrl}"`, {
        remoteUrl,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  };

  // 1. Top-Level Composite Audio Pre-download
  if (schema.audioUrl && /^https?:\/\//i.test(schema.audioUrl)) {
    const localPath = await downloadAsset(schema.audioUrl, paths.audioDir, 'composite_audio', 'wav');
    if (localPath) {
      schema.audioUrl = localPath;
      modified = true;
    }
  }

  // 2. Top-Level BGM Pre-download
  if (schema.bgmUrl && /^https?:\/\//i.test(schema.bgmUrl)) {
    const localPath = await downloadAsset(schema.bgmUrl, paths.audioDir, 'bgm', 'mp3');
    if (localPath) {
      schema.bgmUrl = localPath;
      modified = true;
    }
  }

  // 3. Scene Timeline Assets (Scene Audio and Visuals)
  for (let i = 0; i < schema.timeline.length; i++) {
    const scene = schema.timeline[i];

    // Remote Audio Pre-download
    if (scene.sceneAudioUrl && /^https?:\/\//i.test(scene.sceneAudioUrl)) {
      const localAudio = await downloadAsset(scene.sceneAudioUrl, paths.audioDir, `scene_${i}_audio`, 'wav');
      if (localAudio) {
        scene.sceneAudioUrl = localAudio;
        modified = true;
      }
    }

    // Remote Asset/Image Pre-download
    if (scene.assetUrl && /^https?:\/\//i.test(scene.assetUrl)) {
      const localAsset = await downloadAsset(scene.assetUrl, paths.assetsDir, `asset_${i}`, 'jpg');
      if (localAsset) {
        scene.assetUrl = localAsset;
        modified = true;
      }
    }
  }

  if (modified) {
    saveProjectSchema(projectId, schema, options.customBaseDir);
  }

  return schema;
}

