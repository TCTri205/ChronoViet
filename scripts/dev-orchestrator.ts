/**
 * ChronoViet — 1-Command Dev Stack Orchestrator (`pnpm dev:stack`)
 * Unified coordinator that starts Docker infrastructure, verifies DB health,
 * launches AI Supervisor, TTS Engine, Web UI, and Render Worker with unified dashboard logs.
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import * as path from 'path';
import * as http from 'http';
import { isPgAvailable, envConfig, createLogger } from '../packages/shared-spec/src/index.js';

const log = createLogger({ service: 'orchestrator' });
const ROOT_DIR = path.resolve(__dirname, '..');

interface ServiceInfo {
  name: string;
  tag: string;
  color: string;
  status: 'PENDING' | 'STARTING' | 'HEALTHY' | 'WARNING' | 'FAILED' | 'OFFLINE';
  details?: string;
  process?: ChildProcess | null;
}

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

const services: Record<string, ServiceInfo> = {
  postgres: { name: 'PostgreSQL + pgvector', tag: 'DB', color: colors.blue, status: 'PENDING' },
  redis: { name: 'Redis Cache & Mutex', tag: 'REDIS', color: colors.red, status: 'PENDING' },
  aiSupervisor: { name: 'AI Supervisor (LLM 27B / Emb)', tag: 'AI-SUP', color: colors.magenta, status: 'PENDING' },
  tts: { name: 'VieNeu TTS Microservice', tag: 'TTS', color: colors.cyan, status: 'PENDING' },
  web: { name: 'ChronoViet Web UI', tag: 'WEB', color: colors.green, status: 'PENDING' },
  worker: { name: 'Remotion Render Worker', tag: 'WORKER', color: colors.yellow, status: 'PENDING' },
};

let isShuttingDown = false;
const activeProcesses: ChildProcess[] = [];

function printDashboard() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║                   ChronoViet Dev Stack Orchestrator                        ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  for (const [key, svc] of Object.entries(services)) {
    let statusColor = colors.yellow;
    let icon = '⏳';
    if (svc.status === 'HEALTHY') {
      statusColor = colors.green;
      icon = '✅';
    } else if (svc.status === 'WARNING') {
      statusColor = colors.yellow;
      icon = '⚠️ ';
    } else if (svc.status === 'FAILED') {
      statusColor = colors.red;
      icon = '❌';
    } else if (svc.status === 'OFFLINE') {
      statusColor = colors.gray;
      icon = '⚪';
    }

    const padName = svc.name.padEnd(30, ' ');
    const padStatus = `${statusColor}${icon} ${svc.status}${colors.reset}`.padEnd(20, ' ');
    const details = svc.details ? `${colors.dim}(${svc.details})${colors.reset}` : '';
    console.log(`  ${svc.color}[${svc.tag.padEnd(6, ' ')}]${colors.reset} ${padName} ${padStatus} ${details}`);
  }

  console.log(`\n${colors.dim}-----------------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bright}Live Logs Aggregate (Press Ctrl+C to stop entire stack):${colors.reset}\n`);
}

function streamLog(tag: string, color: string, data: Buffer | string) {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      console.log(`${color}[${tag}]${colors.reset} ${trimmed}`);
    }
  }
}

// 1. Docker Daemon Verification
function isDockerRunning(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 2. Start Docker Infra (Postgres & Redis)
async function startDockerInfra(): Promise<boolean> {
  if (!isDockerRunning()) {
    services.postgres.status = 'WARNING';
    services.postgres.details = 'Docker daemon not running; checking direct host ports';
    services.redis.status = 'WARNING';
    services.redis.details = 'Docker daemon not running; checking direct host ports';
    printDashboard();

    console.log(`${colors.yellow}⚠️  Docker Desktop is not currently running.${colors.reset}`);
    console.log(`   Attempting to connect to PostgreSQL (5432) and Redis (6379) on localhost...`);
    return false;
  }

  try {
    services.postgres.status = 'STARTING';
    services.redis.status = 'STARTING';
    printDashboard();

    execSync('docker compose --profile infra up -d', {
      cwd: ROOT_DIR,
      stdio: 'ignore',
    });

    return true;
  } catch (err: any) {
    log.warn('orchestrator.docker_infra_failed', `Failed to start docker infra: ${err.message}`);
    return false;
  }
}

// 3. Verify Database Health
async function checkDatabaseHealth(): Promise<boolean> {
  let attempts = 0;
  while (attempts < 15) {
    if (isShuttingDown) return false;
    const ok = await isPgAvailable();
    if (ok) {
      services.postgres.status = 'HEALTHY';
      services.postgres.details = `Connected to ${envConfig.POSTGRES_DB}`;
      return true;
    }
    attempts++;
    await new Promise((r) => setTimeout(r, 1000));
  }

  services.postgres.status = 'WARNING';
  services.postgres.details = 'DB offline (running in offline/mock mode)';
  return false;
}

// 4. Verify Redis Health
async function checkRedisHealth(): Promise<boolean> {
  try {
    const net = await import('net');
    return await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ port: 6379, host: '127.0.0.1' }, () => {
        socket.end();
        services.redis.status = 'HEALTHY';
        services.redis.details = 'Port 6379 ready';
        resolve(true);
      });
      socket.on('error', () => {
        services.redis.status = 'WARNING';
        services.redis.details = 'Offline (using In-Memory cache fallback)';
        resolve(false);
      });
    });
  } catch {
    services.redis.status = 'WARNING';
    services.redis.details = 'Offline fallback';
    return false;
  }
}

// 5. Start AI Supervisor Process
function startAiSupervisor(): void {
  services.aiSupervisor.status = 'STARTING';
  printDashboard();

  const proc = spawn('pnpm', ['exec', 'tsx', 'scripts/ai-supervisor.ts'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcesses.push(proc);
  services.aiSupervisor.process = proc;

  proc.stdout?.on('data', (d) => {
    const text = d.toString();
    if (text.includes('HEALTHY') || text.includes('Operating in Cloud Gateway')) {
      services.aiSupervisor.status = 'HEALTHY';
      services.aiSupervisor.details = text.includes('Cloud') ? 'Cloud Gateway Mode' : 'Local llama-server Ready';
      printDashboard();
    }
    streamLog('AI-SUP', colors.magenta, d);
  });

  proc.stderr?.on('data', (d) => streamLog('AI-SUP', colors.magenta, d));

  proc.on('exit', () => {
    if (!isShuttingDown) {
      services.aiSupervisor.status = 'OFFLINE';
      printDashboard();
    }
  });
}

// 6. Start TTS Service
function startTtsService(): void {
  services.tts.status = 'STARTING';
  printDashboard();

  const scriptPath = path.join(ROOT_DIR, 'scripts/start-tts-local.sh');
  const proc = spawn(scriptPath, [], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcesses.push(proc);
  services.tts.process = proc;

  proc.stdout?.on('data', (d) => {
    const text = d.toString();
    if (text.includes('8080') || text.includes('Uvicorn running') || text.includes('VieNeu')) {
      services.tts.status = 'HEALTHY';
      services.tts.details = 'Port 8080 Ready';
      printDashboard();
    }
    streamLog('TTS', colors.cyan, d);
  });

  proc.stderr?.on('data', (d) => streamLog('TTS', colors.cyan, d));

  proc.on('exit', () => {
    if (isShuttingDown) return;
    const req = http.get({ hostname: '127.0.0.1', port: 8080, path: '/health', timeout: 1500 }, (res) => {
      if (res.statusCode === 200) {
        services.tts.status = 'HEALTHY';
        services.tts.details = 'Port 8080 Ready (Docker)';
      } else {
        services.tts.status = 'WARNING';
        services.tts.details = 'Dual-layer Synthetic Fallback Active';
      }
      printDashboard();
    });
    req.on('error', () => {
      services.tts.status = 'WARNING';
      services.tts.details = 'Dual-layer Synthetic Fallback Active';
      printDashboard();
    });
    req.on('timeout', () => {
      req.destroy();
      services.tts.status = 'WARNING';
      services.tts.details = 'Dual-layer Synthetic Fallback Active';
      printDashboard();
    });
  });
}

// 7. Start Web App & Render Worker
function startApps(): void {
  // Web App
  services.web.status = 'STARTING';
  const webProc = spawn('pnpm', ['--filter', '@chronoviet/web', 'dev'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  activeProcesses.push(webProc);
  services.web.process = webProc;

  webProc.stdout?.on('data', (d) => {
    const text = d.toString();
    if (text.includes('Ready') || text.includes('http://localhost') || text.includes('3000')) {
      services.web.status = 'HEALTHY';
      services.web.details = 'http://localhost:3000';
      printDashboard();
    }
    streamLog('WEB', colors.green, d);
  });
  webProc.stderr?.on('data', (d) => streamLog('WEB', colors.green, d));

  // Render Worker
  services.worker.status = 'STARTING';
  const workerProc = spawn('pnpm', ['--filter', '@chronoviet/render-worker', 'dev'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  activeProcesses.push(workerProc);
  services.worker.process = workerProc;

  workerProc.stdout?.on('data', (d) => {
    const text = d.toString();
    if (
      text.includes('listening') ||
      text.includes('Worker started') ||
      text.includes('Probe port') ||
      text.includes('probe_listening') ||
      text.includes('render_worker.ready') ||
      text.includes('Initializing BullMQ workers')
    ) {
      services.worker.status = 'HEALTHY';
      services.worker.details = 'BullMQ Workers Ready';
      printDashboard();
    }
    streamLog('WORKER', colors.yellow, d);
  });
  workerProc.stderr?.on('data', (d) => streamLog('WORKER', colors.yellow, d));
}

// 8. Graceful Teardown
function shutdownAll(): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n\n${colors.bright}${colors.yellow}Shutting down all ChronoViet dev stack services...${colors.reset}`);

  for (const proc of activeProcesses) {
    try {
      proc.kill('SIGTERM');
    } catch {}
  }

  // Stop TTS Docker container if spawned
  try {
    execSync('docker stop vieneu_tts_engine 2>/dev/null || true', { stdio: 'ignore' });
  } catch {}

  setTimeout(() => {
    for (const proc of activeProcesses) {
      try {
        proc.kill('SIGKILL');
      } catch {}
    }
    process.exit(0);
  }, 1500);
}

// 9. Main Orchestration Lifecycle
async function main() {
  process.on('SIGINT', shutdownAll);
  process.on('SIGTERM', shutdownAll);
  process.on('SIGHUP', shutdownAll);

  printDashboard();

  // Phase A: Infrastructure
  await startDockerInfra();
  await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);
  printDashboard();

  // Phase B: AI & Audio Engines
  startAiSupervisor();
  startTtsService();

  // Give auxiliary services a moment to initialize ports
  await new Promise((r) => setTimeout(r, 2000));
  printDashboard();

  // Phase C: Web App & Worker
  startApps();
  printDashboard();
}

main().catch((err) => {
  log.error('orchestrator.fatal', `Orchestrator failed: ${err.message}`, { error: err });
  shutdownAll();
});
