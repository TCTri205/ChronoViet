/**
 * SQL Schema Definitions for PostgreSQL + pgvector & Relational Graph CTEs
 */

export const INITIAL_RAG_SCHEMA_SQL = `
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Entities Table (Graph Nodes)
CREATE TABLE IF NOT EXISTS entities (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL, -- HISTORICAL_PERSON, LOCATION, EVENT_BATTLE, DYNASTY_ERA, ORGANIZATION, ARTIFACT, DOCUMENT_CULTURE
    aliases TEXT[] DEFAULT '{}', -- Alias Table for Fuzzy Fact-Checking
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Relationships Table (Graph Edges)
CREATE TABLE IF NOT EXISTS relationships (
    id SERIAL PRIMARY KEY,
    source_entity_id VARCHAR(128) REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id VARCHAR(128) REFERENCES entities(id) ON DELETE CASCADE,
    relation_type VARCHAR(64) NOT NULL, -- PART_OF, LED_BY, HAPPENED_IN, HAPPENED_AT, SAME_AS_LOCATION, ALIAS_OF, ROYAL_LINEAGE, MENTIONED_IN
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Document Chunks Table (Vector Store - 1024d BGE-M3 + FTS BM25)
CREATE TABLE IF NOT EXISTS document_chunks (
    id VARCHAR(128) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    text_content TEXT NOT NULL,
    dynasty VARCHAR(64),
    epoch_ids TEXT[] DEFAULT '{}',
    source_reliability VARCHAR(32) DEFAULT 'LEVEL_1', -- LEVEL_1, LEVEL_2, LEVEL_3
    parent_chunk_id VARCHAR(128),
    time_start INT,
    time_end INT,
    key_figures TEXT[] DEFAULT '{}',
    location VARCHAR(255),
    page_number INT,
    embedding vector(1024),
    metadata JSONB DEFAULT '{}'::jsonb,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || text_content)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Entity-Chunk Junction Table (Cross-linking Graph & Vector)
CREATE TABLE IF NOT EXISTS entity_chunks (
    entity_id VARCHAR(128) REFERENCES entities(id) ON DELETE CASCADE,
    chunk_id VARCHAR(128) REFERENCES document_chunks(id) ON DELETE CASCADE,
    PRIMARY KEY (entity_id, chunk_id)
);

-- 6. Audit Logs Table (Append-Only Change Tracking & Governance)
CREATE TABLE IF NOT EXISTS entity_audit_logs (
    log_id SERIAL PRIMARY KEY,
    entity_id VARCHAR(128) REFERENCES entities(id) ON DELETE CASCADE,
    action_type VARCHAR(64) NOT NULL, -- MERGE_ENTITY, ALIAS_UPDATE, MODERN_OVERRIDE, CONFLICT_RESOLVE
    modified_by VARCHAR(128) DEFAULT 'SYSTEM',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    previous_state JSONB DEFAULT '{}'::jsonb,
    new_state JSONB DEFAULT '{}'::jsonb,
    rationale TEXT
);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_entities_aliases ON entities USING GIN (aliases);

CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships (source_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships (target_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships (relation_type);

CREATE INDEX IF NOT EXISTS idx_chunks_epoch_ids ON document_chunks USING GIN (epoch_ids);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
ON document_chunks USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_chunks_fts ON document_chunks USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON entity_audit_logs (entity_id);
`;
