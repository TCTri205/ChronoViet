import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface CleanupOptions {
  cleanAudio?: boolean;
  cleanReports?: boolean;
  cleanOut?: boolean;
  cleanCaches?: boolean;
  killPorts?: boolean;
  port?: number;
  verbose?: boolean;
}

const DEFAULT_OPTIONS: CleanupOptions = {
  cleanAudio: true,
  cleanReports: true,
  cleanOut: true,
  cleanCaches: true,
  killPorts: true,
  port: 9876,
  verbose: true,
};

/**
  Recursively removes all files and subdirectories within a target directory,
  keeping the root directory itself intact.
 */
function purgeDirectory(dirPath: string, verbose = false): void {
  if (!fs.existsSync(dirPath)) return;

  try {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      // Do not delete source code files, documentation, or git placeholders within report/output directories
      if (entry.endsWith('.ts') || entry === 'README.md' || entry === '.gitkeep') {
        continue;
      }
      const fullPath = path.join(dirPath, entry);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
    if (verbose) {
      console.log(`  [+] Cleaned directory contents: ${dirPath}`);
    }
  } catch (err) {
    if (verbose) {
      console.warn(`  [!] Warning: Failed to clean ${dirPath}:`, err);
    }
  }
}

/**
 * Checks whether a given TCP port is currently in use.
 */
export function isPortInUseSync(port: number): boolean {
  try {
    execSync(
      `node -e "const net = require('net'); const s = net.createServer(); s.once('error', () => process.exit(1)); s.listen(${port}, () => { s.close(); process.exit(0); });"`,
      { stdio: 'ignore' }
    );
    return false;
  } catch {
    return true;
  }
}

/**
 * Forcefully terminates any process bound to the specified port.
 */
export function killPortProcessSync(port: number, verbose = false): boolean {
  if (!isPortInUseSync(port)) return true;

  try {
    if (process.platform === 'win32') {
      const netstatOutput = execSync(`netstat -ano | findstr LISTENING | findstr :${port}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const lines = netstatOutput.trim().split('\n');
      const pidsToKill = new Set<string>();

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const localAddr = parts[1];
        const pid = parts[parts.length - 1];
        if (localAddr && localAddr.endsWith(`:${port}`) && pid && pid !== '0') {
          pidsToKill.add(pid);
        }
      }

      for (const pid of pidsToKill) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          if (verbose) console.log(`  [+] Killed process PID ${pid} on port ${port}`);
        } catch {
          // Process already terminated
        }
      }
    } else {
      try {
        execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
      } catch {
        try {
          execSync(`lsof -t -i:${port} | xargs kill -9`, { stdio: 'ignore' });
        } catch {
          // Process already terminated
        }
      }
    }

    const waitTill = Date.now() + 300;
    while (Date.now() < waitTill) {}

    return !isPortInUseSync(port);
  } catch {
    return false;
  }
}

/**
 * Main evaluation artifact cleanup engine.
 */
export function cleanEvalArtifacts(opts: CleanupOptions = {}): void {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const rootDir = process.cwd();
  const verbose = options.verbose ?? true;

  if (verbose) {
    console.log('\n🧹 [CLEANUP] Starting ChronoViet Evaluation Suite Artifact Purge...');
  }

  // 1. Clean Audio Artifacts
  if (options.cleanAudio) {
    const audioDirs = [
      path.resolve(rootDir, 'media/audio-cache'),
      path.resolve(rootDir, 'services/vieneu-tts/media/audio-cache'),
      path.resolve(rootDir, 'packages/remotion-engine/eval/public/audio'),
      path.resolve(rootDir, 'packages/remotion-engine/public/audio'),
    ];
    for (const dir of audioDirs) {
      purgeDirectory(dir, verbose);
    }
  }

  // 2. Clean Report Artifacts
  if (options.cleanReports) {
    const reportDirs = [
      path.resolve(rootDir, 'eval/reports'),
      path.resolve(rootDir, 'packages/remotion-engine/eval/reports'),
      path.resolve(rootDir, 'services/vieneu-tts/eval/reports'),
    ];
    for (const dir of reportDirs) {
      purgeDirectory(dir, verbose);
    }
  }

  // 3. Clean Out / Intermediate Data Artifacts
  if (options.cleanOut) {
    const outDirs = [
      path.resolve(rootDir, 'eval/out'),
      path.resolve(rootDir, 'packages/remotion-engine/eval/out'),
    ];
    for (const dir of outDirs) {
      purgeDirectory(dir, verbose);
    }
  }

  // 4. Clean Build Caches (Webpack / Remotion)
  if (options.cleanCaches) {
    const cacheDirs = [
      path.resolve(rootDir, 'node_modules/.cache/webpack'),
      path.resolve(rootDir, 'packages/remotion-engine/node_modules/.cache/webpack'),
      path.resolve(rootDir, 'node_modules/.cache/remotion'),
    ];
    for (const dir of cacheDirs) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
          if (verbose) console.log(`  [+] Removed cache directory: ${dir}`);
        } catch {
          // Ignore cache removal errors
        }
      }
    }
  }

  // 5. Kill Port Listeners
  if (options.killPorts && options.port) {
    killPortProcessSync(options.port, verbose);
  }

  if (verbose) {
    console.log('✅ [CLEANUP] Evaluation Suite Artifact Purge Completed.\n');
  }
}

// Allow CLI standalone execution: `npx tsx eval/utils/cleaner.ts`
if (process.argv[1] && process.argv[1].includes('cleaner')) {
  cleanEvalArtifacts({ verbose: true });
}
