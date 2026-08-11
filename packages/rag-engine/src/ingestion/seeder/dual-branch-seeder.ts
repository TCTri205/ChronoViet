/**
 * Dual-Branch Parallel Ingestion Seeder (Vector Branch + Knowledge Graph Branch + Junction Table)
 * Component 4 of Module 0 Data Preprocessing & Ingestion ETL Engine
 */

import { promises as fs } from 'fs';
import path from 'path';
import { IIngestionPipeline, IngestionOptions, IngestionResult, SourceReliability } from '@chronoviet/shared-spec';
import { isPgAvailable, query, inMemoryStore, DbEntity, DbDocumentChunk } from '../../db/client.js';
import { normalizeText } from '../text/text-normalizer.js';
import { chunkDocumentHierarchical, ProcessedHierarchicalChunk } from '../chunking/hierarchical-chunker.js';
import { resolveCanonicalEntity, resolveLocationMapping } from '../text/historical-entity-mapper.js';
import { extractTriplesFromText, ExtractedTriple } from '../triple-extractor.js';
import { generateEmbedding } from '../embedding-service.js';

export interface IngestionDocMetadata {
  title: string;
  sourceName?: string;
  dynasty?: string;
  sourceReliability?: SourceReliability;
  pageNumber?: number;
  location?: string;
  keyFigures?: string[];
}

export interface DualBranchSeedResult {
  title: string;
  parentChunksCount: number;
  childChunksCount: number;
  entitiesExtracted: number;
  triplesExtracted: number;
  chunksIngested: number;
  durationMs: number;
  isPgMode: boolean;
}

/**
 * Executes parallel seeding for Vector Store and Knowledge Graph Store
 */
export async function seedDualBranch(
  content: string,
  metadata: IngestionDocMetadata
): Promise<DualBranchSeedResult> {
  const startTime = Date.now();
  const cleanedText = normalizeText(content);

  // 1. Dynamic Hierarchical Temporal Chunking
  const { parentChunks, childChunks } = chunkDocumentHierarchical(cleanedText, {
    title: metadata.title,
    sourceName: metadata.sourceName,
    dynasty: metadata.dynasty,
    sourceReliability: metadata.sourceReliability,
    pageNumber: metadata.pageNumber,
    location: metadata.location,
    keyFigures: metadata.keyFigures,
  });

  const allChunks: ProcessedHierarchicalChunk[] = [...parentChunks, ...childChunks];
  const allTriples: ExtractedTriple[] = [];
  const entityMap = new Map<string, DbEntity>();

  // 2. Extract Triples & Resolve Canonical Entities
  const chunkEntityMap = new Map<string, Set<string>>(); // chunkId -> Set of entityIds

  for (const chunk of allChunks) {
    const chunkEntityIds = new Set<string>();
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
      chunkEntityIds.add(srcEntity.entityId);

      if (t.targetEntityId !== 'doc:historical_context') {
        const tgtEntity = resolveCanonicalEntity(t.targetEntityName);
        entityMap.set(tgtEntity.entityId, {
          id: tgtEntity.entityId,
          name: tgtEntity.canonicalName,
          type: tgtEntity.type,
          aliases: tgtEntity.aliases,
          metadata: {},
        });
        chunkEntityIds.add(tgtEntity.entityId);
      }
    }

    // Process chunk location mapping if present
    if (chunk.metadata.location) {
      const locMapping = resolveLocationMapping(chunk.metadata.location);
      if (locMapping) {
        const canonicalLoc = resolveCanonicalEntity(locMapping.canonicalModernName);
        entityMap.set(canonicalLoc.entityId, {
          id: canonicalLoc.entityId,
          name: canonicalLoc.canonicalName,
          type: canonicalLoc.type,
          aliases: canonicalLoc.aliases,
          metadata: { historicalName: locMapping.historicalName, dynasty: locMapping.dynasty },
        });
        chunkEntityIds.add(canonicalLoc.entityId);
      }
    }

    // Include keyFigures if present in chunk metadata
    if (chunk.metadata.keyFigures) {
      for (const figure of chunk.metadata.keyFigures) {
        const figureEntity = resolveCanonicalEntity(figure);
        chunkEntityIds.add(figureEntity.entityId);
      }
    }

    chunkEntityMap.set(chunk.id, chunkEntityIds);
  }

  // Pre-generate embeddings in parallel batches for performance
  const chunkEmbeddings = await Promise.all(
    allChunks.map(async (chunk) => ({
      chunk,
      embedding: await generateEmbedding(chunk.textContent),
    }))
  );

  const pgConnected = await isPgAvailable();

  if (pgConnected) {
    // 3. PostgreSQL Ingestion Mode (Transactional)
    try {
      await query('BEGIN;');

      // 3a. Ingest Graph Entities
      for (const entity of entityMap.values()) {
        await query(
          `INSERT INTO entities (id, name, type, aliases, metadata)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET aliases = EXCLUDED.aliases;`,
          [entity.id, entity.name, entity.type, entity.aliases, JSON.stringify(entity.metadata)]
        );
      }

      // 3b. Ingest Graph Relationships (Triples)
      for (const triple of allTriples) {
        if (triple.targetEntityId === 'doc:historical_context') continue;
        await query(
          `INSERT INTO relationships (source_entity_id, target_entity_id, relation_type, confidence)
           VALUES ($1, $2, $3, $4);`,
          [triple.sourceEntityId, triple.targetEntityId, triple.relationType, triple.confidence]
        );
      }

      // 3c. Ingest Document Chunks & Vector Embeddings
      for (const { chunk, embedding } of chunkEmbeddings) {
        await query(
          `INSERT INTO document_chunks (
            id, title, text_content, dynasty, source_reliability, parent_chunk_id,
            time_start, time_end, key_figures, location, page_number, embedding
           )
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
            chunk.metadata.keyFigures || [],
            chunk.metadata.location || null,
            chunk.metadata.pageNumber || null,
            JSON.stringify(embedding),
          ]
        );

        // 3d. Ingest Entity-Chunk Cross-Links for THIS specific chunk
        const specificEntityIds = chunkEntityMap.get(chunk.id) || new Set<string>();
        for (const entityId of specificEntityIds) {
          await query(
            `INSERT INTO entity_chunks (entity_id, chunk_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING;`,
            [entityId, chunk.id]
          );
        }
      }

      await query('COMMIT;');
    } catch (dbErr) {
      await query('ROLLBACK;');
      throw dbErr;
    }
  } else {
    // 4. In-Memory Store Fallback Mode
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

    for (const { chunk, embedding } of chunkEmbeddings) {
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
        embedding,
      };
      inMemoryStore.documentChunks.set(chunk.id, dbChunk);

      const specificEntityIds = chunkEntityMap.get(chunk.id) || new Set<string>();
      for (const entityId of specificEntityIds) {
        inMemoryStore.entityChunks.push({ entity_id: entityId, chunk_id: chunk.id });
      }
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    title: metadata.title,
    parentChunksCount: parentChunks.length,
    childChunksCount: childChunks.length,
    entitiesExtracted: entityMap.size,
    triplesExtracted: allTriples.length,
    chunksIngested: allChunks.length,
    durationMs,
    isPgMode: pgConnected,
  };
}

/**
 * Class implementing IIngestionPipeline interface for batch ingestion from filesystem
 */
export class DualBranchSeeder implements IIngestionPipeline {
  async run(inputPath: string, _options?: IngestionOptions): Promise<IngestionResult> {
    const startTime = Date.now();
    let documentsProcessed = 0;
    let chunksCreated = 0;
    let entitiesExtracted = 0;
    let relationshipsExtracted = 0;

    const stat = await fs.stat(inputPath);
    const filesToProcess: string[] = [];

    if (stat.isDirectory()) {
      const entries = await fs.readdir(inputPath);
      for (const entry of entries) {
        if (entry.endsWith('.txt') || entry.endsWith('.md') || entry.endsWith('.json')) {
          filesToProcess.push(path.join(inputPath, entry));
        }
      }
    } else {
      filesToProcess.push(inputPath);
    }

    for (const filePath of filesToProcess) {
      const rawText = await fs.readFile(filePath, 'utf-8');
      const baseName = path.basename(filePath, path.extname(filePath));

      let content = rawText;
      let title = baseName;
      let dynasty: string | undefined;

      if (filePath.endsWith('.json')) {
        try {
          const parsed = JSON.parse(rawText);
          content = parsed.content || parsed.text || rawText;
          title = parsed.title || baseName;
          dynasty = parsed.dynasty;
        } catch (_err) {
          content = rawText;
        }
      }

      const seedResult = await seedDualBranch(content, {
        title,
        sourceName: baseName,
        dynasty,
        sourceReliability: 'LEVEL_1',
      });

      documentsProcessed++;
      chunksCreated += seedResult.chunksIngested;
      entitiesExtracted += seedResult.entitiesExtracted;
      relationshipsExtracted += seedResult.triplesExtracted;
    }

    const durationMs = Date.now() - startTime;

    return {
      documentsProcessed,
      chunksCreated,
      entitiesExtracted,
      relationshipsExtracted,
      durationMs,
    };
  }
}
