/**
 * CLI Command: Ingest Historical Knowledge Corpus (Two-Tier Dual-Branch Seeding)
 * Usage: pnpm --filter @chronoviet/data-ingestion ingest:knowledge [--input=path] [--force] [--strict] [--local-llm]
 */

import path from 'path';
import { promises as fs } from 'fs';
import { DualBranchSeeder } from '../seeder/dual-branch-seeder.js';
import { findMonorepoRoot } from '../utils/path-utils.js';
import {
  createLogger,
  initSchema,
  isPgAvailable,
  query,
  inMemoryStore,
  isEmbeddingServiceHealthy,
  isLLMServiceHealthy,
} from '@chronoviet/shared-spec';
import { runReResolve } from './re-resolve-cli.js';

const log = createLogger({ service: 'data-ingestion' });

interface IngestCliOptions {
  inputPath: string;
  force: boolean;
  strict: boolean;
  localLlm: boolean;
}

function parseArgs(): IngestCliOptions {
  const args = process.argv.slice(2);
  let inputPath = path.resolve(findMonorepoRoot(), 'data', 'raw_corpus');
  let force = false;
  let strict = false;
  let localLlm = false;

  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      const val = arg.split('=')[1] || '';
      inputPath = path.isAbsolute(val) ? val : path.resolve(findMonorepoRoot(), val);
    } else if (arg === '--force' || arg === '--clean') {
      force = true;
    } else if (arg === '--strict') {
      strict = true;
    } else if (arg === '--local-llm') {
      localLlm = true;
    }
  }

  return { inputPath, force, strict, localLlm };
}

async function performPreflightHealthCheck(strict: boolean): Promise<void> {
  log.info('ingest.preflight_started', 'Running pre-flight system & AI services health check');

  // 1. Database Check
  const pgConnected = await isPgAvailable();
  if (pgConnected) {
    log.info('ingest.preflight_pg_online', 'PostgreSQL connected (pgvector ready)');
  } else {
    log.warn('ingest.preflight_pg_fallback', 'PostgreSQL unavailable; in-memory fallback');
  }

  // 2. Embedding Server Check
  const embStatus = await isEmbeddingServiceHealthy();
  if (embStatus.healthy) {
    log.info('ingest.preflight_embedding_online', 'Vector embedding server online', {
      provider: embStatus.provider,
    });
  } else {
    log.warn('ingest.preflight_embedding_offline', 'Vector embedding server offline; pseudo-random fallback', {
      details: embStatus.details,
    });
  }

  // 3. LLM Gateway Check
  const llmStatus = await isLLMServiceHealthy();
  if (llmStatus.healthy) {
    log.info('ingest.preflight_llm_online', 'LLM knowledge gateway online', {
      provider: llmStatus.provider,
    });
  } else {
    log.warn('ingest.preflight_llm_offline', 'LLM gateway offline; rule-based dictionary fallback', {
      details: llmStatus.details,
    });
  }

  if (strict) {
    const errors: string[] = [];
    if (!pgConnected) {
      errors.push('PostgreSQL is not reachable on 127.0.0.1:5432. Please start the Docker container (docker compose up -d).');
    }
    if (!embStatus.healthy) {
      errors.push(`Embedding Service is offline: ${embStatus.details}. Please start the embedding server (e.g. on port 8090) or configure .env.`);
    }
    if (!llmStatus.healthy) {
      errors.push(`LLM Gateway is offline: ${llmStatus.details}. Please start llama-server (e.g. on port 8091) or configure API keys in .env.`);
    }

    if (errors.length > 0) {
      log.error('ingest.preflight_strict_failed', 'Strict mode pre-flight health check failed; ingestion aborted', {
        errors,
      });
      process.exit(1);
    }
    log.info('ingest.preflight_strict_ok', 'All required services are ONLINE and verified for STRICT quality ingestion');
  } else {
    log.info('ingest.preflight_hybrid_mode', 'Running in Hybrid Mode (Ensemble Dictionary + AI with resilient fallback)');
  }
}

async function main() {
  const { inputPath, force, strict, localLlm } = parseArgs();

  log.info('ingest.started', 'ChronoViet Historical Knowledge Ingestion Pipeline', {
    inputPath,
    force,
    strict,
    localLlm,
  });

  try {
    const exists = await fs.stat(inputPath).then(() => true).catch(() => false);
    if (!exists) {
      log.warn('ingest.input_missing', `Input directory or file does not exist; creating empty raw_corpus directory`, {
        inputPath,
      });
      await fs.mkdir(inputPath, { recursive: true });
    }

    // 1. Perform Pre-flight Health Check
    await performPreflightHealthCheck(strict);

    // 2. Ensure Schema is Initialized
    await initSchema();

    // 3. If force/clean specified, reset tables to ensure fresh ingestion
    if (force) {
      log.info('ingest.cleaning', 'Clearing existing database tables for fresh deterministic ingestion');
      const pgConnected = await isPgAvailable();
      if (pgConnected) {
        await query('TRUNCATE document_chunks, entity_chunks, relationships, entities, entity_audit_logs CASCADE;');
        log.info('ingest.tables_truncated', 'PostgreSQL tables truncated');
      } else {
        inMemoryStore.clear();
        log.info('ingest.memory_cleared', 'In-memory store cleared');
      }
    }

    // 4. Execute Dual-Branch Seeding
    const seeder = new DualBranchSeeder();
    const result = await seeder.run(inputPath, { strict });

    log.info('ingest.completed', 'Knowledge Ingestion completed successfully', {
      documentsProcessed: result.documentsProcessed,
      chunksCreated: result.chunksCreated,
      entitiesExtracted: result.entitiesExtracted,
      relationshipsExtracted: result.relationshipsExtracted,
      durationMs: result.durationMs,
    });

    // 5. Run Knowledge Graph Re-Resolution & Audit Logging
    log.info('ingest.reresolve_started', 'Running Entity Disambiguation & Audit Log Sync');
    await runReResolve();

    process.exit(0);
  } catch (error) {
    log.error('ingest.failed', 'Ingestion Pipeline Error', { error });
    process.exit(1);
  }
}

main();
