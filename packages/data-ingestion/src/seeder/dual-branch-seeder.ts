/**
 * Dual-Branch Parallel Ingestion Seeder (Vector Branch + Knowledge Graph Branch + Junction Table)
 * Component 4 of Module 0 Data Preprocessing & Ingestion ETL Engine
 */

import { promises as fs } from 'fs';
import path from 'path';
import { IIngestionPipeline, IngestionOptions, IngestionResult, SourceReliability, createLogger, envConfig } from '@chronoviet/shared-spec';
import { isPgAvailable, query, withTransaction, inMemoryStore, DbEntity, DbDocumentChunk, resolveHistoricalEpochs } from '@chronoviet/shared-spec';
import { normalizeText } from '../text/text-normalizer.js';
import { chunkDocumentHierarchical, ProcessedHierarchicalChunk } from '../chunking/hierarchical-chunker.js';
import { resolveCanonicalEntity, resolveLocationMapping } from '../text/historical-entity-mapper.js';
import { extractTriplesFromTextAsync, ExtractedTriple } from '../triple-extractor.js';
import { generateEmbedding } from '../embedding-service.js';
import { PdfExtractor } from '../pdf/pdf-extractor.js';

const log = createLogger({ service: 'data-ingestion' });

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
 * Helper to parse YAML frontmatter from Markdown text if present
 */
function parseFrontmatter(rawText: string): { body: string; metadata: Record<string, string> } {
  if (!rawText.startsWith('---')) {
    return { body: rawText, metadata: {} };
  }

  const endIdx = rawText.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { body: rawText, metadata: {} };
  }

  const frontmatterStr = rawText.substring(3, endIdx).trim();
  const body = rawText.substring(endIdx + 4).trim();
  const metadata: Record<string, string> = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      let val = line.substring(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      metadata[key] = val;
    }
  }

  return { body, metadata };
}

/**
 * Executes parallel seeding for Vector Store and Knowledge Graph Store
 */
export async function seedDualBranch(
  content: string,
  metadata: IngestionDocMetadata,
  options?: { strict?: boolean }
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
    const triples = await extractTriplesFromTextAsync(chunk.textContent, options);
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
        entityMap.set(figureEntity.entityId, {
          id: figureEntity.entityId,
          name: figureEntity.canonicalName,
          type: figureEntity.type,
          aliases: figureEntity.aliases,
          metadata: {},
        });
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

  // Eval Integrity: strict mode requires real Postgres — in-memory seeding is not a valid benchmark
  if (envConfig.EVAL_STRICT && !pgConnected) {
    throw new Error('[EVAL_STRICT] PostgreSQL is unavailable — Dual-Branch seeding requires real pgvector DB during evaluation');
  }

  if (pgConnected) {
    // 3. PostgreSQL Ingestion Mode (Transactional using dedicated pool client)
    await withTransaction(async (execQuery) => {
      // 3a. Batch Ingest Graph Entities (200 entities per batch)
      const allEntities = Array.from(entityMap.values());
      for (let i = 0; i < allEntities.length; i += 200) {
        const batch = allEntities.slice(i, i + 200);
        const values: unknown[] = [];
        const valueRows: string[] = [];
        batch.forEach((entity, idx) => {
          const offset = idx * 5;
          valueRows.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
          values.push(entity.id, entity.name, entity.type, entity.aliases, JSON.stringify(entity.metadata));
        });
        if (valueRows.length > 0) {
          await execQuery(
            `INSERT INTO entities (id, name, type, aliases, metadata)
             VALUES ${valueRows.join(', ')}
             ON CONFLICT (id) DO UPDATE SET aliases = EXCLUDED.aliases;`,
            values
          );
        }
      }

      // 3b. Batch Ingest Graph Relationships (Triples) (200 triples per batch)
      const uniqueTriplesMap = new Map<string, ExtractedTriple>();
      for (const t of allTriples) {
        if (t.targetEntityId === 'doc:historical_context') continue;
        const key = `${t.sourceEntityId}|${t.targetEntityId}|${t.relationType}`;
        const existing = uniqueTriplesMap.get(key);
        if (!existing || t.confidence > existing.confidence) {
          uniqueTriplesMap.set(key, t);
        }
      }
      const validTriples = Array.from(uniqueTriplesMap.values());

      for (let i = 0; i < validTriples.length; i += 200) {
        const batch = validTriples.slice(i, i + 200);
        const values: unknown[] = [];
        const valueRows: string[] = [];
        batch.forEach((triple, idx) => {
          const offset = idx * 4;
          valueRows.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
          values.push(triple.sourceEntityId, triple.targetEntityId, triple.relationType, triple.confidence);
        });
        if (valueRows.length > 0) {
          await execQuery(
            `INSERT INTO relationships (source_entity_id, target_entity_id, relation_type, confidence)
             VALUES ${valueRows.join(', ')}
             ON CONFLICT (source_entity_id, target_entity_id, relation_type) DO UPDATE SET confidence = EXCLUDED.confidence;`,
            values
          );
        }
      }

      // 3c. Batch Ingest Document Chunks & Vector Embeddings (100 chunks per batch)
      for (let i = 0; i < chunkEmbeddings.length; i += 100) {
        const batch = chunkEmbeddings.slice(i, i + 100);
        const values: unknown[] = [];
        const valueRows: string[] = [];
        batch.forEach(({ chunk, embedding }, idx) => {
          const offset = idx * 13;
          const epochIds = chunk.metadata.epochIds && chunk.metadata.epochIds.length > 0
            ? chunk.metadata.epochIds
            : resolveHistoricalEpochs(chunk.metadata.timeStart, chunk.metadata.timeEnd);

          valueRows.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}::vector)`
          );
          values.push(
            chunk.id,
            chunk.title,
            chunk.textContent,
            chunk.metadata.dynasty,
            epochIds,
            chunk.metadata.sourceReliability,
            chunk.metadata.parentChunkId || null,
            chunk.metadata.timeStart || null,
            chunk.metadata.timeEnd || null,
            chunk.metadata.keyFigures || [],
            chunk.metadata.location || null,
            chunk.metadata.pageNumber || null,
            JSON.stringify(embedding)
          );
        });

        if (valueRows.length > 0) {
          await execQuery(
            `INSERT INTO document_chunks (
              id, title, text_content, dynasty, epoch_ids, source_reliability, parent_chunk_id,
              time_start, time_end, key_figures, location, page_number, embedding
             )
             VALUES ${valueRows.join(', ')}
             ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content, embedding = EXCLUDED.embedding, epoch_ids = EXCLUDED.epoch_ids;`,
            values
          );
        }
      }

      // 3d. Batch Ingest Entity-Chunk Cross-Links (500 cross-links per batch)
      const entityChunkSet = new Set<string>();
      const allEntityChunks: { entityId: string; chunkId: string }[] = [];
      for (const [chunkId, entityIds] of chunkEntityMap.entries()) {
        for (const entityId of entityIds) {
          const key = `${entityId}|${chunkId}`;
          if (!entityChunkSet.has(key)) {
            entityChunkSet.add(key);
            allEntityChunks.push({ entityId, chunkId });
          }
        }
      }
      for (let i = 0; i < allEntityChunks.length; i += 500) {
        const batch = allEntityChunks.slice(i, i + 500);
        const values: unknown[] = [];
        const valueRows: string[] = [];
        batch.forEach((ec, idx) => {
          const offset = idx * 2;
          valueRows.push(`($${offset + 1}, $${offset + 2})`);
          values.push(ec.entityId, ec.chunkId);
        });
        if (valueRows.length > 0) {
          await execQuery(
            `INSERT INTO entity_chunks (entity_id, chunk_id)
             VALUES ${valueRows.join(', ')}
             ON CONFLICT DO NOTHING;`,
            values
          );
        }
      }
    });
  } else {
    // 4. In-Memory Mock Ingestion Fallback (for testing / eval environments)
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
      const epochIds = chunk.metadata.epochIds && chunk.metadata.epochIds.length > 0
        ? chunk.metadata.epochIds
        : resolveHistoricalEpochs(chunk.metadata.timeStart, chunk.metadata.timeEnd);

      const dbChunk: DbDocumentChunk = {
        id: chunk.id,
        title: chunk.title,
        text_content: chunk.textContent,
        dynasty: chunk.metadata.dynasty,
        epoch_ids: epochIds,
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
        inMemoryStore.entityChunks.push({
          entity_id: entityId,
          chunk_id: chunk.id,
        });
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
 * Class wrapper implementing IIngestionPipeline
 */
export class DualBranchSeeder implements IIngestionPipeline {
  private pdfExtractor = new PdfExtractor();

  public async run(inputPath: string, options?: IngestionOptions & { strict?: boolean }): Promise<IngestionResult> {
    const startTime = Date.now();
    let documentsProcessed = 0;
    let chunksCreated = 0;
    let entitiesExtracted = 0;
    let relationshipsExtracted = 0;

    const stat = await fs.stat(inputPath);
    const filesToProcess: string[] = [];

    const collectFiles = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // If directory is raw pdf binary folder or legacy pdf_markdown duplicate, skip it in favor of pdf_extracted
          if (entry.name === 'pdf' || entry.name === 'pdf_markdown') {
            continue;
          }
          await collectFiles(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.pdf') {
            filesToProcess.push(fullPath);
          }
        }
      }
    };

    if (stat.isDirectory()) {
      await collectFiles(inputPath);
    } else {
      filesToProcess.push(inputPath);
    }

    for (const filePath of filesToProcess) {
      const baseName = path.basename(filePath, path.extname(filePath));
      const registeredMeta = this.pdfExtractor.getMetadata(baseName);

      let content = '';
      let title = registeredMeta.title;
      let dynasty: string | undefined = registeredMeta.dynasty;
      let sourceReliability: SourceReliability = registeredMeta.sourceReliability || 'LEVEL_1';

      if (filePath.endsWith('.pdf')) {
        const pdfBuf = await fs.readFile(filePath);
        const pdfResult = this.pdfExtractor.extract(pdfBuf, filePath);
        content = pdfResult.text;
        title = pdfResult.title;
        sourceReliability = pdfResult.sourceReliability;
      } else {
        const rawText = await fs.readFile(filePath, 'utf-8');
        const { body, metadata: fmMeta } = parseFrontmatter(rawText);
        content = body;

        if (fmMeta.title) title = fmMeta.title;
        if (fmMeta.dynasty) dynasty = fmMeta.dynasty;
        if (fmMeta.source_reliability === 'LEVEL_1' || fmMeta.source_reliability === 'LEVEL_2' || fmMeta.source_reliability === 'LEVEL_3') {
          sourceReliability = fmMeta.source_reliability;
        }

        if (filePath.endsWith('.json')) {
          try {
            const parsed = JSON.parse(rawText);
            content = parsed.content || parsed.text || rawText;
            title = parsed.title || title;
            dynasty = parsed.dynasty || dynasty;
          } catch (err) {
            log.warn('seeder.json_parse_fallback', 'JSON parse failed; using raw text body', { filePath, error: err });
            content = body;
          }
        }
      }

      if (!content || content.trim().length === 0) {
        log.warn('seeder.empty_document_skipped', 'Skipping empty document', { filePath });
        continue;
      }

      const seedResult = await seedDualBranch(
        content,
        {
          title,
          sourceName: baseName,
          dynasty,
          sourceReliability,
        },
        options
      );

      documentsProcessed++;
      chunksCreated += seedResult.chunksIngested;
      entitiesExtracted += seedResult.entitiesExtracted;
      relationshipsExtracted += seedResult.triplesExtracted;

      log.info('seeder.document_ingested', 'Document ingested into dual-branch store', {
        title,
        baseName,
        index: documentsProcessed,
        total: filesToProcess.length,
        chunks: seedResult.chunksIngested,
        entities: seedResult.entitiesExtracted,
        triples: seedResult.triplesExtracted,
        pgMode: seedResult.isPgMode,
      });
    }

    const durationMs = Date.now() - startTime;

    log.info('seeder.batch_completed', 'Dual-branch seeding batch completed', {
      documentsProcessed,
      chunksCreated,
      entitiesExtracted,
      relationshipsExtracted,
      durationMs,
    });

    return {
      documentsProcessed,
      chunksCreated,
      entitiesExtracted,
      relationshipsExtracted,
      durationMs,
    };
  }
}
