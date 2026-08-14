/**
 * CLI Command: Initialize Database Schema (PostgreSQL + pgvector + Graph Schema)
 * Usage: pnpm --filter @chronoviet/data-ingestion db:init
 */

import { createLogger } from '@chronoviet/shared-spec';
import { initializeDatabaseSchema } from '../seeder/db-initializer.js';

const log = createLogger({ service: 'data-ingestion' });

async function main() {
  log.info('db.init.started', 'Initializing ChronoViet PostgreSQL + pgvector schema');
  const result = await initializeDatabaseSchema();

  if (result.success) {
    log.info('db.init.succeeded', result.message);
    process.exit(0);
  } else {
    log.warn('db.init.degraded', result.message);
    if (!result.pgAvailable) {
      log.warn('db.init.in_memory_mode', 'Operating in In-Memory Fallback Mode');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  log.error('db.init.failed', 'Fatal error during database schema initialization', { error: err });
  process.exit(1);
});
