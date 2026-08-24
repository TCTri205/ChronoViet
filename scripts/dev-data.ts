/**
 * ChronoViet — Data Ingestion & RAG Dev Orchestrator (`pnpm dev:data`)
 * Starts PostgreSQL + Redis, launches AI Lite (BGE-M3 on 8090 + Extraction on 8094),
 * and prepares the environment for crawling, vector embedding, and triple extraction.
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import * as path from 'path';
import { isPgAvailable, envConfig, createLogger } from '@chronoviet/infra';
import { resolveWeights, checkLlamaCli, spawnLlamaService } from './ai-cli.js';

const log = createLogger({ service: 'dev-data' });
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

const EMBEDDING_PORT = envConfig.EMBEDDING_PORT || 8090;
const EXTRACTION_PORT = envConfig.LOCAL_LLM_EXTRACTION_PORT || 8094;
const activeProcesses: ChildProcess[] = [];

async function runDevData() {
  console.log(`\n${colors.bright}${colors.green}╔════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.green}║             ChronoViet Data Ingestion & GraphRAG Dev Stack                 ║${colors.reset}`);
  console.log(`${colors.dim}║  PostgreSQL (pgvector) + Redis + AI Lite (Embedding: 8090 + Extract: 8094) ║${colors.reset}`);
  console.log(`${colors.bright}${colors.green}╚════════════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // 1. Ensure Docker infra (Postgres + Redis) is up
  try {
    const pgUp = await isPgAvailable();
    if (!pgUp) {
      console.log(`${colors.blue}[INFRA]${colors.reset} Starting Docker Postgres & Redis containers...`);
      execSync('docker compose --profile infra up -d', { cwd: ROOT_DIR, stdio: 'inherit' });
    } else {
      console.log(`${colors.green}[INFRA]${colors.reset} ✅ PostgreSQL and Redis are online.`);
    }
  } catch (err: any) {
    console.log(`${colors.yellow}[INFRA]${colors.reset} Notice: Docker compose check (${err.message}).`);
  }

  // 2. Resolve AI Lite weights
  const weights = resolveWeights();
  if (!weights.embPath || !weights.extPath) {
    console.error(`${colors.red}❌ ERROR: AI Lite weights missing in ./models.${colors.reset}`);
    console.error(`Missing: ${!weights.embPath ? 'Embedding (BGE-M3) ' : ''}${!weights.extPath ? 'Extraction (Qwen 4B)' : ''}`);
    console.error(`Please run: ${colors.cyan}pnpm models:download:lite${colors.reset}`);
    process.exit(1);
  }

  if (!checkLlamaCli()) {
    console.error(`${colors.red}❌ ERROR: llama-server CLI not found in PATH.${colors.reset}`);
    process.exit(1);
  }

  // 3. Launch Embedding server
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
  activeProcesses.push(embProc);

  // 4. Launch Extraction server
  const extCtxSize = envConfig.LOCAL_LLM_EXTRACTION_CTX_SIZE || 8192;
  const extExtraArgs: string[] = [
    '--cont-batching',
    '--parallel',
    String(envConfig.LOCAL_LLM_EXTRACTION_PARALLEL || 4),
    '--threads',
    String(envConfig.LOCAL_LLM_EXTRACTION_THREADS || 6),
    ...(envConfig.LOCAL_LLM_EXTRACTION_EXTRA_ARGS ? envConfig.LOCAL_LLM_EXTRACTION_EXTRA_ARGS.split(' ').filter(Boolean) : []),
  ];

  const extProc = spawnLlamaService('Extraction LLM', EXTRACTION_PORT, weights.extPath, {
    ctxSize: extCtxSize,
    extraArgs: extExtraArgs,
    tag: 'EXTRACT-8094',
    tagColor: colors.magenta,
  });
  activeProcesses.push(extProc);

  console.log(`\n${colors.bright}Data Ingestion Stack is READY! Available test & pipeline commands:${colors.reset}`);
  console.log(` • ${colors.cyan}pnpm eval:ner${colors.reset}      -> Stage 1 Historical NER Benchmark`);
  console.log(` • ${colors.cyan}pnpm eval:triples${colors.reset}  -> Stage 2 Knowledge Graph Triples Benchmark`);
  console.log(` • ${colors.cyan}pnpm ingest:vector${colors.reset} -> Ingest raw text into pgvector (1024-dim)`);
  console.log(` • ${colors.cyan}pnpm ingest:graph${colors.reset}  -> Ingest entities & relations into Graph DB`);
  console.log(` • ${colors.cyan}pnpm crawl:corpus${colors.reset}  -> Crawl historical corpus\n`);

  const cleanup = () => {
    console.log(`\n${colors.yellow}[*] Stopping Data Ingestion dev stack...${colors.reset}`);
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

runDevData().catch((err) => {
  log.error('dev_data.error', `Fatal error: ${err.message}`, { error: err });
  process.exit(1);
});
