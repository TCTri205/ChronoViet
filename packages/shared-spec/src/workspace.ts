/**
 * Project Workspace Manager
 * Centralized, Idempotent, and Traversal-Protected Project Directory Management
 */

import * as fs from 'fs';
import * as path from 'path';
import { ChronoVideoProps, VideoProjectSchema } from './schema.js';

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

export function getDefaultProjectsBaseDir(): string {
  if (process.env.PROJECTS_MEDIA_ROOT) {
    return process.env.PROJECTS_MEDIA_ROOT;
  }
  if (process.env.MEDIA_DIR) {
    return path.join(process.env.MEDIA_DIR, 'projects');
  }
  // If running in Docker / Linux with /media/projects available
  if (fs.existsSync('/media/projects')) {
    try {
      fs.accessSync('/media/projects', fs.constants.W_OK);
      return '/media/projects';
    } catch {
      // not writable, fallback to local workspace media
    }
  }
  return path.resolve(process.cwd(), 'media/projects');
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
 * Initializes the project workspace directory structure.
 */
export function initProjectWorkspace(projectId: string, customBaseDir?: string): ProjectWorkspacePaths {
  const rootDir = getProjectRootDir(projectId, customBaseDir);
  const assetsDir = path.join(rootDir, 'assets');
  const audioDir = path.join(rootDir, 'audio');
  const captionsDir = path.join(rootDir, 'captions');
  const tempDir = path.join(rootDir, 'temp');
  const outputDir = path.join(rootDir, 'output');
  const schemaFile = path.join(rootDir, 'project_schema.json');
  const metadataFile = path.join(rootDir, 'metadata.json');

  // Ensure all directories exist
  [rootDir, assetsDir, audioDir, captionsDir, tempDir, outputDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

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
  if (!fs.existsSync(paths.schemaFile)) {
    throw new Error(`Project schema not found at: ${paths.schemaFile}`);
  }

  const raw = fs.readFileSync(paths.schemaFile, 'utf-8');
  return VideoProjectSchema.parse(JSON.parse(raw));
}
