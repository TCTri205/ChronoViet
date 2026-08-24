/**
 * ChronoViet — Granular Local AI Management CLI (`ai-cli.ts`)
 * Provides discrete lifecycle controls for Local AI services:
 * - `status` / `health`: Probe ports 8090, 8092, 8094, 8096, 8080 & check loaded models
 * - `stop` / `kill`: Gracefully kill lingering llama-server / TTS processes
 * - `llm`: Start only Primary LLM/VLM (Port 8092 - Qwen 3.5 9B)
 * - `emb`: Start only Embedding Server (Port 8090 - BGE-M3)
 * - `rerank`: Start only Reranker Engine (Port 8096 - Qwen3-Reranker-0.6B / BGE-Reranker-v2)
 * - `extract`: Start only Stage 2 Extraction LLM (Port 8094 - Qwen 3.5 4B)
 * - `lite`: Start lightweight pair: Embedding (8090) + Extraction (8094) (~3.1 GB RAM)
 * - `all`: Start full AI stack (Port 8090, 8092, 8094, 8096) + TTS (Port 8080)
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { envConfig, createLogger, getAiExecutionSummary } from '@chronoviet/infra';

const log = createLogger({ service: 'ai-cli' });
const ROOT_DIR = path.resolve(__dirname, '..');
const MODEL_DIR = path.resolve(ROOT_DIR, envConfig.MODEL_DIR || './models');

const LLM_PORT = envConfig.LLM_PORT || 8092;
const EMBEDDING_PORT = envConfig.EMBEDDING_PORT || 8090;
const EXTRACTION_PORT = envConfig.LOCAL_LLM_EXTRACTION_PORT || 8094;
const RERANK_PORT = envConfig.RERANK_PORT || 8096;
const TTS_PORT = 8080;

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

// 1. Process & Port Discovery
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

// 2. Health Probe
export async function probeHttpService(
  port: number,
  probePath = '/v1/models',
  timeoutMs = 1500
): Promise<{ ok: boolean; data?: any; statusCode?: number }> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: probePath,
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let data: any = null;
          try {
            data = JSON.parse(body);
          } catch {
            data = body;
          }
          resolve({ ok: res.statusCode === 200, data, statusCode: res.statusCode });
        });
      }
    );

    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false });
    });
  });
}

// 3. Model Weights Resolution
export function resolveWeights() {
  // LLM candidates
  const llmCandidates = [
    path.join(MODEL_DIR, `${envConfig.LOCAL_LLM_PRIMARY_MODEL}.gguf`),
    path.join(MODEL_DIR, 'qwen3.5-9b-instruct-q4_k_m.gguf'),
    path.join(MODEL_DIR, 'Qwen3.5-9B-Instruct-Q4_K_M.gguf'),
    path.join(MODEL_DIR, 'Qwen2.5-7B-Instruct-Q4_K_M.gguf'),
    path.join(MODEL_DIR, `${envConfig.LOCAL_LLM_BENCHMARK_MODEL}.gguf`),
  ];
  let llmPath: string | null = null;
  for (const c of llmCandidates) {
    if (fs.existsSync(c)) {
      llmPath = c;
      break;
    }
  }

  // Multimodal projector
  let mmprojPath: string | null = null;
  const mmprojCandidates = [
    path.join(MODEL_DIR, 'qwen3.5-9b-mmproj.gguf'),
    path.join(MODEL_DIR, 'mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf'),
    path.join(MODEL_DIR, 'mmproj-Qwen2.5-VL-7B-Instruct-Q8_0.gguf'),
    path.join(MODEL_DIR, 'mmproj-Qwen_Qwen2.5-VL-7B-Instruct-f16.gguf'),
  ];
  for (const m of mmprojCandidates) {
    if (fs.existsSync(m)) {
      mmprojPath = m;
      break;
    }
  }

  // Embedding candidates
  const embCandidates = [
    path.join(MODEL_DIR, `${envConfig.LOCAL_EMBEDDING_MODEL}.gguf`),
    path.join(MODEL_DIR, 'bge-m3.gguf'),
    path.join(MODEL_DIR, 'bge-m3-q8_0.gguf'),
    path.join(MODEL_DIR, 'bge-m3-Q8_0.gguf'),
    path.join(MODEL_DIR, 'qwen3-embedding-0.6b.gguf'),
  ];
  let embPath: string | null = null;
  for (const c of embCandidates) {
    if (fs.existsSync(c)) {
      embPath = c;
      break;
    }
  }

  // Extraction candidates
  const extCandidates = [
    path.join(MODEL_DIR, `${envConfig.LOCAL_LLM_EXTRACTION_MODEL || 'qwen3.5-4b-instruct-q4_k_m'}.gguf`),
    path.join(MODEL_DIR, 'qwen3.5-4b-instruct-q4_k_m.gguf'),
    path.join(MODEL_DIR, 'Qwen3.5-4B-Instruct-Q4_K_M.gguf'),
    path.join(MODEL_DIR, 'Qwen2.5-3B-Instruct-Q4_K_M.gguf'),
  ];
  let extPath: string | null = null;
  for (const c of extCandidates) {
    if (fs.existsSync(c)) {
      extPath = c;
      break;
    }
  }

  // Reranker candidates
  const rerankCandidates = [
    path.join(MODEL_DIR, `${envConfig.LOCAL_RERANK_MODEL || 'qwen3-reranker-0.6b'}.gguf`),
    path.join(MODEL_DIR, 'qwen3-reranker-0.6b.gguf'),
    path.join(MODEL_DIR, 'bge-reranker-v2-m3.gguf'),
    path.join(MODEL_DIR, 'bge-reranker-v2-m3-q8_0.gguf'),
    path.join(MODEL_DIR, 'bge-reranker-v2-m3-Q8_0.gguf'),
  ];
  let rerankPath: string | null = null;
  for (const c of rerankCandidates) {
    if (fs.existsSync(c)) {
      rerankPath = c;
      break;
    }
  }

  return { llmPath, mmprojPath, embPath, extPath, rerankPath };
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function getFileSize(filePath: string | null): string {
  if (!filePath || !fs.existsSync(filePath)) return 'Missing';
  try {
    const stats = fs.statSync(filePath);
    return formatFileSize(stats.size);
  } catch {
    return 'Unknown';
  }
}

// ==============================================================================
// COMMAND: STATUS
// ==============================================================================
export async function showStatus() {
  const weights = resolveWeights();
  const summary = getAiExecutionSummary();

  console.log(`\n${colors.bright}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan} CHRONOVIET LOCAL AI RUNTIME & SERVICES STATUS${colors.reset}`);
  console.log(`${colors.dim} Centralized Models Hub: ${MODEL_DIR}${colors.reset}`);
  console.log(`${colors.dim} AI Execution Mode:     ${colors.bright}${colors.yellow}[${summary.mode.toUpperCase()}]${colors.reset} (Routing: ${summary.routingMode}, Cloud Fallback: ${summary.enableCloudFallback ? 'Enabled' : 'Disabled'})`);
  console.log(`${colors.bright}${colors.cyan}==============================================================================${colors.reset}\n`);

  const services = [
    {
      id: 'emb',
      name: 'Embedding Engine',
      port: EMBEDDING_PORT,
      expectedModel: 'BGE-M3 (1024-dim)',
      filePath: weights.embPath,
      probePath: '/v1/models',
      recommendedFor: 'Vector Ingestion, Semantic Search, RAG Retrieval',
    },
    {
      id: 'extract',
      name: 'Stage 2 Extraction LLM',
      port: EXTRACTION_PORT,
      expectedModel: 'Qwen-3.5-4B / 2.5-3B',
      filePath: weights.extPath,
      probePath: '/v1/models',
      recommendedFor: 'pnpm eval:triples, Crawler, Knowledge Graph Ingestion',
    },
    {
      id: 'rerank',
      name: 'Reranker Engine',
      port: RERANK_PORT,
      expectedModel: 'Qwen3-Reranker-0.6B / BGE-Reranker-v2',
      filePath: weights.rerankPath,
      probePath: '/v1/models',
      recommendedFor: 'Cross-Encoder Context Reranking & Disambiguation',
    },
    {
      id: 'llm',
      name: 'Primary LLM / VLM',
      port: LLM_PORT,
      expectedModel: 'Qwen-3.5-9B',
      filePath: weights.llmPath,
      probePath: '/v1/models',
      recommendedFor: 'Agent Orchestrator, RAG Chat, VLM Inspector',
    },
    {
      id: 'tts',
      name: 'VieNeu TTS Voice Engine',
      port: TTS_PORT,
      expectedModel: 'VieNeu-TTS-v1 (Kokoro-Vi)',
      filePath: null,
      probePath: '/health',
      recommendedFor: 'Audio Synthesis, Remotion Voiceovers',
    },
  ];

  for (const s of services) {
    const proc = s.port ? getProcessOnPort(s.port) : null;
    const probe = s.port && s.probePath ? await probeHttpService(s.port, s.probePath) : { ok: false };

    let statusBadge = `${colors.red}❌ OFFLINE${colors.reset}`;
    let loadedModelInfo = '';

    if (s.port === null) {
      statusBadge = s.filePath
        ? `${colors.green}✅ EMBEDDED (In-Process Runtime)${colors.reset}`
        : `${colors.cyan}ℹ️ BUILT-IN (Algorithmic / In-Process)${colors.reset}`;
    } else if (probe.ok) {
      statusBadge = `${colors.green}✅ ONLINE (Healthy)${colors.reset}`;
      if (probe.data?.data?.[0]?.id) {
        loadedModelInfo = ` | Loaded: ${colors.green}${probe.data.data[0].id}${colors.reset}`;
      }
    } else if (proc) {
      statusBadge = `${colors.yellow}⚠️ LISTENING (Unhealthy/Starting)${colors.reset}`;
    }

    const pidInfo = proc ? ` | PID: ${colors.yellow}${proc.pid}${colors.reset}` : '';
    const portLabel = s.port ? `Port ${s.port}` : 'In-Process';
    const weightStatus = s.filePath
      ? `${colors.green}✓ ${path.basename(s.filePath)} (${getFileSize(s.filePath)})${colors.reset}`
      : s.id === 'tts'
      ? `${colors.dim}Python venv / Docker service${colors.reset}`
      : `${colors.red}✗ Model weights missing in ./models (Download: pnpm models:download:${s.id})${colors.reset}`;

    console.log(`• ${colors.bright}${s.name.padEnd(24, ' ')}${colors.reset} [${portLabel}] -> ${statusBadge}${pidInfo}${loadedModelInfo}`);
    console.log(`  ${colors.dim}Target Model:${colors.reset} ${weightStatus}`);
    console.log(`  ${colors.dim}Usage:${colors.reset}        ${s.recommendedFor}\n`);
  }

  // Quick action tips
  console.log(`${colors.dim}------------------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bright}Unified Commands (CLI: 'pnpm ai <cmd>' or npm scripts 'pnpm ai:<cmd>'):${colors.reset}`);
  console.log(` • ${colors.cyan}pnpm ai${colors.reset} / ${colors.cyan}pnpm ai:status${colors.reset} -> Check services health & loaded models`);
  console.log(` • ${colors.cyan}pnpm ai start${colors.reset} / ${colors.cyan}pnpm ai:all${colors.reset}   -> Launch full AI stack (Embedding + Extraction + LLM + Reranker + TTS)`);
  console.log(` • ${colors.cyan}pnpm ai lite${colors.reset} / ${colors.cyan}pnpm ai:lite${colors.reset}     -> Launch lightweight pair: Embedding (8090) + Extraction (8094) (~3.1 GB)`);
  console.log(` • ${colors.cyan}pnpm ai emb${colors.reset} / ${colors.cyan}pnpm ai:emb${colors.reset}       -> Launch Embedding server (Port 8090) for Vector RAG`);
  console.log(` • ${colors.cyan}pnpm ai rerank${colors.reset} / ${colors.cyan}pnpm ai:rerank${colors.reset} -> Launch Reranker Engine (Port 8096) for Cross-Encoder`);
  console.log(` • ${colors.cyan}pnpm ai extract${colors.reset} / ${colors.cyan}pnpm ai:extract${colors.reset} -> Launch Stage 2 Extraction LLM (Port 8094)`);
  console.log(` • ${colors.cyan}pnpm ai llm${colors.reset} / ${colors.cyan}pnpm ai:llm${colors.reset}       -> Launch Primary 9B LLM / VLM (Port 8092)`);
  console.log(` • ${colors.cyan}pnpm ai tts${colors.reset} / ${colors.cyan}pnpm ai:tts${colors.reset}       -> Launch VieNeu TTS Voice Engine in Docker (Port 8080)`);
  console.log(` • ${colors.cyan}pnpm ai stop${colors.reset} / ${colors.cyan}pnpm ai:stop${colors.reset}     -> Terminate all running local AI & TTS processes\n`);
}

// ==============================================================================
// COMMAND: STOP / KILL
// ==============================================================================
export async function stopAllAi() {
  console.log(`\n${colors.bright}${colors.yellow}[*] Stopping and reclaiming all Local AI and TTS processes...${colors.reset}`);

  const targetPorts = [EMBEDDING_PORT, EXTRACTION_PORT, RERANK_PORT, LLM_PORT, TTS_PORT];
  let killedCount = 0;

  // 1. Kill by listening ports (exclude Docker host processes)
  for (const port of targetPorts) {
    const proc = getProcessOnPort(port);
    if (proc) {
      if (proc.command.includes('docker') || proc.command.includes('com.docker')) {
        continue;
      }
      console.log(`  -> Terminating process on Port ${port} (PID ${proc.pid}: ${proc.command.slice(0, 50)}...)`);
      try {
        process.kill(proc.pid, 'SIGTERM');
        killedCount++;
      } catch {}
    }
  }

  // 2. Stop Docker TTS container cleanly if running
  try {
    const isTtsRunning = execSync("docker ps -q -f name=vieneu_tts_engine 2>/dev/null || true", { encoding: 'utf-8' }).trim();
    if (isTtsRunning) {
      console.log(`  -> Stopping Docker container vieneu_tts_engine...`);
      execSync("docker stop vieneu_tts_engine 2>/dev/null || true", { stdio: 'ignore' });
      killedCount++;
    }
  } catch {}

  // 3. Kill any orphan llama-server processes
  try {
    const pids = execSync("pgrep -f 'llama-server' 2>/dev/null || true", { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);

    for (const pidStr of pids) {
      const pid = parseInt(pidStr, 10);
      if (pid && pid !== process.pid) {
        try {
          process.kill(pid, 'SIGTERM');
          killedCount++;
        } catch {}
      }
    }
  } catch {}

  // Wait 1.5s for cleanup
  await new Promise((r) => setTimeout(r, 1500));

  console.log(`${colors.green}✅ All Local AI processes stopped. (${killedCount} processes terminated, RAM/VRAM freed).${colors.reset}\n`);
}

// ==============================================================================
// RUNNER HELPER FOR INDIVIDUAL OR MULTI SERVICES
// ==============================================================================
export function checkLlamaCli(): boolean {
  try {
    execSync('command -v llama-server', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function spawnLlamaService(
  name: string,
  port: number,
  modelPath: string,
  options: {
    ctxSize?: number;
    extraArgs?: string[];
    isEmbedding?: boolean;
    isReranking?: boolean;
    tag: string;
    tagColor: string;
  }
): ChildProcess {
  const ctxSize = options.ctxSize || 4096;
  const args = [
    '-m',
    modelPath,
    '--port',
    String(port),
    '--ctx-size',
    String(ctxSize),
    '--n-gpu-layers',
    '99',
    '--flash-attn',
    'auto',
    ...(options.isEmbedding ? ['--embedding'] : []),
    ...(options.isReranking ? ['--reranking'] : []),
    ...(options.extraArgs || []),
  ];

  console.log(`${options.tagColor}[${options.tag}]${colors.reset} Spawning ${name} on port ${port} (model: ${path.basename(modelPath)})...`);

  const proc = spawn('llama-server', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout.on('data', (d) => {
    const lines = d.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${options.tagColor}[${options.tag}]${colors.reset} ${line.trim()}`);
      }
    }
  });

  proc.stderr.on('data', (d) => {
    const lines = d.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed.includes('HTTP server listening') || trimmed.includes('error') || trimmed.includes('model loaded') || trimmed.includes('system info'))) {
        console.log(`${options.tagColor}[${options.tag}]${colors.reset} ${trimmed}`);
      }
    }
  });

  proc.on('exit', (code, sig) => {
    console.log(`${options.tagColor}[${options.tag}]${colors.reset} Process exited (code=${code}, signal=${sig})`);
  });

  return proc;
}

// ==============================================================================
// SERVICE LAUNCHERS
// ==============================================================================
export function getExtractionLlamaConfig() {
  const extCtxSize = envConfig.LOCAL_LLM_EXTRACTION_CTX_SIZE || 32768;
  const extExtraArgs: string[] = [
    '--cont-batching',
    '--parallel',
    String(envConfig.LOCAL_LLM_EXTRACTION_PARALLEL || 4),
    '--threads',
    String(envConfig.LOCAL_LLM_EXTRACTION_THREADS || 6),
    ...(envConfig.LOCAL_LLM_EXTRACTION_EXTRA_ARGS ? envConfig.LOCAL_LLM_EXTRACTION_EXTRA_ARGS.split(' ').filter(Boolean) : []),
  ];
  return { extCtxSize, extExtraArgs };
}

export function getRerankLlamaConfig() {
  const rerankCtxSize = 8192;
  const rerankExtraArgs: string[] = [
    '--batch-size',
    '8192',
    '--ubatch-size',
    '8192',
    '--cont-batching',
    '--parallel',
    String(envConfig.LOCAL_RERANK_PARALLEL || 4),
    '--threads',
    String(envConfig.LOCAL_RERANK_THREADS || 6),
    ...(envConfig.LOCAL_RERANK_EXTRA_ARGS ? envConfig.LOCAL_RERANK_EXTRA_ARGS.split(' ').filter(Boolean) : []),
  ];
  return { rerankCtxSize, rerankExtraArgs };
}

export async function launchExtractionOnly() {
  const weights = resolveWeights();
  if (!weights.extPath) {
    console.error(`${colors.red}❌ ERROR: Stage 2 Extraction model weights not found in ./models.${colors.reset}`);
    console.error(`Please download with: ${colors.cyan}pnpm models:download:lite${colors.reset} or ${colors.cyan}pnpm models:download:extract${colors.reset}`);
    process.exit(1);
  }
  if (!checkLlamaCli()) {
    console.error(`${colors.red}❌ ERROR: llama-server executable not found in PATH.${colors.reset}`);
    console.error('Please install llama.cpp via Homebrew (`brew install llama.cpp`) or build from source.');
    process.exit(1);
  }

  console.log(`\n${colors.bright}${colors.green}=== Starting Stage 2 Extraction LLM (Port ${EXTRACTION_PORT}) ===${colors.reset}`);
  console.log(`${colors.dim}Press Ctrl+C to terminate.${colors.reset}\n`);

  const { extCtxSize, extExtraArgs } = getExtractionLlamaConfig();

  const proc = spawnLlamaService('Stage 2 Extraction LLM', EXTRACTION_PORT, weights.extPath, {
    ctxSize: extCtxSize,
    extraArgs: extExtraArgs,
    tag: 'EXTRACT-8094',
    tagColor: colors.magenta,
  });

  process.on('SIGINT', () => {
    try {
      proc.kill('SIGTERM');
    } catch {}
    process.exit(0);
  });
}

export async function launchEmbeddingOnly() {
  const weights = resolveWeights();
  if (!weights.embPath) {
    console.error(`${colors.red}❌ ERROR: Embedding model weights not found in ./models.${colors.reset}`);
    console.error(`Please download with: ${colors.cyan}pnpm models:download:emb${colors.reset}`);
    process.exit(1);
  }
  if (!checkLlamaCli()) {
    console.error(`${colors.red}❌ ERROR: llama-server executable not found in PATH.${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.bright}${colors.blue}=== Starting Embedding Server (Port ${EMBEDDING_PORT}) ===${colors.reset}`);
  console.log(`${colors.dim}Press Ctrl+C to terminate.${colors.reset}\n`);

  const embExtraArgs: string[] = [
    '--batch-size',
    '8192',
    '--ubatch-size',
    '8192',
    '--cont-batching',
    '--parallel',
    String(envConfig.LOCAL_EMBEDDING_PARALLEL || 4),
    '--threads',
    String(envConfig.LOCAL_EMBEDDING_THREADS || 6),
    ...(envConfig.LOCAL_EMBEDDING_EXTRA_ARGS ? envConfig.LOCAL_EMBEDDING_EXTRA_ARGS.split(' ').filter(Boolean) : []),
  ];

  const proc = spawnLlamaService('Embedding Server', EMBEDDING_PORT, weights.embPath, {
    ctxSize: 32768,
    isEmbedding: true,
    extraArgs: embExtraArgs,
    tag: 'EMB-8090',
    tagColor: colors.blue,
  });

  process.on('SIGINT', () => {
    try {
      proc.kill('SIGTERM');
    } catch {}
    process.exit(0);
  });
}

export async function launchLlmOnly() {
  const weights = resolveWeights();
  if (!weights.llmPath) {
    console.error(`${colors.red}❌ ERROR: Primary LLM model weights not found in ./models.${colors.reset}`);
    console.error(`Please download with: ${colors.cyan}pnpm models:download${colors.reset}`);
    process.exit(1);
  }
  if (!checkLlamaCli()) {
    console.error(`${colors.red}❌ ERROR: llama-server executable not found in PATH.${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.bright}${colors.cyan}=== Starting Primary LLM / VLM (Port ${LLM_PORT}) ===${colors.reset}`);
  console.log(`${colors.dim}Press Ctrl+C to terminate.${colors.reset}\n`);

  const extraArgs: string[] = [
    '--cache-type-k',
    'q8_0',
    '--cache-type-v',
    'q8_0',
    '--cont-batching',
    '--parallel',
    String(envConfig.LOCAL_LLM_PARALLEL || 4),
  ];
  if (weights.mmprojPath) {
    extraArgs.push('--mmproj', weights.mmprojPath);
  }

  const proc = spawnLlamaService('Primary LLM', LLM_PORT, weights.llmPath, {
    ctxSize: envConfig.LLM_CTX_SIZE || 131072,
    extraArgs,
    tag: 'LLM-8092',
    tagColor: colors.cyan,
  });

  process.on('SIGINT', () => {
    try {
      proc.kill('SIGTERM');
    } catch {}
    process.exit(0);
  });
}

export async function launchLitePair() {
  const weights = resolveWeights();
  if (!weights.embPath || !weights.extPath) {
    console.error(`${colors.red}❌ ERROR: Required models for AI Lite not found in ./models.${colors.reset}`);
    console.error(`Missing: ${!weights.embPath ? 'Embedding (BGE-M3) ' : ''}${!weights.extPath ? 'Extraction (Qwen 4B)' : ''}`);
    console.error(`Please run: ${colors.cyan}pnpm models:download:lite${colors.reset}`);
    process.exit(1);
  }
  if (!checkLlamaCli()) {
    console.error(`${colors.red}❌ ERROR: llama-server executable not found in PATH.${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.bright}${colors.green}==============================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.green} CHRONOVIET AI LITE STACK (Embedding: 8090 + Extraction: 8094)${colors.reset}`);
  console.log(`${colors.dim} Memory Footprint: ~3.1 GB RAM | Ideal for Ingestion & Evaluation${colors.reset}`);
  console.log(`${colors.bright}${colors.green}==============================================================================${colors.reset}\n`);

  const embExtraArgs: string[] = [
    '--batch-size',
    '8192',
    '--ubatch-size',
    '8192',
    '--cont-batching',
    '--parallel',
    String(envConfig.LOCAL_EMBEDDING_PARALLEL || 4),
    '--threads',
    String(envConfig.LOCAL_EMBEDDING_THREADS || 6),
    ...(envConfig.LOCAL_EMBEDDING_EXTRA_ARGS ? envConfig.LOCAL_EMBEDDING_EXTRA_ARGS.split(' ').filter(Boolean) : []),
  ];

  const embProc = spawnLlamaService('Embedding Server', EMBEDDING_PORT, weights.embPath, {
    ctxSize: 32768,
    isEmbedding: true,
    extraArgs: embExtraArgs,
    tag: 'EMB-8090',
    tagColor: colors.blue,
  });

  const { extCtxSize, extExtraArgs } = getExtractionLlamaConfig();

  const extProc = spawnLlamaService('Extraction LLM', EXTRACTION_PORT, weights.extPath, {
    ctxSize: extCtxSize,
    extraArgs: extExtraArgs,
    tag: 'EXTRACT-8094',
    tagColor: colors.magenta,
  });

  const cleanup = () => {
    console.log(`\n${colors.yellow}[*] Shutting down AI Lite services...${colors.reset}`);
    try {
      embProc.kill('SIGTERM');
      extProc.kill('SIGTERM');
    } catch {}
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

export async function launchTts(): Promise<boolean> {
  console.log(`\n${colors.bright}${colors.cyan}=== Starting VieNeu TTS Service (Port ${TTS_PORT}) ===${colors.reset}`);
  console.log(`${colors.dim}Launching Docker container vieneu-tts-service...${colors.reset}\n`);

  try {
    execSync('bash scripts/start-tts-local.sh', { cwd: ROOT_DIR, stdio: 'inherit' });
    return true;
  } catch (err: any) {
    console.error(`${colors.red}❌ Failed to start TTS service: ${err.message}${colors.reset}`);
    return false;
  }
}

export async function stopTts() {
  try {
    execSync('docker stop vieneu_tts_engine 2>/dev/null || true', { stdio: 'ignore' });
  } catch {}
}

export async function launchTtsOnly() {
  const ok = await launchTts();
  if (!ok) {
    process.exit(1);
  }

  const cleanup = () => {
    console.log(`\n${colors.yellow}[*] Stopping VieNeu TTS container...${colors.reset}`);
    void stopTts();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

export async function launchAll() {
  const weights = resolveWeights();
  if (!checkLlamaCli()) {
    console.error(`${colors.red}❌ ERROR: llama-server executable not found in PATH.${colors.reset}`);
    process.exit(1);
  }

  const procs: ChildProcess[] = [];

  console.log(`\n${colors.bright}${colors.cyan}==============================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan} CHRONOVIET FULL LOCAL AI STACK (Embedding, Extraction, LLM, Reranker + TTS)${colors.reset}`);
  console.log(`${colors.dim} Press Ctrl+C to terminate all local AI servers.${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}==============================================================================${colors.reset}\n`);

  // 1. Embedding Server
  if (weights.embPath) {
    const embExtraArgs: string[] = [
      '--batch-size',
      '8192',
      '--ubatch-size',
      '8192',
      '--cont-batching',
      '--parallel',
      String(envConfig.LOCAL_EMBEDDING_PARALLEL || 4),
      '--threads',
      String(envConfig.LOCAL_EMBEDDING_THREADS || 6),
      ...(envConfig.LOCAL_EMBEDDING_EXTRA_ARGS ? envConfig.LOCAL_EMBEDDING_EXTRA_ARGS.split(' ').filter(Boolean) : []),
    ];
    procs.push(
      spawnLlamaService('Embedding Server', EMBEDDING_PORT, weights.embPath, {
        ctxSize: 32768,
        isEmbedding: true,
        extraArgs: embExtraArgs,
        tag: 'EMB-8090',
        tagColor: colors.blue,
      })
    );
  } else {
    console.log(`${colors.yellow}⚠️  Embedding model weights missing. Skipping Port 8090.${colors.reset}`);
  }

  // 2. Extraction Server
  if (weights.extPath) {
    const { extCtxSize, extExtraArgs } = getExtractionLlamaConfig();
    procs.push(
      spawnLlamaService('Stage 2 Extraction LLM', EXTRACTION_PORT, weights.extPath, {
        ctxSize: extCtxSize,
        extraArgs: extExtraArgs,
        tag: 'EXTRACT-8094',
        tagColor: colors.magenta,
      })
    );
  } else {
    console.log(`${colors.yellow}⚠️  Extraction model weights missing. Skipping Port 8094.${colors.reset}`);
  }

  // 3. Primary LLM / VLM
  if (weights.llmPath) {
    const extraArgs: string[] = [
      '--cache-type-k',
      'q8_0',
      '--cache-type-v',
      'q8_0',
      '--cont-batching',
      '--parallel',
      String(envConfig.LOCAL_LLM_PARALLEL || 4),
    ];
    if (weights.mmprojPath) {
      extraArgs.push('--mmproj', weights.mmprojPath);
    }
    procs.push(
      spawnLlamaService('Primary LLM', LLM_PORT, weights.llmPath, {
        ctxSize: envConfig.LLM_CTX_SIZE || 131072,
        extraArgs,
        tag: 'LLM-8092',
        tagColor: colors.cyan,
      })
    );
  } else {
    console.log(`${colors.yellow}⚠️  Primary LLM model weights missing. Skipping Port 8092.${colors.reset}`);
  }

  // 4. Reranker Server
  if (weights.rerankPath) {
    const { rerankCtxSize, rerankExtraArgs } = getRerankLlamaConfig();
    procs.push(
      spawnLlamaService('Reranker Engine', RERANK_PORT, weights.rerankPath, {
        ctxSize: rerankCtxSize,
        isReranking: true,
        extraArgs: rerankExtraArgs,
        tag: 'RERANK-8096',
        tagColor: colors.yellow,
      })
    );
  } else {
    console.log(`${colors.yellow}⚠️  Reranker model weights missing. Skipping Port 8096.${colors.reset}`);
  }

  // 5. VieNeu TTS Voice Engine (Docker, Port 8080)
  const cleanup = () => {
    console.log(`\n${colors.yellow}[*] Shutting down all Local AI services...${colors.reset}`);
    for (const p of procs) {
      try {
        p.kill('SIGTERM');
      } catch {}
    }
    void stopTts();
    process.exit(0);
  };

  // Register cleanup BEFORE awaiting TTS so Ctrl+C never orphans the llama-servers
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const ttsOk = await launchTts();
  if (!ttsOk) {
    console.log(`${colors.yellow}⚠️  TTS failed to start. Continuing without Port 8080 (Dual-layer Synthetic Fallback active).${colors.reset}`);
  }
}

export async function launchRerankOnly() {
  const weights = resolveWeights();
  if (!weights.rerankPath) {
    console.error(`${colors.red}❌ ERROR: Reranker model weights not found in ./models.${colors.reset}`);
    console.error(`Please place ${colors.cyan}qwen3-reranker-0.6b.gguf${colors.reset} or ${colors.cyan}bge-reranker-v2-m3.gguf${colors.reset} into ./models`);
    process.exit(1);
  }
  if (!checkLlamaCli()) {
    console.error(`${colors.red}❌ ERROR: llama-server executable not found in PATH.${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.bright}${colors.yellow}=== Starting Reranker Server (Port ${RERANK_PORT}) ===${colors.reset}`);
  console.log(`${colors.dim}Press Ctrl+C to terminate.${colors.reset}\n`);

  const { rerankCtxSize, rerankExtraArgs } = getRerankLlamaConfig();
  const proc = spawnLlamaService('Reranker Engine', RERANK_PORT, weights.rerankPath, {
    ctxSize: rerankCtxSize,
    isReranking: true,
    extraArgs: rerankExtraArgs,
    tag: 'RERANK-8096',
    tagColor: colors.yellow,
  });

  process.on('SIGINT', () => {
    try {
      proc.kill('SIGTERM');
    } catch {}
    process.exit(0);
  });
}

// ==============================================================================
// CLI ENTRY POINT
// ==============================================================================
const command = process.argv[2] || 'status';

switch (command.toLowerCase()) {
  case 'status':
  case 'health':
  case 'ps':
    showStatus();
    break;

  case 'start':
  case 'all':
  case 'up':
    launchAll();
    break;

  case 'stop':
  case 'kill':
  case 'down':
    stopAllAi();
    break;

  case 'extract':
  case 'extraction':
    launchExtractionOnly();
    break;

  case 'emb':
  case 'embedding':
    launchEmbeddingOnly();
    break;

  case 'rerank':
  case 'reranker':
    launchRerankOnly();
    break;

  case 'llm':
  case 'chat':
  case 'vlm':
    launchLlmOnly();
    break;

  case 'lite':
    launchLitePair();
    break;

  case 'tts':
  case 'voice':
    launchTtsOnly();
    break;

  default:
    console.log(`Unknown command: "${command}". Available commands: status, start, all, stop, lite, emb, rerank, extract, llm, tts`);
    showStatus();
    break;
}
