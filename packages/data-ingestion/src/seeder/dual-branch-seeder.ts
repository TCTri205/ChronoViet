/**
 * Dual-Branch Parallel Ingestion Seeder (Vector Branch + Knowledge Graph Branch + Junction Table)
 * Component 4 of Module 0 Data Preprocessing & Ingestion ETL Engine
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  IIngestionPipeline,
  IngestionOptions,
  IngestionResult,
  SourceReliability,
  IngestionExecutionTelemetry,
  resolveHistoricalEpochs,
  resolveCanonicalEntity,
  resolveLocationMapping,
  isKnownMasterEntity,
} from '@chronoviet/shared-spec';
import {
  createLogger,
  envConfig,
  isPgAvailable,
  query,
  withTransaction,
  inMemoryStore,
  DbEntity,
  DbDocumentChunk,
  DbQuarantineTriple,
  DbUnmappedEntity,
  generateEmbedding,
  generateEmbeddingsBatch,
  hybridInferenceDispatcher,
  formatConciseError,
} from '@chronoviet/infra';
import { IngestionMetricsCollector } from '../diagnostics/index.js';
import { normalizeText } from '../text/text-normalizer.js';
import { chunkDocumentHierarchical, ProcessedHierarchicalChunk } from '../chunking/hierarchical-chunker.js';
import {
  extractTriplesFromText,
  extractTriplesFromTextAsync,
  extractTriplesFromTextDetailedAsync,
  ExtractedTriple,
  ExtractionOptions,
} from '../triple-extractor.js';
import { PdfExtractor } from '../pdf/pdf-extractor.js';
import { parseFrontmatter } from '../utils/text-utils.js';
import { extractionCache } from '../cache/extraction-cache.js';

const log = createLogger({ service: 'data-ingestion' });

export const CONFIDENCE_PRODUCTION_THRESHOLD = 0.85;
export const EMBEDDING_SUB_BATCH_SIZE = 64;

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
  highConfidenceTriplesCount: number;
  quarantinedTriplesCount: number;
  unmappedEntitiesCount: number;
  chunksIngested: number;
  durationMs: number;
  isPgMode: boolean;
  correlationId?: string;
  telemetry?: IngestionExecutionTelemetry;
}

/**
 * Executes parallel seeding for Vector Store and Knowledge Graph Store
 */
export async function seedDualBranch(
  content: string,
  metadata: IngestionDocMetadata,
  options?: ExtractionOptions
): Promise<DualBranchSeedResult> {
  const startTime = Date.now();
  const metricsCollector = new IngestionMetricsCollector(options?.correlationId);
  const correlationId = metricsCollector.correlationId;

  try {
    const cleanedText = normalizeText(content);

  // 1. Dynamic Hierarchical Temporal Chunking
  metricsCollector.startStage('chunking');
  const { parentChunks, childChunks } = chunkDocumentHierarchical(cleanedText, {
    title: metadata.title,
    sourceName: metadata.sourceName,
    dynasty: metadata.dynasty,
    sourceReliability: metadata.sourceReliability,
    pageNumber: metadata.pageNumber,
    location: metadata.location,
    keyFigures: metadata.keyFigures,
  });
  metricsCollector.endStage('chunking');

  const allChunks: ProcessedHierarchicalChunk[] = [...parentChunks, ...childChunks];
  for (const chunk of allChunks) {
    const wordCount = chunk.textContent ? chunk.textContent.split(/\s+/).filter(Boolean).length : 0;
    metricsCollector.recordChunk(wordCount);
  }

  const allTriples: ExtractedTriple[] = [];
  const entityMap = new Map<string, DbEntity>();
  const productionTriplesMap = new Map<string, ExtractedTriple>();
  const quarantineTriplesList: DbQuarantineTriple[] = [];
  const unmappedEntitiesMap = new Map<string, DbUnmappedEntity>();

  const isVectorOnly = options?.stage === 'vector';
  const isGraphOnly = options?.stage === 'graph';

  // 2. Hierarchical Chunk Triple Extraction with Controlled Concurrency Pool
  const chunkEntityMap = new Map<string, Set<string>>(); // chunkId -> Set of entityIds

  interface ChunkExtractionResult {
    chunk: ProcessedHierarchicalChunk;
    triples: ExtractedTriple[];
  }

  const chunkResults: ChunkExtractionResult[] = new Array(allChunks.length);
  const failedExtractionChunkIds: string[] = [];

  metricsCollector.startStage('extraction');

  // Stage 1 Fast-Path NER for Parent Chunks (2,000–3,000 words) — Entity linking only (No unverified rule triples for KG)
  log.info(
    'dual_branch_seeder.parent_chunks_ner',
    `Processed ${parentChunks.length} parent chunks via Stage 1 Fast-Path NER (<1ms/chunk)`,
    { correlationId, parentChunksCount: parentChunks.length }
  );
  for (let i = 0; i < parentChunks.length; i++) {
    const parentChunk = parentChunks[i];
    const parentTriples = options?.regexOnly ? extractTriplesFromText(parentChunk.textContent) : [];
    chunkResults[i] = { chunk: parentChunk, triples: parentTriples };
  }

  if (isVectorOnly) {
    // Fast Path: Stage 1 Pure TS NER for Child Chunks (Bypass LLM, Vector only)
    log.info(
      'dual_branch_seeder.stage_vector_only',
      `Stage 1 (Vector): Extracting Fast NER candidate entities for ${childChunks.length} child chunks (LLM bypassed)`,
      { correlationId, childChunksCount: childChunks.length }
    );
    for (let i = 0; i < childChunks.length; i++) {
      const childChunk = childChunks[i];
      const childTriples = options?.regexOnly ? extractTriplesFromText(childChunk.textContent) : [];
      chunkResults[parentChunks.length + i] = { chunk: childChunk, triples: childTriples };
    }
  } else if (childChunks.length > 0) {
    // Stage 2 (or Full): Parallel Child Chunk Triple Extraction via LLM / Cache
    const activeTargetsCount = hybridInferenceDispatcher.getActiveTargets('llm').length;
    const isLocalOnlyMode =
      envConfig.INFERENCE_ROUTING_MODE === 'local_only' ||
      (!envConfig.ENABLE_CLOUD_FALLBACK && envConfig.USE_LOCAL_LLM) ||
      activeTargetsCount <= 1;

    const concurrency = isLocalOnlyMode
      ? Math.min(16, Math.max(1, envConfig.LOCAL_LLM_EXTRACTION_PARALLEL || envConfig.LOCAL_LLM_MAX_CONCURRENCY || 4))
      : Math.min(16, Math.max(1, activeTargetsCount));

    log.info(
      'dual_branch_seeder.extract_triples_parallel',
      `Extracting triples for ${childChunks.length} child chunks with concurrency=${concurrency} (activeTargets=${activeTargetsCount})`,
      { correlationId, childChunksCount: childChunks.length, concurrency, activeTargetsCount }
    );

    let nextChildIndex = 0;
    let completedChildChunks = 0;

    async function childExtractionWorker() {
      while (nextChildIndex < childChunks.length) {
        const childIdx = nextChildIndex++;
        const chunk = childChunks[childIdx];
        const resultIdx = parentChunks.length + childIdx;
        const chunkStartTime = Date.now();

        try {
          const triples = await extractTriplesFromTextAsync(chunk.textContent, {
            ...options,
            chunkId: chunk.id,
          });
          chunkResults[resultIdx] = { chunk, triples };
          completedChildChunks++;

          const meta = (triples as any)?._meta;
          const isCached = meta?.cached === true;
          metricsCollector.recordCache(isCached);

          const percent = ((completedChildChunks / childChunks.length) * 100).toFixed(1);
          const providerName = meta?.provider || (isCached ? 'CACHED' : 'LOCAL_LLM');
          const modelName = meta?.model ? ` (${meta.model})` : '';
          const chunkDurationMs = (meta?.durationMs) ?? (Date.now() - chunkStartTime);
          const chunkSec = (chunkDurationMs / 1000).toFixed(1);

          if (isCached) {
            log.info(
              'dual_branch_seeder.chunk_cached',
              `Child Chunk [${completedChildChunks}/${childChunks.length}] (${percent}%) -> ${triples.length} triples via [${providerName}${modelName}] (CACHED / RESUMED)`,
              {
                correlationId,
                chunkIndex: completedChildChunks,
                childChunksCount: childChunks.length,
                chunkId: chunk.id,
                triplesCount: triples.length,
                provider: providerName,
                model: meta?.model || 'CACHE',
                cached: true,
              }
            );
          } else {
            log.info(
              'dual_branch_seeder.chunk_success',
              `Child Chunk [${completedChildChunks}/${childChunks.length}] (${percent}%) -> ${triples.length} triples via [${providerName}${modelName}] in ${chunkSec}s`,
              {
                correlationId,
                chunkIndex: completedChildChunks,
                childChunksCount: childChunks.length,
                chunkId: chunk.id,
                triplesCount: triples.length,
                provider: providerName,
                model: meta?.model || 'UNKNOWN',
                strategy: meta?.strategy || 'ensemble_ai',
                durationMs: chunkDurationMs,
              }
            );
          }
        } catch (err: any) {
          completedChildChunks++;
          const percent = ((completedChildChunks / childChunks.length) * 100).toFixed(1);
          const conciseErrMsg = formatConciseError(err);
          failedExtractionChunkIds.push(chunk.id);

          const isStrictQuality = options?.strict !== false && (options?.strict === true || envConfig.EVAL_STRICT || !options?.allowFallback);

          if (isStrictQuality) {
            log.error(
              'dual_branch_seeder.chunk_failed_strict',
              `Child Chunk [${completedChildChunks}/${childChunks.length}] (${percent}%) -> LLM extraction failed for [${chunk.id}] in STRICT mode: ${conciseErrMsg}. (Rule fallback rejected to maintain knowledge integrity)`,
              {
                correlationId,
                chunkIndex: completedChildChunks,
                childChunksCount: childChunks.length,
                chunkId: chunk.id,
                error: conciseErrMsg,
              }
            );
            chunkResults[resultIdx] = { chunk, triples: [] };
          } else {
            const fallbackTriples = extractTriplesFromText(chunk.textContent);
            log.warn(
              'dual_branch_seeder.chunk_failed_salvaged',
              `Child Chunk [${completedChildChunks}/${childChunks.length}] (${percent}%) -> LLM extraction failed for [${chunk.id}]: ${conciseErrMsg}. Salvaged ${fallbackTriples.length} rule-based triples (--allow-fallback).`,
              {
                correlationId,
                chunkIndex: completedChildChunks,
                childChunksCount: childChunks.length,
                chunkId: chunk.id,
                error: conciseErrMsg,
                salvagedCount: fallbackTriples.length,
              }
            );
            chunkResults[resultIdx] = { chunk, triples: fallbackTriples };
          }
        }
      }
    }

    const workerCount = Math.min(concurrency, childChunks.length);
    const workers = Array.from({ length: workerCount }, () => childExtractionWorker());
    await Promise.all(workers);
  }

  metricsCollector.endStage('extraction');

  // 3. Single-Thread Deterministic Aggregation
  for (const item of chunkResults) {
    if (!item) continue;
    const { chunk, triples } = item;
    allTriples.push(...triples);

    const chunkEntityIds = new Set<string>();

    for (const t of triples) {
      const srcEntity = resolveCanonicalEntity(t.sourceEntityName);
      const isSrcMaster = isKnownMasterEntity(t.sourceEntityName);
      if (!isSrcMaster) {
        const existing = unmappedEntitiesMap.get(srcEntity.entityId);
        unmappedEntitiesMap.set(srcEntity.entityId, {
          id: srcEntity.entityId,
          raw_name: t.sourceEntityName,
          inferred_type: srcEntity.type,
          occurrence_count: (existing?.occurrence_count || 0) + 1,
          sample_context: chunk.textContent.slice(0, 300),
          chunk_id: chunk.id,
          status: 'PENDING_TRIAGE',
        });
      }

      let isTgtMaster = false;
      let tgtEntity: ReturnType<typeof resolveCanonicalEntity> | null = null;
      if (t.targetEntityId !== 'doc:historical_context') {
        tgtEntity = resolveCanonicalEntity(t.targetEntityName);
        isTgtMaster = isKnownMasterEntity(t.targetEntityName);
        if (!isTgtMaster) {
          const existing = unmappedEntitiesMap.get(tgtEntity.entityId);
          unmappedEntitiesMap.set(tgtEntity.entityId, {
            id: tgtEntity.entityId,
            raw_name: t.targetEntityName,
            inferred_type: tgtEntity.type,
            occurrence_count: (existing?.occurrence_count || 0) + 1,
            sample_context: chunk.textContent.slice(0, 300),
            chunk_id: chunk.id,
            status: 'PENDING_TRIAGE',
          });
        }
      }

      // Quality Validation Gate: Route to Quarantine or Production Graph
      if (tgtEntity && srcEntity.entityId === tgtEntity.entityId) {
        metricsCollector.recordQuarantine('SELF_LOOP');
        quarantineTriplesList.push({
          source_entity_id: srcEntity.entityId,
          target_entity_id: tgtEntity.entityId,
          source_name: t.sourceEntityName,
          target_name: t.targetEntityName,
          relation_type: t.relationType,
          confidence: t.confidence,
          chunk_id: chunk.id,
          reason: 'SELF_LOOP',
          status: 'REJECTED',
          metadata: { note: 'Self-loop relationship excluded from production graph' },
        });
      } else if (t.confidence < CONFIDENCE_PRODUCTION_THRESHOLD) {
        metricsCollector.recordQuarantine('LOW_CONFIDENCE');
        quarantineTriplesList.push({
          source_entity_id: srcEntity.entityId,
          target_entity_id: tgtEntity?.entityId || t.targetEntityId,
          source_name: t.sourceEntityName,
          target_name: t.targetEntityName,
          relation_type: t.relationType,
          confidence: t.confidence,
          chunk_id: chunk.id,
          reason: 'LOW_CONFIDENCE',
          status: 'PENDING_REVIEW',
          metadata: { threshold: CONFIDENCE_PRODUCTION_THRESHOLD },
        });
      } else if (t.targetEntityId === 'doc:historical_context' || !tgtEntity) {
        metricsCollector.recordQuarantine('DANGLING_RELATION');
        quarantineTriplesList.push({
          source_entity_id: srcEntity.entityId,
          target_entity_id: t.targetEntityId,
          source_name: t.sourceEntityName,
          target_name: t.targetEntityName,
          relation_type: t.relationType,
          confidence: t.confidence,
          chunk_id: chunk.id,
          reason: 'DANGLING_RELATION',
          status: 'PENDING_REVIEW',
        });
      } else {
        // High-confidence Verified Production Triple
        const key = `${srcEntity.entityId}|${tgtEntity.entityId}|${t.relationType}`;
        const existing = productionTriplesMap.get(key);
        if (!existing || t.confidence > existing.confidence) {
          productionTriplesMap.set(key, {
            ...t,
            sourceEntityId: srcEntity.entityId,
            targetEntityId: tgtEntity.entityId,
          });
        }

        // Register Production Entities
        entityMap.set(srcEntity.entityId, {
          id: srcEntity.entityId,
          name: srcEntity.canonicalName,
          type: srcEntity.type,
          aliases: srcEntity.aliases,
          metadata: {},
        });
        chunkEntityIds.add(srcEntity.entityId);

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

  // Pre-generate embeddings in bounded parallel batches to avoid overloading embedding server (Bypass if graph-only)
  metricsCollector.startStage('embedding');
  const chunkEmbeddings: { chunk: ProcessedHierarchicalChunk; embedding: number[] }[] = [];
  if (!isGraphOnly && allChunks.length > 0) {
    const chunkTexts = allChunks.map((c) => c.textContent);
    const totalBatches = Math.max(1, Math.ceil(chunkTexts.length / EMBEDDING_SUB_BATCH_SIZE));

    for (let b = 0; b < chunkTexts.length; b += EMBEDDING_SUB_BATCH_SIZE) {
      const batchIndex = Math.floor(b / EMBEDDING_SUB_BATCH_SIZE) + 1;
      const subBatchTexts = chunkTexts.slice(b, b + EMBEDDING_SUB_BATCH_SIZE);
      const subBatchChunks = allChunks.slice(b, b + EMBEDDING_SUB_BATCH_SIZE);
      const batchStartTime = Date.now();

      const vectors = await generateEmbeddingsBatch(subBatchTexts);
      const batchDurationMs = Date.now() - batchStartTime;
      metricsCollector.recordVectors(subBatchTexts.length, batchDurationMs);

      for (let i = 0; i < subBatchChunks.length; i++) {
        chunkEmbeddings.push({ chunk: subBatchChunks[i], embedding: vectors[i] });
      }

      const vectorsPerSec = batchDurationMs > 0 ? Number(((subBatchTexts.length / batchDurationMs) * 1000).toFixed(2)) : 0;

      log.info(
        'embedding.batch_completed',
        `Generated embeddings sub-batch [${batchIndex}/${totalBatches}] (${subBatchTexts.length} vectors) in ${batchDurationMs}ms (${vectorsPerSec} vec/s)`,
        {
          correlationId,
          batchIndex,
          totalBatches,
          batchSize: subBatchTexts.length,
          durationMs: batchDurationMs,
          vectorsPerSec,
        }
      );
    }
  }
  metricsCollector.endStage('embedding');

  const pgConnected = await isPgAvailable();

  // Eval Integrity: strict mode requires real Postgres — in-memory seeding is not a valid benchmark
  if (envConfig.EVAL_STRICT && !pgConnected) {
    throw new Error('[EVAL_STRICT] PostgreSQL is unavailable — Dual-Branch seeding requires real pgvector DB during evaluation');
  }

  metricsCollector.startStage('dbInsert');
  if (pgConnected) {
    // 3. PostgreSQL Ingestion Mode (Transactional using dedicated pool client)
    await withTransaction(async (execQuery: any) => {
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

      // 3b, 3c, 3d: Graph Relations, Quarantine, Unmapped Entities (Bypass if vector-only)
      if (!isVectorOnly) {
        // 3b. Batch Ingest Verified Graph Relationships (Triples) (200 triples per batch)
        const validTriples = Array.from(productionTriplesMap.values());

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

        // 3c. Batch Ingest Quarantine Triples (200 per batch)
        if (quarantineTriplesList.length > 0) {
          const chunkIds = Array.from(new Set(quarantineTriplesList.map((qt) => qt.chunk_id).filter((id): id is string => Boolean(id))));
          if (chunkIds.length > 0) {
            await execQuery(
              `DELETE FROM quarantine_triples WHERE chunk_id = ANY($1::text[]);`,
              [chunkIds]
            );
          }
        }
        for (let i = 0; i < quarantineTriplesList.length; i += 200) {
          const batch = quarantineTriplesList.slice(i, i + 200);
          const values: unknown[] = [];
          const valueRows: string[] = [];
          batch.forEach((qt, idx) => {
            const offset = idx * 10;
            valueRows.push(
              `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`
            );
            values.push(
              qt.source_entity_id || null,
              qt.target_entity_id || null,
              qt.source_name || null,
              qt.target_name || null,
              qt.relation_type || null,
              qt.confidence,
              qt.chunk_id || null,
              qt.reason,
              qt.status || 'PENDING_REVIEW',
              JSON.stringify(qt.metadata || {})
            );
          });
          if (valueRows.length > 0) {
            await execQuery(
              `INSERT INTO quarantine_triples (
                source_entity_id, target_entity_id, source_name, target_name,
                relation_type, confidence, chunk_id, reason, status, metadata
               ) VALUES ${valueRows.join(', ')};`,
              values
            );
          }
        }

        // 3d. Batch Ingest Unmapped Entities (200 per batch)
        const allUnmapped = Array.from(unmappedEntitiesMap.values());
        for (let i = 0; i < allUnmapped.length; i += 200) {
          const batch = allUnmapped.slice(i, i + 200);
          const values: unknown[] = [];
          const valueRows: string[] = [];
          batch.forEach((ue, idx) => {
            const offset = idx * 7;
            valueRows.push(
              `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
            );
            values.push(
              ue.id,
              ue.raw_name,
              ue.inferred_type,
              ue.occurrence_count || 1,
              ue.sample_context || null,
              ue.chunk_id || null,
              ue.status || 'PENDING_TRIAGE'
            );
          });
          if (valueRows.length > 0) {
            await execQuery(
              `INSERT INTO unmapped_entities (id, raw_name, inferred_type, occurrence_count, sample_context, chunk_id, status)
               VALUES ${valueRows.join(', ')}
               ON CONFLICT (id) DO UPDATE SET occurrence_count = unmapped_entities.occurrence_count + EXCLUDED.occurrence_count, updated_at = CURRENT_TIMESTAMP;`,
              values
            );
          }
        }
      }

      // 3e. Batch Ingest Document Chunks & Vector Embeddings (100 chunks per batch) (Bypass if graph-only)
      if (!isGraphOnly) {
        for (let i = 0; i < chunkEmbeddings.length; i += 100) {
          const batch = chunkEmbeddings.slice(i, i + 100);
          const values: unknown[] = [];
          const valueRows: string[] = [];
          batch.forEach(({ chunk, embedding }, idx) => {
            const offset = idx * 14;
            const epochIds = chunk.metadata.epochIds && chunk.metadata.epochIds.length > 0
              ? chunk.metadata.epochIds
              : resolveHistoricalEpochs(chunk.metadata.timeStart, chunk.metadata.timeEnd);

            valueRows.push(
              `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}::vector, $${offset + 14}::jsonb)`
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
              JSON.stringify(embedding),
              JSON.stringify(chunk.metadata || {})
            );
          });

          if (valueRows.length > 0) {
            await execQuery(
              `INSERT INTO document_chunks (
                id, title, text_content, dynasty, epoch_ids, source_reliability, parent_chunk_id,
                time_start, time_end, key_figures, location, page_number, embedding, metadata
               )
               VALUES ${valueRows.join(', ')}
               ON CONFLICT (id) DO UPDATE SET
                 title = EXCLUDED.title,
                 text_content = EXCLUDED.text_content,
                 dynasty = EXCLUDED.dynasty,
                 epoch_ids = EXCLUDED.epoch_ids,
                 source_reliability = EXCLUDED.source_reliability,
                 parent_chunk_id = EXCLUDED.parent_chunk_id,
                 time_start = EXCLUDED.time_start,
                 time_end = EXCLUDED.time_end,
                 key_figures = EXCLUDED.key_figures,
                 location = EXCLUDED.location,
                 page_number = EXCLUDED.page_number,
                 embedding = EXCLUDED.embedding,
                 metadata = EXCLUDED.metadata;`,
              values
            );
          }
        }
      }

      // 3f. Batch Ingest Entity-Chunk Cross-Links (500 cross-links per batch)
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

    // Refresh Materialized Views on PostgreSQL for instant GraphRAG lineage traversal (unless skipped in bulk batch mode)
    if (!options?.skipMvRefresh && !isVectorOnly && productionTriplesMap.size > 0) {
      try {
        await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dynasty_lineage_paths;`);
      } catch {
        try {
          await query(`REFRESH MATERIALIZED VIEW mv_dynasty_lineage_paths;`);
        } catch {
          // Graceful fallback if view is not initialized
        }
      }
    }
  } else {
    // 4. In-Memory Mock Ingestion Fallback (for testing / eval environments)
    for (const entity of entityMap.values()) {
      inMemoryStore.entities.set(entity.id, entity);
    }

    for (const triple of productionTriplesMap.values()) {
      inMemoryStore.relationships.push({
        id: inMemoryStore.nextRelId++,
        source_entity_id: triple.sourceEntityId,
        target_entity_id: triple.targetEntityId,
        relation_type: triple.relationType,
        confidence: triple.confidence,
      });
    }

    inMemoryStore.quarantineTriples.push(...quarantineTriplesList);
    for (const [id, ue] of unmappedEntitiesMap.entries()) {
      const existing = inMemoryStore.unmappedEntities.get(id);
      inMemoryStore.unmappedEntities.set(id, {
        ...ue,
        occurrence_count: (existing?.occurrence_count || 0) + (ue.occurrence_count || 1),
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
  metricsCollector.endStage('dbInsert');

  const durationMs = Date.now() - startTime;
  const telemetry = metricsCollector.getTelemetryReport(durationMs);

  log.info('ingest.doc_seeding_completed', 'Completed dual-branch seeding for document', {
    correlationId,
    title: metadata.title,
    parentChunks: parentChunks.length,
    childChunks: childChunks.length,
    entities: entityMap.size,
    triplesTotal: allTriples.length,
    highConfidenceTriples: productionTriplesMap.size,
    quarantinedTriples: quarantineTriplesList.length,
    unmappedEntities: unmappedEntitiesMap.size,
    failedExtractionChunks: failedExtractionChunkIds.length,
    durationMs,
    mode: pgConnected ? 'postgres_pgvector' : 'in_memory',
    throughput: telemetry.throughput,
  });

    return {
      title: metadata.title,
      parentChunksCount: parentChunks.length,
      childChunksCount: childChunks.length,
      entitiesExtracted: entityMap.size,
      triplesExtracted: allTriples.length,
      highConfidenceTriplesCount: productionTriplesMap.size,
      quarantinedTriplesCount: quarantineTriplesList.length,
      unmappedEntitiesCount: unmappedEntitiesMap.size,
      chunksIngested: allChunks.length,
      durationMs,
      isPgMode: pgConnected,
      correlationId,
      telemetry,
    };
  } catch (err) {
    log.error('ingest.doc_seeding_failed', 'Failed dual-branch seeding for document', {
      title: metadata.title,
      error: err,
    });
    throw err;
  }
}

/**
 * Class wrapper implementing IIngestionPipeline
 */
export class DualBranchSeeder implements IIngestionPipeline {
  private pdfExtractor = new PdfExtractor();

  public async run(inputPath: string, options?: IngestionOptions & ExtractionOptions): Promise<IngestionResult> {
    const startTime = Date.now();
    const batchCorrelationId = options?.correlationId || `batch-${Date.now()}`;
    let documentsProcessed = 0;
    let chunksCreated = 0;
    let entitiesExtracted = 0;
    let relationshipsExtracted = 0;
    let highConfidenceTriplesTotal = 0;
    let quarantinedTriplesTotal = 0;
    let unmappedEntitiesTotal = 0;
    let lastDocTelemetry: IngestionExecutionTelemetry | undefined;

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

      const wordCount = content.trim().split(/\s+/).length;
      if (wordCount < 15 && (content.includes('...') || content.toLowerCase().includes('chưa có nội dung') || content.toLowerCase().includes('trống'))) {
        log.warn('seeder.stub_skipped', 'Skipping placeholder/stub document', { filePath, wordCount });
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
        {
          ...options,
          skipMvRefresh: true, // Batch mode: skip per-doc MV refresh; refreshed once at end of batch
          correlationId: options?.correlationId || `${batchCorrelationId}-doc-${documentsProcessed + 1}`,
        }
      );

      documentsProcessed++;
      chunksCreated += seedResult.chunksIngested;
      entitiesExtracted += seedResult.entitiesExtracted;
      relationshipsExtracted += seedResult.triplesExtracted;
      highConfidenceTriplesTotal += seedResult.highConfidenceTriplesCount;
      quarantinedTriplesTotal += seedResult.quarantinedTriplesCount;
      unmappedEntitiesTotal += seedResult.unmappedEntitiesCount;
      lastDocTelemetry = seedResult.telemetry;

      if (documentsProcessed % 25 === 0) {
        const mem = process.memoryUsage();
        log.info('seeder.memory_heartbeat', 'Ingestion memory heartbeat', {
          docsProcessed: documentsProcessed,
          totalDocs: filesToProcess.length,
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          rssMb: Math.round(mem.rss / 1024 / 1024),
        });
        if (typeof (global as any).gc === 'function') {
          (global as any).gc();
        }
      }

      log.info('seeder.document_ingested', 'Document ingested into dual-branch store', {
        correlationId: seedResult.correlationId,
        title,
        baseName,
        index: documentsProcessed,
        total: filesToProcess.length,
        chunks: seedResult.chunksIngested,
        entities: seedResult.entitiesExtracted,
        verifiedTriples: seedResult.highConfidenceTriplesCount,
        quarantinedTriples: seedResult.quarantinedTriplesCount,
        unmappedEntities: seedResult.unmappedEntitiesCount,
        pgMode: seedResult.isPgMode,
      });
    }

    const durationMs = Date.now() - startTime;

    // Refresh Materialized Views for Lineage Graph CTE acceleration
    await refreshMaterializedViews();

    log.info('seeder.batch_completed', 'Dual-branch seeding batch completed', {
      correlationId: batchCorrelationId,
      documentsProcessed,
      chunksCreated,
      entitiesExtracted,
      relationshipsExtracted,
      highConfidenceTriplesTotal,
      quarantinedTriplesTotal,
      unmappedEntitiesTotal,
      durationMs,
    });

    return {
      documentsProcessed,
      chunksCreated,
      entitiesExtracted,
      relationshipsExtracted,
      durationMs,
      correlationId: batchCorrelationId,
      telemetry: lastDocTelemetry,
    };
  }
}

/**
 * Refreshes PostgreSQL Materialized Views for accelerated Graph Lineage traversals
 */
export async function refreshMaterializedViews(): Promise<boolean> {
  const pgUp = await isPgAvailable();
  if (!pgUp) return false;

  try {
    // Try concurrent refresh first (requires unique index and populated MV)
    await query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dynasty_lineage_paths;');
    log.info('seeder.mv_refreshed_concurrent', 'Materialized view mv_dynasty_lineage_paths refreshed concurrently');
    return true;
  } catch (err: any) {
    try {
      // Fallback to non-concurrent refresh (e.g. on initial unpopulated state)
      await query('REFRESH MATERIALIZED VIEW mv_dynasty_lineage_paths;');
      log.info('seeder.mv_refreshed_standard', 'Materialized view mv_dynasty_lineage_paths refreshed');
      return true;
    } catch (innerErr: any) {
      log.warn('seeder.mv_refresh_failed', `Failed to refresh materialized view: ${innerErr.message}`);
      return false;
    }
  }
}
