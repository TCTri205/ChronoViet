/**
 * ChronoViet — 1-Click Complete Data & Knowledge Setup (`pnpm data:setup`)
 * Automated pipeline:
 * 1. Ensures Docker PostgreSQL + Redis infrastructure is running.
 * 2. Initializes the 8 relational, vector & graph database tables.
 * 3. Ingests gold historical corpus into Vector (BGE-M3) & Knowledge Graph (triples).
 * 4. Audits database health & integrity.
 */

import { spawn, execSync } from 'child_process';
import * as path from 'path';
import { isPgAvailable, envConfig, createLogger } from '../packages/shared-spec/src/index.js';

const ROOT_DIR = path.resolve(__dirname, '..');
const log = createLogger({ service: 'setup-data' });

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
};

async function runStep(stepNumber: number, title: string, fn: () => Promise<void> | void) {
  console.log(`\n${colors.bright}${colors.cyan}[Step ${stepNumber}/4] ${title}${colors.reset}`);
  console.log(`${colors.dim}------------------------------------------------------------${colors.reset}`);
  try {
    await fn();
    console.log(`${colors.green}✅ [Step ${stepNumber}/4] ${title} — Completed successfully.${colors.reset}`);
  } catch (err: any) {
    console.error(`${colors.red}❌ [Step ${stepNumber}/4] ${title} failed: ${err.message}${colors.reset}`);
    throw err;
  }
}

async function main() {
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║             ChronoViet 1-Click Data & Knowledge Setup                      ║${colors.reset}`);
  console.log(`${colors.dim}║  Infra (Postgres+Redis) ➔ DB Init (8 Tables) ➔ Ingestion ➔ Health Audit     ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════════════╝${colors.reset}`);

  // Step 1: Docker Infra
  await runStep(1, 'Ensuring PostgreSQL + Redis Infrastructure', async () => {
    const isUp = await isPgAvailable();
    if (isUp) {
      console.log(`${colors.green}PostgreSQL and Redis are already active and reachable.${colors.reset}`);
      return;
    }

    console.log(`${colors.blue}Starting Docker containers with --profile infra...${colors.reset}`);
    execSync('docker compose --profile infra up -d', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });

    // Wait for DB to accept connections
    console.log(`Waiting for PostgreSQL connection...`);
    let connected = false;
    for (let i = 0; i < 20; i++) {
      if (await isPgAvailable()) {
        connected = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!connected) {
      throw new Error('PostgreSQL did not become ready within 20 seconds. Check Docker logs.');
    }
  });

  // Step 2: Database Initialization (Schema)
  await runStep(2, 'Initializing Database Schema (8 Tables, Vector Extensions, Graph Schema)', () => {
    execSync('pnpm --filter @chronoviet/data-ingestion db:init', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  });

  // Step 3: Ingest Knowledge Base
  await runStep(3, 'Ingesting Historical Knowledge (Vector Chunks & Graph Triples)', () => {
    console.log(`${colors.dim}Running ingest:knowledge with fallback protection...${colors.reset}`);
    execSync('pnpm --filter @chronoviet/data-ingestion ingest:knowledge', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        ALLOW_AI_FALLBACK: 'true',
      },
    });
  });

  // Step 4: Health Audit
  await runStep(4, 'Auditing Database Health & Index Readiness', () => {
    execSync('tsx scripts/verify-db-health.ts', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  });

  console.log(`\n${colors.bright}${colors.green}🎉 All set! Your ChronoViet Knowledge Base & Database are 100% ready.${colors.reset}`);
  console.log(`Run ${colors.cyan}pnpm dev${colors.reset} to launch the development environment.\n`);
}

main().catch((err) => {
  console.error(`\n${colors.red}Setup aborted due to error: ${err.message}${colors.reset}`);
  process.exit(1);
});
