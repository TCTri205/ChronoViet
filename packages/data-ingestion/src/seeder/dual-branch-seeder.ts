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
} from '@chronoviet/shared-spec';
import {
  createLogger,
  envConfig,
  isPgAvailable,
  query,
} from '@chronoviet/infra';
import { IngestionMetricsCollector } from '../diagnostics/index.js';
import { normalizeText } from '../text/text-normalizer.js';
import { chunkDocumentHierarchical, ProcessedHierarchicalChunk } from '../chunking/hierarchical-chunker.js';
import {
  ExtractionOptions,
} from '../triple-extractor.js';
import { PdfExtractor } from '../pdf/pdf-extractor.js';
import { parseFrontmatter } from '../utils/text-utils.js';
import { ingestionManifest } from '../cache/ingestion-manifest.js';
import {
  CONFIDENCE_PRODUCTION_THRESHOLD,
  EMBEDDING_SUB_BATCH_SIZE,
  ChunkEmbeddingItem,
  ProcessedGraphData,
  prepareVectorChunksAndEmbeddings,
  processKnowledgeGraphTriples,
  persistToPostgresTransaction,
  persistToInMemoryStore,
} from './dual-branch-pipeline.js';

export {
  CONFIDENCE_PRODUCTION_THRESHOLD,
  EMBEDDING_SUB_BATCH_SIZE,
  ChunkEmbeddingItem,
  ProcessedGraphData,
  prepareVectorChunksAndEmbeddings,
  processKnowledgeGraphTriples,
  persistToPostgresTransaction,
  persistToInMemoryStore,
};

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

export interface DualBranchSeedOptions extends IngestionOptions, ExtractionOptions {
  docProgress?: {
    docNum: number;
    totalDocs: number;
    title: string;
  };
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
  options?: DualBranchSeedOptions
): Promise<DualBranchSeedResult> {
  const startTime = Date.now();
  const metricsCollector = new IngestionMetricsCollector(options?.correlationId);
  const correlationId = metricsCollector.correlationId;

  try {
    const cleanedText = normalizeText(content);
    const docPrefix = options?.docProgress
      ? `[Doc ${options.docProgress.docNum}/${options.docProgress.totalDocs}: ${options.docProgress.title}] `
      : '';

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

    const isVectorOnly = options?.stage === 'vector';
    const isGraphOnly = options?.stage === 'graph';

    // 2. Knowledge Graph Processing (Extraction, Canonicalization, Quarantine)
    const graphData = await processKnowledgeGraphTriples({
      parentChunks,
      childChunks,
      allChunks,
      isVectorOnly,
      docPrefix,
      correlationId,
      options,
      metricsCollector,
    });

    // 3. Vector Embeddings Generation
    const chunkEmbeddings = await prepareVectorChunksAndEmbeddings({
      allChunks,
      isGraphOnly,
      metricsCollector,
      docPrefix,
      correlationId,
    });

    // 4. Persistence (PostgreSQL or In-Memory)
    const pgConnected = await isPgAvailable();
    if (envConfig.EVAL_STRICT && !pgConnected) {
      throw new Error('[EVAL_STRICT] PostgreSQL is unavailable — Dual-Branch seeding requires real pgvector DB during evaluation');
    }

    metricsCollector.startStage('dbInsert');
    if (pgConnected) {
      await persistToPostgresTransaction({
        entityMap: graphData.entityMap,
        productionTriplesMap: graphData.productionTriplesMap,
        quarantineTriplesList: graphData.quarantineTriplesList,
        unmappedEntitiesMap: graphData.unmappedEntitiesMap,
        chunkEmbeddings,
        chunkEntityMap: graphData.chunkEntityMap,
        isVectorOnly,
        isGraphOnly,
        options,
      });
    } else {
      persistToInMemoryStore({
        entityMap: graphData.entityMap,
        productionTriplesMap: graphData.productionTriplesMap,
        quarantineTriplesList: graphData.quarantineTriplesList,
        unmappedEntitiesMap: graphData.unmappedEntitiesMap,
        chunkEmbeddings,
        chunkEntityMap: graphData.chunkEntityMap,
      });
    }
    metricsCollector.endStage('dbInsert');

    const durationMs = Date.now() - startTime;
    const telemetry = metricsCollector.getTelemetryReport(durationMs);

    log.info('ingest.doc_seeding_completed', `${docPrefix}Completed dual-branch seeding for document`, {
      correlationId,
      title: metadata.title,
      parentChunks: parentChunks.length,
      childChunks: childChunks.length,
      entities: graphData.entityMap.size,
      triplesTotal: graphData.allTriples.length,
      highConfidenceTriples: graphData.productionTriplesMap.size,
      quarantinedTriples: graphData.quarantineTriplesList.length,
      unmappedEntities: graphData.unmappedEntitiesMap.size,
      failedExtractionChunks: graphData.failedExtractionChunkIds.length,
      durationMs,
      mode: pgConnected ? 'postgres_pgvector' : 'in_memory',
      throughput: telemetry.throughput,
    });

    return {
      title: metadata.title,
      parentChunksCount: parentChunks.length,
      childChunksCount: childChunks.length,
      entitiesExtracted: graphData.entityMap.size,
      triplesExtracted: graphData.allTriples.length,
      highConfidenceTriplesCount: graphData.productionTriplesMap.size,
      quarantinedTriplesCount: graphData.quarantineTriplesList.length,
      unmappedEntitiesCount: graphData.unmappedEntitiesMap.size,
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

    filesToProcess.sort((a, b) => a.localeCompare(b));

    const totalDocs = filesToProcess.length;

    for (let docIdx = 0; docIdx < filesToProcess.length; docIdx++) {
      const filePath = filesToProcess[docIdx];
      const docNum = docIdx + 1;
      const baseName = path.basename(filePath, path.extname(filePath));
      const registeredMeta = this.pdfExtractor.getMetadata(baseName);

      let content = '';
      let title = registeredMeta.title;
      let dynasty: string | undefined = registeredMeta.dynasty;
      const isWikiPath = filePath.includes('/wiki/') || filePath.includes('\\wiki\\');
      let sourceReliability: SourceReliability = registeredMeta.sourceReliability || (isWikiPath ? 'LEVEL_2' : 'LEVEL_1');

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
        } else if (fmMeta.source_url && String(fmMeta.source_url).includes('wikipedia')) {
          sourceReliability = 'LEVEL_2';
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
        log.warn('seeder.empty_document_skipped', `[Doc ${docNum}/${totalDocs}: ${title || baseName}] Skipping empty document`, { filePath });
        continue;
      }

      const wordCount = content.trim().split(/\s+/).length;
      if (wordCount < 15 && (content.includes('...') || content.toLowerCase().includes('chưa có nội dung') || content.toLowerCase().includes('trống'))) {
        log.warn('seeder.stub_skipped', `[Doc ${docNum}/${totalDocs}: ${title || baseName}] Skipping placeholder/stub document`, { filePath, wordCount });
        continue;
      }

      // Document-Level Checkpoint check: skip already completed documents in 0ms
      const isForce = Boolean(options?.force);
      const targetStage = options?.stage || 'all';
      const pgConnected = await isPgAvailable();
      if (!isForce) {
        const isDocDone = await ingestionManifest.isDocumentCompleted(
          baseName,
          filePath,
          targetStage,
          pgConnected,
          title
        );
        if (isDocDone) {
          log.info(
            'seeder.doc_skipped_checkpoint',
            `[Doc ${docNum}/${totalDocs}: ${title}] Document already fully ingested -> SKIPPED (0ms)`,
            { docNum, totalDocs, title, sourceName: baseName }
          );
          documentsProcessed++;
          continue;
        }
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
          docProgress: { docNum, totalDocs, title },
          skipMvRefresh: true, // Batch mode: skip per-doc MV refresh; refreshed once at end of batch
          correlationId: options?.correlationId || `${batchCorrelationId}-doc-${docNum}`,
        }
      );

      // Record document completion in persistent checkpoint manifest
      try {
        const fileStat = await fs.stat(filePath);
        await ingestionManifest.recordDocumentCompleted({
          sourceName: baseName,
          title,
          filePath,
          fileMtimeMs: Math.floor(fileStat.mtimeMs),
          chunksCount: seedResult.chunksIngested,
          stage: targetStage,
          completedAt: new Date().toISOString(),
        });
      } catch (manifestErr) {
        log.warn('seeder.manifest_record_failed', 'Failed to update document checkpoint manifest', {
          sourceName: baseName,
          error: manifestErr,
        });
      }

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
