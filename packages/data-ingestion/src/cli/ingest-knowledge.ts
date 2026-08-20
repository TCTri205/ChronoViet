/**
 * CLI Command: Ingest Historical Knowledge Corpus (Two-Tier Dual-Branch Seeding with Resume & Checkpoint)
 * Usage: pnpm --filter @chronoviet/data-ingestion ingest:knowledge [--input=path] [--force] [--strict] [--regex-only] [--allow-fallback]
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
  flushAllQuarantines,
} from '@chronoviet/shared-spec';
import { runReResolve } from './re-resolve-cli.js';
import { extractionCache } from '../cache/extraction-cache.js';

const log = createLogger({ service: 'data-ingestion' });

export type IngestStage = 'vector' | 'graph' | 'all';

interface IngestCliOptions {
  inputPath: string;
  force: boolean;
  strict: boolean;
  regexOnly: boolean;
  allowFallback: boolean;
  stage: IngestStage;
}

function parseArgs(): IngestCliOptions {
  const args = process.argv.slice(2);
  let inputPath = path.resolve(findMonorepoRoot(), 'data', 'raw_corpus');
  let force = false; // Default to resume mode (reuse cache, no db truncate)
  let strict = true; // Strict by default: production-grade validation, no silent fake embeddings
  let regexOnly = false;
  let allowFallback = false;
  let stage: IngestStage = 'all';

  for (const arg of args) {
    if (arg.startsWith('--input=')) {
      const val = arg.split('=')[1] || '';
      inputPath = path.isAbsolute(val) ? val : path.resolve(findMonorepoRoot(), val);
    } else if (arg === '--force' || arg === '--clean' || arg === '--fresh' || arg === '--reindex') {
      force = true;
    } else if (arg === '--unforce' || arg === '--no-clean' || arg === '--append' || arg === '--resume') {
      force = false;
    } else if (arg === '--strict') {
      strict = true;
    } else if (arg === '--no-strict' || arg === '--lenient') {
      strict = false;
    } else if (arg === '--regex-only' || arg === '--regex') {
      regexOnly = true;
    } else if (arg === '--allow-fallback' || arg === '--fallback') {
      allowFallback = true;
      strict = false;
    } else if (arg === '--offline' || arg === '--fast') {
      regexOnly = true;
      allowFallback = true;
      strict = false;
    } else if (arg.startsWith('--stage=')) {
      const val = arg.split('=')[1].toLowerCase();
      if (val === '1' || val === 'vector' || val === 'chunks' || val === 'stage1') {
        stage = 'vector';
      } else if (val === '2' || val === 'graph' || val === 'triples' || val === 'llm' || val === 'stage2') {
        stage = 'graph';
      } else {
        stage = 'all';
      }
    } else if (arg === '--vector' || arg === '--stage1' || arg === '--chunks') {
      stage = 'vector';
    } else if (arg === '--graph' || arg === '--stage2' || arg === '--triples' || arg === '--llm') {
      stage = 'graph';
    }
  }

  if (strict) {
    process.env.EVAL_STRICT = 'true';
  }

  return { inputPath, force, strict, regexOnly, allowFallback, stage };
}

async function performPreflightHealthCheck(options: IngestCliOptions): Promise<void> {
  log.info('ingest.preflight_started', `Running pre-flight system & AI services health check (Stage: ${options.stage.toUpperCase()}, Strict: ${options.strict ? 'ENABLED (Default)' : 'DISABLED'})`);

  // 1. Database Check (Mandatory across all stages)
  const pgConnected = await isPgAvailable();
  if (pgConnected) {
    log.info('ingest.preflight_pg_online', 'PostgreSQL connected (pgvector ready)');
  } else {
    if (!options.allowFallback) {
      log.error('ingest.preflight_pg_failed', 'PostgreSQL is not reachable on 127.0.0.1:5432. Please start the database (pnpm stack:infra).');
      process.exit(1);
    }
    log.warn('ingest.preflight_pg_fallback', 'PostgreSQL unavailable; in-memory fallback permitted by --allow-fallback');
  }

  // 2. Embedding Server Check (Required for Stage 1 Vector or Stage All)
  if (options.stage === 'vector' || options.stage === 'all') {
    const embStatus = await isEmbeddingServiceHealthy();
    if (embStatus.healthy) {
      log.info('ingest.preflight_embedding_online', 'Vector embedding server online', {
        provider: embStatus.provider,
      });
    } else {
      if (!options.allowFallback) {
        log.error('ingest.preflight_embedding_failed', 'Embedding service is offline or unreachable on http://localhost:8090/v1/embeddings.', {
          details: embStatus.details,
          actionRequired: 'Start the embedding server with: pnpm ai:emb',
        });
        process.exit(1);
      }
      log.warn('ingest.preflight_embedding_offline', 'Vector embedding server offline; pseudo-random fallback permitted by --allow-fallback', {
        details: embStatus.details,
      });
    }
  } else {
    log.info('ingest.preflight_embedding_skipped', 'Stage 2 (Graph): Embedding service check skipped');
  }

  // 3. LLM Gateway Check (Required for Stage 2 Graph or Stage All unless regex-only)
  if (options.stage === 'graph' || options.stage === 'all') {
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
        log.error('ingest.preflight_llm_missing', 'LLM Gateway is offline or unreachable.', {
          details: llmStatus.details,
          actionRequired: 'Start llama-server on port 8094/8092 with: pnpm ai:extract or pnpm ai:lite, configure cloud keys, or run with --regex-only / --allow-fallback.',
        });
        process.exit(1);
      }
    }
  } else {
    log.info('ingest.preflight_llm_skipped', 'Stage 1 (Vector): LLM Gateway check skipped');
  }

  log.info('ingest.preflight_strict_ok', 'All required services are ONLINE and verified for high-fidelity ingestion');
}

async function main() {
  const cliOptions = parseArgs();

  log.info('ingest.started', 'ChronoViet Historical Knowledge Ingestion Pipeline', {
    stage: cliOptions.stage,
    inputPath: cliOptions.inputPath,
    force: cliOptions.force,
    strict: cliOptions.strict,
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

    // 3. If force/clean specified, reset tables & clear cache to ensure fresh ingestion
    if (cliOptions.force) {
      log.info('ingest.force_reset', 'Force mode enabled: clearing extraction cache and truncating database tables');
      await extractionCache.clear();
      const pgConnected = await isPgAvailable();
      if (pgConnected) {
        await query(
          'TRUNCATE document_chunks, entity_chunks, relationships, entities, entity_audit_logs, quarantine_triples, unmapped_entities CASCADE;'
        );
        log.info('ingest.tables_truncated', 'PostgreSQL tables truncated');
      } else {
        inMemoryStore.clear();
        log.info('ingest.memory_cleared', 'In-memory store cleared');
      }
      await flushAllQuarantines();
    } else {
      const cacheStats = await extractionCache.getStats();
      log.info('ingest.resume_mode', 'Resume mode active (cached chunk extractions will be reused to bypass LLM extraction latency)', {
        cachedChunksCount: cacheStats.count,
        cacheDir: cacheStats.dir,
      });
    }

    // 4. Execute Dual-Branch Seeding with specified Stage
    const seeder = new DualBranchSeeder();
    const result = await seeder.run(cliOptions.inputPath, {
      strict: cliOptions.strict,
      regexOnly: cliOptions.regexOnly,
      allowFallback: cliOptions.allowFallback,
      stage: cliOptions.stage,
    });

    log.info('ingest.completed', `Knowledge Ingestion (Stage: ${cliOptions.stage.toUpperCase()}) completed successfully`, {
      stage: cliOptions.stage,
      documentsProcessed: result.documentsProcessed,
      chunksCreated: result.chunksCreated,
      entitiesExtracted: result.entitiesExtracted,
      relationshipsExtracted: result.relationshipsExtracted,
      durationMs: result.durationMs,
    });

    // 5. Run Knowledge Graph Re-Resolution & Audit Logging (for Graph or All stages)
    if (cliOptions.stage === 'graph' || cliOptions.stage === 'all') {
      log.info('ingest.reresolve_started', 'Running Entity Disambiguation & Audit Log Sync');
      await runReResolve();
    }

    process.exit(0);
  } catch (error) {
    log.error('ingest.failed', 'Ingestion Pipeline Error', { error });
    process.exit(1);
  }
}

main();
