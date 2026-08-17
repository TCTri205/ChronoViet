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
  regexOnly: boolean;
  allowFallback: boolean;
}

function parseArgs(): IngestCliOptions {
  const args = process.argv.slice(2);
  let inputPath = path.resolve(findMonorepoRoot(), 'data', 'raw_corpus');
  let force = false;
  let strict = false;
  let localLlm = false;
  let regexOnly = false;
  let allowFallback = false;

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
    } else if (arg === '--regex-only' || arg === '--regex') {
      regexOnly = true;
    } else if (arg === '--allow-fallback' || arg === '--fallback') {
      allowFallback = true;
    }
  }

  return { inputPath, force, strict, localLlm, regexOnly, allowFallback };
}

async function performPreflightHealthCheck(options: IngestCliOptions): Promise<void> {
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

  // 3. Mode Handling & LLM Gateway Check
  if (options.regexOnly) {
    log.info('ingest.preflight_regex_only', 'Running in REGEX-ONLY Mode (Rule-based dictionary matcher). LLM extraction bypassed.');
    return;
  }

  const llmStatus = await isLLMServiceHealthy();
  if (llmStatus.healthy) {
    log.info('ingest.preflight_llm_online', 'LLM knowledge gateway online', {
      provider: llmStatus.provider,
    });
  } else {
    if (options.allowFallback) {
      log.warn('ingest.preflight_llm_offline', 'LLM gateway offline; falling back to rule-based dictionaries as permitted by --allow-fallback', {
        details: llmStatus.details,
      });
    } else {
      log.error('ingest.preflight_llm_missing', 'LLM Gateway is offline or unreachable in default mode.', {
        details: llmStatus.details,
        actionRequired: 'Start llama-server on port 8080 (or your configured LLM_BASE_URL), configure cloud keys, or run with --regex-only / --allow-fallback.',
      });
      process.exit(1);
    }
  }

  if (options.strict) {
    const errors: string[] = [];
    if (!pgConnected) {
      errors.push('PostgreSQL is not reachable on 127.0.0.1:5432. Please start the Docker container (docker compose up -d).');
    }
    if (!embStatus.healthy) {
      errors.push(`Embedding Service is offline: ${embStatus.details}. Please start the embedding server (e.g. on port 8090) or configure .env.`);
    }
    if (!llmStatus.healthy) {
      errors.push(`LLM Gateway is offline: ${llmStatus.details}. Please start llama-server (e.g. on port 8080) or configure API keys in .env.`);
    }

    if (errors.length > 0) {
      log.error('ingest.preflight_strict_failed', 'Strict mode pre-flight health check failed; ingestion aborted', {
        errors,
      });
      process.exit(1);
    }
    log.info('ingest.preflight_strict_ok', 'All required services are ONLINE and verified for STRICT quality ingestion');
  } else {
    log.info('ingest.preflight_ai_ready', 'Full AI Pipeline Mode (Ensemble AI LLM Knowledge Extraction is ACTIVE)');
  }
}

async function main() {
  const cliOptions = parseArgs();

  log.info('ingest.started', 'ChronoViet Historical Knowledge Ingestion Pipeline', {
    inputPath: cliOptions.inputPath,
    force: cliOptions.force,
    strict: cliOptions.strict,
    localLlm: cliOptions.localLlm,
    regexOnly: cliOptions.regexOnly,
    allowFallback: cliOptions.allowFallback,
  });

  try {
    const exists = await fs.stat(cliOptions.inputPath).then(() => true).catch(() => false);
    if (!exists) {
      log.warn('ingest.input_missing', `Input directory or file does not exist; creating empty raw_corpus directory`, {
        inputPath: cliOptions.inputPath,
      });
      await fs.mkdir(cliOptions.inputPath, { recursive: true });
    }

    // 1. Perform Pre-flight Health Check
    await performPreflightHealthCheck(cliOptions);

    // 2. Ensure Schema is Initialized
    await initSchema();

    // 3. If force/clean specified, reset tables to ensure fresh ingestion
    if (cliOptions.force) {
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
    const result = await seeder.run(cliOptions.inputPath, {
      strict: cliOptions.strict,
      regexOnly: cliOptions.regexOnly,
      allowFallback: cliOptions.allowFallback,
    });

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
