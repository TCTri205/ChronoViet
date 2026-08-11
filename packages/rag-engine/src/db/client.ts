import { Pool } from 'pg';
import { INITIAL_RAG_SCHEMA_SQL } from './schema.js';

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

// In-Memory Database Fallback Store
class InMemoryRagStore {
  entities = new Map<string, DbEntity>();
  relationships: DbRelationship[] = [];
  documentChunks = new Map<string, DbDocumentChunk>();
  entityChunks: DbEntityChunk[] = [];
  nextRelId = 1;

  clear() {
    this.entities.clear();
    this.relationships = [];
    this.documentChunks.clear();
    this.entityChunks = [];
    this.nextRelId = 1;
  }
}

export const inMemoryStore = new InMemoryRagStore();

let pgPool: Pool | null = null;
let pgConnected = false;
let checkAttempted = false;

export function getPoolConfig() {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'chronoviet',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    connectionTimeoutMillis: 1000,
    idleTimeoutMillis: 10000,
  };
}

export async function isPgAvailable(): Promise<boolean> {
  if (checkAttempted) return pgConnected;
  checkAttempted = true;
  try {
    if (!pgPool) {
      pgPool = new Pool(getPoolConfig());
      // Silence unexpected pool errors
      pgPool.on('error', () => {
        pgConnected = false;
      });
    }
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    pgConnected = true;
  } catch (_err) {
    pgConnected = false;
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
