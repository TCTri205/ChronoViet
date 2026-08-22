/**
 * CLI Command: Re-resolve Entities & Graph Edges with Audit Trail & Database Cascade Merge
 * Usage: pnpm --filter @chronoviet/data-ingestion rag:re-resolve
 */

import {
  createLogger,
  initSchema,
  query,
  inMemoryStore,
  isPgAvailable,
  logEntityAuditAction,
  resolveCanonicalEntity,
  withTransaction,
} from '@chronoviet/shared-spec';

const log = createLogger({ service: 'data-ingestion' });

export async function runReResolve(): Promise<{ resolvedEntitiesCount: number; auditLogsCount: number; mergedEntitiesCount: number }> {
  log.info('reresolve.started', 'Starting Chrono-RAG Knowledge Graph Re-Resolution Pipeline');
  await initSchema();

  const pgConnected = await isPgAvailable();
  let resolvedEntitiesCount = 0;
  let auditLogsCount = 0;
  let mergedEntitiesCount = 0;

  if (pgConnected) {
    const dbEntities = await query<{ id: string; name: string; type: string; aliases: string[]; metadata: Record<string, unknown> }>(
      'SELECT id, name, type, aliases, metadata FROM entities'
    );

    for (const entity of dbEntities) {
      const canonical = resolveCanonicalEntity(entity.name);
      if (canonical.entityId !== entity.id || canonical.canonicalName !== entity.name) {
        await withTransaction(async (execQuery) => {
          // 1. Ensure Canonical Entity is in entities table with merged aliases
          const mergedAliases = Array.from(new Set([...(entity.aliases || []), ...(canonical.aliases || [])]));
          await execQuery(`
            INSERT INTO entities (id, name, type, aliases, metadata)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
              aliases = ARRAY(SELECT DISTINCT unnest(array_cat(entities.aliases, EXCLUDED.aliases))),
              name = EXCLUDED.name;
          `, [canonical.entityId, canonical.canonicalName, entity.type, mergedAliases, JSON.stringify(entity.metadata || {})]);

          // 2. Cascade merge entity_chunks
          await execQuery(`
            INSERT INTO entity_chunks (entity_id, chunk_id)
            SELECT $1, chunk_id FROM entity_chunks WHERE entity_id = $2
            ON CONFLICT DO NOTHING;
          `, [canonical.entityId, entity.id]);
          await execQuery(`DELETE FROM entity_chunks WHERE entity_id = $1;`, [entity.id]);

          // 3. Delete potential colliding relationships before updating to prevent unique constraint violation on idx_rel_unique
          await execQuery(`
            DELETE FROM relationships r_old
            WHERE r_old.source_entity_id = $2
              AND EXISTS (
                SELECT 1 FROM relationships r_new
                WHERE r_new.source_entity_id = $1
                  AND r_new.target_entity_id = r_old.target_entity_id
                  AND r_new.relation_type = r_old.relation_type
              );
          `, [canonical.entityId, entity.id]);

          await execQuery(`UPDATE relationships SET source_entity_id = $1 WHERE source_entity_id = $2;`, [canonical.entityId, entity.id]);

          await execQuery(`
            DELETE FROM relationships r_old
            WHERE r_old.target_entity_id = $2
              AND EXISTS (
                SELECT 1 FROM relationships r_new
                WHERE r_new.target_entity_id = $1
                  AND r_new.source_entity_id = r_old.source_entity_id
                  AND r_new.relation_type = r_old.relation_type
              );
          `, [canonical.entityId, entity.id]);

          await execQuery(`UPDATE relationships SET target_entity_id = $1 WHERE target_entity_id = $2;`, [canonical.entityId, entity.id]);

          // 4. Purge self-loops created by the merge
          await execQuery(`DELETE FROM relationships WHERE source_entity_id = target_entity_id;`);

          // 5. Delete old entity row if ID changed
          if (canonical.entityId !== entity.id) {
            await execQuery(`DELETE FROM entities WHERE id = $1;`, [entity.id]);
            mergedEntitiesCount++;
          }

          // 7. Log Audit Event
          await logEntityAuditAction({
            entity_id: canonical.entityId,
            action_type: 'MERGE_ENTITY',
            modified_by: 'CLI_RE_RESOLVE',
            previous_state: { id: entity.id, name: entity.name, aliases: entity.aliases },
            new_state: { canonicalId: canonical.entityId, canonicalName: canonical.canonicalName, aliases: canonical.aliases },
            rationale: `Cascade re-resolved and merged entity '${entity.name}' (${entity.id}) to canonical ID '${canonical.entityId}'`,
          });
          auditLogsCount++;
        });
      }
      resolvedEntitiesCount++;
    }
  } else {
    for (const [id, entity] of inMemoryStore.entities.entries()) {
      const canonical = resolveCanonicalEntity(entity.name);
      if (canonical.entityId !== id || canonical.canonicalName !== entity.name) {
        inMemoryStore.entities.delete(id);
        inMemoryStore.entities.set(canonical.entityId, {
          id: canonical.entityId,
          name: canonical.canonicalName,
          type: entity.type,
          aliases: Array.from(new Set([...(entity.aliases || []), ...canonical.aliases])),
          metadata: entity.metadata || {},
        });

        for (const rel of inMemoryStore.relationships) {
          if (rel.source_entity_id === id) rel.source_entity_id = canonical.entityId;
          if (rel.target_entity_id === id) rel.target_entity_id = canonical.entityId;
        }

        inMemoryStore.relationships = inMemoryStore.relationships.filter(
          (r) => r.source_entity_id !== r.target_entity_id
        );

        mergedEntitiesCount++;

        await logEntityAuditAction({
          entity_id: canonical.entityId,
          action_type: 'MERGE_ENTITY',
          modified_by: 'CLI_RE_RESOLVE',
          previous_state: { id: entity.id, name: entity.name, aliases: entity.aliases },
          new_state: { canonicalId: canonical.entityId, canonicalName: canonical.canonicalName, aliases: canonical.aliases },
          rationale: `In-memory cascade re-resolved entity '${entity.name}' to canonical ID '${canonical.entityId}'`,
        });
        auditLogsCount++;
      }
      resolvedEntitiesCount++;
    }
  }

  log.info('reresolve.completed', 'Graph Re-Resolution completed', {
    entitiesEvaluated: resolvedEntitiesCount,
    auditLogsCreated: auditLogsCount,
    mergedEntitiesCount,
  });

  return { resolvedEntitiesCount, auditLogsCount, mergedEntitiesCount };
}

if (process.argv[1] && (process.argv[1].endsWith('re-resolve-cli.ts') || process.argv[1].endsWith('re-resolve-cli.js'))) {
  runReResolve()
    .then(() => process.exit(0))
    .catch((err) => {
      log.error('reresolve.failed', 'Re-resolve Pipeline Error', { error: err });
      process.exit(1);
    });
}
