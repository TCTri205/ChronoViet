// In-memory cache for directory entries list to prevent disk amplification
export interface ProjectsDirCache {
  timestamp: number;
  dirNames: string[];
}

let dirCache: ProjectsDirCache | null = null;
export const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export function getProjectsDirCache(): ProjectsDirCache | null {
  return dirCache;
}

export function setProjectsDirCache(cache: ProjectsDirCache | null): void {
  dirCache = cache;
}

export function invalidateProjectsCache(): void {
  dirCache = null;
}
