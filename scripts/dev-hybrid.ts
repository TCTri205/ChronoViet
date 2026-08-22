/**
 * ChronoViet — Hybrid Fast Dev Orchestrator (`pnpm dev:hybrid`)
 * Starts PostgreSQL + Redis infra, verifies DB health, and launches Web UI + Worker
 * operating in Cloud Fallback mode (0 local AI memory footprint, ideal for frontend/UI/daily feature dev).
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import * as path from 'path';
import { isPgAvailable, envConfig, createLogger } from '../packages/shared-spec/src/index.js';

const log = createLogger({ service: 'dev-hybrid' });
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

async function runDevHybrid() {
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║             ChronoViet Hybrid Fast Dev Stack (Cloud Fallback)              ║${colors.reset}`);
  console.log(`${colors.dim}║  0 Local AI Memory Overhead | High Speed Frontend & Worker Development     ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // 1. Ensure Docker infra (Postgres + Redis) is up
  try {
    const pgUp = await isPgAvailable();
    if (!pgUp) {
      console.log(`${colors.blue}[INFRA]${colors.reset} Starting Docker Postgres & Redis containers...`);
      execSync('docker compose --profile infra up -d', { cwd: ROOT_DIR, stdio: 'inherit' });
    }
  } catch (err: any) {
    console.log(`${colors.yellow}[INFRA]${colors.reset} Notice: Docker compose check completed (${err.message}).`);
  }

  // 2. Spawn Web App
  console.log(`${colors.green}[WEB]${colors.reset} Starting Web UI (Port 3000)...`);
  const webProc = spawn('pnpm', ['--filter', '@chronoviet/web', 'dev'], {
    cwd: ROOT_DIR,
    env: { ...process.env, AI_EXECUTION_MODE: 'cloud_only', USE_LOCAL_LLM: 'false', ENABLE_CLOUD_FALLBACK: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  webProc.stdout.on('data', (d) => streamLog('WEB', colors.green, d));
  webProc.stderr.on('data', (d) => streamLog('WEB', colors.green, d));
  activeProcesses.push(webProc);

  // 3. Spawn Worker
  console.log(`${colors.yellow}[WORKER]${colors.reset} Starting Render Worker (Port 3001)...`);
  const workerProc = spawn('pnpm', ['--filter', '@chronoviet/render-worker', 'dev'], {
    cwd: ROOT_DIR,
    env: { ...process.env, AI_EXECUTION_MODE: 'cloud_only', USE_LOCAL_LLM: 'false', ENABLE_CLOUD_FALLBACK: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  workerProc.stdout.on('data', (d) => streamLog('WORKER', colors.yellow, d));
  workerProc.stderr.on('data', (d) => streamLog('WORKER', colors.yellow, d));
  activeProcesses.push(workerProc);

  const cleanup = () => {
    console.log(`\n${colors.yellow}[*] Stopping all Dev Hybrid processes...${colors.reset}`);
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

runDevHybrid().catch((err) => {
  log.error('dev_hybrid.error', `Fatal error: ${err.message}`, { error: err });
  process.exit(1);
});
