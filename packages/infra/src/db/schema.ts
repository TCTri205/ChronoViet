/**
 * SQL Schema Definitions for PostgreSQL + pgvector & Relational Graph CTEs
 */

export const INITIAL_RAG_SCHEMA_SQL = `
-- 1. Enable pgvector & unaccent extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Entities Table (Graph Nodes)
CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- HISTORICAL_PERSON, LOCATION, EVENT_BATTLE, DYNASTY_ERA, ORGANIZATION, ARTIFACT, DOCUMENT_CULTURE
    aliases TEXT[] DEFAULT '{}', -- Alias Table for Fuzzy Fact-Checking
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Relationships Table (Graph Edges)
CREATE TABLE IF NOT EXISTS relationships (
    id SERIAL PRIMARY KEY,
    source_entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL, -- PART_OF, LED_BY, HAPPENED_IN, HAPPENED_AT, SAME_AS_LOCATION, ALIAS_OF, ROYAL_LINEAGE, MENTIONED_IN
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Document Chunks Table (Vector Store - 1024d BGE-M3 + FTS BM25)
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    text_content TEXT NOT NULL,
    dynasty TEXT,
    epoch_ids TEXT[] DEFAULT '{}',
    source_reliability TEXT DEFAULT 'LEVEL_1', -- LEVEL_1, LEVEL_2, LEVEL_3
    parent_chunk_id TEXT,
    time_start INT,
    time_end INT,
    key_figures TEXT[] DEFAULT '{}',
    location TEXT,
    page_number INT,
    embedding vector(1024),
    metadata JSONB DEFAULT '{}'::jsonb,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || text_content)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Entity-Chunk Junction Table (Cross-linking Graph & Vector)
CREATE TABLE IF NOT EXISTS entity_chunks (
    entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    chunk_id TEXT REFERENCES document_chunks(id) ON DELETE CASCADE,
    PRIMARY KEY (entity_id, chunk_id)
);

-- 6. Audit Logs Table (Append-Only Change Tracking & Governance)
CREATE TABLE IF NOT EXISTS entity_audit_logs (
    log_id SERIAL PRIMARY KEY,
    entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- MERGE_ENTITY, ALIAS_UPDATE, MODERN_OVERRIDE, CONFLICT_RESOLVE
    modified_by TEXT DEFAULT 'SYSTEM',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    previous_state JSONB DEFAULT '{}'::jsonb,
    new_state JSONB DEFAULT '{}'::jsonb,
    rationale TEXT
);

-- 7. Orchestrator State Checkpoints Table (LangGraph Persistence)
CREATE TABLE IF NOT EXISTS orchestrator_checkpoints (
    project_id TEXT PRIMARY KEY,
    current_step INT NOT NULL,
    status TEXT NOT NULL,
    state_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Quarantine Triples Table (Low confidence / unverified triples isolated from Production GraphRAG)
CREATE TABLE IF NOT EXISTS quarantine_triples (
    id SERIAL PRIMARY KEY,
    source_entity_id TEXT,
    target_entity_id TEXT,
    source_name TEXT,
    target_name TEXT,
    relation_type TEXT,
    confidence REAL DEFAULT 0.0,
    chunk_id TEXT,
    reason TEXT NOT NULL, -- LOW_CONFIDENCE, UNMAPPED_SOURCE, UNMAPPED_TARGET, DANGLING_RELATION, GENERIC_TERM
    status TEXT DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, APPROVED, REJECTED
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Unmapped Entities Table (Entities encountered in raw text without master ontology mapping)
CREATE TABLE IF NOT EXISTS unmapped_entities (
    id TEXT PRIMARY KEY,
    raw_name TEXT NOT NULL,
    inferred_type TEXT NOT NULL,
    occurrence_count INT DEFAULT 1,
    sample_context TEXT,
    chunk_id TEXT,
    status TEXT DEFAULT 'PENDING_TRIAGE', -- PENDING_TRIAGE, MAPPED_TO_ALIAS, DISCARDED_AS_NOISE, PROMOTED
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Conversations Table (Multi-turn Chat Persistence)
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    mode TEXT DEFAULT 'RESEARCH',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Conversation Messages Table (Chat Turns & Grounded Citations)
CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    intent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Video Briefs Table (Compiled Research Briefs for 1-Click Studio Handover)
CREATE TABLE IF NOT EXISTS video_briefs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
    project_id TEXT,
    topic TEXT NOT NULL,
    summary TEXT NOT NULL,
    key_entities JSONB DEFAULT '[]'::jsonb,
    citations JSONB DEFAULT '[]'::jsonb,
    target_duration_sec INT DEFAULT 60,
    aspect_ratio TEXT DEFAULT '16:9',
    narrative_tone TEXT DEFAULT 'epic',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migrations for existing tables (Upgrading to TEXT type for zero length restrictions)
ALTER TABLE document_chunks DROP COLUMN IF EXISTS tsv;

ALTER TABLE entities ALTER COLUMN id TYPE TEXT;
ALTER TABLE entities ALTER COLUMN name TYPE TEXT;
ALTER TABLE entities ALTER COLUMN type TYPE TEXT;
ALTER TABLE relationships ALTER COLUMN source_entity_id TYPE TEXT;
ALTER TABLE relationships ALTER COLUMN target_entity_id TYPE TEXT;
ALTER TABLE relationships ALTER COLUMN relation_type TYPE TEXT;
ALTER TABLE document_chunks ALTER COLUMN id TYPE TEXT;
ALTER TABLE document_chunks ALTER COLUMN title TYPE TEXT;
ALTER TABLE document_chunks ALTER COLUMN parent_chunk_id TYPE TEXT;
ALTER TABLE document_chunks ALTER COLUMN dynasty TYPE TEXT;
ALTER TABLE document_chunks ALTER COLUMN location TYPE TEXT;
ALTER TABLE entity_chunks ALTER COLUMN entity_id TYPE TEXT;
ALTER TABLE entity_chunks ALTER COLUMN chunk_id TYPE TEXT;
ALTER TABLE entity_audit_logs ALTER COLUMN entity_id TYPE TEXT;

ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || text_content)) STORED;

-- 13. Indexes
CREATE INDEX IF NOT EXISTS idx_entities_aliases ON entities USING GIN (aliases);

CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships (source_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships (target_entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships (relation_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rel_unique ON relationships (source_entity_id, target_entity_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_entity_chunks_chunk_id ON entity_chunks (chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunks_reliability ON document_chunks (source_reliability);
CREATE INDEX IF NOT EXISTS idx_chunks_epoch_ids ON document_chunks USING GIN (epoch_ids);
CREATE INDEX IF NOT EXISTS idx_chunks_temporal_range ON document_chunks (time_start, time_end) WHERE time_start IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_dynasty_temporal ON document_chunks (dynasty, time_start, time_end);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
ON document_chunks USING hnsw (embedding vector_cosine_ops) 
WITH (m = 32, ef_construction = 128);

CREATE INDEX IF NOT EXISTS idx_chunks_fts ON document_chunks USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON entity_audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_status ON orchestrator_checkpoints (status);
CREATE INDEX IF NOT EXISTS idx_quarantine_reason ON quarantine_triples (reason);
CREATE INDEX IF NOT EXISTS idx_quarantine_status ON quarantine_triples (status);
CREATE INDEX IF NOT EXISTS idx_unmapped_status ON unmapped_entities (status);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations (created_at);
CREATE INDEX IF NOT EXISTS idx_conv_messages_cid ON conversation_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON conversation_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_video_briefs_cid ON video_briefs (conversation_id);
CREATE INDEX IF NOT EXISTS idx_video_briefs_proj ON video_briefs (project_id);
`;

