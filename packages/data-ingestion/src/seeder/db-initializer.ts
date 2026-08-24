/**
 * Database Initializer for PostgreSQL + pgvector & Knowledge Graph Schema
 */

import { createLogger, initSchema, isPgAvailable, query } from '@chronoviet/infra';

const log = createLogger({ service: 'data-ingestion' });

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
      log.warn('db.init.retry', 'Waiting for PostgreSQL container to finish startup', {
        attempt,
        maxRetries,
        retryIntervalMs,
      });
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
      const tableNames = new Set(tableCheck.map((t: any) => t.tablename));
      const requiredTables = [
        'entities',
        'relationships',
        'document_chunks',
        'entity_chunks',
        'entity_audit_logs',
        'orchestrator_checkpoints',
        'quarantine_triples',
        'unmapped_entities',
        'conversations',
        'conversation_messages',
        'video_briefs',
      ];

      const missingTables = requiredTables.filter((t) => !tableNames.has(t));
      if (missingTables.length > 0) {
        log.error('db.init.missing_tables', `Missing required tables: ${missingTables.join(', ')}`);
        return {
          success: false,
          pgAvailable: true,
          message: `Database initialized but missing required tables: ${missingTables.join(', ')}`,
        };
      }

      return {
        success: true,
        pgAvailable: true,
        message: `Database schema initialized successfully. Verified ${requiredTables.length} tables: ${requiredTables.join(', ')}`,
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
    log.error('db.init.error', 'Database schema initialization error', { error });
    return {
      success: false,
      pgAvailable: true,
      message: `Database schema initialization error: ${errorMessage}`,
    };
  }
}
