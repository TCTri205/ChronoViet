/**
 * Ingestion runtime for Historical Documents & Knowledge Seeding
 */

import {
  HistoricalEntityInfo,
  HISTORICAL_PERSON_DICTIONARY,
  HISTORICAL_LOCATION_DICTIONARY,
  formatSameAsLocationRelations,
  formatAliasOfRelations,
  resolveCanonicalEntity,
} from '@chronoviet/shared-spec';
import { isPgAvailable, query, inMemoryStore } from './db/client.js';
import { generateEmbedding } from './embeddings.js';

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Ingests a historical document into the database/store
 */
export async function ingestHistoricalDocument(
  content: string,
  metadata: { title: string; source: string; dynasty?: string; sourceReliability?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' }
): Promise<void> {
  const chunkId = `chunk_${hashString(metadata.title + content.slice(0, 50))}`;
  const embedding = await generateEmbedding(content);

  // Extract entities mentioned in content
  const entityMap = new Map<string, HistoricalEntityInfo>();

  for (const person of Object.values(HISTORICAL_PERSON_DICTIONARY)) {
    if (content.includes(person.canonicalName) || person.aliases.some((a) => content.includes(a))) {
      entityMap.set(person.entityId, person);
    }
  }

  for (const loc of Object.values(HISTORICAL_LOCATION_DICTIONARY)) {
    if (content.includes(loc.canonicalName) || loc.aliases.some((a) => content.includes(a))) {
      entityMap.set(loc.entityId, loc);
    }
  }

  const pgConnected = await isPgAvailable();

  if (pgConnected) {
    await query(
      `INSERT INTO document_chunks (id, title, text_content, dynasty, source_reliability, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)
       ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content;`,
      [chunkId, metadata.title, content, metadata.dynasty || null, metadata.sourceReliability || 'LEVEL_1', JSON.stringify(embedding)]
    );

    for (const entity of entityMap.values()) {
      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET aliases = EXCLUDED.aliases;`,
        [entity.entityId, entity.canonicalName, entity.type, entity.aliases, JSON.stringify({})]
      );

      await query(
        `INSERT INTO entity_chunks (entity_id, chunk_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING;`,
        [entity.entityId, chunkId]
      );
    }

    const sameAsRels = formatSameAsLocationRelations();
    for (const rel of sameAsRels) {
      const srcEntity = resolveCanonicalEntity(rel.source);
      const tgtEntity = resolveCanonicalEntity(rel.target);
      if (srcEntity.entityId === tgtEntity.entityId) continue;

      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)
         ON CONFLICT (id) DO NOTHING;`,
        [srcEntity.entityId, srcEntity.canonicalName, srcEntity.type, srcEntity.aliases]
      );
      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)
         ON CONFLICT (id) DO NOTHING;`,
        [tgtEntity.entityId, tgtEntity.canonicalName, tgtEntity.type, tgtEntity.aliases]
      );
      await query(
        `INSERT INTO relationships (source_entity_id, target_entity_id, relation_type, confidence)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING;`,
        [srcEntity.entityId, tgtEntity.entityId, rel.relationType, rel.confidence]
      );
    }

    const aliasRels = formatAliasOfRelations();
    for (const rel of aliasRels) {
      const srcEntity = resolveCanonicalEntity(rel.source);
      const tgtEntity = resolveCanonicalEntity(rel.target);
      if (srcEntity.entityId === tgtEntity.entityId) continue;

      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)
         ON CONFLICT (id) DO NOTHING;`,
        [srcEntity.entityId, srcEntity.canonicalName, srcEntity.type, srcEntity.aliases]
      );
      await query(
        `INSERT INTO entities (id, name, type, aliases, metadata)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)
         ON CONFLICT (id) DO NOTHING;`,
        [tgtEntity.entityId, tgtEntity.canonicalName, tgtEntity.type, tgtEntity.aliases]
      );
      await query(
        `INSERT INTO relationships (source_entity_id, target_entity_id, relation_type, confidence)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING;`,
        [srcEntity.entityId, tgtEntity.entityId, rel.relationType, rel.confidence]
      );
    }
  } else {
    // In-memory fallback
    inMemoryStore.documentChunks.set(chunkId, {
      id: chunkId,
      title: metadata.title,
      text_content: content,
      dynasty: metadata.dynasty,
      source_reliability: metadata.sourceReliability || 'LEVEL_1',
      embedding,
    });

    for (const entity of entityMap.values()) {
      inMemoryStore.entities.set(entity.entityId, {
        id: entity.entityId,
        name: entity.canonicalName,
        type: entity.type,
        aliases: entity.aliases,
        metadata: {},
      });

      inMemoryStore.entityChunks.push({
        entity_id: entity.entityId,
        chunk_id: chunkId,
      });
    }

    const sameAsRels = formatSameAsLocationRelations();
    for (const rel of sameAsRels) {
      const srcEntity = resolveCanonicalEntity(rel.source);
      const tgtEntity = resolveCanonicalEntity(rel.target);
      if (srcEntity.entityId === tgtEntity.entityId) continue;

      const exists = inMemoryStore.relationships.some(
        (r: any) => r.source_entity_id === srcEntity.entityId && r.target_entity_id === tgtEntity.entityId && r.relation_type === rel.relationType
      );
      if (!exists) {
        inMemoryStore.relationships.push({
          id: inMemoryStore.nextRelId++,
          source_entity_id: srcEntity.entityId,
          target_entity_id: tgtEntity.entityId,
          relation_type: rel.relationType,
          confidence: rel.confidence,
        });
      }
    }

    const aliasRels = formatAliasOfRelations();
    for (const rel of aliasRels) {
      const srcEntity = resolveCanonicalEntity(rel.source);
      const tgtEntity = resolveCanonicalEntity(rel.target);
      if (srcEntity.entityId === tgtEntity.entityId) continue;

      const exists = inMemoryStore.relationships.some(
        (r: any) => r.source_entity_id === srcEntity.entityId && r.target_entity_id === tgtEntity.entityId && r.relation_type === rel.relationType
      );
      if (!exists) {
        inMemoryStore.relationships.push({
          id: inMemoryStore.nextRelId++,
          source_entity_id: srcEntity.entityId,
          target_entity_id: tgtEntity.entityId,
          relation_type: rel.relationType,
          confidence: rel.confidence,
        });
      }
    }
  }
}
