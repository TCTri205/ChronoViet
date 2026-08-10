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
    type VARCHAR(64) NOT NULL, -- Person, Event, Location, Dynasty, TimePeriod
    aliases TEXT[], -- Alias Table for Fuzzy Fact-Checking
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Relationships Table (Graph Edges)
CREATE TABLE IF NOT EXISTS relationships (
    id SERIAL PRIMARY KEY,
    source_entity_id VARCHAR(128) REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id VARCHAR(128) REFERENCES entities(id) ON DELETE CASCADE,
    relation_type VARCHAR(64) NOT NULL, -- PART_OF, LED_BY, HAPPENED_IN, HAPPENED_AT, ALIAS_OF
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Document Chunks Table (Vector Store - 1024d BGE-M3)
CREATE TABLE IF NOT EXISTS document_chunks (
    id VARCHAR(128) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    text_content TEXT NOT NULL,
    dynasty VARCHAR(64),
    source_reliability VARCHAR(32) DEFAULT 'LEVEL_1',
    embedding vector(1024),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Entity-Chunk Junction Table (Cross-linking Graph & Vector)
CREATE TABLE IF NOT EXISTS entity_chunks (
    entity_id VARCHAR(128) REFERENCES entities(id) ON DELETE CASCADE,
    chunk_id VARCHAR(128) REFERENCES document_chunks(id) ON DELETE CASCADE,
    PRIMARY KEY (entity_id, chunk_id)
);

-- 6. HNSW Vector Index on pgvector Column
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
ON document_chunks USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
`;
