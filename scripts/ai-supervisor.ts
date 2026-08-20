/**
 * ChronoViet — AI Process Supervisor & JIT On-Demand Engine
 * Safely supervises llama-server (LLM & Embedding) processes, handles port reclamation,
 * model weight discovery, health probes, and automatic idle memory eviction.
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { envConfig, createLogger } from '../packages/shared-spec/src/index.js';

const log = createLogger({ service: 'ai-supervisor' });

const ROOT_DIR = path.resolve(__dirname, '..');
const MODEL_DIR = path.resolve(ROOT_DIR, envConfig.MODEL_DIR || './models');

const LLM_PORT = envConfig.LLM_PORT || 8092;
const EMBEDDING_PORT = envConfig.EMBEDDING_PORT || 8090;
const AUTO_EVICT_MINUTES = envConfig.AI_AUTO_EVICT_IDLE_MINUTES || 10;

interface ManagedService {
  name: string;
  port: number;
  modelPath: string;
  extraArgs?: string[];
  process: ChildProcess | null;
  status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'EVICTED' | 'FAILED';
  lastActivityTime: number;
  probePath: string;
}

let isShuttingDown = false;

// 1. Safe Process & Port Verification
export function getProcessOnPort(port: number): { pid: number; command: string } | null {
  try {
    const lsofOutput = execSync(`lsof -iTCP:${port} -sTCP:LISTEN -P -n -Fp 2>/dev/null`, {
      encoding: 'utf-8',
    }).trim();
    if (!lsofOutput) return null;

    const pidMatch = lsofOutput.match(/p(\d+)/);
    if (!pidMatch) return null;
    const pid = parseInt(pidMatch[1], 10);

    const psOutput = execSync(`ps -p ${pid} -o command= 2>/dev/null`, {
      encoding: 'utf-8',
    }).trim();

    return { pid, command: psOutput };
  } catch {
    return null;
  }
}

export function safelyReclaimPort(port: number, serviceName: string): boolean {
  const proc = getProcessOnPort(port);
  if (!proc) return true;

  const isLlama = proc.command.includes('llama-server') || proc.command.includes('llama_server');
  if (!isLlama) {
    log.warn('supervisor.port_occupied_foreign', `Port ${port} is occupied by unknown process (PID ${proc.pid}: ${proc.command}). Skipping kill to prevent corruption.`);
    return false;
  }

  log.info('supervisor.reclaiming_port', `Safely reclaiming port ${port} from existing llama-server process (PID ${proc.pid})`);
  try {
    process.kill(proc.pid, 'SIGTERM');
  } catch {}

  // Wait up to 2 seconds for graceful exit, then SIGKILL
  const start = Date.now();
  while (Date.now() - start < 2000) {
    try {
      process.kill(proc.pid, 0); // Check if alive
      execSync('sleep 0.1');
    } catch {
      return true;
    }
  }

  try {
    process.kill(proc.pid, 'SIGKILL');
  } catch {}
  return true;
}

// 2. Model Weights Resolution
export function resolveModelPaths() {
  let llmModelPath = path.join(MODEL_DIR, `${envConfig.LOCAL_LLM_PRIMARY_MODEL}.gguf`);
  if (!fs.existsSync(llmModelPath)) {
    const candidates = [
      path.join(MODEL_DIR, 'qwen3.8-27b-instruct-q4_k_m.gguf'),
      path.join(MODEL_DIR, 'Qwen3.8-27B-Q4_K_M.gguf'),
      path.join(MODEL_DIR, `${envConfig.LOCAL_LLM_BENCHMARK_MODEL}.gguf`),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        llmModelPath = c;
        break;
      }
    }
  }

  // Only attach multimodal projector if the primary model is an actual Vision-Language (VL) model
  const isVlModel = Boolean(llmModelPath && (/[-_]vl[-_.]/i.test(llmModelPath) || /qwen.*vl/i.test(llmModelPath)));
  let mmprojPath: string | null = null;
  if (isVlModel) {
    const mmprojCandidates = [
      path.join(MODEL_DIR, 'qwen3.8-27b-mmproj.gguf'),
      path.join(MODEL_DIR, 'mmproj-Qwen_Qwen2.5-VL-7B-Instruct-f16.gguf'),
    ];
    for (const m of mmprojCandidates) {
      if (fs.existsSync(m)) {
        mmprojPath = m;
        break;
      }
    }
  }

  let embModelPath = path.join(MODEL_DIR, `${envConfig.LOCAL_EMBEDDING_MODEL}.gguf`);
  if (!fs.existsSync(embModelPath)) {
    const candidates = [
      path.join(MODEL_DIR, 'bge-m3.gguf'),
      path.join(MODEL_DIR, 'bge-m3-q8_0.gguf'),
      path.join(MODEL_DIR, 'qwen3-embedding-0.6b.gguf'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        embModelPath = c;
        break;
      }
    }
  }

  let extModelPath = path.join(MODEL_DIR, `${envConfig.LOCAL_LLM_EXTRACTION_MODEL || 'qwen3.5-4b-instruct-q4_k_m'}.gguf`);
  if (!fs.existsSync(extModelPath)) {
    const candidates = [
      path.join(MODEL_DIR, 'qwen3.5-4b-instruct-q4_k_m.gguf'),
      path.join(MODEL_DIR, 'Qwen3.5-4B-Instruct-Q4_K_M.gguf'),
      path.join(MODEL_DIR, 'Qwen2.5-3B-Instruct-Q4_K_M.gguf'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        extModelPath = c;
        break;
      }
    }
  }

  return {
    llmModelPath: llmModelPath && fs.existsSync(llmModelPath) ? llmModelPath : null,
    mmprojPath: mmprojPath && fs.existsSync(mmprojPath) ? mmprojPath : null,
    embModelPath: embModelPath && fs.existsSync(embModelPath) ? embModelPath : null,
    extModelPath: extModelPath && fs.existsSync(extModelPath) ? extModelPath : null,
  };
}

export function isLlamaServerAvailable(): boolean {
  try {
    execSync('command -v llama-server', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 3. Service Definitions
const weights = resolveModelPaths();
const llamaCliPresent = isLlamaServerAvailable();
const EXTRACTION_PORT = envConfig.LOCAL_LLM_EXTRACTION_PORT || 8094;

const services: Record<'llm' | 'emb' | 'extraction', ManagedService> = {
  llm: {
    name: 'LLM / VLM (Qwen3.8-27B)',
    port: LLM_PORT,
    modelPath: weights.llmModelPath || '',
    extraArgs: weights.mmprojPath ? ['--mmproj', weights.mmprojPath] : [],
    process: null,
    status: 'STOPPED',
    lastActivityTime: Date.now(),
    probePath: '/v1/models',
  },
  emb: {
    name: 'Embedding (BGE-M3)',
    port: EMBEDDING_PORT,
    modelPath: weights.embModelPath || '',
    extraArgs: ['--embedding'],
    process: null,
    status: 'STOPPED',
    lastActivityTime: Date.now(),
    probePath: '/v1/models',
  },
  extraction: {
    name: 'Extraction LLM (Qwen3.5-4B)',
    port: EXTRACTION_PORT,
    modelPath: weights.extModelPath || '',
    extraArgs: [],
    process: null,
    status: 'STOPPED',
    lastActivityTime: Date.now(),
    probePath: '/v1/models',
  },
};

// 4. Healthcheck Probing with Exponential Backoff
export async function waitForServiceReady(port: number, probePath = '/v1/models', maxTimeoutMs = 30000): Promise<boolean> {
  const startTime = Date.now();
  let delay = 100;

  while (Date.now() - startTime < maxTimeoutMs) {
    if (isShuttingDown) return false;
    try {
      const res = await new Promise<boolean>((resolve) => {
        const req = http.get(
          {
            hostname: '127.0.0.1',
            port,
            path: probePath,
            timeout: 1000,
          },
          (response) => {
            resolve(response.statusCode === 200);
          }
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      });

      if (res) return true;
    } catch {}

    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 1000);
  }

  return false;
}

// 5. Start Service Process
export async function startService(key: 'llm' | 'emb' | 'extraction'): Promise<boolean> {
  const svc = services[key];
  if (!llamaCliPresent || !svc.modelPath || !fs.existsSync(svc.modelPath)) {
    log.warn('supervisor.service_skipped', `Skipping local ${svc.name}: missing model weights or llama-server CLI. Active mode: Cloud Fallback Gateway.`);
    svc.status = 'STOPPED';
    return false;
  }

  safelyReclaimPort(svc.port, svc.name);

  const ctxSize =
    key === 'llm'
      ? (envConfig.LLM_CTX_SIZE || 16384)
      : key === 'extraction'
      ? (envConfig.LOCAL_LLM_EXTRACTION_CTX_SIZE || 8192)
      : (envConfig.EMBEDDING_CTX_SIZE || 8192);

  const args = [
    '-m',
    svc.modelPath,
    '--port',
    String(svc.port),
    '--ctx-size',
    String(ctxSize),
    '--n-gpu-layers',
    '99',
    '--flash-attn',
    'auto',
    ...(key === 'llm' ? ['--cache-type-k', 'q8_0', '--cache-type-v', 'q8_0', '--cont-batching', '--parallel', '2'] : []),
    ...(key === 'extraction'
      ? [
          '--cont-batching',
          '--parallel',
          String(envConfig.LOCAL_LLM_EXTRACTION_PARALLEL || 4),
          '--threads',
          String(envConfig.LOCAL_LLM_EXTRACTION_THREADS || 6),
        ]
      : []),
    ...(svc.extraArgs || []),
  ];

  log.info('supervisor.launching_process', `Spawning ${svc.name} on port ${svc.port}...`);
  svc.status = 'STARTING';
  svc.lastActivityTime = Date.now();

  const proc = spawn('llama-server', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  proc.stdout.on('data', (d) => {
    svc.lastActivityTime = Date.now();
  });

  proc.stderr.on('data', (d) => {
    svc.lastActivityTime = Date.now();
  });

  proc.on('exit', (code, sig) => {
    if (!isShuttingDown && svc.status !== 'EVICTED') {
      log.warn('supervisor.process_exited', `${svc.name} exited with code=${code}, signal=${sig}`);
      svc.status = 'FAILED';
      svc.process = null;
    }
  });

  svc.process = proc;

  const ready = await waitForServiceReady(svc.port, svc.probePath, 30000);
  if (ready) {
    svc.status = 'RUNNING';
    log.info('supervisor.service_ready', `✅ ${svc.name} is HEALTHY and listening on port ${svc.port}`);
    return true;
  } else {
    log.error('supervisor.service_health_failed', `❌ ${svc.name} failed healthcheck probe within timeout`);
    svc.status = 'FAILED';
    return false;
  }
}

// 6. Graceful Eviction & JIT Wake-up
export function evictService(key: 'llm' | 'emb' | 'extraction'): void {
  const svc = services[key];
  if (svc.process && svc.status === 'RUNNING') {
    log.info('supervisor.evicting_idle', `Auto-evicting idle service ${svc.name} to free RAM...`);
    svc.status = 'EVICTED';
    try {
      svc.process.kill('SIGTERM');
    } catch {}
    svc.process = null;
  }
}

export function checkIdleEviction(): void {
  if (AUTO_EVICT_MINUTES <= 0) return;
  const idleThresholdMs = AUTO_EVICT_MINUTES * 60 * 1000;
  const now = Date.now();

  for (const key of ['llm', 'emb', 'extraction'] as const) {
    const svc = services[key];
    if (svc.status === 'RUNNING' && now - svc.lastActivityTime > idleThresholdMs) {
      log.info('supervisor.idle_detected', `${svc.name} has been idle for >${AUTO_EVICT_MINUTES}m (${Math.round((now - svc.lastActivityTime) / 60000)}m)`);
      evictService(key);
    }
  }
}

// 7. Clean Shutdown Handler
export function shutdownAll(): void {
  isShuttingDown = true;
  log.info('supervisor.shutdown', 'Shutting down all managed llama-server processes cleanly...');

  for (const key of ['llm', 'emb', 'extraction'] as const) {
    const svc = services[key];
    if (svc.process) {
      try {
        svc.process.kill('SIGTERM');
      } catch {}
      svc.process = null;
    }
    svc.status = 'STOPPED';
  }
}

// 8. Main Supervisor Daemon Routine
export async function runSupervisor() {
  console.log('\n======================================================');
  console.log(' ChronoViet — AI Process Supervisor & JIT Daemon');
  console.log(` Config: LLM_PORT=${LLM_PORT} | EMB_PORT=${EMBEDDING_PORT} | EXT_PORT=${EXTRACTION_PORT} | AUTO_EVICT=${AUTO_EVICT_MINUTES}m`);
  console.log('======================================================\n');

  if (!llamaCliPresent) {
    console.log('⚠️ llama-server not found in PATH.');
    console.log('ℹ️ Operating in Cloud Gateway Fallback mode (Agnes 2.5 Flash / Gemini / OpenAI).');
    return;
  }

  process.on('SIGINT', () => {
    shutdownAll();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    shutdownAll();
    process.exit(0);
  });
  process.on('SIGHUP', () => {
    shutdownAll();
    process.exit(0);
  });
  process.on('exit', () => {
    shutdownAll();
  });

  // Start initial services
  await startService('llm');
  await startService('emb');
  await startService('extraction');

  // Start periodic idle eviction monitor (every 30s)
  setInterval(() => {
    checkIdleEviction();
  }, 30000);
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('ai-supervisor.ts')) {
  runSupervisor().catch((err) => {
    log.error('supervisor.fatal_error', `Supervisor failed: ${err.message}`, { error: err });
    process.exit(1);
  });
}
