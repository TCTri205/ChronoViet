/**
 * Database Initializer for PostgreSQL + pgvector & Knowledge Graph Schema
 */

import { initSchema, isPgAvailable, query } from '@chronoviet/shared-spec';

export interface DbInitResult {
  success: boolean;
  pgAvailable: boolean;
  message: string;
}

/**
 * Initializes the PostgreSQL database schema including vector extensions,
 * tables (entities, relationships, document_chunks, entity_chunks), and indexes.
 */
export async function initializeDatabaseSchema(maxRetries = 5, retryIntervalMs = 1500): Promise<DbInitResult> {
  let pgAvailable = false;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    pgAvailable = await isPgAvailable(true);
    if (pgAvailable) break;
    if (attempt < maxRetries) {
      console.log(`⏳ Waiting for PostgreSQL container to finish startup (attempt ${attempt}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  }

  if (!pgAvailable) {
    return {
      success: false,
      pgAvailable: false,
      message: 'PostgreSQL service is not available. Falling back to In-Memory mode.',
    };
  }

  try {
    const initialized = await initSchema();
    if (initialized) {
      // Verify tables exist
      const tableCheck = await query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public';`
      );
      const tableNames = tableCheck.map((t) => t.tablename);

      return {
        success: true,
        pgAvailable: true,
        message: `Database schema initialized successfully. Tables present: ${tableNames.join(', ')}`,
      };
    } else {
      return {
        success: false,
        pgAvailable: true,
        message: 'Database schema initialization failed during SQL execution.',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      pgAvailable: true,
      message: `Database schema initialization error: ${errorMessage}`,
    };
  }
}
