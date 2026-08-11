import fs from 'fs';
import path from 'path';

/**
 * Finds the monorepo root directory by searching upwards for pnpm-workspace.yaml
 */
export function findMonorepoRoot(startDir: string = process.cwd()): string {
  let current = startDir;
  while (current && current !== path.parse(current).root) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startDir;
}
