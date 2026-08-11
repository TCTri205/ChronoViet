/**
 * Dual-Branch Ingestion Pipeline (Vector Branch + Graph Branch + Cross-linking Junction)
 */

import { isPgAvailable, query, inMemoryStore, DbEntity, DbRelationship, DbDocumentChunk } from '../db/client.js';
import { preprocessDocumentText } from './text-cleaner.js';
import { chunkDocument, ProcessedChunk } from './chunker.js';
import { resolveCanonicalEntity } from './entity-disambiguator.js';
import { extractTriplesFromText, ExtractedTriple } from './triple-extractor.js';
import { generateEmbedding } from './embedding-service.js';

export interface IngestionMetadata {
  title: string;
  source: string;
  dynasty?: string;
  sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  pageNumber?: number;
}

export interface IngestionResult {
  title: string;
  parentChunksCount: number;
  childChunksCount: number;
  entitiesExtracted: number;
  triplesExtracted: number;
  chunksIngested: number;
}

export async function ingestDocument(
  content: string,
  metadata: IngestionMetadata
): Promise<IngestionResult> {
  const cleanedText = preprocessDocumentText(content);
  const { parentChunks, childChunks } = chunkDocument(cleanedText, {
    title: metadata.title,
    dynasty: metadata.dynasty,
    sourceReliability: metadata.sourceReliability,
    pageNumber: metadata.pageNumber,
  });

  const allChunks: ProcessedChunk[] = [...parentChunks, ...childChunks];
  const allTriples: ExtractedTriple[] = [];
  const entityMap = new Map<string, DbEntity>();

  // Process Chunks & Extract Triples
  for (const chunk of allChunks) {
    const triples = extractTriplesFromText(chunk.textContent);
    allTriples.push(...triples);

    for (const t of triples) {
      const srcEntity = resolveCanonicalEntity(t.sourceEntityName);
      entityMap.set(srcEntity.entityId, {
        id: srcEntity.entityId,
        name: srcEntity.canonicalName,
        type: srcEntity.type,
        aliases: srcEntity.aliases,
        metadata: {},
      });

      if (t.targetEntityId !== 'doc:historical_context') {
        const tgtEntity = resolveCanonicalEntity(t.targetEntityName);
        entityMap.set(tgtEntity.entityId, {
          id: tgtEntity.entityId,
          name: tgtEntity.canonicalName,
          type: tgtEntity.type,
          aliases: tgtEntity.aliases,
          metadata: {},
        });
      }
    }
  }

  const pgConnected = await isPgAvailable();

  if (pgConnected) {
    // 1. Ingest Entities
    for (const entity of entityMap.values()) {
      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET aliases = EXCLUDED.aliases;`,
        [entity.id, entity.name, entity.type, entity.aliases, JSON.stringify(entity.metadata)]
      );
    }

    // 2. Ingest Triples (Relationships)
    for (const triple of allTriples) {
      if (triple.targetEntityId === 'doc:historical_context') continue;
      await query(
        `INSERT INTO relationships (source_entity_id, target_entity_id, relation_type, confidence)
         VALUES ($1, $2, $3, $4);`,
        [triple.sourceEntityId, triple.targetEntityId, triple.relationType, triple.confidence]
      );
    }

    // 3. Ingest Document Chunks & Embeddings
    for (const chunk of allChunks) {
      const emb = await generateEmbedding(chunk.textContent);
      await query(
        `INSERT INTO document_chunks (id, title, text_content, dynasty, source_reliability, parent_chunk_id, time_start, time_end, key_figures, location, page_number, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector)
         ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content;`,
        [
          chunk.id,
          chunk.title,
          chunk.textContent,
          chunk.metadata.dynasty,
          chunk.metadata.sourceReliability,
          chunk.metadata.parentChunkId || null,
          chunk.metadata.timeStart || null,
          chunk.metadata.timeEnd || null,
          chunk.metadata.keyFigures,
          chunk.metadata.location || null,
          chunk.metadata.pageNumber || null,
          JSON.stringify(emb),
        ]
      );

      // 4. Ingest Entity-Chunk Cross Links
      for (const entityId of entityMap.keys()) {
        await query(
          `INSERT INTO entity_chunks (entity_id, chunk_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING;`,
          [entityId, chunk.id]
        );
      }
    }
  } else {
    // In-Memory Fallback Ingestion
    for (const entity of entityMap.values()) {
      inMemoryStore.entities.set(entity.id, entity);
    }

    for (const triple of allTriples) {
      if (triple.targetEntityId === 'doc:historical_context') continue;
      inMemoryStore.relationships.push({
        id: inMemoryStore.nextRelId++,
        source_entity_id: triple.sourceEntityId,
        target_entity_id: triple.targetEntityId,
        relation_type: triple.relationType,
        confidence: triple.confidence,
      });
    }

    for (const chunk of allChunks) {
      const emb = await generateEmbedding(chunk.textContent);
      const dbChunk: DbDocumentChunk = {
        id: chunk.id,
        title: chunk.title,
        text_content: chunk.textContent,
        dynasty: chunk.metadata.dynasty,
        source_reliability: chunk.metadata.sourceReliability,
        parent_chunk_id: chunk.metadata.parentChunkId,
        time_start: chunk.metadata.timeStart,
        time_end: chunk.metadata.timeEnd,
        key_figures: chunk.metadata.keyFigures,
        location: chunk.metadata.location,
        page_number: chunk.metadata.pageNumber,
        embedding: emb,
      };
      inMemoryStore.documentChunks.set(chunk.id, dbChunk);

      for (const entityId of entityMap.keys()) {
        inMemoryStore.entityChunks.push({ entity_id: entityId, chunk_id: chunk.id });
      }
    }
  }

  return {
    title: metadata.title,
    parentChunksCount: parentChunks.length,
    childChunksCount: childChunks.length,
    entitiesExtracted: entityMap.size,
    triplesExtracted: allTriples.length,
    chunksIngested: allChunks.length,
  };
}
