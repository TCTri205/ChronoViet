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
  aiSupervisor: { name: 'AI Supervisor (LLM/Emb/Extract/Rerank)', tag: 'AI-SUP', color: colors.magenta, status: 'PENDING' },
  tts: { name: 'VieNeu TTS Microservice', tag: 'TTS', color: colors.cyan, status: 'PENDING' },
  web: { name: 'ChronoViet Web UI', tag: 'WEB', color: colors.green, status: 'PENDING' },
  worker: { name: 'Remotion Render Worker', tag: 'WORKER', color: colors.yellow, status: 'PENDING' },
};

let isShuttingDown = false;
let hasRenderedBanner = false;
const activeProcesses: ChildProcess[] = [];

function getStatusBadge(svc: ServiceInfo): { statusColor: string; icon: string } {
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
  return { statusColor, icon };
}

function printDashboard() {
  if (!hasRenderedBanner) {
    console.clear();
    hasRenderedBanner = true;
    console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║                   ChronoViet Dev Stack Orchestrator                        ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    for (const [, svc] of Object.entries(services)) {
      const { statusColor, icon } = getStatusBadge(svc);
      const padName = svc.name.padEnd(38, ' ');
      const padStatus = `${statusColor}${icon} ${svc.status}${colors.reset}`.padEnd(20, ' ');
      const details = svc.details ? `${colors.dim}(${svc.details})${colors.reset}` : '';
      console.log(`  ${svc.color}[${svc.tag.padEnd(6, ' ')}]${colors.reset} ${padName} ${padStatus} ${details}`);
    }

    console.log(`\n${colors.dim}-----------------------------------------------------------------------------${colors.reset}`);
    console.log(`${colors.bright}Live Logs Aggregate (Press Ctrl+C to stop entire stack):${colors.reset}\n`);
  }
}

function updateStatus(key: string, status: ServiceInfo['status'], details?: string) {
  const svc = services[key];
  if (!svc) return;
  const changed = svc.status !== status || (details !== undefined && svc.details !== details);
  svc.status = status;
  if (details !== undefined) svc.details = details;

  if (!hasRenderedBanner) {
    printDashboard();
  } else if (changed) {
    const { statusColor, icon } = getStatusBadge(svc);
    const detailStr = svc.details ? ` (${svc.details})` : '';
    console.log(`${svc.color}[${svc.tag.padEnd(6, ' ')}]${colors.reset} ${svc.name} -> ${statusColor}${icon} ${svc.status}${colors.reset}${colors.dim}${detailStr}${colors.reset}`);
  }
}

function streamLog(tag: string, color: string, data: Buffer | string) {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Filter out repetitive periodic dev probe logs and build progress bars
    if (
      trimmed.includes('GET /api/readyz 200') ||
      trimmed.includes('GET /readyz 200') ||
      trimmed.includes('GET /api/healthz 200') ||
      trimmed.includes('GET /healthz 200') ||
      /^#\d+\s+/.test(trimmed) ||
      trimmed.includes('━━━')
    ) {
      continue;
    }

    console.log(`${color}[${tag}]${colors.reset} ${trimmed}`);
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
    updateStatus('postgres', 'WARNING', 'Docker daemon not running; checking direct host ports');
    updateStatus('redis', 'WARNING', 'Docker daemon not running; checking direct host ports');

    console.log(`${colors.yellow}⚠️  Docker Desktop is not currently running.${colors.reset}`);
    console.log(`   Attempting to connect to PostgreSQL (5432) and Redis (6379) on localhost...`);
    return false;
  }

  try {
    updateStatus('postgres', 'STARTING');
    updateStatus('redis', 'STARTING');

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
      updateStatus('postgres', 'HEALTHY', `Connected to ${envConfig.POSTGRES_DB}`);
      return true;
    }
    attempts++;
    await new Promise((r) => setTimeout(r, 1000));
  }

  updateStatus('postgres', 'WARNING', 'DB offline (running in offline/mock mode)');
  return false;
}

// 4. Verify Redis Health
async function checkRedisHealth(): Promise<boolean> {
  try {
    const net = await import('net');
    return await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ port: 6379, host: '127.0.0.1' }, () => {
        socket.end();
        updateStatus('redis', 'HEALTHY', 'Port 6379 ready');
        resolve(true);
      });
      socket.on('error', () => {
        updateStatus('redis', 'WARNING', 'Offline (using In-Memory cache fallback)');
        resolve(false);
      });
    });
  } catch {
    updateStatus('redis', 'WARNING', 'Offline fallback');
    return false;
  }
}

// 5. Start AI Supervisor Process
function startAiSupervisor(): void {
  updateStatus('aiSupervisor', 'STARTING');

  const proc = spawn('pnpm', ['exec', 'tsx', 'scripts/ai-supervisor.ts'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcesses.push(proc);
  services.aiSupervisor.process = proc;

  proc.stdout?.on('data', (d) => {
    const text = d.toString();
    if (text.includes('HEALTHY') || text.includes('Operating in Cloud Gateway')) {
      updateStatus('aiSupervisor', 'HEALTHY', text.includes('Cloud') ? 'Cloud Gateway Mode' : 'Local llama-server (8090, 8092, 8094, 8096) Ready');
    }
    streamLog('AI-SUP', colors.magenta, d);
  });

  proc.stderr?.on('data', (d) => streamLog('AI-SUP', colors.magenta, d));

  proc.on('exit', () => {
    if (!isShuttingDown) {
      updateStatus('aiSupervisor', 'OFFLINE');
    }
  });
}

// 6. Start TTS Service
function startTtsService(): void {
  updateStatus('tts', 'STARTING');

  const scriptPath = path.join(ROOT_DIR, 'scripts/start-tts-local.sh');
  const proc = spawn(scriptPath, [], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcesses.push(proc);
  services.tts.process = proc;

  let isTtsLoggedAttached = false;
  const attachTtsLogs = () => {
    if (isTtsLoggedAttached) return;
    isTtsLoggedAttached = true;
    try {
      const ttsLogProc = spawn('docker', ['logs', '-f', '--tail', '0', 'vieneu_tts_engine'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      activeProcesses.push(ttsLogProc);
      ttsLogProc.stdout?.on('data', (d) => streamLog('TTS', colors.cyan, d));
      ttsLogProc.stderr?.on('data', (d) => streamLog('TTS', colors.cyan, d));
    } catch {}
  };

  proc.stdout?.on('data', (d) => {
    const text = d.toString();
    if (text.includes('8080') || text.includes('Uvicorn running') || text.includes('VieNeu')) {
      updateStatus('tts', 'HEALTHY', 'Port 8080 Ready');
      attachTtsLogs();
    }
    streamLog('TTS', colors.cyan, d);
  });

  proc.stderr?.on('data', (d) => streamLog('TTS', colors.cyan, d));

  proc.on('exit', (code) => {
    if (isShuttingDown) return;
    if (code === 0 && services.tts.status === 'HEALTHY') {
      attachTtsLogs();
      return;
    }
    let attempts = 0;
    const probeTts = () => {
      if (isShuttingDown) return;
      let resolved = false;
      const done = (isOk: boolean) => {
        if (resolved) return;
        resolved = true;
        if (isOk) {
          updateStatus('tts', 'HEALTHY', 'Port 8080 Ready (Docker)');
          attachTtsLogs();
        } else if (attempts < 10) {
          attempts++;
          setTimeout(probeTts, 1000);
        } else {
          updateStatus('tts', 'WARNING', 'Dual-layer Synthetic Fallback Active');
        }
      };

      const req = http.get({ hostname: '127.0.0.1', port: 8080, path: '/health', timeout: 2000 }, (res) => {
        res.resume();
        done(res.statusCode === 200);
      });
      req.on('error', () => done(false));
      req.on('timeout', () => {
        req.destroy();
        done(false);
      });
    };
    probeTts();
  });
}

// 7. Start Web App & Render Worker
function startApps(): void {
  // Web App
  updateStatus('web', 'STARTING');
  const webProc = spawn('pnpm', ['--filter', '@chronoviet/web', 'dev'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  activeProcesses.push(webProc);
  services.web.process = webProc;

  webProc.stdout?.on('data', (d) => {
    const text = d.toString();
    if (text.includes('Ready') || text.includes('http://localhost') || text.includes('3000')) {
      updateStatus('web', 'HEALTHY', 'http://localhost:3000');
    }
    streamLog('WEB', colors.green, d);
  });
  webProc.stderr?.on('data', (d) => streamLog('WEB', colors.green, d));

  // Render Worker
  updateStatus('worker', 'STARTING');
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
      updateStatus('worker', 'HEALTHY', 'BullMQ Workers Ready');
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

  // Phase B: AI & Audio Engines
  startAiSupervisor();
  startTtsService();

  // Give auxiliary services a moment to initialize ports
  await new Promise((r) => setTimeout(r, 2000));

  // Phase C: Web App & Worker
  startApps();
}

main().catch((err) => {
  log.error('orchestrator.fatal', `Orchestrator failed: ${err.message}`, { error: err });
  shutdownAll();
});
