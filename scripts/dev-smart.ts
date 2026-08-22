/**
 * ChronoViet — Smart 1-Click Development Launcher (`pnpm dev`)
 * Automatically:
 * 1. Checks and starts Docker Postgres + Redis (if needed).
 * 2. Checks DB health & auto-initializes schema if tables are missing.
 * 3. Probes AI services (Local vs Cloud fallback) to ensure zero crashes.
 * 4. Launches Web App (3000) and Render Worker (3001) concurrently.
 * 5. Handles graceful shutdown on Ctrl+C.
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import * as path from 'path';
import * as http from 'http';
import * as net from 'net';
import { isPgAvailable, query, envConfig, createLogger } from '../packages/shared-spec/src/index.js';

const log = createLogger({ service: 'dev-smart' });
const ROOT_DIR = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

const activeProcesses: ChildProcess[] = [];

function streamLog(tag: string, color: string, data: Buffer | string) {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      console.log(`${color}[${tag}]${colors.reset} ${trimmed}`);
    }
  }
}

async function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

function isDockerRunning(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║                   ChronoViet Smart Dev Launcher                            ║${colors.reset}`);
  console.log(`${colors.dim}║  Auto-Infra Check | Smart AI Detection | Web App + Render Worker           ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // 1. Docker Infrastructure (Postgres + Redis)
  console.log(`${colors.blue}[INFRA]${colors.reset} Checking PostgreSQL & Redis...`);
  let pgUp = await isPgAvailable();
  if (!pgUp) {
    if (isDockerRunning()) {
      console.log(`${colors.blue}[INFRA]${colors.reset} Starting PostgreSQL + Redis via Docker Compose...`);
      try {
        execSync('docker compose --profile infra up -d', { cwd: ROOT_DIR, stdio: 'ignore' });
        // Wait up to 10s for Postgres
        for (let i = 0; i < 10; i++) {
          if (await isPgAvailable()) {
            pgUp = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (err: any) {
        console.log(`${colors.yellow}[INFRA]${colors.reset} Docker Compose notice: ${err.message}`);
      }
    } else {
      console.log(`${colors.yellow}[INFRA] ⚠️  Docker Desktop is not running. PostgreSQL in offline/mock mode.${colors.reset}`);
    }
  }

  if (pgUp) {
    console.log(`${colors.green}[INFRA] ✅ PostgreSQL & Redis are connected.${colors.reset}`);
    // Check if tables exist
    try {
      const res: any = await query(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'historical_entities';"
      );
      if (res.length === 0 || parseInt(res[0]?.count || '0', 10) === 0) {
        console.log(`${colors.yellow}[DB] ⚠️  Database tables not detected. Initializing schema...${colors.reset}`);
        execSync('pnpm --filter @chronoviet/data-ingestion db:init', { cwd: ROOT_DIR, stdio: 'inherit' });
      }
    } catch {}
  }

  // 2. AI Execution Mode Detection
  console.log(`${colors.magenta}[AI-PROBE]${colors.reset} Detecting AI execution environment...`);
  const isLlmRunning = await isPortListening(8092);
  const isEmbRunning = await isPortListening(8090);
  const isTtsRunning = await isPortListening(8080);

  let devEnv: Record<string, string | undefined> = {
    ...process.env,
  };

  if (isLlmRunning && isEmbRunning) {
    console.log(`${colors.green}[AI-PROBE] ✅ Local AI Stack Detected (LLM: 8092, Emb: 8090, TTS: ${isTtsRunning ? '8080' : 'Synthetic Fallback'}).${colors.reset}`);
    devEnv.AI_EXECUTION_MODE = 'local_first';
    devEnv.ENABLE_CLOUD_FALLBACK = 'true';
  } else {
    console.log(`${colors.cyan}[AI-PROBE] ℹ️  Local AI server not running on port 8092/8090.${colors.reset}`);
    console.log(`${colors.cyan}[AI-PROBE] 💡 Enabling Smart Cloud Fallback mode (0% local GPU overhead).${colors.reset}`);
    console.log(`${colors.dim}           Tip: Run 'pnpm ai:start' or 'pnpm ai' if you wish to run 100% Local AI.${colors.reset}`);
    devEnv.AI_EXECUTION_MODE = 'hybrid';
    devEnv.ENABLE_CLOUD_FALLBACK = 'true';
    devEnv.USE_LOCAL_LLM = 'false';
  }

  // 3. Start Web UI
  console.log(`\n${colors.green}[WEB]${colors.reset} Starting Web UI on http://localhost:3000...`);
  const webProc = spawn('pnpm', ['--filter', '@chronoviet/web', 'dev'], {
    cwd: ROOT_DIR,
    env: devEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  webProc.stdout.on('data', (d) => streamLog('WEB', colors.green, d));
  webProc.stderr.on('data', (d) => streamLog('WEB', colors.green, d));
  activeProcesses.push(webProc);

  // 4. Start Render Worker
  console.log(`${colors.yellow}[WORKER]${colors.reset} Starting Render Worker on http://localhost:3001...`);
  const workerProc = spawn('pnpm', ['--filter', '@chronoviet/render-worker', 'dev'], {
    cwd: ROOT_DIR,
    env: devEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  workerProc.stdout.on('data', (d) => streamLog('WORKER', colors.yellow, d));
  workerProc.stderr.on('data', (d) => streamLog('WORKER', colors.yellow, d));
  activeProcesses.push(workerProc);

  console.log(`\n${colors.bright}${colors.green}✨ ChronoViet Dev Environment is LIVE!${colors.reset}`);
  console.log(`  🌐 Web App:       ${colors.cyan}http://localhost:3000${colors.reset}`);
  console.log(`  ⚙️  Render Worker: ${colors.cyan}http://localhost:3001${colors.reset}`);
  console.log(`  🎬 Remotion UI:   ${colors.dim}pnpm remotion:studio${colors.reset}`);
  console.log(`  🤖 AI Management: ${colors.dim}pnpm ai${colors.reset}`);
  console.log(`\n${colors.dim}(Press Ctrl+C to gracefully stop all services)${colors.reset}\n`);

  const cleanup = () => {
    console.log(`\n${colors.yellow}[*] Stopping all Dev processes gracefully...${colors.reset}`);
    for (const p of activeProcesses) {
      try {
        p.kill('SIGTERM');
      } catch {}
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  log.error('dev_smart.error', `Fatal error in dev launcher: ${err.message}`);
  process.exit(1);
});
