import { Pool } from 'pg';
import { INITIAL_RAG_SCHEMA_SQL } from './schema.js';
import { envConfig, getDatabaseConfig } from '../config.js';

export interface DbEntity {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  metadata: Record<string, unknown>;
}

export interface DbRelationship {
  id?: number;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  confidence: number;
}

export interface DbDocumentChunk {
  id: string;
  title: string;
  text_content: string;
  dynasty?: string;
  epoch_ids?: string[];
  source_reliability?: string;
  parent_chunk_id?: string;
  time_start?: number;
  time_end?: number;
  key_figures?: string[];
  location?: string;
  page_number?: number;
  embedding?: number[];
  tsv?: string;
}

export interface DbEntityChunk {
  entity_id: string;
  chunk_id: string;
}

export interface DbEntityAuditLog {
  log_id?: number;
  entity_id: string;
  action_type: 'MERGE_ENTITY' | 'ALIAS_UPDATE' | 'MODERN_OVERRIDE' | 'CONFLICT_RESOLVE';
  modified_by?: string;
  timestamp?: string;
  previous_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  rationale?: string;
}

// In-Memory Database Fallback Store
class InMemoryRagStore {
  entities = new Map<string, DbEntity>();
  relationships: DbRelationship[] = [];
  documentChunks = new Map<string, DbDocumentChunk>();
  entityChunks: DbEntityChunk[] = [];
  auditLogs: DbEntityAuditLog[] = [];
  nextRelId = 1;
  nextAuditLogId = 1;

  clear() {
    this.entities.clear();
    this.relationships = [];
    this.documentChunks.clear();
    this.entityChunks = [];
    this.auditLogs = [];
    this.nextRelId = 1;
    this.nextAuditLogId = 1;
  }
}

export const inMemoryStore = new InMemoryRagStore();

let pgPool: Pool | null = null;
let pgConnected = false;
let checkAttempted = false;

export function getPoolConfig() {
  const db = getDatabaseConfig();
  return {
    host: db.host,
    port: db.port,
    database: db.database,
    user: db.user,
    password: db.password,
    connectionTimeoutMillis: envConfig.PG_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: envConfig.PG_IDLE_TIMEOUT_MS,
  };
}

export async function isPgAvailable(forceCheck = false): Promise<boolean> {
  if (Boolean(process.env.FORCE_OFFLINE) || Boolean(process.env.SKIP_PG)) {
    pgConnected = false;
    checkAttempted = true;
    return false;
  }

  if (checkAttempted && !forceCheck) return pgConnected;
  checkAttempted = true;

  const cfg = getPoolConfig();
  try {
    if (!pgPool) {
      pgPool = new Pool({ ...cfg, connectionTimeoutMillis: 300 });
      pgPool.on('error', () => {
        pgConnected = false;
      });
    }

    const client = await Promise.race([
      pgPool.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PG Timeout')), 300)),
    ]);

    await client.query('SELECT 1');
    client.release();
    pgConnected = true;
  } catch {
    pgConnected = false;
    if (pgPool) {
      const poolToClose = pgPool;
      pgPool = null;
      poolToClose.end().catch(() => {});
    }
  }
  return pgConnected;
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const available = await isPgAvailable();
  if (available && pgPool) {
    const res = await pgPool.query(text, params);
    return res.rows as T[];
  }
  return [];
}

export async function withTransaction<T>(
  fn: (execQuery: <R = unknown>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>
): Promise<T> {
  const available = await isPgAvailable();
  if (available && pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN;');
      const execQuery = async <R = unknown>(text: string, params?: unknown[]): Promise<R[]> => {
        const res = await client.query(text, params);
        return res.rows as R[];
      };
      const result = await fn(execQuery);
      await client.query('COMMIT;');
      return result;
    } catch (err) {
      await client.query('ROLLBACK;').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } else {
    return fn(query);
  }
}

export async function initSchema(): Promise<boolean> {
  const available = await isPgAvailable();
  if (available && pgPool) {
    try {
      await pgPool.query(INITIAL_RAG_SCHEMA_SQL);
      return true;
    } catch (err) {
      console.warn('[DB Client] Migration on PG failed, falling back to In-Memory mode:', err);
    }
  }
  return false;
}

export async function closePool(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    pgConnected = false;
    checkAttempted = false;
  }
}

export async function logEntityAuditAction(params: DbEntityAuditLog): Promise<void> {
  const available = await isPgAvailable();
  const modifiedBy = params.modified_by || 'SYSTEM';
  const prevState = JSON.stringify(params.previous_state || {});
  const newState = JSON.stringify(params.new_state || {});

  if (available && pgPool) {
    await query(
      `INSERT INTO entity_audit_logs (entity_id, action_type, modified_by, previous_state, new_state, rationale)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6);`,
      [params.entity_id, params.action_type, modifiedBy, prevState, newState, params.rationale || '']
    );
  } else {
    inMemoryStore.auditLogs.push({
      log_id: inMemoryStore.nextAuditLogId++,
      entity_id: params.entity_id,
      action_type: params.action_type,
      modified_by: modifiedBy,
      timestamp: new Date().toISOString(),
      previous_state: params.previous_state || {},
      new_state: params.new_state || {},
      rationale: params.rationale || '',
    });
  }
}
