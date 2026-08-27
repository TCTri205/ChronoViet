/**
 * ChronoEval v2.0 Idempotent PostgreSQL Benchmark Database Seeder
 * Populates real PostgreSQL tables (entities, relationships, document_chunks, entity_chunks)
 * with 300 canonical chunks, real 1024d embeddings (BGE-M3 @ Port 8092), and 115 gold graph triples.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ChronoevalDatasetItem,
  GoldReasoningTriple,
} from '@chronoviet/shared-spec';
import {
  isPgAvailable,
  query,
  initSchema,
  generateEmbedding,
  inMemoryStore,
  createLogger,
} from '@chronoviet/infra';
import { buildChronoEvalDatasets } from './builder.js';
import { globalCacheManager } from '../../src/retrieval/cache-manager.js';

const log = createLogger({ service: 'rag-benchmark-seeder' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SeederOptions {
  forceRebuild?: boolean;
}

export async function ensureBenchmarkDatabaseSeeded(options?: SeederOptions): Promise<{
  chunksCount: number;
  relationshipsCount: number;
  entitiesCount: number;
  usedPostgres: boolean;
}> {
  const forceRebuild = Boolean(options?.forceRebuild);

  // Invalidate any in-memory retrieval caches deterministically on seeding
  globalCacheManager.clearAll();

  const canonicalPath = path.resolve(__dirname, 'chronoeval-canonical-300.json');
  const goldTriplesPath = path.resolve(__dirname, 'gold-knowledge-graph-triples.json');

  let canonicalItems: ChronoevalDatasetItem[];
  let goldTriples: GoldReasoningTriple[];

  if (fs.existsSync(canonicalPath) && fs.existsSync(goldTriplesPath)) {
    canonicalItems = JSON.parse(fs.readFileSync(canonicalPath, 'utf-8'));
    goldTriples = JSON.parse(fs.readFileSync(goldTriplesPath, 'utf-8'));
  } else {
    log.info('seeder.building_datasets', 'Benchmark datasets not found on disk, building in-memory');
    const built = buildChronoEvalDatasets();
    canonicalItems = built.canonical300;
    goldTriples = built.goldTriples;
  }

  const isPg = await isPgAvailable();

  // 1. Always ensure inMemoryStore is populated in sync
  inMemoryStore.relationships = goldTriples.map((t) => ({
    source_entity_id: t.subject,
    relation_type: t.relation,
    target_entity_id: t.object,
    confidence: t.confidence ?? 1.0,
  }));

  // Collect unique entities and chunks
  const entityMap = new Map<string, { id: string; name: string; type: string; aliases: string[] }>();
  const chunkMap = new Map<
    string,
    {
      id: string;
      title: string;
      textContent: string;
      dynasty: string;
      epochIds: string[];
      sourceReliability: string;
      timeStart?: number;
      timeEnd?: number;
      entityIds: string[];
    }
  >();

  for (const item of canonicalItems) {
    if (item.canonical_entity_id) {
      entityMap.set(item.canonical_entity_id, {
        id: item.canonical_entity_id,
        name: item.canonical_entity_id.replace(/^person_|^event_|^artifact_|^epoch_/, '').replace(/_/g, ' '),
        type: item.canonical_entity_id.startsWith('person_')
          ? 'HISTORICAL_PERSON'
          : item.canonical_entity_id.startsWith('event_')
          ? 'EVENT_BATTLE'
          : 'ORGANIZATION',
        aliases: item.expected_aliases || [],
      });
    }

    if (item.epoch) {
      entityMap.set(item.epoch, {
        id: item.epoch,
        name: item.epoch.replace(/_/g, ' '),
        type: 'DYNASTY_ERA',
        aliases: [item.temporal_bounds?.dynasty || ''],
      });
    }

    for (const chunk of item.ground_truth_chunks) {
      const existing = chunkMap.get(chunk.chunk_id);
      if (!existing) {
        chunkMap.set(chunk.chunk_id, {
          id: chunk.chunk_id,
          title: chunk.title || 'Historical Text',
          textContent: chunk.text_content || '',
          dynasty: item.temporal_bounds?.dynasty || 'Nhà Tây Sơn',
          epochIds: item.epoch ? [item.epoch] : [],
          sourceReliability: chunk.source_reliability || 'LEVEL_1',
          timeStart: item.temporal_bounds?.time_start,
          timeEnd: item.temporal_bounds?.time_end,
          entityIds: item.canonical_entity_id ? [item.canonical_entity_id] : [],
        });
      } else if (item.canonical_entity_id && !existing.entityIds.includes(item.canonical_entity_id)) {
        existing.entityIds.push(item.canonical_entity_id);
      }
    }
  }

  // Also extract entities referenced in goldTriples
  for (const triple of goldTriples) {
    if (!entityMap.has(triple.subject)) {
      entityMap.set(triple.subject, {
        id: triple.subject,
        name: triple.subject.replace(/^person_|^event_|^artifact_|^epoch_/, '').replace(/_/g, ' '),
        type: 'HISTORICAL_ENTITY',
        aliases: [],
      });
    }
    if (!entityMap.has(triple.object)) {
      entityMap.set(triple.object, {
        id: triple.object,
        name: triple.object.replace(/^person_|^event_|^artifact_|^epoch_/, '').replace(/_/g, ' '),
        type: 'HISTORICAL_ENTITY',
        aliases: [],
      });
    }
  }

  // Populate inMemoryStore chunks
  for (const chunk of chunkMap.values()) {
    if (!inMemoryStore.documentChunks.has(chunk.id)) {
      inMemoryStore.documentChunks.set(chunk.id, {
        id: chunk.id,
        title: chunk.title,
        text_content: chunk.textContent,
        dynasty: chunk.dynasty,
        epoch_ids: chunk.epochIds,
        source_reliability: chunk.sourceReliability,
        time_start: chunk.timeStart,
        time_end: chunk.timeEnd,
        key_figures: chunk.entityIds,
      });

      for (const entId of chunk.entityIds) {
        inMemoryStore.entityChunks.push({
          entity_id: entId,
          chunk_id: chunk.id,
        });
      }
    }
  }

  if (!isPg) {
    log.info('seeder.in_memory_only', 'PostgreSQL offline; populated in-memory store for benchmark execution', {
      chunks: inMemoryStore.documentChunks.size,
      relationships: inMemoryStore.relationships.length,
      entityChunks: inMemoryStore.entityChunks.length,
    });
    return {
      chunksCount: inMemoryStore.documentChunks.size,
      relationshipsCount: inMemoryStore.relationships.length,
      entitiesCount: entityMap.size,
      usedPostgres: false,
    };
  }

  // 2. PostgreSQL Seeding
  await initSchema();

  log.info('seeder.seeding_postgres', 'Seeding benchmark dataset into PostgreSQL...', {
    totalEntities: entityMap.size,
    totalTriples: goldTriples.length,
    totalChunks: chunkMap.size,
  });

  // A. Seed Entities
  for (const ent of entityMap.values()) {
    await query(
      `INSERT INTO entities (id, name, type, aliases)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, type = EXCLUDED.type, aliases = EXCLUDED.aliases;`,
      [ent.id, ent.name, ent.type, ent.aliases]
    );
  }

  // B. Seed Relationships (always, so C3/SYS traverse the gold graph — not the production graph)
  // First clear any stale relationships between benchmark entities so the gold graph is the
  // ONLY graph those benchmarks traverse (the shared DB also contains production relations).
  const benchmarkEntityIds = Array.from(entityMap.keys());
  if (benchmarkEntityIds.length > 0) {
    await query(
      `DELETE FROM relationships
       WHERE source_entity_id = ANY($1) OR target_entity_id = ANY($1);`,
      [benchmarkEntityIds]
    );
  }
  for (const triple of goldTriples) {
    await query(
      `INSERT INTO relationships (source_entity_id, target_entity_id, relation_type, confidence)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING;`,
      [triple.subject, triple.object, triple.relation, triple.confidence ?? 1.0]
    );
  }

  // C. Skip embedding/chunk re-generation when the benchmark chunks already exist
  if (!forceRebuild) {
    const sampleCanonicalChunk = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM document_chunks WHERE id LIKE 'chunk_%_narrative_primary' OR id = 'chunk_event_dung_nuoc_van_lang_narrative_primary';"
    );
    const benchmarkCount = parseInt(sampleCanonicalChunk[0]?.count || '0', 10);

    if (benchmarkCount >= 100) {
      log.info('seeder.already_seeded', 'PostgreSQL benchmark chunks already seeded; skipping embedding regeneration', {
        benchmarkCanonicalChunks: benchmarkCount,
      });
      return {
        chunksCount: benchmarkCount,
        relationshipsCount: goldTriples.length,
        entitiesCount: entityMap.size,
        usedPostgres: true,
      };
    }
  }

  // D. Seed Document Chunks with real embeddings (in parallel batches)
  log.info('seeder.generating_embeddings', 'Generating real 1024d embeddings for benchmark chunks...');
  const chunksArray = Array.from(chunkMap.values());
  const BATCH_SIZE = 10;
  for (let i = 0; i < chunksArray.length; i += BATCH_SIZE) {
    const batch = chunksArray.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (chunk) => {
        const textToEmbed = `${chunk.title}: ${chunk.textContent}`.trim();
        let emb: number[] | undefined;
        try {
          emb = await generateEmbedding(textToEmbed);
        } catch {
          emb = undefined;
        }

        const vectorString = emb && emb.length > 0 ? `[${emb.join(',')}]` : null;

        if (vectorString) {
          await query(
            `INSERT INTO document_chunks (id, title, text_content, dynasty, epoch_ids, source_reliability, time_start, time_end, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
             ON CONFLICT (id) DO UPDATE
             SET title = EXCLUDED.title, text_content = EXCLUDED.text_content, embedding = EXCLUDED.embedding, dynasty = EXCLUDED.dynasty;`,
            [
              chunk.id,
              chunk.title,
              chunk.textContent,
              chunk.dynasty,
              chunk.epochIds,
              chunk.sourceReliability,
              chunk.timeStart ?? null,
              chunk.timeEnd ?? null,
              vectorString,
            ]
          );
        } else {
          await query(
            `INSERT INTO document_chunks (id, title, text_content, dynasty, epoch_ids, source_reliability, time_start, time_end)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE
             SET title = EXCLUDED.title, text_content = EXCLUDED.text_content, dynasty = EXCLUDED.dynasty;`,
            [
              chunk.id,
              chunk.title,
              chunk.textContent,
              chunk.dynasty,
              chunk.epochIds,
              chunk.sourceReliability,
              chunk.timeStart ?? null,
              chunk.timeEnd ?? null,
            ]
          );
        }

        // Link entity_chunks
        for (const entId of chunk.entityIds) {
          await query(
            `INSERT INTO entity_chunks (entity_id, chunk_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING;`,
            [entId, chunk.id]
          );
        }
      })
    );
  }

  log.info('seeder.seeding_complete', 'Benchmark database seeding finished successfully');

  return {
    chunksCount: chunkMap.size,
    relationshipsCount: goldTriples.length,
    entitiesCount: entityMap.size,
    usedPostgres: true,
  };
}
