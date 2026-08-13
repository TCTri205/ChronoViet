/**
 * CLI Command: Initialize Database Schema (PostgreSQL + pgvector + Graph Schema)
 * Usage: pnpm --filter @chronoviet/data-ingestion db:init
 */

import { initializeDatabaseSchema } from '../seeder/db-initializer.js';

async function main() {
  console.log('🚀 Initializing ChronoViet PostgreSQL + pgvector Schema...');
  const result = await initializeDatabaseSchema();

  if (result.success) {
    console.log(`✅ ${result.message}`);
    process.exit(0);
  } else {
    console.warn(`⚠️ ${result.message}`);
    if (!result.pgAvailable) {
      console.log('ℹ️ Operating in In-Memory Fallback Mode.');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('❌ Fatal error during database schema initialization:', err);
  process.exit(1);
});
